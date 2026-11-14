# 첫 공부 리포트 및 Windows 로그인·카메라 클릭 개선

- 앱 로드가 아니라 새 세션의 명시적 시작에만 지난주·지난달 요약을 표시한다. 두 기간이 모두 해당하면 한 모달, ‘바로 공부 시작’은 기존 카메라·할 일·회복 확인을 유지한다. 데이터 오류·로딩·빈 기간은 선택적 요약만 생략한다. 학습 기록·DB·출석 정책은 변경하지 않았다.
- Chrome 합성 16/16: 375/1440px, 명시적 시작, 두 기간 한 모달, Escape, 재시작 후 반복 방지, 기존 시작·재개·카메라·회복과 풍경 경로. 날짜 단위 검증에 JST 새벽 4시와 전체 지난 기간 합계 포함.
- Windows 0.1.11: 선택한 Google 직접 이동을 위해 중간 안내를 제거하고 nonce/PKCE 교환 및 동일 앱 창 복귀를 유지한다. 완료 탭은 Chrome 정책에 따라 남을 수 있다. 카메라 승인 재사용은 같은 인증 세대·문서·프레임으로 제한한다.
- 별도 Chrome 11/11과 Electron 집중 검증 2/2: 합성 제공자, 기존 탭 보존, native 복귀, trusted top frame 및 영상 권한 검증. 실계정·물리 카메라는 시험하지 않았다.
- 최종 공식 검증 7/7 및 Dune 위반 0. 독립 검토의 자료 갱신·시작 팝업 경합 지적을 수정했으며 재검토에서 Critical/Important 없음.
- Windows x64 NSIS 빌드 완료, 제품 0.1.11, 로컬 개인용 서명 없음. SHA-256 `71ef0a9f28a5c84ef4a8d76ce985b9fb9eb12123f5d1ebc942fb9cd341f9871c`. 사용자 승인·정상 종료 후 기존 경로에 무삭제 덮어설치 exit 0. 설치 버전 0.1.11.0 및 ASAR 일치, 재실행 전 암호화 로그인 파일 1개 바이트 동일, 이후 앱 창 응답 확인. 실계정 재인증·물리 카메라는 실행하지 않았다.
- 제품 커밋 `bfd42108495ab6a347b9c248ede0e38cec31147f`의 [GitHub Actions 43606748895](https://github.com/zxcc9867/studyRoom/actions/runs/43606748895) 성공. Vercel `dpl_u8XJhdhB3PqMHibJ3eRweN1ogunC` production READY·정확 SHA·공식 alias. HTML·JS·CSS 200 및 요약·스타일 마커 확인, 직후 10분 범위 Vercel runtime errors 없음. DB·Android 설치본·main은 변경하지 않았다.
