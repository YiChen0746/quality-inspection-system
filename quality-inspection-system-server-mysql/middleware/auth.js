// JWT 登录态校验中间件
// 从 Authorization: Bearer <token> 中解析并校验 JWT，通过后把用户信息挂到 req.user
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ err_code: 401, message: '未登录，请先登录' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (e) {
    return res.status(401).json({ err_code: 401, message: '登录已过期，请重新登录' });
  }
};
