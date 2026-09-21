@echo off
setlocal
cd /d "%~dp0.."

echo ================================================
echo TOKPa - Installation des dependances
echo ================================================

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js est introuvable.
  echo Installez Node.js LTS depuis https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm est introuvable. Verifiez votre installation de Node.js.
  pause
  exit /b 1
)

if not exist ".env" if exist ".env.example" (
  copy /Y ".env.example" ".env" >nul
  echo Fichier .env cree depuis .env.example.
)

call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo Echec de l'installation des dependances.
  pause
  exit /b 1
)

echo.
echo Installation terminee avec succes.
echo Lancez ensuite scripts\lancer-tokpa.bat pour demarrer TOKPa.
pause
exit /b 0
