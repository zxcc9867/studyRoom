# 집중 설정 복귀 카메라 복구 — 2026-10-04

## 원인

- Android16 실제 WebView에서 방해금지 접근 설정 진입 시 문서는 hidden, 영상 track은 ended가 된다. 앱으로 돌아와 visible이 되어도 기존 track은 살아나지 않는다.
- 기존 웹은 track-ended에서 오류만 표시했으며 새 스트림을 받지 않았다. 브라우저 Permissions API의 prompt는 Android OS CAMERA 허용 상태와도 달랐다.
- 재시작이 재시도 예산을 초기화했고 오래된 비동기 결과의 취소·정리 범위도 충분히 제한되지 않았다.

## 수정

- 복귀·focus·기존 health 검사에서 종료 트랙을 한 번 재획득한다. 실제 정상 프레임을 확인해야 재시도 예산이 초기화된다.
- 같은 사용자/세션, 카메라 켜기 의도, foreground, 서버 active·비휴식·유효 lease를 복구 전후에 확인한다.
- 휴식·종료·직접 끄기·계정 변경·다시 배경 이동·언마운트·서버 상태 변경 시 늦게 도착한 스트림과 검출기를 폐기한다. 이전 요청은 새 수동 카메라를 끄지 않는다.
- 네이티브 자동 CHECK는 권한 조회만 한다. WebView Java callback도 미허용·중간 권한 철회 시 거절하고 권한창은 직접 누른 카메라 버튼에서만 연다.
- 구 APK는 자동 CHECK를 지원하지 않으므로 최신 APK/직접 다시 켜기 안내를 한다. 공부·출석·제외시간·회복루틴·DND 규칙은 변경하지 않는다.

## 변경 파일

| 범위 | 파일 | 이유 |
|---|---|---|
| 웹 | apps/web/src/main.tsx | 안전한 복귀 재획득과 비동기 취소·서버 상태 확인 |
| 웹 | apps/web/src/cameraFrameRecovery.mjs | ended/muted 복구 및 유한 재시도 |
| 웹 | apps/web/src/nativeCameraPermission.mjs, nativeCameraPermission.d.mts | 비대화형 권한 CHECK 및 구 APK fail-closed |
| 앱 | apps/mobile/src/WebFeatureScreen.tsx, mobileWebBridge.ts | CHECK 처리·capability·메시지 검증 |
| 앱 | patches/react-native-webview+13.13.5.patch | WebView가 자동 OS 권한창을 열지 않도록 제한 |
| 테스트 | apps/web/test/actualStudyMounted.test.mjs, cameraFrameRecovery.test.mjs, nativeCameraPermission.test.mjs | 실제 main 및 재시도·권한·취소 회귀 |
| 테스트 | scripts/mobile-camera-permission.test.mjs, mobile-web-auth.test.mjs, mobile-web-features.test.mjs | 실제 Java callback·네이티브 브리지 계약 |
| 문서 | memory-bank/active-context.md, progress.md, trouble-shooting.md, implementation-plan.md, prd-camera-presence.md | 원인·계약·검증·배포 기록 |

## 검증 및 배포

- 단위/계약: npm test 852 통과, 선택 브라우저 75 생략, 실패0. 브라우저는 별도 실행한다.
- Edge: 검사 및21개 테스트 통과. 웹 TypeScript/Vite 빌드·모바일 호환성/TypeScript·README24개 이미지 검사 통과.
- EAS archive1252개 파일에 민감 환경·서명·APK 파일0개. 수정 앱 소스/패치 포함, output 제외.
- 실제 Chromium 브라우저75개(마운트68·언어/반응형2·브리핑5) 통과, 실패/생략0. 시간 고정 테스트 경합 수정 후 전체 재실행했다.
- 읽기 전용 리뷰에서 취소된 이전 요청·언마운트·대기 중 서버 변경·네이티브 권한 경합을 보완했고 남은 Critical/Important 지적0개다.
- 웹 운영 배포·새 APK·Android16 설치 검증은 진행 중이며 아래에 확정 결과를 추가한다.

## 검증 경계

- 브라우저 회귀는 실제 main을 마운트하고 서버 transport·상반신 검출기 경계만 예시화한다.
- Android16 검증도 실제 WebView·권한 브리지·카메라 MediaStream을 사용하되 공부 데이터는 메모리 fixture로 격리한다. 사용자 공부/회복 기록을 생성하지 않는다.
- 실제 휴대폰의 제조사별 카메라/방해금지·상반신 인식까지 검증했다고 주장하지 않는다. 새 native CHECK와 Java 정책은 새 APK 설치가 필요하다.
