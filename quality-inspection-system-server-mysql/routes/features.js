const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
const moment = require('moment');
const { Contract } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { extractTextFromDocxBuffer } = require('../utils/extract-text');
const { loadKnowledgeSources, retrieveKnowledge, inferContractCategory } = require('../utils/knowledge-service');

// 通用 OpenAI 兼容大模型配置（DeepSeek / 智谱GLM / 硅基流动 / 本地Ollama 均可接入）
const LLM_BASE = process.env.LLM_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const LLM_KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';

// ================= 合同到期提醒 ================
// GET /api/expiring_contracts?days=30
// 查询 expiry_date 在未来 N 天内的合同，按到期日升序，附带 days_left
const getExpiringContracts = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const today = moment().startOf('day');
    const deadline = moment().add(days, 'days').endOf('day');

    const contracts = await Contract.findAll({
      where: {
        user_id: req.user?.id || null,
        expiry_date: {
          [Op.not]: null,
          [Op.between]: [today.format('YYYY-MM-DD'), deadline.format('YYYY-MM-DD')]
        }
      },
      attributes: ['id', 'file_name', 'contract_type', 'expiry_date', 'risk_score', 'risk_level', 'created_at'],
      order: [['expiry_date', 'ASC']]
    });

    const list = contracts.map(c => ({
      id: c.id,
      fileName: c.file_name,
      contractType: c.contract_type,
      expiryDate: c.expiry_date,
      riskScore: c.risk_score,
      riskLevel: c.risk_level,
      daysLeft: moment(c.expiry_date).diff(today, 'days')
    }));

    return res.status(200).json({
      err_code: 0,
      message: '获取成功',
      data: list
    });
  } catch (error) {
    console.error('获取即将到期合同失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// ================= 合同风险评分 ================
// POST /api/score_contract  { contractContent, contractName, contractId? }
// 设计要点：
// 1) 全文分段评分，不再只取前 6000 字；
// 2) 接入三源知识库，风险点必须标注可追溯的依据编号；
// 3) 模型失败/解析失败不再返回默认 50 分，改为明确报错，避免把假结论当真；
// 4) 未覆盖段落、失败段落显式写入结论，交由用户决定是否人工复核。
const SCORE_CHUNK_SIZE = 10000;
const SCORE_MAX_CHUNKS = 4;
const SCORE_LLM_TIMEOUT = 60000;

// 按行切分，尽量保持条款完整；超长单行硬切，避免超出上下文
function splitForScoring(text, size = SCORE_CHUNK_SIZE) {
  const src = String(text || '');
  const lines = src.split(/\r?\n/);
  const chunks = [];
  let buf = '';
  lines.forEach((line) => {
    if (buf && buf.length + line.length + 1 > size) {
      chunks.push(buf);
      buf = '';
    }
    buf += line + '\n';
    while (buf.length > size) {
      chunks.push(buf.slice(0, size));
      buf = buf.slice(size);
    }
  });
  if (buf.trim()) chunks.push(buf);
  return chunks.length ? chunks : [src];
}

// 三源知识库检索：为评分提供可引用的依据条目（带编号）
async function buildScoringEvidence(content, contractName) {
  try {
    const sources = await loadKnowledgeSources();
    const categoryHint = inferContractCategory(contractName);
    const query = `${contractName || ''} ${String(content || '').slice(0, 800)}`;
    const items = retrieveKnowledge(query, sources, 8, categoryHint) || [];
    return items.map((item, i) => ({
      id: `L${i + 1}`,
      title: item.title || '未命名条目',
      category: item.category || '',
      content: String(item.content || '').slice(0, 220),
      source: item.source || '',
      effectiveDate: item.effectiveDate || '',
      type: item.type || 'law'
    }));
  } catch (error) {
    console.warn('评分检索知识库失败（将不带引用依据继续）:', error.message);
    return [];
  }
}

function formatEvidenceForPrompt(evidence) {
  if (!evidence || !evidence.length) {
    return '（本次未检索到可引用条文：请只描述风险现象与后果，不得编造法条名称或条号，依据处统一写“依据：未检索到条文，建议人工核实”）';
  }
  return evidence.map((e) => {
    const typeLabel = e.type === 'history' ? '历史案例' : e.type === 'template' ? '标准模板' : '法规';
    const meta = [e.source, e.effectiveDate ? `${e.effectiveDate} 施行` : ''].filter(Boolean).join('，');
    return `[${e.id}]【${typeLabel}】${e.title}（${e.category}${meta ? '；' + meta : ''}）：${e.content}`;
  }).join('\n');
}

function buildScorePrompt(chunk, contractName, evidenceText, partInfo) {
  return `你是资深合同风控法务，请对下面这段合同内容做风险评估。

合同名称：${contractName || '未命名合同'}
${partInfo ? `本段为全文第 ${partInfo.index}/${partInfo.total} 段，只评本段，不要推测其他段落的内容。` : ''}

【可引用依据】（只能使用下列编号，禁止编造条文）
${evidenceText}

【合同内容】
${chunk}

只输出 JSON，不要 markdown 代码块，不要任何多余文字：
{"score":0到100的整数,"level":"低|中|高","risks":["风险点（依据：L2）"],"suggestions":["修改建议"]}

规则：
1) score 越高风险越大：0-40 为低风险，41-70 为中风险，71-100 为高风险；
2) risks 最多 5 条、suggestions 最多 4 条；每条必须指明本段中的具体表述或本段缺失的必备条款，不得编造本段未涉及的事实；若本段确无实质风险，risks 返回空数组，不要为凑数量编造问题；
3) 每条 risks 末尾用（依据：Lx）标注引用的依据编号；无对应条文时写（依据：未检索到条文，建议人工核实）；
4) 不得出现上面未列出的依据编号或法条名称。`;
}

// 单段评分：返回 null 表示本次失败（由调用方决定是否中断）
async function callScoreLLM(prompt) {
  const response = await axios.post(`${LLM_BASE}/chat/completions`, {
    model: LLM_MODEL,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    max_tokens: 1400,
    temperature: 0.2
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_KEY}`
    },
    timeout: SCORE_LLM_TIMEOUT
  });

  const raw = response.data?.choices?.[0]?.message?.content || '';
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  let parsed = null;
  try {
    parsed = JSON.parse(raw.substring(start, end + 1));
  } catch (e) {
    return null;
  }
  if (!parsed || typeof parsed.score !== 'number' || Number.isNaN(parsed.score)) return null;

  return {
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String).filter(Boolean) : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String).filter(Boolean) : []
  };
}

const scoreContract = async (req, res) => {
  try {
    const { contractContent, contractName, contractId } = req.body || {};

    if (!contractContent || !String(contractContent).trim()) {
      return res.status(400).json({
        err_code: 400,
        message: '合同内容不能为空'
      });
    }

    const content = String(contractContent);
    const chunks = splitForScoring(content);
    const pending = chunks.slice(0, SCORE_MAX_CHUNKS);
    const truncated = chunks.length > pending.length;

    const evidence = await buildScoringEvidence(content, contractName);
    const evidenceText = formatEvidenceForPrompt(evidence);

    const results = [];
    const failedParts = [];
    for (let i = 0; i < pending.length; i += 1) {
      const partInfo = pending.length > 1 ? { index: i + 1, total: pending.length } : null;
      try {
        const partResult = await callScoreLLM(buildScorePrompt(pending[i], contractName, evidenceText, partInfo));
        if (partResult) results.push(partResult);
        else failedParts.push(i + 1);
      } catch (error) {
        console.error(`合同评分第 ${i + 1} 段调用失败:`, error.message);
        failedParts.push(i + 1);
      }
    }

    // 全部段落失败：明确报错，不再用默认分冒充结果
    if (!results.length) {
      return res.status(502).json({
        err_code: 502,
        message: '风险评估失败：模型服务暂不可用，本次未生成任何评分结论，请稍后重试'
      });
    }

    // 合并：最差条款决定整体风险，同时参考各段均值
    const maxScore = Math.max(...results.map((r) => r.score));
    const avgScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
    const score = results.length === 1 ? maxScore : Math.round(maxScore * 0.7 + avgScore * 0.3);
    const level = score <= 40 ? '低' : score <= 70 ? '中' : '高';

    const risks = [];
    const suggestions = [];
    results.forEach((r) => {
      r.risks.forEach((item) => { if (!risks.includes(item)) risks.push(item); });
      r.suggestions.forEach((item) => { if (!suggestions.includes(item)) suggestions.push(item); });
    });

    // 覆盖字数按原文长度封顶，避免按行累加末尾换行导致的轻微虚高
    const coveredChars = Math.min(content.length, pending.reduce((sum, c) => sum + c.length, 0));
    // 覆盖说明必须保留在结论里（放在最前面，避免被条数上限截掉）
    const notices = [];
    if (truncated) {
      notices.push(`本份合同较长，仅评估了前 ${pending.length} 段（约 ${coveredChars} 字），其余内容未纳入结论，请人工复核剩余条款（依据：未检索到条文，建议人工核实）`);
    }
    failedParts.forEach((part) => {
      notices.push(`第 ${part} 段内容评估失败，本结论未覆盖该部分，请人工复核（依据：未检索到条文，建议人工核实）`);
    });

    const scoreData = {
      score,
      level,
      risks: [...notices, ...risks].slice(0, 8),
      suggestions: suggestions.slice(0, 6),
      evidence,
      meta: {
        totalChars: content.length,
        coveredChars,
        chunks: chunks.length,
        evaluated: results.length,
        truncated,
        failedParts
      }
    };

    // 若传了 contractId，把评分写回 contracts 表
    if (contractId) {
      try {
        await Contract.update(
          { risk_score: scoreData.score, risk_level: scoreData.level },
          { where: { id: contractId, user_id: req.user?.id || null } }
        );
      } catch (updateError) {
        console.error('回写风险评分失败:', updateError.message);
      }
    }

    return res.status(200).json({
      err_code: 0,
      message: '评分成功',
      data: scoreData
    });
  } catch (error) {
    console.error('合同风险评分失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};


// ================= 数据统计面板 ================
// GET /api/dashboard_stats
// 返回：合同总数、本月新增、即将到期数、高风险合同数、平均风险分
const getDashboardStats = async (req, res) => {
  try {
    const monthStart = moment().startOf('month').toDate();
    const monthEnd = moment().endOf('month').toDate();
    const today = moment().startOf('day').format('YYYY-MM-DD');
    const thirtyDaysLater = moment().add(30, 'days').endOf('day').format('YYYY-MM-DD');

    const ownerId = req.user?.id || null;

    const totalContracts = await Contract.count({ where: { user_id: ownerId } });

    const monthNew = await Contract.count({
      where: {
        user_id: ownerId,
        created_at: { [Op.between]: [monthStart, monthEnd] }
      }
    });

    const expiringCount = await Contract.count({
      where: {
        user_id: ownerId,
        expiry_date: {
          [Op.not]: null,
          [Op.between]: [today, thirtyDaysLater]
        }
      }
    });

    const highRiskCount = await Contract.count({
      where: {
        user_id: ownerId,
        risk_score: { [Op.gte]: 71 }
      }
    });

    const avgResult = await Contract.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('risk_score')), 'avgScore']],
      where: { user_id: ownerId, risk_score: { [Op.not]: null } },
      raw: true
    });
    const avgRiskScore = avgResult && avgResult.avgScore !== null
      ? Math.round(parseFloat(avgResult.avgScore) * 10) / 10
      : 0;

    return res.status(200).json({
      err_code: 0,
      message: '获取成功',
      data: {
        totalContracts,
        monthNew,
        expiringCount,
        highRiskCount,
        avgRiskScore
      }
    });
  } catch (error) {
    console.error('获取统计面板数据失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// ================= 批量上传 ================
const batchStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads/contracts');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, uniqueSuffix + path.extname(originalName));
  }
});

const batchUpload = multer({
  storage: batchStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// POST /api/batch_upload  (multipart, field: files, 最多10个)
const handleBatchUpload = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        err_code: 400,
        message: '请选择要上传的文件'
      });
    }

    const userId = req.user?.id || null;
    const results = [];

    for (const file of req.files) {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      try {
        // 提取文件内容（仅 docx 提取文本，其他类型存空）
        let fileContent = '';
        const ext = path.extname(originalName).toLowerCase();
        if (ext === '.docx') {
          try {
            fileContent = await extractTextFromDocxBuffer(fs.readFileSync(file.path));
          } catch (e) {
            console.error(`解析 ${originalName} 失败:`, e.message);
          }
        }

        const contract = await Contract.create({
          file_name: originalName,
          file_path: file.path,
          file_size: file.size,
          content: fileContent,
          user_id: userId,
          contract_type: 'review'
        });

        results.push({
          fileName: originalName,
          success: true,
          id: contract.id,
          message: '上传成功'
        });
      } catch (error) {
        console.error(`文件 ${originalName} 处理失败:`, error.message);
        // 清理已上传的文件
        try { fs.unlinkSync(file.path); } catch (e) { /* ignore */ }
        results.push({
          fileName: originalName,
          success: false,
          message: '处理失败: ' + error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return res.status(200).json({
      err_code: 0,
      message: `批量上传完成，成功 ${successCount}/${results.length} 个`,
      data: results
    });
  } catch (error) {
    console.error('批量上传失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

module.exports = {
  getExpiringContracts,
  scoreContract,
  getDashboardStats,
  batchUpload,
  handleBatchUpload
};
