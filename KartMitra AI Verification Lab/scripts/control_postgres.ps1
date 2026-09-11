param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "status")]
    [string]$Action
)

$pgDir = "C:\Users\HP\postgresql-16.3"
$dataDir = "$pgDir\data"
$logPath = "$pgDir\pg.log"
$binDir = "$pgDir\bin"

if (-not (Test-Path $pgDir)) {
    Write-Error "PostgreSQL directory not found at $pgDir. Please run setup_postgres.ps1 first."
    exit 1
}

switch ($Action) {
    "start" {
        Write-Host "Starting PostgreSQL server..." -ForegroundColor Cyan
        & "$binDir\pg_ctl.exe" -D $dataDir -l $logPath start
    }
    "stop" {
        Write-Host "Stopping PostgreSQL server..." -ForegroundColor Cyan
        & "$binDir\pg_ctl.exe" -D $dataDir stop
    }
    "status" {
        Write-Host "Checking PostgreSQL server status..." -ForegroundColor Cyan
        & "$binDir\pg_ctl.exe" status -D $dataDir
    }
}
