# Test Gateway Integration Against Unified Container

Write-Host "Gateway Integration Tests - Unified Container" -ForegroundColor Cyan

# Set environment variables for unified container
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_NAME = "ironcord"
$env:DB_USER = "ironcord"
$env:DB_PASSWORD = "ironcord_password"
$env:IRC_HOST = "localhost"
$env:IRC_PORT = "6667"

Write-Host "Target: Database $env:DB_HOST:$env:DB_PORT, IRC $env:IRC_HOST:$env:IRC_PORT" -ForegroundColor Gray

npm test --workspace=@ironcord/gateway

if ($LASTEXITCODE -eq 0) {
    Write-Host "ALL GATEWAY TESTS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "GATEWAY TESTS FAILED" -ForegroundColor Red
    exit 1
}
