const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// 合同模型
const Contract = sequelize.define('Contract', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '合同ID'
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '文件名'
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '文件路径'
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '文件大小(字节)'
  },
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: '合同内容'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '上传用户ID'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  },
  contract_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'draft',
    comment: '合同类型：draft-起草，review-审查'
  },
  expiry_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: '合同到期日期'
  },
  risk_score: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '风险评分 0-100'
  },
  risk_level: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '风险等级：低/中/高'
  }
  // type: {
  //   type: DataTypes.ENUM('review', 'draft'), // 审查或起草
  //   allowNull: false,
  //   defaultValue: 'review',
  //   comment: '合同类型：review-审查上传的合同，draft-起草生成的合同'
  // }
}, {
  tableName: 'contracts',
  // timestamps: true,
  // createdAt: 'created_at',
  // updatedAt: false
});

module.exports = Contract; 