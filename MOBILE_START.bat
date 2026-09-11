@echo off
setlocal enabledelayedexpansion
title KartMitra Mobile LAN Launcher

echo ====================================================================
echo      KartMitra Mobile LAN Development Environment Launcher
echo ====================================================================
echo.

:: -------------------------------------------------------------------
:: 1. RESOLVE ABSOLUTE PATHS BASED ON SCRIPT LOCATION (%~dp0)
:: -------------------------------------------------------------------
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

set "AI_LAB_BACKEND=%ROOT_DIR%\KartMitra AI Verification Lab\backend"
set "AI_LAB_FRONTEND=%ROOT_DIR%\KartMitra AI Verification Lab\frontend"
set "KARTMITRA_BACKEND=%ROOT_DIR%\kartmitra\backend"
set "KARTMITRA_FRONTEND=%ROOT_DIR%\kartmitra\frontend\kartmitra.frontend"

:: Adaptive fallback if launcher is placed inside kartmitra folder
if not exist "%AI_LAB_BACKEND%" (
    if exist "%ROOT_DIR%\..\KartMitra AI Verification Lab\backend" (
        set "AI_LAB_BACKEND=%ROOT_DIR%\..\KartMitra AI Verification Lab\backend"
        set "AI_LAB_FRONTEND=%ROOT_DIR%\..\KartMitra AI Verification Lab\frontend"
        set "KARTMITRA_BACKEND=%ROOT_DIR%\backend"
        set "KARTMITRA_FRONTEND=%ROOT_DIR%\frontend\kartmitra.frontend"
    )
)

:: -------------------------------------------------------------------
:: 2. VERIFY REQUIRED PROJECT DIRECTORIES EXIST
:: -------------------------------------------------------------------
echo [*] Checking project directories...
set "DIR_ERROR=0"

if not exist "%AI_LAB_BACKEND%" (
    echo [ERROR] AI Lab Backend not found at: "%AI_LAB_BACKEND%"
    set "DIR_ERROR=1"
) else (
    echo   [+] Found: AI Lab Backend
)

if not exist "%AI_LAB_FRONTEND%" (
    echo [ERROR] AI Lab Frontend not found at: "%AI_LAB_FRONTEND%"
    set "DIR_ERROR=1"
) else (
    echo   [+] Found: AI Lab Frontend
)

if not exist "%KARTMITRA_BACKEND%" (
    echo [ERROR] KartMitra Backend not found at: "%KARTMITRA_BACKEND%"
    set "DIR_ERROR=1"
) else (
    echo   [+] Found: KartMitra Backend
)

if not exist "%KARTMITRA_FRONTEND%" (
    echo [ERROR] KartMitra Frontend not found at: "%KARTMITRA_FRONTEND%"
    set "DIR_ERROR=1"
) else (
    echo   [+] Found: KartMitra Frontend
)

if "!DIR_ERROR!"=="1" (
    echo.
    echo [CRITICAL ERROR] One or more required project directories are missing.
    pause
    exit /b 1
)

echo.

:: -------------------------------------------------------------------
:: 3. AUTOMATICALLY DETECT ACTIVE PC LAN IPv4 ADDRESS
:: -------------------------------------------------------------------
echo [*] Detecting PC LAN IPv4 address...

set "DETECTED_IP="
for /f "tokens=*" %%a in ('node -e "const os=require(''os'');const nets=os.networkInterfaces();const list=[];for(const n of Object.keys(nets)){const isV=/vEthernet|VirtualBox|VMware|WSL|Loopback/i.test(n);for(const net of nets[n]){if(net.family===''IPv4''&&!net.internal&&!net.address.startsWith(''169.254.'')){list.push({name:n,address:net.address,isV});}}}list.sort((a,b)=>(a.isV?1:0)-(b.isV?1:0));console.log(list[0]?list[0].address:''127.0.0.1'');" 2^>nul') do (
    set "DETECTED_IP=%%a"
)

if "%DETECTED_IP%"=="" set "DETECTED_IP=127.0.0.1"

echo   [+] Active LAN IPv4 Address: %DETECTED_IP%
echo.

:: -------------------------------------------------------------------
:: 4. SYNC ENVIRONMENT CONFIGS WITH DETECTED LAN IP
:: -------------------------------------------------------------------
echo [*] Updating environment files for mobile LAN connectivity...

