const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');
const md5 = require('blueimp-md5');
const path = require('path');
const fs = require('fs');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '070404',
  port: 3306,
  database: 'quality_inspection'
};

// 创建数据库的函数
async function createDatabase() {
  try {
    // 创建不带数据库名的连接
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port
    });

    console.log('连接MySQL服务器成功');

    // 检查数据库是否存在
    const [rows] = await connection.execute(`SHOW DATABASES LIKE '${dbConfig.database}'`);
    
    if (rows.length === 0) {
      // 创建数据库
      await connection.execute(`CREATE DATABASE ${dbConfig.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`数据库 ${dbConfig.database} 创建成功`);
    } else {
      console.log(`数据库 ${dbConfig.database} 已存在`);
    }

    // 关闭连接
    await connection.end();
    return true;
  } catch (error) {
    console.error('创建数据库失败:', error);
    return false;
  }
}

// 创建Sequelize实例
const createSequelizeInstance = () => {
  return new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
    host: dbConfig.host,
    dialect: 'mysql',
    port: dbConfig.port,
    timezone: '+08:00',
    define: {
      timestamps: true,
      freezeTableName: true,
      underscored: true
    },
    logging: false
  });
};

// 初始化数据库表和默认数据
async function initTables() {
  const sequelize = createSequelizeInstance();

  try {
    // 测试连接
    await sequelize.authenticate();
    console.log('数据库连接成功');

    // 定义模型
    // 用户模型
    const User = sequelize.define('User', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '用户ID'
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: '用户邮箱'
      },
      nickname: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: '用户昵称'
      },
      password: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: '用户密码'
      },
      avatar: {
        type: Sequelize.STRING(200),
        defaultValue: '/public/img/avatar-default.png',
        comment: '用户头像'
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: '是否已验证邮箱'
      }
    }, {
      tableName: 'users'
    });

    // 邮箱验证模型
    const Registering = sequelize.define('Registering', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '验证记录ID'
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: '用户邮箱'
      },
      code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: '验证码'
      },
      expire_time: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: '过期时间'
      },
      type: {
        type: Sequelize.STRING(20),
        defaultValue: 'register',
        comment: '验证类型：register-注册，reset-重置密码'
      }
    }, {
      tableName: 'registering'
    });

    // 合同模型
    const Contract = sequelize.define('Contract', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '合同ID'
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: '文件名'
      },
      file_path: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: '文件路径'
      },
      file_size: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '文件大小(字节)'
      },
      content: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: '合同内容'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '上传用户ID'
      }
    }, {
      tableName: 'contracts'
    });

    // 质量检查结果模型
    const QualityResult = sequelize.define('QualityResult', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '检查结果ID'
      },
      contract_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '关联合同ID'
      },
      hospital: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: '医院名称'
      },
      analysis_position: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: '分析立场'
      },
      contract_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: '合同名称'
      },
      contract_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: '合同类型'
      },
      effective_date: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: '生效日期'
      },
      termination_date: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: '终止日期'
      },
      jurisdiction: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: '管辖权'
      },
      parties_involved: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '涉及主体'
      },
      contract_summary: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '合同摘要'
      },
      risk_clauses: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: '风险条款解读'
      },
      core_clauses: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: '核心条款解读'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '用户ID'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        comment: '创建时间'
      }
    }, {
      tableName: 'quality_results'
    });

    // 设置模型关联关系
    User.hasMany(Contract, { foreignKey: 'user_id' });
    Contract.belongsTo(User, { foreignKey: 'user_id' });

    User.hasMany(QualityResult, { foreignKey: 'user_id' });
    QualityResult.belongsTo(User, { foreignKey: 'user_id' });

    Contract.hasMany(QualityResult, { foreignKey: 'contract_id' });
    QualityResult.belongsTo(Contract, { foreignKey: 'contract_id' });

    // 同步所有模型到数据库
    await sequelize.sync({ force: true });
    console.log('数据库表结构已创建');

    // 创建默认管理员用户
    await User.create({
      email: 'admin@example.com',
      nickname: '管理员',
      password: md5('admin123'), // 密码加密存储
      is_verified: true
    });
    console.log('默认管理员用户已创建');

    // 创建上传目录
    const uploadDir = path.join(__dirname, '../public/uploads/userfile');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('上传目录已创建');
    }

    console.log('数据库初始化完成');
    return true;
  } catch (error) {
    console.error('初始化数据库表失败:', error);
    return false;
  } finally {
    // 关闭数据库连接
    await sequelize.close();
  }
}

// 主函数
async function main() {
  console.log('开始初始化数据库...');
  
  // 步骤1: 创建数据库
  const dbCreated = await createDatabase();
  if (!dbCreated) {
    console.error('数据库创建失败，初始化过程终止');
    return;
  }
  
  // 步骤2: 创建表和初始数据
  const tablesInitialized = await initTables();
  if (!tablesInitialized) {
    console.error('数据库表初始化失败');
    return;
  }
  
  console.log('数据库初始化成功完成！');
  console.log('默认管理员账号: admin@example.com');
  console.log('默认管理员密码: admin123');
}

// 执行主函数
main().catch(error => {
  console.error('初始化过程中发生错误:', error);
  process.exit(1);
}); 