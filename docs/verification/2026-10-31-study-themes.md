# 공부 배경 테마 검증

## 대상과 상태
- 기준: fix/study-dashboard-clarity / d83dabb. origin/main과 제품 소스 차이는 없고 README/인계 문서 후속 변경만 있는 상태를 확인했다. main은 변경하지 않는다.
- 승인: 6종 목업 방향과 라이브 추가 진행. 기존 메뉴·계정·학습·카메라·타이머·DB·인증·네이티브 lifecycle은 유지한다.
- 현재: 구현·최종 회귀/공식 verify/독립 검토 완료. 운영 배포 확인 대기.

## 구현과 범위
- 중립 차콜 팔레트, 정적 6종, 라이브 2종. 장면/효과 위·앱 콘텐츠 뒤의 고정 스크림으로 이미지·효과의 최악 흑/백 픽셀에도 카드 밖 글자 4.5:1 경계를 검사한다.
- 모드 선택은 기존 키를 유지하고 배경/정적·라이브/강도/명시적 일시정지는 별도 기기 키에만 저장한다. 원격 URL/HTML/계정 값은 받지 않는다.
- OS 움직임 줄이기·숨김·명시적 일시정지는 장식만 정지한다. CSS transform/opacity만 사용하며 상시 프레임 JavaScript·영상·소리·추가 서버 없음.
- 기존 desktopRuntime의 backgroundThrottling=false를 확인했다. 이 경우 숨겨도 visibility가 visible일 수 있다는 [Electron 공식 계약](https://www.electronjs.org/docs/latest/api/browser-window#page-visibility)에 맞춰 window blur/focus도 장식만 정지/재개한다. focused=false·visibility=visible인 단위 RED 재현 후 교정했으며 네이티브 설정은 변경하지 않는다.
- 요약/편집 분리, 적용/취소, 분류 간 초안 보존, 키보드 포커스 진입/복원, 저장 실패·이미지 실패 시 안전한 바탕을 제공한다.

## 집중 증거
- 기능 없음 RED: controller/초기 head 5개 실패, 실제 main mounted의 변경 버튼 2개 실패.
- CSS :is pseudo-element/우선순위 RED: live인데 animationPlayState=paused. 직접 선택자·동등 specificity로 교정.
- 테스트 fixture 오류: API request에 상대 URL 사용, reload 후 기존 카메라 안내 미처리, public 이미지 경로를 esbuild가 모듈로 해석. 제품 오류와 구분하여 실제 절대 요청/기존 Escape 흐름/허용된 DOM URL 속성으로 교정했다.
- 명시적 pause·포커스·타 탭 저장 안내·최악 밝기 scrim은 각각 RED 확인 후 교정했다.
- 최종 단위: appearance/atmosphere/mobileTheme 19/19, 실패·생략·취소0.
- Chrome 집중: 15/15(73076ms), 후속 실제 CSS animation timeline 진행/동결1/1(1651ms), 고유16개. output/atmosphere-focused-final.log. 375/1440·100/200%·6종 편집/적용/취소·재실행·저장 실패·이미지 실패·키보드·초안·최악 스크림 경계·fixture 학습/카메라 요청 불변.
- 모든 배경 적용 루프 이후 라우트 대비 순회는 마지막 rain-library 상태다. 이미지별 픽셀을 샘플링한 검사가 아니라 모든 이미지/효과를 덮는 일정 스크림의 보수적 대비 경계 검사와 실제 표면 검사다.
- 실제 375/1440 다크/라이트·확대 설정 스크린샷 시각 검토. 실제 Windows 앱/Android 최소화·물리 카메라·실폰 GPU/배터리 수용은 별도이며 가짜 visibilityState 검사로 완료를 주장하지 않는다.
- 독립 shared-reviewer 최종 C0/I0/M0. 검토자 단위19/19·diff 확인, 검토자 mounted는 로컬 접근 차단으로 본문 진입 전 실패. 부모의 허용된 Chrome 실행 결과와 구분한다.

## 최종 회귀와 공식 게이트
- 최초 전체 Chrome 실행:1543개 중1542통과/1실패·생략/취소0(720321ms). 실패는 새 CSS pause 검사에서 pending 정지의 확정 전 시각을 읽은 6ms 차이였다. 제품 정지 조건을 완화하지 않고 playState=paused 및 pending=false 확정을 기다리도록 검사를 수정했다.
- 최종 actualStudyMounted 전체217/217·이름 고유217·실패/생략/취소0·489979ms/exit0. 앞선 나머지1326개는 모두 통과했고 최종217 이름과 겹치지 않음을 대조했다. 합산1543개 검증, 예상 밖 실패 이름0. 최초 전체 실행을1543/1543 통과로 표현하지 않는다.
- `ai.ps1 verify --project .`: 선언7명령 모두passed/exit0, Dune위반0. desktop:check/desktop:test/npm test/test:edge/mobile:check/build/docs:check. 공식 게이트는 별도 Chrome 환경 변수 없이 실행했으며 브라우저 검사 근거는 위 최종 Chrome 결과다.
- 마지막 docs:check·git diff --check 통과. 로그: output/atmosphere-full-final.log, atmosphere-mounted-final.log, atmosphere-verify-final.log.

## 배포용 자산과 생성 프롬프트
- built-in imagegen 사용. UI 목업을 잘라 쓰지 않고 텍스트/사람/로고/버튼/워터마크 없는 16:9 원본 풍경을 별도 생성했다.
- 공통 프롬프트: original standalone decorative study background; edge-to-edge landscape; refined calm craft; no UI/text/people/logos/watermark/collage; bright details restrained at edges/lower horizon.
| 파일(public/themes) | 장면 프롬프트 | 원본 생성 ID | WebP byte / thumb byte |
|---|---|---|---|
| dawn-city.webp | original pixel-art city at early dawn; indigo/desaturated blue skyline, sparse warm windows, peach horizon, calm violet upper sky | 29d0b573-f3c0-4b75-9b4c-92db720308c4 |117210 / 6630|
| night-alley.webp | original pixel-art midnight alley; blue-violet framing buildings, distant lit tower, small warm windows, wet pavement, no sign lettering |686ccbf1-46aa-4b9a-affd-9043bd988c99|191068 / 8550|
| star-sea.webp | original painted night ocean; deep-blue sea, delicate stars and faint meteor, mountain coast, tiny warm horizon reflections |889a80c4-22df-4f9f-b397-0f0ec86a5015|117274 / 4790|
| sunset-sky.webp | original painted dusk lake and mountains; dark-indigo sculpted clouds, muted peach/amber low horizon, first stars, silhouetted branches at edges |9e220ce6-b66b-4f62-bf4a-74a707fc37b1|103836 / 6474|
| rain-library.webp | original painted rainy study room; bookshelves, blue rainy window, amber lamp at edge, wood desk, closed book/mug, blurred city lights |8840c79f-35da-4db3-bd55-2d9d5c7a872b|164462 / 9516|
- 배경 합계693850 bytes, 축소본35960 bytes. 같은 원본의 `-thumb.webp`이며 기존 이미지를 덮어쓰지 않고 원본을 보존한다. 기존 로컬 sharp로 크기/형식만 최적화했고 제품 의존성 추가는 없다. 이미지 없는 차콜은 배경 네트워크 요청이 없다.

## 다음 게이트
- 전체 Chrome/공식 verify/차이/운영 출시·정확SHA/READY/alias/HTTP200와 자산 대조를 완료한 뒤 기록한다. 운영 학습 데이터 변경·새APK/EXE는 수행하지 않는다.
