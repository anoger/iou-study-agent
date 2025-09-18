@echo off
title Virtual Agent Experiment

echo ========================================
echo   Virtual Agent Experiment - Launcher
echo ========================================
echo.

:: Vérifier si Node.js est installé
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installé !
    echo Veuillez installer Node.js depuis https://nodejs.org/
    pause
    exit /b 1
)

:: Se déplacer dans le répertoire de l'application
cd /d %~dp0

:: Vérifier si node_modules existe
if not exist "node_modules" (
    echo [INFO] Première installation détectée...
    echo Installation des dépendances...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERREUR] Échec de l'installation des dépendances
        pause
        exit /b 1
    )
    echo.
    echo [OK] Installation terminée !
    echo.
)

:: Vérifier la présence des médias
set "missing_media=0"

if not exist "assets\videos\idle.mp4" (
    echo [ATTENTION] Fichier manquant : assets\videos\idle.mp4
    set "missing_media=1"
)

if not exist "assets\audio\idle.wav" (
    echo [ATTENTION] Fichier manquant : assets\audio\idle.wav
    set "missing_media=1"
)

if "%missing_media%"=="1" (
    echo.
    echo [AVERTISSEMENT] Des fichiers médias sont manquants !
    echo Veuillez ajouter tous les fichiers nécessaires dans :
    echo   - assets\videos\ (fichiers .mp4)
    echo   - assets\audio\ (fichiers .wav)
    echo.
    echo Continuer quand même ? (O/N)
    choice /c ON /n
    if errorlevel 2 exit /b 0
)

:: Menu de sélection
echo.
echo Choisir le mode de lancement :
echo.
echo   1. Mode Production (Recommandé pour l'expérience)
echo   2. Mode Développement (Avec outils de debug)
echo   3. Build Exécutable Windows
echo   4. Quitter
echo.

choice /c 1234 /n /m "Votre choix : "

if errorlevel 4 exit /b 0
if errorlevel 3 goto build
if errorlevel 2 goto dev
if errorlevel 1 goto prod

:prod
echo.
echo [INFO] Lancement en mode PRODUCTION...
echo.
call npm start
goto end

:dev
echo.
echo [INFO] Lancement en mode DÉVELOPPEMENT...
echo.
call npm run dev
goto end

:build
echo.
echo [INFO] Création de l'exécutable Windows...
echo Cela peut prendre plusieurs minutes...
echo.
call npm run build
if %errorlevel% equ 0 (
    echo.
    echo [OK] Build terminé !
    echo L'installateur se trouve dans le dossier 'dist'
    explorer dist
) else (
    echo.
    echo [ERREUR] Le build a échoué
)
goto end

:end
echo.
pause
