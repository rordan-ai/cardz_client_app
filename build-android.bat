@echo off
echo Creating local.properties...
echo sdk.dir=C:\\Users\\rorda\\AppData\\Local\\Android\\Sdk > android\local.properties

echo Running build...
cd android
call gradlew assembleDebug
cd ..

echo Done!

