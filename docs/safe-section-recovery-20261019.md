# 화면 연결 복구 — 검증·출시 근거

## 선정과 범위

사용자가 테스트 후 개선 선정·구현과 롤백 가능한 분리를 위임했다. 실제 운영에서 확인한 설정 진입 후 전체 빈 화면을 우선했다. 이전 자산이 HTTP200/HTML로 응답했으므로 상태코드만으로 정상 판정하지 않는다.

| 이전 | 개선 |
|---|---|
| 선택 메뉴 파일 실패 → 대시보드 전체 비움 | 실패한 영역만 안내, 메뉴·Dashboard 상태 유지 |
| reload로 카메라/입력 중단 위험 | 자동 reload 없음, 공부·휴식/기존 Dashboard 저장·조회 중 차단 |
| 회고 lazy 실패 → 종료 UI 재진입도 계속 실패 | 필수 종료·회고 UI를 entry와 함께 로드 |
| 일반 오류 원문 | 정돈된 안내·오늘 복귀·유휴 명시 reload·입력 손실 안내 |

피드/팀/숲/리포트/공개태그/적응형알림 오류를 격리한다. 필수 회고는 eager import이며 렌더 오류 경계도 유지한다. 모든 런타임 오류나 초기 entry 자체의 실패를 복구한다고 확대하지 않는다.

## 테스트

- 실제 main.tsx와 React를 Chrome에 마운트한다. Supabase와 카메라는 로컬 fixture/fake media만 사용한다. 운영 데이터는 변경하지 않는다.
- optional dynamic import만 실패 주입한다. eager 회고를 실패 주입 대상에서 속여 제외하는 것이 아니라 dynamic import 경로에만 실제 실패를 주입해 필수 UI가 deferred 경로를 사용하지 않음을 검증한다.
- 최초 설정375/1440·회고 실패3개 RED. 추가 필수 종료창1개 RED, 진행 중 목표 저장 guard1개 RED 확인.
- camera track 동일성·active/paused 유지·추가 카메라 요청/자동 lifecycle 없음·오늘 복귀·원문 비노출·44px/명도 대비/175%글자·유휴 명시 reload·목표 저장 응답 전후 guard를 검사한다.
- 집중10/10, 실제 Chrome 전체1343/1343·실패/생략0(517022ms), ai.ps1 verify Dune0·Node/Edge/mobile/build/docs5명령 exit0. 독립 검토의 Important2/Minor1 보완 후 재검토 차단 결함 없음. 최초 전체 실패2개는 회고 lazy 및 main의 Suspense 위치를 고정하던 옛 문자열 assert였으며, 새 mounted 수용이 보호하는 동작으로 대체하고 전체를 처음부터 다시 실행했다.
- 로그: output/android-024-20261018/section-recovery-red.log, section-essential-red.log, section-goal-red.log, section-recovery-green.log, section-final-full-tests-2.log, section-final-verify.log. 가상 화면 캡처는 output/playwright/section-recovery-*.png. output은 Git에 게시하지 않는다.

## 롤백 지점

```text
rollback/study-room-before-recovery-20261019 → ce7704a (제품 소스72b5434와 동일)
                                              └─ fix/study-room-update-recovery → 이번 개선
```

이전 버전 복귀는 `gh workflow run vercel-production.yml --repo zxcc9867/studyRoom --ref rollback/study-room-before-recovery-20261019`로 가능하다. 실행 전 `git ls-remote origin refs/heads/rollback/study-room-before-recovery-20261019`가 위 보존 SHA인지 확인한다. ref가 이동했다면 해당 SHA를 가리키는 별도 rollback 브랜치로 배포한다. 파괴적 reset/force push나 학습 DB 복원은 하지 않는다. 실제 운영 rollback 실행은 하지 않았다.

## 출시·실제 기기

- 제품225fd82310b95de5827afd4abb90ac094f3668c5, branch fix/study-room-update-recovery. Actions [39148327299](https://github.com/zxcc9867/studyRoom/actions/runs/39148327299) completed/success·headSha 일치.
- Vercel dpl_6V7zDuYn3EKLkwkoPgSW7WjrZ1Yg, project prj_u2Q9FKwNeVjwwtVOjuXNMZRpkR3g, production READY·정확 SHA/ref·운영 alias 확인.
- https://study-room-attendance.vercel.app HTTP200, 새 /assets/index-DYSG7zV-.js HTTP200/application/javascript·286437bytes·복구 문구 포함.
- Android16 실제 설치0.2.4/code7의 기존 로그인 WebView에서17:14:17UTC 검증: AdaptiveReminderCard 자산1건만 테스트 HTML200 응답→복구 안내/메뉴 유지→가로채기 제거→유휴 명시 reload→정상 적응형 카드/오늘 복귀. raw 오류 미출력, 시작/저장/회복 대리제출/DB DML 없음. before/after 타이머0·오늘3시간19분·3/5완료 동일. 로그 section-android-acceptance.log. 실제 화면 가로채기는 종료 시 해제했고 캐시 설정을 복원했다.
- PC도 새 entry로 reload 후 설정/적응형알림 정상 로드·오류안내0→오늘 복귀, 로그인/3시간19분/3/5완료·video stream 없음 유지. 테스트 전 양쪽 유휴·초안 없음 확인.
- Android17:15:45UTC COLD 재실행(Status ok, 데이터 삭제/재설치 없음). 즉시 초기빈본문은 성공 근거에서 제외했으며17:16:42 확인에서 기존 로그인·정상 오늘/3시간19분/3/5완료·카메라 꺼짐 복원 확인. AppOps CAMERA 최종 duration1m18.729s로 사전값과 동일·추가 요청 없음. 신규 OAuth/실휴대폰 DND·물리 착석6분 정확도까지 검증했다고 확대하지 않는다.
- 새 native/APK·DB/API/권한·카메라 판정·학습 정책 변경 없음. 기존 실제 [테스트] 세션/할 일/회고는 보존하며 이번 화면 복구 수용에서는 새 학습 기록을 만들지 않았다. 롤백 전용 branch도 원격에 동일 ce7704a로 push했다.
- 이전 수용과 남은 항목: docs/cross-device-study/labeled-acceptance-20261019.md. 오래된 이어서 할 일 안내, 실제 평소자세6분·실휴대폰 DND·장시간 배경/담당전환은 별도 후속 범위다.
