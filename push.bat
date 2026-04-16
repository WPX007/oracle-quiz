@echo off
chcp 65001 >nul
title Git 同步推送
echo ========================================
echo   Git 同步到 GitHub
echo ========================================
cd /d "%~dp0"

set "GIT=C:\Program Files\Git\cmd\git.exe"

echo.
echo [1/3] 检查变更...
"%GIT%" status -s

echo.
echo [2/3] 提交代码...
"%GIT%" add -A
"%GIT%" commit -m "update: %date% %time%"

echo.
echo [3/3] 推送到 GitHub...
"%GIT%" push origin main

echo.
echo ========================================
echo   同步完成！
echo ========================================
pause
