const User = require('./user');
const Registering = require('./registering');
const Contract = require('./contract');
const QualityResult = require('./quality_result');
const ChatSession = require('./chat_session');
const ChatMessage = require('./chat_message');

// 设置模型关联关系
// 用户与合同：一对多
User.hasMany(Contract, { foreignKey: 'user_id' });
Contract.belongsTo(User, { foreignKey: 'user_id' });

// 用户与质量检查结果：一对多
User.hasMany(QualityResult, { foreignKey: 'user_id' });
QualityResult.belongsTo(User, { foreignKey: 'user_id' });

// 合同与质量检查结果：一对多
Contract.hasMany(QualityResult, { foreignKey: 'contract_id' });
QualityResult.belongsTo(Contract, { foreignKey: 'contract_id' });

// 用户与会话：一对多
User.hasMany(ChatSession, { foreignKey: 'user_id' });
ChatSession.belongsTo(User, { foreignKey: 'user_id' });

// 会话与消息：一对多
ChatSession.hasMany(ChatMessage, { foreignKey: 'session_id' });
ChatMessage.belongsTo(ChatSession, { foreignKey: 'session_id' });

// 用户与消息：一对多
User.hasMany(ChatMessage, { foreignKey: 'user_id' });
ChatMessage.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
  User,
  Registering,
  Contract,
  QualityResult,
  ChatSession,
  ChatMessage
}; 