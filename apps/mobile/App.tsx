import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";

import { registerExpoPushTarget } from "./src/notifications";
import { supabase } from "./src/supabase";

const retryCooldownMs = 15 * 60 * 1000;

type Profile = {
  user_id: string;
  time_zone: string;
  reminder_time: string;
  email_reminders_enabled: boolean;
};

type AttendanceDay = {
  local_date: string;
  status: "pending" | "present" | "missed";
  reminder_at: string;
  deadline_at: string;
};

type StudySession = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  status: "active" | "completed" | "cancelled";
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceDay | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [reminderTime, setReminderTime] = useState("21:00");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user.id) {
      void refreshData(session.user.id);
    }
  }, [session?.user.id]);

  useEffect(() => {
    const timerId = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const activeSession = useMemo(
    () => sessions.find((item) => item.status === "active") ?? null,
    [sessions],
  );
  const totalSeconds = sessions.reduce((sum, item) => sum + item.duration_seconds, 0);
  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - nowMs) / 1000));

  async function requestCode() {
    const nextEmail = email.trim();
    if (!nextEmail) {
      Alert.alert("이메일을 입력하세요");
      return;
    }
    if (resendSeconds > 0) {
      Alert.alert("잠시 후 다시 시도", `${resendSeconds}초 후에 다시 코드를 요청할 수 있습니다.`);
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: nextEmail,
      options: { shouldCreateUser: true },
    });
    setBusy(false);

    if (error) {
      if (isRateLimitError(error.message)) {
        setResendAvailableAt(Date.now() + retryCooldownMs);
      }
      Alert.alert("코드 전송 실패", formatAuthError(error.message));
    } else {
      setCodeSent(true);
      setResendAvailableAt(Date.now() + 60_000);
      Alert.alert("코드를 보냈습니다", "이메일로 받은 6자리 코드를 입력하세요.");
    }
  }

  async function verifyCode() {
    const nextEmail = email.trim();
    const token = otp.replace(/\s+/g, "");
    if (!nextEmail || !/^\d{6}$/.test(token)) {
      Alert.alert("입력 확인", "이메일과 6자리 숫자 코드를 확인하세요.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: nextEmail,
      token,
      type: "email",
    });
    setBusy(false);

    if (error) {
      Alert.alert("로그인 실패", formatAuthError(error.message));
    }
  }

  async function refreshData(userId: string) {
    setBusy(true);

    const [{ data: profileData }, { data: attendanceData }, { data: sessionsData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("attendance_days")
        .select("*")
        .eq("user_id", userId)
        .order("local_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("study_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(20),
    ]);

    if (profileData) {
      setProfile(profileData);
      setReminderTime(profileData.reminder_time.slice(0, 5));
    }
    setAttendance(attendanceData ?? null);
    setSessions(sessionsData ?? []);
    setBusy(false);
  }

  async function saveReminder() {
    if (!session?.user.id) {
      return;
    }

    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ reminder_time: reminderTime, time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      .eq("user_id", session.user.id);
    setBusy(false);

    if (error) {
      Alert.alert("저장 실패", error.message);
    } else {
      await refreshData(session.user.id);
    }
  }

  async function enablePush() {
    if (!session?.user.id) {
      return;
    }

    setBusy(true);
    try {
      await registerExpoPushTarget(session.user.id);
      Alert.alert("알림 등록 완료", "정해진 시간에 휴대폰 알림을 보냅니다.");
    } catch (error) {
      Alert.alert("알림 등록 실패", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function startTimer() {
    setBusy(true);
    const { error } = await supabase.rpc("start_study_session");
    setBusy(false);

    if (error) {
      Alert.alert("시작 실패", error.message);
    } else if (session?.user.id) {
      await refreshData(session.user.id);
    }
  }

  async function endTimer() {
    if (!activeSession) {
      return;
    }

    setBusy(true);
    const { error } = await supabase.rpc("end_study_session", { p_session_id: activeSession.id });
    setBusy(false);

    if (error) {
      Alert.alert("종료 실패", error.message);
    } else if (session?.user.id) {
      await refreshData(session.user.id);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#1f5c4d" />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loginPanel}>
          <Text style={styles.kicker}>forced attendance</Text>
          <Text style={styles.title}>오늘도 독서실에 들어갈 시간</Text>
          <Text style={styles.copy}>
            이메일로 받은 6자리 코드를 입력해 로그인하세요. 매일 정한 시간에 출석을 기록합니다.
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="email@example.com"
            placeholderTextColor="#8c8172"
            style={styles.input}
          />
          {codeSent && (
            <TextInput
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              placeholder="123456"
              placeholderTextColor="#8c8172"
              style={styles.input}
            />
          )}
          <Pressable style={styles.primaryButton} onPress={requestCode} disabled={busy}>
            <Text style={styles.primaryButtonText}>
              {busy ? "전송 중..." : resendSeconds > 0 ? `${resendSeconds}초 후 재전송` : codeSent ? "코드 다시 받기" : "코드 받기"}
            </Text>
          </Pressable>
          {codeSent && (
            <Pressable style={styles.secondaryButton} onPress={verifyCode} disabled={busy}>
              <Text style={styles.secondaryButtonText}>코드로 로그인</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>study room</Text>
            <Text style={styles.title}>강제 출석 독서실</Text>
          </View>
          <Pressable onPress={() => supabase.auth.signOut()} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>로그아웃</Text>
          </Pressable>
        </View>

        <View style={styles.statusPanel}>
          <Text style={styles.statusLabel}>오늘 상태</Text>
          <Text style={styles.statusValue}>{attendanceLabel(attendance?.status)}</Text>
          <Text style={styles.copy}>
            알림 시간 {profile?.reminder_time?.slice(0, 5) ?? reminderTime} 이후 30분 안에 타이머를 시작해야 출석입니다.
          </Text>
        </View>

        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{formatSeconds(totalSeconds)}</Text>
            <Text style={styles.metricLabel}>최근 누적 공부</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{activeSession ? "진행 중" : "대기"}</Text>
            <Text style={styles.metricLabel}>타이머</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable
            style={[styles.primaryButton, activeSession ? styles.disabledButton : null]}
            onPress={startTimer}
            disabled={busy || Boolean(activeSession)}
          >
            <Text style={styles.primaryButtonText}>입장하고 타이머 시작</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, !activeSession ? styles.disabledButton : null]}
            onPress={endTimer}
            disabled={busy || !activeSession}
          >
            <Text style={styles.secondaryButtonText}>퇴실하고 종료</Text>
          </Pressable>
        </View>

        <View style={styles.settings}>
          <Text style={styles.sectionTitle}>알림 설정</Text>
          <TextInput value={reminderTime} onChangeText={setReminderTime} style={styles.input} />
          <Pressable style={styles.secondaryButton} onPress={saveReminder} disabled={busy}>
            <Text style={styles.secondaryButtonText}>매일 알림 시간 저장</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={enablePush} disabled={busy}>
            <Text style={styles.secondaryButtonText}>휴대폰 푸시 알림 등록</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function attendanceLabel(status?: AttendanceDay["status"]) {
  if (status === "present") return "출석";
  if (status === "missed") return "결석";
  if (status === "pending") return "대기 중";
  return "아직 기록 없음";
}

function formatSeconds(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatAuthError(message: string) {
  if (isRateLimitError(message)) {
    return "Supabase 이메일 발송 한도에 걸렸습니다. 잠시 후 다시 시도하거나 Supabase에 커스텀 SMTP를 설정하세요.";
  }
  return message;
}

function isRateLimitError(message: string) {
  return message.toLowerCase().includes("rate limit");
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8f4ea",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f4ea",
  },
  content: {
    padding: 22,
    gap: 18,
  },
  loginPanel: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  kicker: {
    color: "#9c3f2e",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: "#1d1a16",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 0,
  },
  copy: {
    color: "#62594e",
    fontSize: 15,
    lineHeight: 22,
  },
  statusPanel: {
    backgroundColor: "#1d1a16",
    padding: 22,
    borderRadius: 8,
    gap: 10,
  },
  statusLabel: {
    color: "#dbcdb7",
    fontSize: 13,
    fontWeight: "800",
  },
  statusValue: {
    color: "#f8f4ea",
    fontSize: 42,
    fontWeight: "900",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  metric: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderColor: "#ded4c4",
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
  },
  metricValue: {
    color: "#1f5c4d",
    fontSize: 24,
    fontWeight: "900",
  },
  metricLabel: {
    color: "#62594e",
    marginTop: 6,
  },
  controls: {
    gap: 12,
  },
  settings: {
    backgroundColor: "#efe6d4",
    borderRadius: 8,
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    color: "#1d1a16",
    fontSize: 18,
    fontWeight: "900",
  },
  input: {
    minHeight: 52,
    borderRadius: 8,
    borderColor: "#c9bba7",
    borderWidth: 1,
    backgroundColor: "#fffaf1",
    color: "#1d1a16",
    paddingHorizontal: 14,
    fontSize: 16,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f5c4d",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#fffaf1",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#d8b45d",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: "#1d1a16",
    fontWeight: "900",
    fontSize: 15,
  },
  ghostButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ghostButtonText: {
    color: "#1f5c4d",
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.45,
  },
});
