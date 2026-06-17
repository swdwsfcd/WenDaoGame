@echo off
chcp 65001 > nul
echo ================================================
echo   问道MMORPG - 正在启动...
echo ================================================
echo.

REM 检查node是否可用
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 启动服务器
echo [1/2] 正在启动游戏服务器...
start "问道MMORPG服务器" /min cmd /c "node server.js"

REM 等待服务器启动
echo [2/2] 等待服务器启动...
timeout /t 3 > nul

REM 打开游戏客户端
echo.
echo ================================================
echo   启动完成！游戏已在浏览器中打开
echo   后台管理: http://localhost:3000/admin.html
echo ================================================
echo.
start http://localhost:3000

echo 服务器正在后台运行中...
echo 关闭此窗口不会停止服务器。
echo 如需停止服务器，请关闭名为"问道MMORPG服务器"的窗口。
pause > nul
