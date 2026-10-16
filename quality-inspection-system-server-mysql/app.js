// 加载 .env（必须放在最前，保证后续模块读取环境变量时已生效；文件不存在时自动忽略）
require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const router = require('./routes/index');
const cors = require('cors');
const moment = require('moment');
const template = require('art-template');
const multer = require('multer');
const fs = require('fs');
const { testConnection } = require('./config/db');

const app = express();

// 测试数据库连接
testConnection();

// CORS中间件解决跨域问题
// 允许的跨域来源通过环境变量 CORS_ORIGINS 配置（逗号分隔）。
// 未配置时仅允许同源请求（经 Vite 代理 / Nginx 反代时浏览器不会发送跨域 origin，不受影响）。
const corsWhitelist = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || corsWhitelist.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false); // 不附带 CORS 响应头，浏览器将拦截该跨域请求
  },
}));

// 静态资源
app.use('/public/', express.static(path.join(__dirname, './public/')));

// 模板引擎配置
app.engine('html', require('express-art-template'));
app.set('views', path.join(__dirname, './views/'));

// 向模板内部导入 dateFormate 变量
template.defaults.imports.moment = moment;

// 配置 cookie
app.use(cookieParser());

// Session配置
app.use(session({
  name: 'quality_inspection',
  secret: process.env.SESSION_SECRET || 'quality_inspection_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // 在生产环境中使用HTTPS时设置为true
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 会话有效期7天
  }
}));

// 解析请求体（express 自带，无需重复引入 body-parser）
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 挂载路由
app.use('/api', router);

// 配置处理404的中间件
app.use(function(req, res) {
  res.status(404).json({
    err_code: 404,
    message: '请求的资源不存在'
  });
});

// 配置全局错误处理中间件
app.use(function(err, req, res, next) {
  console.error("错误:", err);
  
  // token解析失败导致的错误
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      err_code: 401,
      message: '无效的token'
    });
  }
  
  // 处理multer错误
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        err_code: 400,
        message: '文件大小超过限制'
      });
    }
    return res.status(400).json({
      err_code: 400,
      message: '文件上传错误: ' + err.message
    });
  }
  
  // 其他错误
  res.status(500).json({
    err_code: 500,
    message: err.message || '服务器内部错误'
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log(`服务器运行在端口 ${PORT} ...`);
});
