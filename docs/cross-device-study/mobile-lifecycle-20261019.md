# Android lifecycle and continuation acceptance

## Scope and preservation

- User requested prioritized remaining tests, fixes and release while preserving learning history. Existing Android16 AVD and installed0.2.4/code7 are used; no uninstall/data wipe/recovery bypass.
- Branch fix/mobile-camera-lifecycle starts at1d7a7c0. Existing mixed operational/evidence changes and rollback/study-room-before-recovery-20261019 are preserved.
- 14:29:59UTC baseline for the account identified only by a displayed-account fingerprint: completed153/digest363b189eb23c5dfea6b39f658161dda5; todos274/b90c4d7630d465f48c28c681af0bc328; reflections13/59e7550889bd875fafd6e6449c0846e7; recovery77/f2b31c5187f7b59a66f54021c42dd745. Final comparison uses rows existing at this cutoff.
- PC and installed app both show the10/19 pending recovery gate, timer0, completed test todos3/3 and stale `장고245페이지` advice. No fabricated recovery submission or study mutation was performed.

## Initial Android boot

- Existing AVD was stopped. Started without wipe; boot completed in94s. Opening the app during boot produced one Android not-responding dialog. Selecting Wait allowed WebView to initialize and restored the existing logged-in Today screen. This alone does not establish a product ANR cause; repeat idle restart acceptance is required.
- Actual package0.2.4/code7/min24/target35 confirmed. WebView debugging became ready after boot; the initial socket-hang-up was before WebView initialization.

## Reproduced continuation issue

- Actual PC and Android both show an old continuation even though three later test reflections have no next action.
- Loader filters out null next_action, so older advice is revived indefinitely. Follow-up reflection save also ignores blank next actions. Historical reflections must remain unchanged; selection/display is the fix boundary.
- Focused regression and final validation/release results are recorded below as they are performed.

## Actual installed-app checks (UTC)

- 14:35 stable post-boot COLD start restored Today. The earlier process exit at14:31:18 is recorded by Android as PACKAGE UPDATED, description `stop com.google.android.webview due to installPackageLI`; no app reinstall/data wipe was performed. This explains that process exit, not conclusively the preceding boot-time ANR.
- 14:36 HOME→HOT return retained Settings and the same displayed-account fingerprint as PC. Actual camera AppOps duration remained1m18.729s; no new camera use.
- 14:39:35~36 actual loaded content: feed20article cards, forest1canvas, goals content, settings app information. No additional login. Installed0.2.4/code7 is read from the native panel, not invented from web version metadata.
- 14:40:10 scoped WebView offline for18s: one real study_device_snapshot read failed, while Today content/timer0/login persisted and camera authentication dialogs remained0. Restore in finally;14:40:19 a normal authenticated polling response returned200 without page reload. Device/PC network settings were not changed. This is an idle short-disconnect check, not active-session or long-background acceptance.
- 14:42:00 idle force-stop→COLD launch,14:42:35 Today timer0/content/no-login-form restored. Same settings account fingerprint confirmed. No new study row or camera action.
- 14:43 native app-settings panel→explicit Android app permission settings opened `com.android.settings/.applications.InstalledAppDetails`→Back restored the native panel/version, then web Settings/Today. No permission changed. Camera allowed; notifications and DND access are not allowed on this emulator, so actual push/DND activation is not accepted as passing.
- User selected other checks first because10/19 recovery remains pending. App standalone start/pause/resume/end, explicit camera-owner transfer and active-background acceptance remain gated; no fake recovery submission or backend mutation.

## Fix and automated verification

- Query-boundary RED1 showed old reflection selected instead of newer null action. Real mounted React RED2 at375/1440px showed old advice; blank follow-up save RED1 showed the same stale advice after saving.
- Minimal fix removes the non-null query filter; follow-up state accepts a newer/same reflection even if action is blank. Older reflection state does not replace a newer one. No schema/RPC/Edge/native/package/signature changes.
- GREEN: query-boundary2/2 and real mounted3/3. Existing original reflection text stays in fixture history; no write is issued on page load.
- `ai.ps1 verify --project C:/jini-dev/worktrees/study-room-team`: Dune0, npm test/test:edge/mobile:check/build/docs:check all exit0. Full actual-Chrome run1348/1348, failures0/skips0,276857ms. Evidence logs are local output/android-024-20261018/mobile-lifecycle-verify.log and mobile-lifecycle-full-chrome.log.
- Independent shared-reviewer: no Critical/Important findings; narrow Node6/6. Minor coverage suggestion for same-ID/older-created_at state branches is not a runtime defect. It does not substitute for actual Android acceptance above.

## Release

- Verified current production target before release: projectprj_u2Q9FKwNeVjwwtVOjuXNMZRpkR3g/team_LaN4bwvH4msrzoQtIw3fqsUj, aliasstudy-room-attendance.vercel.app, prior225fd82 READY. Use existing vercel-production.yml feature-ref workflow; do not change CI secrets, main or rollback refs.
- Product3312ad089d5eb97b3b41eba6fc7c5f2ab22ccbde committed/pushed tofix/mobile-camera-lifecycle. [Actions39271816694](https://github.com/zxcc9867/studyRoom/actions/runs/39271816694) completed/success at exact SHA; all tests/build and existing synthetic free-coaching/briefing checks passed.
- Vercel dpl_D82nR19hn1SY6iymQBcTJSDHtcgq production READY, exact project/ref/SHA and production alias confirmed. SiteHTTP200; new /assets/index-C57JTt4A.js HTTP200/application/javascript/286462bytes. Old next_action non-null filter absent in built asset.
- 14:49:47 actual installed Android reload only after verifying idle/no draft: new entry, old advice absent, normal generic prompt, timer0, login retained, recovery gate retained and existing completed todos3/3. Camera dialogs0 and AppOps1m18.729s unchanged. Cropped UI evidence output/playwright/android-continuation-fixed-20261019.png contains no camera image or account identifier.
- 14:50 PC idle reload→fully loaded data shows the same fixed prompt, existing3/3 and recovery gate. Initial loading0/0 was not counted as acceptance.
- 14:50:15 final SQL comparison at baseline cutoff: completed153/363b189eb23c5dfea6b39f658161dda5; todos274/b90c4d7630d465f48c28c681af0bc328; reflections13/59e7550889bd875fafd6e6449c0846e7; recovery77/f2b31c5187f7b59a66f54021c42dd745. All counts and full-row content digests equal pre-test baseline. No new learning/test rows this turn.
- No DB/Edge/native/APK release or policy changes. Installed0.2.4 remains current; this fix is hosted-web and requires a fresh page/app load, not an APK reinstall. Prior rollback refs remain untouched. No production runtime-log/error-rate scan was performed; actual-flow and short-disconnect checks above do not prove long-term availability.
