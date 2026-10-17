// 数据库迁移脚本：为 contracts 表新增功能列（可重复执行）
// 新增列：contract_type / expiry_date / risk_score / risk_level
const { sequelize } = require('../config/db');

// 待新增的列定义：columnName -> SQL 定义
const NEW_COLUMNS = [
  {
    name: 'contract_type',
    sql: "ALTER TABLE contracts ADD COLUMN contract_type VARCHAR(50) NOT NULL DEFAULT 'draft' COMMENT '合同类型：draft-起草，review-审查'"
  },
  {
    name: 'expiry_date',
    sql: "ALTER TABLE contracts ADD COLUMN expiry_date DATE NULL COMMENT '合同到期日期'"
  },
  {
    name: 'risk_score',
    sql: "ALTER TABLE contracts ADD COLUMN risk_score INT NULL COMMENT '风险评分 0-100'"
  },
  {
    name: 'risk_level',
    sql: "ALTER TABLE contracts ADD COLUMN risk_level VARCHAR(20) NULL COMMENT '风险等级：低/中/高'"
  }
];

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功，开始迁移...');

    // 查询 contracts 表现有列
    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contracts'
    `);
    const existing = columns.map(c => c.COLUMN_NAME);
    console.log('现有列:', existing.join(', '));

    for (const col of NEW_COLUMNS) {
      if (existing.includes(col.name)) {
        console.log(`列 ${col.name} 已存在，跳过`);
      } else {
        await sequelize.query(col.sql);
        console.log(`列 ${col.name} 新增成功`);
      }
    }

    // 将已有记录的 contract_type 按 file_path 是否有值做一个合理初始化：
    // 有实际文件路径的为审查上传(review)，无路径的为起草(draft)
    await sequelize.query(`
      UPDATE contracts SET contract_type = 'review'
      WHERE contract_type = 'draft' AND file_path IS NOT NULL AND file_path != ''
    `);
    console.log('历史数据 contract_type 初始化完成');

    console.log('迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  }
}

migrate();
