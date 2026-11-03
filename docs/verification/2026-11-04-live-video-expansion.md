# 라이브 영상 3종·미지원 해상도 숨김

## 승인·범위

- 2026-11-04: 따뜻한 벽난로·눈 내리는 밤거리·노을 지는 호수 실제 영상 추가, 미지원1080p 버튼 숨김, 기존 학습 기록 유지, 실제 움직임·반복 재생 검증 후 운영 배포 승인.
- 공통 catalog/type/prepaint·AtmosphereSettings만 확장한다. 플레이어/controller 선택·정지 정책, 학습·카메라·Auth·DB·API·native 파일은 변경하지 않는다. 기존 quality enum(auto/saver/high)과 high→720 초안 정규화/취소 보존도 유지한다.
- 영상8개/전체14개. 새3종은 각각720p/1080p이며 PC자동1080p·모바일자동720p 계약을 재사용한다. 카드는 적용 전 종류를 표시하며 편집/취소로 영상을 다운로드하지 않는다.
- 실제 사용자 앱/계정/설정/학습·DB는 조작하지 않았다. 재생과 카메라 검사는 격리된 실제Chrome·합성 학습 fixture/가상 카메라다. 설치된 Windows/Android·물리카메라·장시간 성능 수용을 대신하지 않는다.

## 미디어 채택과 가공

- 제작자·원문·CC BY3.0/3.0/2.0·다운로드·수정·6파일 크기/SHA256는 [자산 출처](../../apps/web/public/themes/video/README.md)에 기록했다. 앱의 영상 출처에도 제작자·라이선스와 변경 내용을 표시한다.
- 원본의 초기/중간/끝 시트에서 snow가 낮으로 밝아지고 lake가 검게 끝나는 문제를 발견했다. snow0–30s 후보도 중간에 낮 장면이 있어 채택하지 않았다. 원본 전구간을4초 간격으로 다시 확인해 연속 밤26–46s를 선택했다.
- FFmpeg9.0.2 휴대용 ZIP의 게시 SHA256를 확인했다. ignored output에서만 실행했고 시스템/앱 의존성·유료 서비스는 추가하지 않았다. 공개자산에는 실행파일·원본·로그를 넣지 않았다.
- fire원본0–24s→23s, snow26–46s→19s, lake0–10s→9s. tail에서head로1초 dissolve 후 다음 루프가 연속 지점에서 시작한다. 각 해상도 원본에서24fps VP9/yuv420p·무음으로 내보내고 최종영상에서 포스터1280×720/썸네일480×270을 추출했다. 확대해 가짜1080p로 표시하지 않는다.
- isolated Chrome에서6개 모두1280×720/1920×1080·duration23/19/9·muted/loop=true·srcObject=null 디코딩,3테마 끝→처음 재생 계속을 확인했다. 초기/중간/끝 최종 시트도 확인했다.
- FFmpeg4fps·160×90 회색조 전구간 분석: fire92/snow76/lake36표본, 인접 표본 움직임91/75/35회(각SD/HD). 경계 평균절대차는 내부최대차보다 작다(fire5.83<7.50, snow1.40<8.77, lake10.17<15.66). 이는 표본 검사이며 완전 무지각 반복이나 물리기기 성능 보장이 아니다.

## 재현·회귀

- RED: 새 catalog/prepaint/기기별 소스 단위7실패, 미지원1080p 부재 UI375/1440 두 실패(실제1/기대0)를 확인했다.
- GREEN: 단위28/28. `resolution labels:|video quality:|emotional video themes:` 실제Chrome19/19·실패/생략/취소0,141408ms.
- 신규3종 각375/1440: 실제 프레임 변화는320×180표본에서9430–40520픽셀, 임계57초과. 적용 전 무다운로드·종류·HD디코딩·무음/inline/loop·MediaStream분리·끝→처음·pause/resume·풍경/기록보존을 검사했다.
- PC/모바일UA: 새3종auto1080/720 교체 중 카메라 동일node/stream/track·프레임 진행/추가카메라요청없음·기존합성sessions/todos 불변. 초기focused는18/19였다. 신규auto모바일720 후 기존paused교체 시험도720을 선택해 교체 전제가 사라진 테스트 문제였고, 먼저1080을 적용하는 원래 전제로 복원했다. 제품 player는 변경하지 않았다. 최초실패와 최종성공 로그를 구분했다.
- 독립 shared-reviewer: C0/I0/M0. 단위28/28·6파일의 해상도/24fps/무음·크기/해시·포스터/썸네일·원문 라이선스 직접 대조. 브라우저 독립 재실행은 하지 않았다.
- 공식 `ai.ps1 verify --project .`: Dune위반0 및 desktop:check/desktop:test/npm test/test:edge/mobile:check/build/docs:check7개 모두passed/exit0. 이후 문서 갱신 뒤 docs:check도 재통과했다.
- 전체 실제Chrome: `node --test --test-concurrency=1 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs`에 FEED_BROWSER_MODULE/EXECUTABLE 활성화.1648/1648·실패/생략/취소0·1,319,297ms·exit0. 제품/테스트/영상/포스터19파일의 실행 전후SHA256 동일, diff --check 통과. 운영배포는 아래 출시 확인 전 완료로 간주하지 않는다.

## 별도 애니메이션풍 조사

- 이번3종은 실사 영상이며 애니메이션풍을 구현했다고 보고하지 않는다.
- 사용자는 후속 분위기로 ‘별빛 바다·유성’을 선택했다. 독창적 장면의 실제 영상 제작 구성을 제안할 수 있으나 이번 실사3종에 정지 이미지나 기존CSS 효과를 새 영상처럼 포함하지 않는다.
- 조사 범위에서1080p 이상·애니메이션풍·무료·앱 재배포까지 명확한 후보는 확보하지 못했다. 영화 장면·출처불명 월페이퍼는 채택하지 않았다.
- 원작자 [YUQIWORKS Animated Scenes Vol.1](https://yuqiworks.itch.io/animated-scenes-vol1)은1440p/8초 실제MP4 루프와 개인/상업 프로젝트 사용을 명시하지만 앱/CDN 재배포 범위는 불명확하다. 구매·채택·연락은 하지 않았다. 독창적 황혼 도시/별빛 바다의 실제 영상 제작을 후속 선택지로 제안할 수 있다.

## 증거·출시

- ignored output: live-expansion-red-ui.log / hidden-green.log / focused.log / focused-final.log / media-final.log / frame-analysis.log / render.log / snow-render-final.log.
- ignored output/playwright: cozy-original-contact-1104.png / snow-source-intervals.png / cozy-contact-1104.png / cozy-media-results-1104.json / cozy-frame-analysis-1104.json 및 합성 화면 캡처.
- 공식 검증/전체Chrome 통과: output/live-expansion-official.log / live-expansion-full-chrome.log / live-expansion-frozen-hashes.json. 제품SHA·Actions/Vercel/HTTP는 아직 미완료.
