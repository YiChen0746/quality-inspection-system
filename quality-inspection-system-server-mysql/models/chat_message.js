const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// 聊天消息模型
const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '消息ID'
  },
  session_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '会话ID'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '用户ID'
  },
  role: {
    type: DataTypes.ENUM('user', 'assistant'),
    allowNull: false,
    comment: '消息角色：user-用户，assistant-AI助手'
  },
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
    comment: '消息内容'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  }
}, {
  tableName: 'chat_messages',
  timestamps: false,
  indexes: [
    {
      fields: ['session_id']
    },
    {
      fields: ['user_id']
    }
  ]
});

module.exports = ChatMessage;
