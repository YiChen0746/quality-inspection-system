/**
 * 聊天会话与消息表迁移脚本
 * 用法：node utils/migrate-chat-session.js
 * 
 * 创建表：
 *   - chat_sessions：聊天会话
 *   - chat_messages：聊天消息
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Root@123456',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'quality_inspection',
  multipleStatements: true
};

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    // 1. 创建 chat_sessions 表
    const createSessionsSql = `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '会话ID',
        user_id INT NOT NULL COMMENT '用户ID',
        title VARCHAR(200) NOT NULL DEFAULT '新会话' COMMENT '会话标题',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
        INDEX idx_user_id (user_id),
        INDEX idx_updated_at (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天会话表';
    `;
    await connection.execute(createSessionsSql);
    console.log('✓ chat_sessions 表已创建/已存在');

    // 2. 创建 chat_messages 表
    const createMessagesSql = `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '消息ID',
        session_id INT NOT NULL COMMENT '会话ID',
        user_id INT NOT NULL COMMENT '用户ID',
        role ENUM('user', 'assistant') NOT NULL COMMENT '消息角色',
        content LONGTEXT NOT NULL COMMENT '消息内容',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        INDEX idx_session_id (session_id),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天消息表';
    `;
    await connection.execute(createMessagesSql);
    console.log('✓ chat_messages 表已创建/已存在');

    console.log('\n✅ 迁移完成！');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();
