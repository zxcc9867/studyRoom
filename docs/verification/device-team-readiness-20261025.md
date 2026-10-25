# 기기·팀 공부 수용 검증 현황 — 2026-10-25

## 범위와 근거

- QA 담당: 기본 동기화의 기존 PASS를 보존하면서 남은 실기기·두 계정·DB 경합 검증의 실행 가능 여부와 경계를 확인한다.
- 검토 기준: `ea6c56e0e1f7fa43ecffed12e5aeeeaeca9fe5e8`의 제품 코드. 문서 작업 checkout은 `studyroom-docs-20261025`, 로컬 자동 검사는 같은 기준의 `studyroom-review-20261025`에서 수행했다. 시간 저장 제한 시간 보완과 전체 출시 검증은 별도 담당이다.
- 기존 실제 수용의 우선 근거는 [명시적 테스트 데이터 수용](../cross-device-study/labeled-acceptance-20261019.md), [Android lifecycle 수용](../cross-device-study/mobile-lifecycle-20261019.md)이다. 이전 [동기화 출시 기록](../cross-device-study/acceptance.md)의 로그인 보류 문구를 현재 기본 동기화 전체 미검증으로 해석하지 않는다.
- 팀 계약은 [팀 공부 PRD](../../memory-bank/prd-social-study-room.md), [자동 팀 기여 기록](../team-study/automatic-study-20261015.md), [서버 계약](../team-study/server-contract.md)을 따른다.
- 이번 QA는 운영 계정·팀·공부·회복·알림을 생성하거나 수정하지 않았다. 인증값·계정 저장소를 열람/추출하지 않았고 네이티브 권한·DND·기기 상태를 변경하지 않았다.
- 사용자 결정: 이번 확인 중 **“나중에 실기기 검증”**을 선택했다. 실제 Android/OEM 및 두 정식 계정 수용은 후속으로 남기고, 이번에는 자동 fixture 검증·문서·CI/웹 배포를 진행한다. 미실행 항목이 PASS로 바뀐 것은 아니다.

## 현재 실행 환경 확인

| 확인 | 2026-10-25 결과 | 의미 |
|---|---|---|
| `Get-Command adb,emulator -ErrorAction SilentlyContinue` | 두 실행 파일 모두 PATH에서 발견하지 못함 | `adb devices -l`을 실행해 연결 기기를 열거하지 못함. 연결 기기 0대로 확정한 결과가 아니다. |
| `ANDROID_HOME`, `ANDROID_SDK_ROOT` | 프로세스·사용자 환경 모두 미설정 | 현재 세션에 SDK 경로가 제공되지 않음 |
| 기본 SDK와 과거 SDK 경로 | `%LOCALAPPDATA%/Android/Sdk`, `E:/Android/Sdk`, `D:/Android/Sdk`, 확인한 `C:/Android` 계열 경로에 SDK 없음 | 이전 문서의 SDK 설치 기록을 현재 기기 이용 가능 증거로 사용할 수 없음 |
| 기본 AVD | `%USERPROFILE%/.android/avd` 없음, emulator 실행 파일 없음 | `emulator -list-avds` 미실행. 에뮬레이터를 새로 설치·시작하지 않음 |
| 두 정식 테스트 계정 | 현재 QA 연결 맥락에 두 계정 준비 증거 없음 | 별도의 두 정식 계정 수용은 미실행. 실제 서비스 계정 수를 조회하거나 로그인 세션을 추출하지 않음 |
| 실제 PostgreSQL 다중 연결 | 격리된 테스트 DB/연결 경로가 제공되지 않음 | 운영 DB 부하·경합 테스트 미실행 |

## 요구사항별 수용표

`기존 PASS`는 아래 출처의 당시 실제 관찰을 뜻하며 오늘 재실행한 결과가 아니다. `자동 PASS`는 로컬 fixture 결과이고 `미실행` 항목을 대체하지 않는다.

