# 감성 영상 테마 3종 확장

- 루트 C:/jini-dev/worktrees/study-dashboard-clarity, 브랜치 fix/study-dashboard-clarity, 시작 HEAD7048829. 사용자 승인: 별빛 밤하늘·비 오는 창가·도시의 밤3종 추가, 기존 테마/설정/학습 기록 보존.
- 범위: atmosphere catalog/types와 index.html prepaint whitelist/포스터, 영상·포스터·썸네일·출처 문서, 관련 테스트. 재생기/React UI/CSS/native/API/서버/DB/Auth/학습·카메라 정책은 변경하지 않는다.
- 자산 원문·제작자·라이선스·다운로드/크기/해시는 public/themes/video/README.md 참조. 새3개 원본/공개 transcode byte는 무변경, 무음·0.75/1배속·object-fit·반복·추출 포스터 변경 표시. seamless loop를 보장하지 않는다.
- 초기 Night sky time lapse(106초, 새벽에 흰색)·John Fowler Star Timelapse(첫장면 밝음)·Chicago(주기적 검정 fade) 후보는 제외했다. 최종 별빛은 Mike Wetzel 은하수21.4초, 비창가는 slavikfi18.2초, 도시는 Editor29.108초. 세 영상 early/mid/end를 실제재생→시간진행→정지→video element screenshot으로 확인했다. 도시의 초반/끝은 의도된 보케이며 중간에는 야경에 초점이 맞는다. 비창가에는 먼 HOTEL/AC 옥상 간판이 부수적으로 남아 있음을 출처 문서에 기록했다.
- 미디어 계정/유료 생성/새 패키지/ffmpeg 설치 없음. 기존 Chrome/Playwright로 격리된 공개자산만 검사하며 실제 계정/학습 기록/앱 설정을 쓰지 않는다. 브라우저 합성 검사는 설치 Windows/Android/GPU/배터리 수용 완료와 구분한다.

## 검증 진행

- TDD: 새3종 저장 복원·포스터·일시 상태/학습키 보존·prepaint4개 expected unknown→charcoal 실패를 확인했다. output/emotional-video-red.log. catalog/types/prepaint 최소 추가 후 controller14/14 GREEN.
- 첫 mounted6개는 카드를 찾는 has locator에 이미 editor로 scoped된 radio를 다시 넣어 카드 내부에서 group을 찾는 fixture 오류로 실패했다. 기존 패턴처럼 page radio를 카드 내부 상대조회하도록 보정했으며 제품 수정으로 우회하지 않았다. output/emotional-video-focused.log. 최종6/6 통과, 실패/생략/취소0. output/emotional-video-focused-final.log.
- 실제320×180 프레임의1.5초 이상 간격 RGB차이>8 픽셀수: 별빛20,939/57,600, 비창가4,613~4,720/57,600, 도시31,020/57,600. currentTime만으로 움직임을 주장하지 않는다. 375/1440에서 종류 사전표시·초안 무다운로드·현재 영상src·무음/loop/inline/srcObjectnull·일시정지/재생·풍경 진입/복귀·선택 저장·동일sessions/todos/camera요청수 보존 확인.
- 공식7/Dune exit0. output/emotional-video-official.log. 독립 shared-reviewer C0/I0/M0·직접 단위14/14·자산크기/해시/원본3개 라이선스·프레임시트/간판/보케/루프 설명 대조 통과.
- 최종 전체Chrome1621/1621, 실패/생략/취소0, 1,291,155ms, exit0. output/emotional-video-full-chrome.log. 제품/테스트/모든 영상자산21개 고정 해시를 전후 대조해 동일, diffcheck 통과. 운영 출시는 다음 단계다.
