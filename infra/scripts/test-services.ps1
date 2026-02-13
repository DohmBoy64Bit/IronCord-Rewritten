# Test Services Management Script for IronCord v2 (Windows/Podman)

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action
)

$testComposeFile = "podman-compose.test.yml"

function Start-TestServices {
    Write-Host "Starting test services..." -ForegroundColor Cyan
    
    podman compose -f $testComposeFile down --volumes --remove-orphans 2>$null
    
    podman compose -f $testComposeFile up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to start test services!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Waiting for test services to be healthy..." -ForegroundColor Yellow
    $maxAttempts = 30
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        $attempt++
        Start-Sleep -Seconds 2
        
        $dbHealth = podman inspect ironcord-test-db --format='{{.State.Health.Status}}' 2>$null
        $ircRunning = podman inspect ironcord-test-irc --format='{{.State.Running}}' 2>$null
        
        if ($dbHealth -eq "healthy" -and $ircRunning -eq "true") {
            Write-Host ""
            Write-Host "Test services are ready!" -ForegroundColor Green
            Write-Host "Test Database: localhost:5433" -ForegroundColor Green
            Write-Host "Test IRC:      localhost:6668" -ForegroundColor Green
            Write-Host ""
            return
        }
        
        Write-Host "Waiting... ($attempt/$maxAttempts) DB: $dbHealth, IRC: $ircRunning" -ForegroundColor Gray
    }
    
    Write-Host "Test services did not become ready in time!" -ForegroundColor Red
    podman compose -f $testComposeFile logs
    exit 1
}

function Stop-TestServices {
    Write-Host "Stopping test services..." -ForegroundColor Cyan
    podman compose -f $testComposeFile down --volumes --remove-orphans
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Test services stopped successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to stop test services!" -ForegroundColor Red
        exit 1
    }
}

function Restart-TestServices {
    Write-Host "Restarting test services..." -ForegroundColor Cyan
    Stop-TestServices
    Start-TestServices
}

function Get-TestServicesStatus {
    Write-Host "Test services status:" -ForegroundColor Cyan
    Write-Host ""
    
    $dbStatus = podman inspect ironcord-test-db --format='{{.State.Status}} (Health: {{.State.Health.Status}})' 2>$null
    $ircStatus = podman inspect ironcord-test-irc --format='{{.State.Status}}' 2>$null
    
    if ($dbStatus) {
        Write-Host "Test Database: $dbStatus" -ForegroundColor Yellow
    } else {
        Write-Host "Test Database: Not running" -ForegroundColor Red
    }
    
    if ($ircStatus) {
        Write-Host "Test IRC:      $ircStatus" -ForegroundColor Yellow
    } else {
        Write-Host "Test IRC:      Not running" -ForegroundColor Red
    }
    
    Write-Host ""
}

switch ($Action) {
    "start" { Start-TestServices }
    "stop" { Stop-TestServices }
    "restart" { Restart-TestServices }
    "status" { Get-TestServicesStatus }
}