:: 4A. Update AI Lab Frontend .env.local
(
    echo NEXT_PUBLIC_AI_API_URL=http://%DETECTED_IP%:8000
) > "%AI_LAB_FRONTEND%\.env.local"
echo   [+] Configured AI Lab Frontend: %AI_LAB_FRONTEND%\.env.local

:: 4B. Update KartMitra Frontend .env
(
    echo VITE_API_URL=http://%DETECTED_IP%:5000/api
    echo VITE_GOOGLE_CLIENT_ID=290139272609-0u8i1c2uun67thc6vlemomct4k5q02ja.apps.googleusercontent.com
    echo VITE_AI_LAB_FRONTEND_URL=http://%DETECTED_IP%:3000
) > "%KARTMITRA_FRONTEND%\.env"
echo   [+] Configured KartMitra Frontend: %KARTMITRA_FRONTEND%\.env

:: 4C. Ensure KartMitra Backend .env retains server-to-server AI_VERIFICATION_URL
findstr /i "AI_VERIFICATION_URL" "%KARTMITRA_BACKEND%\.env" >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo AI_VERIFICATION_URL=http://localhost:8000>> "%KARTMITRA_BACKEND%\.env"
)
echo   [+] Verified KartMitra Backend: %KARTMITRA_BACKEND%\.env

echo.

:: -------------------------------------------------------------------
:: 5. START APPLICATION SERVICES BOUND TO ALL INTERFACES (0.0.0.0)
:: -------------------------------------------------------------------
echo [*] Launching 4 application servers in separate windows...
echo.

:: Service 1: AI Lab FastAPI Backend (port 8000)
echo   Starting [1] AI Verification Lab Backend [Port 8000, 0.0.0.0]...
start "[1] AI Verification Lab Backend" /d "%AI_LAB_BACKEND%" cmd /k "if exist .venv\Scripts\activate.bat (call .venv\Scripts\activate.bat) & python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 2 /nobreak >nul 2>nul

:: Service 2: AI Lab Next.js Frontend (port 3000)
echo   Starting [2] AI Verification Lab Frontend [Port 3000, 0.0.0.0]...
start "[2] AI Verification Lab Frontend" /d "%AI_LAB_FRONTEND%" cmd /k npm run dev -- -H 0.0.0.0
timeout /t 2 /nobreak >nul 2>nul

:: Service 3: KartMitra Express Backend (port 5000)
echo   Starting [3] KartMitra Backend [Port 5000, 0.0.0.0]...
start "[3] KartMitra Backend" /d "%KARTMITRA_BACKEND%" cmd /k npm run dev
timeout /t 2 /nobreak >nul 2>nul

:: Service 4: KartMitra React/Vite Frontend (port 5173)
echo   Starting [4] KartMitra Frontend [Port 5173, 0.0.0.0]...
start "[4] KartMitra Frontend" /d "%KARTMITRA_FRONTEND%" cmd /k npm run dev -- --host 0.0.0.0
timeout /t 2 /nobreak >nul 2>nul

echo.
echo ==================================================
echo   KartMitra Mobile LAN Development Environment
echo ==================================================
echo.
echo   PC LAN IP: %DETECTED_IP%
echo.
echo   CUSTOMER:
echo   http://%DETECTED_IP%:5173/
echo.
echo   KARTMITRA BACKEND:
echo   http://%DETECTED_IP%:5000
echo.
echo   AI LAB:
echo   http://%DETECTED_IP%:3000
echo.
echo   AI LAB API:
echo   http://%DETECTED_IP%:8000
echo.
echo   ADMIN:
echo   http://%DETECTED_IP%:5173/admin
echo.
echo ==================================================
echo.
echo IMPORTANT:
echo 1. Mobile phone and PC must be connected to the same Wi-Fi/network.
echo 2. Open http://%DETECTED_IP%:5173/ in your mobile browser.
echo.
echo If mobile cannot connect, allow Windows Firewall access for:
echo   - Node.js
echo   - Python
echo or allow incoming TCP ports:
echo   - 3000, 5000, 5173, 8000
echo.
echo NOTE: Modern mobile browsers require HTTPS for camera/getUserMedia access.
echo If camera permission is blocked on HTTP, see MOBILE_RUN.md for setup.
echo.
echo To cleanly stop all services:
echo   Run MOBILE_STOP.bat
echo ==================================================
echo.
pause
