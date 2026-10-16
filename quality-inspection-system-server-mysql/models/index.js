const User = require('./user');
const Registering = require('./registering');
const Contract = require('./contract');
const QualityResult = require('./quality_result');

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

module.exports = {
  User,
  Registering,
  Contract,
  QualityResult
}; 