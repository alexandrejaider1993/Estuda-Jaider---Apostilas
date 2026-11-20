@echo off
python atualizar_catalogo.py
git pull
git add .
git commit -m "Atualizacao automatica"
git push
pause