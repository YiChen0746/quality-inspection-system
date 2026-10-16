const express = require('express');
const path = require('path');
const md5 = require('blueimp-md5');
const { User, Registering } = require('../models');
const { sendVerificationCode } = require('../utils/send-email');

// 渲染邮箱验证页面
const renderEmailPage = (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).send('缺少邮箱参数');
  }
  
  res.sendFile(path.join(__dirname, '../views/email-verification.html'));
};

// 发送验证码
const sendCodeHandler = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        err_code: 400,
        message: '缺少邮箱参数'
      });
    }

    // 生成验证码
    const code = Math.random().toString().slice(2, 8); // 6位随机数字
    const expireTime = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

    // 查找现有验证码记录
    const existingCode = await Registering.findOne({
      where: { email, type: 'register' }
    });

    if (existingCode) {
      // 更新验证码
      await existingCode.update({
        code,
        expire_time: expireTime
      });
    } else {
      // 创建新验证码记录
      await Registering.create({
        email,
        code,
        expire_time: expireTime,
        type: 'register'
      });
    }

    // 发送验证码邮件
    const result = await sendVerificationCode(email, code, 'register');
    if (!result.success) {
      return res.status(500).json({
        err_code: 500,
        message: '发送验证码失败，请稍后重试'
      });
    }

    return res.status(200).json({
      err_code: 0,
      message: '验证码已发送，请查收邮件'
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 验证验证码
const sureCodeHandler = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({
        err_code: 400,
        message: '缺少必要参数'
      });
    }

    // 查找验证码记录
    const codeRecord = await Registering.findOne({
      where: { email, type: 'register' }
    });

    if (!codeRecord) {
      return res.status(200).json({
        err_code: 1,
        message: '验证码不存在或已过期'
      });
    }

    // 检查验证码是否过期
    if (new Date() > codeRecord.expire_time) {
      return res.status(200).json({
        err_code: 1,
        message: '验证码已过期'
      });
    }

    // 检查验证码是否正确
    if (codeRecord.code !== code) {
      return res.status(200).json({
        err_code: 1,
        message: '验证码错误'
      });
    }

    // 更新用户验证状态
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(200).json({
        err_code: 1,
        message: '用户不存在'
      });
    }

    await user.update({ is_verified: true });

    // 删除验证码记录
    await codeRecord.destroy();

    return res.status(200).json({
      err_code: 0,
      message: '邮箱验证成功'
    });
  } catch (error) {
    console.error('验证码验证失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 发送修改密码验证码
const sendChangePasswordCode = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({
        err_code: 400,
        message: '缺少邮箱参数'
      });
    }

    // 检查用户是否存在
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(200).json({
        err_code: 1,
        message: '用户不存在'
      });
    }

    // 生成验证码
    const code = Math.random().toString().slice(2, 8); // 6位随机数字
    const expireTime = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

    // 查找现有验证码记录
    const existingCode = await Registering.findOne({
      where: { email, type: 'reset' }
    });

    if (existingCode) {
      // 更新验证码
      await existingCode.update({
        code,
        expire_time: expireTime
      });
    } else {
      // 创建新验证码记录
      await Registering.create({
        email,
        code,
        expire_time: expireTime,
        type: 'reset'
      });
    }

    // 发送验证码邮件
    const result = await sendVerificationCode(email, code, 'reset');
    if (!result.success) {
      return res.status(500).json({
        err_code: 500,
        message: '发送验证码失败，请稍后重试'
      });
    }

    return res.status(200).json({
      err_code: 0,
      message: '验证码已发送，请查收邮件'
    });
  } catch (error) {
    console.error('发送修改密码验证码失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 通过验证码修改密码
const changePasswordByCode = async (req, res) => {
  try {
    const { email, code, password } = req.body;
    if (!email || !code || !password) {
      return res.status(400).json({
        err_code: 400,
        message: '缺少必要参数'
      });
    }

    // 查找验证码记录
    const codeRecord = await Registering.findOne({
      where: { email, type: 'reset' }
    });

    if (!codeRecord) {
      return res.status(200).json({
        err_code: 1,
        message: '验证码不存在或已过期'
      });
    }

    // 检查验证码是否过期
    if (new Date() > codeRecord.expire_time) {
      return res.status(200).json({
        err_code: 1,
        message: '验证码已过期'
      });
    }

    // 检查验证码是否正确
    if (codeRecord.code !== code) {
      return res.status(200).json({
        err_code: 1,
        message: '验证码错误'
      });
    }

    // 更新用户密码
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(200).json({
        err_code: 1,
        message: '用户不存在'
      });
    }

    await user.update({ password: md5(password) });

    // 删除验证码记录
    await codeRecord.destroy();

    return res.status(200).json({
      err_code: 0,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('修改密码失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

module.exports = {
  renderEmailPage,
  sendCodeHandler,
  sureCodeHandler,
  sendChangePasswordCode,
  changePasswordByCode
}; 