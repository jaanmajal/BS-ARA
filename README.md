# BS-STYLE RC TIME ATTACK v28.0 — New Project Build

**NEW SYSTEM ONLY.** Do not upload this package over v27. It uses a new GitHub repository, Firebase project, and browser-storage namespace. No migration of `bs1` is included or required.

## Files in GitHub repository root
- `index.html`: Main Control, organiser login, driver registration, group draw, stage OPEN/CLOSE/CANCEL and automatic coordinator.
- `marshal.html`: mobile marshal timer, 6-digit stage force-unlock, group-only driver list, next-driver reminder, choose any uncompleted open/free SS, request a fresh draw.
- `results.html`: public leaderboard, group progress, archived SS detail, overall scores exclude CANCELLED stages.
- `bs28-core.js`: pure group allocation, safe availability checks, shuffle and draw helpers.
- `firebase-config.js`: edit with settings from your **new Firebase project**; does not contain passwords.
- `firebase_rules_v28.json`: publish in Firebase Realtime Database > Rules (NOT in website root required for runtime).

## New Firebase project setup (Spark free plan)
1. Create a fresh Firebase project such as `bs-style-v28` and remain on Spark.
2. Add a **Web app**. Copy its `apiKey`, `authDomain`, `projectId` into `firebase-config.js`.
3. Create a Realtime Database (not Firestore). Paste its **exact databaseURL** into `firebase-config.js`. Set the RTDB region supported by your project.
4. Firebase Authentication > Sign-in method: enable Email/Password and Anonymous sign-in.
5. Create a dedicated organiser account under Firebase Authentication > Users, then copy the user's UID (not their email or password).
6. In **both** `firebase_rules_v28.json` and `firebase_rules_v28_copy_paste.txt`, replace every `REPLACE_WITH_ORGANIZER_UID` with that exact UID. Publish the JSON in RTDB > Rules. Do not publish with placeholder UID.
7. GitHub: create a **new repository** (for example `BS-STYLE-RC-V28`) and upload the root website files from this package. Settings > Pages > Deploy from branch `main` / root.
8. Open the new Main Control page over HTTPS, connect with the new organiser account and Event ID `bs28-test`.
9. Register test drivers, initialize Group Rotation, OPEN enough SS, draw 2–4 balanced groups, choose distinct starting SS and start the race.
10. In Main Control, **OPEN Marshal Access** using the existing marshal link control; share the new marshal link from this new repository. Keep the coordinator laptop online and awake.
11. Test group completion / SS selection on at least two phones before a real race. Test offline/rejected result recovery and force unlock separately.

## Race workflow
- All SS CLOSED at initialization. Organiser opens each obstacle when ready.
- After registration, organiser draws 2 / 3 / 4 groups; each gets a distinct OPEN starting stage and fresh driver order.
- Marshal can start any eligible driver **within** that group; the NEXT DRIVER banner follows the first incomplete driver in its saved group draw.
- At STOP / SAVE, all server-confirmed group results and released run locks cause coordinator to mark the stage complete.
- Marshal selects any new OPEN / AVAILABLE / UNCOMPLETED SS. Main Control coordinator atomically reserves that stage and writes one new draw.
- Switching, signing in, refreshing or force unlocking **never starts the stopwatch**; marshal presses START manually.
- CLOSE is temporary; CANCEL removes the SS from everybody's official overall score but keeps saved records and draw history.
- Late entries and supervised catch-up are managed from Main Control.

## Operational warnings
- **No Cloud Functions**: Main Control browser must stay connected, visible and awake. Requests wait when it is offline, then process after reconnection.
- A 6-digit PIN in public browser code is a convenience recovery control, not cryptographic organiser authorization. Protect the new Firebase project's data with UID-based rules, approved marshal sessions and restricted stage-reset scope.
- Never place organiser passwords in the website source or share your Firebase Auth password.
- Pending uploads or unfinished runs must be exported/recovered before switching stages. Reconnect rather than clearing phone browser storage.
- This package has static/simulated tests; live Firebase authorization and full multi-phone competition still require acceptance testing on the NEW project.

## Testing checklist
- [ ] Create test event `bs28-test` and register 12–20 drivers
- [ ] Draw 2, 3 and 4 groups; balance and unique starting SS
- [ ] No START when link closed, SS closed/cancelled, or another group owns SS
- [ ] STOP, SAVE, review pending upload status
- [ ] Completed group releases old reservation, retains existing results
- [ ] Choose SS from phone, fresh order saved once, timer STOPPED at 00:00.00
- [ ] Two marshals requesting same SS: only one accepted
- [ ] Main Control offline: request waits; reconnect resumes safely
- [ ] Late driver; catch-up; cancelled stage excluded equally from overall results
- [ ] Android scrolling, stage lock takeover PIN, next driver reminder
- [ ] Retest Firebase Rules in emulator and with real sessions before live event
