@echo off
REM ============================================
REM  合同文书智能审核系统 - 本地开发环境一键启动
REM  前提：MySQL 已运行（可在小皮面板启动）
REM  用法：双击本文件即可；关闭对应黑窗口即停止服务
REM ============================================

REM 启动后端（端口 3000）
cd /d E:\BaiduNetdiskDownload\daiz-master\quality-inspection-system-server-mysql
start "QIS-Backend-3000" /min cmd /k "npm.cmd start"

REM 启动前端（端口 5173）
cd /d E:\BaiduNetdiskDownload\daiz-master\quality-inspection-system-fe
start "QIS-Frontend-5173" /min cmd /k "npm.cmd run dev"

echo.
echo 后端: http://localhost:3000
echo 前端: http://localhost:5173
echo 两个服务已在最小化窗口中运行，关闭窗口即停止。
timeout /t 5 >nul
