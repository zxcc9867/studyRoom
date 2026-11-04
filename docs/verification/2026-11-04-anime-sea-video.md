# 애니메이션풍 별빛 바다와 유성 검증

## 범위
- 사용자 승인: 독창적인 별빛 바다·유성 애니메이션풍 실제 라이브 영상. 기존 학습 기록 유지, 실제 움직임·반복 검증 후 배포.
- anime-sea(별빛 바다와 유성)를 별도 추가한다. 기존star-sea 이미지 효과와 전체 기존14종은 유지한다. 전체15종/실제영상9종.
- 기존 catalog/type/prepaint와 출처 표시만 확장한다. 재생기·기기전용 저장schema·카메라·학습/팀/회복·서버/API/DB·네이티브는 바꾸지 않는다. 실제 사용자 앱/계정/설정/기록을 조작하지 않았다.

## 제작
- [원화 프롬프트/재현](../media/anime-sea/README.md), [사양](../media/anime-sea/SPEC.md), [제작 검토](../media/anime-sea/REVIEW.md).
- 내장imagegen으로 생성한 원화는 실제1672×941,2152757bytes. SHA256 `59A48447E5D3B26E8981186954110DB2BC49CBF003C69D31FD0198570B06E0B4`.
- 자체 시간함수/WebGL로 수면·반사광·유성을 애니메이션화하고 HyperFrames0.9.9 로컬 delivery로 렌더링했다. screenshot capture/hardware GPU/720프레임/41.4초. 유료 클라우드·외부AI영상 API/가입/구매 없음.
- 1080p는 출력 캔버스이며 원화의 네이티브 세부묘사 해상도를 뜻하지 않는다. 앱 출처에도 이를 표시하고 Wikimedia/CC라이선스를 부여하지 않는다. 제작 의존성은 앱에 추가하지 않는다.

| 파일 | 크기(bytes) | 규격 | SHA256 |
|---|---:|---|---|
| anime-sea.webm |1610136|1280×720·VP9·30fps·24초·무음|860A18FC9A95C29B721F9902A693394FFBADD7459F3BA89D31055F837EAD3F49|
| anime-sea-hd.webm |3579940|1920×1080·VP9·30fps·24초·무음|CD42726405F3649E30F738AA9330E24B1EA8DA0EB347A17128AF258D351F5532|
| anime-sea-poster.webp |242212|정지 포스터|9FD3178A548F0D462CF955A0ED0403F115303C0F93628C6CE70CF3CE4307A17F|
| anime-sea-thumb.webp |21372|480×270·선택 카드|01BE3DD2A3635645865AB4D16EA6F94C0667BD6A2440A5635AA6C9D7E806845F|

