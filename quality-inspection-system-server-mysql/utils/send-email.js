const nodemailer = require('nodemailer');

// 配置邮件发送器：SMTP 参数优先读取环境变量，未配置时回退到原有默认值
const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE || 'qq', // 使用QQ邮箱服务
  host: process.env.SMTP_HOST || 'smtp.qq.com', 
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '2238622408@qq.com', // QQ邮箱账号
    pass: process.env.SMTP_PASS || 'tpahlfbjbadfdhhf' // QQ邮箱SMTP授权码
  }
});

/**
 * 发送验证码邮件
 * @param {string} to 收件人邮箱
 * @param {string} code 验证码
 * @param {string} type 验证类型（注册/重置密码）
 * @returns {Promise} 发送结果
 */
const sendVerificationCode = async (to, code, type = 'register') => {
  // 邮件主题
  const subject = type === 'register' 
    ? '合同文书智能审核系统 - 邮箱验证码' 
    : '合同文书智能审核系统 - 密码重置验证码';

  // 邮件内容
  const html = `
    <div style="background-color: #f7f7f7; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333; text-align: center;">合同文书智能审核系统</h2>
        <p style="color: #555; font-size: 16px;">尊敬的用户：</p>
        <p style="color: #555; font-size: 16px;">您的验证码是：</p>
        <div style="background-color: #f2f2f2; padding: 10px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px;">${code}</span>
        </div>
        <p style="color: #555; font-size: 14px;">验证码有效期为10分钟，请勿将验证码泄露给他人。</p>
        <p style="color: #555; font-size: 14px;">如果您没有进行相关操作，请忽略此邮件。</p>
        <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">此邮件由系统自动发送，请勿回复。</p>
      </div>
    </div>
  `;

  // 发送邮件
  try {
    const info = await transporter.sendMail({
      from: '"合同文书智能审核系统" <2238622408@qq.com>', // 发件人必须与认证用户相同
      to,
      subject,
      html
    });
    
    console.log(`邮件发送成功: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('邮件发送失败:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendVerificationCode
}; 