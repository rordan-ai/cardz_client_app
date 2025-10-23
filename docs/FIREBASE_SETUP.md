# Firebase Setup Guide

## Security Notice

The `google-services.json` file contains sensitive API keys and should **never** be committed to version control.

## Setup Instructions

### For Development

1. Download `google-services.json` from [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to Project Settings
   - Under "Your apps", select your Android app
   - Click "Download google-services.json"

2. Place the file in: `android/app/google-services.json`

3. The file is already in `.gitignore` and will not be committed

### For Production

Keep the `google-services.json` file secure:
- Store it in a secure location (password manager, secure vault)
- Include it manually when building production releases
- Never share it publicly or commit it to version control

## What's Protected

This file contains:
- Firebase API keys
- Project identifiers
- OAuth client information
- Other sensitive configuration data

## Need Help?

If you need to regenerate or download the file, visit the Firebase Console.

