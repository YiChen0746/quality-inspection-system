const { Sequelize } = require('sequelize');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '070404',
  port: 3306,
  database: 'quality_inspection'
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