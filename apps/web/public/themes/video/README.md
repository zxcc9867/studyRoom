# Video scenery provenance

These are public licensed decorative video files, not camera recordings. No remote video service is used at runtime.

## Quality variants — 2026-11-03

Auto selects 1080p on desktop and 720p on mobile (Android/iOS user agent or mobile client hint; iPad desktop user agent plus touch is treated as mobile). Saver selects 720p; High selects the highest supplied resolution, at most 1080p. This is device-based file selection, not adaptive bitrate streaming. A narrow desktop window is still a desktop. Only the applied eligible source is requested; editing or a paused replacement does not prefetch either file. A failed source keeps the poster and offers retry; selecting Saver can recover independently.

| Theme | 720p | 1080p |
| --- | --- | --- |
| 흐르는 구름 | existing cloud-sky.webm | cloud-sky-hd.webm |
| 해변의 파도 | ocean-waves-sd.webm | existing ocean-waves.webm |
| 도시의 밤 | existing city-night.webm | city-night-hd.webm |
| 별빛 밤하늘 | existing starry-night.webm | not supplied; confirmed source is 720p |
| 비 오는 창가 | existing rain-window.webm | not supplied; confirmed source is 720p |

The new files below are unchanged Commons VP9 transcodes of the same credited works, not upscaled copies. Their work/creator/source/license are the corresponding sections below. No new artwork or license is introduced.

- cloud-sky-hd.webm: 1920×1080, 56.404s, 15,687,378 bytes; SHA256 `a925c2edb1cf64f9a97a3de967ed64a0d6bb015d6def4548494a1e8cfcac3a0f`.
  Download: https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cd/All4sounds_-_Cloud_Time_lapse.webm/All4sounds_-_Cloud_Time_lapse.webm.1080p.vp9.webm
- city-night-hd.webm: 1920×1080, 29.108s, 11,554,890 bytes; SHA256 `543a41746e7ee7fd63d535ad7be6b0fa86cf2bc92e35ae7a644bec9541cbf3b8`.
  Download: https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cd/City_at_night.webm/City_at_night.webm.1080p.vp9.webm
- ocean-waves-sd.webm: 1280×720, 10.524s, 2,342,199 bytes; SHA256 `48686f58e1b418b89741edab1c4839a08c09f966ef46467365f05b2b8de07a0c`.
  Download: https://upload.wikimedia.org/wikipedia/commons/transcoded/3/36/Naturschutzgebiet_Riedensee_lub_2025-02-14_mov01.webm/Naturschutzgebiet_Riedensee_lub_2025-02-14_mov01.webm.720p.vp9.webm

All variants retain the same poster, credits, mute/loop/speed presentation and camera separation. Original audio, if any, is still present but playback is muted. The three added files total 29,584,467 bytes; an individual user does not download all variants when opening the editor.

## 흐르는 구름 / cloud-sky

- Work: All4sounds - Cloud Time lapse; creator: All4sounds.
- Source: https://commons.wikimedia.org/wiki/File:All4sounds_-_Cloud_Time_lapse.webm
- License: CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/
- Local file: cloud-sky.webm, Wikimedia 720p VP9 transcode, 1280×720, 56.404 seconds, 5,252,372 bytes.
- Download: https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cd/All4sounds_-_Cloud_Time_lapse.webm/All4sounds_-_Cloud_Time_lapse.webm.720p.vp9.webm
- SHA256: 48da58030d27dc191db178e941299df71386ef996d8ec833232f790293301926

## 해변의 파도 / ocean-waves

- Work: Naturschutzgebiet Riedensee lub 2025-02-14 mov01; creator: Lukas Beck (User:L. Beck), own work, 2025-02-14.
- Source: https://commons.wikimedia.org/wiki/File:Naturschutzgebiet_Riedensee_lub_2025-02-14_mov01.webm
- License: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/
- Local file: ocean-waves.webm, Wikimedia 1080p VP9 transcode, 1920×1080, 10.524 seconds, 4,555,474 bytes.
- Download: https://upload.wikimedia.org/wikipedia/commons/transcoded/3/36/Naturschutzgebiet_Riedensee_lub_2025-02-14_mov01.webm/Naturschutzgebiet_Riedensee_lub_2025-02-14_mov01.webm.1080p.vp9.webm
- SHA256: 602027aa206be043a3161e88919db628b47472ee3b5ae39f666e83b11cec3ec3
- Primary license evidence: Commons parse API wikitext, `source={{own}}`, `author=[[User:L. Beck|Lukas Beck]]`, `{{self|cc-by-4.0}}`; read 2026-11-02.

