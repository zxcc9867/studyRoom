import { useEffect, useState, type ReactNode } from "react";
import { getNativeSettingsInfo, openNativeSettings, type NativeSettingsResult, type NativeSettingsTarget } from "./nativeAppSettings.mjs";

const permissionLabels = { granted: "허용", denied: "미허용", unsupported: "지원 안 함", unknown: "확인 필요" };
const updaterLabels = { idle: "아직 확인하지 않음", checking: "확인 중", latest: "최신 버전", available: "업데이트 가능", downloading: "다운로드 중", verifying: "파일 확인 중", ready: "설치 준비 완료", cancelled: "다운로드 취소됨", failed: "업데이트 확인 실패", permission_required: "설치 권한 확인 필요", install_pending: "설치 결과 확인 중", installed: "설치 완료" };

export function AppInstallGuidance() {
  return <div className="app-install-guidance">
    <p>웹 화면은 서비스 업데이트를 다시 불러오면 반영됩니다. Android 앱의 기기 기능은 새 APK를 설치해야 반영됩니다.</p>
    <a href="/download/android" target="_blank" rel="noreferrer">Android 설치 안내</a>
    <p>카메라·알림·방해금지 권한은 Android 앱의 설정에서 확인할 수 있습니다. 안내를 여는 것만으로 권한을 요청하지 않습니다.</p>
  </div>;
}

export default function AppDeviceSettings({ phoneStatus }: { phoneStatus: ReactNode }) {
  const [info, setInfo] = useState<NativeSettingsResult | { status: "checking" }>({ status: "checking" });
  const [revision, setRevision] = useState(0);
  const [openError, setOpenError] = useState<NativeSettingsTarget | null>(null);
  useEffect(() => {
    let cancelled = false;
    setInfo({ status: "checking" });
    void getNativeSettingsInfo(window).then(result => { if (!cancelled) setInfo(result); });
    return () => { cancelled = true; };
  }, [revision]);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  function open(target: NativeSettingsTarget) {
    setOpenError(openNativeSettings(window, target) ? null : target);
  }
  const snapshot = info.status === "ready" ? info.snapshot : null;
  const embedded = typeof (window as Window & { ReactNativeWebView?: { postMessage?: unknown } }).ReactNativeWebView?.postMessage === "function";
  return <>
    <section className="settings-group settings-phone" aria-labelledby="settings-phone-title">
      <h2 id="settings-phone-title">휴대폰</h2>
      {phoneStatus}
      {snapshot ? <>
        <dl className="settings-values">
          <div><dt>카메라 권한</dt><dd>{permissionLabels[snapshot.permissions.camera]}</dd></div>
          <div><dt>알림 권한</dt><dd>{permissionLabels[snapshot.permissions.notifications]}</dd></div>
          <div><dt>집중 권한</dt><dd>{permissionLabels[snapshot.permissions.focus]}</dd></div>
        </dl>
        <div className="settings-actions"><button className="secondary" type="button" onClick={() => open("focus")}>휴대폰 연결 설정 열기</button><button className="secondary" type="button" onClick={() => open("permissions")}>앱 권한 설정 열기</button></div>
        <p>연결·해제와 권한 변경은 앱 설정창에서 직접 선택합니다.</p>
      </> : <p>웹에서는 서버의 연결 상태만 확인합니다. 실제 연결·해제와 권한 변경은 Android 앱에서 진행해 주세요.</p>}
      {openError && openError !== "update" && <p role="alert">앱 설정창을 열지 못했어요. 앱을 다시 열고 확인해 주세요.</p>}
    </section>
    <section className="settings-group app-device-settings" aria-labelledby="settings-app-title">
      <h2 id="settings-app-title">앱 정보</h2>
      {info.status === "checking" && <p role="status">앱 정보를 확인하고 있어요…</p>}
      {snapshot ? <>
        <dl className="settings-values"><div><dt>설치된 버전</dt><dd>{snapshot.versionName && snapshot.versionCode ? `${snapshot.versionName} · 빌드 ${snapshot.versionCode}` : "앱에서 버전을 확인하지 못했어요"}</dd></div><div><dt>업데이트 상태</dt><dd>{updaterLabels[snapshot.updaterStatus]}</dd></div></dl>
        <div className="settings-actions"><button type="button" className="secondary" onClick={() => open("update")}>앱 업데이트 열기</button><button type="button" className="plain" onClick={() => setRevision(value => value + 1)}>앱 정보 다시 확인</button></div>
        <p>다운로드·설치는 앱 업데이트 창에서 선택합니다. 공부 중에는 설치를 미룹니다.</p>
      </> : info.status !== "checking" && <>
        {info.status === "failure" ? <><p role="alert">앱 정보를 확인하지 못했어요. 앱을 다시 열거나 설치 안내를 확인해 주세요.</p><button type="button" className="secondary" onClick={() => setRevision(value => value + 1)}>앱 정보 다시 확인</button></> : embedded && <p>이 앱은 새 설정 기능을 지원하지 않습니다. 설치 안내에서 게시된 앱을 확인해 주세요.</p>}
        <AppInstallGuidance />
      </>}
      {openError === "update" && <p role="alert">앱 설정창을 열지 못했어요. 앱을 다시 열고 확인해 주세요.</p>}
    </section>
  </>;
}
