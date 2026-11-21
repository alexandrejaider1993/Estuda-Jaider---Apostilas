@echo off
chcp 65001 >nul
python verificar_apostilas.py
if errorlevel 1 (
    echo.
    echo [BLOQUEADO] Corrija os erros acima antes de publicar.
    pause
    exit /b 1
)
python atualizar_catalogo.py
git pull
git add .
git commit -m "Atualizacao automatica"
git push
pause