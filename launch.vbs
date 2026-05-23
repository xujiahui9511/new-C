Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = appDir
shell.Run Chr(34) & appDir & "\node.exe" & Chr(34) & " server.js", 0, False
WScript.Sleep 1800
shell.Run "powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & appDir & "\launch-window.ps1" & Chr(34), 0, False
