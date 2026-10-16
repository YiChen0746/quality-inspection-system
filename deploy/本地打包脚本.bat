@echo off
chcp 65001 >nul
setlocal

REM =====================================================
REM  合同质检系统 —— 本地打包脚本
REM  作用：在本机构建前端、并把前后端分别压成可上传服务器的 zip
REM  产物：deploy\release\fe-dist.zip、server.zip、nginx.conf、
REM        ecosystem.config.js、部署文档.md
REM =====================================================

set "DEPLOY=%~dp0"
set "FE=D:\daiz-master\quality-inspection-system-fe"
set "BE=D:\daiz-master\quality-inspection-system-server-mysql"
set "OUT=%DEPLOY%release"

echo =====================================================
echo  合同质检系统 —— 本地打包
echo =====================================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  REM 全局 PATH 里没有 npm 时，尝试使用本机已知的 Node 目录
  if exist "C:\Program Files\Lenovo\AIAgent\mcp\node-v22.16.0-win-x64\npm.cmd" (
    set "PATH=C:\Program Files\Lenovo\AIAgent\mcp\node-v22.16.0-win-x64;%PATH%"
  ) else (
    echo [错误] 当前环境找不到 npm。
    echo        请确认 Node.js 已安装，并把 node 所在目录加入系统 PATH。
    pause
    exit /b 1
  )
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [错误] 仍找不到 npm，请确认 Node.js 已正确安装。
  pause
  exit /b 1
)

echo [1/4] 构建前端（vite build，跳过类型检查）...
pushd "%FE%"
call npm run build-only
if errorlevel 1 (
  echo [错误] 前端构建失败，已中止。
  popd
  pause
  exit /b 1
)
popd
echo.

if not exist "%OUT%" mkdir "%OUT%"

echo [2/4] 打包前端产物 dist ...
if exist "%OUT%\fe-dist.zip" del /q "%OUT%\fe-dist.zip"
tar -a -c -f "%OUT%\fe-dist.zip" -C "%FE%\dist" .
if errorlevel 1 (
  echo [错误] 前端打包失败。
  pause
  exit /b 1
)
echo.

echo [3/4] 打包后端代码（排除 node_modules / .env / 上传目录）...
if exist "%OUT%\server.zip" del /q "%OUT%\server.zip"
tar -a -c -f "%OUT%\server.zip" --exclude=node_modules --exclude=.env --exclude=public/uploads --exclude=.git -C "%BE%" .
if errorlevel 1 (
  echo [错误] 后端打包失败。
  pause
  exit /b 1
)
echo.

echo [4/4] 复制部署配置...
copy /y "%DEPLOY%nginx.conf" "%OUT%\" >nul
copy /y "%DEPLOY%ecosystem.config.js" "%OUT%\" >nul
copy /y "%DEPLOY%部署文档.md" "%OUT%\" >nul

echo.
echo =====================================================
echo  完成！产物目录：%OUT%
echo.
echo    fe-dist.zip           解压到 /var/www/quality-inspection/dist
echo    server.zip            解压到 /var/www/quality-inspection/server
echo    nginx.conf            放到 /etc/nginx/sites-available/quality-inspection
echo    ecosystem.config.js   放到 /var/www/quality-inspection/
echo    部署文档.md            照着它一步步执行即可
echo =====================================================
pause
