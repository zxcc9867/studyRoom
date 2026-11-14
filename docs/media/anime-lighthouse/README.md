# 은하가 비치는 등대

독서실용 독창적인 애니메이션풍 영상. 깊은 남색 밤바다, 은하수, 멀리 빛나는 등대를 배경으로 한다. 특정 작품의 장면이나 인물을 사용하지 않았다.

- 내장 imagegen으로 만든 원화는 `assets/master.png`(1672×941). 수정본에서는 고리 행성만 지우고 자연스러운 별밭으로 채웠다. 새벽 등대와 고리 행성 후보는 배포 자산에 넣지 않는다.
- 등대 빛·옅은 해무·수면을 시간에 따라 합성한다. 은하수와 등대 실루엣은 고정하며 컷·깜빡임·오디오를 넣지 않는다.
- 24초·30fps·16:9 WebM VP9를 720p/1080p로 출력한다. 1080p는 출력 캔버스 해상도이며 원화의 고유 해상도가 아니다.
- HyperFrames와 WebGL은 제작용이다. 앱은 포스터와 완성 영상을 기존 재생기로만 읽으며 카메라·로그인·학습 데이터 경계는 그대로다.

## 재현

기존 독서실 영상 제작과 같이 HyperFrames 0.9.9 및 FFmpeg를 사용한다. 아래 명령은 이 디렉터리의 별도 작업 사본에서 실행한다.

```powershell
$env:HYPERFRAMES_SKIP_SKILLS='1'
$env:DO_NOT_TRACK='1'
npx.cmd --yes hyperframes@0.9.9 check --snapshots --json
npx.cmd --yes hyperframes@0.9.9 render --quality delivery --fps 30 --workers 2 -o renders/anime-lighthouse.mp4
$source = 'renders/anime-lighthouse.mp4'
$vp9 = @('-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '24', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-threads', '6', '-pix_fmt', 'yuv420p', '-force_key_frames', 'expr:eq(n,719)')
ffmpeg -n -i $source @vp9 renders/anime-lighthouse-hd.webm
ffmpeg -n -i $source -vf scale=1280:720:flags=lanczos @vp9 renders/anime-lighthouse.webm
ffmpeg -n -i $source -frames:v 1 -c:v libwebp -quality 85 renders/anime-lighthouse-poster.webp
ffmpeg -n -i $source -vf scale=480:270:flags=lanczos -frames:v 1 -c:v libwebp -quality 82 renders/anime-lighthouse-thumb.webp
```

## 출력과 반복 경계

- HyperFrames 0.9.9 로컬 GPU 렌더: 720프레임, 42.7초. 제작 단계의 GSAP 3.15.0은 컴파일 시 인라인된다. 운영 앱은 외부 영상 서비스나 제작 코드를 호출하지 않는다.
- 초기 인코딩에서 끝→처음의 압축 차이가 프레임 검사 기준을 넘었다. 원본 장면과 24초 길이는 유지하고, VP9 CRF 24와 마지막 프레임 키프레임으로 경계의 압축 차이를 줄였다.
- FFmpeg로 두 영상을 모두 720프레임 디코딩했다. 160×90 명도 평균 절대차에서 720p 끝→처음 0.397(영상 내부 최대 0.445), 1080p 0.364(내부 최대 0.401). 7프레임 간격 102구간 모두 수면 변화가 확인됐다. 30fps, 24.000초, 영상 스트림만 존재한다.

| 파일 | 바이트 | SHA-256 |
|---|---:|---|
| `anime-lighthouse.webm` | 2161668 | `A8BD4E1C3F571C38497AA8FF108E6B4125D5A2204872A857E7A815CF01AC6993` |
| `anime-lighthouse-hd.webm` | 3952061 | `6BDE1432B6CB7D37A150F46CDAABEF3FEA42F43F5C559FDA623C16476AE63774` |
| `anime-lighthouse-poster.webp` | 118842 | `97E65A94A9FF1F3D66E8B3BD3E238842EF9A08FE3CEFA9B5D020D16064C6048C` |
| `anime-lighthouse-thumb.webp` | 11992 | `070B119E86B127D25258B2B4D271D916AACAC0D5F1E52E42BD3F8C936504A8EA` |

## 앱 검증

- 375px Android 사용자 에이전트 자동 720p와 1440px PC 자동 1080p에서 실제 프레임 변화(표본 57,600픽셀 중 4,528/4,904), 반복 재생, 포스터와 영상 구도 일치, 일시정지·재개, 기존 학습 데이터 보존을 확인했다. 합성 카메라 회귀와 기존 테마도 확인했다. 실제 설치 기기나 물리 카메라는 조작하지 않았다.
- Chrome 전체 분할 검사: 중복 없는 1,774개 통과(본 화면 340개와 다른 테스트 1,434개). 선택지 15→16을 반영한 6개를 다시 실행해 모두 통과했다. 나머지 소스/파일은 SHA-256으로 고정했다. 공식 `ai.ps1 verify --project .` 7개 및 Dune 위반 0, 기본 `npm.cmd test` 실패 0, 독립 검토에서 출시 차단 사항 0.

## 운영 확인

- 제품 커밋 `4bfead11a2f94397e0996087b78313d7efccc53b`; [GitHub Actions](https://github.com/zxcc9867/studyRoom/actions/runs/42382436784) 성공. Vercel `dpl_CA42yf7DjLo46PwjFqGw3bU3u2E4` production `READY`, [운영 주소](https://study-room-attendance.vercel.app)와 정확한 커밋 일치.
- 운영 HTML·JS·CSS·공개 자산 4개 HTTP 200, 영상 2개 Range HTTP 206, 파일 해시 4/4 일치. 익명 격리 Chrome에서 두 영상이 실제로 디코딩되고 24초 끝에서 처음으로 반복됐다. 출시 직후 5분 서버 error/fatal 집계에 항목이 없었으며 실기기·장시간 모니터링을 대신하지 않는다.
- 새 APK/EXE 없이 공통 웹 화면에서 제공된다. 공부·카메라 사용을 마친 뒤 앱을 새로고침하고, 설정 → 공부와 화면 → 배경 테마에서 선택한다.

## 이미지 편집 프롬프트

```text
Use case: precise-object-edit. Asset type: original widescreen anime-painted night-ocean backdrop for a quiet study app. Image 1 is the edit target. Remove ONLY the conspicuous Saturn-like blue sphere and its full elliptical ring in the upper-left sky. Where the ringed planet was, inpaint a seamless continuation of the immediately surrounding deep indigo natural Earth night sky, with a sparse sprinkling of very fine dim stars and no distinct celestial object. No replacement moon, no planets, no shooting stars, no orbit arcs, no visual hole or blur halo. Everything outside that small sky region should stay as close as possible to the original, particularly the diagonal lavender Milky Way, indigo hue and luminance, star pattern, quiet sea haze, rock silhouette, exact lighthouse lantern position (70.45% from left, 48.7% from top), warm light, rippling water, and amber reflection. Do not add a lighthouse beam: it is animated separately. Keep identical widescreen 16:9 framing, geometry and composition. No added objects, lettering, borders or cropping. Natural star field seen from Earth, mystical but believable; this is a localized object removal, not a redesign.
```
