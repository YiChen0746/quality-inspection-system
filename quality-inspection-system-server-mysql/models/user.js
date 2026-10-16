const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// 用户模型
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '用户ID'
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '用户邮箱'
  },
  nickname: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '用户昵称'
  },
  password: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '用户密码'
  },
  avatar: {
    type: DataTypes.STRING(200),
    defaultValue: '/public/img/avatar-default.png',
    comment: '用户头像'
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已验证邮箱'
  }
}, {
  tableName: 'users'
});

module.exports = User; 