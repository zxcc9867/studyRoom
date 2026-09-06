# OpenRouter 서버 연동 준비

현재는 앞으로 만들 AI 기능에서 사용할 서버 공용 모듈을 준비한 단계다. AI 화면이나 공개 생성 API는 아직 없으며, 설정을 등록하거나 배포하는 것만으로 모델을 호출하지 않는다.

## 설정할 곳

1. https://openrouter.ai/settings/keys 에서 API 키를 발급한다. 키를 대화창·저장소에 붙여 넣지 않는다.
2. GitHub 저장소 **Settings → Secrets and variables → Actions → Secrets**에 `OPENROUTER_API_KEY`를 등록한다.
3. 같은 화면의 **Variables**에 `OPENROUTER_MODEL`을 등록한다. 값은 https://openrouter.ai/models 에서 선택한 정확한 모델 ID(`provider/model-id` 형식)다. 무료 모델의 가용성·한도·가격은 사용 시점에 확인한다. 이 설정은 앱 모델이며 Codex/Claude 개발 도구의 모델 설정과는 별개다.
4. 아래 선택 설정도 GitHub Variables에 등록할 수 있다.
5. GitHub Actions의 **Deploy Web to Vercel → Run workflow**를 실행하거나 다음 main 배포를 진행한다. 키/모델 변경은 재배포 후 실행 환경에 적용된다.

| 이름 | GitHub 보관 위치 | 기본값 / 의미 |
| --- | --- | --- |
| OPENROUTER_API_KEY | Secret | 없음, 서버에서만 사용 |
| OPENROUTER_MODEL | Variable | 없음, 명시적으로 선택 |
| OPENROUTER_MAX_TOKENS | Variable | 1024, 1~8192 |
| OPENROUTER_TIMEOUT_MS | Variable | 20000, 1000~55000ms |
| OPENROUTER_SITE_URL | Variable | https://study-room-attendance.vercel.app |
| OPENROUTER_APP_NAME | Variable | Study Room, HTTP 헤더용 ASCII 이름 |

GitHub Secrets는 CI의 보관소이며 Vercel 실행 환경으로 자동 공유되지 않는다. 워크플로의 `Sync optional OpenRouter server environment`가 키를 sensitive production 환경변수로, 나머지를 서버 설정으로 전달한다. 값은 CLI 인자나 출력 대신 표준입력으로 전달한다. `VITE_` 또는 `EXPO_PUBLIC_` 접두사를 붙이지 않는다.

- GitHub의 키와 모델이 모두 없으면 기존 Vercel 값을 건드리지 않고 동기화를 건너뛴다. 초기 상태에 기존 값도 없다면 AI는 비활성 상태다.
- 한쪽만 설정하면 잘못된 구성을 배포하지 않도록 실패한다.
- 두 값이 있으면 GitHub 설정이 해당 Vercel production 값의 기준이다. 선택 값이 비어 있으면 위 기본값으로 동기화한다.
- 동기화는 여러 환경변수를 순서대로 저장하므로 중간에 실패하면 일부 값만 저장될 수 있다. 워크플로는 배포를 중단하며 문제를 수정한 뒤 재실행한다. 기존 배포의 실행 환경은 재배포 전까지 유지된다.
- GitHub Secret을 삭제해도 이미 Vercel에 저장된 키는 삭제되지 않는다. 비활성화하려면 GitHub 쪽 두 값을 정리하고 Vercel의 해당 production 키를 제거한 뒤 재배포한다. 키를 폐기할 때는 OpenRouter에서도 revoke한다.
- preview/development 환경에는 자동 복제하지 않는다. 필요할 때 각 환경을 별도로 설정한다.

## 로컬 설정 검사

Node.js 24에서 저장소 루트의 `.env.local`에 위 값을 설정하고 `npm.cmd run ai:check`를 실행한다. 키·모델 원문 없이 준비 상태만 출력하며 외부 API는 호출하지 않는다. `.env.local`은 Git에서 제외된다. 기존 파일이 있으면 덮어쓰지 말고 필요한 변수만 추가한다.

## 향후 서버 기능에서 사용

```js
// Node.js 서버 코드에서만 사용. 브라우저/Vite 컴포넌트에 import하지 않는다.
import { createOpenRouterClient } from '../server/ai/openrouter.mjs';

const ai = createOpenRouterClient();
const result = await ai.generateText({
  messages: [
    { role: 'system', content: '학습 계획을 간결하게 제안하세요.' },
    { role: 'user', content: '이번 주에 공부할 내용을 정리해 주세요.' },
  ],
  // signal: 요청 취소를 위한 AbortSignal (선택)
});
// result: { id, text, model, usage }
```

`OPENROUTER_MODEL`을 명시해야 하며 클라이언트가 임의의 모델·토큰 한도를 전달하는 통로는 없다. 메시지는 최대 32개/총 32,000자, 응답 본문은 최대 1MiB다. 출력 상한과 타임아웃은 서버 설정으로 적용하며 재시도·다른 모델 fallback은 자동으로 실행하지 않는다. HTTP 오류, 빈 응답, 잘못된 JSON 및 200 응답 안의 오류도 안전한 `OpenRouterError.code`로 처리한다. 원문 키·프롬프트·상위 응답 본문을 에러에 넣지 않는다.

이 모듈 자체는 인증·사용자별 사용량 저장·금액 예산을 관리하지 않는다. 향후 기능별 HTTP 진입점을 추가할 때 Supabase 사용자 토큰 검증, 권한 확인, 공유 저장소 기반 rate limit/할당량, 입력 최소화, 응답 형식 검증을 적용한다. 토큰 한도는 금액 한도와 다르다. 생성 ID/사용량은 기능에 필요한 저장 정책과 함께 연결한다. 사용자 목표/공부 기록을 자동으로 전송하지 않는다.

현재 Vercel 설정은 SPA용 catch-all rewrite를 사용한다. 나중에 Node API route를 공개할 때 `/api/*`가 index.html로 바뀌지 않도록 라우팅을 함께 수정·검증하고, 함수 실행 제한을 AI timeout보다 크게 설정한다. Supabase Edge Function에서 사용하려면 환경변수를 `Deno.env.toObject()`로 주입하고 해당 런타임 검증을 별도로 수행한다. 이번 GitHub 동기화 대상은 Vercel이며 Supabase secrets가 아니다.

## 검증 및 자료

- `npm.cmd test`: provider의 정상/오류/타임아웃/취소/비밀값 미노출 및 CI 동기화 mock 테스트 포함. 유료 API 요청 없음.
- `npm.cmd run build`: 기존 웹의 빌드 확인.
- [OpenRouter 인증](https://openrouter.ai/docs/api/reference/authentication)
- [OpenRouter API](https://openrouter.ai/docs/api/reference/overview)
- [Vercel 환경변수 CLI](https://vercel.com/docs/cli/env)

실제 키·모델을 등록한 뒤의 공급자 응답 품질·과금·모델 가용성은 아직 검증하지 않았다.
