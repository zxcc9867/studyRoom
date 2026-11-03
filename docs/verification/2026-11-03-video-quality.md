# 영상 배경 화질 선택 — 2026-11-03

## 승인·경계
- 사용자 승인: 고해상도 원본이 있는 배경부터 PC1080p/모바일720p 기본, 자동·절약·고화질 선택, 학습 기록 보존, 카메라 병행 검증 후 운영 배포.
- 기존 checkout `C:/jini-dev/worktrees/study-dashboard-clarity`, branch `fix/study-dashboard-clarity`, base `9732da5`. 기존 별도 작업의 미커밋 문서4개/.serena/output은 보존하며 이번 stage에서 제외한다.
- 구름·도시 1080p 추가, 파도720p 추가. 은하수·빗창가 확인된 원본720p는 확대하지 않는다. 출처/제작자/동일 라이선스/다운로드/해시는 public/themes/video/README.md. 새3파일29,584,467bytes. 새 테마나 SDK/서버/DB/Auth/native 설치/카메라 판정 정책 변경 없음.
- auto는 Android/iOS UA·mobile hint/iPad touch 식별 기준이며 viewport 폭/네트워크 기반 ABR이 아니다. saver720p/high 최대1080p. 기존 quality 누락·잘못된 값은 auto로 해석하고 기존 설정을 읽는 것만으로 저장소를 다시 쓰지 않는다. 장식 source/resolution/mobile/request는 저장하지 않는다.
- 배경 source만 keyed remount하고 세대가 다른 보고를 거부한다. 명시 pause/reduced-motion/blur·최초 무다운로드·실패포스터/재시도 계약은 유지한다. draft/취소는 적용/다운로드가 아니다. 학습·카메라 DOM/ref/track/stream·서버·인증은 기존 owner 그대로다.

## 검증
- TDD unit8개 RED(누락 quality/source/helper) → controller22/22. `output/video-quality-red.log`. 최초 UI4개 RED(미구현 화질 group) → 초점/병행4/4 및 실제 도시HD·파도SD 해상도1/1 통과. `output/video-quality-ui-red-unrestricted.log`, `output/video-quality-focused-pass.log`.
- PC1440/Android UA375에서 자동 기본·명시 saver/high·draft취소 무다운로드·pause 중source 교체 무다운로드·재생·저장/재로드·720p-only 정직한 표시·HD실패→SD복구 검증. 카메라는 Chrome 가상 getUserMedia지만 실제 MediaStream/track/video 디코더이며 양쪽1080p에서 카메라·배경 프레임 진행, sampled total37/dropped0·동일node/stream/track/live·추가 getUserMedia 없음·같은 synthetic sessions/todos 확인.
- 기존 전역 설정 경로는 카메라 DOM을 조건부 unmount하므로 동일DOM 검사는 풍경 설정창 경로로 보정했다. VideoPlaybackQuality 객체의 prototype 값 직렬화·재로드 후 기존 자동 카메라 복원에 대한 fixture 가정을 바로잡았다. 제품을 검사에 맞추어 우회하지 않았다. 초기 실패 `output/video-quality-focused.log`, `...-final.log`, `...-corrected.log` 보존.
- 제한 환경의 첫 mounted ERR_NETWORK_ACCESS_DENIED 및 공식 검사 loopback EACCES/npm 네트워크 실패는 실제 제품 회귀와 구분한다. 같은 공식 명령을 허용 환경에서 재실행한다. 전체 Chrome/공식 최종 결과와 운영 출시는 아래에 확정 후 기록한다.
- 독립 reviewer 최종 C0/I0/M0. unit22/22·new3 EBML native1920x1080/1920x1080/1280x720·duration/크기/SHA/출처 문서 일치를 직접 확인했다. 공식7개/Dune0의 같은 unrestricted 로그도 확인했다.
- 최종 전체 Chrome1634/1634, 실패/생략/취소0, duration1,217,885ms, exit0. `output/video-quality-full-chrome.log`. 공식7/Dune0 `output/video-quality-official-unrestricted.log` exit0. 최초 제한 환경의 실패를 최종 통과에 합산하지 않는다. 제품/테스트/새자산9해시는 고정 전후 일치했고 diff/docs검사도 통과했다.

## 실제 감지 모델·합성 카메라 병행 측정
- 별도 로컬 Chrome에서 수정하지 않은 production `bodyPresenceDetection.mjs`를 bundle하고 같은 tasks-vision0.10.35/pose_landmarker_lite 모델·WASM을 로컬 제공했다. 카메라는 Chrome 가상 입력이며 실제 사용자 영상/계정/서버는 사용하지 않는다. 각 영상에서1초 간격6회 실제 detectForVideo를 실행했다. 스크립트/원자료는 ignored `output/playwright/video-quality-detector.mjs`, `...-results.json`, `...-baseline-results.json`과 두 log다.
- 첫1080p 구름 검사: 첫 감지3,005.3ms, 프레임227/누락14. 이후 도시/파도 감지5.3~8.7ms, 프레임182/152·누락0. 이를 ‘모두 무결한 성능’으로 숨기지 않았다.
- 한 변수 비교: 새 격리 프로세스에서 **배경 없이** 첫 감지4,249.5ms를 관측했다. 고화질에서만 생기는 지연이 아니며 기존 모델 초기실행 비용이 있음을 확인한 범위다. GPU 내부 컴파일의 정확한 원인은 단정하지 않는다. 모델/카메라 정책이나 worker 구조를 이번 화질 기능에 섞어 바꾸지 않았다.
- 이후 같은 detector·카메라로 구름720p→구름1080p→도시1080p→파도1080p 각각 약6.15초를 대조했다. 카메라 같은stream/live·프레임 진행, 배경154/154/184/154프레임·누락0, 감지11.3~23.2ms, pageerror0. 이 짧은 합성 비교는 통계적 성능 보장·물리 상반신 판정 정확도·실기기 장시간 발열/배터리 수용이 아니다. 카메라가 끊기거나 학습 기록이 바뀐 관측은 없었다.

## 수용 범위
- 실제 사용자 계정·공부/회복/카메라·학습 서버/API/DB를 조작하지 않는다. 합성 기록/가상카메라는 실제 설치 Windows/Android·물리 카메라의 상반신 정확도·GPU/장시간 배터리/발열 수용을 의미하지 않는다. 전체 DB 전후 digest를 수집하지 않았다.
- 새APK/EXE 없이 hosted UI를 제공하며 실제 앱을 임의 새로고침하지 않는다. 사용자 학습 기록과 현재 실제 테마 선택에는 쓰지 않는다.

## 최종 게이트·운영 출시
- 검증 게이트 완료. 정확 SHA의 Actions success/Vercel READY/운영 alias·자산 응답 확인 뒤 출시 정보를 확정한다.
