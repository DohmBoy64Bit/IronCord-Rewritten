# Container Resource Usage Test
# 
# Tests resource consumption of IronCord containers

param(
    [int]$DurationSeconds = 60,
    [int]$SampleInterval = 5
)

$ErrorActionPreference = "Stop"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Container Resource Usage Test" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Test Configuration:" -ForegroundColor Yellow
Write-Host "  Duration: $DurationSeconds seconds"
Write-Host "  Sample Interval: $SampleInterval seconds"
Write-Host ""

# Check if containers are running
$appRunning = podman ps --filter "name=ironcord-app" --filter "status=running" --quiet
$dbRunning = podman ps --filter "name=ironcord-db" --filter "status=running" --quiet

if (-not $appRunning) {
    Write-Host "✗ Gateway container (ironcord-app) is not running" -ForegroundColor Red
    exit 1
}

if (-not $dbRunning) {
    Write-Host "✗ Database container (ironcord-db) is not running" -ForegroundColor Red
    exit 1
}

Write-Host "✓ All containers are running" -ForegroundColor Green
Write-Host ""

# Initialize metrics
$appMetrics = @{
    CPU = @()
    Memory = @()
    MemoryPercent = @()
}

$dbMetrics = @{
    CPU = @()
    Memory = @()
    MemoryPercent = @()
}

# Collect samples
$samples = [math]::Ceiling($DurationSeconds / $SampleInterval)

Write-Host "Collecting $samples samples over $DurationSeconds seconds..." -ForegroundColor Yellow
Write-Host ""

for ($i = 0; $i -lt $samples; $i++) {
    $sampleTime = Get-Date -Format "HH:mm:ss"
    
    # Get app container stats
    $appStats = podman stats --no-stream --format "{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}}" ironcord-app
    if ($appStats) {
        $parts = $appStats -split ','
        $cpuPercent = ($parts[0] -replace '[^0-9.]', '')
        $memUsage = $parts[1]
        $memPercent = ($parts[2] -replace '[^0-9.]', '')
        
        $appMetrics.CPU += [double]$cpuPercent
        $appMetrics.Memory += $memUsage
        $appMetrics.MemoryPercent += [double]$memPercent
        
        $appMsg = ("[{0}] App: CPU={1}% MEM={2} ({3}%)" -f $sampleTime, $cpuPercent, $memUsage, $memPercent)
        Write-Host $appMsg -ForegroundColor Gray
    }
    
    # Get db container stats
    $dbStats = podman stats --no-stream --format "{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}}" ironcord-db
    if ($dbStats) {
        $parts = $dbStats -split ','
        $cpuPercent = ($parts[0] -replace '[^0-9.]', '')
        $memUsage = $parts[1]
        $memPercent = ($parts[2] -replace '[^0-9.]', '')
        
        $dbMetrics.CPU += [double]$cpuPercent
        $dbMetrics.Memory += $memUsage
        $dbMetrics.MemoryPercent += [double]$memPercent
        
        $dbMsg = ("[{0}] DB:  CPU={1}% MEM={2} ({3}%)" -f $sampleTime, $cpuPercent, $memUsage, $memPercent)
        Write-Host $dbMsg -ForegroundColor Gray
    }
    
    if ($i -lt ($samples - 1)) {
        Start-Sleep -Seconds $SampleInterval
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Resource Usage Summary" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Calculate statistics for App container
if ($appMetrics.CPU.Count -gt 0) {
    $appCpuAvg = ($appMetrics.CPU | Measure-Object -Average).Average
    $appCpuMax = ($appMetrics.CPU | Measure-Object -Maximum).Maximum
    $appMemAvg = ($appMetrics.MemoryPercent | Measure-Object -Average).Average
    $appMemMax = ($appMetrics.MemoryPercent | Measure-Object -Maximum).Maximum
    
    Write-Host "Gateway Container (ironcord-app):" -ForegroundColor Yellow
    Write-Host "  CPU Usage:"
    $avgMsg = ("    Average: {0}%" -f [math]::Round($appCpuAvg, 2))
    Write-Host $avgMsg
    $maxMsg = ("    Max: {0}%" -f [math]::Round($appCpuMax, 2))
    Write-Host $maxMsg
    Write-Host "    Target: Less than 50% average"
    Write-Host "    Status: $(if ($appCpuAvg -lt 50) { '✓ PASS' } else { '✗ FAIL' })" -ForegroundColor $(if ($appCpuAvg -lt 50) { 'Green' } else { 'Red' })
    Write-Host ""
    Write-Host "  Memory Usage:"
    $avgMsg = ("    Average: {0}%" -f [math]::Round($appMemAvg, 2))
    Write-Host $avgMsg
    $maxMsg = ("    Max: {0}%" -f [math]::Round($appMemMax, 2))
    Write-Host $maxMsg
    Write-Host "    Target: Less than 75%"
    Write-Host "    Status: $(if ($appMemMax -lt 75) { '✓ PASS' } else { '✗ FAIL' })" -ForegroundColor $(if ($appMemMax -lt 75) { 'Green' } else { 'Red' })
    Write-Host ""
}

# Calculate statistics for DB container
if ($dbMetrics.CPU.Count -gt 0) {
    $dbCpuAvg = ($dbMetrics.CPU | Measure-Object -Average).Average
    $dbCpuMax = ($dbMetrics.CPU | Measure-Object -Maximum).Maximum
    $dbMemAvg = ($dbMetrics.MemoryPercent | Measure-Object -Average).Average
    $dbMemMax = ($dbMetrics.MemoryPercent | Measure-Object -Maximum).Maximum
    
    Write-Host "Database Container (ironcord-db):" -ForegroundColor Yellow
    Write-Host "  CPU Usage:"
    $avgMsg = ("    Average: {0}%" -f [math]::Round($dbCpuAvg, 2))
    Write-Host $avgMsg
    $maxMsg = ("    Max: {0}%" -f [math]::Round($dbCpuMax, 2))
    Write-Host $maxMsg
    Write-Host "    Target: Less than 50% average"
    Write-Host "    Status: $(if ($dbCpuAvg -lt 50) { '✓ PASS' } else { '✗ FAIL' })" -ForegroundColor $(if ($dbCpuAvg -lt 50) { 'Green' } else { 'Red' })
    Write-Host ""
    Write-Host "  Memory Usage:"
    $avgMsg = ("    Average: {0}%" -f [math]::Round($dbMemAvg, 2))
    Write-Host $avgMsg
    $maxMsg = ("    Max: {0}%" -f [math]::Round($dbMemMax, 2))
    Write-Host $maxMsg
    Write-Host "    Target: Less than 75%"
    Write-Host "    Status: $(if ($dbMemMax -lt 75) { '✓ PASS' } else { '✗ FAIL' })" -ForegroundColor $(if ($dbMemMax -lt 75) { 'Green' } else { 'Red' })
    Write-Host ""
}

# Overall result
$cpuPass = ($appCpuAvg -lt 50) -and ($dbCpuAvg -lt 50)
$memPass = ($appMemMax -lt 75) -and ($dbMemMax -lt 75)
$allPass = $cpuPass -and $memPass

Write-Host "=====================================" -ForegroundColor Cyan
if ($allPass) {
    Write-Host "✓ All resource usage tests passed!" -ForegroundColor Green
} else {
    Write-Host "✗ Some resource usage tests failed" -ForegroundColor Red
}
Write-Host "=====================================" -ForegroundColor Cyan

exit $(if ($allPass) { 0 } else { 1 })
