const express = require('express');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Contract } = require('../models');
const { loadKnowledgeSources, retrieveKnowledge, inferContractCategory } = require('../utils/knowledge-service');

// ==================== 表单环节顺序（指引面板使用） ====================
// 新手起草合同的标准填写顺序
const FORM_STEPS = [
  { key: 'contractName',   label: '合同名称',       desc: '一句话概括合同主题，例如"厂房租赁合同"',     required: true },
  { key: 'contractType',   label: '合同类型',       desc: '选择合同类别，系统将据此推荐必备条款',        required: false },
  { key: 'partyA',         label: '甲方（签约方一）', desc: '填写甲方完整名称或姓名',                     required: true },
  { key: 'partyB',         label: '乙方（签约方二）', desc: '填写乙方完整名称或姓名',                     required: true },
  { key: 'subject',        label: '合同主体类型',   desc: '选择个人 / 公司 / 其他组织',                  required: true },
  { key: 'description',   label: '合同主要内容',   desc: '用一段话描述合同标的、权利义务、期限等核心事项', required: true },
  { key: 'expiryDate',    label: '合同到期日期',   desc: '合同终止日期；无固定期限可留空',               required: false }
];

// 复用的统一 LLM 调用工具（同步、带一次重试、失败返回 null）
async function callLLM(prompt, { maxTokens = 600, temperature = 0.7, systemPrompt = '' } = {}) {
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const resp = await axios.post(`${LLM_BASE}/chat/completions`, {
        model: LLM_MODEL,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
        stream: false,
        max_tokens: maxTokens,
        temperature
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LLM_KEY}`
        },
        timeout: 30000,
        httpsAgent: new https.Agent({ keepAlive: true, timeout: 30000 })
      });
      const c = resp.data?.choices?.[0]?.message?.content;
      if (c && String(c).trim()) return String(c).trim();
      return null;
    } catch (err) {
      if (attempt === 0) { await new Promise(r => setTimeout(r, 1200)); continue; }
      console.error('[contract-llm] call failed:', err.message);
    }
  }
  return null;
}

// ==================== 合同起草指引 ====================
// POST /api/contract_guidance
// body: { currentField, contractForm }
// 返回：当前环节 / 下一环节 / 填写提示 / 法条依据（带书名号）
let _kbCache = null; // 服务启动时加载一次，失败时 fallback
async function loadKB() {
  if (_kbCache) return _kbCache;
  try {
    _kbCache = await loadKnowledgeSources();
  } catch (e) {
    console.warn('[guidance] KB load failed, fallback to empty');
    _kbCache = { historyCases: [], templates: [] };
  }
  return _kbCache;
}

const getGuidance = async (req, res) => {
  try {
    const { currentField, contractForm = {} } = req.body;

    // 1. 推导当前环节索引
    let currentIdx = FORM_STEPS.findIndex(s => s.key === currentField);
    if (currentIdx === -1) currentIdx = FORM_STEPS.findIndex(s => !contractForm[s.key]);
    if (currentIdx === -1) currentIdx = 0;

    // 2. 推导下一环节（跳到第一个未填且 required 的）
    let nextIdx = -1;
    for (let i = 0; i < FORM_STEPS.length; i++) {
      if (!contractForm[FORM_STEPS[i].key] || String(contractForm[FORM_STEPS[i].key]).trim().length < 2) {
        nextIdx = i; break;
      }
    }
    if (nextIdx === -1) nextIdx = Math.min(currentIdx + 1, FORM_STEPS.length - 1);

    const currentStep = FORM_STEPS[currentIdx];
    const nextStep    = FORM_STEPS[nextIdx];

    // 3. 填写作答提示（LLM 生成，100 字以内中文）
    let hint = currentStep.desc; // fallback 用硬编码 desc
    const formSummary = Object.entries(contractForm)
      .filter(([k, v]) => v && String(v).trim())
      .map(([k, v]) => `${FORM_STEPS.find(s => s.key === k)?.label || k}：${String(v).slice(0, 40)}`)
      .join('；');
    const llmHint = await callLLM(
      `用户正在填写合同起草表单，已填内容：${formSummary || '（尚未填写）'}。\n当前要填写的环节：「${currentStep.label}」。\n请用 80 字以内的中文告诉用户：这一项该怎么填、有哪些关键注意点。直接输出提示语，不要 markdown，不要列点。`,
      { maxTokens: 200, temperature: 0.6,
        systemPrompt: '你是一名耐心的合同辅导员，专门帮助第一次签合同的大学生和新手。语气友好、通俗、不说术语。' }
    );
    if (llmHint) hint = llmHint;

    // 4. 法条依据（knowledge-service 检索 + LLM 筛选）
    const kb = await loadKB();
    const contractType = contractForm.contractType || inferContractCategory(contractForm.contractName || '');
    const query = `${currentStep.label} ${contractType || '合同'} 法律规定 条款 要求`;
    const items = retrieveKnowledge(query, kb, 4, contractType);

    // 若检索结果少，尝试扩大查询
    let laws = items.filter(i => i.type === 'law').slice(0, 3);
    if (laws.length < 1) {
      const items2 = retrieveKnowledge(`${currentStep.label} 合同条款`, kb, 3);
      laws = items2.filter(i => i.type === 'law').slice(0, 3);
    }

    const legalBasis = laws.map(l => ({
      law: l.title,
      article: (l.title.match(/第[一二三四五六七八九十百千万\d]+条/) || [''])[0],
      content: l.content,
      source: l.source || ''
    }));

    // 5. 给用户的通俗法条摘要（LLM 生成，带书名号）
    let basisSummary = '';
    if (legalBasis.length) {
      basisSummary = legalBasis.map(b => {
        const lawTitle = b.law.replace(/\s+/g, '');
        const shortContent = String(b.content).slice(0, 80);
        return `《${lawTitle}》${b.article || ''}：${shortContent}${b.content.length > 80 ? '...' : ''}`;
      }).join('\n');
    }

    return res.status(200).json({
      err_code: 0,
      data: {
        currentStep: { ...currentStep, index: currentIdx + 1, total: FORM_STEPS.length },
        nextStep:    { ...nextStep,    index: nextIdx + 1 },
        hint,
        legalBasis,
        basisSummary,
        formProgress: FORM_STEPS.map(s => ({
          key: s.key,
          label: s.label,
          filled: !!(contractForm[s.key] && String(contractForm[s.key]).trim())
        })),
        contractType
      }
    });
  } catch (error) {
    console.error('[guidance] error:', error);
    return res.status(500).json({ err_code: 500, message: '指引服务暂不可用' });
  }
};

// ==================== 合同描述自动补全 ====================
// POST /api/contract_autocomplete
// body: { field, partialText, contractForm }
// field: 当前光标所在字段（如 "description"）
// partialText: 用户已输入的片段
const getAutocomplete = async (req, res) => {
  try {
    const { field, partialText = '', contractForm = {} } = req.body;

    if (!partialText || partialText.trim().length < 2) {
      return res.status(200).json({ err_code: 0, data: { suggestions: [] } });
    }

    let systemPrompt = '';
    let prompt = '';

    // 根据不同字段定制补全提示词
    const contractType = contractForm.contractType || inferContractCategory(contractForm.contractName || '');
    switch (field) {
      case 'description':
        systemPrompt = '你是一位合同起草助手，专门帮新手用户把一句话合同描述扩展成一段规范的合同核心内容。只输出补全的那一段，不要解释，不要 markdown。';
        prompt = `合同名称：${contractForm.contractName || '（未填）'}\n合同类型：${contractType || '（未选）'}\n甲方：${contractForm.partyA || '（未填）'}\n乙方：${contractForm.partyB || '（未填）'}\n\n用户已输入：${partialText}\n请续写一段完整的合同主要内容（合同标的、双方基本权利义务、履行期限、核心对价），控制在 80 字以内，语气专业，不要换行。`;
        break;
      case 'contractName':
        systemPrompt = '你是一位合同命名助手，给出规范、清晰的合同名称候选。只输出 JSON，格式 {"suggestions":["...","...","..."]}。';
        prompt = `用户已输入合同名称片段：${partialText}\n请根据片段推测可能的完整合同名称，返回 3 条候选，每条 10 字以内，都是中文合同名称。`;
        break;
      case 'partyA':
      case 'partyB':
        systemPrompt = '你是一位填单助手。只输出 JSON {"suggestions":["..."]}。';
        prompt = `用户在"${field === 'partyA' ? '甲方' : '乙方'}"字段输入了：${partialText}\n如果像是一个公司/机构名，给出补全建议（可查的标准名称或常用后缀）；如果像人名，返回空数组。只返回 JSON。`;
        break;
      default:
        systemPrompt = '你是一位填单助手。只输出 JSON {"suggestions":["...","...","..."]}。';
        prompt = `字段「${field}」已输入：${partialText}\n给出 3 条补全建议，每条不超过 30 字。只返回 JSON。`;
    }

    const raw = await callLLM(prompt, { maxTokens: 400, temperature: 0.5, systemPrompt });
    let suggestions = [];

    if (!raw) {
      return res.status(200).json({ err_code: 0, data: { suggestions: [] } });
    }

    // 剥掉 ```json ... ``` 或 ``` ... ``` 代码块壳
    let cleaned = raw.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/m, '').trim();

    if (cleaned.startsWith('{')) {
      // JSON 格式
      try {
        const obj = JSON.parse(cleaned);
        if (Array.isArray(obj.suggestions)) suggestions = obj.suggestions;
        else if (Array.isArray(obj.data))   suggestions = obj.data;
        else if (Array.isArray(obj))        suggestions = obj;
      } catch { /* fall through */ }
    }
    if (suggestions.length === 0) {
      // 普通文本 → 若有换行/分号则拆多条，否则取整段
      const lines = cleaned.split(/[\n;；]/).map(s => s.trim()).filter(Boolean);
      if (lines.length > 1) suggestions = lines.slice(0, 3);
      else suggestions = [cleaned.slice(0, 80)];
    }
    suggestions = suggestions.filter(s => s && String(s).trim()).slice(0, 3).map(s => String(s).replace(/^[-\d\.\)\s]+/, '').trim());

    return res.status(200).json({ err_code: 0, data: { suggestions } });
  } catch (error) {
    console.error('[autocomplete] error:', error);
    return res.status(500).json({ err_code: 500, data: { suggestions: [] } });
  }
};

// 通用 OpenAI 兼容大模型配置（DeepSeek / 智谱GLM / 硅基流动 / 本地Ollama 均可接入）
const LLM_BASE = process.env.LLM_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const LLM_KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';

// 查找可用的中文字体（优先 .ttf 格式，确保 PDF 中文正常显示）
function findChineseFont() {
  const candidates = [
    'C:/Windows/Fonts/simhei.ttf',     // 黑体（TTF，兼容性最好）
    'C:/Windows/Fonts/simsunb.ttf',    // 宋体（TTF）
    'C:/Windows/Fonts/simfang.ttf',    // 仿宋（TTF）
    'C:/Windows/Fonts/simkai.ttf',     // 楷体（TTF）
    'C:/Windows/Fonts/msyh.ttc',       // 微软雅黑（TTC，备选）
    'C:/Windows/Fonts/simsun.ttc',     // 宋体（TTC，备选）
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    '/System/Library/Fonts/PingFang.ttc',
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) return f;
  }
  return null;
}

// 合同起草API
const generateContract = async (req, res) => {
  try {
    const { contractName, partyA, partyB, thirdParty, description, subject, expiryDate } = req.body;
    
    // 验证必填字段
    if (!contractName || !partyA || !partyB || !description || !subject) {
      return res.status(400).json({
        err_code: 400,
        message: '请填写所有必填字段'
      });
    }

    // 构建提示词
    const prompt = `我需要生成一份合同，我想要生成的合同名称为${contractName}，甲方为${partyA}，乙方为${partyB}，第三方为${thirdParty || '无'}，合同描述为${description}，合同主体为${subject}。

请根据这些信息生成一份专业的参考合同，要求：
1. 合同内容每项要分行显示，分为大标题一、二、三等等
2. 第一个大标题要求为"协议双方"
3. 格式要求规范，包含完整的合同条款
4. 回答格式为纯文本，不需要markdown语法
5. 大标题不要带星号*
6. 包含以下基本条款：协议双方、合同标的、权利义务、履行期限、违约责任、争议解决、其他条款

请直接给出参考合同内容，中文回答。`;

    // 调用DeepSeek API生成合同
    let contractResponse;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        contractResponse = await axios.post(`${LLM_BASE}/chat/completions`, {
          model: LLM_MODEL,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          stream: false,
          max_tokens: 2000,
          temperature: 0.7
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LLM_KEY}`
          },
          timeout: 60000,
          httpsAgent: new (require('https').Agent)({
            keepAlive: true,
            timeout: 60000
          })
        });
        break; // 成功则跳出循环
      } catch (error) {
        retryCount++;
        console.error(`调用AI模型失败 (尝试 ${retryCount}/${maxRetries}):`, error.message);
        
        if (retryCount >= maxRetries) {
          return res.status(500).json({
            err_code: 500,
            message: '合同生成服务暂时不可用，请稍后重试'
          });
        }
        
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
      }
    }

    const contractContent = contractResponse.data.choices?.[0]?.message?.content || '合同生成失败';

    // 保存合同到数据库
    let contract;
    try {
      contract = await Contract.create({
        file_name: `${contractName}_起草合同.txt`,
        file_path: '', // 起草的合同没有实际文件路径，表限制NOT NULL，用空字符串占位
        file_size: contractContent.length,
        content: contractContent,
        user_id: req.user?.id || null,
        contract_type: 'draft', // 标记为起草类型
        expiry_date: expiryDate || null
      });
    } catch (dbError) {
      console.error('合同保存到数据库失败:', dbError);
    }

    return res.status(200).json({
      err_code: 0,
      message: '合同生成成功',
      data: {
        contractContent: contractContent,
        contractInfo: {
          contractName,
          partyA,
          partyB,
          thirdParty,
          description,
          subject,
          expiryDate: expiryDate || null,
          generateTime: new Date().toLocaleString('zh-CN'),
          contractId: contract?.id
        }
      }
    });
  } catch (error) {
    console.error('合同生成失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 导出DOCX格式合同
const exportContractDocx = async (req, res) => {
  try {
    const { contractContent, contractName } = req.body;
    
    if (!contractContent) {
      return res.status(400).json({
        err_code: 400,
        message: '合同内容不能为空'
      });
    }

    // 解析合同内容，按行分割
    const lines = contractContent.split('\n').filter(line => line.trim());
    
    // 创建Word文档
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // 文档标题
          new Paragraph({
            children: [
              new TextRun({
                text: contractName || '合同文档',
                bold: true,
                size: 32,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 400,
            },
          }),
          
          // 添加合同内容
          ...lines.map(line => {
            const trimmedLine = line.trim();
            
            // 判断是否为标题（包含"一、"、"二、"等）
            const isMajorTitle = /^[一二三四五六七八九十]+、/.test(trimmedLine);
            const isMinorTitle = /^\d+\./.test(trimmedLine);
            
            if (isMajorTitle) {
              return new Paragraph({
                children: [
                  new TextRun({
                    text: trimmedLine,
                    bold: true,
                    size: 24,
                  }),
                ],
                spacing: {
                  before: 300,
                  after: 200,
                },
              });
            } else if (isMinorTitle) {
              return new Paragraph({
                children: [
                  new TextRun({
                    text: trimmedLine,
                    bold: true,
                    size: 22,
                  }),
                ],
                spacing: {
                  before: 200,
                  after: 100,
                },
              });
            } else {
              return new Paragraph({
                children: [
                  new TextRun({
                    text: trimmedLine,
                    size: 20,
                  }),
                ],
                spacing: {
                  after: 100,
                },
              });
            }
          }),
          
          // 添加签署区域
          new Paragraph({
            children: [
              new TextRun({
                text: '',
              }),
            ],
            spacing: {
              before: 600,
            },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '甲方签字：_________________    日期：_________________',
                size: 20,
              }),
            ],
            spacing: {
              after: 200,
            },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: '乙方签字：_________________    日期：_________________',
                size: 20,
              }),
            ],
          }),
        ],
      }],
    });

    // 生成文档buffer
    const buffer = await Packer.toBuffer(doc);
    
    // 设置响应头
    const fileName = `${contractName || '合同文档'}_${new Date().toISOString().slice(0, 10)}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Length', buffer.length);
    
    // 发送文件
    res.send(buffer);
    
  } catch (error) {
    console.error('导出DOCX失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '导出失败，请稍后重试'
    });
  }
};

// 导出PDF格式合同
const exportContractPdf = async (req, res) => {
  let doc = null;
  try {
    const { contractContent, contractName } = req.body;

    if (!contractContent) {
      return res.status(400).json({
        err_code: 400,
        message: '合同内容不能为空'
      });
    }

    const fontPath = findChineseFont();
    if (!fontPath) {
      return res.status(500).json({
        err_code: 500,
        message: '服务器未找到可用的中文字体，无法生成 PDF'
      });
    }

    const lines = contractContent.split('\n').filter(line => line.trim());

    doc = new PDFDocument({ size: 'A4', margin: 60, bufferPages: true });

    // 注册中文字体（放在 pipe 之前，确保字体加载失败时还能返回 JSON 错误）
    try {
      doc.registerFont('chinese', fontPath);
    } catch (fontErr) {
      console.error('字体加载失败:', fontErr.message);
      return res.status(500).json({
        err_code: 500,
        message: '字体加载失败，无法生成 PDF'
      });
    }
    doc.font('chinese');

    // 设置响应头并建立管道
    const fileName = `${contractName || '合同文档'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    doc.pipe(res);

    // 文档标题
    doc.fontSize(18).text(contractName || '合同文档', { align: 'center' });
    doc.moveDown(1);

    // 合同内容
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const isMajorTitle = /^[一二三四五六七八九十]+、/.test(trimmed);
      const isMinorTitle = /^\d+\./.test(trimmed);

      if (isMajorTitle) {
        doc.moveDown(0.5);
        doc.fontSize(14).text(trimmed);
        doc.moveDown(0.3);
      } else if (isMinorTitle) {
        doc.fontSize(12).text(trimmed);
      } else {
        doc.fontSize(11).text(trimmed, { lineGap: 3 });
      }
    }

    // 签署区域
    doc.moveDown(2);
    doc.fontSize(11).text('甲方签字：_________________    日期：_________________');
    doc.moveDown(1);
    doc.fontSize(11).text('乙方签字：_________________    日期：_________________');

    doc.end();

  } catch (error) {
    console.error('导出PDF失败:', error);
    if (doc) {
      try { doc.end(); } catch (e) { /* ignore */ }
    }
    if (!res.headersSent) {
      return res.status(500).json({
        err_code: 500,
        message: '导出失败，请稍后重试'
      });
    }
  }
};

