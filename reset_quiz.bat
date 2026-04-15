@echo off
title Quiz System - Reset
echo ========================================
echo   Reset ALL data? This cannot be undone!
echo ========================================
pause

echo Stopping server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":3000"') do (
    taskkill /F /PID %%a 2>nul
)
timeout /t 2 >nul

echo Deleting database...
del /f "%~dp0oracle.db" 2>nul
del /f "%~dp0oracle.db-wal" 2>nul
del /f "%~dp0oracle.db-shm" 2>nul

echo Starting server with fresh data...
cd /d "%~dp0"
start /b cmd /c "node server.js > server.log 2>&1"
timeout /t 2 >nul

netstat -ano | findstr "LISTENING" | findstr ":3000" >nul 2>&1
if %errorlevel%==0 (
    echo.
    echo Reset OK! Server running at http://localhost:3000
) else (
    echo Reset failed! Check server.log
)
pause
