import type React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppUpdate, type AppUpdateController, type InstallGate } from "./useAppUpdate";

export type StudyPalette = { surface: string; canvas: string; primary: string; primarySoft: string; border: string; text: string; muted: string; coral: string };
type Props = { palette: StudyPalette; beforeInstall: () => Promise<InstallGate>; controller?: AppUpdateController };
function StandalonePanel(props: Props) { const controller = useAppUpdate(props.beforeInstall); return <AppUpdatePanel {...props} controller={controller} />; }
export function AppUpdatePanel(props: Props): React.ReactElement | null {
  if (!props.controller) return <StandalonePanel {...props} />;
  const c = props.controller, p = props.palette, styles = createStyles(p);
  if (!c.supported) return null;
  const status = {
    idle: "업데이트를 확인할 수 있어요", checking: "최신 출시 확인 중…", latest: "현재 최신 버전이에요", available: "새 버전이 있어요",
    downloading: `다운로드 중 ${c.progress}%`, verifying: "다운로드한 앱을 안전하게 확인 중…", ready: "설치 준비가 됐어요", cancelled: "다운로드를 취소했어요",
    failed: "업데이트 확인이 필요해요", permission_required: "Android 설치 권한이 필요해요", install_pending: "Android 설치 확인 대기 중", installed: "업데이트가 설치됐어요",
  }[c.status];
  const button = (label: string, action: () => void | Promise<void>, primary = false, disabled = c.busy) => (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: disabled }} disabled={disabled} onPress={action}
      style={[styles.button, primary && styles.primary, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, primary && styles.primaryText, disabled && styles.muted]}>{label}</Text>
    </Pressable>
  );
  return <View>
    <View style={styles.bar}>
      <Text style={styles.caption} accessibilityLiveRegion="polite">{c.status === "available" ? "새 버전으로 더 편하게 공부해요" : "앱 버전과 업데이트"}</Text>
      {button("앱 업데이트", c.open, false, false)}
    </View>
    <Modal visible={c.isOpen} transparent animationType="fade" onRequestClose={c.close}>
      <View style={styles.backdrop}><View style={styles.dialog} accessibilityViewIsModal>
        <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>앱 업데이트</Text>{button("닫기", c.close, false, false)}</View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statusRow}>{c.busy ? <ActivityIndicator color={p.primary} /> : null}<Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text></View>
          <Text style={styles.copy}>현재 버전 {c.current?.versionName ?? "확인 중"} · 빌드 {c.current?.versionCode ?? "—"}</Text>
          {c.release ? <View style={styles.release}>
            <Text style={styles.subtitle}>최신 버전 {c.release.versionName} · 빌드 {c.release.versionCode}</Text>
            <Text style={styles.copy}>출시 {new Date(c.release.releasedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} · {(c.release.sizeBytes / 1024 / 1024).toFixed(1)} MB</Text>
            {c.release.releaseNotes.map((note, i) => <Text key={i} style={styles.copy}>• {note}</Text>)}
          </View> : null}
          {c.error ? <Text accessibilityRole="alert" style={styles.warning}>{c.error}</Text> : null}
          {c.status === "downloading" || c.status === "verifying" ? button("다운로드 취소", c.cancel, false, false) : null}
          {c.release && ["available", "cancelled", "failed"].includes(c.status) ? button("업데이트 다운로드", c.download, true) : null}
          {c.status === "ready" || c.status === "permission_required" ? button(c.status === "permission_required" ? "설치 계속하기" : "업데이트 설치", c.install, true) : null}
          {c.status === "permission_required" ? <>
            <Text style={styles.copy}>Android에서 이 앱 출처의 설치를 허용해야 해요. 설정에서 돌아온 뒤 ‘설치 계속하기’를 직접 눌러 주세요.</Text>
            {button("Android 설치 권한 설정", c.settings)}
          </> : null}
          {c.status === "install_pending" ? <Text style={styles.copy}>설치 화면 진입은 완료가 아니에요. Android 확인을 마친 뒤 실제 설치 버전을 다시 확인해요.</Text> : null}
          {button("최신 버전 다시 확인", c.check, false, c.busy || c.status === "install_pending")}
          <Text style={styles.copy}>다운로드와 설치는 직접 선택할 때만 진행해요. 공부 중에는 먼저 휴식 또는 종료하세요. 기존 앱을 삭제할 필요는 없어요.</Text>
        </ScrollView>
      </View></View>
    </Modal>
  </View>;
}
const createStyles = (p: StudyPalette) => StyleSheet.create({
  bar: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", backgroundColor: p.surface, borderBottomWidth: 1, borderColor: p.border },
  caption: { fontSize: 14, lineHeight: 22, color: p.muted, flexShrink: 1 },
  button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: p.border, justifyContent: "center", alignItems: "center", backgroundColor: p.surface },
  buttonText: { fontSize: 14, lineHeight: 22, fontWeight: "600", color: p.primary }, primary: { backgroundColor: p.primary, borderColor: p.primary }, primaryText: { color: p.surface }, disabled: { backgroundColor: p.primarySoft }, muted: { color: p.muted },
  backdrop: { flex: 1, padding: 16, justifyContent: "center", backgroundColor: "rgba(32,52,43,0.5)" },
  dialog: { width: "100%", maxWidth: 560, maxHeight: "90%", alignSelf: "center", backgroundColor: p.surface, borderRadius: 16, borderWidth: 1, borderColor: p.border, overflow: "hidden" },
  heading: { padding: 16, borderBottomWidth: 1, borderColor: p.border, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 20, lineHeight: 29, fontWeight: "700", color: p.text, flexShrink: 1 }, content: { padding: 16, gap: 14 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 }, status: { fontSize: 16, lineHeight: 25, fontWeight: "700", color: p.primary, flexShrink: 1 },
  subtitle: { fontSize: 16, lineHeight: 25, fontWeight: "700", color: p.text }, copy: { fontSize: 15, lineHeight: 25, color: p.muted }, warning: { fontSize: 15, lineHeight: 25, color: p.coral },
  release: { padding: 14, gap: 8, borderRadius: 12, backgroundColor: p.canvas, borderWidth: 1, borderColor: p.border },
});
