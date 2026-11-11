param([switch]$Administrator)
$ErrorActionPreference='Stop'

function Test-PowerToolAdministrator {
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
    return (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-PowerToolDriverStationAdministrator {
    $stations=@(Get-Process -Name DriverStation -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 })
    if ($stations.Count -eq 0) { return $false }
    if (-not ('PowerToolLaunchPermissions' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PowerToolLaunchPermissions {
    [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint process);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
    [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int kind,out int value,int size,out int length);
    public static bool Elevated(uint processId) {
        IntPtr process=OpenProcess(0x1000,false,processId),token=IntPtr.Zero;
        if(process==IntPtr.Zero)throw new InvalidOperationException("Cannot inspect Driver Station privileges.");
        try {
            int elevated,length;
            if(!OpenProcessToken(process,8,out token)||!GetTokenInformation(token,20,out elevated,4,out length))
                throw new InvalidOperationException("Cannot inspect Driver Station privileges.");
            return elevated!=0;
        } finally {if(token!=IntPtr.Zero)CloseHandle(token);CloseHandle(process);}
    }
}
'@
    }
    foreach ($station in $stations) {
        try { if ([PowerToolLaunchPermissions]::Elevated([uint32]$station.Id)) { return $true } }
        catch {
            # A protected DS process may deny token inspection to an unelevated caller.
            return $true
        }
    }
    return $false
}

function Start-PowerTool {
    param([Parameter(Mandatory=$true)][string]$ProjectRoot,[switch]$Administrator)
    $executable=Join-Path $ProjectRoot 'power-tool\app\Power Tool.exe'
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw "Prebuilt Power Tool is missing: $executable" }
    $launch=@{FilePath=$executable;WorkingDirectory=$ProjectRoot;WindowStyle='Normal'}
    if (-not (Test-PowerToolAdministrator)) {
        if ($Administrator -or (Test-PowerToolDriverStationAdministrator)) {
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
