# AGENTS.md

## Cursor Cloud specific instructions

### Overview
Cardz is a React Native / Expo (SDK 54) mobile loyalty-card app. The backend is fully hosted on **Supabase** (no local backend). For local development the only service to run is the **Expo Metro bundler** in web mode.

### Running the app (web)
```bash
npx expo start --web --port 8081
```
The dev server starts on `http://localhost:8081`. No Docker, no local database required.

### Lint
```bash
npx expo lint
```
Pre-existing warnings/errors exist in the codebase (unused vars, Deno edge-function types). These are not regressions.

### TypeScript
```bash
npx tsc --noEmit
```
Edge functions under `edge-functions/` and `supabase/functions/` use Deno imports and will always fail Node.js tsc. This is expected.

### Environment variables
A `.env` file is required at the project root with:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Copy `.env.example` and fill in real values for full functionality. Without real Supabase credentials the UI renders but data-dependent screens show loading states.

### Non-obvious caveats
- Use `--non-interactive` flag or `CI=1` env when starting Expo in headless/CI environments; Expo warns that `--non-interactive` is not supported and suggests `CI=1`.
- The `react-native-svg-barcode` package has an invalid exports config causing a fallback warning during bundling — this is harmless.
- No automated test suite exists in the repository (no Jest, no Vitest, no test scripts).
- The package manager is **npm** (lockfile: `package-lock.json`).
