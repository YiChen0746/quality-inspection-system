const express = require('express');
const axios = require('axios');

// 处理聊天请求
const getChatAnswer = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({
        err_code: 400,
        message: '缺少问题参数'
      });
    }

    // 准备请求参数
    const params = {
      question
    };

    // 设置请求配置
    const config = {
      headers: {
        'Content-Type': 'application/json'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    };

    // 调用AI模型API
    let answer;
    try {
      // 这里替换为实际的AI模型API地址
      answer = await axios.post('http://127.0.0.1:5007/get_model_answer1', params, config);
    } catch (error) {
      console.error('调用AI模型失败:', error);
      return res.status(500).json({
        err_code: 500,
        message: '智能问答服务暂时不可用，请稍后重试'
      });
    }

    return res.status(200).json({
      err_code: 0,
      message: '获取成功',
      data: {
        answer: answer.data.response || '抱歉，我无法回答这个问题'
      }
    });
  } catch (error) {
    console.error('聊天请求失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 获取分析报告
const getAnalysisReport = async (req, res) => {
  try {
    const { hospital, startTime, endTime, type } = req.body;
    
    // 验证参数
    if (!type) {
      return res.status(400).json({
        err_code: 400,
        message: '缺少分析类型参数'
      });
    }

    // 准备请求数据
    const data = {
      hospital: hospital || '全部',
      startTime: startTime || '',
      endTime: endTime || '',
      type
    };

    // 调用AI模型API
    let reportResponse;
    try {
      // 这里替换为实际的AI模型API地址
      reportResponse = await axios.post('http://127.0.0.1:5008/get_analysis_report', data, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
    } catch (error) {
      console.error('调用分析报告API失败:', error);
      return res.status(500).json({
        err_code: 500,
        message: '分析报告服务暂时不可用，请稍后重试'
      });
    }

    return res.status(200).json({
      err_code: 0,
      message: '获取成功',
      data: {
        report: reportResponse.data.response || '无法生成分析报告'
      }
    });
  } catch (error) {
    console.error('获取分析报告失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

module.exports = {
  getChatAnswer,
  getAnalysisReport
}; 