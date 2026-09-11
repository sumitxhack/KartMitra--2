@echo off
setlocal enabledelayedexpansion
title Stop KartMitra Mobile LAN Services

echo ====================================================================
echo        KartMitra Mobile LAN Services Shutdown (Ports Only)
echo ====================================================================
echo.
echo Stopping development servers on ports: 8000, 3000, 5000, 5173...
echo NOTE: PostgreSQL and MongoDB databases are left completely untouched.
echo.

:: -------------------------------------------------------------------
:: 1. TERMINATE ONLY PROCESSES LISTENING ON DEVELOPMENT PORTS
:: -------------------------------------------------------------------

:: [1] AI Lab Backend (Port 8000)
set "PORT_8000_FOUND=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    if not "%%p"=="" (
        set "PORT_8000_FOUND=1"
        echo   [-] Terminating AI Lab Backend on port 8000 [PID: %%p]...
        taskkill /f /t /pid %%p >nul 2>&1
    )
)
if "!PORT_8000_FOUND!"=="0" (
    echo   [i] AI Lab Backend [Port 8000] was not running.
) else (
    echo   [+] AI Lab Backend [Port 8000] stopped.
)

:: [2] AI Lab Frontend (Port 3000)
set "PORT_3000_FOUND=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    if not "%%p"=="" (
        set "PORT_3000_FOUND=1"
        echo   [-] Terminating AI Lab Frontend on port 3000 [PID: %%p]...
        taskkill /f /t /pid %%p >nul 2>&1
    )
)
if "!PORT_3000_FOUND!"=="0" (
    echo   [i] AI Lab Frontend [Port 3000] was not running.
) else (
    echo   [+] AI Lab Frontend [Port 3000] stopped.
)

:: [3] KartMitra Backend (Port 5000)
set "PORT_5000_FOUND=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    if not "%%p"=="" (
        set "PORT_5000_FOUND=1"
        echo   [-] Terminating KartMitra Backend on port 5000 [PID: %%p]...
        taskkill /f /t /pid %%p >nul 2>&1
    )
)
if "!PORT_5000_FOUND!"=="0" (
    echo   [i] KartMitra Backend [Port 5000] was not running.
) else (
    echo   [+] KartMitra Backend [Port 5000] stopped.
)

:: [4] KartMitra Frontend (Port 5173)
set "PORT_5173_FOUND=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    if not "%%p"=="" (
        set "PORT_5173_FOUND=1"
        echo   [-] Terminating KartMitra Frontend on port 5173 [PID: %%p]...
        taskkill /f /t /pid %%p >nul 2>&1
    )
)
if "!PORT_5173_FOUND!"=="0" (
    echo   [i] KartMitra Frontend [Port 5173] was not running.
) else (
    echo   [+] KartMitra Frontend [Port 5173] stopped.
)

echo.

:: -------------------------------------------------------------------
:: 2. CLOSE DEV TERMINAL WINDOWS BY EXACT TITLE (IF STILL OPEN)
:: -------------------------------------------------------------------
taskkill /f /fi "WINDOWTITLE eq [1] AI Verification Lab Backend*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq [2] AI Verification Lab Frontend*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq [3] KartMitra Backend*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq [4] KartMitra Frontend*" >nul 2>&1

echo ====================================================================
echo        All KartMitra Development Services Stopped Cleanly!
echo ====================================================================
echo.
pause
