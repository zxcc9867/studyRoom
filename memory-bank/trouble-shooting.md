# Troubleshooting

기존 상세 항목은 [2026-10 보관본](archive/trouble-shooting-202610.md)에 보존했다. 기존 6천 줄 초과 문서를 공통 지침에 맞춰 요약했다.

## 자동 팀 연결의 시작/가입 경합과 재개 시점

- 증상: 동시 시작/가입 기여 누락 가능, BEFORE 재개 구간 hook은 이전 paused 행을 읽음.
- 원인: 미커밋 세션/멤버십 상호 비가시성·BEFORE UPDATE 조회, 팀 잠금 후 새 세션 발견의 역순.
- 해결: 새 세션 INSERT와 가입에 같은 사용자 advisory 직렬화(UPDATE에는 금지). AFTER 재개 연결, 초기 신호 지연. 사전 잠근 ID 외 세션 발견은 예외→RETRY로 mutation 전체 rollback.
- 방지: migration20261015035420·자동 SQL13개/독립 검토. 실제 PostgreSQL 다중 연결 수용은 미검증.

## mounted RPC wrapper의 abortSignal 보존

- 증상: 팀 테스트 fake를 Promise로 감싼 뒤 개인 시작/제어 실패.
- 원인/해결: builder의 abortSignal 소실. confirm만 then/abortSignal 보존 wrapper, 다른 RPC는 원래 값 반환.
- 방지: 카메라 준비→확인→자동 팀 반영→휴식/재개 Chrome 회귀. 제품 개인 로직을 우회하지 않음.

## 공부 종료와 팀 탈퇴 혼동

- 개인 onEnd는 회고/종료, 종료 trigger는 연결만 닫고 멤버십 유지. 시간 만료는 알림만.
- 탈퇴는 별도 AccessibleDialog에서 확인. 팀장은 위임 또는 해산 선택. 카드에 팀장 표시.
- select는 별도 htmlFor/id label로 option 문구가 접근성 이름에 섞이지 않게 한다.

## 팀 연결 checkpoint의 소수 초

- 기존 close_segment는 구간별 초를 floor해 split마다 1초 미만 배분 손실 가능.
- 개인 duration/출석은 불변. 확정 segment만 보수 합산하며 시간을 만들어 보상하지 않음.
- 보관본의 fractional 회귀: 개인1800초·segment1799초·수동 팀599초.

## Supabase migration 응답 불명

- 요청 상태 만료 등 응답만으로 적용 여부 추측 금지. list_migrations와 실제 schema/함수로 확인 후 재시도.
- local/remote 자동 version 차이를 기록하고 파일명 변경·history repair·전체 db push는 하지 않음.

## 팀 밖의 기존 오류

- 카메라·집중 모드·업데이트·회복·피드·인증 등 과거 근거는 보관본에서 해당 기능명으로 검색한다.
- 수정 전 현재 공식 PRD/architecture-map과 실제 코드·배포를 먼저 대조한다.
