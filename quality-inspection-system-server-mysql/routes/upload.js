const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Contract } = require('../models');
const { extractTextFromDocxBuffer } = require('../utils/extract-text');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads/userfile');
    
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName);
    cb(null, uniqueSuffix + ext);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 只接受docx文件
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    cb(null, true);
  } else {
    cb(new Error('只支持.docx格式的文件'), false);
  }
};

// 创建multer实例
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制文件大小为10MB
  }
});

// 处理文件上传
const handleFileUpload = async (req, res) => {
  try {
    // 检查文件是否上传成功
    if (!req.file) {
      return res.status(400).json({
        err_code: 400,
        message: '文件上传失败'
      });
    }

    // 获取文件信息
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const filePath = req.file.path;
    const fileSize = req.file.size;

    // 获取用户ID（如果有）
    const userId = req.session && req.session.user ? req.session.user.id : null;

    // 提取文件内容
    let fileContent = '';
    try {
      const content = fs.readFileSync(filePath);
      fileContent = await extractTextFromDocxBuffer(content);
    } catch (error) {
      console.error('解析文件失败:', error);
      // 删除上传的文件
      fs.unlinkSync(filePath);
      return res.status(500).json({
        err_code: 500,
        message: '文件解析失败，请确保文件格式正确'
      });
    }

    // 保存文件记录到数据库
    const contract = await Contract.create({
      file_name: originalName,
      file_path: filePath,
      file_size: fileSize,
      content: fileContent,
      user_id: userId
    });

    return res.status(200).json({
      err_code: 0,
      message: '文件上传成功',
      data: {
        id: contract.id,
        fileName: contract.file_name,
        filePath: contract.file_path,
        fileSize: contract.file_size
      }
    });
  } catch (error) {
    console.error('文件上传失败:', error);
    // 如果有上传的文件，删除它
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

module.exports = {
  upload,
  handleFileUpload
}; 