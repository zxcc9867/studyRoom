# 영상 화질을 해상도로 표시

- 시작: 2026-11-03, `C:/jini-dev/worktrees/study-dashboard-clarity`, `fix/study-dashboard-clarity`, base767470f. 사용자 요청: 절약/고화질 대신1080p 같은 해상도 표시, 별빛 밤하늘의1080p 미지원 이유 설명.
- 변경은 AtmosphereSettings.tsx의 표시·편집 초안과 atmosphere.css의 미지원 상태다. 자동/720p/1080p를 표시하고, 현재 화질은 controller의 실제 선택 resolution을 사용한다. 1080p 없는 영상은 disabled·미지원/최대720p 설명을 연결한다. 저장 enum(auto/saver/high), 선택기/재생기·영상 파일/카메라·학습/API/native는 변경하지 않는다.
- 기존 high+720p-only 선택은 요약720p, 편집 초안만 saver로 정규화한다. 취소는 원래 JSON을 그대로 보존하고 명시 적용 시만 saver를 저장한다.1080p 초안에서720p-only 테마로 변경하면 draft만720p로 바꾼다. 자동의 기기별 기본값과 pause/초안 무다운로드 계약은 유지한다.
- 출처 재확인: [현재 채택한 Milky Way 공개 배포 원본](https://commons.wikimedia.org/wiki/File:Milky_Way_in_Glen_Canyon_National_Recreation_Area.webm)은1280x720, 21초이며 공개 transcode도720p 이하만 제공한다. 촬영자가 고해상도본을 전혀 갖고 있지 않다는 뜻은 아니다. 현재 앱에 검증된1080p 파일이 없다는 뜻이며 단순 확대를 실제 고해상도로 오표시하지 않는다. 영상 교체/새 다운로드/업스케일은 이번 요청에 포함하지 않는다.

## 검증
- TDD: 새2개375/1440 검사가 기존 ‘고화질 ·720p’ 요약 때문에 RED. `output/resolution-labels-red.log`. 구현 후 새2+기존화질5개7/7 통과. `output/resolution-labels-focused.log`, 실패/생략/취소0.
- 실제 UI 경로에서 disabled1080p/720p 체크·지원 테마 전환/원복·취소 JSON 보존·명시 Apply·pause 중 무다운로드·44px/가로 넘침·same sessions/todos 확인. 기존 PC/Android UA 검사에서720/1080디코딩·같은카메라node/stream/track/프레임 유지·HD실패복구·재로드 보존도 통과했다. 합성 UI이며 실제 설치앱/계정/물리기기 수용은 아니다. 스크린샷은 합성 표식과 함께 ignored output에만 둔다.
- 공식7/Dune0 통과·exit0. `output/resolution-labels-official.log`. 독립 reviewer C0/I0/M0·직접 unit22/22·지원 원본 재확인/범위한정diff통과. 리뷰 해시 Settings1763DD37/CSS82E7AE6B/mounted53F70CA6. 별도작업의 기존 dirty 문서4개/.serena/다른output은 보존한다.
- 최종 전체 Chrome1636/1636, 실패/생략/취소0·1,082,066.91ms·exit0. `output/resolution-labels-full-chrome.log`. 검증 전후 고정3파일 해시는 모두 동일하며 제품 코드/테스트 변경 없이 출시한다. 최종diff/docs검사도 통과했다. 공식7·전체Chrome·집중7은 각각의 범위로 구분하고 이전1634개 결과를 새검사로 재사용하지 않았다.

## 출시
- 2026-11-04 00:00 JST 운영 확인. 제품 source `dae832dea159b227b7ce707e8617d95278bbdd52` 기능 브랜치 커밋·푸시, Actions `41658560298` completed/success/동일SHA.
- Vercel `dpl_Hvq1xkUxM7zkCcP5n3v5nW2QDoJ1` READY/production/동일SHA·운영alias `study-room-attendance.vercel.app` 확인.
- 운영 HTML/JS `/assets/index-BLAacgHS.js`/CSS `/assets/index-C3gTwXQ0.css` 모두HTTP200. JS의 saver720p/high1080p·미지원/기기 안내, CSS의 disabled 상태 규칙 확인. `output/resolution-labels-production-http.log`, exit0. 영상/선택기/재생기 바이트는 변경하지 않아 새 미디어 출시나 실제 기기 재생 수용으로 표현하지 않는다.
- 배포 한정 직후5분 error/fatal 집계는 빈 결과다. 장기·클라이언트 전체 무오류 보장은 아니다. 관측·서버·요금제/보안/환경 설정 변경 없음.
- 이후 출시 기록 커밋은 문서 전용이다. 실제 앱·공부·카메라·사용자 설정이나 서버 기록은 조작하지 않았으며 학습/카메라 정책 변경 또는 새APK/EXE가 필요한 작업이 아니다. 공부·카메라 사용을 마친 뒤 새로고침해 확인한다.
