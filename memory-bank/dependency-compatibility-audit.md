# Dependency and Mobile Compatibility Audit

## 2026-09-10 - Scope and status

- Source baseline: `01d157b0d6bdb1043954caae65498c20f44cf4fe` in `C:/jini-dev/worktrees/study-room-recovery-audit`.
- This is a read-only investigation of previously observed install warnings and runtime compatibility, not a completed vulnerability assessment.
- No dependency manifest, lockfile, application code, remote data or deployment was changed. Existing uncommitted memory-bank notes are preserved.
- The preceding report audit was progress: it identified missing report coverage and reproduced misleading provisional totals. Its design-approval question remains unanswered.

## External audit approval boundary

- A request to run `npm audit --json` was rejected before execution by the approval reviewer because it can transmit dependency metadata to the npm registry.
- The command was not retried through another transport, an alternate registry, or an indirect execution path.
- Asked the user whether package-name/version metadata may be sent to the official npm registry for inspection only. No automatic installation or repair was requested.
- No current advisory count or claim of zero production vulnerabilities is justified. The old progress note recording zero web production findings is historical, not fresh evidence.

## Offline package and deployment boundaries

- Computed declared dependency closures directly from package-lock.json, including installed dependencies, optional dependencies and resolvable peer dependencies.
- Web runtime closure: 15 package nodes. Web runtime plus build tooling: 160. Mobile closure: 713, including 703 nodes not in the web runtime closure.
- These are declared-graph counts, not vulnerability counts or proof that every node is reachable at runtime.
- All 791 resolved external package entries point to registry.npmjs.org; seven remaining entries describe workspaces/links. No other registry origin was found. This local check does not itself grant consent to send the graph externally.
- Vercel builds `apps/web` and serves `apps/web/dist`; the deployed coaching API imports local server modules and Node crypto. Its AI transport uses native fetch.
- CI installs the root workspace graph, so native development dependencies can still affect installation/build supply-chain risk even when not part of the browser bundle.
- Do not equate an aggregate root audit warning count with exploitable production-web findings. Reachability and advisory-specific prerequisites still require verification.

## DEP-01 - Confirmed React/React Native renderer mismatch

Priority: high reliability issue for the separate Expo/native app, not evidence of a mobile-browser styling defect or a web security exploit.

### Evidence

- `apps/mobile/package.json` declares React `^19.0.0`; the committed lockfile and the mobile workspace's actual module resolution select React `19.2.7`.
- Installed Expo is `53.0.27`. Its bundledNativeModules.json expects React `19.0.0`.
- Installed React Native is `0.79.7`; its ReactNativeRenderer-dev.js and ReactNativeRenderer-prod.js explicitly reject a React version other than `19.0.0`.
- Executed the actual installed renderer's version-guard excerpt against React resolved from the mobile workspace, without editing code or starting a native app. It threw:

```text
Incompatible React versions: The "react" and "react-native-renderer" packages must have the exact same version. Instead got:
  - react:                  19.2.7
  - react-native-renderer:  19.0.0
```

### Scope and limitations

- The native renderer mismatch is reproduced. A complete Android/iOS build or device launch has not been performed.
- Do not claim the web app is broken: it uses React DOM, not the native renderer.
- Before a fix, validate a compatible native dependency combination and keep the web runtime isolated. Do not lower web React globally or run audit --force as an incidental repair.
- Selecting old pins or a newer Expo major release needs advisory/compatibility review and the normal change approval and regression gates.

## DEP-02 - Additional Expo compatibility deviations

| Package | Expo 53.0.27 bundled expectation | Locked version | Interpretation |
| --- | --- | --- | --- |
| @react-native-async-storage/async-storage | 2.1.2 | 2.2.0 | Outside bundled exact expectation; not a reproduced crash. |
| react-native | 0.79.6 | 0.79.7 | Outside bundled exact expectation; do not assume every patch difference is incompatible. |
| expo-constants | ~17.1.8 | 17.1.8 | Matches bundled range. |
| expo-device | ~7.1.4 | 7.1.4 | Matches bundled range. |
| expo-notifications | ~0.31.5 | 0.31.5 | Matches bundled range. |

## DEP-03 - Verification gap

- `npm.cmd --workspace apps/mobile run typecheck` passed with exit code 0 despite DEP-01.
- The current production workflow runs root tests, Edge checks and the web build, but does not contain a native React/renderer version compatibility gate.
- A future correction should add a local/offline regression guard for the resolved native dependency versions and run mobile typecheck plus a native bundle/device check in addition to the existing web gates.
- A passing TypeScript check alone is not native runtime evidence.

## Next decision

- Await consent for the external npm audit; no workaround while consent is missing.
- Present the bounded native compatibility repair separately from a broad Expo major upgrade. Preserve the web app and existing user records.
- The week/month report design question remains open. These investigations do not complete the broad feature-review goal.

## 2026-09-10 - Approved repair and fresh registry results

### Approval and scope

