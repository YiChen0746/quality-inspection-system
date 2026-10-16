// 合同质检系统 —— pm2 进程配置
//
// 使用方法（在服务器上）：
//   cd /var/www/quality-inspection/server
//   pm2 start ../ecosystem.config.js
//   pm2 save          # 保存当前进程列表
//   pm2 startup       # 按提示执行输出的命令，实现开机自启
//
// 敏感配置（数据库密码、SMTP、第三方 Key）不要写在这里，
// 统一写在该目录下的 .env 文件里，由后端通过 dotenv 读取。
module.exports = {
  apps: [
    {
      name: 'quality-inspection-server',
      script: 'app.js',
      cwd: '/var/www/quality-inspection/server', // 后端代码所在目录
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,          // 进程异常退出时自动重启
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      out_file: '/var/log/quality-inspection/out.log',
      error_file: '/var/log/quality-inspection/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
