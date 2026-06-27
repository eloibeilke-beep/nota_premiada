@echo off
cd /d "c:\Users\eloib\OneDrive\Área de Trabalho\sorteio ultimo"
uvicorn main:app --host 0.0.0.0 --port 8000
