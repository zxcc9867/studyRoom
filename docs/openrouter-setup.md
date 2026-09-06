# 무료 OpenRouter 코칭 설정

현재 구현 대상은 Today의 재시작 코치다. 서버 API 배포와 DB migration까지 적용되어야 화면에서 사용할 수 있다. 실제 출시 상태는 memory-bank/progress.md를 확인한다.

## GitHub 설정

Secrets: OPENROUTER_API_KEY. Variables: OPENROUTER_MODEL (권장 openrouter/free 또는 실제 제공되는 provider/model:free).

선택 Variables: OPENROUTER_MAX_TOKENS 기본1024(1~8192), OPENROUTER_TIMEOUT_MS 기본20000(1000~55000), OPENROUTER_SITE_URL 기본 production URL, OPENROUTER_APP_NAME 기본 Study Room.

기존 OPENROUTER_ROUTING_MODE/OPENROUTER_AUTO_COST_TIER는 더 이상 사용하지 않는다. 남아 있어도 유료 모드로 전환되지 않는다. 무료 이외 모델 ID는 서버와 CI가 openrouter/free로 치환한다. model이 무효 형식이면 설정 오류로 처리한다.

GitHub Secrets는 서버 실행환경과 별도다. 배포 workflow가 키/모델/옵션6개를 Vercel production으로 전달한다. key/model 모두 없으면 기존 Vercel 값을 보존하고 skip, 한쪽만 있으면 실패한다. 키는 sensitive로 stdin 전달하며 출력하지 않는다. 순차 환경변수 저장이 중간에 실패하면 배포가 중단되며 재실행이 필요하다. GitHub에서 키를 삭제해도 Vercel에 저장된 키가 지워지지 않으므로 비활성화하려면 양쪽 설정을 정리하고 재배포한다.

프론트에서 사용하는 Supabase URL/anon 또는 publishable key는 서버 API의 사용자 토큰 검증/사용자 권한 데이터 조회에도 사용한다. SUPABASE_URL 및 SUPABASE_ANON_KEY 우선, VITE_SUPABASE_URL 및 VITE_SUPABASE_ANON_KEY fallback. service-role은 요구하지 않는다. OpenRouter 키에는 VITE_/EXPO_PUBLIC_를 절대 붙이지 않는다.

## 무료 전용 동작

선택한 무료 모델 또는 무료 라우터에 provider.max_price={prompt:0,completion:0,request:0}, data_collection=deny로 요청한다. 유료 후보/fallback/검색 플러그인을 추가하지 않는다. 무료 공급자가 없거나 timeout/응답 검증 실패이면 기본 조언으로 돌아간다. source='rules'를 UI에 표시한다. 무료 라우터는 기능 지원 후보에서 무작위 선택하므로 최고 성능을 보장하지 않는다.

입력은 선택한 할 일 제목과 필요한 익명 집계뿐이며 사용자가 요청 버튼을 누를 때만 호출한다. 코칭 결과는 사용자별 저장하고 동일 입력 캐시/하루3회 한도를 둔다. 실제 사용자 이메일/UUID/회고 원문/카메라 자료는 모델에 전달하지 않는다. OpenRouter 추론비 제한과 Vercel/Supabase 자체 서비스 요금은 별개다.

## 개발 확인

로컬 .env.local은 Git 제외. npm.cmd run ai:check는 준비 여부만 확인하고 API를 호출하지 않는다. npm.cmd test와 build를 실행한다. 프론트 Vite만 실행하면 Vercel API가 없어 실 호출 검증은 vercel dev 또는 배포 환경이 필요하다.

server/ai/openrouter.mjs는 Node 서버 전용이며 generateText({messages,signal}) -> {id,text,model,usage}. 응답 본문1MiB, 메시지32개/32000자 제한. 키/프롬프트/원문 상위 오류를 로그에 넣지 않는다.

- [무료 라우터](https://openrouter.ai/docs/guides/routing/routers/free-router)
- [Provider 가격 제한](https://openrouter.ai/docs/guides/routing/provider-selection)
- [데이터 정책](https://openrouter.ai/docs/guides/privacy/data-collection)

일일3회는 기본 조언 생성도 포함하며 동일 입력 캐시 조회는 제외한다. 요청이 중단되어 저장되지 않은 예약은90초 후 재시도 가능하고 새 시도도 한도에 포함된다. 코칭 API는 전체50초/AI최대20초로 제한하며 공용 client의 더 긴 timeout 설정을 그대로 사용하지 않는다. 피드백은 저장되지만 첫 버전에서 다음 생성에 자동 반영되지는 않는다.