## 재현·검증
- TDD RED: 제작 함수 미구현2실패→2통과; catalog/prepaint/quality 신규3실패→단위30통과; mounted 신규 카드 미존재2실패→실제경로2통과. RED 로그는 output/anime-video-1104에 보존한다.
- `node --test apps/web/test/atmosphere.test.mjs apps/web/test/atmosphereArtwork.test.mjs`:32/32.
- `node --test --test-name-pattern='resolution labels:|video quality:|emotional video themes:' apps/web/test/actualStudyMounted.test.mjs`(Chrome 지정):21/21·실패/생략/취소0·148066ms.375/1440의 신규영상 실제픽셀5601/57600변화, 실제끝→처음loop, 무음/inline/stream=null, 초안무다운로드, 일시정지/재생, 풍경/학습보존 확인. 원본출처/빈라이선스링크 없음도 확인.
- 같은 집중검사의 PC/mobile 실제 배경·합성카메라 동시1080 재생에서 total46/44,dropped0 관측. 카메라node/stream/track·live·권한요청수·학습/할일/저장값 유지. 이는 물리카메라·장시간 성능 보장이 아니다.
- HyperFrames `check --snapshots --json`:67ddf91b-dfe0-452c-80a2-7526a82aff26, 브라우저 실행됨·lint/runtime/layout 오류0, root index.motion.json 명세 활성/300시점 오류0. 의도된무음경고film_silent1,오디오none정보1. 최초하위root속성누락은 수정 후 재검사했다. 하위폴더의 motion 명세가 비활성으로 보고되어 root 명세로 옮긴 뒤 활성 여부를 확인했다.
- FFmpeg 전체4fps96표본/각 파일: 수면95/95 인접구간변화.720의 minWaterStep.511/maxStep.496/seam.473,1080의 .571/.453/.451(160×90 gray 평균절대차). 끝에서 큰 컷/검정페이드 없이 정상 주기로 연결됨. output/anime-video-1104/frame-analysis.json.
- `ai.ps1 verify --project .`:공식7개/전부exit0·Dune위반0(desktop:check,desktop:test,npm test,test:edge,mobile:check,build,docs:check).
- 독립shared-reviewer:Critical0/Important0/Minor0. 단위32/32·diff·원화/디코딩프레임·공개WebM metadata를 직접 대조했다. 집중Chrome은 로그 확인이며 독립재실행은 아님.
- 전체Chrome:1654/1654·실패/생략/취소0·1110492ms·exit0. 소스·제작·공개자산·테스트19파일 SHA256을 고정했고 완료 뒤19개 모두 동일함을 확인했다. output/anime-video-1104/full-chrome.log / frozen-hashes.json. 범위diff와 문서검사도 통과했다.

## 배포
- 제품 `698414d268f68019a0a8616c57126a943dd11ba9` 기능브랜치 커밋·푸시 완료. [GitHub Actions41758240677](https://github.com/zxcc9867/studyRoom/actions/runs/41758240677) completed/success·같은headSha 확인.
- 대상 확인: Vercel study-room-attendance / prj_u2Q9FKwNeVjwwtVOjuXNMZRpkR3g / team_LaN4bwvH4msrzoQtIw3fqsUj.
- Vercel `dpl_9mVCs7quH4akfDfzna6ZmCa5c8iB` READY/production·정확SHA·fix/study-dashboard-clarity. 배포host study-room-attendance-bdycbube8-astars-projects-c2f42587.vercel.app, 운영alias [독서실](https://study-room-attendance.vercel.app) 연결 확인.
- 운영 HTML·`/assets/index-CSgTUxlH.js`·`/assets/index-DYEs6odE.css` HTTP200·신규catalog/출처 표시 확인. 포스터/썸네일200·영상2개Range206, 공개4파일 전체다운로드 SHA256이 검증본과 모두 일치했다. 제작 출처 GitHub링크도200이다.
- 새 격리 Chrome에서 운영720/1080 파일2/2 모두 videoWidth/Height·24초·무음/loop·stream=null·19개 디코딩 프레임 진행과 실제끝→처음 재생 확인. output/anime-video-1104/production-check.log / output/playwright/anime-production-results-1104.json.
- 배포 직후5분 error/fatal 수준 집계는 빈 결과였다. 이는 클라이언트 오류·장기 안정성·실기기 수용 보장이 아니다. 기존CI action Node20→24 강제실행/ubuntu-latest 이전 안내 경고2개는 성공과 별개인 후속 운영 점검 대상으로 남기고 이번에 workflow를 변경하지 않았다.
- 새APK/EXE는 만들지 않는다. 공통 hosted자산 변경이므로 공부·카메라 종료 후 사용자가 새로고침하면 설정에 추가된다.

## 제한·보존
- 실제 설치Windows/Android 에뮬레이터·물리카메라·장시간GPU/배터리 수용은 미실행. 실제계정/학습기록/기존설정을 임의 변경하지 않았고 서버·DB를 호출해 시험기록을 만들지 않았다.
- 기존 미커밋 theme-device-acceptance/theme-editor-alignment 문서, prd-tech-feed/prd-windows-desktop, desktop-install-acceptance, .serena/다른output은 이번 커밋에서 제외한다.
