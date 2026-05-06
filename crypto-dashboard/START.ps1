# CryptoWatch Dashboard - PowerShell Startup Script

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   CryptoWatch Dashboard Startup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Kill existing Node processes
Write-Host "⏹️  Terminating existing processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait for ports to be freed
Start-Sleep -Seconds 2

# Start both servers
Write-Host ""
Write-Host "🚀 Starting servers..." -ForegroundColor Green
Write-Host ""

$scriptRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
Set-Location $scriptRoot
node start-all.js
