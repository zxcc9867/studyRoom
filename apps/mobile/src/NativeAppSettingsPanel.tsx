import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { StudyPalette } from "./AppUpdatePanel";
import type { PermissionState, SettingsSnapshot } from "./nativeAppSettings";

type Props = { visible: boolean; userId: string | null; palette: StudyPalette; readSnapshot: () => Promise<SettingsSnapshot>;
  onClose: () => void; onUpdate: () => void; onFocus: () => void; onAppSettings: () => void; onRegisterPush: () => void; busy?: boolean };
const permissionLabel = (value?: PermissionState) => ({ granted: "허용", denied: "허용 안 됨", unsupported: "지원하지 않음", unknown: "확인하지 못함" })[value ?? "unknown"];
export function NativeAppSettingsPanel(props: Props) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [error, setError] = useState("");
  const latest = useRef(props); latest.current = props;
  useEffect(() => {
    if (!props.visible) return;
    let active = true, revision = 0;
    const owner = props.userId;
    async function refresh() {
      const request = ++revision;
      setSnapshot(null); setError("");
      try {
        const value = await latest.current.readSnapshot();
        if (active && request === revision && latest.current.visible && latest.current.userId === owner) setSnapshot(value);
      } catch { if (active && request === revision && latest.current.userId === owner) setError("권한 상태를 확인하지 못했어요. Android 앱 설정에서 확인해 주세요."); }
    }
    void refresh();
    const listener = AppState.addEventListener("change", state => { if (state === "active") void refresh(); });
    return () => { active = false; ++revision; listener.remove(); };
  }, [props.visible, props.userId]);
  const p = props.palette, styles = createStyles(p);
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled}
    accessibilityState={{ disabled }} onPress={action} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  return <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
    <View style={styles.backdrop}><View style={styles.dialog} accessibilityViewIsModal>
      <View style={styles.heading}><Text style={styles.title} accessibilityRole="header">앱 설정</Text>{button("닫기", props.onClose)}</View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">앱 정보</Text>
        <Text style={styles.copy}>현재 버전 {snapshot?.versionName ?? "확인 중"} · 빌드 {snapshot?.versionCode ?? "—"}</Text>
        {button("앱 업데이트", props.onUpdate)}
        <Text style={styles.copy}>다운로드와 설치는 업데이트 창에서 직접 선택할 때만 진행해요.</Text>
        <Text style={styles.title} accessibilityRole="header">휴대폰 권한</Text>
        {!snapshot && !error ? <ActivityIndicator color={p.primary} accessibilityLabel="권한 상태 확인 중" /> : null}
        <Text style={styles.copy} accessibilityLiveRegion="polite">카메라 · {permissionLabel(snapshot?.permissions.camera)}</Text>
        <Text style={styles.copy}>알림 · {permissionLabel(snapshot?.permissions.notifications)}</Text>
        <Text style={styles.copy}>방해금지 접근 · {permissionLabel(snapshot?.permissions.focus)}</Text>
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        <Text style={styles.copy}>이 화면은 권한 상태만 읽어요. 변경하려면 아래 버튼을 직접 선택하세요.</Text>
        {button("Android 앱 권한 설정", props.onAppSettings)}
        {props.userId ? <>
          {button("휴대폰 집중 설정", props.onFocus)}
          {button("휴대폰 푸시 알림 등록", props.onRegisterPush, props.busy)}
        </> : <Text style={styles.copy}>휴대폰 연결과 푸시 등록은 로그인한 뒤 사용할 수 있어요.</Text>}
      </ScrollView>
    </View></View>
  </Modal>;
}
const createStyles = (p: StudyPalette) => StyleSheet.create({
  backdrop: { flex: 1, padding: 16, justifyContent: "center", backgroundColor: "rgba(32,52,43,0.5)" },
  dialog: { width: "100%", maxWidth: 560, maxHeight: "90%", alignSelf: "center", backgroundColor: p.surface, borderRadius: 16, borderWidth: 1, borderColor: p.border, overflow: "hidden" },
  heading: { padding: 16, gap: 8, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: p.border },
  title: { fontSize: 20, lineHeight: 29, fontWeight: "700", color: p.text }, content: { padding: 16, gap: 14 },
  copy: { fontSize: 15, lineHeight: 25, color: p.muted }, error: { fontSize: 15, lineHeight: 25, color: p.coral },
  button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: p.border, justifyContent: "center", alignItems: "center", backgroundColor: p.surface },
  buttonText: { fontSize: 14, lineHeight: 22, fontWeight: "600", color: p.primary }, disabled: { backgroundColor: p.primarySoft },
});
