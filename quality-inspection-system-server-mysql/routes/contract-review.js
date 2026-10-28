const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios').default;
const mammoth = require('mammoth');
const { Contract, QualityResult } = require('../models');
const { Op } = require('sequelize'); // 导入Op用于构建查询条件

const router = express.Router();

// 大模型配置：优先读通用 LLM_* 变量，兼容旧的 DEEPSEEK_* 变量（DeepSeek / 智谱GLM / 硅基流动 / 本地Ollama 均可接入）
const DEEPSEEK_CONFIG = {
  baseURL: process.env.LLM_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '',
  model: process.env.LLM_MODEL || 'deepseek-chat'
};

// 讯飞OCR配置：仅从环境变量读取（密钥不得写入代码）
const OCR_CONFIG = {
  APPId: process.env.OCR_APP_ID || '',
  APISecret: process.env.OCR_API_SECRET || '',
  APIKey: process.env.OCR_API_KEY || '',
  host: process.env.OCR_HOST || 'api.xf-yun.com',
  urlPath: process.env.OCR_URL_PATH || '/v1/private/sf8e6aca1'
};

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads/contracts');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      // 带上业务状态码，让全局错误处理返回 400 而不是 500
      const err = new Error('只支持 JPG/PNG 图片与 DOCX 文档（PDF/DOC 暂不支持）');
      err.status = 400;
      cb(err);
    }
  }
});

// OCR处理函数（讯飞）
async function processOCR(imagePath) {
  try {
    // 生成时间戳
    const date = new Date().toUTCString();

    // 生成签名
    let signature = `host: ${OCR_CONFIG.host}\ndate: ${date}\nPOST ${OCR_CONFIG.urlPath} HTTP/1.1`;
    signature = crypto.createHmac('sha256', OCR_CONFIG.APISecret).update(signature).digest('base64');

    // 生成authorization
    let authorization = `api_key="${OCR_CONFIG.APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    authorization = Buffer.from(authorization).toString('base64');

    // 读取图片并转换为base64
    const image = fs.readFileSync(imagePath, 'base64');

    // 构建请求数据
    const submitData = {
      header: { app_id: OCR_CONFIG.APPId, status: 3 },
      parameter: {
        sf8e6aca1: {
          category: 'ch_en_public_cloud',
          result: {
            encoding: 'utf8',
            compress: 'raw',
            format: 'json'
          }
        }
      },
      payload: {
        sf8e6aca1_data_1: {
          encoding: 'jpg',
          status: 3,
          image: image
        }
      }
    };

    // 发送OCR请求
    const result = await axios({
      url: `https://${OCR_CONFIG.host}${OCR_CONFIG.urlPath}?authorization=${authorization}&host=${OCR_CONFIG.host}&date=${date}`,
      method: 'post',
      data: JSON.stringify(submitData),
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    if (result.data.header.message !== 'success') {
      throw new Error('OCR处理失败: ' + result.data.header.message);
    }

    // 解析OCR结果
    let text = Buffer.from(result.data.payload.result.text, 'base64').toString('utf-8');
    text = JSON.parse(text);

    if (!text.pages || !text.pages[0] || !text.pages[0].lines) {
      throw new Error('OCR结果格式错误');
    }

    const textList = [];
    text.pages[0].lines.forEach(val => {
      if (val.words && val.words[0]) {
        textList.push(val.words[0].content);
      }
    });

    return textList.join('\n');
  } catch (error) {
    console.error('OCR处理错误:', error);
    throw new Error('OCR处理失败: ' + error.message);
  }
}

// 图片文字识别统一入口：优先讯飞 OCR（已配置密钥时），否则回退到视觉大模型（如智谱 glm-4v-flash）
async function extractImageText(imagePath) {
  if (OCR_CONFIG.APPId && OCR_CONFIG.APISecret && OCR_CONFIG.APIKey) {
    return processOCR(imagePath);
  }
  return extractImageTextByVision(imagePath);
}

