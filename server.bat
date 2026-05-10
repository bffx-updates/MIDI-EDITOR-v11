@echo off
cd /d "%~dp0"
set /a PORT=8000 + %RANDOM% %% 1000
echo Iniciando servidor na porta %PORT%...
start chrome http://localhost:%PORT%
python -m http.server %PORT%
pause
