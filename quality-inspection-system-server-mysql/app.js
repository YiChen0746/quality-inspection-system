const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
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
app.use(cors());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

// 静态资源
app.use('/public/', express.static(path.join(__dirname, './public/')));
app.use('/public/uploads/', express.static('./public/uploads/'));
app.use('/public/uploads/userfile/', express.static('./public/uploads/userfile/'));
app.use('/node_modules/', express.static(path.join(__dirname, './node_modules/')));

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
  secret: 'quality_inspection_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // 在生产环境中使用HTTPS时设置为true
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 会话有效期7天
  }
}));

// 解析请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

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
