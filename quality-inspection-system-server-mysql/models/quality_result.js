const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// 质量检查结果模型
const QualityResult = sequelize.define('QualityResult', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '检查结果ID'
  },
  contract_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联合同ID'
  },
  hospital: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '医院名称'
  },
  analysis_position: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '分析立场'
  },
  contract_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '合同名称'
  },
  contract_type: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '合同类型'
  },
  effective_date: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '生效日期'
  },
  termination_date: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '终止日期'
  },
  jurisdiction: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '管辖权'
  },
  parties_involved: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '涉及主体'
  },
  contract_summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '合同摘要'
  },
  risk_clauses: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: '风险条款解读'
  },
  core_clauses: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: '核心条款解读'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '用户ID'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  }
}, {
  tableName: 'quality_results'
});

module.exports = QualityResult; 