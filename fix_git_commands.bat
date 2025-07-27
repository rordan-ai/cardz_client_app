@echo off
echo Running git status...
git status

echo.
echo Adding changes...
git add app/(tabs)/customers-login.tsx

echo.
echo Committing changes...
git commit -m "fix: improve hamburger menu responsiveness - final update"

echo.
echo Pushing to repository...
git push origin main

echo.
echo Git operations completed!
pause 