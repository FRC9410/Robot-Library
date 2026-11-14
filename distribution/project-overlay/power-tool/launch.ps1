param([switch]$Administrator)
$ErrorActionPreference='Stop'

function Test-PowerToolAdministrator {
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
    return (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Start-PowerTool {
    param([Parameter(Mandatory=$true)][string]$ProjectRoot,[switch]$Administrator)
    $executable=Join-Path $ProjectRoot 'power-tool\app\Power Tool.exe'
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw "Prebuilt Power Tool is missing: $executable" }
    $launch=@{FilePath=$executable;WorkingDirectory=$ProjectRoot;WindowStyle='Normal'}
    if (-not (Test-PowerToolAdministrator)) {
        if ($Administrator) {
            Write-Host 'Requesting administrator access for Power Tool. Approve the Windows UAC prompt to continue.'
            $launch.Verb='RunAs'
        }
    }
    try { Start-Process @launch }
    catch {
        if ($_.Exception.NativeErrorCode -eq 1223 -or $_.Exception.InnerException.NativeErrorCode -eq 1223) {
            throw 'Administrator launch was canceled. Power Tool was not started.'
        }
        throw
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    try { Start-PowerTool -ProjectRoot (Split-Path -Parent $PSScriptRoot) -Administrator:$Administrator }
    catch { Write-Error $_; exit 1 }
}
