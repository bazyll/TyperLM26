# ==============================================================================
# Script: scripts/dev-staging.ps1
# Description: Safely launches Next.js with Staging environment configuration.
#              Loads .env.staging.local into current process scope only.
#              Guarantees zero leakage or execution on production Supabase.
# ==============================================================================

$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot "..\.env.staging.local"

if (-not (Test-Path $envFile)) {
    Write-Host ""
    Write-Host "[ERROR] Nie znaleziono pliku .env.staging.local!" -ForegroundColor Red
    Write-Host "Utworz plik .env.staging.local w glownym katalogu projektu przed uruchomieniem." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# 1. Parse .env.staging.local into current process environment
$lines = Get-Content $envFile
foreach ($rawLine in $lines) {
    $line = $rawLine.Trim()
    if ($line.Length -gt 0 -and -not $line.StartsWith("#")) {
        $idx = $line.IndexOf("=")
        if ($idx -gt 0) {
            $key = $line.Substring(0, $idx).Trim()
            $val = $line.Substring($idx + 1).Trim()
            if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
                if ($val.Length -ge 2) {
                    $val = $val.Substring(1, $val.Length - 2)
                }
            }
            Set-Item -Path "Env:$key" -Value $val
            [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
        }
    }
}

# 2. Extract and Validate Supabase Project Ref
$supabaseUrl = [System.Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", "Process")
$stagingRef = [System.Environment]::GetEnvironmentVariable("STAGING_SUPABASE_PROJECT_REF", "Process")
$appEnv = [System.Environment]::GetEnvironmentVariable("APP_ENV", "Process")
$sandboxEnabled = [System.Environment]::GetEnvironmentVariable("ENABLE_LIVE_SANDBOX", "Process")

if (-not $supabaseUrl) {
    Write-Host "[ERROR] Brak NEXT_PUBLIC_SUPABASE_URL w .env.staging.local!" -ForegroundColor Red
    exit 1
}

# Extract project ref from URL: https://<ref>.supabase.co
$matchedRef = ""
if ($supabaseUrl -match "https://([^.]+)\.supabase\.co") {
    $matchedRef = $matches[1]
}

# 3. CRITICAL PRODUCTION SAFETY GUARD
$productionRef = "gdrbyskdqdaebpwvmwlc"
if ($matchedRef -eq $productionRef -or $supabaseUrl -like "*$productionRef*") {
    Write-Host ""
    Write-Host "==================================================================" -ForegroundColor Red
    Write-Host "[FATAL GUARD] WYKRYTO PRODUKCYJNY PROJECT REF ($productionRef)!" -ForegroundColor Red
    Write-Host "Skrypt dev:staging zostal zablokowany, aby ochronic baze produkcyjna." -ForegroundColor Red
    Write-Host "Upewnij sie, ze .env.staging.local wskazuje na dedykowany projekt Staging." -ForegroundColor Yellow
    Write-Host "==================================================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}

if (-not $stagingRef -or $stagingRef -ne $matchedRef) {
    Write-Host ""
    Write-Host "[ERROR] STAGING_SUPABASE_PROJECT_REF ($stagingRef) nie zgadza sie z adresem NEXT_PUBLIC_SUPABASE_URL ($matchedRef)!" -ForegroundColor Red
    Write-Host "Popraw wartosci w pliku .env.staging.local." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Ensure APP_ENV is explicitly set to staging
[System.Environment]::SetEnvironmentVariable("APP_ENV", "staging", "Process")

$displayEnv = "staging"
if ($appEnv) {
    $displayEnv = $appEnv
}

$displaySandbox = "DISABLED"
if ($sandboxEnabled -eq "true") {
    $displaySandbox = "ENABLED"
}

# 4. Success Banner (Without logging any secrets)
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " TYPERLM26 - ENVIRONMENT: STAGING" -ForegroundColor Green
Write-Host " Supabase Project Ref : $matchedRef" -ForegroundColor White
Write-Host " APP_ENV              : $displayEnv" -ForegroundColor White
Write-Host " Live Sandbox         : $displaySandbox" -ForegroundColor White
Write-Host " Production Guard     : ACTIVE (Target != $productionRef)" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 5. Launch Next.js dev server with staging process env
pnpm next dev
