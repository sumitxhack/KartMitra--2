@echo off
setlocal enabledelayedexpansion
title KartMitra Development Launcher

echo ====================================================================
echo           KartMitra + AI Verification Lab Development Launcher
echo ====================================================================
echo.

:: -------------------------------------------------------------------
:: 1. RESOLVE ABSOLUTE PATHS BASED ON SCRIPT LOCATION (%~dp0)
:: -------------------------------------------------------------------
set "ROOT_DIR=%~dp0"
:: Remove trailing backslash if present
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

:: Primary directory locations relative to %~dp0
set "AI_LAB_BACKEND=%ROOT_DIR%\KartMitra AI Verification Lab\backend"
set "AI_LAB_FRONTEND=%ROOT_DIR%\KartMitra AI Verification Lab\frontend"
set "KARTMITRA_BACKEND=%ROOT_DIR%\kartmitra\backend"
set "KARTMITRA_FRONTEND=%ROOT_DIR%\kartmitra\frontend\kartmitra.frontend"

:: Adaptive fallback in case launcher is placed inside kartmitra folder
if not exist "%AI_LAB_BACKEND%" (
    if exist "%ROOT_DIR%\..\KartMitra AI Verification Lab\backend" (
        set "AI_LAB_BACKEND=%ROOT_DIR%\..\KartMitra AI Verification Lab\backend"
        set "AI_LAB_FRONTEND=%ROOT_DIR%\..\KartMitra AI Verification Lab\frontend"
        set "KARTMITRA_BACKEND=%ROOT_DIR%\backend"
        set "KARTMITRA_FRONTEND=%ROOT_DIR%\frontend\kartmitra.frontend"
    )
)

:: -------------------------------------------------------------------
:: 2. VERIFY REQUIRED DIRECTORIES EXIST
:: -------------------------------------------------------------------
echo [*] Checking project directories...

set "DIR_ERROR=0"

if not exist "%AI_LAB_BACKEND%" (
    echo [ERROR] AI Verification Lab Backend directory not found:
    echo         "%AI_LAB_BACKEND%"
    set "DIR_ERROR=1"
) else (
    echo   [+] Found: AI Lab Backend
)

if not exist "%AI_LAB_FRONTEND%" (
    echo [ERROR] AI Verification Lab Frontend directory not found:
    echo         "%AI_LAB_FRONTEND%"
    set "DIR_ERROR=1"
) else (
    echo   [+] Found: AI Lab Frontend
)

if not exist "%KARTMITRA_BACKEND%" (
    echo [ERROR] KartMitra Backend directory not found:
    echo         "%KARTMITRA_BACKEND%"
    set "DIR_ERROR=1"
) else (
    echo   [+] Found: KartMitra Backend
)

if not exist "%KARTMITRA_FRONTEND%" (
    echo [ERROR] KartMitra Frontend directory not found:
    echo         "%KARTMITRA_FRONTEND%"
    set "DIR_ERROR=1"
) else (
    echo   [+] Found: KartMitra Frontend
)

if "!DIR_ERROR!"=="1" (
    echo.
    echo [CRITICAL ERROR] One or more required project directories are missing.
    echo Please ensure the project files are intact before running this launcher.
    echo.
    pause
    exit /b 1
)

echo.

:: -------------------------------------------------------------------
:: 3. CHECK REQUIRED RUNTIMES (Node.js, npm, Python)
:: -------------------------------------------------------------------
echo [*] Checking system runtimes...

set "RUNTIME_ERROR=0"

where node >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Node.js is not installed or not available in PATH.
    echo         Please install Node.js [v18 or higher recommended] from https://nodejs.org/
    set "RUNTIME_ERROR=1"
) else (
    for /f "tokens=*" %%v in ('node -v 2^>nul') do echo   [+] Node.js detected: %%v
)

where npm >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo [ERROR] npm is not installed or not available in PATH.
    echo         Please ensure npm is installed alongside Node.js.
    set "RUNTIME_ERROR=1"
) else (
    for /f "tokens=*" %%v in ('npm -v 2^>nul') do echo   [+] npm detected: v%%v
)

where python >nul 2>nul
if !ERRORLEVEL! neq 0 (
    if not exist "%AI_LAB_BACKEND%\.venv\Scripts\python.exe" (
        echo [ERROR] Python is not installed or not available in PATH.
        echo         Please install Python [3.10 to 3.13 recommended] from https://www.python.org/
        set "RUNTIME_ERROR=1"
    ) else (
        echo   [+] Python detected in AI Lab backend virtualenv
    )
) else (
    for /f "tokens=*" %%v in ('python --version 2^>nul') do echo   [+] Python detected: %%v
)

if "!RUNTIME_ERROR!"=="1" (
    echo.
    echo [CRITICAL ERROR] Required runtime dependencies are missing.
    echo Please install the missing runtimes and re-run START_ALL.bat.
    echo.
    pause
    exit /b 1
)

echo.

:: -------------------------------------------------------------------
:: 4. CHECK DEPENDENCIES (node_modules, virtual environment)
:: -------------------------------------------------------------------
echo [*] Checking package dependencies...

set "DEP_ERROR=0"

if not exist "%AI_LAB_BACKEND%\.venv" (
    echo.
    echo [ERROR] Missing virtual environment for AI Verification Lab Backend.
    echo To install dependencies, run:
    echo   cd "%AI_LAB_BACKEND%"
    echo   python -m venv .venv
    echo   .venv\Scripts\activate
    echo   pip install -r requirements.txt
    set "DEP_ERROR=1"
)

