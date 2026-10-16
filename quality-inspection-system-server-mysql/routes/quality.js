const express = require('express');
const axios = require('axios').default;
const { Contract, QualityResult } = require('../models');
const { Op } = require('sequelize');

// 处理单个合同质量检查请求
const getQualityResultHandler = async (req, res) => {
  try {
    const { contract_id, analysis_position } = req.body;
    
    if (!contract_id) {
      return res.status(400).json({
        err_code: 400,
        message: '缺少合同ID参数'
      });
    }

    // 查找合同
    const contract = await Contract.findByPk(contract_id);
    if (!contract) {
      return res.status(404).json({
        err_code: 404,
        message: '合同不存在'
      });
    }

    // 获取用户ID（如果有）
    const userId = req.session && req.session.user ? req.session.user.id : null;

    // 检查是否已有分析结果
    const existingResult = await QualityResult.findOne({
      where: {
        contract_id,
        analysis_position: analysis_position || '默认立场'
      }
    });

    if (existingResult) {
      return res.status(200).json({
        err_code: 0,
        message: '获取成功',
        data: {
          id: existingResult.id,
          contract_id: existingResult.contract_id,
          hospital: existingResult.hospital,
          analysis_position: existingResult.analysis_position,
          contract_name: existingResult.contract_name,
          contract_type: existingResult.contract_type,
          effective_date: existingResult.effective_date,
          termination_date: existingResult.termination_date,
          jurisdiction: existingResult.jurisdiction,
          parties_involved: existingResult.parties_involved,
          contract_summary: existingResult.contract_summary,
          risk_clauses: existingResult.risk_clauses,
          core_clauses: existingResult.core_clauses
        }
      });
    }

    // 准备请求数据
    const data = {
      fileContent: contract.content,
      prompt: `根据这份合同内容，站在${analysis_position || '默认立场'}的立场` +
      `请按以下顺序提供该合同的详细信息，每个部分前请用编号标记，例如 "合同名称:..."。确保每个项目按顺序列出，格式如下：
      
      1. 合同名称
      2. 合同类型
      3. 生效日期
      4. 终止日期
      5. 管辖权
      6. 分析立场
      7. 涉及主体
      8. 合同摘要
      9. 风险条款解读
          - 条款名称
          - 修改意见
          - 对应原文
          - 修订后的条款
          - 关联条款
      10. 核心条款解读
          - 条款名称
          - 条款说明
          - 关联条款
      
      请使用中文详细回答，如果合同中没有某些部分的相关内容，请回答"合同中未说明"。请确保每个部分的内容分行显示。不要使用省略号，所有内容都要详细说明，回答中不能出现*星号。
      `
    };

    // 调用AI模型API
    let modelResponse;
    try {
      // 这里替换为实际的AI模型API地址
      modelResponse = await axios.post('http://127.0.0.1:5008/get_model_answer2', data, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
    } catch (error) {
      console.error('调用AI模型失败:', error);
      return res.status(500).json({
        err_code: 500,
        message: '分析服务暂时不可用，请稍后重试'
      });
    }

    // 解析AI模型返回的结果
    const analysisResult = modelResponse.data.response;
    
    // 提取各个部分的内容
    const contractName = extractContent(analysisResult, '1. 合同名称', '2. 合同类型');
    const contractType = extractContent(analysisResult, '2. 合同类型', '3. 生效日期');
    const effectiveDate = extractContent(analysisResult, '3. 生效日期', '4. 终止日期');
    const terminationDate = extractContent(analysisResult, '4. 终止日期', '5. 管辖权');
    const jurisdiction = extractContent(analysisResult, '5. 管辖权', '6. 分析立场');
    const analysisPosition = extractContent(analysisResult, '6. 分析立场', '7. 涉及主体');
    const partiesInvolved = extractContent(analysisResult, '7. 涉及主体', '8. 合同摘要');
    const contractSummary = extractContent(analysisResult, '8. 合同摘要', '9. 风险条款解读');
    const riskClauses = extractContent(analysisResult, '9. 风险条款解读', '10. 核心条款解读');
    const coreClauses = extractContent(analysisResult, '10. 核心条款解读', null);

    // 保存分析结果到数据库
    const qualityResult = await QualityResult.create({
      contract_id: contract.id,
      hospital: '未指定',
      analysis_position: analysis_position || '默认立场',
      contract_name: contractName,
      contract_type: contractType,
      effective_date: effectiveDate,
      termination_date: terminationDate,
      jurisdiction: jurisdiction,
      parties_involved: partiesInvolved,
      contract_summary: contractSummary,
      risk_clauses: riskClauses,
      core_clauses: coreClauses,
      user_id: userId
    });

    return res.status(200).json({
      err_code: 0,
      message: '分析成功',
      data: {
        id: qualityResult.id,
        contract_id: qualityResult.contract_id,
        hospital: qualityResult.hospital,
        analysis_position: qualityResult.analysis_position,
        contract_name: qualityResult.contract_name,
        contract_type: qualityResult.contract_type,
        effective_date: qualityResult.effective_date,
        termination_date: qualityResult.termination_date,
        jurisdiction: qualityResult.jurisdiction,
        parties_involved: qualityResult.parties_involved,
        contract_summary: qualityResult.contract_summary,
        risk_clauses: qualityResult.risk_clauses,
        core_clauses: qualityResult.core_clauses
      }
    });
  } catch (error) {
    console.error('质量检查失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 获取所有质量检查结果
const getAllQualityResults = async (req, res) => {
  try {
    // 获取用户ID（如果有）
    const userId = req.session && req.session.user ? req.session.user.id : null;

    // 查询条件
    const where = {};
    if (userId) {
      where.user_id = userId;
    }

    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    // 查询质量检查结果
    const { count, rows } = await QualityResult.findAndCountAll({
      where,
      include: [
        {
          model: Contract,
          attributes: ['file_name']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset
    });

    // 转换为前端需要的格式
    const results = rows.map(result => ({
      id: result.id,
      contract_id: result.contract_id,
      contract_name: result.Contract ? result.Contract.file_name : '未知',
      hospital: result.hospital,
      analysis_position: result.analysis_position,
      created_at: result.createdAt
    }));

    return res.status(200).json({
      err_code: 0,
      message: '获取成功',
      data: {
        total: count,
        page,
        pageSize,
        results
      }
    });
  } catch (error) {
    console.error('获取质量检查结果失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 获取医院列表
const getHospitalList = async (req, res) => {
  try {
    // 获取用户ID（如果有）
    const userId = req.session && req.session.user ? req.session.user.id : null;

    // 查询条件
    const where = {};
    if (userId) {
      where.user_id = userId;
    }

    // 查询不同的医院名称
    const hospitals = await QualityResult.findAll({
      where,
      attributes: ['hospital'],
      group: ['hospital']
    });

    // 转换为前端需要的格式
    const hospitalList = hospitals.map(item => item.hospital).filter(Boolean);

    return res.status(200).json({
      err_code: 0,
      message: '获取成功',
      data: hospitalList
    });
  } catch (error) {
    console.error('获取医院列表失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 上传图片（占位函数，实际不需要实现）
const uploadImages = (req, res) => {
  return res.status(200).json({
    err_code: 0,
    message: '此功能在MySQL版本中未实现'
  });
};

// 批量质检（占位函数，实际不需要实现）
const getQualityResultListHandler = (req, res) => {
  return res.status(200).json({
    err_code: 0,
    message: '此功能在MySQL版本中未实现'
  });
};

// 图片质检（占位函数，实际不需要实现）
const getQualityResultjpgHandler = (req, res) => {
  return res.status(200).json({
    err_code: 0,
    message: '此功能在MySQL版本中未实现'
  });
};

// 辅助函数：从文本中提取指定部分的内容
function extractContent(text, startMarker, endMarker) {
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) return '';
  
  const startContentIndex = startIndex + startMarker.length;
  
  let endIndex;
  if (endMarker) {
    endIndex = text.indexOf(endMarker, startContentIndex);
    if (endIndex === -1) endIndex = text.length;
  } else {
    endIndex = text.length;
  }
  
  return text.substring(startContentIndex, endIndex).trim();
}

module.exports = {
  getQualityResultHandler,
  getAllQualityResults,
  getHospitalList,
  uploadImages,
  getQualityResultListHandler,
  getQualityResultjpgHandler
}; 