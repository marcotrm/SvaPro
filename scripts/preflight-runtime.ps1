$ErrorActionPreference = 'Stop'

Write-Host '== SvaPro Runtime Preflight ==' -ForegroundColor Cyan

function Parse-Version($value) {
    try {
        return [Version]$value
    } catch {
        return $null
    }
}

$phpCmd = Get-Command php -ErrorAction SilentlyContinue
if (-not $phpCmd) {
    Write-Host 'PHP: NON TROVATO nel PATH' -ForegroundColor Red
    exit 1
}

$phpVersionRaw = php -r "echo PHP_VERSION;"
$phpVersion = Parse-Version $phpVersionRaw
$minPhp = [Version]'8.2.0'
if (-not $phpVersion -or $phpVersion -lt $minPhp) {
    Write-Host "PHP: $phpVersionRaw (KO, richiesto >= 8.2.0)" -ForegroundColor Red
    exit 1
}
Write-Host "PHP: $phpVersionRaw (OK)" -ForegroundColor Green

$requiredPhpExtensions = @('mbstring','bcmath','pdo_sqlite','sqlite3','openssl','json','ctype','fileinfo','tokenizer')
$loadedExtensions = php -r "echo implode(',', get_loaded_extensions());" | ForEach-Object { $_.Split(',') }
$missing = @()
foreach ($ext in $requiredPhpExtensions) {
    if ($loadedExtensions -notcontains $ext) {
        $missing += $ext
    }
}

if ($missing.Count -gt 0) {
    Write-Host ('Estensioni PHP mancanti: ' + ($missing -join ', ')) -ForegroundColor Red
    exit 1
}
Write-Host 'Estensioni PHP richieste: OK' -ForegroundColor Green

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host 'Node.js: NON TROVATO nel PATH' -ForegroundColor Red
    exit 1
}

$nodeVersionRaw = (node -v).TrimStart('v')
$nodeVersion = Parse-Version $nodeVersionRaw
$minNode = [Version]'20.0.0'
if (-not $nodeVersion -or $nodeVersion -lt $minNode) {
    Write-Host "Node.js: $nodeVersionRaw (KO, richiesto >= 20)" -ForegroundColor Red
    exit 1
}
Write-Host "Node.js: $nodeVersionRaw (OK)" -ForegroundColor Green

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Host 'npm: NON TROVATO nel PATH' -ForegroundColor Red
    exit 1
}

Write-Host 'Preflight completato con successo.' -ForegroundColor Green
exit 0
