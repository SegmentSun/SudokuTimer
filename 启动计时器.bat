@echo off
chcp 65001 >nul
title 数独比赛计时器
echo ========================================
echo    数独比赛计时器
echo ========================================
echo.
echo 正在启动服务器...
echo 请在浏览器中打开: http://localhost:8080
echo 按 Ctrl+C 可停止服务器
echo.
python -m http.server 8080
pause
