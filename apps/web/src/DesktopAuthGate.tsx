import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createDesktopAuthSession, type DesktopAuthState } from './desktopBridge.mjs';
import { supabase } from './supabase';
import { getSupabaseAuthBootstrap } from './authSession.mjs';

const DesktopAuthContext = createContext<(DesktopAuthState & { signOut: () => Promise<void> }) | null>(null);
export const useDesktopAuth = () => useContext(DesktopAuthContext);

export default function DesktopAuthGate({ children }: { children: ReactNode }) {
  const bootstrap = getSupabaseAuthBootstrap(window);
  const [state, setState] = useState<DesktopAuthState>({ status: 'connecting', session: null });
  const controller = useRef<ReturnType<typeof createDesktopAuthSession> | null>(null);
  useEffect(() => {
    const auth = createDesktopAuthSession(window, supabase, setState, { assertReady: bootstrap.assertReady });
    controller.current = auth; void auth.start();
    return () => { auth.dispose(); controller.current = null; };
  }, []);
  if (state.status === 'ready' || state.status === 'signed-out') return <DesktopAuthContext.Provider value={{ ...state, signOut: () => controller.current!.signOut() }}>{children}</DesktopAuthContext.Provider>;
  const failed = bootstrap.failed || state.status === 'error';
  return <main className="login-shell"><section className="login-panel" role={failed ? 'alert' : 'status'}>
    <p className="eyebrow">study room</p><h1>{bootstrap.failed ? '앱 로그인 저장소를 확인하지 못했어요' : failed ? '앱 로그인 연결에 실패했어요' : '앱 로그인 연결 중'}</h1>
    <p className="login-copy">{bootstrap.failed ? '저장소 접근 상태를 확인한 뒤 다시 연결해 주세요. 문제가 계속되면 앱을 다시 실행해 주세요. 확인 전에는 로그인을 진행하지 않습니다.' : failed ? '인터넷 연결을 확인하고 다시 연결해 주세요.' : '같은 계정의 독서실 화면을 안전하게 준비하고 있어요.'}</p>
    {failed && <button className="primary" type="button" onClick={() => {
      try { bootstrap.retry(); }
      catch { setState({ status: 'error', session: null }); return; }
      void controller.current?.retry();
    }}>다시 연결</button>}
  </section></main>;
}
