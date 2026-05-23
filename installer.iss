[Setup]
AppName=C盘安心管家
AppVersion=1.2
AppPublisher=屿川
DefaultDirName={userappdata}\CpanCleaner
DefaultGroupName=C盘安心管家
OutputDir=C:\Users\Administrator\Desktop\C盘安心管家安装器
OutputBaseFilename=C盘安心管家-安装包-v1.2
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
UninstallDisplayName=C盘安心管家

[Files]
Source: "C:\Users\Administrator\Desktop\C盘安心管家发布版\C盘安心管家-v1.2\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autodesktop}\C盘安心管家"; Filename: "{app}\launch.vbs"; WorkingDir: "{app}"; IconFilename: "{sys}\cleanmgr.exe"
Name: "{group}\C盘安心管家"; Filename: "{app}\launch.vbs"; WorkingDir: "{app}"; IconFilename: "{sys}\cleanmgr.exe"
Name: "{group}\卸载C盘安心管家"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\launch.vbs"; Description: "启动 C盘安心管家"; Flags: nowait postinstall skipifsilent
