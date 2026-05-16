@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title Chico Sapateiro

echo =============================================
echo   CHICO SAPATEIRO - Iniciando sistema...
echo =============================================
echo.

REM ---- Verificar Python ----
set PYTHON_CMD=
for %%P in (py python python3) do (
    if "!PYTHON_CMD!"=="" (
        %%P --version >nul 2>&1
        if not errorlevel 1 set PYTHON_CMD=%%P
    )
)

if "!PYTHON_CMD!"=="" (
    echo [ERRO] Python nao encontrado!
    echo.
    echo Para instalar o Python:
    echo  1. Acesse: https://www.python.org/downloads/
    echo  2. Clique em "Download Python" (botao amarelo)
    echo  3. Na instalacao, MARQUE a opcao "Add Python to PATH"
    echo  4. Conclua a instalacao e rode este arquivo novamente
    echo.
    pause
    exit /b 1
)

echo Python encontrado: !PYTHON_CMD!

REM ---- Backend ----
cd /d "%~dp0backend"

IF NOT EXIST venv (
    echo Criando ambiente virtual Python...
    !PYTHON_CMD! -m venv venv
    IF errorlevel 1 (
        echo [ERRO] Falha ao criar venv. Tente rodar como Administrador.
        pause
        exit /b 1
    )
)

echo Iniciando backend (porta 8000)...
start "Backend - Chico Sapateiro" cmd /k "cd /d "%~dp0backend" && venv\Scripts\activate && pip install -r requirements.txt -q && !PYTHON_CMD! seed.py && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo Aguardando backend...
timeout /t 8 /nobreak > nul

REM ---- Frontend ----
cd /d "%~dp0frontend"
echo Iniciando frontend (porta 5173)...
start "Frontend - Chico Sapateiro" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 4 /nobreak > nul

echo.
echo =============================================
echo  Sistema iniciado com sucesso!
echo.
echo  Acesse no PC:      http://localhost:5173
echo  Acesse na rede:   http://192.168.1.101:5173
echo  Login:  chico
echo  Senha:  sapateiro123
echo =============================================
echo.
start http://localhost:5173
pause