- The user replied `진행해` after an explicit request to approve the bounded report/mobile repair and sending package-name/version dependency metadata to the official npm registry. The previous waiting-for-audit-consent state above is historical and is now resolved.
- Ran `npm.cmd audit --json --registry=https://registry.npmjs.org` and separate `--workspace=apps/web --omit=dev`, `--workspace=apps/web`, and `--workspace=apps/mobile` inspections. No alternate registry, forced repair, major Expo upgrade, commit, push, deployment, or remote data change was performed in this mobile subtask.
- Changes stay in the recovery worktree. The original dirty checkout is untouched.

### Implemented compatibility contract

| Scope | Before | After |
| --- | --- | --- |
| Expo | 53.0.27 | 53.0.27, unchanged |
| Native React | hoisted 19.2.7 | mobile-local exact 19.0.0 |
| React Native | 0.79.7 | exact 0.79.6, one installed/locked copy |
| AsyncStorage | 2.2.0 | mobile-local exact 2.1.2 |
| Web React / React DOM | 19.2.7 / 19.2.7 | 19.2.7 / 19.2.7, unchanged |

- `apps/mobile/package.json` pins the three Expo-bundled native versions. A root devDependency on RN 0.79.6 anchors all native peer dependencies to the same version; React has no global override or downgrade.
- `apps/mobile/metro.config.cjs` extends `expo/metro-config`. Only Android/iOS `react`, React JSX subpaths, `react-native` and RN subpaths are redirected to the mobile app's selected package paths. All other imports and Metro web resolution retain the default resolver.
- The root RN anchor is necessary because simply pinning the mobile package left a root RN 0.79.7 copy used by hoisted Expo peers. A native-only override attempt retained an invalid installed RN, and the subsequent package-scoped update failed with ERESOLVE. Neither `--force` nor `--legacy-peer-deps` was used. Removing the ineffective override and adding the direct root native peer anchor produced a single valid RN 0.79.6 graph.
- Actual native export also exposed the old `main: expo/AppEntry.js` resolving `../../App` from the hoisted Expo directory into the repository root. The standard mobile-local `index.js` entry now imports `./App` and calls `registerRootComponent`; no App UI or server behavior changed.
- `scripts/mobile-compatibility.mjs` checks installed Expo expectations, duplicate RN lock entries, actual Metro filesystem resolution from app/Expo/RN importers for Android/iOS, both real legacy renderer version guards, and web React/DOM compatibility. Unknown guard layouts fail closed.
- Root `npm run mobile:check` runs this offline check plus mobile TypeScript. CI runs it after root tests; root tests include ten behavioral compatibility/entry tests.

### Security review before using native React 19.0.0

