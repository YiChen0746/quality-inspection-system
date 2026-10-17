const express = require('express');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const{ Contract } = require('../models');

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
    const { contractName, partyA, partyB, thirdParty, description, subject } = req.body;
    
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
    // const contract = await Contract.create({
    //   file_name: `${contractName}_起草合同.txt`,
    //   file_path: null, // 起草的合同没有实际文件路径
    //   file_size: contractContent.length,
    //   content: contractContent,
    //   user_id: req.session?.user?.id || null,
    //   type: 'draft' // 标记为起草类型
    // });


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
          generateTime: new Date().toLocaleString('zh-CN'),
          // contractId: contract.id // 返回合同ID
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
        fields: ['商品名称', '数量', '单价', '总价', '交付时间', '付款方式']
      },
      {
        id: 2,
        name: '租赁合同模板',
        description: '适用于房屋、设备等租赁',
        category: '租赁合同',
        fields: ['租赁物', '租期', '租金', '押金', '使用条件', '维修责任']
      },
      {
        id: 3,
        name: '服务合同模板',
        description: '适用于各类服务提供',
        category: '服务合同',
        fields: ['服务内容', '服务期限', '服务费用', '服务标准', '验收标准']
      },
      {
        id: 4,
        name: '劳动合同模板',
        description: '适用于雇佣关系建立',
        category: '劳动合同',
        fields: ['工作岗位', '工作地点', '工作时间', '薪资待遇', '社会保险']
      },
      {
        id: 5,
        name: '借款合同模板',
        description: '适用于资金借贷',
        category: '借款合同',
        fields: ['借款金额', '借款期限', '利率', '还款方式', '担保方式']
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
  getContractTemplates
};