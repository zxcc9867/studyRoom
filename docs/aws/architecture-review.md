# 독서실 AWS 인프라 설계 리뷰

**상태: 검토용 제안 · 미배포.** [공식 아이콘 구성도와 상세 설명(HTML)](./aws-architecture-review.html)은 파일을 내려받아 브라우저에서 엽니다. GitHub에서 바로 읽고 코멘트하려면 이 Markdown을 사용하세요. 기존 [인프라 문서](../infrastructure-architecture.md)는 별도 참고 자료이며, 이 PR은 운영 설정이나 이전을 승인하지 않습니다.

## 먼저 결정할 것

**AWS 배포가 목표라면 1안부터 검증**합니다. 기존 기록과 로그인은 그대로 두고 웹과 코칭 API의 실행 위치만 바꿉니다. **Supabase와 OpenRouter 제거 자체가 필수**라면 2안을 검토합니다. 2안은 AWS에서 통제할 수 있는 범위가 넓지만, 로그인·데이터 권한·실시간 처리·스케줄을 다시 구현하고 운영해야 합니다.

| | 구성도 1 · 혼합형 | 구성도 2 · Aurora 완결형 |
|---|---|---|
| 바뀌는 것 | Vercel의 웹·코칭 API를 AWS에서 제공 | 웹·코칭뿐 아니라 로그인·DB·동기화·정기 작업을 AWS로 이전 |
| 유지하는 것 | Supabase Auth·PostgreSQL·Realtime·Cron/Edge, OpenRouter | 기존 학습 데이터와 기능 요구사항. Google·Slack·RSS 등 외부 연동은 기능을 쓰는 한 유지 |
| 월 예상 비용 | **AWS $2.03** + Supabase·OpenRouter 실사용료. Supabase Pro 기본·OpenRouter 무료 예시 **$27.03** | **$263.37**: 서울, Aurora Writer/Reader·Proxy, NAT 2개 예시 |
| 맞는 상황 | 기록 보존, 작은 운영비, 빠른 AWS 시험 | 외부 데이터·AI 플랫폼 제거 또는 AWS 중심 복구·권한 관리가 필수 |

## 1. 혼합형 — 배포 경로만 옮김

```mermaid
flowchart LR
  app["웹 · Windows · Android"] --> edge["CloudFront"]
  edge -->|화면| s3["비공개 S3"]
  edge -->|코칭 API| api["API Gateway Regional REST"]
  api --> fn["Lambda"]
  fn --> ai["OpenRouter"]
  fn -->|인증 검증 및 데이터 접근| sup["Supabase"]
  app -->|로그인 · 저장 · 변경 구독| sup
  sup --> job["Cron · Edge Functions → 알림 · 피드"]
```

- **왜 이 구성인가:** Vite 빌드 결과를 CloudFront·S3로 제공하고, Vercel의 코칭 함수만 AWS로 옮기면 기존 계정·데이터·출석 정책에 손대지 않고 AWS 배포 가능성을 확인할 수 있습니다. 비공개 S3에 대한 원본 접근은 OAC로 제한합니다.
- **제약:** 기존 코칭 핸들러의 상한은 50초입니다. 동기 응답을 유지하려면 Regional REST API 통합 시간 상향과 CloudFront 원본 대기 시간을 검증해야 합니다. 상향을 전제로 운영을 전환하지 않습니다. 설치된 앱의 신뢰 주소와 로그인 복귀 주소도 별도 확인합니다.

## 2. Aurora 완결형 — 인증·데이터·AI까지 옮김

```mermaid
flowchart LR
  app["웹 · Windows · Android"] --> cf["CloudFront"]
  cf --> s3["비공개 S3"]
  app --> auth["Cognito 로그인"]
  cf -->|"API · JWT 검증"| gw["API Gateway HTTP API"]
  gw --> api["Lambda API"]
  subgraph dbzone["VPC 사설 데이터 경로"]
    api --> proxy["RDS Proxy"]
    worker["Lambda 워커"] --> proxy
    proxy --> db[("Aurora PostgreSQL")]
  end
  api -->|저장 후 변경 신호| events["AppSync Events"]
  events -->|WebSocket 알림| app
  api -->|AI 작업 접수| queue["SQS"]
  queue --> worker
  scheduler["EventBridge Scheduler"] -->|정기 실행| worker
  worker --> bedrock["Amazon Bedrock"]
```