// 视觉大模型 OCR 回退：用与主模型同平台的视觉模型提取合同照片文字
async function extractImageTextByVision(imagePath) {
  const image = fs.readFileSync(imagePath, 'base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  const visionModel = process.env.LLM_VISION_MODEL || 'glm-4v-flash';

  const response = await axios.post(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
    model: visionModel,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mime};base64,${image}` } },
        { type: 'text', text: '这是一份合同的照片或扫描件。请完整、逐字提取图片中的全部文字，保持原有段落顺序与结构，只输出识别到的文字本身，不要添加任何解释、评论或 Markdown 格式。' }
      ]
    }],
    temperature: 0.1,
    // glm-4v-flash 的 max_tokens 上限为 1024，超出会直接报 400
    max_tokens: parseInt(process.env.LLM_VISION_MAX_TOKENS || '1024', 10)
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`
    },
    timeout: 120000
  });

  const text = response.data?.choices?.[0]?.message?.content || '';
  if (!text.trim()) {
    throw new Error('视觉模型未返回文字内容（可在 .env 配置 OCR_APP_ID/OCR_API_SECRET/OCR_API_KEY 改用讯飞OCR）');
  }
  return text.trim();
}

// DeepSeek分析函数
async function analyzeContract(contractContent, analysisPosition = '中立') {
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`=== AI分析尝试 ${attempt}/${maxRetries} ===`);
      
      const messages = [
        {
          role: 'system',
          content: '你是一个专业的法务助手，专门帮助用户分析合同内容。请严格按照以下格式提供分析结果，确保每个部分都有明确的分隔和内容。'
        },
        {
          role: 'user',
          content: `请分析以下合同内容，站在${analysisPosition}的立场，严格按照以下格式提供详细信息：

合同内容：
${contractContent}

请严格按照以下格式分析，每个部分都要有明确的内容：

1. 合同名称
[一句话概括]

2. 合同类型
[一句话概括]

3. 生效日期
[一句话概括]

4. 终止日期
[一句话概括]

5. 管辖权
[一句话概括]

6. 涉及主体
[一句话概括]

7. 合同摘要
[请详细分析合同摘要，如果无法识别请说明原因]

8. 风险条款解读
[请详细分析风险条款，如果无法识别请说明原因]

9. 核心条款解读
[请详细分析核心条款，如果无法识别请说明原因]

请确保每个部分都有明确的分析内容，不要遗漏任何部分。`
        }
      ];

      const requestBody = {
        model: DEEPSEEK_CONFIG.model,
        messages: messages,
        temperature: 0.3, // 降低随机性，提高一致性
        max_tokens: 4000
      };

      // 只记录模型与地址，不打印任何密钥片段
      console.log('[llm] model=' + DEEPSEEK_CONFIG.model + ', base=' + DEEPSEEK_CONFIG.baseURL);

      const response = await axios.post(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`
        },
        timeout: 120000, // 增加到2分钟
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 300; // 只接受2xx状态码
        }
      });

      console.log('AI分析响应状态:', response.status);
      console.log('AI分析响应头:', response.headers);

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const content = response.data.choices[0].message.content.trim();
        console.log(`AI分析成功，返回内容长度: ${content.length}`);
        return content;
      } else {
        throw new Error('AI分析返回空结果或格式错误');
      }

    } catch (error) {
      lastError = error;
      console.error(`AI分析尝试 ${attempt} 失败:`, error.message);
      
      if (error.code === 'ECONNABORTED' || error.message.includes('aborted')) {
        console.log('请求被中断，可能是超时或网络问题');
        if (attempt < maxRetries) {
          console.log(`等待 ${attempt * 2} 秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
      }
      
      if (error.response) {
        console.error('API响应错误:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
        
        if (error.response.status === 401) {
          throw new Error('DeepSeek API密钥无效或已过期');
        } else if (error.response.status === 429) {
          throw new Error('DeepSeek API请求频率过高，请稍后重试');
        } else if (error.response.status >= 500) {
          if (attempt < maxRetries) {
            console.log(`服务器错误，等待 ${attempt * 3} 秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 3000));
            continue;
          }
        }
      }
      
      if (attempt === maxRetries) {
        break;
      }
      
      // 其他错误，等待后重试
      console.log(`等待 ${attempt * 2} 秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
  
  // 所有重试都失败了
  const errorMessage = lastError?.message || '未知错误';
  console.error(`AI分析在 ${maxRetries} 次尝试后仍然失败:`, errorMessage);
  
  if (errorMessage.includes('aborted') || errorMessage.includes('timeout')) {
    throw new Error('AI分析请求超时或被中断，请检查网络连接或稍后重试');
  } else if (errorMessage.includes('API密钥')) {
    throw new Error('DeepSeek API配置错误，请联系管理员');
  } else {
    throw new Error(`AI分析失败: ${errorMessage}`);
  }
}

// 合同审查主接口
router.post('/review', upload.single('contract_file'), async (req, res) => {
  try {
    const { analysis_position = '中立' } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        err_code: 400,
        message: '请上传合同文件',
        step: 'upload'
      });
    }

    // 步骤1: 文件上传成功
    res.write(JSON.stringify({
      err_code: 0,
      step: 'upload_success',
      message: '文件上传成功，开始OCR处理...'
    }) + '\n');

    let contractContent = '';
    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();

    // 步骤2: OCR处理
    try {
      if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
        res.write(JSON.stringify({
          err_code: 0,
          step: 'ocr_processing',
          message: '正在进行OCR文字识别...'
        }) + '\n');
        
        contractContent = await extractImageText(filePath);
        
        // 只记录类型与长度：合同全文可能含身份证号、银行账号等敏感信息，不写入日志
        console.log('[ocr] type=' + fileExtension + ', chars=' + contractContent.length);
        if (process.env.DEBUG_CONTRACT === '1') {
          console.log('[ocr][debug] preview:', contractContent.slice(0, 80));
        }
        
      } else if (fileExtension === '.docx') {
        res.write(JSON.stringify({
          err_code: 0,
          step: 'ocr_processing',
          message: '正在提取DOCX文档内容...'
        }) + '\n');
        
        // 直接从DOCX提取文本内容
        contractContent = await extractDocxText(filePath);
        
        // 只记录类型与长度，不打印文档全文
        console.log('[docx] type=' + fileExtension + ', chars=' + contractContent.length);
        if (process.env.DEBUG_CONTRACT === '1') {
          console.log('[docx][debug] preview:', contractContent.slice(0, 80));
        }
        
      } else if (['.pdf', '.doc'].includes(fileExtension)) {
        // PDF/DOC 暂不做真解析：直接报错并清理临时文件，
        // 避免把“不支持”的提示语当成合同正文继续送 AI 分析、并把无效结果写入数据库。
        fs.unlink(filePath, () => {});
        res.write(JSON.stringify({
          err_code: 400,
          step: 'ocr_error',
          message: '暂不支持 PDF/DOC，请改用 DOCX 或 JPG/PNG 图片上传'
        }) + '\n');
        return res.end();
      } else {
        throw new Error('不支持的文件格式');
      }

      res.write(JSON.stringify({
        err_code: 0,
        step: 'ocr_success',
        message: `OCR处理完成，识别到${contractContent.length}个字符，开始AI分析...`
      }) + '\n');
    } catch (error) {
      res.write(JSON.stringify({
        err_code: 500,
        step: 'ocr_error',
        message: 'OCR处理失败: ' + error.message
      }) + '\n');
      return res.end();
    }

    // 步骤3: AI分析
    try {
      res.write(JSON.stringify({
        err_code: 0,
        step: 'ai_analyzing',
        message: '正在进行AI合同分析...'
      }) + '\n');

      // 只记录立场与长度，不打印合同内容
      console.log('[ai-input] position=' + analysis_position + ', chars=' + contractContent.length);
      
      const analysisResult = await analyzeContract(contractContent, analysis_position);
      
      // 只记录结果长度，不打印模型原始输出
      console.log('[ai-result] chars=' + analysisResult.length);

      // 保存合同到数据库
      const contract = await Contract.create({
        file_name: req.file.originalname,
        file_path: filePath,
        file_size: req.file.size,
        content: contractContent,
        user_id: req.user?.id || null,
        contract_type: 'review'
      });

      // 解析分析结果并保存（模型原始输出不落日志）
      
      const contractName = extractContent(analysisResult, '1. 合同名称', '2. 合同类型');
      const contractType = extractContent(analysisResult, '2. 合同类型', '3. 生效日期');
      const effectiveDate = extractContent(analysisResult, '3. 生效日期', '4. 终止日期');
      const terminationDate = extractContent(analysisResult, '4. 终止日期', '5. 管辖权');
      const jurisdiction = extractContent(analysisResult, '5. 管辖权', '6. 涉及主体');
      const partiesInvolved = extractContent(analysisResult, '6. 涉及主体', '7. 合同摘要');
      const contractSummary = extractContent(analysisResult, '7. 合同摘要', '8. 风险条款解读');
      const riskClauses = extractContent(analysisResult, '8. 风险条款解读', '9. 核心条款解读');
      const coreClauses = extractContent(analysisResult, '9. 核心条款解读', null);

      // 字段解析情况只记录“是否解析成功”，不打印具体内容
      console.log('[ai-parse] fields=' + [
        contractName, contractType, effectiveDate, terminationDate,
        jurisdiction, partiesInvolved, contractSummary, riskClauses, coreClauses
      ].filter((v) => v && String(v).trim()).length + '/9');

      const qualityResult = await QualityResult.create({
        contract_id: contract.id,
        hospital: '合同审查系统',
        analysis_position: analysis_position,
        contract_name: contractName,
        contract_type: contractType,
        effective_date: effectiveDate,
        termination_date: terminationDate,
        jurisdiction: jurisdiction,
        parties_involved: partiesInvolved,
        contract_summary: contractSummary,
        risk_clauses: riskClauses,
        core_clauses: coreClauses,
        user_id: req.user?.id || null
      });

      // 步骤4: 分析完成
      res.write(JSON.stringify({
        err_code: 0,
        step: 'analysis_complete',
        message: '合同分析完成',
        data: {
          contract_id: contract.id,
          result_id: qualityResult.id,
          contract_name: contractName,
          contract_type: contractType,
          effective_date: effectiveDate,
          termination_date: terminationDate,
          jurisdiction: jurisdiction,
          parties_involved: partiesInvolved,
          contract_summary: contractSummary,
          risk_clauses: riskClauses,
          core_clauses: coreClauses,
          analysis_position: analysis_position,
          // 回传识别出的正文，供“转深度审查”直接带入多智能体页面
          contract_content: contractContent
        }
      }) + '\n');

    } catch (error) {
      console.error('合同审查分析或结果保存失败:', error);
      res.write(JSON.stringify({
        err_code: 500,
        step: 'ai_error',
        message: 'AI分析失败: ' + error.message
      }) + '\n');
    }

    res.end();

  } catch (error) {
    console.error('合同审查错误:', error);
    res.status(500).json({
      err_code: 500,
      step: 'system_error',
      message: '系统错误: ' + error.message
    });
  }
});