| 항목 | 상태 | 확인된 범위와 남은 조건 |
|---|---|---|
| 같은 계정 PC 시작 → Android 관찰 | 기존 PASS | 10/19 Android16·설치 0.2.4/code7에서 같은 테스트 할 일·공부 상태 자동 반영, 앱 카메라 요청 없음. [labeled 수용](../cross-device-study/labeled-acceptance-20261019.md) |
| PC 휴식 → 앱 재개 / 앱 휴식 → PC 재개 | 기존 PASS | 담당 PC의 카메라 자동 복구, 추가 인증 없음, 수정 후 두 세션의 경고·Slack 전달 0건을 당시 확인. Realtime과 15초 fallback 중 어느 전달 경로인지는 화면 관찰만으로 확정하지 않음. |
| 원격 종료·완료 체크·COLD 로그인/기록 유지 | 기존 PASS | 종료 후 앱에 완료 3/5 자동 반영, 앱 COLD 재실행 후 로그인·기록 유지. 기존 기록 count/content digest 보존 근거 있음. |
| 유휴 HOME/COLD·설정 왕복·18초 offline 복귀 | 기존 PASS | 10/19 실제 앱의 한정된 유휴 수용. 카메라 사용량 불변·추가 로그인 없음. 활성 세션 장시간 테스트와 구분. [lifecycle 수용](../cross-device-study/mobile-lifecycle-20261019.md) |
| 명시적 카메라 담당 이전 | 미실행 | 오늘 ADB/장비 연결 불가. 같은 계정의 PC와 Android에서 정상 UI로 이전하고 단일 담당·generation·옛 담당 경고 억제를 확인해야 함. 이전 10/19에도 회복 잠금으로 보류했던 항목임. |
| Android가 새 카메라 담당인 신규 공부 | 미실행 | 기기·정상 로그인·기존 회복 절차를 사용자 본인이 완료한 상태 필요. 회복 대리 제출·우회 없이 카메라 준비→시작→휴식/재개→종료를 관찰해야 함. |
| 평소 자세로 6분 착석 정확도 | 미실행 | 사용자의 물리 착석·실제 카메라 구도를 관찰해야 함. 이전 짧은 테스트의 상반신 absent 및 합성 랜드마크를 정확도 PASS로 확대하지 않음. |
| 활성 세션 장시간 background/offline | 미실행 | 실제 장비의 정상 공부 상태와 합의한 관찰 시간 필요. 유휴 18초 단절 PASS로 장시간·활성 수용을 대체하지 않음. 복귀 시 세션·카메라 담당·lease·중복 경고·시간 정산을 함께 확인해야 함. |
| 실제 휴대폰 OEM DND·알림 | 미실행 | 지원 실제 휴대폰, 사용자 직접 허용한 알림/DND 접근 및 알림 테스트 권한 필요. 과거 에뮬레이터는 해당 접근이 허용되지 않았음. 설정을 임의 변경하지 않음. |
| 두 정식 계정의 링크/공개 태그 초대·수락 | 자동 PASS / 실제 미실행 | 로컬 SQL에서 명시 수락·익명 거절·만료/철회·정원·중복 확인. 실제 두 정식 테스트 계정의 독립 로그인·서버 재조회/전달 수용은 남음. |
| 두 계정 시작·휴식·목표 즉시 공유·제목 비공개 | 자동 PASS / 실제 미실행 | 실제 migration을 실행한 PGlite 및 순수 controller 검증. 두 실제 로그인 클라이언트의 전달 경로/지연을 증명하지 않음. |
| 팀장 위임·탈퇴/해산·개인 공부 보존 | 자동 PASS / 실제 미실행 | 로컬 SQL에서 권한·후계자·기여 중단·개인 공부 유지 확인. 정식 계정의 실제 UI·동시 변경 수용은 남음. |
| 팀 정산·공동 숲·중복 집계 방지 | 자동 PASS / 실제 미실행 | 가입 전/휴식/카메라 제외·lease·재연결·확정 시간·7200초 나무 규칙을 로컬 확인. 실제 두 계정 종료 정산은 남음. |
| 실제 PostgreSQL 다중 연결 경합 | 자동 가드 PASS / 실제 미실행 | fixture의 prelock 이후 세션 발견/RETRY/전체 mutation rollback 검증은 통과. 단일 PGlite에서 제어한 경합이며 실제 PostgreSQL 동시 세션 스케줄링 검증이 아님. |

