// Windows input stays confined to the verified Driver Station main window.
export const driverStationNative = String.raw`using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Text;
public static class CharacterizationDsKeys {
 [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public InputUnion data; }
 [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public KEYBDINPUT keyboard; [FieldOffset(0)] public MOUSEINPUT mouse; }
 [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort key, scan; public uint flags, time; public UIntPtr extra; }
 [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int x,y; public uint data,flags,time; public UIntPtr extra; }
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
 [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")] static extern bool IsWindowEnabled(IntPtr window);
 delegate bool EnumWindowCallback(IntPtr window,IntPtr context);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowCallback callback,IntPtr context);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window,StringBuilder text,int length);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window,StringBuilder text,int length);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
 [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr window);
 [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr window, uint flags);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
 [DllImport("user32.dll",SetLastError=true)] static extern bool AttachThreadInput(uint from, uint to, bool attach);
 [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
 [DllImport("kernel32.dll")] static extern uint GetCurrentProcessId();
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint process);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token, int kind, out int value, int size, out int length);
 [DllImport("user32.dll",SetLastError=true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);
 [DllImport("user32.dll")] static extern uint MapVirtualKey(uint code,uint mapType);
 public static uint WindowProcessId(IntPtr window) { uint process; GetWindowThreadProcessId(window,out process); return process; }
 public static int MainWindowScore(string title,string windowClass) {
  if(title.StartsWith("FRC Driver Station - Version ",StringComparison.OrdinalIgnoreCase)||title.Equals("FRC Driver Station",StringComparison.OrdinalIgnoreCase))
   return windowClass.Equals("LVDChild",StringComparison.Ordinal)?3:2;
  return title.Equals("DriverStation",StringComparison.OrdinalIgnoreCase)?1:0;
 }
 public static IntPtr ResolveMainWindow(uint processId) {
  IntPtr selected=IntPtr.Zero;int highest=0,matches=0;
  // NI's visible control panel is a LabVIEW-owned top-level window. .NET's
  // Process.MainWindowHandle commonly points to its separate LVFrame wrapper.
  EnumWindows((window,context)=>{
   if(WindowProcessId(window)!=processId||!IsWindowVisible(window))return true;
   var title=new StringBuilder(512);var windowClass=new StringBuilder(256);
   GetWindowText(window,title,512);GetClassName(window,windowClass,256);
   int score=MainWindowScore(title.ToString(),windowClass.ToString());
   if(score>highest){selected=window;highest=score;matches=1;}
   else if(score>0&&score==highest)matches++;
   return true;
  },IntPtr.Zero);
  if(selected==IntPtr.Zero||matches!=1)throw new Exception("Could not identify one visible FRC Driver Station control panel. Open its main panel and retry. No keys were sent.");
  if(!IsWindowEnabled(selected))throw new Exception("Driver Station's main panel is blocked by a dialog. Close the dialog and retry. No keys were sent.");
  return selected;
 }
 public static bool ProcessElevated(uint processId) {
  IntPtr process=OpenProcess(0x1000,false,processId),token=IntPtr.Zero;
  if(process==IntPtr.Zero)throw new Exception("Cannot inspect Driver Station permissions. Run both apps under the same Windows user.");
  try {
   int elevated,length;
   if(!OpenProcessToken(process,8,out token)||!GetTokenInformation(token,20,out elevated,4,out length))
    throw new Exception("Cannot inspect Driver Station permissions. Run both apps under the same Windows user.");
   return elevated!=0;
  } finally { if(token!=IntPtr.Zero)CloseHandle(token);CloseHandle(process); }
 }
 static bool IsTarget(IntPtr window,uint processId) {
  return IsWindow(window)&&WindowProcessId(window)==processId;
 }
 static bool IsForegroundTarget(IntPtr window,uint processId) {
  IntPtr foreground=GetForegroundWindow();
  return IsTarget(window,processId)&&WindowProcessId(foreground)==processId&&GetAncestor(foreground,2)==GetAncestor(window,2);
 }
 public static void Focus(IntPtr window,uint processId) {
  if(!IsTarget(window,processId))throw new Exception("Driver Station window changed or closed. Reopen it and retry. No keys were sent.");
  if(ProcessElevated(processId)&&!ProcessElevated(GetCurrentProcessId()))
   throw new Exception("Driver Station is running as administrator and Power Tool is not. Run both at the same privilege level, then retry. No keys were sent.");
  if(IsForegroundTarget(window,processId))return;
  if(IsIconic(window))ShowWindow(window,9);
  SetForegroundWindow(window);
  for(int attempt=0;attempt<4;attempt++) {
   if(IsForegroundTarget(window,processId))return;
   IntPtr foreground=GetForegroundWindow();uint ignored;
   uint current=GetCurrentThreadId(),foregroundThread=GetWindowThreadProcessId(foreground,out ignored),targetThread=GetWindowThreadProcessId(window,out ignored);
   bool foregroundAttached=false,targetAttached=false;
   try {
    if(foregroundThread!=0&&foregroundThread!=current)foregroundAttached=AttachThreadInput(current,foregroundThread,true);
    if(targetThread!=0&&targetThread!=current&&targetThread!=foregroundThread)targetAttached=AttachThreadInput(current,targetThread,true);
    BringWindowToTop(window);SetForegroundWindow(window);
   } finally {
    if(targetAttached)AttachThreadInput(current,targetThread,false);
    if(foregroundAttached)AttachThreadInput(current,foregroundThread,false);
   }
   Thread.Sleep(100);
  }
  if(!IsForegroundTarget(window,processId))throw new Exception("Driver Station could not receive keyboard focus. Close any Driver Station popup, click its main window, and retry. No keys were sent. Foreground PID="+WindowProcessId(GetForegroundWindow())+", Driver Station PID="+processId+".");
 }
 public const int ShortcutHoldMilliseconds=200;
 public static INPUT[] BuildChord(ushort[] keys,bool release) {
  var inputs=new INPUT[keys.Length];
  for(int i=0;i<keys.Length;i++) {
   ushort scan=(ushort)MapVirtualKey(keys[release?keys.Length-1-i:i],0);
   if(scan==0)throw new Exception("Cannot map the Driver Station shortcut to keyboard scan codes.");
   inputs[i].type=1;inputs[i].data.keyboard.scan=scan;inputs[i].data.keyboard.flags=(uint)(8|(release?2:0));
  }
  return inputs;
 }
 // Keep a real interval between down/up so Driver Station can observe the whole
 // chord, rather than delivering an instantaneous press and release.
 public static void DeliverChord(ushort[] keys,Action<INPUT[]> send,Action<int> pause) {
  var down=BuildChord(keys,false);var up=BuildChord(keys,true);Exception failure=null;
  try {send(down);pause(ShortcutHoldMilliseconds);}catch(Exception error){failure=error;}
  finally {try{send(up);}catch(Exception error){if(failure==null)failure=error;}}
  if(failure!=null)throw failure;
 }
 public static void PressForWindow(IntPtr window,uint processId,ushort[] keys) {
  if(!IsForegroundTarget(window,processId))throw new Exception("Driver Station lost keyboard focus before the shortcut. No keys were sent.");
  DeliverChord(keys,inputs=>{
   if(SendInput((uint)inputs.Length,inputs,Marshal.SizeOf(typeof(INPUT)))!=inputs.Length)
    throw new Exception("Windows did not deliver the full Driver Station shortcut (error "+Marshal.GetLastWin32Error()+"). Check Driver Station is Disabled and both apps use the same privilege level.");
  },Thread.Sleep);
 }
}`;
