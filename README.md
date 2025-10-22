# Cardz Digital Punch Cards - Client App

A React Native/Expo application for digital punch cards system.

## 🚀 Production Setup

This project uses **GitHub Secrets** for secure configuration management. See [Production Setup Guide](docs/PRODUCTION_SETUP.md) for details.

## 📱 Features

- Digital punch cards for businesses
- Real-time updates via Supabase
- Push notifications via Firebase Cloud Messaging (FCM)
- Multi-business support
- Customer authentication
- In-app notification mailbox

## 🛠️ Tech Stack

- React Native with Expo
- TypeScript
- Supabase for backend
- Firebase for push notifications
- React Navigation

## 🔧 Setup Instructions

### Prerequisites

- Node.js 18+
- Android Studio (for Android development)
- Expo CLI

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/rordan-ai/cardz_client_app.git
   cd cardz_client_app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Get `google-services.json` from Firebase Console
   - Place it in `android/app/` directory
   - ⚠️ Never commit this file!

4. **Configure Environment Variables** (Optional)
   - Copy `env.example` to `.env`
   - Update with your values

5. **Start the development server**
   ```bash
   npx expo start
   ```

6. **Run on Android**
   ```bash
   npx expo run:android
   ```

## 🚀 Production Deployment

### GitHub Actions Setup

1. Add the following secrets to your GitHub repository:
   - `GOOGLE_SERVICES_JSON` - Contents of your google-services.json file
   - `SUPABASE_URL` (optional)
   - `SUPABASE_ANON_KEY` (optional)

2. Push to main branch to trigger automatic build

3. Download APK from GitHub Actions artifacts

See [Production Setup Guide](docs/PRODUCTION_SETUP.md) for detailed instructions.

## 📁 Project Structure

```
├── app/                    # Main application screens
│   ├── (tabs)/            # Tab screens
│   └── _layout.tsx        # Root layout with FCM setup
├── components/            # Reusable components
├── assets/               # Images, fonts, etc.
├── android/              # Android-specific code
└── docs/                 # Documentation
```

## 🔐 Security

- API keys are managed via GitHub Secrets
- `google-services.json` is gitignored
- Environment variables for sensitive data
- Secure production build process

## 📄 License

Private repository - All rights reserved