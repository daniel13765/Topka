@echo off
setlocal

echo Arret du serveur TOKPa...
taskkill /FI "WINDOWTITLE eq TOKPa - serveur Vite*" /T /F >nul 2>nul
if errorlevel 1 (
  echo Aucune fenetre serveur TOKPa trouvee.
) else (
  echo Serveur TOKPa arrete.
)
pause
exit /b 0
