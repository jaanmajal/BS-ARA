# BS-STYLE v28.0 - initial validation

## Completed
- `node --check` succeeded for the inline JavaScript in index.html, marshal.html, and results.html, and for bs28-core.js.
- Core simulation passed: balanced 2-4 groups, availability, CLOSED versus CANCELLED, unique stage ownership, reject duplicate/stale request, immutable draw, confirmed results, next-driver choice.
- Isolated Chromium checks loaded all three pages without runtime errors using a browser-storage shim and no live Firebase.
- Synthetic active-race browser check rendered Group A/Group B at different stages and the marshal's Group A running order.
- Synthetic public-results browser check rendered Group A and excluded cancelled SS2 from overall score.
- New Firebase configuration is a placeholder only. Existing project identifiers and old local-storage key namespace are not used.

## NOT verified (required before real event)
- Realtime Database Rules have not been executed in the Firebase Emulator Suite against the NEW project.
- New Firebase Authentication user UID and web app configuration are not yet available.
- Two or more physical marshal phones, coordinator disconnection, browser background throttling, live PIN force unlock, offline upload recovery and cross-device race completion are unverified.
- Do not deploy to a live competition without the above acceptance tests and a backup.

## BS-ARA Firebase Web App configuration update (2026-11-02)
- User-provided Firebase project `bs-ara-v28` Web App fields installed in `firebase-config.js` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId and measurementId).
- Database URL is intentionally blank because it was not supplied. Main Control allows entering the URL and downloading a configured `firebase-config.js` for deployment to all devices.
- Main Control retains v27-style input fields for organiser email/password and Event ID; password is not saved in the config. Organiser UID can be copied after successful authentication for use in Firebase Rules.
- Marshal old hard-coded email removed. Marshal warns when the GitHub firebase-config.js has no Database URL. Public Results also displays a specific configuration warning.
- JavaScript syntax checks: PASS for all inline application scripts and firebase-config.js.
- Existing group-rotation unit tests: PASS (20 assertions).
- Headless Chromium checks: Main Control shows project fields and validates URL; tested configuration download and filename; Marshal and Results load without runtime errors; existing active Group A/B browser fixtures pass.
- NOT TESTED: Firebase Authentication sign-in or database authorization against the user's live new project. Realtime Database URL, organiser Auth user UID and published rules still required.

## Realtime Database URL configuration (2026-11-02)
- `firebase-config.js` now includes the URL shown in the new Firebase Console screenshot: `https://bs-ara-v28-default-rtdb.asia-southeast1.firebasedatabase.app`.
- Main Control setup help updated accordingly.
- This is configuration-only; live Firebase authentication and RTDB rules have not been verified.
