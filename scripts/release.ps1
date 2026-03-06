param(
  [Parameter(Mandatory = $false)]
  [string]$Version,

  [Parameter(Mandatory = $false)]
  [string]$Branch,

  [Parameter(Mandatory = $false)]
  [string]$Message,

  [switch]$SkipVersionBump,
  [switch]$SkipGit
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
Write-Host "Release flow complete for version $currentVersion."
