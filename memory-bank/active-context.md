# Active Context

## 현재 작업

- 작업명: Vercel GitHub Actions 자동 배포 파이프라인 배포 확인
- 작업 목적: GitHub Secrets 설정 후 `main` push로 GitHub Actions가 Vercel production 배포를 수행하도록 만든다.
- 관련 PRD: `memory-bank/prd-vercel-ci.md`
- 관련 파일:
  - `.github/workflows/vercel-production.yml`
  - `docs/vercel-ci.md`
  - `memory-bank/prd-vercel-ci.md`
  - `memory-bank/implementation-plan.md`
  - `memory-bank/progress.md`
  - `memory-bank/trouble-shooting.md`

## 최근 결정 사항

- 결정: GitHub Actions workflow는 `npm ci`, `npm test`, `vercel pull`, `vercel deploy --prod` 순서로 실행한다.
- 이유: `vercel build --prod`는 현재 Vercel 프로젝트의 Node.js `24.x` 설정을 CI 로컬 빌드에서 거부하므로, Vercel 원격 빌드가 production 설정을 사용하도록 맡기는 편이 안전하다.
- 대안: `vercel build --prod` + `vercel deploy --prebuilt`는 테스트 산출물 배포 측면에서 좋지만, 현재 프로젝트 설정과 충돌한다.
- 영향 범위: GitHub Actions workflow, Vercel production deployment.

## 현재 상태

- 완료: 커밋 `0d54fa7`을 `origin/main`에 push했다.
- 완료: GitHub Actions run `27435664940`이 생성됐다.
- 완료: 해당 run에서 `npm test`는 통과했다.
- 막힌 부분: 첫 run은 `vercel build --prod` 단계에서 `Found invalid Node.js Version: "24.x"`로 실패했다.
- 진행 중: workflow를 remote build 방식으로 수정해 다시 push하고 production 배포 결과를 확인한다.
- 다음 작업: 새 GitHub Actions run 성공 여부와 Vercel production deployment URL을 확인한다.

## 주의할 점

- `VERCEL_TOKEN`은 repository, README, memory-bank, 채팅에 저장하지 않는다.
- 현재 Vercel Git integration도 연결되어 있으므로, GitHub Actions와 중복 배포가 생길 수 있다.
- GitHub Actions를 단일 배포 경로로 사용할 경우 Vercel dashboard에서 Git integration 자동 배포를 끄거나 연결을 해제한다.