- The official React advisory concerns the `react-server-dom-*` packages and RSC-capable applications, not the client React package solely because it is version 19.0.0. The lockfile contains no `react-server-dom-*` package or RSC bundler; this is a standard Expo/native app plus a separate Vite SPA. Official guidance explicitly avoids creating a native renderer mismatch when applying RSC fixes. This supports keeping the native React version required by its renderer, not a blanket claim that old versions are safe forever.
- Sources: [React security advisory](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components), [React follow-up advisory](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components), [Expo SDK 53 release](https://expo.dev/changelog/sdk-53), [Expo monorepo duplicate-dependency guidance](https://docs.expo.dev/guides/monorepos/), [Expo custom resolver guidance](https://docs.expo.dev/guides/customizing-metro/).

### Fresh audit counts: before and after

These are npm vulnerability-package records, including inherited/meta-vulnerabilities. They are not counts of unique CVEs or demonstrated exploits.

| Audit command scope | Before | After | After severity distribution |
| --- | ---: | ---: | --- |
| Root, all dependency types | 28 | 28 | low 1, moderate 12, high 14, critical 1 |
| Mobile workspace | 27 | 27 | moderate 12, high 14, critical 1 |
| Web workspace, all dependency types | 5 | 5 | low 1, moderate 1, high 3 |
| Web workspace with `--omit=dev` | 3 | 3 | moderate 1, high 2 |

- This was a native compatibility repair, not completion of vulnerability remediation. Exact Expo pins did not add new named audit findings and did not remove the aggregate findings.
- The lockfile changed only native version selection/placement and npm's associated dependency resolution: RN platform packages moved from 0.79.7 to 0.79.6; native CLI transitive ranges selected semver 7.8.5, ws 7.5.13, brace-expansion 1.1.18 and cosmiconfig's js-yaml 3.15.2. Web runtime/build package versions are unchanged. No broad audit-fix was executed.

### Actual web versus mobile paths

- Recomputed declared runtime closures offline from both lockfiles, following dependency, optional-dependency and resolvable peer edges. Web runtime remains 15 external package nodes; web runtime plus build tools remains 160. No root-audit vulnerable node intersects the 15-node web runtime closure. This is bounded dependency-graph evidence, not proof of universal security.
- The five web-workspace findings are build/development tools: `baseline-browser-mapping` 2.10.33, `browserslist` 4.28.2, `esbuild` 0.27.7, `nanoid` 3.3.12, and Vite's `postcss` 8.5.15. The three `--omit=dev` findings are the first two plus nanoid: those packages are shared/hoisted with Expo and marked non-dev in the root lock graph. They are not present in the web app's declared runtime closure. Therefore report the real npm count of three, but do not label them three exploitable browser-runtime defects.
- `vercel.json` installs the root graph, builds only `apps/web`, and serves `apps/web/dist`. Application/API/server sources do not import these audited tools. CI/install/build supply-chain risk remains in scope even when the browser runtime does not contain them.
- The critical record is `tar` 7.5.16 in the Expo CLI/tool chain. The upstream advisory requires extraction of attacker-controlled archives; it is not evidence that opening the deployed web app triggers archive extraction. Treat it as an outstanding development/build-tool risk, especially around untrusted archives. [node-tar advisory](https://github.com/isaacs/node-tar/security/advisories/GHSA-23hp-3jrh-7fpw)
- PostCSS findings require attacker-influenced CSS/source-map processing with the relevant options and disclosure of emitted maps. Browserslist findings include resource exhaustion from externally influenced queries in long-running processes. The repository's Vite build consumes repository sources; no public CSS-transform/query endpoint was found. This limits demonstrated reachability, but is not a reason to ignore build tooling updates. [PostCSS path traversal](https://github.com/postcss/postcss/security/advisories/GHSA-r28c-9q8g-f849), [PostCSS incomplete fix](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp), [Browserslist advisory](https://github.com/browserslist/browserslist/security/advisories/GHSA-c83g-rgw3-j3cx)
- Remaining mobile tool-chain records include Expo config/CLI/meta-packages, RN community CLI/Metro, xmldom, brace-expansion, image-size, js-yaml, shell-quote, undici, uuid/xcode and the shared build tools. A native runtime package may inherit an audit record from its build-tool dependency; advisory-specific reachable code still needs separate investigation.
- npm suggests Expo 57 / RN 0.86 for some all-fixes paths. Those are breaking framework migrations, not authorized incidental fixes. Plan them separately with device testing; independently assess compatible non-major tool patches before choosing an upgrade strategy.

### Verification evidence

- RED: original installed dev and production native renderer guards both rejected mobile-resolved React 19.2.7, while TypeScript alone had passed.
- RED: exact mobile pins alone still let hoisted Expo resolve root/web React; the real Metro resolver check caught the different file path. It also caught two RN installations before the peer-anchor fix.
- RED: actual Android/iOS export and entry-execution tests failed because hoisted AppEntry resolved the wrong App location.
- GREEN: `node --test scripts/mobile-compatibility.test.mjs`: 10 tests passed, including both renderer guards, fail-closed unknown guard, native graph checks, Android/iOS actual-entry execution with only the device registration boundary replaced, and unaffected web/unrelated resolver paths.
- `npm.cmd run mobile:check`: compatibility plus `tsc --noEmit` passed.
- `EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 npm.cmd --workspace apps/mobile exec -- expo install --check`: dependencies up to date. Expo warns that registry validation is unavailable offline; installed bundled metadata checks passed.
- `npm.cmd ls react-native --all`: exit 0, every native peer deduped to the single RN 0.79.6 installation.
- `npm.cmd ci --dry-run --ignore-scripts --no-audit --no-fund --offline`: exit 0. This verifies lock/manifest install planning, not a fresh clean install or lifecycle scripts.
- Offline `expo export --platform android --platform ios --source-maps --output-dir dist/compatibility --max-workers 2`: exit 0, Android 756 modules and iOS 755 modules, Hermes bytecode bundles emitted. Export disabled dotenv loading and telemetry; no app API/credential/device session was used.
- Both generated source maps include React only under `/apps/mobile/node_modules/react/` (19.0.0) and one RN root `/node_modules/react-native/` (0.79.6). Neither includes the root web React 19.2.7 copy. Checked tool sources (`tar`, `undici`, `postcss`, `browserslist`, `baseline-browser-mapping`, `nanoid`, `image-size`, `js-yaml`, `uuid`) are absent from these bundles.
- `git diff --check`: passed. Native files/lock/scripts/workflow were reviewed; unrelated web report changes remain owned by the parent task.

### Limits and follow-up

- Native export is JavaScript/Hermes bundle evidence, not Gradle/Xcode compilation, emulator startup, physical-device launch, authentication, notifications or storage verification. Those remain necessary before a native release.
- Expo's separate `--web` development target is not the deployed Vite web app and was not built in this subtask.
- The compatibility gate intentionally fails on unreviewed SDK/renderer-layout drift and on web React changes from the preserved baseline; review/update it as part of a future explicit framework/runtime upgrade.
- No forced vulnerability repair, remote migration or native release was performed. Root/web integration tests and release coordination remain the parent task's verification responsibility.

### Independent review

- A separate read-only reviewer inspected the native manifests/lockfile, Metro isolation, entrypoint, guard/tests, CI gate and these notes. No critical, important or actionable minor issue was found; assessment: ready to integrate.
- The reviewer independently reran all ten native tests and `npm run mobile:check`, inspected both native source maps, and checked diff whitespace. Linux CI and physical-device execution remain unverified; the review does not erase those limits.
