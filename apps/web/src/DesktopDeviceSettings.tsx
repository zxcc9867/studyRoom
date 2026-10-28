import { useEffect, useState, type ReactNode } from 'react';
import { desktopRequest } from './desktopBridge.mjs';

type DesktopInfo = { platform: 'windows'; version: string; build: string; protocolVersion: number; secureStorage: boolean };
export default function DesktopDeviceSettings({ phoneStatus }: { phoneStatus: ReactNode }) {
  const [info, setInfo] = useState<DesktopInfo | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [settingsError, setSettingsError] = useState(false);
  useEffect(() => {
    let live = true; setError(false);
    void desktopRequest<DesktopInfo>(window, 'info').then(value => {
      if (value?.platform !== 'windows' || typeof value.version !== 'string' || typeof value.build !== 'string'
        || typeof value.secureStorage !== 'boolean') throw new Error('DESKTOP_INFO');
      if (live) setInfo(value);
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [revision]);
  return <>
    <section id="settings-panel-device" data-settings-panel="device" className="settings-group settings-phone" aria-labelledby="settings-phone-title"><h2 id="settings-phone-title">기기 연결</h2>{phoneStatus}
      <p>휴대폰 연결·해제와 집중 권한은 Android 앱 설정에서 관리합니다. Windows는 서버의 연결 상태를 표시합니다.</p>
      <h3>이 PC의 카메라</h3>
      <button className="secondary" type="button" onClick={() => {
        setSettingsError(false);
        void desktopRequest(window, 'openCameraSettings').catch(() => setSettingsError(true));
      }}>Windows 카메라 설정 열기</button>
      <p>Windows 개인정보 설정에서 카메라 접근을 확인하세요. 설정을 여는 것만으로 카메라 권한을 요청하거나 공부를 시작·종료하지 않습니다.</p>
      {settingsError && <p role="alert">Windows 카메라 설정을 열지 못했어요. Windows 설정에서 직접 확인해 주세요.</p>}
    </section>
    <section id="settings-panel-app" data-settings-panel="app" className="settings-group app-device-settings" aria-labelledby="settings-app-title"><h2 id="settings-app-title">Windows 앱 정보</h2>
      {info ? <dl className="settings-values"><div><dt>설치된 버전</dt><dd>{info.version} · 빌드 {info.build}</dd></div></dl> : <p role={error ? 'alert' : 'status'}>{error ? 'Windows 앱 정보를 확인하지 못했어요.' : '앱 정보를 확인하고 있어요…'}</p>}
      <button type="button" className="plain" onClick={() => setRevision(value => value + 1)}>앱 정보 다시 확인</button>
      <p>X를 누르면 트레이로 숨기고 공부와 카메라는 유지됩니다. 트레이에서 다시 열거나 종료할 수 있습니다.</p>
      {info?.secureStorage === false && <p role="alert">암호화 저장을 사용할 수 없어 로그인이 재실행 후 유지되지 않을 수 있습니다. 토큰은 평문으로 저장하지 않습니다.</p>}
      <p>Windows 네이티브 푸시 알림은 지원하지 않습니다. 이메일·Slack 알림은 기존 설정을 사용합니다.</p>
    </section>
  </>;
}
