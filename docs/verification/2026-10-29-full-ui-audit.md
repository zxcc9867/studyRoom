# 전체 내부 UI 통일 검증 — 2026-10-29

## 범위와 보존

- 사용자 승인: ‘기존 공통 디자인으로 전체 통일’. 기존 흰색·세이지·짙은 녹색 토큰을 재사용하며 새 테마/내비게이션/라이브러리를 추가하지 않는다.
- 회복 요청/학습·출석·할 일·팀·인증·카메라 정책과 서버 저장 경로는 불변이다. 운영 DB 쓰기/학습 기록 초기화/실계정 테스트 생성은 하지 않았다.
- 웹 공통 화면은 Windows·Android hosted 화면에도 적용된다. APK0.2.4/code7·Windows0.1.9 바이너리와 이전 native/auth dirty는 이번 배포에 포함하지 않는다.
- 사용 스킬: redesign-existing-projects(기존 계약 보존), TDD/e2e-testing(실제 컴포넌트/계산 스타일), React 품질 점검, 독립 shared-reviewer, Vercel 기존 출시 절차. HIG 기반 가독성/정보 위계 원칙이며 Apple UI 복제나 접근성 인증을 주장하지 않는다.

## 원인과 수정

기존 전체 페이지 테스트가 외곽 표면만 검사해 내부 회복 안내/배지와 숲·화면 순서 편집의 구형 장식을 놓쳤다. 실제 자식 선택자로 새 검사8개를 추가해 점선/영문 라벨 누락을 재현했다. 내부 메타데이터·본문·조작 영역을 공통 토큰으로 연결하고 중복 영문만 제거했다. 기술 피드 원문 제목/본문은 바꾸지 않는다.

추가로375px 달력 날짜의39px 폭을 재현해7열 간격을 좁히고44px을 확보했다. 독립 검토에서 calendar-day/legend span의 :is() specificity가 의미 색을 덮는 문제와 회복 본문의 이전 selector 승리를 발견했다. 각 계산 스타일 RED를 확인한 뒤 선택자를 분리/정렬했다. 출석·대기·결석·다른 달은 각각 의미 있는 색을 유지한다.

## 실제 브라우저 화면/상태 점검표

테스트는 실제 main.tsx·컴포넌트·CSS를 Chrome에 마운트하고 Supabase/외부 전송 경계만 합성한다. Playwright의 로컬 테스트 브라우저이며 본인 계정이나 실행 중 앱의 쿠키를 가져오지 않는다.

| 경로/상태 | 자식 컴포넌트/검사 |
|---|---|
| 내 페이지 | 회복 요약/안내·제출 이력5개·사유/보충/약속·배지·글자 대비·합성 기록 전후 동일 |
| 오늘 집중/계획/기록 | 영문 보조 라벨·모든 노출 조작44px·가로 넘침·기존 타이머/할 일/카메라 회귀 |
| 출석 기록 | 출석/대기/결석/다른 달의 실제 계산 색상·범례·200%·모바일7열44px |
| 목표 | 입력/버튼·메타데이터·달성 배지·기존 추가/저장/실패 회귀 |
| 공부 숲 | 상태/진행 마커·커스터마이저·배지·확대·노출 버튼, 장면/일러스트는 보존 |
| 기술 피드 | 언어/설정/필터/요약/본문/보조 라벨·대비·기존 가져오기/연결 실패 회귀 |
| 설정 | 펼친 알림 입력/버튼·화면 구성 편집행/이동/취소·기존 저장/로그아웃 회귀 |
| 팀 공부 | 팀 생성/목표 저장·팀장 배지·탈퇴 모달/키보드/실패·200%/44px·개인 공부 유지 |
| 로그인/모달 | 기존 로그인·회복 입력·할 일·회고·일정 확인·경고/빈 상태/실패·초점/키보드 검사 재실행 |
| 고정 Android 설치 안내 | 흰 면/공통 팔레트·rem/200%·375/1440·대비4.5·키보드·다운로드 링크/출시 내용 불변 |