## 별빛 밤하늘 / starry-night

- Work: Milky Way in Glen Canyon National Recreation Area; creator: Mike Wetzel, 2015-06-12.
- Source: https://commons.wikimedia.org/wiki/File:Milky_Way_in_Glen_Canyon_National_Recreation_Area.webm
- Original source: https://vimeo.com/130574481
- License: CC BY 3.0, https://creativecommons.org/licenses/by/3.0/ ; original-source license reviewed by INeverCry on 2016-03-24.
- Local file: starry-night.webm, Wikimedia 720p VP9 transcode, 1280×720, 21.4 seconds, 3,953,858 bytes.
- Download: https://upload.wikimedia.org/wikipedia/commons/transcoded/0/0b/Milky_Way_in_Glen_Canyon_National_Recreation_Area.webm/Milky_Way_in_Glen_Canyon_National_Recreation_Area.webm.720p.vp9.webm
- SHA256: f9816b57f54a471250ff2a77af631f5e062319b6e8e61ad4a559a1a768fe5ba3

## 비 오는 창가 / rain-window

- Work: Raindrops against the window in the night city, Las Palmas; creator: slavikfi (Vjatseslav Robtsenkov), 2016-11-05.
- Source: https://commons.wikimedia.org/wiki/File:Raindrops_against_the_window_in_the_night_city,_Las_Palmas.webm
- Original source: https://pixabay.com/en/videos/city-night-water-black-las-palmas-1501/
- License: CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/ ; original historical CC0 release and review are recorded on the Commons source page. This does not assert that current Pixabay-wide licensing is CC0.
- Local file: rain-window.webm, unchanged Commons original VP9, 1280×720, 18.2 seconds, 6,490,046 bytes.
- Download: https://upload.wikimedia.org/wikipedia/commons/9/95/Raindrops_against_the_window_in_the_night_city%2C_Las_Palmas.webm
- SHA256: e96a46f335f599742b1699714f3ab0465bf60d57b8505d97e15ed47153fac2b8
- Visual note: distant incidental HOTEL/AC roof signage remains in this real city footage; no endorsement is implied. No privacy-redaction or seamless-loop claim.

## 도시의 밤 / city-night

- Work: City at night, aerial San Francisco; creator: Editor (https://www.youtube.com/user/Editor), 2011-05-28.
- Source: https://commons.wikimedia.org/wiki/File:City_at_night.webm
- Original source: https://www.youtube.com/watch?v=ncRts4zrQSs
- License: CC BY 3.0, https://creativecommons.org/licenses/by/3.0/ ; original-source license reviewed by McZusatz on 2013-02-03.
- Local file: city-night.webm, Wikimedia 720p VP9/Opus transcode, 1280×720, 29.108 seconds, 4,613,541 bytes.
- Download: https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cd/City_at_night.webm/City_at_night.webm.720p.vp9.webm
- SHA256: 771b7aac308e4ca247418752a5d44f43d75ed0240a6c8d696b916a8f8af3208f
- Visual note: blue/orange bokeh changes focus into the city and returns to bokeh; no custom seamless-loop editing is claimed.

## Presentation changes and verification

The video bytes are unchanged Wikimedia originals/transcodes as identified above. Posters and thumbnails are extracted WebP frames. The application crops to fill the viewport, repeats playback, mutes sound, and uses 0.75× or 1× playback speed. Original audio tracks, if present, have not been removed. Attribution, source/license links and changes are also available under Settings → 배경 테마 → 영상 출처.

Loops restart at the beginning; seamless loop editing is not claimed. Frames and playback were inspected in isolated Chrome without an account, microphone or camera. The initial dark night-sky/subtle lake candidates were not shipped. No generated posters or videos contain user learning records.
