# AGENTS.md

이 문서는 `C:\jini-dev\project\study-room-attendance` 독서실 앱 저장소에서 AI 코딩 에이전트가 따라야 하는 작업 규칙이다.

## 1. Memory Bank

- 작업 전에는 이 저장소의 `memory-bank`를 확인한다.
- 제품 방향, 아키텍처, 데이터 공급자, AI 분석, 자동화/스케줄러, 인증, 알림, DB, 배포 관련 변경을 시작하기 전에는 반드시 관련 `memory-bank` 문서를 읽는다.
- 프로젝트에 `memory-bank/README.md`가 있으면 먼저 읽고, 어떤 주제의 작업이 어떤 문서와 연결되는지 확인한다.
- `memory-bank/design-document.md`는 장기 제품 목표, 단계별 로드맵, 핵심 기능, 운영 원칙을 확인하는 기준 문서로 사용한다.
- `memory-bank/progress.md`는 연결 완료, 부분 연결, 미연결 상태를 기록하는 문서로 사용한다. 구현 상태를 README 표에 중복해서 늘리지 말고, 진행 상태는 `progress.md`에 우선 기록한다.
- `memory-bank/active-context.md`는 현재 작업 맥락과 최근 결정을 확인하는 문서로 사용한다.
- `memory-bank/implementation-plan.md`는 아키텍처, 폴더 구조, 기술 스택, 디자인 패턴, 코드 컨벤션, 배포 전략을 확인하는 문서로 사용한다.
- `memory-bank/trouble-shooting.md`는 과거 실수, 실패 모드, 해결 방법을 확인하는 문서로 사용한다. 관련 작업을 반복하기 전에 먼저 확인한다.
- 기능 요구사항이 바뀌면 관련 `memory-bank/prd-*.md`를 확인하고 필요하면 업데이트한다.
- 작업 후에는 변경된 맥락을 관련 `memory-bank`에 반영한다.
- 프로젝트 방향, 구현 상태, 코드/운영 컨벤션, 알려진 실패 모드가 바뀌면 같은 논리적 변경 안에서 대응하는 `memory-bank` 문서를 업데이트한다.
- 최소한 `memory-bank/active-context.md`와 `memory-bank/progress.md`는 업데이트 여부를 검토한다.
- 오류를 조사하거나 해결했다면 `memory-bank/trouble-shooting.md`에 원인과 해결 방법을 기록한다.
- Supabase, 배포, 인증, 외부 API, DB 스키마 변경은 관련 PRD 또는 `memory-bank/implementation-plan.md`에도 반영한다.

## 2. 작업 범위

- 사용자의 최신 지시를 최우선으로 따른다.
- 요청받은 범위 밖의 대규모 리팩터링이나 무관한 파일 변경은 하지 않는다.
- 기존 코드 스타일, 폴더 구조, 테스트 방식을 우선한다.
- 민감한 키, 토큰, 비밀번호는 코드, 로그, 문서, memory-bank에 기록하지 않는다.
- 사용자가 만든 변경사항을 되돌리지 않는다.

## 3. Supabase 작업

- Supabase 테이블, RLS, 함수, Edge Function, Auth 설정, secrets, cron을 확인하거나 변경할 때는 Supabase MCP 또는 Supabase CLI를 사용한다.
- DB 스키마 변경은 `supabase/migrations/`에 migration 파일로 남긴다.
- 원격 Supabase에 적용한 변경은 migration 상태, 함수 상태, secret 상태 등 실제 확인 결과와 함께 `memory-bank`에 기록한다.
- 서비스 role key, provider token, bot token, cron secret은 프론트엔드 코드나 문서에 기록하지 않는다.

## 4. 검증

- 코드 변경 후 가능한 검증을 수행한다.
- Windows PowerShell에서는 가능하면 `npm.cmd`를 사용한다.
- 일반적인 검증 후보:
  - `npm.cmd test`
  - `npm.cmd run build`
  - 관련 단위 테스트
  - Supabase migration/function 상태 확인
  - 주요 사용자 플로우 확인
- 검증을 실행할 수 없으면 최종 응답에 이유를 명확히 적는다.

## 5. Vercel 자동 배포 의무

- 사용자에게 보이는 웹앱 기능, UI, 인증, 알림, 데이터 저장, 라우팅, 빌드 설정을 변경한 경우, 작업 완료 단계에서 Vercel production 배포까지 수행한다.
- 이 규칙이 적용되는 경우 사용자는 배포에 필요한 커밋과 푸시를 승인한 것으로 본다. 단, 사용자가 명시적으로 "커밋하지 마", "푸시하지 마", "배포하지 마"라고 지시하면 최신 지시를 우선한다.
- 현재 production URL은 `https://study-room-attendance.vercel.app`이다.
- 기본 배포 경로는 GitHub Actions workflow `.github/workflows/vercel-production.yml`이다.
- 배포 완료 전에는 최종 답변을 보내지 않는다. 최소 확인 기준은 다음과 같다.
  - 테스트 또는 빌드 통과
  - GitHub Actions 또는 Vercel 배포 작업 성공
  - Vercel deployment 상태가 `READY`
  - production URL이 HTTP 200으로 응답
- 문서만 수정한 작업, 로컬 도구 설정만 수정한 작업, Vercel과 무관한 프로젝트 작업은 자동 배포 대상이 아니다. 다만 문서 수정이 배포된 웹앱 동작에 필요한 설정 변경이라면 배포 대상이다.

## 6. Git

- 사용자가 명시적으로 요청하지 않는 한 임의로 커밋하거나 푸시하지 않는다.
- 단, `## 5. Vercel 자동 배포 의무`가 적용되는 웹앱 변경은 예외로 하며, 배포를 위해 필요한 커밋과 푸시를 수행한다.
- 파괴적인 명령(`git reset --hard`, 강제 checkout, 재귀 삭제 등)은 명시적 요청 없이는 실행하지 않는다.

## 7. Spec Kit

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan.
<!-- SPECKIT END -->

## 8. 최종 응답

작업 완료 후에는 다음 내용을 포함한다.

- 완료한 작업
- 변경한 파일
- 확인한 memory-bank 문서
- 업데이트한 memory-bank 문서
- 검증 결과
- 배포 결과: Vercel 대상 작업인 경우 deployment ID, 상태, URL, HTTP 확인 결과
- 주의 사항 또는 다음 작업
