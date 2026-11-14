# 별빛 바다와 유성

독서실의 독창적인 애니메이션풍 배경. 영화 장면·등장인물·기존 작품 이미지는 사용하지 않았다.

## 제작과 출처

- 원화는 Codex 내장 `imagegen`으로 생성했다. 실제 파일은 `assets/master.png`, 1672×941이다. 요청한 4K가 아니라 이 실제 크기를 기준으로 기록한다.
- `scene.mjs`의 순수 시간 함수와 `renderer.mjs`의 수면/반사광/유성 애니메이션을 HyperFrames 0.9.9로 로컬 렌더링했다. 영상 생성 서비스가 생성한 동영상이 아니라, AI 생성 원화에 직접 움직임을 설계한 영상이다.
- 출력은 24초·30fps·무음·16:9, WebM VP9 1920×1080과1280×720이다. 1080p는 영상 캔버스 해상도이며 원화의 네이티브 세부 묘사 해상도를 뜻하지 않는다.
- 하늘·섬·구도는 고정하고 수면만 움직인다. 유성은6초와18초 부근에 나타난다. 반복 경계에는 유성이 없고 파도는24초 주기로 닫힌다.
- Wikimedia 영상이 아니며 CC0/CC BY 출처를 부여하지 않는다. 이 문서는 제작 이력이지 별도의 저작권·독점권 보증이나 라이선스 변경이 아니다.
- 앱은 완성된 영상만 재생한다. 제작용 WebGL/GSAP/HyperFrames는 앱에 추가하지 않는다. 카메라·학습·로그인·서버 저장 경로는 사용하지 않는다.

## 재현

이 디렉터리를 별도 작업 폴더로 복사하고 `HYPERFRAMES_SKIP_SKILLS=1`, `DO_NOT_TRACK=1`을 프로세스 환경에 설정한다. 시스템 변경 없이 FFmpeg가 있는 디렉터리를 해당 프로세스의 PATH에 추가한다.

```powershell
npx.cmd --yes hyperframes@0.9.9 check --snapshots --json
npx.cmd --yes hyperframes@0.9.9 preview --background
npx.cmd --yes hyperframes@0.9.9 render --quality delivery --fps 30 --workers 2 -o renders/anime-sea.mp4
```

GSAP 3.15.0은 제작 HTML의 고정된 공식 CDN 의존성이다. HyperFrames 컴파일 시 해석한다. 유료 클라우드 렌더·HeyGen 로그인·외부 영상 생성 API는 사용하지 않았다. 앱 런타임에는 이 의존성이 없다. 초기 검사에서 무음 경고는 공부용 배경의 의도된 동작이다.

## 원화 프롬프트

```text
Use case: stylized-concept. Asset type: original master illustration for a premium animated study-room wallpaper. Create a highly detailed 3840x2160, 16:9 landscape panorama of a tranquil star-filled cobalt-blue night over an open sea, with luminous hand-painted layered clouds, delicate scattered stars and a very subtle violet-blue Milky Way. The look is sophisticated Japanese theatrical-animation background painting: beautiful painterly brushwork, crisp delicate cloud edges, atmospheric depth, clean luminous color design, not a photograph and not a 3D render. Original scene, not a frame or composition from any existing film. Composition: locked wide viewpoint; sky occupies the upper 58 percent and open water fills the lower 42 percent. A low distant island silhouette on the horizon, no foreground rocks or objects, no people, no buildings, no boats. Calm horizontal painted ripples with restrained cool silver-cyan reflections across the water, a faint warm-violet glow at the distant horizon. Emotional, contemplative, quietly uplifting, high-quality art suitable for long focus sessions, not excessively dark. Leave the sea unobstructed so its painted water can be animated later. No meteors or comet trails baked into this still; they will be animated separately. No text, no UI, no frame, no borders, no logos, no watermark. Deliver one finished full-bleed artwork, not a collage or concept sheet.
```

실제 검증 결과와 출력 해시는 [검증 기록](../../verification/2026-11-04-anime-sea-video.md)을 참조한다.
