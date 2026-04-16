@echo off
title Quiz System - Reset
echo ========================================
echo   Reset ALL data? This cannot be undone!
echo ========================================
pause

echo Stopping ALL server processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":3000"') do (
    echo   Killing PID %%a
    taskkill /F /PID %%a 2>nul
)
timeout /t 3 >nul

echo Deleting database...
cd /d "%~dp0"
del /f /q oracle.db 2>nul
del /f /q oracle.db-wal 2>nul
del /f /q oracle.db-shm 2>nul

if exist oracle.db (
    echo ERROR: Database still locked! Close DB Browser and try again.
    pause
    exit /b
)

echo Starting server with fresh data...
start /b cmd /c "node server.js > server.log 2>&1"
timeout /t 3 >nul

netstat -ano | findstr "LISTENING" | findstr ":3000" >nul 2>&1
if %errorlevel%==0 (
    echo.
    echo Reset OK! All data cleared.
    echo Visit http://localhost:3000
) else (
    echo Start failed! Check server.log
)
pause
