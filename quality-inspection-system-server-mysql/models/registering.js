const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// 邮箱验证模型
const Registering = sequelize.define('Registering', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '验证记录ID'
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '用户邮箱'
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: '验证码'
  },
  expire_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '过期时间'
  },
  type: {
    type: DataTypes.STRING(20),
    defaultValue: 'register',
    comment: '验证类型：register-注册，reset-重置密码'
  }
}, {
  tableName: 'registering'
});

module.exports = Registering; 