// 批量导入/图片识别：提取单个文件（docx/txt/jpg/png）的文字内容，不做分析、不入库
// 独立的 multer 实例：额外放行 .txt 纯文本
const uploadExtract = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|docx|txt/;
    const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extOk) {
      return cb(null, true);
    }
    const err = new Error('文字提取暂支持 DOCX、TXT、JPG、PNG 格式');
    err.status = 400;
    cb(err);
  }
});

router.post('/extract-text', uploadExtract.single('file'), async (req, res) => {
  const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  try {
    if (!req.file) {
      return res.status(400).json({ err_code: 400, message: '请上传文件' });
    }
    const ext = path.extname(req.file.originalname).toLowerCase();
    let content = '';
    if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      content = await extractImageText(req.file.path);
    } else if (ext === '.docx') {
      content = await extractDocxText(req.file.path);
    } else if (ext === '.txt') {
      content = fs.readFileSync(req.file.path, 'utf-8');
    } else {
      cleanup();
      return res.status(400).json({ err_code: 400, message: '文字提取暂支持 DOCX、TXT、JPG、PNG 格式' });
    }
    cleanup();
    if (!content || content.trim().length < 10) {
      return res.status(422).json({ err_code: 422, message: '未能从文件中识别出有效文字，请检查文件内容' });
    }
    res.json({
      err_code: 0,
      message: 'ok',
      data: { fileName: req.file.originalname, content: content.trim() }
    });
  } catch (error) {
    console.error('文字提取失败:', error);
    cleanup();
    res.status(500).json({ err_code: 500, message: '文字提取失败: ' + error.message });
  }
});

