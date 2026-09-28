@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

rem ===== Editable defaults =====
set "EXPECTED_OWNER=ko9ma7"
set "REPO_NAME=nodeweave-studio"
set "VISIBILITY=public"
set "DESCRIPTION=SVG-first, local-first diagram editor with design tokens, auto layout, and SVG/PNG/WebP/HTML/JSON export."
set "HOMEPAGE=https://ko9ma7.github.io/nodeweave-studio/"
set "TOPICS=diagram-editor,svg-editor,flowchart,diagram,svg,local-first,github-pages,design-tool,mind-map,system-design,auto-layout,pwa,javascript,no-dependencies"
set "INITIAL_TAG=v1.1.0"
rem =============================

call :check_cmd git "Git"
if errorlevel 1 goto :fail
call :check_cmd node "Node.js"
if errorlevel 1 goto :fail
call :check_cmd npm "npm"
if errorlevel 1 goto :fail
call :check_cmd gh "GitHub CLI"
if errorlevel 1 goto :fail

for /f "delims=" %%v in ('git --version') do echo [OK] %%v
for /f "delims=" %%v in ('node --version') do echo [OK] Node %%v
for /f "delims=" %%v in ('gh --version ^| findstr /b "gh version"') do echo [OK] %%v

gh auth status >nul 2>&1
if errorlevel 1 (
  echo [WARN] GitHub CLI login is required.
  gh auth login
  if errorlevel 1 goto :fail
) else echo [OK] GitHub authentication verified.

for /f "delims=" %%u in ('gh api user --jq .login') do set "GH_OWNER=%%u"
if not defined GH_OWNER (
  echo [ERROR] Could not resolve GitHub account name.
  goto :fail
)
echo [OK] GitHub owner: %GH_OWNER%
if /I not "%GH_OWNER%"=="%EXPECTED_OWNER%" (
  echo [ERROR] This project is configured for GitHub owner %EXPECTED_OWNER%, but gh is authenticated as %GH_OWNER%.
  echo         Run: gh auth switch --user %EXPECTED_OWNER%
  goto :fail
)

if not exist .git (
  echo [CHECK] Initializing Git repository...
  git init
  git branch -M main
) else echo [OK] Existing Git repository found.

for /f "delims=" %%x in ('git config --get user.name') do set "GIT_NAME=%%x"
if not defined GIT_NAME (
  echo [WARN] git user.name is not configured.
  set /p GIT_NAME=Enter Git user.name: 
  git config user.name "!GIT_NAME!"
)
for /f "delims=" %%x in ('git config --get user.email') do set "GIT_EMAIL=%%x"
if not defined GIT_EMAIL (
  echo [WARN] git user.email is not configured.
  set /p GIT_EMAIL=Enter Git user.email: 
  git config user.email "!GIT_EMAIL!"
)

echo [CHECK] Building and verifying project...
call npm run build || goto :fail
call npm run check || goto :fail
echo [OK] Local build passed.

gh repo view "%GH_OWNER%/%REPO_NAME%" >nul 2>&1
if errorlevel 1 (
  echo [CHECK] Creating GitHub repository...
  gh repo create "%GH_OWNER%/%REPO_NAME%" --%VISIBILITY% --description "%DESCRIPTION%" --homepage "%HOMEPAGE%" --disable-wiki --source . --remote origin
  if errorlevel 1 goto :fail
  echo [OK] Repository created.
) else (
  echo [OK] Repository already exists.
  git remote get-url origin >nul 2>&1
  if errorlevel 1 git remote add origin "https://github.com/%GH_OWNER%/%REPO_NAME%.git"
)

gh repo edit "%GH_OWNER%/%REPO_NAME%" --description "%DESCRIPTION%" --homepage "%HOMEPAGE%" --enable-issues --enable-projects=false --enable-wiki=false --enable-discussions=false --enable-squash-merge --enable-merge-commit=false --enable-rebase-merge --allow-update-branch --delete-branch-on-merge >nul 2>&1
if errorlevel 1 echo [WARN] Some repository settings could not be updated automatically.
for %%t in (%TOPICS:,= %) do gh repo edit "%GH_OWNER%/%REPO_NAME%" --add-topic %%t >nul 2>&1


git add -A
for /f %%c in ('git status --porcelain ^| find /c /v ""') do set CHANGES=%%c
if not "!CHANGES!"=="0" (
  git commit -m "feat: launch NodeWeave Studio"
  if errorlevel 1 goto :fail
) else echo [OK] No uncommitted changes.

git branch -M main
git push -u origin main || goto :fail
echo [OK] main branch pushed.

gh api "repos/%GH_OWNER%/%REPO_NAME%/pages" >nul 2>&1
if errorlevel 1 (
  echo [CHECK] Enabling GitHub Pages with Actions...
  gh api -X POST "repos/%GH_OWNER%/%REPO_NAME%/pages" -f build_type=workflow >nul 2>&1
  if errorlevel 1 echo [WARN] Pages may need to be enabled manually: Settings ^> Pages ^> Source = GitHub Actions
) else (
  gh api -X PUT "repos/%GH_OWNER%/%REPO_NAME%/pages" -f build_type=workflow >nul 2>&1
  echo [OK] GitHub Pages already configured.
)

echo [CHECK] Looking for deployment workflow...
set "RUN_ID="
for /f "delims=" %%r in ('gh run list --repo "%GH_OWNER%/%REPO_NAME%" --workflow deploy.yml --limit 1 --json databaseId --jq ".[0].databaseId" 2^>nul') do set "RUN_ID=%%r"
if defined RUN_ID (
  echo [CHECK] Watching Actions run !RUN_ID!...
  gh run watch !RUN_ID! --repo "%GH_OWNER%/%REPO_NAME%" --exit-status
  if errorlevel 1 echo [WARN] Deployment workflow did not complete successfully. Run: gh run view !RUN_ID! --log-failed
) else echo [WARN] Workflow run is not visible yet. Check GitHub Actions in a moment.

git rev-parse "%INITIAL_TAG%" >nul 2>&1
if errorlevel 1 (
  git tag -a "%INITIAL_TAG%" -m "NodeWeave Studio %INITIAL_TAG%"
  git push origin "%INITIAL_TAG%"
  echo [OK] Tag %INITIAL_TAG% created.
) else echo [OK] Tag %INITIAL_TAG% already exists.

echo.
echo [OK] Repository: https://github.com/%GH_OWNER%/%REPO_NAME%
echo [OK] Pages:      %HOMEPAGE%
echo [OK] Bootstrap finished.
exit /b 0

:check_cmd
where %~1 >nul 2>&1
if errorlevel 1 (
  echo [ERROR] %~2 is not installed or not in PATH.
  echo         Install it, reopen the terminal, and run this file again.
  exit /b 1
)
echo [OK] %~2 found.
exit /b 0

:fail
echo.
echo [ERROR] Bootstrap stopped. Review the message above and rerun this file after fixing the issue.
exit /b 1
