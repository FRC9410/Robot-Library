@echo off
setlocal DisableDelayedExpansion
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0power-tool\launch.ps1" %*
if errorlevel 1 (
    echo Power Tool could not start. See the error above.
    pause
    exit /b 1
)
