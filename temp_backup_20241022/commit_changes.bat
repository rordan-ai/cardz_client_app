@echo off
echo Adding changes to git...
git add .

echo.
echo Committing changes...
git commit -m "fix: hamburger menu touch area positioning and sizing

- Fixed hamburger menu touch area in business_selector
- Adjusted position down by 4%% and increased size by 20%%
- Restored original UI in customers-login screen
- Improved touch responsiveness for hamburger menu

Mobile: 47x47px at top:162px
Tablet: 66x66px at top:106px"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo Git commit completed successfully!
pause 