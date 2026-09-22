@echo off
rem Abre o site da Target Connecta no navegador (servidor local na porta 3073).
cd /d "%~dp0"
start "" http://localhost:3073
node scripts\serve.mjs 3073
