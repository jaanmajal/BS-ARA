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