회복/주요 페이지는375/1440px×기본/200% 글자를 검사한다. 팀/달력은 추가200% 검사, 설치 안내는 한 테스트 안4조합이다. ‘전체’는 이 표와 기존 회귀에서 실행한 상태를 의미하며 모든 콘텐츠 조합/물리 기기/OS 권한 화면/스크린리더 수용을 뜻하지 않는다.

## 검증 상태

- 초기 RED: 새 내부 감사8/8 실패(점선·영문 누락), 설치 안내1 실패(구형 크림 면), 추가 실제 상태/본문 계산 스타일 실패.
- 집중 GREEN: 회복/전체 자식/출석/팀/설치 안내13/13(실패·생략·취소0). 테두리 추가 보정도 독립 실제 Chrome 출석2/2로 통과했다. 모바일/확대·화면 편집4조합 포함.
- `npm.cmd run build`: 통과(tsc/Vite).
- `ai.ps1 verify --project .`: exit0, Dune 위반0·선언7명령 모두 통과(`desktop:check`, `desktop:test`, `test`, `test:edge`, `mobile:check`, `build`, `docs:check`). 이 기본 게이트의 선택적 브라우저 미설정은 아래 전체 Chrome 검사와 구분한다.
- 독립 shared-reviewer: 실제 Chrome13/13 및 최종 테두리2/2·diff 검사 후 Critical0/Important0/Minor0. 검토자는 checkout/index/HEAD를 변경하지 않았다.
- 전체 Chrome: `node --test --test-concurrency=2 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs`에 실제 Chrome 환경을 지정해1441/1441, 실패/생략/취소0,492599ms. 기존 공부/휴식/재개/종료·카메라 복귀·관찰 기기 동기화·저장 실패/복구·팀/회고 등 실제 mounted 흐름을 포함한다. 로그/스크린샷은 `output/full-ui-audit-browser.log`, `output/playwright/full-ui-*.png`(비커밋).
- React diff 검토: 표시 복사/속성/스타일만 변경, hook/이벤트/영속 상태 소유권·서버 호출 불변, 사용하지 않는 아이콘 import만 제거했다. TypeScript/build와 scoped `git diff --check` 통과.
- 운영 배포: 아래 출시 항목으로 완료 확인했다.

## 출시

- UI commit `7773466fd689a2d3cc439ecf7ca7fa01ba10bc7e`를 `feat/hig-ui-auth`에 push. 기존 Actions [40722576237](https://github.com/zxcc9867/studyRoom/actions/runs/40722576237) success/exactSHA 확인. 별도 main 변경/새 pipeline/DB·Auth·APK·공급자 설정 수정 없음.
- Vercel `dpl_6GJQa7bTarDxzqtUJGR84zwBz2j4`: production READY, 기존 project `prj_u2Q9FKwNeVjwwtVOjuXNMZRpkR3g`/team·운영 alias·위 sourceSHA 일치. 원격 buildingAt→ready 약58초.
- [운영 독서실](https://study-room-attendance.vercel.app) HTML200·`/assets/index-Pnclj7TD.js`200·`/assets/index-Bt0rDdo8.css`200. 새 recovery status/달력 선택자 존재, 구형 recovery summary 영문 제거 확인.
- `/download/android`와 `/download/android.css`200, 새 ‘안드로이드 앱’/흰 면 토큰 존재, 공개 버전0.2.4/code7 보존 확인. APK 다운로드/설치·Windows 바이너리 교체는 하지 않았다.
- 출시 직후 해당 deployment의 최근5분 error/fatal 그룹 없음. 장기 모니터링·Drains 구성은 이번에 검사/변경하지 않았으며 실기기 전체 수용을 뜻하지 않는다.
- 웹은 새로고침, 이미 열린 Windows/Android hosted 화면은 공부를 마친 뒤 앱 재실행 시 새 UI를 사용한다. 이번 웹 UI에 새 APK/Windows 설치 파일은 필요 없다. 네이티브 로그인/OS 권한 화면 및 이전 자동 전경 문제는 별도 범위다.
