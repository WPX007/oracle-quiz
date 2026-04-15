@echo off
title Quiz System
echo ========================================
echo   Honor of Kings Quiz - Starting...
echo ========================================
cd /d "%~dp0"

netstat -ano | findstr "LISTENING" | findstr ":3000" >nul 2>&1
if %errorlevel%==0 (
    echo Already running!
    echo Visit http://localhost:3000
    pause
    exit /b
)

start /b cmd /c "node server.js > server.log 2>&1"
timeout /t 2 >nul
netstat -ano | findstr "LISTENING" | findstr ":3000" >nul 2>&1
if %errorlevel%==0 (
    echo Started OK!
    echo Visit http://localhost:3000
    echo Log: %~dp0server.log
    echo.
    echo Close this window - service keeps running.
    echo To stop: run stop_quiz.bat
) else (
    echo Start failed! Check server.log
)
pause
