@echo off
REM captions — Windows shim so `captions video.mp4 --lang pl` works from cmd/PowerShell.
REM Put captions.cmd + captions.ps1 in the same folder on your PATH.
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0captions.ps1" %*