- **왜 이 구성인가:** Cognito가 로그인, Aurora가 기록, AppSync가 갱신 신호, EventBridge Scheduler가 정기 실행을 맡습니다. HTTP API는 통합 상한이 30초이므로 길어질 수 있는 AI 요청은 `202`로 접수한 뒤 SQS·Lambda가 Bedrock에서 처리하고 앱이 결과를 조회합니다. IAM·Secrets Manager·CloudWatch는 자원 권한·비밀값·운영 지표를 맡습니다. RDS Proxy는 연결 재사용 통로이며, RDS DB를 별도로 두는 안이 아닙니다.
- **AppSync의 역할:** PC에서 공부 시작 → Lambda가 Aurora에 저장 → AppSync가 권한 있는 화면에 변경 신호 전달 → 휴대폰이 인증된 API로 최신 상태 조회. AppSync에는 학습 원문이나 카메라 영상을 싣지 않습니다. 신호가 누락되면 재연결·화면 복귀·열린 화면의 주기적 보조 조회로 최신 상태를 확인합니다. 1안에서는 Supabase Realtime이 변경을 알립니다.
- **제약:** 기존 사용자 UUID·출석 규칙·팀 권한·DB 정책과 정기 작업을 이식해야 합니다. 토큰 검증만으로 팀 접근을 허용하지 않습니다. 팀 구독과 조회를 각각 검증하고, 기존 앱 로그인 복귀·재연결·백업 복원을 시험합니다.

## 평가와 의사결정

| 기준 | 1안 · 혼합형 | 2안 · Aurora 완결형 | 리뷰에서 확인할 것 |
|---|---|---|---|
| 비용 | 소규모 고정비가 낮음. Supabase 플랜·외부 AI 한도가 변수 | Writer/Reader·Proxy·NAT 고정비가 큼. ACU가 늘면 증가 | 월 상한, 실제 CDN 전송·DB I/O·AI 토큰·ACU |
| 운영 | 기존 규칙과 작업 재사용. 장애 추적은 공급자별로 분산 | AWS 권한·모니터링에 집중. 큐·구독·네트워크·복구를 직접 운영 | 알람 담당, 공급자별 장애 대응, 정기 작업 재시도 |
| 성능 | 코칭이 Supabase·OpenRouter 왕복에 의존. 기존 실시간 경로 유지 | 업무 API·DB를 같은 리전에 둘 수 있지만 Proxy·큐·추가 조회 비용도 생김 | 화면 로딩, 일반 API p95, PC→모바일 상태 지연 p95, AI 접수→완료 |
| 가용성·복구 | 기존 공급자 백업·복구 조건에 의존. 기존 Vercel을 둔 채 시험하기 쉬움 | Aurora의 다른 AZ Reader로 장애 전환 가능. 리전 장애·앱 전체 무중단을 보장하지 않음 | RPO/RTO, DB 장애 전환·시점 복원, 전환 후 쓰기의 되돌리기 |
| 보안·이전 | 현재 RLS와 계정 경계를 유지. 앱의 새 주소 신뢰 검증 필요 | DB 사설 접근·IAM 모델 권한을 통제. RLS 이식·계정 매핑·구독 권한은 새 위험 | 타 계정/팀 데이터 차단, 비밀·로그 취급, 기존 ID·기록 정합성 |

성능과 복구는 **설계상 차이이며 실측값이 아닙니다.** AWS 시험은 합성 데이터부터 시작합니다. 완결형을 선택하려면 외부 플랫폼 제거 필요성, 허용 월비용, 피크 지연, 허용 데이터 손실과 복구 시간이 먼저 합의되어야 합니다.

## 월 비용 계산

2026-11-07 기준, 서울 `ap-northeast-2`, 730시간, USD 세전. 월 활성 30명, 정적 요청 10만·전송 100 GB, S3 10 GB, 일반 업무 API 10만, AI 1,000회(입력 2,000·출력 500토큰/회), AppSync 50만 작업·12만 연결 분, 로그 수집/저장 각 1 GB를 가정했습니다. 실제 계정 청구액이나 보장 견적은 아닙니다.

