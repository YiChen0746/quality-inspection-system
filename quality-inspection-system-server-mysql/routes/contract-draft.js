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

// 复用的统一 LLM 调用工具（同步、最多 3 次重试带退避、失败返回 null）
// 超时 90s：全文修订要生成数千 token，免费模型（glm-4-flash）速度慢，30s 必超时
async function callLLM(prompt, { maxTokens = 600, temperature = 0.7, systemPrompt = '' } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
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
        timeout: 90000,
        httpsAgent: new https.Agent({ keepAlive: true, timeout: 90000 })
      });
      const c = resp.data?.choices?.[0]?.message?.content;
      if (c && String(c).trim()) return String(c).trim();
      return null;
    } catch (err) {
      const status = err?.response?.status;
      console.error(`[contract-llm] call failed (attempt ${attempt + 1}):`, status || '', err.message);
      // 429 限流 / 5xx 服务端错误 / 网络超时 → 等待后退避重试
      if (attempt < 2 && (status === 429 || (status >= 500 && status < 600) || !status)) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      // 4xx 其他错误（欠费/未订购等）不重试，直接失败
      return null;
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

// ==================== 二轮补充修改（风险评估后 AI 修订） ====================
// POST /api/contract_revise
// body: { mode: 'direct'|'guide', contractText, suggestions: [], risks: [] }
// direct: 智能体直接改全文，返回 { revisedText, changeSummary }
// guide:  AI 辅助逐条修改，返回 { items: [{ original, revised, explain }] }
const reviseContract = async (req, res) => {
  try {
    const { mode = 'direct', contractText = '', suggestions = [], risks = [] } = req.body;

    if (!contractText || !contractText.trim()) {
      return res.status(400).json({ err_code: 400, message: '合同内容不能为空' });
    }
    if (!suggestions.length && !risks.length) {
      return res.status(400).json({ err_code: 400, message: '没有可用的修改建议' });
    }

    const clipText = String(contractText).slice(0, 6000);
    const suggestionList = suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const riskList = risks.map((r, i) => `${i + 1}. ${r}`).join('\n');

    if (mode === 'guide') {
      // AI 辅助模式：逐条给出 原文 → 改后 → 理由
      const systemPrompt = '你是一名合同修订助手。针对每条修改建议，从合同原文中定位需要修改的句子，给出修改后的句子和修改理由。只输出 JSON，不要 markdown 代码块。';
      const prompt = `合同原文：
${clipText}

风险评估发现的问题：
${riskList || '（无）'}

修改建议：
${suggestionList}

请针对每条建议输出 JSON：{"items":[{"original":"合同原文中需要修改的原句（必须在原文中逐字存在，20-100字）","revised":"修改后的句子","explain":"一句话说明改了什么、为什么改"}]}
如果某条建议在原文中找不到对应句子（属于缺失条款），original 留空字符串，revised 写应补充的完整条款句子，explain 说明"补充新增"。`;

      const raw = await callLLM(prompt, { maxTokens: 2500, temperature: 0.3, systemPrompt });
      if (!raw) {
        return res.status(504).json({ err_code: 504, message: 'AI 服务繁忙或响应超时，请稍后重试（逐条分析约需 20-40 秒）' });
      }
      // 剥壳解析
      let cleaned = raw.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/m, '').trim();
      let items = [];
      const pushItem = (o) => {
        if (o && (o.original !== undefined || o.revised !== undefined) && (String(o.original || '') || String(o.revised || ''))) {
          items.push({
            original: String(o.original || ''),
            revised: String(o.revised || ''),
            explain: String(o.explain || '').slice(0, 200)
          });
        }
      };
      try {
        const obj = JSON.parse(cleaned);
        if (Array.isArray(obj.items)) obj.items.forEach(pushItem);
        else if (Array.isArray(obj)) {
          // 兼容模型输出 [{ items: [...] }] 外层数组包裹的情况
          obj.forEach(el => {
            if (el && Array.isArray(el.items)) el.items.forEach(pushItem);
            else pushItem(el);
          });
        }
      } catch (e) {
        // JSON 可能被截断：逐个提取平衡的 {...} 对象再解析
        const extractJsonObjects = (text) => {
          const objs = [];
          let depth = 0, start = -1, inStr = false, esc = false;
          for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inStr) {
              if (esc) esc = false;
              else if (ch === '\\') esc = true;
              else if (ch === '"') inStr = false;
              continue;
            }
            if (ch === '"') { inStr = true; continue; }
            if (ch === '{') { if (depth === 0) start = i; depth++; }
            else if (ch === '}') { depth--; if (depth === 0 && start !== -1) { objs.push(text.slice(start, i + 1)); start = -1; } }
          }
          return objs;
        };
        extractJsonObjects(cleaned).forEach(seg => {
          try { pushItem(JSON.parse(seg)); } catch (e2) { /* 跳过坏块 */ }
        });
      }
      items = items.slice(0, 8);
      return res.status(200).json({ err_code: 0, data: { mode: 'guide', items } });
    }

    // direct 模式：智能体直接改全文
    const systemPrompt = '你是一名专业的合同修订智能体。你要根据风险评估建议直接修订合同全文：保持原有结构和条款编号不变，只修改需要修改的条款，缺失的条款在合适位置补充。语言规范、严谨。';
    const prompt = `合同原文：
${clipText}

风险评估发现的问题：
${riskList || '（无）'}

修改建议：
${suggestionList}

请输出修订后的合同全文（不要 markdown，不要解释）。输出完毕后，另起一行输出分隔符 ===CHANGES=== ，再换行用 3-5 条简短中文说明你改了哪些地方，每条一行，格式如"1. 补充了房屋维修责任条款"。`;

    const raw = await callLLM(prompt, { maxTokens: 4000, temperature: 0.3, systemPrompt });
    if (!raw) {
      return res.status(504).json({ err_code: 504, message: 'AI 服务繁忙或响应超时，请稍后重试（全文修订约需 30-60 秒，请耐心等待）' });
    }

    const sepIdx = raw.indexOf('===CHANGES===');
    let revisedText = raw;
    let changeSummary = '';
    if (sepIdx !== -1) {
      revisedText = raw.slice(0, sepIdx).trim();
      changeSummary = raw.slice(sepIdx + '===CHANGES==='.length).trim();
    }
    revisedText = revisedText.replace(/^```[a-z]*\s*/im, '').replace(/```\s*$/m, '').trim();

    return res.status(200).json({
      err_code: 0,
      data: { mode: 'direct', revisedText, changeSummary }
    });
  } catch (error) {
    console.error('[contract-revise] error:', error);
    return res.status(500).json({ err_code: 500, message: '服务器错误，请稍后重试' });
  }
};

