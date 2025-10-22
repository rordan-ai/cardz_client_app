# Production Setup Guide

## GitHub Secrets Configuration

This project uses GitHub Secrets to securely manage sensitive configuration files in production.

### Required Secrets

1. **GOOGLE_SERVICES_JSON**
   - Contains the entire content of `google-services.json` file
   - Get this from Firebase Console → Project Settings → Your Android App

### How to Add Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add the following secrets:

#### GOOGLE_SERVICES_JSON
```
Name: GOOGLE_SERVICES_JSON
Value: [Paste the entire contents of google-services.json]
```

### Local Development

For local development, you still need to:
1. Get `google-services.json` from Firebase Console
2. Place it in `android/app/` directory
3. Never commit this file (it's already in .gitignore)

### CI/CD Pipeline

The GitHub Actions workflow automatically:
1. Creates `google-services.json` from the secret during build
2. Builds the Android app
3. Uploads the APK as an artifact

### Security Benefits

- No sensitive data in repository
- Secrets are encrypted by GitHub
- Access controlled by repository permissions
- Production-ready setup
- Works with automated builds

### Environment Variables (Optional)

If you need additional environment variables, add them as secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `FCM_SERVER_KEY`

Then update the workflow to create `.env` file:

```yaml
- name: Create .env file
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
  run: |
    echo "SUPABASE_URL=$SUPABASE_URL" > .env
    echo "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> .env
```
