@echo off
setlocal
cd /d "%~dp0.."

echo ================================================
echo TOKPa - Demarrage de l'application
echo ================================================

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable. Installez Node.js LTS depuis https://nodejs.org.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Dependances absentes : installation automatique...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Echec de l'installation.
    pause
    exit /b 1
  )
)

if not exist ".env" if exist ".env.example" copy /Y ".env.example" ".env" >nul

echo Serveur Vite : http://localhost:5173
echo Fermez la fenetre serveur ou utilisez scripts\arreter-tokpa.bat pour arreter TOKPa.
start "TOKPa - serveur Vite" cmd /k "cd /d %~dp0.. && npm run dev"
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"
exit /b 0