// 测试AI服务连接
router.get('/test_connection', async (req, res) => {
  try {
    console.log('开始测试AI服务连接...');
    
    // 发送一个简单的测试请求到DeepSeek API
    const testResponse = await axios.post(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
      model: DEEPSEEK_CONFIG.model,
      messages: [
        {
          role: 'user',
          content: '你好，这是一个连接测试。'
        }
      ],
      max_tokens: 10
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`
      },
      timeout: 10000 // 10秒超时
    });

    if (testResponse.data && testResponse.data.choices) {
      console.log('AI服务连接测试成功');
      res.json({
        err_code: 0,
        message: 'AI服务连接正常',
        data: {
          status: 'connected',
          response_time: Date.now(),
          model: DEEPSEEK_CONFIG.model
        }
      });
    } else {
      throw new Error('AI服务响应格式异常');
    }

  } catch (error) {
    console.error('AI服务连接测试失败:', error.message);
    
    let errorMessage = 'AI服务连接失败';
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'AI服务连接超时，请检查网络';
    } else if (error.response) {
      if (error.response.status === 401) {
        errorMessage = 'AI服务认证失败，请检查API密钥';
      } else if (error.response.status === 429) {
        errorMessage = 'AI服务请求频率过高，请稍后重试';
      } else if (error.response.status >= 500) {
        errorMessage = 'AI服务暂时不可用，请稍后重试';
      } else {
        errorMessage = `AI服务错误: ${error.response.status}`;
      }
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = '无法连接到AI服务，请检查网络';
    }
    
    res.status(500).json({
      err_code: 500,
      message: errorMessage,
      data: {
        status: 'disconnected',
        error: error.message,
        timestamp: Date.now()
      }
    });
  }
});

// 获取审查结果详情
router.get('/result/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await QualityResult.findOne({
      where: { id, user_id: req.user?.id || null },
      include: [
        {
          model: Contract,
          attributes: ['file_name', 'content']
        }
      ]
    });

    if (!result) {
      return res.status(404).json({
        err_code: 404,
        message: '审查结果不存在'
      });
    }

    res.json({
      err_code: 0,
      message: '获取成功',
      data: {
        id: result.id,
        contract_id: result.contract_id,
        contract_name: result.contract_name,
        contract_type: result.contract_type,
        effective_date: result.effective_date,
        termination_date: result.termination_date,
        jurisdiction: result.jurisdiction,
        parties_involved: result.parties_involved,
        contract_summary: result.contract_summary,
        risk_clauses: result.risk_clauses,
        core_clauses: result.core_clauses,
        analysis_position: result.analysis_position,
        created_at: result.createdAt,
        file_name: result.Contract?.file_name
      }
    });

  } catch (error) {
    console.error('获取审查结果错误:', error);
    res.status(500).json({
      err_code: 500,
      message: '服务器错误'
    });
  }
});

// DOCX文本提取函数
async function extractDocxText(docxPath) {
  try {
    console.log('开始提取DOCX文件文本:', docxPath);
    
    // 使用mammoth直接提取文本内容
    const result = await mammoth.extractRawText({ path: docxPath });
    const textContent = result.value;
    
    console.log('DOCX文本提取成功，文本长度:', textContent.length);
    
    if (!textContent || textContent.trim().length === 0) {
      throw new Error('DOCX文件中没有找到文本内容');
    }
    
    // 清理和格式化文本
    const cleanedText = textContent
      .replace(/\r\n/g, '\n')  // 统一换行符
      .replace(/\n{3,}/g, '\n\n')  // 合并多余的空行
      .trim();
    
    return cleanedText;
    
  } catch (error) {
    console.error('DOCX文本提取失败:', error);
    throw new Error('文档文本提取失败: ' + error.message);
  }
}

// 辅助函数：从文本中提取指定部分的内容
function extractContent(text, startMarker, endMarker) {
  if (!text || typeof text !== 'string') {
    return '合同中未说明';
  }
  
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) {
    // 尝试模糊匹配，查找包含关键词的行
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes(startMarker.replace(/^\d+\.\s*/, ''))) {
        // 找到包含关键词的行，提取后续内容直到下一个数字标记
        let content = '';
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine.match(/^\d+\.\s*/) && j > i + 1) {
            break; // 遇到下一个数字标记，停止提取
          }
          if (nextLine) {
            content += nextLine + '\n';
          }
        }
        return content.trim() || '合同中未说明';
      }
    }
    return '合同中未说明';
  }
  
  const startContentIndex = startIndex + startMarker.length;
  
  let endIndex;
  if (endMarker) {
    endIndex = text.indexOf(endMarker, startContentIndex);
    if (endIndex === -1) {
      // 如果找不到结束标记，尝试查找下一个数字标记
      const remainingText = text.substring(startContentIndex);
      const nextNumberMatch = remainingText.match(/\n\s*\d+\.\s/);
      if (nextNumberMatch) {
        endIndex = startContentIndex + nextNumberMatch.index;
      } else {
        endIndex = text.length;
      }
    }
  } else {
    // 如果没有结束标记，查找下一个数字标记或到文本末尾
    const remainingText = text.substring(startContentIndex);
    const nextNumberMatch = remainingText.match(/\n\s*\d+\.\s/);
    if (nextNumberMatch) {
      endIndex = startContentIndex + nextNumberMatch.index;
    } else {
      endIndex = text.length;
    }
  }
  
  const extractedContent = text.substring(startContentIndex, endIndex).trim();
  
  // 如果提取的内容为空或只包含换行符，尝试更智能的提取
  if (!extractedContent || extractedContent === '\n') {
    // 尝试从当前行开始提取到下一个空行或数字标记
    const currentLineStart = text.lastIndexOf('\n', startIndex);
    const nextEmptyLine = text.indexOf('\n\n', startContentIndex);
    const nextNumberMark = text.search(/\n\s*\d+\.\s/, startContentIndex);
    
    let smartEndIndex = text.length;
    if (nextEmptyLine !== -1 && nextEmptyLine < smartEndIndex) {
      smartEndIndex = nextEmptyLine;
    }
    if (nextNumberMark !== -1 && nextNumberMark < smartEndIndex) {
      smartEndIndex = nextNumberMark;
    }
    
    const smartContent = text.substring(startContentIndex, smartEndIndex).trim();
    if (smartContent && smartContent !== '\n') {
      return smartContent;
    }
  }
  
  return extractedContent || '合同中未说明';
}

// 获取合同审查历史记录
router.get('/history', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      include_miniapp = '0' 
    } = req.query;

    // 构建查询条件
    const whereClause = {};
    // 只返回当前账号自己的审查记录
    if (req.user?.id) {
      whereClause.user_id = req.user.id;
    }
    const includeClause = [
      {
        model: Contract,
        attributes: ['file_name', 'created_at']
      }
    ];

    // 搜索条件
    if (search) {
      whereClause[Op.or] = [
        { contract_name: { [Op.like]: `%${search}%` } },
        { contract_type: { [Op.like]: `%${search}%` } },
        { analysis_position: { [Op.like]: `%${search}%` } }
      ];
    }

    // 分页参数
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // 查询数据
    const { count, rows } = await QualityResult.findAndCountAll({
      where: whereClause,
      include: includeClause,
      order: [['created_at', 'DESC']],
      offset: offset,
      limit: limitNum
    });

    // 处理数据，添加来源标识
    const list = rows.map(item => ({
      id: item.id,
      contract_id: item.contract_id,
      contract_name: item.contract_name || '未识别',
      contract_type: item.contract_type || '未识别',
      analysis_position: item.analysis_position || '中立',
      risk_level: item.risk_clauses && item.risk_clauses.length > 0 ? '有风险' : '无风险',
      created_at: item.created_at,
      source: 'web', // 网页来源
      file_name: item.Contract?.file_name || '未知文件'
    }));

    // 如果需要包含小程序数据，这里可以添加小程序数据的查询逻辑
    // 目前先返回网页数据
    if (include_miniapp === '1') {
      // TODO: 添加小程序数据查询逻辑
      console.log('包含小程序数据查询功能待实现');
    }

    res.json({
      err_code: 0,
      message: '获取成功',
      data: {
        list: list,
        total: count,
        page: parseInt(page),
        limit: limitNum,
        total_pages: Math.ceil(count / limitNum)
      }
    });

  } catch (error) {
    console.error('获取历史记录失败:', error);
    res.status(500).json({
      err_code: 500,
      message: '获取历史记录失败: ' + error.message
    });
  }
});

// 导出合同审查报告
router.post('/export_review_report', async (req, res) => {
  try {
    // 不打印请求头：其中包含用户的 Authorization Token
    console.log('开始处理导出报告请求...');
    
    const { result_id } = req.body;
    
    console.log('请求参数:', { result_id });
    console.log('result_id类型:', typeof result_id);
    console.log('result_id是否为数字:', !isNaN(result_id));
    
    if (!result_id) {
      console.log('缺少result_id参数');
      return res.status(400).json({
        err_code: 400,
        message: '缺少必要的参数：result_id'
      });
    }

    // 验证result_id是否为有效数字
    const numericResultId = parseInt(result_id);
    if (isNaN(numericResultId) || numericResultId <= 0) {
      console.log('result_id不是有效的数字:', result_id);
      return res.status(400).json({
        err_code: 400,
        message: 'result_id必须是有效的正整数'
      });
    }

    // 获取审查结果
    console.log('查询数据库，获取审查结果，ID:', numericResultId);
    const result = await QualityResult.findOne({
      where: { id: numericResultId, user_id: req.user?.id || null },
      include: [
        {
          model: Contract,
          attributes: ['file_name', 'content']
        }
      ]
    });

    if (!result) {
      console.log('未找到审查结果，ID:', numericResultId);
      return res.status(404).json({
        err_code: 404,
        message: '审查结果不存在'
      });
    }

    console.log('找到审查结果:', {
      id: result.id,
      contract_name: result.contract_name,
      contract_type: result.contract_type
    });

    // 生成简单的文本报告（临时实现）
    const reportContent = `合同审查报告

基本信息：
- 合同名称：${result.contract_name || '未识别'}
- 合同类型：${result.contract_type || '未识别'}
- 生效日期：${result.effective_date || '未识别'}
- 终止日期：${result.termination_date || '未识别'}
- 管辖权：${result.jurisdiction || '未识别'}
- 分析立场：${result.analysis_position || '中立'}

涉及主体：
${result.parties_involved || '暂无信息'}

合同摘要：
${result.contract_summary || '暂无信息'}

风险条款解读：
${result.risk_clauses || '暂无风险条款识别'}

核心条款解读：
${result.core_clauses || '暂无核心条款识别'}

报告信息：
- 生成时间：${new Date().toLocaleString('zh-CN')}
- 原文件名：${result.Contract?.file_name || '未知'}

审查人员：_________________
审核人员：_________________

注：此报告由AI智能合同审查系统生成，仅供参考。`;

    // 生成安全的文件名（只包含ASCII字符）
    const safeContractName = (result.contract_name || 'ContractReview')
      .replace(/[^\x00-\x7F]/g, '') // 移除非ASCII字符
      .replace(/[^a-zA-Z0-9\s_-]/g, '') // 只保留字母、数字、空格、下划线、连字符
      .trim()
      .replace(/\s+/g, '_'); // 将空格替换为下划线
    
    const fileName = `${safeContractName}_${new Date().toISOString().slice(0, 10)}.docx`;
    
    console.log('生成的文件名:', fileName);
    console.log('报告内容长度:', reportContent.length);

    // 设置响应头
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    console.log('响应头设置完成，开始发送报告内容...');
    
    // 发送报告内容
    res.send(reportContent);
    
    console.log('报告导出成功完成');

  } catch (error) {
    console.error('导出报告失败:', error);
    console.error('错误堆栈:', error.stack);
    
    // 如果响应头已经设置，不能再次设置
    if (!res.headersSent) {
      res.status(500).json({
        err_code: 500,
        message: '导出报告失败: ' + error.message
      });
    }
  }
});

module.exports = router;