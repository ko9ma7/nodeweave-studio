@echo off
setlocal
cd /d "%~dp0"
echo [CHECK] Build and validation...
call npm run build || exit /b 1
call npm run check || exit /b 1
git add -A
set /p MSG=Commit message [chore: update NodeWeave Studio]: 
if "%MSG%"=="" set "MSG=chore: update NodeWeave Studio"
git diff --cached --quiet || git commit -m "%MSG%"
git push
echo [OK] Update pushed. GitHub Pages deployment will run automatically.
