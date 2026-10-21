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
// 调用大模型对合同做风险评估，要求模型只返回 JSON
const scoreContract = async (req, res) => {
  try {
    const { contractContent, contractName, contractId } = req.body;

    if (!contractContent) {
      return res.status(400).json({
        err_code: 400,
        message: '合同内容不能为空'
      });
    }

    const prompt = `你是一名专业的法务风控专家。请对以下合同进行风险评估。

合同名称：${contractName || '未命名合同'}

合同内容：
${contractContent.substring(0, 6000)}

请评估该合同的风险程度，并严格按照以下 JSON 格式返回结果（只输出 JSON，不要 markdown 代码块，不要任何其他文字）：
{"score": 0到100的整数（分数越高风险越大）, "level": "低|中|高", "risks": ["风险点1", "风险点2"], "suggestions": ["建议1", "建议2"]}

评分参考：0-40 为低风险，41-70 为中风险，71-100 为高风险。risks 和 suggestions 各列出 2-5 条。`;

    let scoreData = null;

    try {
      const response = await axios.post(`${LLM_BASE}/chat/completions`, {
        model: LLM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        max_tokens: 1500,
        temperature: 0.3
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LLM_KEY}`
        },
        timeout: 90000
      });

      const raw = response.data.choices?.[0]?.message?.content || '';
      console.log('风险评分AI原始返回:', raw);

      // 容错解析：提取第一个 { 到最后一个 } 之间的内容再 JSON.parse
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        scoreData = JSON.parse(raw.substring(start, end + 1));
      }
    } catch (llmError) {
      console.error('调用大模型评分失败:', llmError.message);
    }

    // 解析失败或调用失败时给默认分
    if (!scoreData || typeof scoreData.score !== 'number') {
      scoreData = {
        score: 50,
        level: '中',
        risks: ['AI 评分暂时不可用，以下为默认评估结果', '建议人工复核合同条款'],
        suggestions: ['请仔细检查合同中的违约责任和赔偿条款', '建议咨询专业法务人员']
      };
    }

    // 规范化字段
    scoreData.score = Math.max(0, Math.min(100, Math.round(scoreData.score)));
    if (!['低', '中', '高'].includes(scoreData.level)) {
      scoreData.level = scoreData.score <= 40 ? '低' : (scoreData.score <= 70 ? '中' : '高');
    }
    if (!Array.isArray(scoreData.risks)) scoreData.risks = [];
    if (!Array.isArray(scoreData.suggestions)) scoreData.suggestions = [];

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
