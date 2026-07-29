; MO.K 安装程序启动置顶
;
; 背景：自动更新下载完成后由应用拉起安装器，新进程常被 Windows 前台锁
; 挡在后台，用户要手动点一下才看得到。
;
; 当前安装器为 assisted 模式（oneClick=false）：窗口创建完成后 MUI2 会
; 回调 MUI_CUSTOMFUNCTION_GUIINIT 指定的函数，此时 $HWNDPARENT 已有效，
; 是置顶的可靠时机（.onInit 里窗口尚未创建，BringToFront 会落空）。
;
; 本文件通过 package.json build.nsis.include 接入 electron-builder。

!define MUI_CUSTOMFUNCTION_GUIINIT mokInstallerGuiInit

Function mokInstallerGuiInit
  BringToFront
  System::Call "user32::SetForegroundWindow(i $HWNDPARENT)"
FunctionEnd

; .onInit 兜底（此时窗口可能尚未创建，调用无害）
!macro customInit
  BringToFront
!macroend
