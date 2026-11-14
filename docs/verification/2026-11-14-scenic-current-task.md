# 풍경 화면에 현재 공부만 표시

- 제품 `b8bbf6daed818bc18e46430e47e4eba812b9552d` · `fix/study-dashboard-clarity`. 이전 회고의 시작점을 풍경 제목에서 제거하고 실제 활성 세션의 현재 할 일만 사용한다.
- 시작 준비 화면에는 중립 제목과 ‘공부 시작’을 표시한다. 회복·카메라 안내를 기존 순서대로 거쳐 새 할 일을 고르며 이전 시작점을 자동 선택하지 않는다.
- 회고와 대시보드의 명시적 이어가기, 서버 기록, 네이티브 파일은 변경하지 않았다.
- 기존 코드에서 합성 Chrome으로 세션 종료 후 이전 회고 제목 재등장을 확인했다. 수정 후 18/18 Chrome 검사에서 일반/회복 후 선택·선택한 할 일 제목·기존 기록 보존과 시작/재개 흐름을 확인했다. 공식 7개 명령·Dune 위반 0·독립 검토·diff 검사 통과.
- [GitHub Actions 43599321054](https://github.com/zxcc9867/studyRoom/actions/runs/43599321054) 성공. Vercel `dpl_2prYTVBV5sNmGRDsDkMnVAwGSAuU` 운영 READY, 정확한 제품 SHA와 운영 주소, HTML·`index-BGnWKGJF.js` HTTP 200 및 새 동작의 번들 마커를 확인했다. 실제 사용자 기록이나 카메라를 조작하지 않았다.
