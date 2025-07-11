# Windows Installation Guide for SUMmon

## Installation Error Fix

If you get the error "ENOTEMPTY: directory not empty" when installing:

### Method 1: Clean Install
1. Close Claude Desktop completely
2. Open File Explorer and navigate to:
   ```
   C:\Users\[YourUsername]\AppData\Roaming\Claude\Claude Extensions\local.dxt.jonathan-crawford.summon
   ```
3. Delete the entire `local.dxt.jonathan-crawford.summon` folder
4. Restart Claude Desktop
5. Try installing the extension again

### Method 2: Manual Cleanup (if Method 1 fails)
1. Open Command Prompt as Administrator
2. Run these commands:
   ```cmd
   cd %APPDATA%\Claude\Claude Extensions
   rmdir /s /q local.dxt.jonathan-crawford.summon
   ```
3. If that fails with "directory not empty", try:
   ```cmd
   taskkill /f /im claude.exe
   taskkill /f /im node.exe
   rmdir /s /q local.dxt.jonathan-crawford.summon
   ```

### Method 3: Safe Mode
1. Restart Windows in Safe Mode
2. Navigate to the Claude Extensions folder and delete the summon folder
3. Restart normally and reinstall

## Alternative: Manual DXT Installation

If the automatic installation keeps failing:

1. Download the latest quickbooks-mcp.dxt file
2. Open Command Prompt and run:
   ```cmd
   cd %APPDATA%\Claude\Claude Extensions
   mkdir manual-summon
   cd manual-summon
   dxt unpack path\to\quickbooks-mcp.dxt .
   ```
3. Add to Claude Desktop manually via settings

## Common Windows Issues

### Issue: "Access Denied"
- Run Claude Desktop as Administrator
- Check Windows Defender isn't blocking the installation

### Issue: "File in use"
- Close all Claude Desktop windows
- Check Task Manager for any lingering claude.exe or node.exe processes
- Use Process Explorer to find what's locking the files

### Issue: Long path names
Windows has a 260 character path limit. The error shows a very long path which might be hitting this limit. Enable long path support:
1. Open Group Policy Editor (gpedit.msc)
2. Navigate to: Computer Configuration > Administrative Templates > System > Filesystem
3. Enable "Enable Win32 long paths"
4. Restart your computer

## For This Specific Error

The path in your error:
```
D:\Users\jcraw\AppData\Roaming\Claude\Claude Extensions\local.dxt.jonathan-crawford.summon\node_modules\stringify-clone
```

The issue is that Windows can't delete the `stringify-clone` module directory. This is likely because:
1. A file is locked by another process
2. Permissions issue
3. Path length issue

Quick fix:
1. Close Claude Desktop completely
2. Open Task Manager and end any node.exe processes
3. Delete the entire extension folder
4. Reinstall