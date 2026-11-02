# 영상형 라이브 배경·종류 표시·미니 진입 제거

- 루트: C:/jini-dev/worktrees/study-dashboard-clarity, 브랜치 fix/study-dashboard-clarity, 시작 HEAD c7c4e47.
- 사용자 선택: 실제 영상형 라이브. 기존6개 이미지/장식 효과와 저장값은 유지한다. 학습/카메라/Auth/서버/DB/native API 정책 변경 없음.
- 추가 자산: 흐르는 구름(CC0)·해변의 파도(CC BY4.0), 제작자·출처·라이선스·변경사항은 앱의 영상 출처와 public/themes/video/README.md에 기록한다. 원본 영상 바이트 무변경, 무음·반복·화면 채움·0.75/1배속, 추출 포스터/썸네일. seamless loop는 보장하지 않는다.
- 선택 전 카드에 영상 라이브/이미지 효과/정적 이미지 표시. 초안 선택으로 video 다운로드 없음. 적용 후 live/활성/OS motion 조건 충족 시에만 src 부착. 실제 play 성공/playing과 loading/error를 분리한다. 실패는 포스터+명시적 재시도. blur/hidden/OS reduced/사용자 정지는 장식만 중지한다.
- 카메라 DOM보다 뒤에 별도 장식 video를 마운트한다. 카메라 ref/srcObject/스트림·학습 세션 소유권 불변. 미니 진입 UI 제거, 기존 native 정상 크기 복원/실패복구 호환은 유지한다.

## 검증 진행

- RED: 실제 mounted 3개(종류/영상/미니 제거), controller 2개 실패 확인. output/video-live-red.log, output/video-live-controller-red.log.
- 초기 GREEN: controller10/10, build0, Chrome집중8/8. output/video-live-focused.log.
- 추가 Chrome 영상6/6 통과: 종류 사전표시/초안 무다운로드·실제재생·미니 제거/정상복원·초기 reduced 무다운로드/blur/명시pause·오류포스터/명시retry·실제paint 픽셀 변화 및 동일 카메라 node/MediaStream/track live/요청수/세션 보존. output/video-live-acceptance.log.
- 전체 설정수용 첫38개 중36통과/2실패: 375px 두 옵션 boundingBox를 별도 RPC로 읽는 동안 자동 스크롤이 이동했다. 실패 screenshot에서는 정렬 정상. 두 옵션/legend를 같은프레임에서 원자적으로 측정하도록 검사만 보정하고 focused2/2 재통과. 실패를 최종통과로 합산하지 않는다. output/video-live-alignment-recheck.log.
- 공식7/Dune exit0, independent shared-reviewer C0/I0/M0(별도controller10/10·diff·자산해시대조). 리뷰어는 파도 외부페이지 접속실패로 독립라이선스 대조 제한이 있으나 메인에선 Commons 공개API 원문을 별도 읽어 확인했다. output/video-live-official.log.
- 최종 전체 Chrome1611/1611, 실패/생략/취소0, 1,276,438ms, exit0. 제품/테스트/자산17개 해시를 전후 대조해 동일함을 확인했다. output/video-live-full-chrome.log. 공식7/Dune exit0·diffcheck 통과. 출시는 다음 단계다.
- 검사는 합성 표시/합성 서버/가짜 카메라로 수행한다. 실제 계정·학습 기록·현재 설치 앱 설정은 쓰거나 새로고침하지 않는다. Android 실기기/에뮬레이터·설치 Windows GPU 수용은 별도이며 브라우저 결과로 대체 완료하지 않는다.

## 매체 검사 주의

- 최초 후보의 paused seek→canvas는 decoder가 갱신한 프레임을 기다리지 않아 어둡거나 오래된 프레임을 반환했다. 해당 결과만으로 원본 영상 불량을 확정하지 않는다. 최종 소스는 직접 재생과 연속 프레임으로 확인하고 실제 앱 fixture의 painted viewport 픽셀 변화도 검증한다.
- 도구/SDK/계정 추가 없음. public licensed WebM을 같은 Vercel 배포에서 제공한다. 카메라 영상을 공유/전송하지 않는다.
