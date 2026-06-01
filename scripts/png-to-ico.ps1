# Convert a square source PNG into a multi-resolution Windows .ico (PNG-compressed
# entries) plus a clean 256px icon.png. High-quality bicubic resampling.
param(
  [string]$Source = "$PSScriptRoot\..\build\logo-source.png",
  [string]$IcoOut = "$PSScriptRoot\..\build\icon.ico",
  [string]$PngOut = "$PSScriptRoot\..\build\icon.png"
)

Add-Type -AssemblyName System.Drawing

$sizes = 16, 24, 32, 48, 64, 128, 256
$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))

function Resize-Png([System.Drawing.Image]$img, [int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($img, 0, 0, $size, $size)
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  return ,$ms.ToArray()
}

# Build PNG byte arrays for each size.
$pngs = @{}
foreach ($s in $sizes) { $pngs[$s] = Resize-Png $src $s }

# Save the standalone 256 png.
[System.IO.File]::WriteAllBytes((Join-Path (Split-Path $PngOut -Parent) (Split-Path $PngOut -Leaf)), $pngs[256])

# Assemble the ICO container.
$fs = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($fs)
# ICONDIR
$bw.Write([UInt16]0)            # reserved
$bw.Write([UInt16]1)            # type = icon
$bw.Write([UInt16]$sizes.Count) # count
$offset = 6 + (16 * $sizes.Count)
foreach ($s in $sizes) {
  $data = $pngs[$s]
  $bw.Write([Byte]($(if ($s -ge 256) { 0 } else { $s })))  # width
  $bw.Write([Byte]($(if ($s -ge 256) { 0 } else { $s })))  # height
  $bw.Write([Byte]0)            # palette
  $bw.Write([Byte]0)            # reserved
  $bw.Write([UInt16]1)          # planes
  $bw.Write([UInt16]32)         # bpp
  $bw.Write([UInt32]$data.Length)
  $bw.Write([UInt32]$offset)
  $offset += $data.Length
}
foreach ($s in $sizes) { $bw.Write($pngs[$s]) }
$bw.Flush()
[System.IO.File]::WriteAllBytes((Resolve-Path -LiteralPath (Split-Path $IcoOut -Parent)).Path + "\" + (Split-Path $IcoOut -Leaf), $fs.ToArray())
$bw.Dispose()
$src.Dispose()

Write-Output ("ICO_OK sizes={0} bytes={1}" -f ($sizes -join ','), (Get-Item $IcoOut).Length)
