# 풍경 집중 화면의 세션 연장

## 범위와 불변 조건

- 사용자 승인: 풍경 하단에 `세션 유지 남은 시간`과 `+1시간 연장`. 공부/휴식 중 제공하고 활성 세션이 없으면 숨긴다.
- main.tsx의 기존 `extendSessionLease`를 재사용한다. `extend_study_session_lease(p_session_id, p_extension_minutes:60)`와 현재 시각 기준 최대2시간 정책은 변경하지 않는다.
- 서버 row가 반환한 lease를 표시·저장하고 오류/throw 시 기존 기한을 유지한다. 새 타이머/세션·API·DB migration·네이티브 변경은 없다.
- 공부 경과 시간과 유지 기한을 별도 표시한다. 기존 카메라 DOM/MediaStream/track·학습/회복/할 일/회고·인증·출석·팀 정책은 유지한다.
- 소유자/세션별 request token+AbortController로 이전 요청을 무효화하고 current token만 busy를 정리한다. 늦은 응답 전체 row 대신 lease 필드만 병합한다.

## 구현 파일

- apps/web/src/ScenicStudyView.tsx: 전달받은 기한·처리 상태·공식 콜백으로 보조행 표시.
- apps/web/src/scenicStudy.css: 불투명 차콜·줄바꿈·44px 버튼·키보드 초점 대비.
- apps/web/src/main.tsx: 연장 요청·기한 파생·현재 사용자/세션 검증 및 상태 소유.
- apps/web/test/actualStudyMounted.test.mjs: 실제 App을 mount한 합성 Supabase/가짜 카메라 회귀 검증.
- apps/web/test/team-study-mounted.test.mjs: 기존 팀 연장 fixture를 SDK의 abortSignal/then builder 계약과 일치시키고 실제 signal 전달을 검사. 기존 사용자 플로우 assertions는 유지한다.

## 검증 증거

실제 계정이나 서버 기록에는 시험 데이터를 쓰지 않았다. 모든 예시 화면은 `합성 테스트 · 예시 데이터`로 표시한다.

| 검사 | 결과 |
|---|---|
| TDD 버튼/행 누락 | corrected RED 확인 후 구현 |
| 공부/휴식 × 375/1440 | 4/4: 동일 세션·시계·카메라 node/stream/track 유지,60분 요청·최대2시간 표시 |
| 대기/중복/실패/throw | 2/2: 한 요청만 전송·기한 보존·재시도 성공 |
| 세션 없음/이전 계정/유효한 활성 B | 3/3: 숨김·이전 응답 무시·새 요청 잠금 보존 |
| 원격 휴식 후 지연 응답 | 1/1: 휴식 유지·추가 카메라 요청 없음 |
| 375/1440 × 글자100/200% | 4/4: 가로 넘침 없음·44px·텍스트 AA·실제 Tab 초점/대비3 이상 |
| 신규 집중 Chrome | 14/14·실패/생략/취소0·48718ms·exit0 |
| 독립 shared-reviewer 재검토 | Critical0 / Important0 / Minor0; 소스추출 Node 검증·범위 diff 검사 |
| 공식7/Dune | fixture 수정 뒤 재실행도7/7 통과·Dune 위반0·exit0 |
| 최초 전체 실제 Chrome | 1668건·1666통과/2실패·생략/취소0·1551777ms·exit1; 실패는 팀 RPC fixture의 abortSignal 미지원 |
| 팀 fixture 수정 뒤 같은 재현 | 2/2·실패/생략/취소0·2940ms·exit0 |
| 최종 분할 회귀 | 1668건 모두 통과: 원본4해시 동일 actualStudyMounted317건 성공 보존 + 나머지179파일1351/1351 재실행·실패/생략/취소0·281606ms·exit0 |

