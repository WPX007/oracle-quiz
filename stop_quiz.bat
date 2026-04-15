@echo off
title Quiz System - Stop
echo ========================================
echo   Stopping Quiz System...
echo ========================================
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":3000"') do (
    echo Found PID: %%a
    taskkill /F /PID %%a 2>nul
)
echo Stopped!
pause
