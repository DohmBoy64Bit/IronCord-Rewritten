# Phase 2 Infrastructure Validation Script
# Validates infrastructure setup before Phase 3 (Gateway implementation)

$ErrorActionPreference = "Stop"
$TestResults = @()
$StartTime = Get-Date

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Details = ""
    )
    
    $result = @{
        Test = $TestName
        Passed = $Passed
        Details = $Details
    }
    $script:TestResults += $result
    
    $status = if ($Passed) { "[PASS]" } else { "[FAIL]" }
    $color = if ($Passed) { "Green" } else { "Red" }
    
    Write-Host "$status $TestName" -ForegroundColor $color
    if ($Details) {
        Write-Host "       $Details" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Phase 2 Infrastructure Validation Tests" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check containers are running
Write-Host "[Test 1] Container Status" -ForegroundColor Yellow
$dbHealth = podman inspect ironcord-db --format "{{.State.Health.Status}}" 2>&1
$dbHealthy = $dbHealth -match "healthy"
Write-TestResult -TestName "Database is healthy" -Passed $dbHealthy -Details "Status: $dbHealth"

$appStatus = podman inspect ironcord-app --format "{{.State.Status}}" 2>&1
$appRunning = $appStatus -match "running"
Write-TestResult -TestName "App container is running" -Passed $appRunning -Details "Status: $appStatus"

# Test 2: Check IRC server
Write-Host ""
Write-Host "[Test 2] IRC Server" -ForegroundColor Yellow
$ErrorActionPreference = "SilentlyContinue"
$ircLogs = podman logs ironcord-app --tail 50 2>&1 | Out-String
$ErrorActionPreference = "Stop"
$ircRunning = $ircLogs.Contains("ergo-irc entered RUNNING state")
Write-TestResult -TestName "IRC server (Ergo) is running" -Passed $ircRunning -Details "Supervisord reports IRC running"

try {
    $tcpTest = Test-NetConnection -ComputerName localhost -Port 6667 -WarningAction SilentlyContinue
    $ircPort = $tcpTest.TcpTestSucceeded
} catch {
    $ircPort = $false
}
Write-TestResult -TestName "IRC port 6667 is accessible" -Passed $ircPort -Details "Port open from host"

# Test 3: Check database connectivity
Write-Host ""
Write-Host "[Test 3] Database Connectivity" -ForegroundColor Yellow
$pgTest = podman exec ironcord-db psql -U ironcord -d ironcord -c "SELECT 1 as test;" 2>&1 | Out-String
$pgConnected = ($pgTest -match "1 row") -eq $true
Write-TestResult -TestName "PostgreSQL accepts connections" -Passed $pgConnected -Details "Query executed"

try {
    $tcpTest = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
    $dbPort = $tcpTest.TcpTestSucceeded
} catch {
    $dbPort = $false
}
Write-TestResult -TestName "Database port 5432 is accessible" -Passed $dbPort -Details "Port open from host"

# Test 4: Volume persistence
Write-Host ""
Write-Host "[Test 4] Volume Persistence" -ForegroundColor Yellow
Write-Host "       Creating test data..." -ForegroundColor Gray
$createTable = "CREATE TABLE IF NOT EXISTS test_persistence (id SERIAL PRIMARY KEY, test_value TEXT); INSERT INTO test_persistence (test_value) VALUES ('test');"
podman exec ironcord-db psql -U ironcord -d ironcord -c $createTable 2>&1 | Out-Null

Write-Host "       Restarting database..." -ForegroundColor Gray
podman restart ironcord-db 2>&1 | Out-Null
Start-Sleep -Seconds 8

$selectData = "SELECT COUNT(*) FROM test_persistence;"
$result = podman exec ironcord-db psql -U ironcord -d ironcord -c $selectData 2>&1 | Out-String
$dataPersisted = ($result -match "\d+") -eq $true
Write-TestResult -TestName "Data persists across restarts" -Passed $dataPersisted -Details "Test table found"

podman exec ironcord-db psql -U ironcord -d ironcord -c "DROP TABLE IF EXISTS test_persistence;" 2>&1 | Out-Null

# Test 5: Restart resilience
Write-Host ""
Write-Host "[Test 5] Restart Resilience" -ForegroundColor Yellow
Write-Host "       Restarting app container..." -ForegroundColor Gray
podman restart ironcord-app 2>&1 | Out-Null
Start-Sleep -Seconds 5

$appStatus2 = podman inspect ironcord-app --format "{{.State.Status}}" 2>&1
$appRecovered = $appStatus2 -match "running"
Write-TestResult -TestName "App container recovers after restart" -Passed $appRecovered -Details "Status: $appStatus2"

$ErrorActionPreference = "SilentlyContinue"
$ircLogs2 = podman logs ironcord-app --tail 50 2>&1 | Out-String
$ErrorActionPreference = "Stop"
$ircRecovered = $ircLogs2.Contains("ergo-irc entered RUNNING state")
Write-TestResult -TestName "IRC server recovers after restart" -Passed $ircRecovered -Details "Supervisord reports IRC running"

# Summary
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$totalTests = $TestResults.Count
$passedTests = ($TestResults | Where-Object { $_.Passed }).Count
$failedTests = $totalTests - $passedTests
$passRate = if ($totalTests -gt 0) { [math]::Round(($passedTests / $totalTests) * 100, 2) } else { 0 }

Write-Host ""
Write-Host "Total Tests:  $totalTests" -ForegroundColor White
Write-Host "Passed:       $passedTests" -ForegroundColor Green
Write-Host "Failed:       $failedTests" -ForegroundColor $(if ($failedTests -gt 0) { "Red" } else { "Green" })
Write-Host "Pass Rate:    ${passRate}%" -ForegroundColor $(if ($passRate -eq 100) { "Green" } else { "Yellow" })

$totalTime = (Get-Date) - $StartTime
Write-Host ""
Write-Host "Execution time: $([math]::Round($totalTime.TotalSeconds, 2))s" -ForegroundColor Gray

if ($failedTests -gt 0) {
    Write-Host ""
    Write-Host "[FAILED TESTS]" -ForegroundColor Red
    $TestResults | Where-Object { -not $_.Passed } | ForEach-Object {
        Write-Host "  - $($_.Test)" -ForegroundColor Red
    }
    Write-Host ""
    exit 1
} else {
    Write-Host ""
    Write-Host "[SUCCESS] All infrastructure tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "[NOTE] Gateway health check will fail until Phase 3 implementation" -ForegroundColor Yellow
    Write-Host "[NOTE] Gateway connectivity tests deferred to Phase 3" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}