전체180파일 = 보존1파일 + 재실행179파일이며 누락/추가/중복0을 독립 검토했다. 제품/테스트5파일의 최종 SHA256도 모두 고정값과 동일하다. 이는 동일 소스의 분할 최종 matrix이며, 실패했던 최초 단일 전체 명령의 exit1을 exit0으로 바꿔 보고하지 않는다. SDK signal assertion은 전달 계약 검증이며 실제 네트워크 취소 수용 시험은 아니다.

로그: output/scenic-lease-1104/lease-green.log, official-final.log, official-release.log, full-chrome.log, team-fixture-green.log, final-other-chrome.log, final-other-files.json, frozen-hashes.json, final-frozen-hashes.json. 화면: output/scenic-fixture/scenic-lease-active-1440.png, scenic-lease-layout-375-2.png 등. ignored 산출물은 커밋하지 않는다.

실행 명령:

```powershell
$env:FEED_BROWSER_MODULE='C:/jini-dev/project/study-notes/node_modules/playwright/index.mjs'
$env:FEED_BROWSER_EXECUTABLE='C:/Program Files/Google/Chrome/Application/chrome.exe'
node --test --test-name-pattern='scenic lease:' apps/web/test/actualStudyMounted.test.mjs
node --test --test-concurrency=1 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs
Remove-Item Env:FEED_BROWSER_MODULE,Env:FEED_BROWSER_EXECUTABLE -ErrorAction SilentlyContinue
& C:/jini-dev/.ai/scripts/ai.ps1 verify --project .
```

## 발견·수정과 한계

- 최초 테스트는 기존 카메라 인증 안내가 가려 setup 실패했다. 정상 Escape 닫기 후 버튼 누락 RED를 확인했다. 카메라 정책은 변경하지 않았다.
- 초기 build는 DTO에 없는 user_id 검증 때문에 실패했다. 불필요한 DTO 확장 대신 기존 서버 인증과 현재 owner/session 검증을 유지했다.
- 전역 초점 스타일의 scenic override로 대비2.27이 재현됐다. scoped specificity를 고치고 키보드 실제 이동과 대비 수치로 재검사했다.
- 독립 검토가 찾은 공유 잠금 문제를 유효한 활성 B fixture로 RED 재현했다. request token/abort/소유자별 cleanup 후 GREEN14/14. 원격 휴식 regression은 수정 전에도 통과했으므로 해당 항목에 별도 RED를 주장하지 않는다.
- 최초 전체 검사의 팀2건은 Promise만 반환하는 가짜 RPC가 실제 SDK의 abortSignal을 구현하지 않아 응답 처리가 중단된 것이었다. 제품 코드는 그대로 두고 fixture builder를 보정, 기존 경고 해제·60분 인자·공부 종료 안 함 검사를 유지하고 signal 검사를 추가했다. 재현2/2 통과 후 전체 나머지 파일을 재실행한다. 변경 없는 대형 actualStudyMounted의 성공 결과는 동일4해시로 보존하며, 최종 분할 결과를 단일 전체 명령 exit0으로 표현하지 않는다.
- 물리 카메라, 실제 설치 Windows/Android 에뮬레이터, 실제 Supabase 계정 쓰기·DB 전체 digest는 실행하지 않았다. 설치 앱 새로고침/계정/테마 변경 없이 hosted 공통 코드만 검증했다.

## 출시

- 검증 완료·배포 준비. 기존 feature branch의 정확 SHA로 GitHub Actions production 배포를 실행하고 READY·alias·HTTP200·새 JS/CSS를 확인한다.
- 기존 APK/EXE가 hosted 웹을 공유하므로 새 설치본은 필요 없다. 사용자는 공부·카메라를 마친 뒤 새로고침한다.
- 근거 계약: memory-bank/implementation-plan.md의 세션 유지 정책, supabase/migrations/20260716132227_cap_session_lease_remaining_time.sql. 이번 작업은 라이브 DB 스키마/함수 상태를 바꾸거나 재확인한 것이 아니다.
- 공식 참고: [Supabase RPC](https://supabase.com/docs/reference/javascript/rpc), [changelog](https://supabase.com/changelog). SDK·서버 계약 업그레이드는 하지 않았다.
