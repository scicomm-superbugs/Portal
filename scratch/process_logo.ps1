[void][System.Reflection.Assembly]::LoadWithPartialName("System.Drawing")

$sourcePath = "D:\Ai Projects\The Portal\Logo\Superbugs.png"
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source logo does not exist at $sourcePath!"
    exit 1
}

function ResizeImage {
    param(
        [string]$srcPath,
        [string]$destPath,
        [int]$width,
        [int]$height,
        [double]$scalePercent
    )
    
    $destDir = Split-Path $destPath
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    }

    $srcImg = [System.Drawing.Image]::FromFile($srcPath)
    $destBmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    
    # Configure high quality rendering
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    # Clear to transparent
    $g.Clear([System.Drawing.Color]::Transparent)
    
    # Calculate aspect ratio
    $srcRatio = $srcImg.Width / $srcImg.Height
    
    # Calculate max dimensions
    $maxW = $width * $scalePercent
    $maxH = $height * $scalePercent
    
    if ($srcRatio -gt 1) {
        $drawW = $maxW
        $drawH = $maxW / $srcRatio
    } else {
        $drawH = $maxH
        $drawW = $maxH * $srcRatio
    }
    
    # Center
    $x = ($width - $drawW) / 2
    $y = ($height - $drawH) / 2
    
    # Draw
    $rect = New-Object System.Drawing.RectangleF($x, $y, $drawW, $drawH)
    $g.DrawImage($srcImg, $rect)
    
    # Save
    $destBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Clean up
    $g.Dispose()
    $destBmp.Dispose()
    $srcImg.Dispose()
    
    Write-Output "Successfully generated: $destPath ($width x $height)"
}

# Android mipmap targets
$targets = @(
    # MDPI
    @{ dest="android/app/src/main/res/mipmap-mdpi/ic_launcher.png"; w=48; h=48; s=0.85 },
    @{ dest="android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png"; w=48; h=48; s=0.85 },
    @{ dest="android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png"; w=108; h=108; s=0.60 },
    
    # HDPI
    @{ dest="android/app/src/main/res/mipmap-hdpi/ic_launcher.png"; w=72; h=72; s=0.85 },
    @{ dest="android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png"; w=72; h=72; s=0.85 },
    @{ dest="android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png"; w=162; h=162; s=0.60 },
    
    # XHDPI
    @{ dest="android/app/src/main/res/mipmap-xhdpi/ic_launcher.png"; w=96; h=96; s=0.85 },
    @{ dest="android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png"; w=96; h=96; s=0.85 },
    @{ dest="android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png"; w=216; h=216; s=0.60 },
    
    # XXHDPI
    @{ dest="android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png"; w=144; h=144; s=0.85 },
    @{ dest="android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png"; w=144; h=144; s=0.85 },
    @{ dest="android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png"; w=324; h=324; s=0.60 },
    
    # XXXHDPI
    @{ dest="android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"; w=192; h=192; s=0.85 },
    @{ dest="android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png"; w=192; h=192; s=0.85 },
    @{ dest="android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png"; w=432; h=432; s=0.60 },
    
    # Resources icons
    @{ dest="resources/android/icon/drawable-ldpi-icon.png"; w=36; h=36; s=0.85 },
    @{ dest="resources/android/icon/drawable-mdpi-icon.png"; w=48; h=48; s=0.85 },
    @{ dest="resources/android/icon/drawable-hdpi-icon.png"; w=72; h=72; s=0.85 },
    @{ dest="resources/android/icon/drawable-xhdpi-icon.png"; w=96; h=96; s=0.85 },
    @{ dest="resources/android/icon/drawable-xxhdpi-icon.png"; w=144; h=144; s=0.85 },
    @{ dest="resources/android/icon/drawable-xxxhdpi-icon.png"; w=192; h=192; s=0.85 }
)

foreach ($t in $targets) {
    ResizeImage -srcPath $sourcePath -destPath $t.dest -width $t.w -height $t.h -scalePercent $t.s
}
