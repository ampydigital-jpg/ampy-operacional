$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Repo = Split-Path `
    -Parent `
    (Split-Path -Parent $PSScriptRoot)

$V10Root = Join-Path $env:LOCALAPPDATA "AmpyDigital\V10"
$Lab = Join-Path $V10Root "supabase-local"

$ProductionRef = "epzrrsaibqdcaafkvwmm"
$SupabaseVersion = "2.101.0"
$BranchExpected = "stabilization/v10-canonical"

$TestEmail = "v10-preview@ampydigital.test"

$CredentialFile = Join-Path `
    $V10Root `
    "v10-test-credentials.txt"

Set-Location -LiteralPath $Repo

$Branch = (
    git branch --show-current |
    Out-String
).Trim()

if ($Branch -ne $BranchExpected) {
    throw "Bootstrap V10 permitido apenas em $BranchExpected."
}

$Manifest = (
    Get-Content `
        "supabase\v10\manifest.json" `
        -Raw |
    ConvertFrom-Json
)

$Baseline = Join-Path `
    $Repo `
    $Manifest.baseline.repo_path

$BaselineHash = (
    Get-FileHash `
        -LiteralPath $Baseline `
        -Algorithm SHA256
).Hash

if ($BaselineHash -ne $Manifest.baseline.sha256) {
    throw "Baseline V10 corrompido ou divergente."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker nao encontrado."
}

$DockerOk = (
    docker info 2>$null |
    Out-String
)

if ([string]::IsNullOrWhiteSpace($DockerOk)) {
    throw "Docker Desktop nao esta ativo."
}

New-Item `
    -ItemType Directory `
    -Path $Lab `
    -Force |
    Out-Null

Set-Location -LiteralPath $Lab

if (-not (Test-Path -LiteralPath ".\supabase\config.toml")) {

    npx.cmd `
        --yes `
        "supabase@$SupabaseVersion" `
        init

    if ($LASTEXITCODE -ne 0) {
        throw "supabase init falhou."
    }
}

$TempDir = Join-Path $Lab "supabase\.temp"

if (Test-Path -LiteralPath $TempDir) {

    foreach (
        $File in @(
            Get-ChildItem `
                $TempDir `
                -File `
                -Recurse `
                -ErrorAction SilentlyContinue
        )
    ) {
        try {
            $Content = Get-Content `
                $File.FullName `
                -Raw

            if (
                $Content -match
                [regex]::Escape($ProductionRef)
            ) {
                throw "PROTECAO: lab possui referencia ao projeto de producao."
            }
        }
        catch {
            if (
                $_.Exception.Message -like
                "PROTECAO:*"
            ) {
                throw
            }
        }
    }
}

$StatusOutput = @(
    cmd.exe `
        /d `
        /s `
        /c `
        "npx.cmd --yes supabase@$SupabaseVersion status 2>&1"
)

if ($LASTEXITCODE -ne 0) {

    npx.cmd `
        --yes `
        "supabase@$SupabaseVersion" `
        start

    if ($LASTEXITCODE -ne 0) {
        throw "supabase start falhou."
    }
}

$StatusEnv = @(
    cmd.exe `
        /d `
        /s `
        /c `
        "npx.cmd --yes supabase@$SupabaseVersion status -o env 2>&1"
)

if ($LASTEXITCODE -ne 0) {
    throw "supabase status -o env falhou."
}

function LocalValue {
    param([string]$Name)

    $Pattern =
        "^" +
        [regex]::Escape($Name) +
        "="

    $Line = @(
        $StatusEnv |
        Where-Object {
            $_ -match $Pattern
        }
    ) |
    Select-Object -First 1

    if (-not $Line) {
        throw "Variavel local ausente: $Name"
    }

    return (
        ($Line -replace $Pattern, "").
            Trim().
            Trim('"')
    )
}

$ApiUrl = LocalValue "API_URL"
$AnonKey = LocalValue "ANON_KEY"
$ServiceRoleKey = LocalValue "SERVICE_ROLE_KEY"

if (
    $ApiUrl -notmatch
    '^http://(127\.0\.0\.1|localhost):'
) {
    throw "PROTECAO: Supabase nao e local."
}

$ContainerName = "supabase_db_supabase-local"

$Running = (
    docker ps `
        --filter "name=$ContainerName" `
        --filter "status=running" `
        --format "{{.Names}}" |
    Out-String
).Trim()

if ($Running -ne $ContainerName) {
    throw "Container PostgreSQL V10 nao encontrado."
}

$PublicTables = (
    docker exec `
        $ContainerName `
        psql `
        -U postgres `
        -d postgres `
        -At `
        -c "
select count(*)
from information_schema.tables
where table_schema='public'
  and table_type='BASE TABLE';
" |
    Out-String
).Trim()

if ($PublicTables -eq "0") {

    Get-Content `
        -LiteralPath $Baseline `
        -Raw |
    docker exec `
        -i `
        $ContainerName `
        psql `
        -U postgres `
        -d postgres `
        -v ON_ERROR_STOP=1

    if ($LASTEXITCODE -ne 0) {
        throw "Importacao do baseline V10 falhou."
    }

}
elseif ($PublicTables -ne "36") {

    throw "Banco local existente nao corresponde a um lab vazio nem ao baseline V10."
}

Get-Content `
    -LiteralPath (
        Join-Path `
            $Repo `
            "supabase\v10\local\auth-storage.sql"
    ) `
    -Raw |
docker exec `
    -i `
    $ContainerName `
    psql `
    -U postgres `
    -d postgres `
    -v ON_ERROR_STOP=1

