# 자리 비움 회복 정책 검증 (2026-11-07)

## 범위

서버가 5분 이상 확인한 별도 미감지 구간 세 번째에 공부일당 카메라 회복 한 건을 생성한다. 기존 pending/submitted 등은 보존하고 동일 공부일의 재생성을 막는다. 경고·10분 시간 제외·상반신 판정·공부일·출석 회복과 클라이언트에는 변경이 없다. 새 집계는 적용 이후의 적격 heartbeat에서 시작하며 과거 경고를 재집계하지 않는다.

## 검증

- 기존 반복경고 생성/재생성과 경고 cooldown 중 별도 구간 누락을 RED 5건으로 확인했다. 재연결 claim의 299초 오집계와 구 Edge 직접 INSERT도 별도 RED로 재현 후 보완했다.
- 최종 집중 SQL/Edge/카메라 73/73 통과. 연속 25분의 경고 세 번은 한 구간, 299/300초 경계, cooldown과 독립적인 세 번째 생성, 제출 후 차단, 다른 날짜/계정/결석 분리, 동일일 세션 분리, 권한과 원본 9종 fixture 보존을 검증했다.
- 독립 검토의 Important 2건을 해결했고 재검토 C/I/M 0. 구 버전은 카메라 직접 INSERT를 할 수 없고 결석 INSERT는 유지된다. 실제 상반신 입력·실계정 기록에는 쓰지 않았다.
- 회복 일관성/마이그레이션 계약 검사 48/48, 최종 `ai.ps1 verify --project .` Dune 0 및 공식 7개 통과. 초기 전체 검사에서 발견한 구 경고 정규식과 구 생성 helper를 쓰는 fixture는 새 실제 SQL/Edge 생성·읽기 검증으로 대체했다. 별도 전체 브라우저/실기기 수용은 수행하지 않았다.

## 출시 절차

1. Vercel 대상 프로젝트와 검증된 SHA를 확인한다. Supabase 경고 Edge만 배포해 기존 경고와 pending 전달은 유지하면서 이전 생성 경로를 멈춘다. 게이트웨이 JWT 설정 및 함수 내 인증은 기존과 동일하다.
2. 새 DB 마이그레이션 적용 및 함수/ACL·RLS, 트리거, 보호 함수 지문을 읽기 전용으로 확인한다. 새 구간 테이블은 비공개이며 기존 데이터의 백필, 삭제, 업데이트는 없다.
3. 기존 GitHub Actions 웹 운영 배포의 정확 SHA·READY·HTTP를 확인한다. 운영 장애 시 기존 데이터를 유지하면서 새 heartbeat 트리거만 제거하는 별도 전진 migration을 사용한다. 이전 경고 횟수 기반 Edge를 복구하지 않는다.

## 운영 근거

- 제품 SHA `1af2f23e3c0cc0d6811d118fff6568c6c2017ec7`, 기능 브랜치 푸시. 클라이언트 제품 소스·main·태그·환경 설정 변경 없음.
- Supabase Edge `camera-presence-warning` 24→25 ACTIVE, 두 파일 SHA 소스 일치, 기존 JWT 설정과 함수 내 사용자 인증 유지. 공개 OPTIONS 204 및 인증 없는 POST 401, 실계정 이벤트 쓰기 없음.
- 로컬 migration `20261107053852` → 운영 `20261107055421`. 두 트리거 활성, 비공개 테이블 RLS/3역할 직접 접근 거부, 새 함수 2개 본문/권한 일치. 기존 11개 함수의 정의·ACL 지문 동일, 새 보안 advisor 없음. 기존 행을 재작성하는 SQL 없음.
- [웹 운영 작업 42344753270](https://github.com/zxcc9867/studyRoom/actions/runs/42344753270) success, 정확 SHA `1af2f23`. Vercel `dpl_FHQj4t1MSVsoxMUum5cwnnzBVyjJ` production READY·동일 SHA·운영 alias·aliasError 없음, Vite 빌드 34.4초.
- [운영 도메인](https://study-room-attendance.vercel.app) HTML/동일 JS `index-Buln7JHk.js`/CSS `index-BBcuqMHI.css` HTTP 200, 카메라 미리보기 CSS 보존. READY 이후 짧은 관측 구간에 Vercel runtime 오류 미관측; Drains 조회 404라 설정 유무 미확인.
- 실제 계정·카메라/앱 새로고침·재설치 조작 없음. 상반신 미감지의 개별 원인은 프레임 미저장으로 확정할 수 없으며, 새 회복 집계가 감지 정확도를 수정하지 않는다.
