# 合同文书智能审核系统（Quality Inspection System）

一个面向合同文书的智能审核与质量检查系统，包含前端管理界面与后端服务。支持合同上传、智能审查、质量检查、结果分析、报告导出与智能问答等功能。

## 功能模块

- **用户认证**：注册、登录、邮箱验证码、修改密码
- **合同上传与管理**：上传 Word/PDF 合同文件、文件列表、搜索、删除
- **合同智能审查**：基于大模型识别合同条款风险并给出解读
- **合同起草**：根据需求自动生成合同文本
- **质量检查**：单个 / 批量合同质量检查，生成质检结果
- **结果分析**：按类型统计分析、生成分析报告、导出 Excel
- **智能问答**：法务助手对话（流式输出）
- **知识推广**：首页内容展示

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3、Vite、TypeScript、Element Plus、ECharts、Pinia、Vue Router |
| 后端 | Node.js、Express、Sequelize |
| 数据库 | MySQL 5.7+ |
| 其他 | Nodemailer（邮件）、DeepSeek API（大模型）、mammoth / docx（文档解析）、Multer（文件上传） |

## 目录结构

```
quality-inspection-system/
├── quality-inspection-system-fe/            # 前端（Vue 3 + Vite）
│   └── src/
│       ├── views/                           # 页面
│       ├── components/                      # 公共组件
│       ├── router/                          # 路由
│       ├── services/                        # 外部服务（大模型等）
│       └── setup/request/                   # axios 封装与接口定义
├── quality-inspection-system-server-mysql/  # 后端（Express + MySQL）
│   ├── config/db.js                         # 数据库连接配置
│   ├── models/                              # Sequelize 数据模型
│   ├── routes/                              # 接口路由
│   ├── utils/                               # 工具（初始化数据库、邮件、文本抽取）
│   └── app.js                               # 服务入口
└── .gitignore
```

## 环境要求

- Node.js v14 及以上（推荐 v18 / v20）
- MySQL 5.7 及以上（推荐 8.0）
- npm

## 快速开始

### 1. 启动后端

```bash
cd quality-inspection-system-server-mysql
npm install
```

修改数据库连接信息（`config/db.js` 与 `utils/init-db.js`）：

```js
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '你的数据库密码',
  port: 3306,
  database: 'quality_inspection'
};
```

一键初始化数据库（自动建库、建表、创建默认管理员、创建上传目录）：

```bash
npm run init-db
```

启动服务：

```bash
npm run dev      # 开发模式（nodemon 热重载）
# 或
npm start        # 生产模式
```

后端默认运行在 http://localhost:3000

### 2. 启动前端

```bash
cd quality-inspection-system-fe
npm install
npm run dev
```

前端默认运行在 http://localhost:5173

### 3. 登录系统

- 地址：http://localhost:5173
- 默认管理员账号：`admin@example.com`
- 默认管理员密码：`admin123`

> 前端调用后端的地址配置在 `quality-inspection-system-fe/src/setup/request/apis/main.ts`，默认指向 `http://127.0.0.1:3000`。

## 配置说明

### 数据库

后端运行时读取 `config/db.js`，初始化脚本读取 `utils/init-db.js`，请将两处都改为你自己的数据库账号密码。

### 邮件服务

`utils/send-email.js` 使用 Nodemailer 发送邮箱验证码，请替换为你自己的 SMTP 账号与授权码：

```js
const transporter = nodemailer.createTransport({
  host: 'smtp.qq.com',
  port: 465,
  secure: true,
  auth: { user: '你的邮箱', pass: '你的SMTP授权码' }
});
```

### 大模型 / OCR 服务

以下位置需要配置你自己的 API Key：

- `quality-inspection-system-fe/src/services/deepseek.ts`
- `quality-inspection-system-server-mysql/routes/contract-draft.js`
- `quality-inspection-system-server-mysql/routes/contract-review.js`（大模型 + OCR）

## 接口概览

后端接口统一以 `/api` 为前缀，更完整的说明见 `quality-inspection-system-server-mysql/README.md`。

| 分类 | 接口 |
|------|------|
| 用户认证 | `POST /api/register`、`POST /api/login`、`GET /api/logout`、`POST /api/sendCode`、`POST /api/sureCode`、`POST /api/changePasswordByCode` |
| 文件管理 | `POST /api/upload`、`GET /api/files`、`DELETE /api/delete`、`GET /api/search` |
| 质量检查 | `POST /api/get_quality_result`、`POST /api/get_all_quality_results`、`GET /api/hospital_list` |
| 数据分析 | `POST /api/analysis_by_type`、`POST /api/analysis_report` |
| 智能问答 | `POST /api/intelligent_qa` |

## 安全提示

- **请勿把真实密钥提交到仓库**（数据库密码、邮箱授权码、大模型 / OCR API Key 等）。
- 建议将敏感配置改为通过环境变量（`.env`）读取，`.env` 已在 `.gitignore` 中排除。
- 仓库已排除 `node_modules/`、`public/uploads/`（用户上传的真实文件）与本地遗留目录。

## 参与贡献

欢迎一起完善这个项目：

1. Fork 本仓库
2. 新建分支：`git checkout -b feature/你的功能`
3. 提交改动：`git commit -m "feat: 描述你的改动"`
4. 推送分支：`git push origin feature/你的功能`
5. 提交 Pull Request

### 提交信息规范建议

| 前缀 | 含义 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复问题 |
| `docs` | 文档变更 |
| `refactor` | 重构 |
| `chore` | 构建 / 杂项 |

## 许可证

见各子项目目录下的 LICENSE。
