import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  beginEmbeddedAuthentication,
  consumeEmbeddedTicket,
  postEmbeddedMessage,
} from "./embeddedAuth.mjs";
import { supabase } from "./supabase";

type GateStatus = "connecting" | "ready" | "error";

export default function EmbeddedAuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus>("connecting");
  const requestIdRef = useRef<string | null>(null);
  const verifiedRef = useRef(false);
  const exchangingRef = useRef(false);
  const retryRef = useRef<() => void>(() => {});

  useEffect(() => {
    let mounted = true;
    let timeout: number | undefined;

    const begin = () => {
      if (!mounted) return;
      verifiedRef.current = false;
      exchangingRef.current = false;
      setStatus("connecting");
      window.clearTimeout(timeout);
      const requestId = crypto.randomUUID();
      requestIdRef.current = requestId;
      timeout = window.setTimeout(() => {
        if (mounted && requestIdRef.current === requestId && !verifiedRef.current) {
          requestIdRef.current = null;
          setStatus("error");
        }
      }, 15_000);
      void beginEmbeddedAuthentication(supabase, window, requestId).catch(() => {
        if (mounted && requestIdRef.current === requestId) {
          requestIdRef.current = null;
          window.clearTimeout(timeout);
          setStatus("error");
        }
      });
    };
    retryRef.current = begin;

    const receive = (event: Event) => {
      const ticket = (event as CustomEvent<unknown>).detail;
      if (!ticket || typeof ticket !== "object" || !("requestId" in ticket)) return;
      if (ticket.requestId !== requestIdRef.current || exchangingRef.current) return;
      const requestId = requestIdRef.current;
      if (!requestId) return;
      exchangingRef.current = true;
      void consumeEmbeddedTicket(supabase, ticket, requestId).then((session) => {
        if (!mounted || requestIdRef.current !== requestId) return;
        window.clearTimeout(timeout);
        verifiedRef.current = true;
        requestIdRef.current = null;
        setStatus("ready");
        postEmbeddedMessage(window, { type: "STUDY_WEB_AUTH_OK", requestId, userId: session.user.id });
      }).catch(() => {
        if (!mounted || requestIdRef.current !== requestId) return;
        window.clearTimeout(timeout);
        requestIdRef.current = null;
        setStatus("error");
        postEmbeddedMessage(window, { type: "STUDY_WEB_AUTH_FAILED", requestId });
      }).finally(() => { exchangingRef.current = false; });
    };

    window.addEventListener("study-room-native-message", receive);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && verifiedRef.current && mounted) begin();
    });
    begin();
    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      window.removeEventListener("study-room-native-message", receive);
      data.subscription.unsubscribe();
    };
  }, []);

  if (status === "ready") return <>{children}</>;

  return (
    <main className="login-shell">
      <section className="login-panel" role={status === "error" ? "alert" : "status"}>
        <p className="eyebrow">study room</p>
        <h1>{status === "error" ? "앱 로그인 연결에 실패했어요" : "앱 로그인 연결 중"}</h1>
        <p className="login-copy">
          {status === "error"
            ? "인터넷 연결을 확인한 뒤 다시 시도해 주세요. 별도 로그인은 필요하지 않습니다."
            : "같은 계정의 독서실 화면을 안전하게 준비하고 있어요."}
        </p>
        {status === "error" && (
          <button className="primary" type="button" onClick={() => retryRef.current()}>
            다시 연결
          </button>
        )}
      </section>
    </main>
  );
}
