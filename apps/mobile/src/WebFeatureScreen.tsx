import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import WebView from "react-native-webview";
import * as Device from "expo-device";

import {
  buildTicketInjection,
  isTrustedWebUrl,
  parseNativeBridgeMessage,
  requestMobileWebTicket,
  studyWebOrigin,
} from "./mobileWebBridge";
import { supabase } from "./supabase";

type Props = {
  sessionUserId: string;
  onStudyStateChanged: () => void;
  onNativeSignOut: () => void;
  onFallback: () => void;
};

export function WebFeatureScreen({ sessionUserId, onStudyStateChanged, onNativeSignOut, onFallback }: Props) {
  const [failed, setFailed] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const webViewRef = useRef<WebView | null>(null);
  const currentUrlRef = useRef(`${studyWebOrigin}/#today`);
  const pendingRequestIdRef = useRef<string | null>(null);
  const issuedRequestIdRef = useRef<string | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  function allowNavigation(request: { url: string }) {
    if (request.url === "about:blank") return true;
    try {
      const destination = new URL(request.url);
      if (isTrustedWebUrl(request.url)) return true;
      if (destination.protocol === "https:") {
        void Linking.openURL(request.url).catch(() => setFailed(true));
      }
    } catch {
      // Unknown or malformed destinations never load inside the signed-in page.
    }
    return false;
  }

  async function receiveMessage(event: { nativeEvent: { data: string; url: string } }) {
    if (!isTrustedWebUrl(event.nativeEvent.url)) return;
    const message = parseNativeBridgeMessage(event.nativeEvent.data);
    if (!message) return;

    if (message.type === "STUDY_WEB_READY") {
      if (pendingRequestIdRef.current === message.requestId || issuedRequestIdRef.current === message.requestId) return;
      pendingRequestIdRef.current = message.requestId;
      setConnectionError("");
      try {
        const ticket = await requestMobileWebTicket(supabase, sessionUserId);
        if (!activeRef.current || pendingRequestIdRef.current !== message.requestId) return;
        if (!isTrustedWebUrl(currentUrlRef.current) || !webViewRef.current) throw new Error("Web page changed");
        issuedRequestIdRef.current = message.requestId;
        webViewRef.current.injectJavaScript(buildTicketInjection({
          requestId: message.requestId,
          userId: ticket.userId,
          tokenHash: ticket.tokenHash,
        }));
      } catch {
        if (activeRef.current && pendingRequestIdRef.current === message.requestId) {
          setConnectionError("앱 로그인 연결에 실패했어요. 웹 화면의 '다시 연결'을 눌러 주세요.");
        }
      } finally {
        if (pendingRequestIdRef.current === message.requestId) pendingRequestIdRef.current = null;
      }
      return;
    }

    if (message.type === "STUDY_WEB_AUTH_OK") {
      if (message.userId === sessionUserId && message.requestId === issuedRequestIdRef.current) {
        setConnectionError("");
        onStudyStateChanged();
      }
      return;
    }
    if (message.type === "STUDY_WEB_AUTH_FAILED") {
      if (message.requestId === issuedRequestIdRef.current) setConnectionError("로그인 연결을 다시 시도해 주세요.");
      return;
    }
    if (message.type === "STUDY_WEB_STUDY_STATE_CHANGED") onStudyStateChanged();
    if (message.type === "STUDY_WEB_SIGN_OUT") onNativeSignOut();
  }

  function retry() {
    pendingRequestIdRef.current = null;
    issuedRequestIdRef.current = null;
    currentUrlRef.current = `${studyWebOrigin}/#today`;
    setConnectionError("");
    setFailed(false);
    setRetryKey((current) => current + 1);
  }

  return (
    <View style={styles.screen}>
      {connectionError ? <Text style={styles.errorBanner} accessibilityRole="alert">{connectionError}</Text> : null}
      {failed ? (
        <View style={styles.feedback}>
          <Text style={styles.errorTitle}>독서실 화면을 열지 못했어요</Text>
          <Text style={styles.errorCopy}>인터넷 연결을 확인한 뒤 다시 시도해 주세요. 앱 로그인은 유지됩니다.</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.retryButton}
            onPress={retry}
          >
            <Text style={styles.retryText}>다시 열기</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.fallbackButton} onPress={onFallback}>
            <Text style={styles.fallbackText}>네이티브 공부방으로 계속하기</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          key={retryKey}
          ref={webViewRef}
          source={{ uri: `${studyWebOrigin}/#today` }}
          originWhitelist={[studyWebOrigin]}
          onShouldStartLoadWithRequest={allowNavigation}
          onNavigationStateChange={(state) => { currentUrlRef.current = state.url; }}
          onMessage={(event) => { void receiveMessage(event); }}
          onError={() => setFailed(true)}
          startInLoadingState
          renderLoading={() => <ActivityIndicator style={styles.loading} color="#2f6b52" />}
          setSupportMultipleWindows={false}
          webviewDebuggingEnabled={!Device.isDevice}
          style={styles.webView}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff9df" },
  errorBanner: { backgroundColor: "#fff0d0", color: "#713b25", fontSize: 13, lineHeight: 19, paddingHorizontal: 14, paddingVertical: 8 },
  webView: { flex: 1, backgroundColor: "#fff9df" },
  loading: { flex: 1 },
  feedback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  errorTitle: { color: "#2f6b52", fontSize: 20, fontWeight: "800" },
  errorCopy: { color: "#5a513d", fontSize: 15, textAlign: "center" },
  retryButton: { minHeight: 48, justifyContent: "center", borderRadius: 10, backgroundColor: "#2f6b52", paddingHorizontal: 20 },
  retryText: { color: "#fff9df", fontWeight: "800" },
  fallbackButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  fallbackText: { color: "#2f6b52", fontWeight: "700" },
});
