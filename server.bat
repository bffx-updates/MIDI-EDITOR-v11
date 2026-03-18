@echo off
cd /d "C:\Users\BrancoBilly\Documents\Arduino\BFMIDI_v11_1\bfmidi-editor_codex"
set /a PORT=8000 + %RANDOM% %% 1000
echo Iniciando servidor na porta %PORT%...
start chrome http://localhost:%PORT%
python -m http.server %PORT%
pause