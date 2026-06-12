# Active Context

## 현재 작업

- 작업명: Vercel GitHub Actions 자동 배포 파이프라인
- 작업 목적: 로컬 Vercel CLI 로그인에 의존하지 않고, `main` 브랜치 push 시 GitHub Actions가 테스트 후 Vercel production으로 배포하도록 구성한다.
- 관련 PRD: `memory-bank/prd-vercel-ci.md`
- 관련 파일:
  - `.github/workflows/vercel-production.yml`
  - `docs/vercel-ci.md`
  - `memory-bank/implementation-plan.md`
  - `memory-bank/progress.md`
  - `memory-bank/trouble-shooting.md`

## 최근 결정 사항

- 결정: GitHub Actions workflow는 `npm ci`, `npm test`, `vercel pull`, `vercel build --prod`, `vercel deploy --prebuilt --prod` 순서로 실행한다.
- 이유: 테스트가 실패하면 production 배포가 중단되고, CI에서 만든 prebuilt 산출물을 그대로 배포할 수 있다.
- 대안: Vercel Git integration만 사용하는 방식이 더 단순하지만, 사용자가 직접 관리할 수 있는 pipeline 파일이 남지 않는다.
- 영향 범위: GitHub Actions, Vercel production deployment, GitHub Secrets 설정.

## 현재 상태

- 완료: `.github/workflows/vercel-production.yml`을 추가했다.
- 완료: `docs/vercel-ci.md`에 `VERCEL_TOKEN` 발급 방법과 필요한 GitHub Secrets를 문서화했다.
- 완료: `memory-bank/prd-vercel-ci.md`를 추가했다.
- 완료: `npm.cmd test`가 46개 테스트를 통과했다.
- 완료: `npm.cmd run build`가 통과했다.
- 진행 중: 사용자가 GitHub Secrets를 설정한 뒤 `main`에 push하면 첫 GitHub Actions 배포를 확인해야 한다.
- 막힌 부분: Codex가 사용자의 Vercel 계정 토큰을 직접 발급하거나 GitHub Secrets에 직접 저장할 수는 없다.
- 다음 작업: GitHub Secrets 설정 후 push 또는 수동 workflow 실행으로 production 배포 결과를 확인한다.

## 주의할 점

- `VERCEL_TOKEN`은 절대 repository, README, memory-bank, 채팅에 저장하지 않는다.
- 현재 Vercel Git integration도 연결되어 있으므로, 그대로 두면 push 시 Vercel 기본 자동 배포와 GitHub Actions 배포가 중복될 수 있다.
- GitHub Actions를 단일 배포 경로로 사용할 경우 Vercel dashboard에서 Git integration 자동 배포를 끄거나 연결을 해제한다.
