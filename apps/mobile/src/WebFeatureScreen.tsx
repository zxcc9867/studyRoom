import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import WebView from "react-native-webview";
import * as Device from "expo-device";

import {
  buildTicketInjection,
  buildCameraPermissionInjection,
  isTrustedWebUrl,
  parseNativeBridgeMessage,
  requestMobileWebTicket,
  studyWebOrigin,
} from "./mobileWebBridge";
import { supabase } from "./supabase";
import { prepareCameraPermission } from "./cameraPermission";

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
  const cameraPermissionBusyRef = useRef(false);

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

    if (message.type === "STUDY_WEB_CAMERA_PERMISSION") {
      if (cameraPermissionBusyRef.current) return;
      cameraPermissionBusyRef.current = true;
      try {
        const status = Platform.OS !== "android" ? "unavailable" : await prepareCameraPermission({
          check: () => PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA),
          explain: () => new Promise<boolean>((resolve) => Alert.alert(
            "카메라를 켤까요?",
            "공부 중 자리 비움을 확인하기 위해 카메라 권한이 필요합니다. 영상은 기기 안에서만 처리하며 서버로 보내지 않습니다. 마이크는 사용하지 않습니다.",
            [{ text: "나중에", style: "cancel", onPress: () => resolve(false) },
              { text: "권한 요청", onPress: () => resolve(true) }],
            { cancelable: true, onDismiss: () => resolve(false) },
          )),
          request: () => PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA),
        });
        if (activeRef.current && isTrustedWebUrl(currentUrlRef.current)) {
          webViewRef.current?.injectJavaScript(buildCameraPermissionInjection(message.requestId, status));
        }
      } catch {
        if (activeRef.current && isTrustedWebUrl(currentUrlRef.current)) {
          webViewRef.current?.injectJavaScript(buildCameraPermissionInjection(message.requestId, "denied"));
        }
      } finally { cameraPermissionBusyRef.current = false; }
      return;
    }
    if (message.type === "STUDY_WEB_OPEN_APP_SETTINGS") {
      // Only the user's settings button in the trusted top-level study page can request this action.
      await Linking.openSettings().catch(() => Alert.alert("설정 열기 실패", "휴대폰 설정 → 앱 → 독서실 → 권한 → 카메라에서 허용해 주세요."));
      return;
    }

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
          injectedJavaScriptBeforeContentLoaded={"window.studyRoomNativeCameraPermission = true; true;"}
          injectedJavaScript={"window.studyRoomNativeCameraPermission = true; true;"}
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
  screen: { flex: 1, backgroundColor: "#f3f4ed" },
  errorBanner: { backgroundColor: "#fbe9e4", color: "#9a3f33", fontSize: 14, lineHeight: 23, paddingHorizontal: 16, paddingVertical: 12 },
  webView: { flex: 1, backgroundColor: "#f3f4ed" },
  loading: { flex: 1 },
  feedback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  errorTitle: { color: "#28372e", fontSize: 24, lineHeight: 34, fontWeight: "700", textAlign: "center" },
  errorCopy: { color: "#4e5b50", fontSize: 15, lineHeight: 25, textAlign: "center" },
  retryButton: { minHeight: 48, justifyContent: "center", borderRadius: 10, backgroundColor: "#2f6b52", paddingHorizontal: 20 },
  retryText: { color: "#fffdf5", fontSize: 15, fontWeight: "700" },
  fallbackButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  fallbackText: { color: "#2f6b52", fontSize: 14, fontWeight: "600" },
});
