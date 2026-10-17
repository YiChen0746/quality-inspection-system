const express = require('express');
const registerAPI = require('./register');
const emailAPI = require('./email');
const qualityAPI = require('./quality');
const chatAPI = require('./chat');
const analysisAPI = require('./analysis');
const contractDraftAPI = require('./contract-draft');
const uploadAPI = require('./upload');
const filesAPI = require('./files');
const contractReviewAPI = require('./contract-review');
const deepseekProxyAPI = require('./deepseek-proxy');
const featuresAPI = require('./features');
const chatSessionAPI = require('./chat-session');
const auth = require('../middleware/auth');
const multer = require('multer');

const router = express.Router();

// ================================================================
// 白名单路由：无需登录即可访问（注册、登录、邮箱验证、修改密码）
// ================================================================

// ================= 注册 - 验证 - 登录 - 退出 ================
// 渲染注册登录页面
router.get('/login', registerAPI.renderLoginPage);
router.get('/login_status', registerAPI.getLoginStatus);
// 渲染邮箱验证页面
router.get('/email', emailAPI.renderEmailPage);

// 注册
router.post('/register', registerAPI.registerHandler);
router.post('/sendCode', emailAPI.sendCodeHandler); // 处理邮箱验证请求
router.post('/sureCode', emailAPI.sureCodeHandler); // 处理验证码请求
// 登录
router.post('/login', registerAPI.loginHandler);
// 退出
router.get('/logout', registerAPI.logoutHandler);
// 修改密码
router.get('/sendChangePasswordCode', emailAPI.sendChangePasswordCode);
router.post('/changePasswordByCode', emailAPI.changePasswordByCode);

// 渲染通过邮箱验证码修改密码页面
router.get('/changePasswordByCode', registerAPI.renderChangePasswordPage);

// ================================================================
// 以下所有接口均需登录（携带 Authorization: Bearer <token>）
// ================================================================
router.use(auth);

// ================= 质量检查 ================
// 单个病历质检
router.post('/get_quality_result', qualityAPI.getQualityResultHandler);

// 上传图片
router.post('/upload_XImages', qualityAPI.uploadImages);

// excel导入质检
router.post('/get_quality_list_result', qualityAPI.getQualityResultListHandler);

//扫描图片导入质检
router.post('/get_quality_jpg_result', qualityAPI.getQualityResultjpgHandler);

// ================= 数据总览 ================
// 全部病历列表
router.post('/get_all_quality_results', qualityAPI.getAllQualityResults);

// ================= 数据分析 ================
// 数据分析
router.post('/analysis_by_type', analysisAPI.analysisByType);
// 合同统计数据
router.get('/contract_statistics', analysisAPI.getContractStatistics);
// 报告导出
router.post('/analysis_report', chatAPI.getAnalysisReport);
// 医院列表
router.get('/hospital_list', qualityAPI.getHospitalList);

// ================= 智能问答 ================
router.post('/intelligent_qa', chatAPI.getChatAnswer);

// ================= 大模型代理（密钥仅存于服务端） ================
router.use('/deepseek', deepseekProxyAPI);

// ================= 聊天会话历史 ================
router.use('/chat', chatSessionAPI);

// ================= 文件上传和管理 ================
// 上传文件
router.post('/upload', uploadAPI.upload.single('file'), uploadAPI.handleFileUpload);
router.post('/upload1', uploadAPI.upload.single('file'), uploadAPI.handleFileUpload);

// 获取文件列表
router.get('/files', filesAPI.getContractFiles);
router.get('/getContracts', filesAPI.getContractFiles);

// 删除文件
router.delete('/delete', filesAPI.deleteContractFile);
router.delete('/deleteContract', filesAPI.deleteContractFile);

// 搜索文件
router.get('/search', filesAPI.searchContractFiles);

// ================= 合同审查 ================
// 合同审查路由
router.use('/contract-review', contractReviewAPI);

// ================= 合同起草 ================
// 合同起草相关路由
router.post('/generate_contract', contractDraftAPI.generateContract);
router.post('/export_contract_docx', contractDraftAPI.exportContractDocx);
router.post('/export_contract_pdf', contractDraftAPI.exportContractPdf);
router.get('/contract_templates', contractDraftAPI.getContractTemplates);

// ================= 扩展功能（到期提醒/风险评分/统计面板/批量上传） ================
// 即将到期合同
router.get('/expiring_contracts', featuresAPI.getExpiringContracts);
// 合同风险评分
router.post('/score_contract', featuresAPI.scoreContract);
// 数据统计面板
router.get('/dashboard_stats', featuresAPI.getDashboardStats);
// 批量上传
router.post('/batch_upload', featuresAPI.batchUpload.array('files', 10), featuresAPI.handleBatchUpload);

module.exports = router;
