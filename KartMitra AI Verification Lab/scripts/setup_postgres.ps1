$pgDir = "C:\Users\HP\postgresql-16.3"
$zipPath = "C:\Users\HP\postgresql-16.3-binaries.zip"
$dataDir = "$pgDir\data"
$logPath = "$pgDir\pg.log"
$binDir = "$pgDir\bin"

# 1. Download and Extract if not exists
if (-not (Test-Path $pgDir)) {
    Write-Host "PostgreSQL directory not found at $pgDir. Downloading binaries..." -ForegroundColor Cyan
    # Download
    curl.exe -L -o $zipPath "https://get.enterprisedb.com/postgresql/postgresql-16.3-1-windows-x64-binaries.zip"
    
    Write-Host "Extracting binaries..." -ForegroundColor Cyan
    # Extract
    Expand-Archive -Path $zipPath -DestinationPath "C:\Users\HP" -Force
    
    # Rename pgsql folder to postgresql-16.3
    Rename-Item -Path "C:\Users\HP\pgsql" -NewName "postgresql-16.3"
    
    # Clean up zip
    Remove-Item $zipPath
    Write-Host "PostgreSQL binaries extracted successfully to $pgDir." -ForegroundColor Green
} else {
    Write-Host "PostgreSQL binaries already exist at $pgDir. Skipping download." -ForegroundColor Green
}

# 2. Initialize database cluster if not initialized
if (-not (Test-Path "$dataDir\PG_VERSION")) {
    Write-Host "Initializing PostgreSQL database cluster..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    & "$binDir\initdb.exe" -D $dataDir -U postgres -A trust
    Write-Host "PostgreSQL database cluster initialized." -ForegroundColor Green
} else {
    Write-Host "PostgreSQL database cluster already initialized." -ForegroundColor Green
}

# 3. Start PostgreSQL Server
# Check if Postgres is already running by checking ports or calling pg_ctl status
$isRunning = $false
try {
    $statusOut = & "$binDir\pg_ctl.exe" status -D $dataDir 2>$null
    if ($LASTEXITCODE -eq 0) {
        $isRunning = $true
    }
} catch {
    $isRunning = $false
}

if (-not $isRunning) {
    Write-Host "Starting PostgreSQL server..." -ForegroundColor Cyan
    & "$binDir\pg_ctl.exe" -D $dataDir -l $logPath start
    Start-Sleep -Seconds 3
    Write-Host "PostgreSQL server started." -ForegroundColor Green
} else {
    Write-Host "PostgreSQL server is already running." -ForegroundColor Green
}

# 4. Create Database
Write-Host "Creating 'kartmitra' database if it doesn't exist..." -ForegroundColor Cyan
# Run list DB command to check if database already exists
$dbs = & "$binDir\psql.exe" -U postgres -d postgres -t -A -c "SELECT 1 FROM pg_database WHERE datname='kartmitra'" 2>$null
if ($dbs -ne "1") {
    & "$binDir\createdb.exe" -U postgres kartmitra
    Write-Host "Database 'kartmitra' created successfully." -ForegroundColor Green
} else {
    Write-Host "Database 'kartmitra' already exists." -ForegroundColor Green
}

Write-Host "PostgreSQL Setup completed successfully." -ForegroundColor Green
