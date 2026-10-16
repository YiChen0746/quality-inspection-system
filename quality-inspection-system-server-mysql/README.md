# 合同文书智能审核系统 - MySQL版

这是一个基于MySQL的合同文书智能审核系统后端，提供合同上传、分析、质量检查等功能。

## 系统要求

- Node.js v14+
- MySQL 5.7+
- npm 或 yarn

## 安装

1. 克隆仓库：

```bash
git clone <repository-url>
cd quality-inspection-system-server-mysql
```

2. 安装依赖：

```bash
npm install
```

3. 配置数据库：

编辑 `utils/init-db.js` 和 `config/db.js` 文件，修改数据库连接信息：

```javascript
// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'your_username',
  password: 'your_password',
  port: 3306,
  database: 'quality_inspection'
};
```

4. 一键初始化数据库：

```bash
npm run init-db
```

这个命令会自动：
- 创建名为 `quality_inspection` 的数据库（如果不存在）
- 创建所有必要的数据表
- 创建默认管理员账户
- 创建上传文件所需的目录结构

默认管理员账号：
- 邮箱：admin@example.com
- 密码：admin123

5. 配置邮件服务：

编辑 `utils/send-email.js` 文件，修改邮件服务器配置：

```javascript
const transporter = nodemailer.createTransport({
  host: 'your-smtp-server.com',
  port: 465,
  secure: true,
  auth: {
    user: 'your-email@example.com',
    pass: 'your-password'
  }
});
```

## 运行

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

服务器默认运行在 http://localhost:3000

## API文档

### 用户认证

- `POST /api/register` - 用户注册
- `POST /api/login` - 用户登录
- `GET /api/logout` - 用户退出
- `POST /api/sendCode` - 发送邮箱验证码
- `POST /api/sureCode` - 验证邮箱验证码
- `GET /api/sendChangePasswordCode` - 发送修改密码验证码
- `POST /api/changePasswordByCode` - 通过验证码修改密码

### 文件管理

- `POST /api/upload` - 上传文件
- `GET /api/files` - 获取文件列表
- `DELETE /api/delete` - 删除文件
- `GET /api/search` - 搜索文件

### 质量检查

- `POST /api/get_quality_result` - 获取单个合同质量检查结果
- `POST /api/get_all_quality_results` - 获取所有质量检查结果
- `GET /api/hospital_list` - 获取医院列表

### 数据分析

- `POST /api/analysis_by_type` - 按类型分析数据
- `POST /api/analysis_report` - 生成分析报告

### 智能问答

- `POST /api/intelligent_qa` - 智能问答

## 目录结构

```
quality-inspection-system-server-mysql/
├── config/             # 配置文件
├── models/             # 数据模型
├── routes/             # 路由控制器
├── utils/              # 工具函数
├── public/             # 静态资源
├── views/              # 视图模板
├── app.js              # 应用入口
├── package.json        # 项目依赖
└── README.md           # 项目说明
```

## 许可证

MIT 