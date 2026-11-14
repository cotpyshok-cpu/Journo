@echo off
setlocal
cd /d "%~dp0"
title Journo - Local Launcher

echo ==================================================
echo   Journo - Smart Daily Route ^& Schedule Planner
echo ==================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found in PATH.
    echo Please install Node.js LTS from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/3] Installing dependencies ^(npm install^)...
    call npm.cmd install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
) else (
    echo [1/3] Dependencies found in node_modules.
)

echo [2/3] Checking .env and SQLite database ^(scripts/setup-db.mjs^)...
node scripts/setup-db.mjs
if errorlevel 1 (
    echo [ERROR] Database initialization failed.
    pause
    exit /b 1
)

echo [3/3] Starting Journo server at http://localhost:3000 ...
echo Keep this window open while using the app. Press Ctrl+C to stop.
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
call npm.cmd run dev
if errorlevel 1 (
    echo.
    echo [ERROR] Dev server exited unexpectedly.
    pause
    exit /b 1
)