if not exist "%AI_LAB_FRONTEND%\node_modules" (
    echo.
    echo [ERROR] Missing node_modules for AI Verification Lab Frontend.
    echo To install dependencies, run:
    echo   cd "%AI_LAB_FRONTEND%"
    echo   npm install
    set "DEP_ERROR=1"
)

if not exist "%KARTMITRA_BACKEND%\node_modules" (
    echo.
    echo [ERROR] Missing node_modules for KartMitra Backend.
    echo To install dependencies, run:
    echo   cd "%KARTMITRA_BACKEND%"
    echo   npm install
    set "DEP_ERROR=1"
)

if not exist "%KARTMITRA_FRONTEND%\node_modules" (
    echo.
    echo [ERROR] Missing node_modules for KartMitra Frontend.
    echo To install dependencies, run:
    echo   cd "%KARTMITRA_FRONTEND%"
    echo   npm install
    set "DEP_ERROR=1"
)

if "!DEP_ERROR!"=="1" (
    echo.
    echo [NOTICE] Please install the missing dependencies shown above and restart.
    echo.
    pause
    exit /b 1
) else (
    echo   [+] All package dependencies and virtual environments are installed.
)

echo.

:: -------------------------------------------------------------------
:: 5. CHECK DATABASE REACHABILITY (PostgreSQL & MongoDB)
:: -------------------------------------------------------------------
echo [*] Checking database reachability...

:: Check PostgreSQL (port 5432)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t = [System.Net.Sockets.TcpClient]::new(); try { $iar = $t.BeginConnect('127.0.0.1', 5432, $null, $null); if ($iar.AsyncWaitHandle.WaitOne(1500)) { $t.EndConnect($iar); exit 0 } else { exit 1 } } catch { exit 1 } finally { $t.Dispose() }" >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo   [+] PostgreSQL is reachable on localhost:5432.
) else (
    echo   [WARN] PostgreSQL is NOT reachable on localhost:5432.
    echo          Please start PostgreSQL service.
    echo          [If using local portable PostgreSQL: run scripts\control_postgres.ps1 start]
)

:: Check MongoDB (port 27017 or Atlas cloud cluster)
set "MONGO_OK=0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t = [System.Net.Sockets.TcpClient]::new(); try { $iar = $t.BeginConnect('127.0.0.1', 27017, $null, $null); if ($iar.AsyncWaitHandle.WaitOne(1500)) { $t.EndConnect($iar); exit 0 } else { exit 1 } } catch { exit 1 } finally { $t.Dispose() }" >nul 2>nul
if !ERRORLEVEL! equ 0 set "MONGO_OK=1"

if "!MONGO_OK!"=="1" (
    echo   [+] MongoDB is reachable on localhost:27017.
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Resolve-DnsName -Name '_mongodb._tcp.kartmitra.ylw7u3w.mongodb.net' -Type SRV -ErrorAction Stop; if ($r) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        echo   [+] MongoDB is reachable via MongoDB Atlas cloud cluster.
    ) else (
        echo   [WARN] MongoDB is NOT reachable on localhost:27017 or Atlas cloud.
        echo          Please start MongoDB service.
    )
)

echo.

:: -------------------------------------------------------------------
:: 6. START APPLICATION SERVICES IN DEPENDENCY ORDER
:: -------------------------------------------------------------------
echo [*] Starting application services in separate windows...
echo.

:: Service 1: AI Verification Lab FastAPI Backend (port 8000)
echo   Starting [1] AI Verification Lab Backend [Port 8000]...
start "[1] AI Verification Lab Backend" /d "%AI_LAB_BACKEND%" cmd /k "if exist .venv\Scripts\activate.bat (call .venv\Scripts\activate.bat) & python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 2 /nobreak >nul 2>nul

:: Service 2: AI Verification Lab Next.js Frontend (port 3000)
echo   Starting [2] AI Verification Lab Frontend [Port 3000]...
start "[2] AI Verification Lab Frontend" /d "%AI_LAB_FRONTEND%" cmd /k npm run dev
timeout /t 2 /nobreak >nul 2>nul

:: Service 3: KartMitra Node.js/Express Backend (port 5000)
echo   Starting [3] KartMitra Backend [Port 5000]...
start "[3] KartMitra Backend" /d "%KARTMITRA_BACKEND%" cmd /k npm run dev
timeout /t 2 /nobreak >nul 2>nul

:: Service 4: KartMitra React/Vite Frontend (port 5173)
echo   Starting [4] KartMitra Frontend [Port 5173]...
start "[4] KartMitra Frontend" /d "%KARTMITRA_FRONTEND%" cmd /k npm run dev
timeout /t 1 /nobreak >nul 2>nul

echo.
echo ====================================================================
echo           KartMitra Development Services Successfully Launched
echo ====================================================================
echo.
echo Expected Service URLs:
echo   ------------------------------------------------------------------
echo   AI Lab Backend:         http://localhost:8000
echo   AI Lab Frontend:        http://localhost:3000
echo   KartMitra Backend:      http://localhost:5000
echo   KartMitra Frontend:     http://localhost:5173
echo   ------------------------------------------------------------------
echo   Admin Portal:           http://localhost:5173/admin
echo   Customer:               http://localhost:5173/
echo   ------------------------------------------------------------------
echo.
echo Terminal Windows:
echo   [1] AI Verification Lab Backend
echo   [2] AI Verification Lab Frontend
echo   [3] KartMitra Backend
echo   [4] KartMitra Frontend
echo.
echo To shut down all services cleanly without affecting other programs:
echo   Double-click STOP_ALL.bat
echo ====================================================================
echo.
pause
