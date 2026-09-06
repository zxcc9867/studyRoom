# PRD: OpenRouter 무료 통합 기반

현재 요구는 비용이 발생하지 않는 무료 코칭이다. 이전 auto/medium 및 유료 고정모델 정책을 대체한다.

- server/ai/openrouter.mjs는 서버 전용. 무료 ID 또는 openrouter/free만 사용, provider.max_price prompt/completion/request=0. 무료 공급자 불가 시 호출 실패를 기능의 기본 조언으로 처리한다.
- 키/model pair 활성화, 입력32개/32000자, 출력1024토큰 기본(최대8192), timeout20초 기본(최대55초), 응답1MiB.
- 키는 GitHub Secret→Vercel production sensitive env 동기화. 프론트 노출금지, 실제값을 로그/문서에 저장하지 않는다.
- 첫 기능은 prd-restart-coaching.md. 사용자 인증과 본인 데이터만 조회, 캐시/일일한도/결과검증/명시적 사용자 저장 흐름을 적용한다.
- 기본 호출 모듈 및 코칭은 유료 fallback을 하지 않는다. 무료 모델이라는 이유로 한국어 품질/근거 검증 기준을 낮추지 않는다.

설정: docs/openrouter-setup.md. 이전 구현 이력과 실제 배포 상태: progress.md.
