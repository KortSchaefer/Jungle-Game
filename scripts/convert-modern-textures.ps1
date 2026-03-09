param(
  [string]$SourceDir = "src/main/graphics",
  [string]$Pattern = "new*.png",
  [int]$WhiteThreshold = 245,
  [switch]$SkipBackup,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Resolve-FullPath {
  param([string]$PathValue)
  return [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\$PathValue"))
}

function Test-IsNearWhite {
  param(
    [System.Drawing.Color]$ColorValue,
    [int]$Threshold
  )
  return $ColorValue.R -ge $Threshold -and $ColorValue.G -ge $Threshold -and $ColorValue.B -ge $Threshold
}

function Convert-EdgeWhiteToTransparent {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [int]$Threshold
  )

  $width = $Bitmap.Width
  $height = $Bitmap.Height
  $visited = New-Object 'bool[,]' $width, $height
  $queue = New-Object 'System.Collections.Generic.Queue[System.Drawing.Point]'

  $enqueueIfCandidate = {
    param([int]$x, [int]$y)
    if ($x -lt 0 -or $x -ge $width -or $y -lt 0 -or $y -ge $height) {
      return
    }
    if ($visited[$x, $y]) {
      return
    }
    $visited[$x, $y] = $true
    $c = $Bitmap.GetPixel($x, $y)
    if (Test-IsNearWhite -ColorValue $c -Threshold $Threshold) {
      $queue.Enqueue([System.Drawing.Point]::new($x, $y))
    }
  }

  for ($x = 0; $x -lt $width; $x += 1) {
    & $enqueueIfCandidate $x 0
    & $enqueueIfCandidate $x ($height - 1)
  }
  for ($y = 0; $y -lt $height; $y += 1) {
    & $enqueueIfCandidate 0 $y
    & $enqueueIfCandidate ($width - 1) $y
  }

  $madeTransparent = 0
  while ($queue.Count -gt 0) {
    $p = $queue.Dequeue()
    $color = $Bitmap.GetPixel($p.X, $p.Y)
    if (-not (Test-IsNearWhite -ColorValue $color -Threshold $Threshold)) {
      continue
    }

    $Bitmap.SetPixel($p.X, $p.Y, [System.Drawing.Color]::FromArgb(0, $color.R, $color.G, $color.B))
    $madeTransparent += 1

    & $enqueueIfCandidate ($p.X - 1) $p.Y
    & $enqueueIfCandidate ($p.X + 1) $p.Y
    & $enqueueIfCandidate $p.X ($p.Y - 1)
    & $enqueueIfCandidate $p.X ($p.Y + 1)
  }

  return $madeTransparent
}

$sourcePath = Resolve-FullPath -PathValue $SourceDir
if (-not (Test-Path $sourcePath)) {
  throw "Source directory not found: $sourcePath"
}

$files = Get-ChildItem -Path $sourcePath -Filter $Pattern -File | Sort-Object Name
if (-not $files -or $files.Count -eq 0) {
  throw "No files matched pattern '$Pattern' in '$sourcePath'"
}

$backupDir = Join-Path $sourcePath "_backup-before-alpha"
if (-not $SkipBackup -and -not $DryRun) {
  if (-not (Test-Path $backupDir)) {
    New-Item -Path $backupDir -ItemType Directory | Out-Null
  }
}

Write-Host "Converting $($files.Count) PNG files in $sourcePath"
Write-Host "White threshold: $WhiteThreshold"

$totalTransparentPixels = 0
foreach ($file in $files) {
  $bitmap = $null
  $working = $null
  $graphics = $null
  try {
    $bitmap = [System.Drawing.Bitmap]::new($file.FullName)
    $working = [System.Drawing.Bitmap]::new($bitmap.Width, $bitmap.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($working)
    $graphics.DrawImage($bitmap, 0, 0, $bitmap.Width, $bitmap.Height)
    $graphics.Dispose()
    $graphics = $null

    $transparentCount = Convert-EdgeWhiteToTransparent -Bitmap $working -Threshold $WhiteThreshold
    $totalTransparentPixels += $transparentCount

    if (-not $DryRun) {
      if (-not $SkipBackup) {
        Copy-Item -Path $file.FullName -Destination (Join-Path $backupDir $file.Name) -Force
      }
      $tempPath = "$($file.FullName).tmp.png"
      if (Test-Path $tempPath) {
        Remove-Item -Path $tempPath -Force
      }
      $working.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
      $working.Dispose()
      $working = $null
      $bitmap.Dispose()
      $bitmap = $null
      Move-Item -Path $tempPath -Destination $file.FullName -Force
    }

    Write-Host ("{0} -> transparent pixels: {1}" -f $file.Name, $transparentCount)
  } finally {
    if ($graphics) { $graphics.Dispose() }
    if ($working) { $working.Dispose() }
    if ($bitmap) { $bitmap.Dispose() }
  }
}

if ($DryRun) {
  Write-Host "Dry run complete. No files were written."
} else {
  Write-Host "Done. Total transparent pixels applied: $totalTransparentPixels"
  if (-not $SkipBackup) {
    Write-Host "Backups saved in: $backupDir"
  }
}
