# AWS Native Pilot Implementation Plan

Spec: [AWS 시험판 설계](../specs/2026-11-08-aws-native-pilot-design.md).

## Global constraints

- Only `infra/aws-native-pilot` and related docs; do not change the production app, data, DNS, or existing CDK. No AWS writes, deploys, paid calls, commits, or pushes during implementation.
- Verify locally with Node tests and offline CDK synthesis; report actual cloud verification separately.

### Task 1: Implement the Lambda runtime

Own `infra/aws-native-pilot/runtime/` only. Implement PostgreSQL bootstrap and owner-scoped HTTP API, AppSync IAM event publisher, DB-backed SQS dispatch, and bounded Bedrock worker.

- Entry points are `api.mjs`, `init.mjs`, `dispatcher.mjs`, and `worker.mjs`; each exports `handler`. Bundle as CJS at deploy time.
- Environment: `DB_HOST` (proxy except init), `DB_NAME`, `DB_SECRET_ARN` (admin for init), `DB_APP_SECRET_ARN` (init only), `APPSYNC_HTTP_URL` (full HTTPS /event endpoint), `QUEUE_URL`, `BEDROCK_MODEL_ID`. IAM credentials and region are standard Lambda SDK defaults. Init receives a vetted direct Aurora trust bundle path via `NODE_EXTRA_CA_CERTS`.
- API consumes API Gateway validated JWT claims; additionally reject non-access tokens and invalid subject UUID. Routes `GET /records` → `{records:[...]}`, `POST /records` with only `{minutes}` integer 1–240 → 201 `{id,minutes}`, `GET /records/{id}` → record or 404, `POST /coaching` with empty object → 202 `{id}`, `GET /coaching/{id}` → `{id,status,...}` or 404. Job statuses `queued/running/done/failed`. Limit AI use; duplicate queue deliveries must not re-invoke the model. AppSync signals on `/study/<sub>` contain `{kind,id}`, with `kind` set to `record` or `coaching`; send only after durable writes. No AWS calls in local tests.
- Use parameterized SQL, TLS verification, least-privilege app role, and sanitised failures. Test behavior first: ID token rejection, bounded inputs, user isolation, commit-before-notify, durable delivery, duplicate job claims, and safe terminal failure. Provide dependencies used and test evidence.

### Task 2: Implement the trial website and WebSocket client

Own `infra/aws-native-pilot/web/` only. Implement managed-login PKCE (state and no stored access tokens), status dashboard and API reload fallback, and a shared AppSync client usable by the deploy smoke command. Keep UI and artifacts strictly synthetic. Test PKCE and realtime protocol against local doubles; no AWS calls.

- Web config keys: `apiUrl`, `cognitoDomain` (HTTPS origin), `clientId`, `appSyncHttpUrl` (/event), `appSyncRealtimeUrl` (/event/realtime). API contract is defined above. `subscribeToStudy({httpUrl,realtimeUrl,token,subject,onEvent,onStatus})` returns `{ready,close}`; allow an explicit channel subject for the independent unauthorized-subscription smoke test.

### Task 3: Wire infrastructure and the one-command deploy gate

Own package, stack, and scripts in `infra/aws-native-pilot` plus documentation. Test the deploy guard and synthesized trust boundaries before implementation. Configure private origin, Cognito code flow + IAM-only smoke client, JWT API, private TLS proxy, AppSync namespace, bounded queue/worker, and explicit environment constraints. After preflight, the deployment command deploys, initializes, uploads public config, and tests two synthetic users. Never run the cloud command in this work session.

CDK entry point, stack, build/deploy scripts, and infrastructure tests use strict TypeScript and compile to `dist/`. The Lambda bundle is independent of the CDK compiler configuration, and the browser and Lambda sources remain JavaScript.

### Task 4: Verify and document

Run isolated unit, build and offline synth, review all changes, then update the design status, architecture review and project memory-bank. Keep browser managed-login and real AWS smoke as separate, unexecuted acceptance gates.
