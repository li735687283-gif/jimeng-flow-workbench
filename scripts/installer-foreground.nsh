; MO.K 安装程序启动置顶
;
; 背景：自动更新下载完成后由应用拉起安装器，新进程常被 Windows 前台锁
; （foreground lock）挡在后台：SetForegroundWindow 直接失败，BringToFront
; 也只影响自身进程内的 Z 序，0.2.8 实测仍不到最上层。
;
; 组合方案（GUIINIT 回调 = MUI 窗口创建完成、$HWNDPARENT 有效的最早时机）：
;   1. BringToFront / SetForegroundWindow 兜底（前台锁下多半失败，保留无害）；
;   2. SwitchToThisWindow 走 Alt+Tab 激活路径，前台锁下比 SetForegroundWindow 可靠；
;   3. SetWindowPos(HWND_TOPMOST) 直接改 Z 序——前台锁管不到 TOPMOST，
;      这是「必定压过所有窗口」的关键一步。
;
; TOPMOST 的取消：不设定时器（NSIS 定时回调既脆弱又过度），改为用户点击
; 「安装」进入安装段（customInstall）时取消——此时用户显然已在操作安装器，
; 继续置顶只会挡住别的窗口。向导停留期间保持置顶正是本次要的效果。
;
; 本文件通过 package.json build.nsis.include 接入 electron-builder。

!define MUI_CUSTOMFUNCTION_GUIINIT mokInstallerGuiInit

Function mokInstallerGuiInit
  ; 1) 兜底：前台锁下多半失败，但正常双击启动时就是它们生效
  BringToFront
  System::Call "user32::SetForegroundWindow(i $HWNDPARENT)"
  ; 2) Alt+Tab 级激活（参数 1 = 同时还原最小化）
  System::Call "user32::SwitchToThisWindow(i $HWNDPARENT, i 1)"
  ; 3) 设为 TOPMOST：-1 = HWND_TOPMOST；
  ;    flags = SWP_NOSIZE(0x0001)|SWP_NOMOVE(0x0002)|SWP_SHOWWINDOW(0x0040) = 0x0043
  System::Call "user32::SetWindowPos(i $HWNDPARENT, i -1, i 0, i 0, i 0, i 0, i 0x0043)"
FunctionEnd

; 进入安装段后取消置顶：-2 = HWND_NOTOPMOST；
; flags = SWP_NOSIZE(0x0001)|SWP_NOMOVE(0x0002)|SWP_NOACTIVATE(0x0010) = 0x0013
!macro customInstall
  System::Call "user32::SetWindowPos(i $HWNDPARENT, i -2, i 0, i 0, i 0, i 0, i 0x0013)"

  ; 升级安装时 electron-builder 会保留旧快捷方式，Windows 又按 EXE 路径缓存图标。
  ; 改用独立 ICO 路径并重建快捷方式，确保缓存键发生变化。
  ${if} ${FileExists} "$newDesktopLink"
    Delete "$newDesktopLink"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\resources\icons\app-icon-cat-round-v1.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${endIf}
  ${if} ${FileExists} "$newStartMenuLink"
    Delete "$newStartMenuLink"
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\resources\icons\app-icon-cat-round-v1.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  ${endIf}

  System::Call "shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)"
  ExecWait '"$SYSDIR\ie4uinit.exe" -show'
!macroend

; .onInit 兜底（此时窗口可能尚未创建，调用无害）
!macro customInit
  BringToFront
!macroend
