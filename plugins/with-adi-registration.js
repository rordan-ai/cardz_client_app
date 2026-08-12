const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * מזריק את קובץ אימות המפתחים של Android (adi-registration.properties) לתוך
 * android/app/src/main/assets/ בזמן prebuild — כדי שיישרד גם כש-EAS מרגֵנֵרֵט
 * את תיקיית android/ בענן (קובץ שמונח ידנית נמחק ב-prebuild).
 *
 * התוכן = ה-challenge/מזהה הייחודי מדף "אימות מפתחים של Android" ב-Play Console.
 * ה-APK שנחתם עם המפתח הנכון + מכיל את הקובץ הזה = הוכחת בעלות על מפתח החתימה.
 * הקובץ הזה משמש רק לאימות — לא רלוונטי לפונקציונליות של האפליקציה.
 */
const ADI_REGISTRATION_ID = 'DEI2PCY66EW2IAAAAAAAAAAAAA';

module.exports = function withAdiRegistration(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const assetsDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets'
      );
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.writeFileSync(
        path.join(assetsDir, 'adi-registration.properties'),
        ADI_REGISTRATION_ID
      );
      return cfg;
    },
  ]);
};
