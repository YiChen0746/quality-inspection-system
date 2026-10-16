const express = require('express');
const md5 = require('blueimp-md5');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const path = require('path');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');
const { User, Registering } = require('../models');

// 创建路由对象
const router = express.Router();

// 表单验证规则
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': '请输入有效的邮箱地址',
    'any.required': '邮箱不能为空'
  }),
  nickname: Joi.string().min(2).max(20).required().messages({
    'string.min': '昵称至少需要2个字符',
    'string.max': '昵称最多20个字符',
    'any.required': '昵称不能为空'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': '密码至少需要6个字符',
    'any.required': '密码不能为空'
  })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': '请输入有效的邮箱地址',
    'any.required': '邮箱不能为空'
  }),
  password: Joi.string().required().messages({
    'any.required': '密码不能为空'
  })
});

// 渲染登录页面
const renderLoginPage = (req, res) => {
  res.sendFile(path.join(__dirname, '../views/login.html'));
};

// 获取登录状态
const getLoginStatus = async (req, res) => {
  // 检查session中是否有用户信息
  if (req.session && req.session.user) {
    return res.status(200).json({
      err_code: 0,
      message: '已登录',
      data: {
        id: req.session.user.id,
        email: req.session.user.email,
        nickname: req.session.user.nickname,
        avatar: req.session.user.avatar
      }
    });
  } else {
    return res.status(200).json({
      err_code: 1,
      message: '未登录'
    });
  }
};

// 处理注册请求
const registerHandler = async (req, res) => {
  try {
    // 验证请求数据
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        err_code: 400,
        message: error.details[0].message
      });
    }

    const { email, nickname, password } = value;

    // 检查邮箱是否已注册
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(200).json({
        err_code: 1,
        message: '邮箱已注册'
      });
    }

    // 创建新用户
    const newUser = await User.create({
      email,
      nickname,
      password: md5(password) // 密码加密存储
    });

    // 生成验证码
    const code = Math.random().toString().slice(2, 8); // 6位随机数字
    const expireTime = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

    // 保存验证码记录
    await Registering.create({
      email,
      code,
      expire_time: expireTime,
      type: 'register'
    });

    // 返回成功响应
    return res.status(200).json({
      err_code: 0,
      message: email
    });
  } catch (error) {
    console.error('注册失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 处理登录请求
const loginHandler = async (req, res) => {
  try {
    // 验证请求数据
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        err_code: 400,
        message: error.details[0].message
      });
    }

    const { email, password } = value;

    // 查找用户
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(200).json({
        err_code: 1,
        message: '邮箱或密码错误'
      });
    }

    // 验证密码
    if (md5(password) !== user.password) {
      return res.status(200).json({
        err_code: 1,
        message: '邮箱或密码错误'
      });
    }

    // 检查邮箱是否已验证
    if (!user.is_verified) {
      return res.status(200).json({
        err_code: 2,
        message: '邮箱未验证，请先验证邮箱'
      });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 保存用户信息到session
    req.session.user = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar
    };

    // 返回成功响应
    return res.status(200).json({
      err_code: 0,
      message: '登录成功',
      data: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        token
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 处理退出请求
const logoutHandler = (req, res) => {
  // 清除session
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({
        err_code: 500,
        message: '退出失败，请稍后重试'
      });
    }
    
    // 返回成功响应
    return res.status(200).json({
      err_code: 0,
      message: '退出成功'
    });
  });
};

// 渲染修改密码页面
const renderChangePasswordPage = (req, res) => {
  res.sendFile(path.join(__dirname, '../views/change-password.html'));
};

module.exports = {
  renderLoginPage,
  getLoginStatus,
  registerHandler,
  loginHandler,
  logoutHandler,
  renderChangePasswordPage
}; 