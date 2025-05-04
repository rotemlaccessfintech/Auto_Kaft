$WshShell = New-Object -ComObject WScript.Shell
$StartupFolder = [System.Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupFolder "CLI-Command-UI.lnk"
$TargetPath = Join-Path $PSScriptRoot "startup-app.cmd"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "CLI Command UI Application"
$Shortcut.Save()

Write-Host "Startup shortcut created successfully at: $ShortcutPath" 