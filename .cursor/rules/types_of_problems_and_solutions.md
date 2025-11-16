## Types of Problems and Solutions

A practical playbook for engineers and agents. Use this to plan, implement, and verify changes with minimum risk and maximum clarity.

### Table of Contents
- UI Changes (React/React Native)
- React Hooks and Component Flow
- Isolation and Dependencies
- Visibility and Contrast
- WebView/Browser Embeds
- Validation Process (Lint, Build, Regression)
- Dev vs. Prod (ENV, Feature Flags)
- Diagnostics and Logging
- Git Snapshot/Restore Workflow
- Windows PowerShell Notes
- Networking/ENV and URL Rewriting
- Realtime, Lists, and Scrolling Stability
- Push Notifications (FCM) Integration
- Definition of Done

---

### UI Changes (React/React Native)

- Clarify the goal:
  - Is the UI change “always-on” (global) or “conditional” (only when some content exists)?
  - Confirm responsive expectations for phone/tablet/RTL.
- Snapshot first:
  - Create a restore checkpoint/branch before any edits.
- Isolate the change:
  - Prefer a local wrapper View/styles for the visual change; avoid global shared styles.
  - Do not modify business logic when the request is UI-only.
  - Use a non-blocking overlay (pointerEvents: 'none') for decorative frames/borders.
- Keep UI changes visible:
  - Ensure contrast (e.g., white inset behind a black border).
  - Verify it’s visible for both embedded and non-embedded cases.
- RTL/LTR and accessibility:
  - Validate layout mirroring, text alignment, and tap targets.

### React Hooks and Component Flow

- Never place Hooks after an early `return`; Hook order must be identical across renders.
- Keep dependency arrays explicit and minimal; avoid dynamic changes that alter Hook counts.
- Extract conditional effects into memoized callbacks when necessary; the Hook itself must be unconditional.

### Isolation and Dependencies

- Identify all affected components up-front; minimize the blast radius.
- Avoid editing shared/global code for local UI tweaks.
- If a change must touch shared code, document the impact and test all dependents.

### Visibility and Contrast

- Borders must have a contrasting background to be visible in all states.
- Validate on both light and dark content; ensure the decorative layers don’t block interactions.

### WebView/Browser Embeds

- Don’t force `userAgent` or viewport unless strictly necessary (avoid breaking external content).
- For decorative frames, wrap the WebView with inset+border containers; do not overlay the WebView with blocking elements.
- Navigation policies: allow only intended domains; avoid over-restricting valid flows.

### Validation Process (Lint, Build, Regression)

- Lint and type-check before device run.
- Build and run on the target (device/emulator) in Debug.
- Regression test the relevant screens and adjacent flows (e.g., Push popup + Inbox modal).

### Dev vs. Prod (ENV, Feature Flags)

- Keep all DEV-only logic behind environment checks/flags.
- Verify ENV availability at runtime before relying on it. No PROD behavior changes from DEV features.

### Diagnostics and Logging

- Add minimal, distinctive logs for new logic; remove noisy logs before merging.
- Prefer structured logs that include source and critical values.

### Git Snapshot/Restore Workflow

- Before changes: `restore_checkpoints` snapshot.
- After each stable step: small, focused commits with clear messages.
- Ability to revert quickly is mandatory.

### Windows PowerShell Notes

- Use `cmd /c` to run shell commands consistently.
- Avoid `&&` in PowerShell unless wrapped; prefer separate `cmd /c` calls.
- Quote paths containing parentheses, e.g. `"app/(tabs)/_layout.tsx"`.

### Networking/ENV and URL Rewriting

- For DEV URL rewriting:
  - Confirm base URL, port, and scheme.
  - Keep hash routes and query params intact.
  - Add anti-cache param (ts) when needed.
- Ensure cleartext traffic allowances exist only in Debug configs.

### Realtime, Lists, and Scrolling Stability

- Use `FlatList` for long/infinite lists; avoid `ScrollView` for large datasets.
- Disable realtime listeners while a modal with scroll is open to prevent jank.
- Use `nestedScrollEnabled`, `keyboardShouldPersistTaps="handled"`, and avoid wrappers that swallow gestures.

### Push Notifications (FCM) Integration

- Separate concerns:
  - Notification reception vs. UI presentation vs. deep-link/voucher handling.
- Append contextual parameters (e.g., phone) safely; preserve existing query params.
- Ensure background/initial notification flows open URLs consistently.

### Definition of Done

- The visual change is visible and correct in all targeted states (always-on vs. conditional).
- No Hook order warnings, no linter/type errors, and clean runtime logs.
- Regression tests pass on all impacted flows.
- DEV-only logic is isolated; PROD behavior unchanged.
- Snapshot exists to restore prior state quickly.