## 오늘 추가한 로컬 자동 검증 근거

실행 위치: `C:/jini-dev/.worktrees/studyroom-review-20261025`

```powershell
node --test --test-concurrency=1 packages/core/test/team-study-db.test.mjs packages/core/test/team-study-auto.test.mjs apps/web/test/team-study-client.test.mjs apps/web/test/team-study-invite.test.mjs apps/web/test/team-study-presentation.test.mjs
```

- 결과: **60 PASS / 0 FAIL / 0 SKIP**, 종료 코드 0, 14,587ms. 새 테스트를 작성하거나 기존 성공 조건을 변경하지 않았다.
- SQL은 인메모리 PGlite에 실제 migration을 로드하고 fixture 역할/사용자를 사용한다. 외부 Supabase·실제 계정·팀·Slack·카메라에는 접근하지 않는다.
- 자동 기여 13개, 기존 팀 SQL 35개, controller 7개, 초대 2개, 표시 helper 3개다. SQL의 서로 다른 fixture 역할은 실제 로그인 계정 두 개가 아니다.
- 이번 좁은 검사에는 mounted Chrome, Android, 실제 Realtime, 실제 PostgreSQL 다중 연결, 전체 빌드·Edge·DUNE 실행을 포함하지 않는다. 메인의 전체 출시 검증과 구분한다.

## 다음 실제 수용을 위한 준비와 순서

1. 사용자가 사용할 Android/실휴대폰과 SDK/ADB 경로를 제공하고 정상 연결한다. 실제 장비 정보만 확인한 뒤 새 설치·데이터 삭제 없이 기존 앱으로 검증한다.
2. 사용자가 PC/Android의 본인 계정 로그인을 확인하고 필요한 회복을 정상 제출한다. 현재 공부·미저장 초안이 있으면 중단시키지 않고 적절한 검증 시간을 정한다.
3. 명시적으로 표시한 테스트 할 일만 사용해 새 Android 담당→PC 관찰→담당 이전→휴식/재개→종료를 검증한다. 평소 자세 6분과 장시간 활성 background/offline은 별도 관찰 구간으로 기록한다.
4. 실제 휴대폰의 DND·알림은 사용자가 직접 권한을 선택한 뒤, 승인된 테스트 채널에서만 확인한다. 임의의 Slack 경고나 외부 발송을 유도하지 않는다.
5. 두 정식 테스트 계정이 준비되면 전용 테스트 팀에서 초대→공부/휴식/목표→팀장 위임→탈퇴→정산을 검증한다. 실제 서비스 회원을 임의 생성하거나 기존 개인 기록을 변경하지 않는다.
6. 격리 PostgreSQL에서 연결 A/B의 동시 가입/시작/재개/닫기를 barrier로 제어하고 RETRY·중복 기여·잠금 종료를 관찰한다. 운영 DB에서 스트레스 테스트하지 않는다.

## 출시 판단의 경계

이번 QA에서 새로운 자동 테스트 실패는 발견하지 않았다. 기본 PC↔Android 동기화의 기존 PASS는 유지한다. 사용자가 실기기 검증을 후속으로 연기했으므로 현재 코드·문서·CI/웹 배포는 계속 진행하되, 남은 실휴대폰·카메라 담당 이전·두 실제 계정·다중 DB 연결의 미실행 항목은 완료로 표시하지 않는다. main 통합·웹 배포의 최종 판단은 메인의 전체 회귀/운영 확인과 이 제한을 함께 보고 결정한다.
