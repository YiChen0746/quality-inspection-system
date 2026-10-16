const path = require('path');
const { Sequelize } = require('sequelize');

// 加载 .env 文件（若不存在则忽略，直接使用下面的默认值）
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 数据库配置：优先读取环境变量，未配置时回退到本机开发默认值
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Root@123456',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'quality_inspection'
};

// 创建Sequelize实例
const sequelize = new Sequelize(
  dbConfig.database, 
  dbConfig.user, 
  dbConfig.password, 
  {
    host: dbConfig.host,
    dialect: 'mysql',
    port: dbConfig.port,
    timezone: '+08:00', // 设置时区为北京时间
    define: {
      // 不自动添加时间戳字段 (updatedAt, createdAt)
      timestamps: true,
      // 禁止自动将表名变为复数
      freezeTableName: true,
      // 使用下划线命名法
      underscored: true
    },
    // 日志输出
    logging: console.log
  }
);

// 测试数据库连接
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功。');
  } catch (error) {
    console.error('数据库连接失败:', error);
  }
};

module.exports = {
  sequelize,
  testConnection,
  dbConfig
}; 