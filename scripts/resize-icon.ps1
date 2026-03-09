Add-Type -AssemblyName System.Drawing

$iconPath = Join-Path $PSScriptRoot "..\src\main\legacy graphics\monkey.png"
$iconPath = [System.IO.Path]::GetFullPath($iconPath)

$sourceImage = [System.Drawing.Image]::FromFile($iconPath)
if ($sourceImage.Width -ge 256 -and $sourceImage.Height -ge 256) {
  Write-Host "Icon already large enough: $($sourceImage.Width)x$($sourceImage.Height)"
  $sourceImage.Dispose()
  exit 0
}

$resizedBitmap = New-Object System.Drawing.Bitmap 256, 256
$graphics = [System.Drawing.Graphics]::FromImage($resizedBitmap)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.DrawImage($sourceImage, 0, 0, 256, 256)

$sourceImage.Dispose()
$graphics.Dispose()

$tempPath = "$iconPath.tmp.png"
if (Test-Path $tempPath) {
  Remove-Item $tempPath -Force
}

$resizedBitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
$resizedBitmap.Dispose()

Move-Item -Path $tempPath -Destination $iconPath -Force

$finalImage = [System.Drawing.Image]::FromFile($iconPath)
Write-Host "Resized icon to: $($finalImage.Width)x$($finalImage.Height)"
$finalImage.Dispose()
