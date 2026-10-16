@echo off
rem Abre Copiloto PO en tu navegador, desde este equipo y sin internet.
rem Deja esta ventana abierta mientras lo usas; cierrala para terminar.
title Copiloto PO
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0lanzador\servidor.ps1"
if errorlevel 1 pause
