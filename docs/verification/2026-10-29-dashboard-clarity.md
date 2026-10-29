# 계획표·내 페이지·공부숲 정보 정리

## 범위
- 사용자 첨부의 노란 계획표/900 굵기 날짜 버튼을 실제 컴포넌트에서 재현. 공통 토큰을 내부 SVG까지 적용하고 날짜 문구에 갱신을 명시했다.
- 내 페이지는 요약과 현재 할 일을 우선하고 계정/리포트/이력/배지를 접는다. 숲은 장면·현재 성장·다음 변화를 우선하며 꾸미기/성장 이력/이용법을 접는다. 모든 자식/선택/저장 상태를 유지한다.
- 한국어 번역 소개보다 영어 AI 요약을 우선하던 버그와 상태 위치를 보완했다. 운영 quota_exhausted/월449642자(상한450000)/ready411·failed37을 read-only로 확인했다. 무료 한도/키/DB/서버·추가 공급자 호출은 변경하지 않았다.
- 기존 study-room-desktop-current의 native/auth/lock·인계 dirty를 그대로 두고305b587에서 새 작업 트리/브랜치fix/study-dashboard-clarity를 사용했다. 실제 학습/카메라/회복 데이터는 조작하지 않는다.

## 검증
- Root 새 mounted8개(문구/계획표/요약·보고서접기/확대) 통과, 관련 집중24/24(생략0) 통과. 초기 plan보기를 열지 않은 fixture 실패는 제품RED에서 제외하고 실제 원형 보기를 열어 색상 오류를 다시 재현했다. 원래 리포트/회복 검사는 대상 접기를 연 뒤 동일 내용을 검증한다.
- Forest34/34, feed30/30(생략0), 독립 shared-reviewer P1/P2 없음. 모두 격리 합성 경계로 실제 React/3D·Chrome을 실행했다. 실제 계정·기기/전체 공급자 번역 성공은 별도이다.
- 최초전체1492중1490pass/2fail(375px caption줄바꿈으로timer밀림, 접힌report에맞지않는fixture준비)이었다. caption전폭grid·원래timerassert유지와 report열기setup만 보완하여 관련4/4·dashboard/nav12/12 통과. 최종전체1492/1492·실패/생략/취소0·628667ms/exit0,공식verify7명령·Dune0 통과. 운영 출시 결과는 아래에 갱신한다. 원문 로그/화면은 ignored output/ 및 로컬 *clarity*.log에 보관한다.

- 검증 명령: `ai.ps1 verify --project C:/jini-dev/worktrees/study-dashboard-clarity`; 실제 Chrome은 FEED_BROWSER_MODULE/EXECUTABLE을 지정한 `node --test --test-concurrency=2 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs`.

## 커밋·배포 상태
- 제품7dd5a14c73938da41140aa3c5f772cc7ee8e5b2a를 fix/study-dashboard-clarity에 commit/push했다.
- 최초 workflow_dispatch는 자동 승인 검토가 운영 명시승인 부재로 실행 전 거절했다. 정확한 제품7dd5a14와 운영URL 질문에 사용자가 ‘운영 배포 진행’으로 답한 뒤 같은 기존 배포 경로를 실행했다. 우회 배포는 없다.
- [Actions40867222261](https://github.com/zxcc9867/studyRoom/actions/runs/40867222261) completed/success. 테스트·모바일 타입·docs·Edge·build와 기존 합성 무료 AI2종 검사 및 production 배포가 통과했다. 배포 source42098dc80198ad9448af1c8d5cf02b70920ac676은 제품7dd5a14 이후 문서만 달라 제품 코드가 동일함을 git diff로 확인했다.
- 2026-10-29 20:44 JST Vercel MCP로 team_LaN4bwvH4msrzoQtIw3fqsUj / prj_u2Q9FKwNeVjwwtVOjuXNMZRpkR3g / dpl_J2pc51wrLCiXBAbnf52xFczcakdV를 확인했다. READY/production/정확 sourceSHA와 study-room-attendance.vercel.app alias가 일치한다. 배포 URL: https://study-room-attendance-ecm32a50v-astars-projects-c2f42587.vercel.app.
- 운영 https://study-room-attendance.vercel.app 의 HTML·/assets/index-CfoCVg92.js·/assets/index-CsFgid5K.css·/assets/StudyForestSection-DUFxrpsW.js·/assets/TechFeedSection-D8sqgOKH.js 모두 HTTP200. 공부일 새문구·계획표 공통 스타일·내 페이지 접기·숲 요약/꾸미기·기술피드 번역상태/영어요약 선택 표시를 실제 배포 파일에서 확인했다. 로컬 증거는 ignored output/dashboard-clarity/{deployment-receipt,production-audit}.json이다.
- 실제 계정·물리 기기 수용은 수행하지 않았다. 현재 공부/카메라/회복 기록을 조작하지 않았고, 공부 종료 후 새로고침/앱 재시작으로 hosted 화면을 갱신할 수 있다. 새 APK/Windows 설치 파일은 필요하지 않다. 이번 후속 문서 커밋은 배포 source 이후 기록만 보완한다.
- 제품에 추가 번역·AI/수집 호출은 넣지 않았다. 기존 CI의 합성 무료 AI 연결 점검은 제품 자동 호출과 별도다.
