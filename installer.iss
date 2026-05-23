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
SetupIconFile=C:\Users\Administrator\Desktop\C盘安心管家发布版\C盘安心管家-v1.2\assets\app-icon-pure.ico
UninstallDisplayIcon={app}\assets\app-icon-pure.ico

[Files]
Source: "C:\Users\Administrator\Desktop\C盘安心管家发布版\C盘安心管家-v1.2\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autodesktop}\C盘安心管家"; Filename: "{cmd}"; Parameters: "/c start """" wscript ""{app}\launch.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\app-icon-pure.ico"
Name: "{group}\C盘安心管家"; Filename: "{cmd}"; Parameters: "/c start """" wscript ""{app}\launch.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\app-icon-pure.ico"
Name: "{group}\卸载C盘安心管家"; Filename: "{uninstallexe}"

