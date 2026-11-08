# 독서실 2안 · AWS 완결형 시험판 설계

상태: 승인한 시험판 범위의 [코드와 배포 진입점](../../../infra/aws-native-pilot/README.md) 작성. AWS 미배포. [목표 구성도](../../aws/architecture-review.md)의 운영 이전과 구분한다.

## 목표와 비범위

사전 bootstrap을 마친 명시적 AWS 계정·리전에서, 한 배포 명령으로 독립 웹 시험판을 올리고 새 Cognito 로그인 → 합성 기록 쓰기/읽기 → AppSync 상태 갱신 → Bedrock 작업 완료를 검증한다. 별도 Vercel·Supabase·OpenRouter 설정이나 기존 학습 정보는 사용하지 않는다.

- 기존 `infra/aws-cdk` MVP, 운영 독서실, 네이티브 앱, DNS, 실제 계정·학습 기록은 변경하지 않는다.
- 출석 정산, 회복, 팀/공유 채널, 피드, 외부 알림, 소셜 로그인, 과거 데이터 이전은 포함하지 않는다. Scheduler는 시험판 작업 처리용이다.
- 현재 작업은 로컬 코드·테스트·템플릿 합성까지다. 유료 AWS 리소스 생성과 실제 Bedrock 호출을 포함한 클라우드 시험은 계정·리전·모델·예산 승인 뒤 별도로 실행한다.

## 구성과 배포 경계

| 경계 | 시험판 설계 |
|---|---|
| 배포 단위 | `infra/aws-native-pilot` 전용 CDK 앱과 시험용 웹/핸들러. 기존 스택과 별도 이름·태그·설정·비밀값. 기존 스택이나 운영 ID 재사용 금지. |
| 웹·인증 | 비공개 S3 + CloudFront OAC. Cognito 관리형 로그인, 공개 웹 클라이언트는 인증 코드 + PKCE와 정확한 CloudFront 콜백. 셀프 가입은 끄고 운영자가 시험 계정을 발급한다. |
| API | JWT 검증을 적용한 API Gateway HTTP API + Lambda. 시험 풀 발급자·두 시험 클라이언트의 audience만 허용하고 Lambda가 `token_use=access`와 `sub`를 확인한다. 별도 API 주소에서 CloudFront origin만 CORS 허용해 생성 순환을 피한다. |
| 데이터 | 2개 AZ의 사설 네트워크에 Aurora PostgreSQL Serverless v2 writer + RDS Proxy를 둔다. 시험판은 Reader와 두 번째 NAT를 기본으로 만들지 않으며 운영 목표의 가용성·가격과 다르다. |
| DB 접근 | 관리자 초기화 함수만 DB에 직접 접근한다. API/워커는 TLS를 강제한 Proxy를 거쳐 제한된 DB 사용자로 접근하며 비밀값은 Secrets Manager에서 가져온다. SG는 Lambda→Proxy, Proxy→DB, 초기화 함수→DB에만 필요한 연결을 연다. |
| 갱신 | AppSync Events 개인 채널 `study/<sub>`. Cognito 구독과 서버 IAM 발행을 분리한다. `onSubscribe`에서 채널 소유자를 검사하고 와일드카드는 거부한다. 메시지는 변경 신호만 전달한다. |
| AI/작업 | 고정된 합성 입력을 받아 작업 ID를 `202`로 돌려준다. Aurora에 작업을 기록하고 Scheduler/디스패처가 SQS로 전달한다. Lambda 워커는 명시한 모델만 Bedrock에서 호출한다. 큐/DLQ·작업 상태·재시도 한도를 둔다. |
| 네트워크·운영 | 사설 Lambda가 AWS 공개 API에 접근하는 HTTPS 송신 경로는 NAT 1개를 사용한다. 실제 배포 전 최소 AZ·엔진/Proxy 지원·Bedrock 모델·대략 비용을 확인한다. CloudWatch 로그에 토큰·DB 비밀값·프롬프트를 남기지 않는다. |

AWS 근거: [CDK 배포와 bootstrap](https://docs.aws.amazon.com/cdk/v2/guide/deploy.html), [Cognito PKCE](https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html), [RDS Proxy 연결과 TLS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.howitworks.html), [AppSync 인증](https://docs.aws.amazon.com/appsync/latest/eventapi/configure-event-api-auth.html), [구독 핸들러](https://docs.aws.amazon.com/appsync/latest/eventapi/channel-namespace-handlers.html).

## 사용 경로와 안전 조건

1. 시험 웹 로그인은 인가 코드의 `state`와 PKCE를 확인한다. API는 검증된 Cognito `sub`를 소유권에 사용한다. 브라우저에서 보낸 사용자 ID를 권한 근거로 삼지 않는다.
2. 합성 기록은 자기 것만 읽고 쓴다. 저장 커밋 뒤 버전 신호를 보내며, 연결을 잃거나 신호가 누락되면 API 재조회로 복구한다. 다른 시험 계정의 조회·구독은 모두 거부한다.
3. 코칭은 합성 프롬프트·제한된 응답만 저장한다. 중복 큐 메시지는 DB 조건부 상태 전이로 제어한다. 호출 성공 여부가 불명확한 작업을 무제한으로 재호출하지 않는다.
4. 배포 진입점은 명시적 프로필·예상 계정 ID·리전·Bedrock 모델과 시험 환경 이름을 요구한다. STS 계정 일치, bootstrap, 허용 환경·비용 승인 여부를 확인한 뒤에만 AWS 쓰기를 시작한다. 환경이 다르면 실패하고 운영으로 대체하지 않는다.
5. 명령 순서: 빌드/테스트 → 합성 → 시험 스택 적용 → 재실행 가능한 스키마 초기화 → 공개 설정(주소·클라이언트 ID만) 배치 → 자동 스모크. 스키마 초기화가 실패하면 쓰기 테스트를 중지한다. 중간 실패를 성공으로 표시하거나 리소스를 임의 삭제하지 않는다.
6. 자동 스모크용 사용자 발급과 토큰 요청은 운영자 IAM이 필요하며, 공개 로그인 클라이언트와 분리한다. 비밀번호·토큰은 출력/저장하지 않는다. 관리형 브라우저 로그인은 자동 API 스모크와 별도 수용 항목으로 둔다. 검사 결과에 남은 비용 발생 리소스와 종료 절차를 명시한다.

## 완료 기준

- 로컬: 자격 증명 없이 synth·유닛·템플릿 검증 성공. 기존 MVP 변경 없음. 암호화, 비공개 DB, IAM 발행/사용자 구독, CORS, 비밀값 미출력, 대상 계정 불일치 차단을 확인한다.
- 승인 이후 클라우드: 합성 계정 두 개로 자기 기록 저장·조회, 교차 조회·구독 차단, 변경 후 실시간 수신과 재조회, AI `202`→완료 또는 명시적 실패를 확인한다. 실제 Bedrock 응답은 모델·리전·예산이 승인된 시험에서만 호출한다.
- 독립 시험판의 성공은 운영 기능의 동등성, 데이터 이전 완료, 리전 장애 복구를 뜻하지 않는다. 운영 전환은 별도 설계와 승인 대상이다.
