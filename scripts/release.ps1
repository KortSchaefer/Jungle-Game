param(
  [Parameter(Mandatory = $false)]
  [string]$Version,

  [Parameter(Mandatory = $false)]
  [string]$Branch,

  [Parameter(Mandatory = $false)]
  [string]$Message,

  [switch]$SkipVersionBump,
  [switch]$SkipGit,
  [switch]$SkipDiscord
)

$ErrorActionPreference = "Stop"

function Run-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  Write-Host ">> $Command"
  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command"
  }
}

function Get-ChangelogForVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$TargetVersion
  )

  if (-not (Test-Path "CHANGELOG.md")) {
    return "No CHANGELOG.md found."
  }

  $raw = Get-Content "CHANGELOG.md" -Raw
  $escapedVersion = [regex]::Escape($TargetVersion)
  $pattern = "(?ms)^## \[$escapedVersion\].*?(?=^## \[|\z)"
  $match = [regex]::Match($raw, $pattern)

  if ($match.Success) {
    return $match.Value.Trim()
  }

  return "No changelog section found for version $TargetVersion."
}

function Send-DiscordReleaseMessage {
  param(
    [Parameter(Mandatory = $true)]
    [string]$TargetVersion
  )

  if ($SkipDiscord) {
    Write-Host ">> SkipDiscord set; skipping Discord post."
    return
  }

  $webhook = $env:DISCORD_WEBHOOK_URL
  if ([string]::IsNullOrWhiteSpace($webhook)) {
    Write-Host ">> DISCORD_WEBHOOK_URL not set; skipping Discord post."
    return
  }

  $notes = Get-ChangelogForVersion -TargetVersion $TargetVersion
  if ($notes.Length -gt 1800) {
    $notes = $notes.Substring(0, 1800) + "`n...(truncated)"
  }

  $payload = @{
    username = "Jungle Game Releases"
    content  = "Jungle Game v$TargetVersion released.`n`n$notes"
  } | ConvertTo-Json -Depth 5

  try {
    Invoke-RestMethod -Method Post -Uri $webhook -ContentType "application/json" -Body $payload | Out-Null
    Write-Host ">> Posted changelog to Discord."
  } catch {
    Write-Warning "Discord webhook post failed: $($_.Exception.Message)"
  }
}

if (-not $env:GH_TOKEN) {
  throw "GH_TOKEN is not set in this terminal. Set it first: `$env:GH_TOKEN='your_token'"
}

if (-not $SkipVersionBump) {
  if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "Provide -Version x.y.z or use -SkipVersionBump."
  }
  Run-Step "npm version $Version --no-git-tag-version"
}

$pkg = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
$currentVersion = [string]$pkg.version

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "Release v$currentVersion"
}

if (-not $SkipGit) {
  if ([string]::IsNullOrWhiteSpace($Branch)) {
    $detectedBranch = (git rev-parse --abbrev-ref HEAD).Trim()
    if ([string]::IsNullOrWhiteSpace($detectedBranch) -or $detectedBranch -eq "HEAD") {
      throw "Could not detect current git branch. Pass -Branch explicitly."
    }
    $Branch = $detectedBranch
  }

  Run-Step "git add ."
  git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    Run-Step "git commit -m ""$Message"""
  } else {
    Write-Host ">> No staged changes to commit."
  }

  Write-Host ">> Using branch '$Branch' for push."
  Run-Step "git push origin $Branch"
}

Run-Step "npm run dist:publish"
Send-DiscordReleaseMessage -TargetVersion $currentVersion
Write-Host "Release flow complete for version $currentVersion."
