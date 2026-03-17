@echo off
REM GitHub Push Script for TraceLink OSINT

echo ========================================
echo TraceLink OSINT - Push to GitHub
echo ========================================
echo.

REM Check if git is available
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if gh is available
where gh >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: GitHub CLI is not installed
    echo Download from: https://cli.github.com
    pause
    exit /b 1
)

echo Checking GitHub authentication...
gh auth status
if %errorlevel% neq 0 (
    echo.
    echo You need to authenticate with GitHub first!
    echo Run: gh auth login
    echo.
    echo Then come back and run this script again.
    pause
    exit /b 1
)

echo.
echo Authenticated with GitHub!
echo.

REM Initialize git if not already
if not exist ".git" (
    echo Initializing git repository...
    git init
    git add .
    git commit -m "Initial TraceLink OSINT Telegram Mini App"
    git branch -M main
)

REM Create and push to GitHub
echo Creating GitHub repository and pushing...
gh repo create tracelink-osint --public --source=. --description "TraceLink OSINT Telegram Mini App" --push

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo SUCCESS! Code pushed to GitHub!
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Go to Render Dashboard
    echo 2. Update osint-api to use new repo
    echo 3. Add environment variables
    echo 4. Deploy will happen automatically
) else (
    echo.
    echo ERROR: Failed to push to GitHub
)

pause