| 항목 | 1안 계산 | 2안 계산 |
|---|---|---|
| CloudFront | 공용 잔여 무료 한도 내 → $0 | 동일 |
| S3 | `10×0.025 + 100000×0.00000035 + 1000×0.0000045` → $0.28950 | 동일 |
| API Gateway | REST `1000×0.0000035` → $0.00350 | HTTP `100000×0.00000123` → $0.12300 |
| Lambda x86 | `1000×0.5×5×0.0000166667 + 1000×0.0000002` → $0.04187 | `(120000×0.5×0.2 + 1000×0.5×5)×0.0000166667 + 121000×0.0000002` → $0.26587 |
| Secrets Manager | `1×0.40 + 1000×0.000005` → $0.405 | `2×0.40 + 2000×0.000005` → $0.81 |
| CloudWatch | `1×0.76 + 1×0.0314 + 0.50` → $1.2914 (알람 $0.50 예산 포함) | 동일 |
| Aurora Standard | — | `(0.5+0.5)×730×0.20 + 10×0.12 + 1000000×0.00000024` → $147.44 |
| RDS Proxy | — | `(0.5+0.5)×730×0.025` → $18.25 |
| NAT + IPv4 | — | `2×730×(0.059+0.005) + 10×0.059` → $94.03 |
| AppSync Events | Supabase Realtime에 포함/초과분 별도 | `0.5×1.00 + 0.12×0.08` → $0.5096 |
| Cognito / SQS / Scheduler | — | 직접·소셜 로그인 무료 구간 가정 + 큐·스케줄 소량 예산 $0.20 |
| 모델 | OpenRouter 실제 사용료; 무료 모델·한도 내 $0 | Nova Micro 예시: `2×0.041 + 0.5×0.164` → $0.164 |
| Supabase | 실제 플랜·초과분: Free $0 / Pro 기본 $25 예시 | — |
| **합계** | **$2.03 + 외부 실사용료** | **$263.37** |

반올림 전 합산 후 표시했습니다. Aurora+Proxy+NAT 합계 **$259.72**가 2안의 비용 대부분입니다. 합산 평균 DB 용량이 **1 ACU 증가**하면 `730×(0.20+0.025) = $164.25`가 더해집니다. NAT 1개면 `730×(0.059+0.005) = $46.72`를 줄일 수 있지만 AZ 이중화가 달라지는 별도 구성입니다. RDS Proxy를 연결한 상태에서는 Aurora 자동 일시중지를 가정하지 않았습니다. Bedrock 모델은 서울 호출 단가 예시이며, Nova Micro의 지역 간 추론 경로·한국어 품질은 확정 전 확인합니다.

열린 화면의 보조 조회 주기는 2안에서 실측으로 정합니다. 예를 들어 연결 12만 분 전부에 현재의 15초 주기 조회를 그대로 적용하면 보조 조회만 약 `120000×60÷15 = 480000`건이므로, 위 10만 API 가정을 다시 잡아야 합니다.

**제외:** 신규 크레딧, 할인, 세금, 도메인/DNS, WAF, 별도 KMS 키, 이메일/SMS, 추가 백업·전송, 외부 구독 초과분, 시험 기간 중복 운영, 이전/운영 인건비. 상시 무료 구간은 계정의 잔여 한도를 전제로 합니다. 1안과 2안의 서비스 수준·복구 목표가 동일하다는 뜻이 아닙니다.

### 출처

- 요율: [AWS Price List](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/price-changes.html), [서울 Aurora/RDS 공개 가격표](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/ap-northeast-2/index.json), [RDS Proxy](https://aws.amazon.com/rds/proxy/pricing/), [VPC](https://aws.amazon.com/vpc/pricing/), [CloudFront FAQ](https://aws.amazon.com/cloudfront/faqs/), [AppSync](https://aws.amazon.com/appsync/pricing/), [Cognito](https://aws.amazon.com/cognito/pricing/), [Bedrock](https://aws.amazon.com/bedrock/pricing/), [Supabase](https://supabase.com/pricing), [OpenRouter](https://openrouter.ai/pricing).
- 설계: [AppSync Events](https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-concepts.html), [HTTP API 한도](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-quotas.html), [Regional REST API 한도](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-execution-service-limits-table.html), [Aurora 자동 일시중지](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html), [Nova Micro 리전](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-micro.html), [AWS 공식 아이콘](https://aws.amazon.com/architecture/icons/).
- 프로젝트 기준: [코칭 핸들러](../../api/study-coaching.mjs), [웹 배포 설정](../../vercel.json), [아키텍처 맵](../../memory-bank/architecture-map.md).
