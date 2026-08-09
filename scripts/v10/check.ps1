param(
    [switch] $Fast,
    [switch] $AllowDirty
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Repo = Split-Path `
    -Parent `
    (Split-Path -Parent $PSScriptRoot)

$V10Root = Join-Path $env:LOCALAPPDATA "AmpyDigital\V10"
$ContainerName = "supabase_db_supabase-local"
$ProductionRef = "epzrrsaibqdcaafkvwmm"
$BranchExpected = "stabilization/v10-canonical"

Set-Location -LiteralPath $Repo

Write-Host ""
Write-Host "============================================================"
Write-Host "V10 CHECK"
Write-Host "============================================================"

$Branch = (
    git branch --show-current |
    Out-String
).Trim()

if ($Branch -ne $BranchExpected) {
    throw "FAIL Ã¢â‚¬â€ branch incorreta: $Branch"
}

if (-not $AllowDirty) {
    $Status = (
        git status --porcelain |
        Out-String
    ).Trim()

    if (-not [string]::IsNullOrWhiteSpace($Status)) {
        Write-Host $Status
        throw "FAIL Ã¢â‚¬â€ Git nao esta limpo."
    }
}

if (-not (Test-Path -LiteralPath "package-lock.json")) {
    throw "FAIL Ã¢â‚¬â€ package-lock.json ausente."
}

if (-not (Test-Path -LiteralPath ".env.local")) {
    throw "FAIL Ã¢â‚¬â€ .env.local ausente."
}

$EnvContent = Get-Content ".env.local" -Raw

if (
    $EnvContent -notmatch
    'NEXT_PUBLIC_SUPABASE_URL=http://(127\.0\.0\.1|localhost)'
) {
    throw "FAIL Ã¢â‚¬â€ .env.local nao aponta para Supabase local."
}

if ($EnvContent -match [regex]::Escape($ProductionRef)) {
    throw "FAIL Ã¢â‚¬â€ referencia de producao encontrada no env."
}

$Manifest = (
    Get-Content `
        "supabase\v10\manifest.json" `
        -Raw |
    ConvertFrom-Json
)

$BaselinePath = Join-Path `
    $Repo `
    $Manifest.baseline.repo_path

$BaselineHash = (
    Get-FileHash `
        -LiteralPath $BaselinePath `
        -Algorithm SHA256
).Hash

if ($BaselineHash -ne $Manifest.baseline.sha256) {
    throw "FAIL Ã¢â‚¬â€ hash do baseline divergiu."
}

$LegacyCount = @(
    Get-ChildItem `
        "supabase\migrations" `
        -File `
        -Filter "*.sql"
).Count

if (
    $LegacyCount -ne
    [int]$Manifest.legacy.migration_sql_count
) {
    throw "FAIL Ã¢â‚¬â€ pasta historica de migrations mudou."
}

$ForwardFiles = @(
    Get-ChildItem `
        "supabase\v10\migrations" `
        -File `
        -Filter "*.sql"
)

foreach ($File in $ForwardFiles) {
    if (
        $File.Name -notmatch
        '^\d{4}_[a-z0-9_]+\.sql$'
    ) {
        throw "FAIL Ã¢â‚¬â€ migration V10 com nome invalido: $($File.Name)"
    }
}

$Running = (
    docker ps `
        --filter "name=$ContainerName" `
        --filter "status=running" `
        --format "{{.Names}}" |
    Out-String
).Trim()

if ($Running -ne $ContainerName) {
    throw "FAIL Ã¢â‚¬â€ Supabase local nao esta ativo."
}

$Fingerprint = (
    docker exec `
        $ContainerName `
        psql `
        -U postgres `
        -d postgres `
        -At `
        -F "|" `
        -c "
select
  (
    select count(*)
    from information_schema.tables
    where table_schema='public'
      and table_type='BASE TABLE'
  ),
  (
    select count(*)
    from pg_proc p
    join pg_namespace n
      on n.oid=p.pronamespace
    where n.nspname='public'
  ),
  (
    select count(*)
    from pg_trigger t
    join pg_class c
      on c.oid=t.tgrelid
    join pg_namespace n
      on n.oid=c.relnamespace
    where n.nspname='public'
      and not t.tgisinternal
  ),
  (
    select count(*)
    from pg_policies
    where schemaname='public'
  );
" |
    Out-String
).Trim()

if ($Fingerprint -ne "36|61|26|85") {
    throw "FAIL Ã¢â‚¬â€ fingerprint public divergente: $Fingerprint"
}

$Infra = (
    docker exec `
        $ContainerName `
        psql `
        -U postgres `
        -d postgres `
        -At `
        -F "|" `
        -c "
select
  (
    select count(*)
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='auth'
      and c.relname='users'
      and t.tgname='on_auth_user_created'
      and not t.tgisinternal
  ),
  (
    select count(*)
    from storage.buckets
    where id in (
      'client-logos',
      'feed-preview',
      'team-avatars'
    )
  ),
  (
    select count(*)
    from pg_policies
    where schemaname='storage'
  );
" |
    Out-String
).Trim()

if ($Infra -ne "1|3|12") {
    throw "FAIL Ã¢â‚¬â€ Auth/Storage divergiu: $Infra"
}

$Seed = (
    docker exec `
        $ContainerName `
        psql `
        -U postgres `
        -d postgres `
        -At `
        -F "|" `
        -c "
select
    (
      select count(*)
      from public.clients
      where name='[V10 TEST] Cliente Sintetico'
    ),
    (
      select count(*)
      from public.pautas
      where name='[V10 TEST] Pauta Sintetica'
    ),
    (
      select count(*)
      from public.work_items
      where title='[V10 TEST] Demanda Sintetica'
        and pauta_id is not null
        and is_pauta_card=true
    ),
    (
      select count(*)
      from public.work_item_board_assignments a
      join public.work_items wi
        on wi.id=a.work_item_id
      where wi.title='[V10 TEST] Demanda Sintetica'
        and a.assignment_status='active'
    );
" |
    Out-String
).Trim()

if ($Seed -ne "1|1|1|1") {
    throw "FAIL Ã¢â‚¬â€ seed canonico divergente: $Seed"
}

Write-Host "PASS Ã¢â‚¬â€ branch"
Write-Host "PASS Ã¢â‚¬â€ env local"
Write-Host "PASS Ã¢â‚¬â€ lockfile"
Write-Host "PASS Ã¢â‚¬â€ baseline"
Write-Host "PASS Ã¢â‚¬â€ 38 migrations historicas congeladas"
Write-Host "PASS Ã¢â‚¬â€ migrations V10: $($ForwardFiles.Count)"
Write-Host "PASS Ã¢â‚¬â€ public 36|61|26|85"
Write-Host "PASS Ã¢â‚¬â€ Auth/Storage 1|3|12"
Write-Host "PASS Ã¢â‚¬â€ seed canonico 1|1|1|1"

if (-not $Fast) {

    Write-Host ""
    Write-Host "npm ci..."

    npm.cmd ci `
        --no-audit `
        --no-fund

    if ($LASTEXITCODE -ne 0) {
        throw "FAIL Ã¢â‚¬â€ npm ci."
    }

    Write-Host "TypeScript..."

    npm.cmd exec tsc -- --noEmit --incremental false

    if ($LASTEXITCODE -ne 0) {
        throw "FAIL Ã¢â‚¬â€ TypeScript."
    }

    if (Test-Path -LiteralPath ".next") {
        Remove-Item `
            -LiteralPath ".next" `
            -Recurse `
            -Force
    }

    Write-Host "Build..."

    npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "FAIL Ã¢â‚¬â€ build."
    }

    git diff --check

    if ($LASTEXITCODE -ne 0) {
        throw "FAIL Ã¢â‚¬â€ git diff --check."
    }

    Write-Host "PASS Ã¢â‚¬â€ npm ci"
    Write-Host "PASS Ã¢â‚¬â€ TypeScript"
    Write-Host "PASS Ã¢â‚¬â€ build"
}

Write-Host ""
Write-Host "============================================================"
Write-Host "V10 CHECK Ã¢â‚¬â€ PASS"
Write-Host "============================================================"