// ==================== 合同专家智能体（Phase 2） ====================
// 8 类合同专家 persona：每类专家只精通自己的合同领域，深知新手小白易踩的坑
const EXPERT_PERSONAS = {
  '买卖合同': { icon: '🛒', focus: '标的物质量标准、交付验收、所有权转移、瑕疵担保、违约金' },
  '租赁合同': { icon: '🏠', focus: '房屋交付状态、维修责任划分、押金退还条件、转租限制、提前解约' },
  '劳务合同': { icon: '👷', focus: '工作内容边界、劳务报酬结算、人身安全责任、保险购置、工伤处理' },
  '服务合同': { icon: '🛠️', focus: '服务标准与验收、付款节点、知识产权归属、保密义务、售后责任' },
  '借款合同': { icon: '💰', focus: '借款利率合规（LPR上限）、还款方式、逾期责任、担保措施、资金用途' },
  '委托合同': { icon: '📋', focus: '委托权限范围、费用承担、报告义务、转委托限制、解除条件' },
  '仓储合同': { icon: '📦', focus: '货物验收标准、仓储条件、损耗责任、出入库流程、仓储费结算' },
  '建设工程合同': { icon: '🏗️', focus: '工程质量标准、工期延误责任、进度款支付、验收流程、质保金' }
};

// POST /api/contract_expert_generate
// body: { contractType?, description, contractForm? }
// 用户口述一大段需求，对应类型专家生成结构完整、保护新手权益的合同初稿
const expertGenerate = async (req, res) => {
  try {
    const { contractType = '', description = '', contractForm = {} } = req.body;

    if (!description || String(description).trim().length < 10) {
      return res.status(400).json({ err_code: 400, message: '请用至少一句话描述你的需求（如：我想把朝阳区一套两居室租给一个上班族，月租3500，押一付三）' });
    }

    // 未选类型时由 LLM 推断合同类型
    let type = contractType;
    if (!EXPERT_PERSONAS[type]) {
      const typeList = Object.keys(EXPERT_PERSONAS).join('、');
      const inferred = await callLLM(
        `用户需求描述：${String(description).slice(0, 500)}\n\n请从以下合同类型中选出最匹配的一个，只输出类型名称本身（不要解释、不要标点）：${typeList}`,
        { maxTokens: 20, temperature: 0.1 }
      );
      type = EXPERT_PERSONAS[inferred?.trim()] ? inferred.trim() : '服务合同';
    }

    const persona = EXPERT_PERSONAS[type];
    const partyA = contractForm.partyA || '';
    const partyB = contractForm.partyB || '';

    const systemPrompt =
      `你是【${type}起草专家】，一位从业 20 年的资深法务，最擅长帮第一次签合同的新手把关。` +
      `你起草${type}时会重点保护用户权益，确保以下方面不缺失：${persona.focus}。` +
      `输出要求：1) 输出完整合同全文（含标题、双方信息、编号条款、落款）；2) 结构规范，条款编号清晰；` +
      `3) 关键商务数字（金额、日期、比例）若用户未提供，用【请填写：xxx】占位；` +
      `4) 语言严谨但不晦涩，新手能看懂；5) 只输出合同全文，不要解释、不要 markdown 代码块。`;

    const prompt =
      `用户需求描述（可能口语化、不完整，你要合理补全常规约定，显式占位缺失的关键信息）：\n${String(description).slice(0, 2000)}\n\n` +
      (partyA ? `甲方：${partyA}\n` : '') +
      (partyB ? `乙方：${partyB}\n` : '') +
      `请以${type}专家身份起草这份合同。`;

    const raw = await callLLM(prompt, { maxTokens: 4000, temperature: 0.4, systemPrompt });
    if (!raw) {
      return res.status(504).json({ err_code: 504, message: 'AI 服务繁忙或响应超时，请稍后重试（专家起草约需 30-60 秒）' });
    }

    const contractText = raw.replace(/^```[a-z]*\s*/im, '').replace(/```\s*$/m, '').trim();

    return res.status(200).json({
      err_code: 0,
      data: { contractText, contractType: type, expertIcon: persona.icon }
    });
  } catch (error) {
    console.error('[expert-generate] error:', error);
    return res.status(500).json({ err_code: 500, message: '服务器错误，请稍后重试' });
  }
};

module.exports = {
  generateContract,
  exportContractDocx,
  exportContractPdf,
  getContractTemplates,
  getGuidance,
  getAutocomplete,
  reviseContract,
  expertGenerate
};