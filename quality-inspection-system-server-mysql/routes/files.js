const express = require('express');
const path = require('path');
const fs = require('fs');
const { Contract } = require('../models');
const { Op } = require('sequelize');

// 获取合同文件列表
const getContractFiles = async (req, res) => {
  try {
    // 获取用户ID（如果有）
    const userId = req.session && req.session.user ? req.session.user.id : null;

    // 查询条件
    const where = {};
    if (userId) {
      where.user_id = userId;
    }

    // 查询合同文件列表
    const contracts = await Contract.findAll({
      where,
      attributes: ['id', 'file_name', 'file_path', 'file_size', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    // 转换为前端需要的格式
    const files = contracts.map(contract => ({
      id: contract.id,
      fileName: contract.file_name,
      filePath: contract.file_path,
      fileSize: contract.file_size,
      uploadTime: contract.createdAt
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

// 搜索合同文件
const searchContractFiles = async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) {
      return getContractFiles(req, res);
    }

    // 获取用户ID（如果有）
    const userId = req.session && req.session.user ? req.session.user.id : null;

    // 查询条件
    const where = {
      file_name: {
        [Op.like]: `%${keyword}%`
      }
    };
    
    if (userId) {
      where.user_id = userId;
    }

    // 查询合同文件列表
    const contracts = await Contract.findAll({
      where,
      attributes: ['id', 'file_name', 'file_path', 'file_size', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    // 转换为前端需要的格式
    const files = contracts.map(contract => ({
      id: contract.id,
      fileName: contract.file_name,
      filePath: contract.file_path,
      fileSize: contract.file_size,
      uploadTime: contract.createdAt
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