// 获取合同模板列表
const getContractTemplates = async (req, res) => {
  try {
    const templates = [
      {
        id: 1,
        name: '买卖合同模板',
        description: '适用于商品买卖交易',
        category: '买卖合同',
        fields: ['商品名称', '数量', '单价', '总价', '交付时间', '付款方式'],
        content: '本合同为买卖合同，卖方应向买方交付符合约定质量标准的商品，买方应按约定支付价款。主要条款包括：商品名称、规格型号、数量、单价、总价、交付地点与方式、付款方式、验收标准、违约责任及争议解决等。交付时间以双方约定为准，延迟交付或付款应承担违约金。'
      },
      {
        id: 2,
        name: '租赁合同模板',
        description: '适用于房屋、设备等租赁',
        category: '租赁合同',
        fields: ['租赁物', '租期', '租金', '押金', '使用条件', '维修责任'],
        content: '本合同为租赁合同，出租方将租赁物交付承租方使用，承租方支付租金。主要条款包括：租赁物描述、租赁期限、租金及支付方式、押金数额与退还条件、维修责任划分、使用限制、转租约定、提前解约条件、违约责任等。租赁期满，承租方应按时返还租赁物。'
      },
      {
        id: 3,
        name: '服务合同模板',
        description: '适用于各类服务提供',
        category: '服务合同',
        fields: ['服务内容', '服务期限', '服务费用', '服务标准', '验收标准'],
        content: '本合同为服务合同，服务方应按约定向委托方提供专业服务。主要条款包括：服务内容、服务期限、服务费用及支付节点、服务标准与质量要求、验收流程、知识产权归属、保密义务、违约责任、争议解决等。服务方应确保服务质量，委托方应按时支付服务费用。'
      },
      {
        id: 4,
        name: '劳动合同模板',
        description: '适用于雇佣关系建立',
        category: '劳动合同',
        fields: ['工作岗位', '工作地点', '工作时间', '薪资待遇', '社会保险'],
        content: '本合同为劳动合同，用人单位与劳动者建立劳动关系。主要条款包括：工作岗位、工作地点、工作时间与休息休假、劳动合同期限、试用期、薪资待遇、社会保险与福利待遇、劳动保护、劳动纪律、合同变更与解除、经济补偿、保密与竞业限制、争议解决等。双方应遵守劳动法律法规。'
      },
      {
        id: 5,
        name: '借款合同模板',
        description: '适用于资金借贷',
        category: '借款合同',
        fields: ['借款金额', '借款期限', '利率', '还款方式', '担保方式'],
        content: '本合同为借款合同，贷款人向借款人提供借款，借款人按期还本付息。主要条款包括：借款金额、借款用途、借款期限、利率及计息方式、还款方式与还款计划、担保方式（抵押/质押/保证）、提前还款、逾期罚息、违约责任、争议解决等。借款人应专款专用，按期足额还款。'
      }
    ];

    return res.status(200).json({
      err_code: 0,
      message: '获取成功',
      data: templates
    });
  } catch (error) {
    console.error('获取模板失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

module.exports = {
  generateContract,
  exportContractDocx,
  exportContractPdf,
  getContractTemplates,
  getGuidance,
  getAutocomplete
};