const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// 聊天会话模型
const ChatSession = sequelize.define('ChatSession', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '会话ID'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '用户ID'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    defaultValue: '新会话',
    comment: '会话标题'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '最后更新时间'
  }
}, {
  tableName: 'chat_sessions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ChatSession;