if ($LASTEXITCODE -ne 0) {
    throw "Auth/Storage local falhou."
}

$ExistingUserId = (
    docker exec `
        $ContainerName `
        psql `
        -U postgres `
        -d postgres `
        -At `
        -c "
select id::text
from auth.users
where lower(email)=lower('$TestEmail')
limit 1;
" |
    Out-String
).Trim()

$StoredPassword = $null

if (Test-Path -LiteralPath $CredentialFile) {

    $PasswordLine = @(
        Get-Content `
            -LiteralPath $CredentialFile |
        Where-Object {
            $_ -like "PASSWORD=*"
        }
    ) |
    Select-Object -First 1

    if ($PasswordLine) {
        $StoredPassword =
            $PasswordLine.Substring(9)
    }
}

$NeedNewPassword =
    [string]::IsNullOrWhiteSpace(
        [string]$StoredPassword
    )

if (-not $NeedNewPassword) {

    try {

        $LoginResult = Invoke-RestMethod `
            -Method Post `
            -Uri "$ApiUrl/auth/v1/token?grant_type=password" `
            -Headers @{
                apikey = $AnonKey
            } `
            -ContentType "application/json" `
            -Body (
                @{
                    email = $TestEmail
                    password = $StoredPassword
                } |
                ConvertTo-Json
            )

        if (
            [string]::IsNullOrWhiteSpace(
                [string]$LoginResult.access_token
            )
        ) {
            $NeedNewPassword = $true
        }
    }
    catch {
        $NeedNewPassword = $true
    }
}

if ($NeedNewPassword) {

    $RandomBytes = New-Object byte[] 18
    $Rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()

    try {
        $Rng.GetBytes($RandomBytes)
    }
    finally {
        $Rng.Dispose()
    }

    $RandomHex = (
        [System.BitConverter]::ToString($RandomBytes)
    ).Replace("-", "")

    $StoredPassword =
        "V10!Aa9-$RandomHex"
}

$Headers = @{
    apikey = $ServiceRoleKey
    Authorization = "Bearer $ServiceRoleKey"
}

if ([string]::IsNullOrWhiteSpace($ExistingUserId)) {

    $Created = Invoke-RestMethod `
        -Method Post `
        -Uri "$ApiUrl/auth/v1/admin/users" `
        -Headers $Headers `
        -ContentType "application/json" `
        -Body (
            @{
                email = $TestEmail
                password = $StoredPassword
                email_confirm = $true
                user_metadata = @{
                    full_name = "V10 Preview Admin"
                }
            } |
            ConvertTo-Json -Depth 5
        )

    $UserId = [string]$Created.id
}
else {

    $UserId = $ExistingUserId

    if ($NeedNewPassword) {

        Invoke-RestMethod `
            -Method Put `
            -Uri "$ApiUrl/auth/v1/admin/users/$UserId" `
            -Headers $Headers `
            -ContentType "application/json" `
            -Body (
                @{
                    password = $StoredPassword
                    email_confirm = $true
                    user_metadata = @{
                        full_name = "V10 Preview Admin"
                    }
                } |
                ConvertTo-Json -Depth 5
            ) |
        Out-Null
    }
}

@(
    "AMBIENTE=V10-LOCAL"
    "EMAIL=$TestEmail"
    "PASSWORD=$StoredPassword"
    ""
) |
Set-Content `
    -LiteralPath $CredentialFile `
    -Encoding UTF8

$SeedPath = Join-Path `
    $Repo `
    "supabase\v10\local\seed.sql"

Get-Content `
    -LiteralPath $SeedPath `
    -Raw |
docker exec `
    -i `
    $ContainerName `
    psql `
    -U postgres `
    -d postgres `
    -v ON_ERROR_STOP=1 `
    -v "v10_user_id=$UserId" `
    -v "v10_email=$TestEmail"

if ($LASTEXITCODE -ne 0) {
    throw "Seed V10 falhou."
}

Set-Location -LiteralPath $Repo

git check-ignore -q ".env.local"

if ($LASTEXITCODE -ne 0) {
    throw ".env.local nao esta ignorado pelo Git."
}

$EnvPath = Join-Path $Repo ".env.local"

$EnvBackup = Join-Path `
    $V10Root `
    (
        "env-before-bootstrap-" +
        (Get-Date -Format "yyyyMMdd-HHmmss")
    )

New-Item `
    -ItemType Directory `
    -Path $EnvBackup `
    -Force |
    Out-Null

if (Test-Path -LiteralPath $EnvPath) {
    Copy-Item `
        $EnvPath `
        (Join-Path $EnvBackup "env.local.backup")
}

@(
    "NEXT_PUBLIC_SUPABASE_URL=$ApiUrl"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=$AnonKey"
    "SUPABASE_SERVICE_ROLE_KEY=$ServiceRoleKey"
    "NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000"
    ""
) |
Set-Content `
    -LiteralPath $EnvPath `
    -Encoding UTF8

npm.cmd ci `
    --no-audit `
    --no-fund

if ($LASTEXITCODE -ne 0) {
    throw "npm ci falhou."
}

& "$PSScriptRoot\check.ps1"

Write-Host ""
Write-Host "============================================================"
Write-Host "BOOTSTRAP V10 Ã¢â‚¬â€ PASS"
Write-Host "============================================================"
Write-Host "App:"
Write-Host "http://127.0.0.1:3000"
Write-Host ""
Write-Host "Login:"
Write-Host $TestEmail
Write-Host ""
Write-Host "Senha:"
Write-Host $CredentialFile