$body = @{
    email = 'test@example.com'
    password = 'testpass123'
    irc_nick = 'testuser'
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri 'http://localhost:3000/auth/register' -Method POST -Body $body -ContentType 'application/json'
Write-Output $response.Content
