# 독서실 · 2안 AWS 완결형 시험판

[구성 리뷰](../../docs/aws/architecture-review.md)에서 선택한 2안을 **합성 데이터 전용 웹 시험판**으로 실행합니다. Vercel·Supabase·OpenRouter에 연결하지 않으며, 운영 독서실의 설정·계정·데이터나 기존 `infra/aws-cdk` 스택을 변경하지 않습니다. 이 디렉터리는 운영 앱의 대체품이 아닙니다.

CDK 소스는 TypeScript입니다. [CDK 진입점](./bin/pilot.ts), [스택 정의](./lib/pilot-stack.ts), [배포 명령](./scripts/deploy.ts)은 엄격한 타입 검사 후 `dist/`로 컴파일됩니다. 시험 웹과 Lambda 런타임은 기존 JavaScript를 그대로 사용합니다.

## 먼저 로컬에서 확인

Node.js 22 이상을 사용합니다. 아래 명령은 `infra/aws-native-pilot`에서 실행합니다. 합성에 넣는 계정 번호는 자리표시자이며, 이 명령은 AWS 리소스를 생성하거나 Bedrock을 호출하지 않습니다.

```powershell
npm.cmd ci
npm.cmd run compile
npm.cmd test
npm.cmd run synth -- -c account=111111111111 -c region=us-east-1 -c stage=pilot-review -c model=amazon.nova-lite-v1:0 --quiet
```

## 승인 후 시험 환경에 한 번에 배포

1. 운영과 분리된 AWS 시험 계정의 명명된 프로필과 리전을 준비합니다. 이 계정·리전에서 [현대 CDK bootstrap](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html) 기본 qualifier `hnb659fds`가 필요합니다. 배포자는 CDK 역할을 수임하고 STS·SSM·RDS·Bedrock 모델 메타데이터·CloudFormation을 확인할 수 있어야 하며, 시험 스택의 Lambda 초기화·S3 업로드·Cognito 관리자 테스트를 수행할 권한이 필요합니다.
2. Aurora PostgreSQL 16.8 Serverless v2와 RDS Proxy가 지원되는 AZ, AppSync Events 지원, NAT·Lambda 할당량을 확인합니다. Bedrock은 같은 리전의 직접 호출이 가능하고 [Converse](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html)를 지원하는 텍스트 모델을 고릅니다. 아래 모델과 리전은 입력 형식 예시이며, 실제 지원·권한은 계정에서 재확인해야 합니다. 교차 리전 추론 프로필로 자동 변경하지 않습니다.
3. 예산과 비용 책임자를 정한 뒤 아래를 실행합니다. `--allow-cost`는 **과금 가능한 AWS 리소스 생성 및 모델 호출**에 대한 실행자 확인입니다. CDK IAM 권한 확대 확인이 나오면 내용을 직접 검토합니다.

```powershell
$pilotAccount = '승인된 시험 계정의 12자리 번호'
npm.cmd run deploy -- --profile study-room-sandbox --account $pilotAccount --region us-east-1 --stage pilot-review --model amazon.nova-lite-v1:0 --allow-cost
```

진입점은 로컬 빌드·테스트·합성 후 STS 계정 일치, bootstrap, 모델·Aurora 지원과 기존 스택 태그를 검사합니다. 이후 해당 이름의 시험 스택만 배포하고, 스키마를 초기화하고, CloudFront가 공개 설정을 정상 제공하는지 확인합니다. 두 합성 계정으로 토큰 로그인, 저장과 조회, 다른 계정 조회·구독 거부, AppSync 실시간 신호, Bedrock 결과까지 검사합니다. 완료된 스모크 계정은 정리하고 합성 DB 기록은 시험 자료로 남깁니다. 어느 단계든 실패하면 명령은 실패를 반환하며 스택을 자동으로 삭제하지 않습니다.

### 별도 브라우저 수용 확인

자동 검사는 IAM 권한이 필요한 별도 Cognito 클라이언트를 사용합니다. CloudFront 화면에서 실제 관리형 로그인·PKCE를 확인하려면 운영자가 **같은 시험 User Pool**에 새로운 시험 사용자(비실제 식별자)를 만들고 초기 암호를 안전하게 전달합니다. 사이트를 열어 로그인 → 합성 기록 저장 → 같은 시험 계정으로 다른 탭에서 로그인한 뒤 상태 반영 → 로그아웃을 확인합니다. 초기 암호나 토큰을 문서나 Git에 남기지 않습니다. 이 작업과 실제 AWS 스모크는 코드 작성 시점에 실행하지 않았습니다.

### 유지 비용과 종료

- 이 시험판은 Aurora Writer 1개(0.5–2 ACU), Proxy, NAT 1개를 기본으로 두므로 **트래픽이 없어도 고정비가 생길 수 있습니다.** [구성 리뷰의 비용표](../../docs/aws/architecture-review.md#월-비용-계산)는 Reader·NAT 2개를 포함한 운영 목표의 예시이지 시험판 견적이 아닙니다. [Aurora](https://aws.amazon.com/rds/aurora/pricing/), [RDS Proxy](https://aws.amazon.com/rds/proxy/pricing/), [NAT](https://aws.amazon.com/vpc/pricing/) 요율로 실제 환경을 따로 계산하세요. AI 작업은 UTC 하루 사용자당 3회·전체 30회이며, 이 호출 제한은 AWS 고정비를 막지 않습니다.
- 종료 시에는 같은 계정·리전·스택 태그를 확인하고 시험 사이트 사용을 중단합니다. 별도 종료 승인을 받은 뒤에만 **해당 시험 Aurora의 삭제 보호를 해제**하고 같은 스택을 삭제합니다. Aurora는 삭제 시 스냅샷을 남기도록 구성했으며 S3·Cognito·비밀값은 보존됩니다. CloudFormation과 비용 콘솔에서 NAT·Proxy·DB의 종료를 확인하고, 스냅샷·S3·비밀값은 정해진 보존 기간 이후 승인된 것만 별도로 정리합니다. 운영 자원에 연결하거나 기존 기록을 옮기지 않습니다.
