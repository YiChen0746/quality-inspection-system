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
4) 不得出现上面未列出的依据编号或法条名称；
5) 忠于原文：引用原文表述必须保留原措辞，不得改写、概括或补全原文没有写的内容；若原文已就某事项作出明确约定（例如已写明争议解决方式、付款时间、违约金比例），不得声称该事项「缺失」「未约定」「没有规定」，只能就其不足之处提出问题（如管辖法院的层级或地点不够明确、付款节点未与交付验收绑定、违约金比例明显过低）；
6) 同一实质问题只保留一条风险点，不要为凑数量把同一问题拆成多条，也不要换措辞重复描述；
7) suggestions 必须与 risks 逐条对应，尽量给出可直接替换或补充的条款文本，而不是泛泛提示「建议完善」；
8) 不得给出与原文所选路径相冲突的建议：原文约定诉讼管辖的，不得建议改为仲裁或补充「仲裁机构」「仲裁条款」；原文约定仲裁的，不得建议改为诉讼；原文已确定金额、比例、期限的，只能就合理性提出意见，不得当作缺失项。
9) 若原文已明确排除某种争议解决方式（例如写明「不选择仲裁」），这属于当事人意思自治，不得把它当作风险点，也不得建议引入该方式；只能针对所选方式的可执行性提意见（例如管辖法院的地点或层级未明确）。
10) 输出必须是合法 JSON：字符串内不得出现未转义的英文双引号，需要强调时用中文书名号或「」。`;
}

// 归并近似重复项：多段评分时，同一问题在不同段落常以不同措辞出现
// 归一化时去掉依据标注、标点、"明确/具体/相关"等填充词，并把常见同义词统一，
// 避免同一问题因「条款/约定」「时间/期限」这类用词差异而漏判
const FILLER_WORDS = /(具体的|具体|明确|相关|有关|相应|进行|存在|目前|当前)/g;
const SYNONYM_GROUPS = [/约定|内容|条文/g, /挂钩|绑定|关联/g, /时间|期间|期限/g];
function normalizeForCompare(text) {
  let out = String(text || '')
    .replace(/（依据：[^）]*）/g, '')
    .replace(FILLER_WORDS, '');
  SYNONYM_GROUPS.forEach((re) => { out = out.replace(re, '条款'); });
  return out
    .replace(/[\s，,。；;：:、"'“”‘’（）()【】\[\]《》!！?？\-—_/]/g, '')
    .toLowerCase();
}

function bigramSet(str) {
  const set = new Set();
  for (let i = 0; i < str.length - 1; i += 1) set.add(str.slice(i, i + 2));
  return set;
}

function isSimilarText(a, b) {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (na.length < 6 || nb.length < 6) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= longer.length * 0.6 && longer.includes(shorter)) return true;
  const sa = bigramSet(na);
  const sb = bigramSet(nb);
  if (!sa.size || !sb.size) return false;
  let inter = 0;
  sa.forEach((g) => { if (sb.has(g)) inter += 1; });
  return inter / (sa.size + sb.size - inter) >= 0.55;
}

function mergeSimilarItems(items, limit) {
  const kept = [];
  (items || []).forEach((item) => {
    const text = String(item || '').trim();
    if (!text) return;
    if (kept.some((k) => isSimilarText(k, text))) return;
    kept.push(text);
  });
  const max = Number.isFinite(limit) ? Math.max(0, limit) : kept.length;
  return kept.slice(0, max);
}

// 原文明确排除某争议解决方式时，把模型仍推荐该方式的条目滤掉（提示词之外的确定性兜底）
function detectExcludedPath(content) {
  const text = String(content || '');
  const excluded = [];
  if (/不(选择|采用|适用|提交|约定)?\s*仲裁|排除\s*仲裁|不通过\s*仲裁/.test(text)) excluded.push('仲裁');
  if (/不(选择|采用|适用|提交)?\s*诉讼|排除\s*诉讼|不通过\s*诉讼/.test(text)) excluded.push('诉讼');
  return excluded;
}

function dropPathConflictItems(items, excluded) {
  if (!excluded.length) return { kept: items || [], removed: 0 };
  // 出现"冲突/矛盾/并存/无效"等表述时，说明该条是在指出条款冲突，不应过滤
  const conflictContext = /(冲突|矛盾|并存|重复|无效|相互抵触)/;
  const kept = [];
  let removed = 0;
  (items || []).forEach((item) => {
    const text = String(item || '');
    const hitExcluded = excluded.some((path) => text.includes(path));
    if (hitExcluded && !conflictContext.test(text)) { removed += 1; return; }
    kept.push(item);
  });
  return { kept, removed };
}

// 从模型输出中提取 JSON：先按标准解析，再针对中文引号、尾随逗号等常见瑕疵修复
function parseScoreJson(raw) {
  const text = String(raw || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  const body = text.substring(start, end + 1);
  const candidates = [
    body,
    body.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'"),
    body.replace(/,\s*([}\]])/g, '$1'),
    body.replace(/[\u201c\u201d]/g, '"').replace(/,\s*([}\]])/g, '$1')
  ];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) { /* 继续尝试下一种修复 */ }
  }
  return null;
}

// 兜底：JSON 整体不可解析时，至少把 score 与两类文本数组捞出来，避免整段结论丢失
function salvageScorePayload(raw) {
  const text = String(raw || '');
  const scoreMatch = text.match(/"score"\s*:\s*(-?\d+(?:\.\d+)?)/);
  if (!scoreMatch) return null;
  const grabList = (key) => {
    const block = new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`).exec(text);
    if (!block) return [];
    const items = [];
    const re = /"((?:[^"\\]|\\.)*)"/g;
    let hit;
    while ((hit = re.exec(block[1])) !== null) {
      items.push(hit[1].replace(/\\"/g, '"').replace(/\\n/g, ' '));
    }
    return items;
  };
  return {
    score: Number(scoreMatch[1]),
    risks: grabList('risks'),
    suggestions: grabList('suggestions')
  };
}

