@echo off
chcp 65001 >nul
title Build Bảng Giá T&T

echo.
echo  ========================================
echo   BUILD FILE CAI DAT (.exe)
echo   Bảng Giá T^&T
echo  ========================================
echo.
echo  Chon che do:
echo    1. Build thong thuong (dist-electron\, KHONG tu dong update)
echo    2. Build + Publish len GitHub (user tu dong nhan update)
echo.
set /p MODE="Nhap 1 hoac 2: "
echo.

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [LOI] Chua cai Node.js. Tai tai: https://nodejs.org
  pause
  exit /b 1
)

echo [1/3] Cai dependencies...
call npm install
if errorlevel 1 (
  echo [LOI] npm install that bai.
  pause
  exit /b 1
)

echo.
echo [2/3] Build ung dung...

if "%MODE%"=="2" (
  echo.
  echo  --- PUBLISH MODE ---
  echo  Can bien moi truong GH_TOKEN (GitHub Personal Access Token)
  echo  Neu chua set, dat lenh nay truoc:
  echo    set GH_TOKEN=ghp_xxxxxxxxxxxx
  echo.
  if "%GH_TOKEN%"=="" (
    set /p GH_TOKEN="Nhap GitHub Token: "
  )
  call npm run release
) else (
  call npm run dist
)

if errorlevel 1 (
  echo [LOI] Build that bai.
  pause
  exit /b 1
)

echo.
echo [3/3] Hoan tat!
echo.
echo  File cai dat nam trong: dist-electron\
echo  - BangGia-TT-Setup-X.X.X.exe  ^(cai dat cho may khac^)

if "%MODE%"=="2" (
  echo.
  echo  Da publish len GitHub Releases!
  echo  User chi can chay app cu, se tu dong nhan thong bao cap nhat.
)

echo.
explorer "dist-electron"
pause
