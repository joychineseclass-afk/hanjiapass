@echo off
cd /d "%~dp0"

echo Restoring main to match restore-full-stable...
echo.

git checkout main
if errorlevel 1 goto err

git checkout restore-full-stable -- .
git add -A
git commit -m "restore main to match restore-full-stable"

echo.
echo Done. main now matches restore-full-stable.
git log -1 --oneline
goto end

:err
echo Error: Git command failed. Please run in Git Bash or ensure Git is in PATH.
pause
exit /b 1

:end
pause