// 模型偶尔把条目写成对象（如 {"risk":"…","依据":"L1"}），统一转成可读文本，避免出现 [object Object]
function itemToText(item) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  const primary = item.risk || item.desc || item.description || item.text || item.title || item.content || item.suggestion || '';
  const basis = item.basis || item.evidence || item.reference || item['依据'] || item.law || '';
  let text = typeof primary === 'string' ? primary.trim() : '';
  if (!text) {
    text = Object.values(item).filter((v) => typeof v === 'string').join('，').trim();
  }
  if (!text) return '';
  if (basis && !/依据/.test(text)) text = `${text}（依据：${String(basis).trim()}）`;
  return text.trim();
}

// 单段评分：返回 null 表示本次失败（由调用方决定是否中断）
// 解析失败时自动重试一次，并把「只要 JSON」的约束再强调一遍
async function callScoreLLM(prompt, attempt = 1) {
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
  const parsed = parseScoreJson(raw) || salvageScorePayload(raw);

  if (!parsed || typeof parsed.score !== 'number' || Number.isNaN(parsed.score)) {
    if (attempt < 2) {
      const reinforced = `${prompt}\n\n上一次输出无法解析为 JSON。请严格只输出一个 JSON 对象，不要解释文字，字符串内不要出现英文双引号。`;
      return callScoreLLM(reinforced, attempt + 1);
    }
    return null;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(itemToText).filter(Boolean) : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(itemToText).filter(Boolean) : []
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

    // 多段结果常出现同义重复的风险点，归并近似项后再按条数上限截断
    const excludedPaths = detectExcludedPath(content);
    const riskGuard = dropPathConflictItems(risks, excludedPaths);
    const suggestionGuard = dropPathConflictItems(suggestions, excludedPaths);
    const RISK_LIMIT = 8;
    const mergedRisks = mergeSimilarItems(riskGuard.kept, Math.max(0, RISK_LIMIT - notices.length));
    const mergedSuggestions = mergeSimilarItems(suggestionGuard.kept, 6);

    const scoreData = {
      score,
      level,
      risks: [...notices, ...mergedRisks].slice(0, RISK_LIMIT),
      suggestions: mergedSuggestions,
      evidence,
      meta: {
        totalChars: content.length,
        coveredChars,
        chunks: chunks.length,
        evaluated: results.length,
        truncated,
        failedParts,
        rawRiskCount: risks.length,
        mergedRiskCount: mergedRisks.length,
        excludedPaths,
        filteredByPath: riskGuard.removed + suggestionGuard.removed
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
