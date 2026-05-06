@echo off
REM CryptoWatch Dashboard - Start Script
REM This will kill any existing Node processes and start both servers

echo ==========================================
echo   CryptoWatch Dashboard Startup
echo ==========================================
echo.

REM Kill existing Node processes
echo Terminating existing processes...
taskkill /F /IM node.exe >nul 2>&1

REM Wait for ports to be freed
timeout /t 2 /nobreak

REM Start both servers
echo.
echo Starting servers...
echo.

cd /d "%~dp0"
node start-all.js

pause
