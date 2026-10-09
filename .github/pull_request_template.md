<!--
Before submitting the Story 4 Cross-Check PR:
1. Replace every REPLACE_* placeholder.
2. Upload a current screenshot from the deployed Story 4 application.
3. Complete the manual release checklist at the bottom.
4. Keep the final story-4 -> story-3 PR open and unmerged.
-->

1. Task: [MiniGames Story 4](https://github.com/rolling-scopes-school/qualifying-stage/blob/main/tasks/minigames/story-4.md)
2. Screenshot:

   <!-- REPLACE_SCREENSHOT: drag and drop a current deployed-app screenshot here. -->

3. Deployment: [https://vlat247.github.io/minigames/](https://vlat247.github.io/minigames/)
4. Done 09.10.2026 / deadline **REPLACE_DEADLINE**
5. Score: 423 / 423

## Self-check

### Authentication & User Registration — 140/140

- [x] Real-time validation for Login and Registration forms — 30/30
- [x] Firebase project, Email/Password provider, and SDK setup — 50/50
- [x] Email/Password authentication flow and UI state management — 20/20
- [x] Google sign-in integration with Firebase Authentication — 40/40

### Authenticated User State, Session & Guards — 80/80

- [x] Authenticated header/mobile profile, avatar image, and initials fallback — 30/30
- [x] Five-minute app-session persistence, validation, expiration, and protected-action recovery — 20/20
- [x] Logout and complete Guest Mode reset — 15/15
- [x] Auth dialog UI, direct-URL, and browser-history guards — 15/15

### Authenticated Game Interactions — 53/53

- [x] Add to and remove from Favorites through the backend API — 15/15
- [x] Comment submission, validation, auto-expanding textarea, and API refresh — 20/20
- [x] Stable random-token comment avatar styling and initials — 3/3
- [x] Comment-like API integration and server-driven state updates — 15/15

### Unit Testing & Code Coverage — 150/150

- [x] Vitest, V8 coverage, jsdom, and TypeScript testing packages — 20/20
- [x] Test and coverage scripts with documented application-logic scope — 15/15
- [x] All unit tests execute successfully with zero failures — 35/35
- [x] Genuine application-logic testing with more than 80% statement coverage — 80/80

## Changes and rationale

- Integrated Firebase Email/Password registration and login with Google OAuth.
- Added real-time form validation, inline errors, request locking, loading states, and Snackbar feedback.
- Added a separate five-minute client app session stored under `minigames:minigames-rs:app-session`.
- Restored valid sessions after reload without extending their lifetime and returned invalid or expired sessions to Guest Mode.
- Added session checks before navigation and every protected action.
- Preserved the expiration notification and Game Details URL/state when expired actions open Auth.
- Restored Game Details after Auth cancellation or success without automatically replaying the blocked mutation.
- Added authenticated desktop, compact, and mobile profile states with avatar fallbacks and Logout controls.
- Added authenticated Favorites, comment submission, and comment-like requests using the active session email.
- Used server responses to update personalized favorite and comment-like state.
- Prevented duplicate mutations and automatic retries after ambiguous network outcomes.
- Added safe comment rendering, latest-comments refresh, comment counts, and stable token-based avatar colors.
- Added comprehensive unit tests for authentication, sessions, routing, API clients, mutations, stale responses, and UI feedback.
- Enforced an 80% global statement-coverage threshold in Vitest configuration.
- Added Story 4 Firebase configuration validation and GitHub Pages deployment support.

## Testing

Automated checks:

- [x] `npm run check`
- [x] `npm run build`
- [x] ESLint: zero errors and warnings
- [x] Prettier: all files formatted
- [x] TypeScript: zero type errors
- [x] Vitest: 26 test files and 461 tests passed
- [x] Coverage: 91.43% statements, 81.75% branches, 92.81% functions, and 91.47% lines

Manual release checklist:

- [ ] GitHub Pages deploys the current `story-4` build successfully.
- [ ] The browser console has no errors or warnings on the deployed site.
- [ ] Email registration, logout, and Email/Password login work on the deployed site.
- [ ] Google login succeeds and canceling the Google popup leaves Auth usable.
- [ ] The authenticated header and mobile menu work at 375px, 768px, and 1920px.
- [ ] A missing or failed profile photo falls back to initials or the generic avatar.
- [ ] Session reload, exact five-minute expiration, focus/navigation checks, and Firebase sign-out work.
- [ ] Expired Favorites, comment, and comment-like actions open Auth while preserving Game Details.
- [ ] Closing Auth restores Guest Game Details; successful Auth restores personalized Game Details without replaying the action.
- [ ] Logout while Game Details is open preserves public content and refreshes it in Guest Mode.
- [ ] Favorite, comment, and comment-like requests send the active session email and use server response state.
- [ ] Slow double-click, offline, timeout, and server-error checks do not duplicate or replay mutations.
