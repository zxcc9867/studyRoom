# 풍경 카메라 미리보기 검증

## 승인과 범위
- 풍경 하단의 정상 감지 상태를 ‘카메라 감시 중’으로 줄이고, 버튼으로 현재 로컬 카메라를 펼쳐 확인한다. 같은 버튼·닫기·Escape로 접는다.
- main의 기존 감지 video/ref/MediaStream/모델과 학습 상태를 유지한다. 표시용 video만 같은 stream을 빌리며 재촬영·track 복제/종료·녹화·서버 전송·원격 영상 공유는 없다.
- 휴식·꺼짐·다른 기기 담당·세션/계정 변경·종료 stream에는 영상을 표시하지 않는다. 학습 기록/감지 조건/경고/회복 정책·API/DB/native는 이번 UI 변경에서 유지한다.
- 사용자 후속 요청의 회복 평가주기는 별도 조사했다. 운영 함수의 읽기 전용 정의에서 경고별 평가/공부일 누적3회/5분 후10분 간격을 재확인했다. 같은 날 재생성과 같은 연속 구간의 반복 경고 집계는 기존 분석과 같다. 독립구간3회+하루한번 변경은 async 결정 대기이며 승인 전에 정책/DB/Edge를 바꾸지 않는다. 계정·원시 이벤트·회복 사유 원문은 조회하지 않았다.

## 재현과 구현
- TDD RED: 기존 App을 실제 Chrome으로 실행한375px 검사에서 미리보기 버튼 부재로 timeout,1fail/0pass/exit1을 확인했다. 네트워크/샌드박스 실패가 아니다.
- GREEN: 새9건+기존풍경/메뉴/연장33건=42/42, fail/skip/cancel0,exit0. `node --test --test-name-pattern='scenic camera preview:|scenic:|scenic menu:|scenic lease:' apps/web/test/actualStudyMounted.test.mjs`.
- 독립 검토 Minor2(자동접힘 초점·계정전환 직접 검사)를 보완했다. 종료 track의 초점 손실 RED를 실제 재현한 뒤 layout cleanup으로 보정, 자동접힘2/모달초점/직접계정전환4건 추가. 최종 신규13/13·실패/생략/취소0·exit0, 독립 재검토C/I/M0 ReadyYes. 최초42건 결과는 이4건/최종보완 전 결과로 구분한다.
- 첫 신규9건 실행은8pass/1fail: 재개 fixture의 기존 일정변경 확인을 테스트가 누락했다. 실제 확인창의 ‘변경 확인 후 재개’를 거치는 것으로 테스트만 보정한 뒤42건을 재실행했다. 제품의 확인 절차를 제거/우회하지 않았다.
- 합성 MediaStream의 같은 object/track, mute/playsInline/contain, 실제 디코딩 크기, 원래 감지 video 동일성/live, 카메라 요청 증가 없음, 타이머 진행·기록 동일성을 확인했다.
- 휴식/재개/stream 종료·복구/원격 담당/계정 전환, 같은 버튼·닫기·Escape·초점, 필수 설정 모달 우선순위를 검증했다.
- 375/1440px 라이트·다크/글자200%에서44px·명도4.5:1·가로 넘침을 확인했다. `output/scenic-fixture/camera-preview-*.png`는 ‘합성 테스트 · 예시 데이터’ 표시된 합성 영상이다.

## 검증 상태
- 공식 `& C:/jini-dev/.ai/scripts/ai.ps1 verify --project .`: Dune exit0,desktop:check/desktop:test/npm test/test:edge/mobile:check/build/docs:check7개 통과,exit0. 기본 npm test의 선택적 브라우저 생략은 실제 Chrome 검증과 구분한다.
- 최종 공식7/Dune0도 초점 보완 뒤 다시 실행해exit0 확인했다. `git diff --check` 통과·독립 재검토C/I/M0.
- 최종 전체 Chrome: `node --test --test-concurrency=2 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs`1764/1764·fail/skip/cancel0·exit0·1444949.4589ms. 검증 전후4개 제품/테스트 파일SHA256 동일, 실행 중 소스 변경 없음. 기존감지/판정·상태동기화·DB/API/native/package/lock의diff0을 확인했다.
- 로그: `output/scenic-camera-focused-1106.log`, `output/scenic-camera-final-focused-1106.log`, `output/scenic-camera-final-official-1106.log`, `output/scenic-camera-full-chrome-1106.log`. 원시 로그/스크린샷은 Git에 포함하지 않는다.

## 운영 배포
- 제품 commit `0b1da142ccedd512baa144d3cd912cba81c98079`, 기능branch push완료. main/태그/배포설정·비밀값을 변경하지 않았다.
- Actions [42064095014](https://github.com/zxcc9867/studyRoom/actions/runs/42064095014) success·정확SHA. 기존 production workflow의검사/빌드/합성무료AI확인/배포단계를통과했다.
- Vercel `dpl_69MieswPS5gZdURwYkXnkWPFTMC3`, productionREADY·동일SHA·운영alias2개·aliasError없음. [운영화면](https://study-room-attendance.vercel.app) HTML200, `/assets/index-Buln7JHk.js`200, `/assets/index-BBcuqMHI.css`200. 닫기/영상라벨/preview클래스와preview/bottom스타일5마커true,HTTP probe exit0.
- READY직후의 짧은 Vercel runtime오류조회0. Drains조회는404로설정유무미확인이다. 장시간성능/오탐없음/장애없음으로확대하지않는다.
- 문서의출시증거후속commit은제품source를바꾸지않고재배포하지않는다. 이전웹복귀후보40cbe73, 이번DB변경없음.

## 실제 기기와 기록 보존
- 실제 설치앱 재로드·종료·설정·계정·물리 카메라 조작은 하지 않았다. 브라우저 격리 fixture만 사용한다. 물리 카메라의 구도/장시간 GPU·배터리 수용은 별도다.
- 서버 기록 쓰기·정정·삭제, DB migration, 새 APK/EXE·의존성 변경은 없다. Windows/Android/웹이 동일 hosted 화면을 사용한다.
