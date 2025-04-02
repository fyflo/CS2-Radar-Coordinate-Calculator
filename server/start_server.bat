@echo off
title CS:GO/CS2 Radar Server

echo Starting CS:GO/CS2 Radar Server...
echo.

cd /d "%~dp0"

:: Проверка наличия Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Node.js не найден! Пожалуйста, установите Node.js с сайта https://nodejs.org/
    echo.
    pause
    exit /b
)

:: Запуск сервера в фоновом режиме
start /b node server.js

:: Ждем немного, чтобы сервер успел запуститься
timeout /t 2 /nobreak >nul

:: Открываем браузер
echo Открываем радар в браузере...
start http://localhost:1350

echo.
echo Сервер запущен на порту 1350
echo.
echo Нажмите любую клавишу для остановки сервера
echo.

pause

:: Останавливаем сервер
taskkill /f /im node.exe >nul 2>nul
echo Сервер остановлен.
timeout /t 2 >nul