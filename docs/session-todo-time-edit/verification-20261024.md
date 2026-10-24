# 세션 할 일 시간 편집 검증

## 범위와 보존 계약

- `이번 세션에서 할 일` 선택 목록에 시간 편집/저장/취소를 추가한다. 웹과 Android hosted WebView가 같은 구현을 사용한다.
- 기존 인증 Data API/RLS로 클릭한 todo 한 건의 start_time/end_time만 갱신한다. 반복 그룹, 다른 날짜, 제목, 목표, 선택 ID, 기존 세션/인정 구간/회고는 변경하지 않는다.
- 기존 원래 계획 snapshot 트리거는 목표 분량이 이미 있는 계획을 덮어쓰지 않는다. 미지정 계획의 첫 시간 지정·향후 알림 정리는 기존 서버 동작을 유지한다. DB migration·서버 정책·APK 변경 없음.

## 재현과 자동 검증

- RED: 실제 Chrome375px에서 `집중 독서 시간 편집` 버튼을 찾을 수 없어 실패했다.
- GREEN: 새 mounted 테스트8/8. 375/1440px 기존값/자정 넘김 저장, 클릭한 반복 발생분만 갱신, 선택/세션/회고 보존, 취소/새 할 일 초안 분리, 동일 시간 거절, 대기 잠금, 오류/예외/빈 응답 후 재시도, 계정 전환의 늦은 응답 차단.
- 독립 검토 P2 두 건(편집 중 삭제 뒤 막힘, 저장 시 비활성 버튼 포커스)도 각각 RED 단언으로 재현 후 수정했다. 삭제 잠금 및 DOM commit 후 포커스 복귀, 추가/공통 busy까지 기다리는 조건을 검증했다. 재검토 차단 결함 없음.
- 마지막 hover 검사에서 일반 button:hover 규칙이 새 저장 버튼의 녹색 배경을 덮어 대비가 낮아지는 RED를 확인했다. 활성 저장 버튼의 배경만 유지하는 selector를 추가했고 hover대비>=4.5를 포함한8/8·전체verify·독립재검토를 다시 통과했다.
- 기존 전체 mounted main127/127 통과. 최종 브라우저 활성 전체 스위트는 아래 출시 상태에 기록한다.
- 전체 `ai.ps1 verify` 통과: Dune 위반0, npm test, test:edge, mobile:check, build, docs:check.
- 처음에는 sandbox DNS로 Deno 검사에 실패해 네트워크 허용 환경에서 재실행했다. 다음 전체 검사에서 기존 피드 정렬 테스트의 고정2026-09-24 날짜가 최신30일 범위를 벗어나19!=20이 재현됐다. 테스트의 발견일/발행일만 SQL now() 기준1/2/3일로 교체했고 해당 파일23/23 통과. 운영 피드 로직/정책은 변경하지 않았다.

## Android16 실제 WebView

- 기존 `StudyRoom_Android16`, 설치 앱0.2.4/code7을 초기화/재설치 없이 부팅했다. 저장된 로그인과 오늘의 학습 정보 복원 확인.
- 배포 전: 실제 설치 앱 WebView에서 최신 main/CSS를 격리 fixture로 로드해 `[테스트] 시간 편집`을23:00~01:00→21:10~22:15로 저장, 다시18:00 초안 후 취소했다. 선택/weekly 설정 유지·수정 요청1회·신규 공부 세션0·가로 넘침 없음. 원래 운영 앱 화면으로 복귀했다.
- 이 단계는 실제 Android 렌더러/입력 동작 검증이며 운영 인증/저장 검증을 대신하지 않는다. fixture의 백엔드는 외부 서버를 사용하지 않았고 카메라는 테스트 canvas stream이었다. 물리 카메라·착석 판정 수용으로 확대하지 않는다.
- 스크린샷/로컬 실행 근거: output/playwright/session-todo-time-edit-{375,1440}.png, session-todo-time-edit-android16-fixture.png, output/todo-time-android-fixture.mjs. 비밀값/계정 정보는 증거에 저장하지 않는다.

## 보존 baseline

운영 SQL 읽기 전용 확인(2026-10-24 11:08UTC): 세션171건/digest b2a22fdc996bd0eb456d3d98ad71350b, 공부구간351건/914a8589c96f2a354bb6ebd5a0a94c22, 회고17건/ed3494c659f1c4dca583891608c2d99b. 추가 baseline: 할 일285건/19207f86871eece7a9829fcc6c78b001, 계획285건/4cbd94b3f242089ab8032ab300e3dcb1. 사용자 UUID·이메일·내용은 기록하지 않는다.

## 출시 상태

- 최종 브라우저 활성 전체 스위트: 1357/1357 통과, 실패0/건너뜀0(concurrency2). `node --test --test-concurrency=2 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs`, FEED_BROWSER_MODULE/FEED_BROWSER_EXECUTABLE을 실제 Chrome으로 지정했다.
- 기능 커밋 fccaff6. 첫 workflow40089854641은 hover보완본으로 교체하기 위해 취소했지만 비동기 Vercel 배포 dpl_npZD2zyrkZFBiGKuLD1UBfYNoVB7은 READY까지 진행됐다. 최종 hover보완 커밋의 새 workflow/READY를 최종 출시 근거로 사용한다.
- 운영 앱의 명시적 테스트 할 일 저장·재조회 및 기존 기록 사후 대조: 대기.
