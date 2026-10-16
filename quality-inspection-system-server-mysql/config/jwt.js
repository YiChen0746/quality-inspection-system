// JWT 统一配置：签发（routes/register.js）与校验（middleware/auth.js）共用同一密钥
// 生产环境务必在 .env 中设置 JWT_SECRET 为随机长字符串
module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
};
