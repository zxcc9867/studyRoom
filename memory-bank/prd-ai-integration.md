# PRD: OpenRouter 통합 기반

## 목표와 범위

추후 학습 계획·회고 등 AI 기능에서 재사용할 서버 전용 호출 모듈을 준비한다. API 키와 모델은 코드에 고정하지 않고 실행 환경변수로 받는다. 현재는 사용자 화면, 공개 생성 endpoint, 자동 분석·스케줄러를 추가하지 않는다.

## 계약

- server/ai/openrouter.mjs의 createOpenRouterClient().generateText({messages, signal})로 호출한다.
- OPENROUTER_API_KEY와 OPENROUTER_MODEL이 모두 있을 때만 호출 가능하다. 모델 이름을 지정하지 않아 공급자 기본 유료 모델이 호출되는 경로는 허용하지 않는다.
- 메시지 최대 32개·32,000자, 출력 토큰 1~8192(기본1024), timeout 1~55초(기본20초), 응답 본문1MiB 제한. 자동 재시도·모델 fallback 없음.
- 반환값: {id,text,model,usage}. 원문 비밀값·프롬프트·공급자 오류본문을 로깅하지 않는다.
- GitHub Secret의 API 키와 Variables의 모델/옵션을 production Vercel env로 동기화한다. 키는 sensitive로 저장한다. 키와 모델이 모두 미설정이면 기존 배포 설정을 보존한다.
- .env.local 및 기타 실환경 파일은 Git에서 제외한다. VITE_/EXPO_PUBLIC_ 키를 사용하지 않는다.

## 수용 기준과 후속 기능

mock fetch로 정상/오류/빈응답/취소/시간제한/비밀값 비노출 검증. CI adapter는 누락 skip, 불완전 구성 거부, stdin 전달, 실패 시 배포 중단을 검증한다. 실제 키 취득과 유료 API 호출은 이번 작업에 포함하지 않는다.

기능별 API를 공개할 때 사용자 인증·권한·사용량/금액 제한·생성 저장 정책·개인정보 최소화를 별도로 구현한다. server 공용모듈만으로 공개 API의 접근 통제가 제공되는 것은 아니다. UI 기능이 정해지면 요구사항에 맞는 모델의 품질·비용을 평가한다.

설정과 예제: docs/openrouter-setup.md.
