import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { FocusSnapshot } from "./focus";
import { getFocusDisplay, type FocusAction, type LocalFocusStatus } from "./focusStatus";

type Palette = { surface: string; canvas: string; primary: string; primarySoft: string; border: string; text: string; muted: string; coral: string; gold: string; goldDark: string };
type Props = {
  snapshot: FocusSnapshot | null;
  local: LocalFocusStatus | null;
  error: string;
  action: FocusAction;
  paused: boolean;
  nowMs: number;
  palette: Palette;
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onConnect: () => void;
  onCheck: () => void;
  onDisconnect: () => void;
  onPolicySettings: () => void;
  onLogout?: () => void;
};

export function FocusStatusPanel(props: Props) {
  const { snapshot, action, palette, settingsOpen } = props;
  const display = getFocusDisplay(props);
  const styles = createStyles(palette);
  const disabled = Boolean(action);
  const connected = Boolean(snapshot?.device_connected);
  const confirmedAt = snapshot?.last_ack_at && Number.isFinite(Date.parse(snapshot.last_ack_at))
    ? new Date(snapshot.last_ack_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;
  const button = (label: string, onPress: () => void, primary = false) => (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: disabled }} disabled={disabled}
      onPress={onPress} style={[styles.button, primary && styles.primaryButton, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, primary && styles.primaryText, disabled && styles.disabledText]}>{label}</Text>
    </Pressable>
  );
  return (
    <View>
      <View style={styles.bar}>
        <View style={styles.status} accessibilityLiveRegion="polite">
          <Text style={styles.caption}>휴대폰 집중 모드</Text>
          <View style={styles.statusRow}>
            {action ? <ActivityIndicator color={palette.primary} /> : null}
            <Text style={[styles.label, display.kind === "warning" && styles.warning]}>{display.label}</Text>
          </View>
          <Text style={styles.caption}>{action ? "잠시만 기다려 주세요" : confirmedAt ? `마지막 적용 확인 ${confirmedAt}` : "연결과 실제 방해금지 적용은 별도로 확인해요"}</Text>
        </View>
        <View style={styles.actions}>
          {!connected ? button(action === "connecting" ? "연결 중…" : "휴대폰 연결", props.onConnect, true) : null}
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: settingsOpen }} onPress={props.onOpenSettings} style={styles.button}>
            <Text style={styles.buttonText}>집중 설정</Text>
          </Pressable>
        </View>
      </View>
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={props.onCloseSettings}>
        <View style={styles.backdrop}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>휴대폰 집중 설정</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="집중 설정 닫기" onPress={props.onCloseSettings} style={styles.button}>
                <Text style={styles.buttonText}>닫기</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={[styles.label, display.kind === "warning" && styles.warning]} accessibilityLiveRegion="polite">{display.label}</Text>
              <Text style={styles.copy}>{display.description}</Text>
              {snapshot?.last_ack_at ? <Text style={styles.copy}>마지막 기기 적용 확인: {new Date(snapshot.last_ack_at).toLocaleString("ko-KR")}</Text> : null}
              {props.error || snapshot?.last_error ? <Text style={styles.warning} accessibilityRole="alert">{props.error || snapshot?.last_error}</Text> : null}
              {connected ? button(action === "checking" ? "확인 중…" : "상태 다시 확인", props.onCheck, true) : button(action === "connecting" ? "연결 중…" : "이 휴대폰 연결", props.onConnect, true)}
              {button("Android 방해금지 설정", props.onPolicySettings)}
              <Text style={styles.copy}>공부 시작·재개 때 독서실 규칙을 켜고, 잠시 쉬기·종료 때 끕니다. 전화·메신저 허용은 Android 설정에서 정하세요. 다른 앱 사용 자체를 막는 기능은 아니에요.</Text>
              <Text accessibilityRole="header" style={styles.subtitle}>실제로 적용됐는지 확인하기</Text>
              <Text style={styles.copy}>1. 공부 시작 후 Android 모드·방해금지 설정의 ‘독서실 공부 집중’이 켜졌는지 확인해요.</Text>
              <Text style={styles.copy}>2. 허용 목록에 없는 앱의 알림을 보내 소리·팝업이 억제되는지 확인해요.</Text>
              <Text style={styles.copy}>3. 잠시 쉬기 → 꺼짐, 재개 → 켜짐, 종료 → 꺼짐을 확인해요. 수동으로 켠 다른 모드는 유지됩니다.</Text>
              {connected ? button(action === "disconnecting" ? "해제 중…" : "이 휴대폰 연결 해제", props.onDisconnect) : null}
              {props.onLogout ? button("로그아웃", props.onLogout) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: Palette) => StyleSheet.create({
  bar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  status: { flex: 1, gap: 4, minWidth: 180 }, statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { flexShrink: 1, fontSize: 16, lineHeight: 24, fontWeight: "700", color: p.primary },
  caption: { fontSize: 14, lineHeight: 21, color: p.muted },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, justifyContent: "center", alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  buttonText: { fontSize: 14, lineHeight: 21, fontWeight: "600", color: p.primary },
  primaryButton: { backgroundColor: p.primary, borderColor: p.primary }, primaryText: { color: p.surface },
  disabled: { backgroundColor: p.primarySoft, borderColor: p.border }, disabledText: { color: p.muted },
  warning: { fontSize: 14, lineHeight: 23, color: p.coral },
  backdrop: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: "rgba(32,52,43,0.5)" },
  dialog: { width: "100%", maxWidth: 560, maxHeight: "90%", alignSelf: "center", backgroundColor: p.surface, borderRadius: 16, borderWidth: 1, borderColor: p.border, overflow: "hidden" },
  heading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 16, borderBottomWidth: 1, borderColor: p.border },
  title: { flexShrink: 1, fontSize: 20, lineHeight: 29, color: p.text, fontWeight: "700" },
  content: { padding: 16, gap: 12 }, copy: { fontSize: 15, lineHeight: 25, color: p.muted },
  subtitle: { fontSize: 16, lineHeight: 24, color: p.text, fontWeight: "700" },
});
