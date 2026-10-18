# PC 상반신 판정 후보 평가 누락 수정

## 범위

- 사용자는 실제 PC 앞에서 공부 중에도 상반신 미감지 경고가 왔다고 확인했다. 일부 사람 감지를 uncertain로 처리하는 제안은 거절하고 기존 판정 조건 유지를 선택했다.
- confidence0.35, 양어깨 간격0.05, 머리 높이 여유0.12, 어깨-골반 간격0.08과 머리+양어깨 또는 머리+같은쪽 어깨·골반 기준을 유지한다. 5분 경고/10분 제외/단일 담당/기존 기록은 변경하지 않는다.
- 당시 영상·랜드마크 원본은 개인정보 정책상 저장되지 않았다. 이번 재현은 확인된 구현 결함을 입증하며, 과거 경고의 정확한 프레임이나 인식 실패 지점을 복원한 것은 아니다.

## 재현·원인

- 첫 가시 머리 후보(보통 코)만 선택해 높이 조건을 판단했다. 코가 높이 조건을 벗어나도 눈·귀 등 다른 기존 후보가 같은 기준을 충족할 수 있는데 평가하지 않았다.
- 양어깨가 가시/간격 조건을 만족하면 그 높이 결과를 즉시 반환했다. 결과가false여도 기존 한쪽 어깨·같은쪽 골반 대체 경로를 시도하지 않았다.
- 실제 함수에 합성 좌표를 입력한 RED 테스트2개에서 모두 false!==true를 확인한 뒤 수정했다. 기대값은 기존 PRD의 후보/OR 조건으로 별도 산출했다.
- 현재 PC DOM의 영상은 readyState4/640×480/paused=false/currentTime777.53→858.49로 재생 중이었다. 현재 관찰에서 프레임 멈춤 증거는 없었으며 과거 모든 프레임 정상까지 보장하지 않는다. 영상/얼굴/랜드마크 원본은 추출·저장하지 않았다.

## 수정

- `bodyPresenceDetection.mjs`: confidence를 충족한 모든 기존 머리 후보를 평가한다. 양어깨 경로가 성공하면true, 실패하면 기존 한쪽 어깨·골반 대체 경로를 평가한다.
- `upperBodyPresence.test.mjs`: 두 누락의 RED→GREEN과 모든 머리 후보가 기존 조건을 실패하는 부정 사례를 추가했다. 기존 머리만/불확실 어깨/정상 양어깨/기존crop 조건 테스트를 유지했다.
- 모델·threshold·프레임 주기·카메라 시작/경고·동기화·서버 API/DB/native/APK는 변경하지 않았다. 과거 잘못됐을 수 있는 경고·제외시간도 임의 삭제하거나 소급 보정하지 않았다.

## 검증

- 집중: `node --test apps/web/test/upperBodyPresence.test.mjs apps/web/test/cameraPresence.test.mjs apps/web/test/cameraVideoHealth.test.mjs` 24/24. 선행 RED는 새 양성 사례2개 실패를 확인했다.
- `ai.ps1 verify --project C:/jini-dev/worktrees/study-room-team`: Dune0위반, npm test/test:edge/mobile:check/build/docs:check 모두exit0.
- 독립 shared-reviewer: 변경/PRD 범위 차단 결함없음, 기존 판정 기준 유지 확인. 검토자는 운영/UI를 재조회한 것이 아니다.
- 실제 Chrome 전체 회귀:1329/1329, 실패0·생략0·262000.9033ms. npm test와 같은 파일 목록을 실제 Chrome/Playwright 런타임으로 concurrency2에서 실행했다. 실제 앱/PC 수용은 새 배포 적용 후 별도 확인한다.

## 기록 보존·출시

- 서버13:08:37UTC baseline→13:36:01UTC 재조회에서 기존 완료149건 content MD5 `a06e8b4c86055a8a87de321b0b27a7ad`, 회복76건 MD5 `68025a9dcbbbb2539a8c6337e0a0798f` 동일. 비교 중 정상 종료된 새 세션은 기존 완료149건 비교에서 제외했다.
- 검증자는 DB DML·사용자 공부 시작/휴식/종료·카메라 재시작을 수행하지 않았다.
- 출시 대기: 검증 완료 후 feature 브랜치의 제품/PRD/이 문서만 커밋·push하고 기존 GitHub Actions feature-ref production 경로를 사용한다. 선행 운영 변경과 혼합 memory-bank diff는 보존하며 포함하지 않는다.
