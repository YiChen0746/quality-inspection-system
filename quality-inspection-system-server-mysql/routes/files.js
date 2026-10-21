const express = require('express');
const path = require('path');
const fs = require('fs');
const { Contract } = require('../models');
const { Op } = require('sequelize');

// 获取合同文件列表
const getContractFiles = async (req, res) => {
  try {
    // 获取用户ID（JWT 登录态在 req.user 上）
    const userId = req.user?.id || null;

    // 查询条件
    const where = {};
    if (userId) {
      where.user_id = userId;
    }

    // 查询合同文件列表
    const contracts = await Contract.findAll({
      where,
      attributes: ['id', 'file_name', 'file_path', 'file_size', 'created_at', 'contract_type', 'expiry_date', 'risk_score', 'risk_level'],
      order: [['created_at', 'DESC']]
    });

    // 转换为前端需要的格式
    const files = contracts.map(contract => ({
      id: contract.id,
      fileName: contract.file_name,
      filePath: contract.file_path,
      fileSize: contract.file_size,
      uploadTime: contract.created_at,
      contractType: contract.contract_type,
      expiryDate: contract.expiry_date,
      riskScore: contract.risk_score,
      riskLevel: contract.risk_level
    }));

    return res.status(200).json({
      err_code: 0,
      message: '获取成功',
      files
    });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 删除合同文件
const deleteContractFile = async (req, res) => {
  try {
    const { fileName } = req.body;
    if (!fileName) {
      return res.status(400).json({
        err_code: 400,
        message: '缺少文件名参数'
      });
    }

    // 查找文件记录
    const contract = await Contract.findOne({
      where: { file_name: fileName }
    });

    if (!contract) {
      return res.status(404).json({
        err_code: 404,
        message: '文件不存在'
      });
    }

    // 删除物理文件
    const filePath = contract.file_path;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 删除数据库记录
    await contract.destroy();

    return res.status(200).json({
      err_code: 0,
      message: '文件删除成功'
    });
  } catch (error) {
    console.error('删除文件失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 搜索合同文件（支持文件名关键词 + 时间范围 + 合同类型筛选）
const searchContractFiles = async (req, res) => {
  try {
    const { keyword, startDate, endDate, contractType } = req.query;

    // 获取用户ID（JWT 登录态在 req.user 上）
    const userId = req.user?.id || null;

    // 查询条件
    const where = {};

    if (keyword) {
      where.file_name = {
        [Op.like]: `%${keyword}%`
      };
    }

    // 时间范围筛选（按创建时间）
    if (startDate && endDate) {
      where.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate + ' 23:59:59')]
      };
    } else if (startDate) {
      where.created_at = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      where.created_at = { [Op.lte]: new Date(endDate + ' 23:59:59') };
    }

    // 合同类型筛选
    if (contractType) {
      where.contract_type = contractType;
    }

    if (userId) {
      where.user_id = userId;
    }

    // 查询合同文件列表
    const contracts = await Contract.findAll({
      where,
      attributes: ['id', 'file_name', 'file_path', 'file_size', 'created_at', 'contract_type', 'expiry_date', 'risk_score', 'risk_level'],
      order: [['created_at', 'DESC']]
    });

    // 转换为前端需要的格式
    const files = contracts.map(contract => ({
      id: contract.id,
      fileName: contract.file_name,
      filePath: contract.file_path,
      fileSize: contract.file_size,
      uploadTime: contract.created_at,
      contractType: contract.contract_type,
      expiryDate: contract.expiry_date,
      riskScore: contract.risk_score,
      riskLevel: contract.risk_level
    }));

    return res.status(200).json({
      err_code: 0,
      message: '搜索成功',
      files
    });
  } catch (error) {
    console.error('搜索文件失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

module.exports = {
  getContractFiles,
  deleteContractFile,
  searchContractFiles
}; 