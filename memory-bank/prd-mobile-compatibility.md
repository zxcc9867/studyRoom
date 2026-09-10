# PRD: Mobile Dependency Compatibility

## 1. Problem

Expo 53 resolves React 19.2.7 from the workspace, while its React Native renderer requires exactly 19.0.0. TypeScript alone did not detect the startup failure.

## 2. Target Users

Developers and users of the separate Expo Android/iOS application. The deployed Vite web application must retain its existing React and React DOM versions.

## 3. Goals

- Restore the installed Expo/native dependency contract without a major Expo upgrade.
- Detect incompatible native React resolution offline, including renderer and native-library resolution.
- Run approved npm-registry audits and distinguish dependency findings from proven production reachability.

## 4. Non-goals

- Global React downgrade, forced audit repair, broad dependency upgrades, native feature parity, remote data changes, commit/push/deployment.
- Claiming device execution or absence of vulnerabilities from typecheck/audit alone.

## 5. User Stories

- As a mobile developer, I want incompatible dependency resolution to fail before launching the native app.
- As a web user, I want mobile maintenance to preserve the web runtime.

## 6. User Scenarios

### Normal Flow

1. Install the committed workspace lockfile.
2. Run the offline native compatibility gate and mobile typecheck.
3. Export Android/iOS bundles and retain existing web verification.

### Edge Cases

- Multiple React versions may exist across applications, but only one compatible version may enter the native application graph.
- A future renderer layout or SDK change must fail closed until the compatibility check is reviewed.

### Error Cases

- Missing packages, Expo bundle mismatches, or renderer React mismatches must fail the check.

## 7. Functional Requirements

- [x] Pin the minimal native-compatible dependency combination; preserve web React 19.2.7 and React DOM 19.2.7.
- [x] Execute the installed renderer's real compatibility guard in regression tests.
- [x] Run an offline compatibility check and native typecheck in CI.
- [x] Record fresh pre/post scoped audit findings and limitations.

## 8. Non-functional Requirements

- Performance: compatibility checks complete without network or native toolchains.
- Security: no audit --force, no secret logging, no unreviewed framework upgrade.
- Accessibility: no UI changes.
- Extensibility/maintenance: compare actual module resolution with installed Expo metadata and fail clearly on drift.

## 9. Dependencies

- Internal: npm workspace manifests/lockfile, existing CI workflow.
- External: installed Expo 53 and React Native 0.79 renderer; npm official advisory registry.
- Supabase/API/environment variables: no changes.

## 10. Success Metrics

- Existing React mismatch reproduced before the fix and rejected by the regression check.
- Offline native check and typecheck pass after the fix; web runtime is unchanged.
- Android/iOS JavaScript export results reported separately from device verification.

## 11. Rollout Plan

- Development: approved scoped repair in the recovery worktree only.
- Test: red/green compatibility tests, native typecheck/export, existing web gates.
- Deployment: none in this subtask; parent coordinates any separately authorized release.
- Monitoring: keep advisory remediation and SDK migration as explicit follow-up work.

## 12. Open Questions

- A full physical-device/emulator validation is still needed before a native release.
- Broad Expo/Metro advisory remediation requires its own migration scope.

## Approval

On 2026-09-10, the user replied `진행해` after being explicitly asked to approve the bounded mobile compatibility repair, report changes, and sending package-name/version metadata to the official npm registry for audit. This supersedes the previous audit-consent waiting state; it does not authorize forced or major framework upgrades.
