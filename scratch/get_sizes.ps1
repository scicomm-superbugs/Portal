[void][System.Reflection.Assembly]::LoadWithPartialName("System.Drawing")
Get-ChildItem -Path android -Recurse -Filter "ic_launcher*.png" | ForEach-Object {
    try {
        $img = [System.Drawing.Image]::FromFile($_.FullName)
        Write-Output "$($_.FullName) : $($img.Width)x$($img.Height)"
        $img.Dispose()
    } catch {
        Write-Output "Error loading $($_.FullName)"
    }
}
