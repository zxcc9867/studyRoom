import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";

import { registerExpoPushTarget } from "./src/notifications";
import { supabase } from "./src/supabase";

const retryCooldownMs = 15 * 60 * 1000;

const mobilePalette = {
  canvas: "#d9f0e3",
  surface: "#fff9df",
  surfaceWarm: "#fff6c7",
  primary: "#2f6b52",
  primarySoft: "#dff4cd",
  border: "#4f916f",
  gold: "#f0c85c",
  goldDark: "#bf9736",
  coral: "#bf5c42",
  text: "#2f2a1f",
  muted: "#5a513d",
  softBorder: "#d2b56f",
} as const;

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
  lease_expires_at: string | null;
  paused_at: string | null;
  paused_seconds: number;
};

type StudyTodo = {
  id: string;
  user_id: string;
  local_date: string;
  title: string;
  is_completed: boolean;
  position: number;
};

type StudySessionTodoLink = {
  session_id: string;
  todo_id: string;
};

type InterruptionReason = "none" | "phone" | "environment" | "fatigue" | "schedule" | "other";

const interruptionOptions: Array<{ value: InterruptionReason; label: string }> = [
  { value: "none", label: "방해 없음" },
  { value: "phone", label: "휴대폰" },
  { value: "environment", label: "소음·환경" },
  { value: "fatigue", label: "피로" },
  { value: "schedule", label: "일정" },
  { value: "other", label: "기타" },
];

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
  const [studyTodos, setStudyTodos] = useState<StudyTodo[]>([]);
  const [studySessionTodoLinks, setStudySessionTodoLinks] = useState<StudySessionTodoLink[]>([]);
  const [todayStudySeconds, setTodayStudySeconds] = useState(0);
  const [selectedSessionTodoIds, setSelectedSessionTodoIds] = useState<string[]>([]);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [selectedCompletionTodoIds, setSelectedCompletionTodoIds] = useState<string[]>([]);
  const [focusScore, setFocusScore] = useState(3);
  const [energyScore, setEnergyScore] = useState(3);
  const [interruptionReason, setInterruptionReason] = useState<InterruptionReason>("none");
  const [reflectionNote, setReflectionNote] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [quickTodoTitle, setQuickTodoTitle] = useState("");
  const [reminderTime, setReminderTime] = useState("20:30");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!cancelled) setSession(data.session);
      } catch (error) {
        if (!cancelled) Alert.alert("세션 확인 실패", formatError(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restoreSession();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
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
  const activeSessionPaused = Boolean(activeSession?.paused_at);
  const todayDateKey = useMemo(
    () => getLocalDateKey(new Date(), profile?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone),
    [profile?.time_zone],
  );
  const todayTodos = useMemo(
    () => studyTodos.filter((todo) => todo.local_date === todayDateKey && !todo.is_completed),
    [studyTodos, todayDateKey],
  );
  const linkedActiveTodoIds = useMemo(
    () => activeSession
      ? studySessionTodoLinks.filter((link) => link.session_id === activeSession.id).map((link) => link.todo_id)
      : [],
    [activeSession?.id, studySessionTodoLinks],
  );
  const completionCandidates = useMemo(() => [...todayTodos].sort((left, right) => {
    const leftLinked = linkedActiveTodoIds.includes(left.id) ? 0 : 1;
    const rightLinked = linkedActiveTodoIds.includes(right.id) ? 0 : 1;
    return leftLinked - rightLinked || left.position - right.position;
  }), [linkedActiveTodoIds, todayTodos]);
  const leaseRemainingSeconds = activeSession?.lease_expires_at
    ? Math.max(0, Math.ceil((new Date(activeSession.lease_expires_at).getTime() - nowMs) / 1000))
    : 0;
  const currentBreakSeconds = getCurrentBreakSeconds(activeSession?.paused_at, nowMs);
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
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: nextEmail,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setCodeSent(true);
      setResendAvailableAt(Date.now() + 60_000);
      Alert.alert("코드를 보냈습니다", "이메일로 받은 6자리 코드를 입력하세요.");
    } catch (error) {
      const message = formatError(error);
      if (isRateLimitError(message)) setResendAvailableAt(Date.now() + retryCooldownMs);
      Alert.alert("코드 전송 실패", formatAuthError(message));
    } finally {
      setBusy(false);
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
    try {
      const { error } = await supabase.auth.verifyOtp({ email: nextEmail, token, type: "email" });
      if (error) throw error;
    } catch (error) {
      Alert.alert("로그인 실패", formatAuthError(formatError(error)));
    } finally {
      setBusy(false);
    }
  }

  async function refreshData(userId: string) {
    setBusy(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileError) throw profileError;

      const resolvedTimeZone = profileData?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = getLocalDateKey(new Date(), resolvedTimeZone);
      const [attendanceResult, sessionsResult, todosResult, sessionTodoResult, studySummaryResult] = await Promise.all([
        supabase
          .from("attendance_days")
          .select("*")
          .eq("user_id", userId)
          .eq("local_date", localDate)
          .maybeSingle(),
        supabase
          .from("study_sessions")
          .select("*")
          .eq("user_id", userId)
          .order("started_at", { ascending: false })
          .limit(20),
        supabase
          .from("study_todos")
          .select("id,user_id,local_date,title,is_completed,position")
          .eq("user_id", userId)
          .eq("local_date", localDate)
          .eq("is_completed", false)
          .order("position", { ascending: true }),
        supabase
          .from("study_session_todos")
          .select("session_id,todo_id")
          .eq("user_id", userId)
          .order("linked_at", { ascending: false })
          .limit(100),
        supabase.rpc("get_study_period_summary", {
          p_start_date: localDate,
          p_end_date: localDate,
        }),
      ]);
      const queryError = attendanceResult.error
        ?? sessionsResult.error
        ?? todosResult.error
        ?? sessionTodoResult.error
        ?? studySummaryResult.error;
      if (queryError) throw queryError;

      if (profileData) {
        setProfile(profileData as Profile);
        setReminderTime(profileData.reminder_time.slice(0, 5));
      }
      setAttendance((attendanceResult.data ?? null) as AttendanceDay | null);
      setSessions((sessionsResult.data ?? []) as StudySession[]);
      setStudySessionTodoLinks((sessionTodoResult.data ?? []) as StudySessionTodoLink[]);
      const summaryRow = Array.isArray(studySummaryResult.data) ? studySummaryResult.data[0] : studySummaryResult.data;
      setTodayStudySeconds(Math.max(0, Number(summaryRow?.completed_seconds) || 0));
      const nextTodos = (todosResult.data ?? []) as StudyTodo[];
      setStudyTodos(nextTodos);
      setSelectedSessionTodoIds((current) => {
        const validIds = new Set(nextTodos.map((todo) => todo.id));
        const retained = current.filter((id) => validIds.has(id));
        return retained.length > 0 ? retained : nextTodos.map((todo) => todo.id);
      });
    } catch (error) {
      Alert.alert("데이터 불러오기 실패", formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveReminder() {
    if (!session?.user.id) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ reminder_time: reminderTime, time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone })
        .eq("user_id", session.user.id);
      if (error) throw error;
      await refreshData(session.user.id);
    } catch (error) {
      Alert.alert("저장 실패", formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function addQuickTodo() {
    if (!session?.user.id) return;
    const title = quickTodoTitle.trim();
    if (!title) {
      Alert.alert("할 일 입력", "세션에서 공부할 할 일을 입력하세요.");
      return;
    }

    setBusy(true);
    try {
      const position = studyTodos.reduce((max, todo) => Math.max(max, todo.position + 1), 0);
      const { data, error } = await supabase
        .from("study_todos")
        .insert({
          user_id: session.user.id,
          local_date: todayDateKey,
          title,
          is_completed: false,
          position,
        })
        .select("id,user_id,local_date,title,is_completed,position")
        .single();
      if (error) throw error;
      const created = data as StudyTodo;
      setStudyTodos((current) => [...current, created]);
      setSelectedSessionTodoIds((current) => [...new Set([...current, created.id])]);
      setQuickTodoTitle("");
    } catch (error) {
      Alert.alert("할 일 추가 실패", formatError(error));
    } finally {
      setBusy(false);
    }
  }

  function toggleSessionTodo(todoId: string) {
    setSelectedSessionTodoIds((current) =>
      current.includes(todoId) ? current.filter((id) => id !== todoId) : [...current, todoId],
    );
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
    if (!session?.user.id) return;
    if (selectedSessionTodoIds.length === 0) {
      Alert.alert("세션 할 일 필요", "오늘의 미완료 할 일을 하나 이상 선택하세요.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.rpc("start_study_session", {
        p_todo_ids: selectedSessionTodoIds,
      });
      if (error) throw error;
      await refreshData(session.user.id);
    } catch (error) {
      Alert.alert("시작 실패", formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function pauseTimer() {
    if (!activeSession || activeSessionPaused || !session?.user.id) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("pause_study_session", {
        p_session_id: activeSession.id,
      });
      if (error) throw error;
      await refreshData(session.user.id);
    } catch (error) {
      Alert.alert("휴식 시작 실패", formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function resumeTimer() {
    if (!activeSession || !activeSessionPaused || !session?.user.id) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("resume_study_session", {
        p_session_id: activeSession.id,
      });
      if (error) throw error;
      await refreshData(session.user.id);
    } catch (error) {
      Alert.alert("공부 재개 실패", formatError(error));
    } finally {
      setBusy(false);
    }
  }

  function openReflection() {
    if (!activeSession) return;
    setSelectedCompletionTodoIds(linkedActiveTodoIds);
    setFocusScore(3);
    setEnergyScore(3);
    setInterruptionReason("none");
    setReflectionNote("");
    setNextAction("");
    setReflectionOpen(true);
  }

  function toggleCompletionTodo(todoId: string) {
    setSelectedCompletionTodoIds((current) =>
      current.includes(todoId) ? current.filter((id) => id !== todoId) : [...current, todoId],
    );
  }

  async function completeTimer() {
    if (!activeSession || !session?.user.id) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("complete_study_session", {
        p_session_id: activeSession.id,
        p_excluded_seconds: 0,
        p_completed_todo_ids: selectedCompletionTodoIds,
        p_focus_score: focusScore,
        p_energy_score: energyScore,
        p_interruption_reason: interruptionReason,
        p_note: reflectionNote,
        p_next_action: nextAction,
      });
      if (error) throw error;
      await refreshData(session.user.id);
      setReflectionOpen(false);
    } catch (error) {
      Alert.alert("종료 실패", formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function extendSessionLease() {
    if (!activeSession || !session?.user.id) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("extend_study_session_lease", {
        p_session_id: activeSession.id,
        p_extension_minutes: 60,
      });
      if (error) throw error;
      await refreshData(session.user.id);
    } catch (error) {
      Alert.alert("세션 유지 실패", formatError(error));
    } finally {
      setBusy(false);
    }
  }
  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="dark-content" backgroundColor={mobilePalette.canvas} />
        <ActivityIndicator color={mobilePalette.primary} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={mobilePalette.canvas} />
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
            placeholderTextColor={mobilePalette.muted}
            style={styles.input}
          />
          {codeSent && (
            <TextInput
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              placeholder="123456"
              placeholderTextColor={mobilePalette.muted}
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
      <StatusBar barStyle="dark-content" backgroundColor={mobilePalette.canvas} />
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
            평일은 {profile?.reminder_time?.slice(0, 5) ?? reminderTime} 알림, 주말은 14:00 알림입니다. 알림 후
            30분 안에 시작하거나 평일 2시간, 주말 4시간을 채우면 출석입니다.
          </Text>
        </View>

        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{formatSeconds(todayStudySeconds)}</Text>
            <Text style={styles.metricLabel}>오늘 완료 공부</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{activeSessionPaused ? "휴식 중" : activeSession ? "진행 중" : "대기"}</Text>
            <Text style={styles.metricLabel}>타이머</Text>
          </View>
        </View>

        <View style={styles.todoPanel}>
          <View style={styles.todoPanelHeader}>
            <View style={styles.todoPanelHeading}>
              <Text style={styles.sectionTitle}>오늘 세션 할 일</Text>
              <Text style={styles.copy}>웹과 같은 정책으로 하나 이상 선택해야 타이머를 시작할 수 있어요.</Text>
            </View>
            <Text style={styles.todoCount}>{selectedSessionTodoIds.length}개 선택</Text>
          </View>

          {todayTodos.length === 0 ? (
            <Text style={styles.emptyTodo}>오늘의 미완료 할 일이 없습니다. 아래에서 바로 추가하세요.</Text>
          ) : (
            <View style={styles.todoChoices}>
              {todayTodos.map((todo) => {
                const selected = selectedSessionTodoIds.includes(todo.id);
                return (
                  <Pressable
                    key={todo.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected, disabled: busy || Boolean(activeSession) }}
                    style={[styles.todoChoice, selected ? styles.todoChoiceSelected : null]}
                    disabled={busy || Boolean(activeSession)}
                    onPress={() => toggleSessionTodo(todo.id)}
                  >
                    <View style={[styles.todoCheck, selected ? styles.todoCheckSelected : null]}>
                      <Text style={styles.todoCheckText}>{selected ? "✓" : ""}</Text>
                    </View>
                    <Text style={styles.todoChoiceText}>{todo.title}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.quickTodoRow}>
            <TextInput
              value={quickTodoTitle}
              onChangeText={setQuickTodoTitle}
              placeholder="지금 공부할 할 일"
              placeholderTextColor={mobilePalette.muted}
              style={[styles.input, styles.quickTodoInput]}
              editable={!busy && !activeSession}
              returnKeyType="done"
              onSubmitEditing={() => void addQuickTodo()}
            />
            <Pressable
              style={[styles.quickTodoButton, activeSession ? styles.disabledButton : null]}
              onPress={addQuickTodo}
              disabled={busy || Boolean(activeSession)}
            >
              <Text style={styles.quickTodoButtonText}>추가</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.controls}>
          <Pressable
            style={[
              activeSession && !activeSessionPaused ? styles.breakButton : styles.primaryButton,
              !activeSession && selectedSessionTodoIds.length === 0 ? styles.disabledButton : null,
            ]}
            onPress={!activeSession ? startTimer : activeSessionPaused ? resumeTimer : pauseTimer}
            disabled={busy || (!activeSession && selectedSessionTodoIds.length === 0)}
          >
            <Text style={activeSession && !activeSessionPaused ? styles.breakButtonText : styles.primaryButtonText}>
              {!activeSession ? "입장하고 타이머 시작" : activeSessionPaused ? "공부 계속하기" : "잠시 쉬기"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.dangerButton, !activeSession ? styles.disabledButton : null]}
            onPress={openReflection}
            disabled={busy || !activeSession}
          >
            <Text style={styles.dangerButtonText}>퇴실하고 종료</Text>
          </Pressable>
        </View>

        {activeSessionPaused && (
          <View style={styles.breakPanel} accessibilityRole="summary">
            <Text style={styles.breakLabel}>BREAK TIME</Text>
            <Text style={styles.breakValue}>휴식 중 · {formatTimerClock(currentBreakSeconds)}</Text>
            <Text style={styles.copy}>공부 시간은 멈췄습니다. 세션 유지 시간은 계속 줄어듭니다.</Text>
          </View>
        )}

        {activeSession && (
          <View style={styles.leasePanel}>
            <View>
              <Text style={styles.sectionTitle}>세션 유지시간</Text>
              <Text style={styles.copy}>남은 시간 {formatSeconds(leaseRemainingSeconds)} · 최대 2시간까지 유지</Text>
            </View>
            <Pressable style={styles.secondaryButton} onPress={extendSessionLease} disabled={busy}>
              <Text style={styles.secondaryButtonText}>1시간 유지하기</Text>
            </Pressable>
          </View>
        )}

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
      <Modal
        visible={reflectionOpen}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!busy) setReflectionOpen(false); }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.reflectionModal}>
            <ScrollView contentContainerStyle={styles.reflectionContent}>
              <Text style={styles.kicker}>session reflection</Text>
              <Text style={styles.sectionTitle}>오늘의 집중을 짧게 돌아봐요</Text>
              <Text style={styles.copy}>회고와 완료한 할 일을 한 번에 저장한 뒤 세션을 종료합니다.</Text>
              <ScorePicker label="집중도" value={focusScore} onChange={setFocusScore} />
              <ScorePicker label="에너지" value={energyScore} onChange={setEnergyScore} />
              <Text style={styles.fieldLabel}>가장 큰 방해 요인</Text>
              <View style={styles.reasonChoices}>
                {interruptionOptions.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[styles.reasonChoice, interruptionReason === option.value ? styles.reasonChoiceSelected : null]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: interruptionReason === option.value }}
                    onPress={() => setInterruptionReason(option.value)}
                  >
                    <Text style={styles.reasonChoiceText}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>다음 세션에서 바로 할 한 가지</Text>
              <TextInput value={nextAction} onChangeText={setNextAction} maxLength={160} style={styles.input} placeholder="예: 3단원 문제 1번부터" />
              <Text style={styles.fieldLabel}>한 줄 메모</Text>
              <TextInput value={reflectionNote} onChangeText={setReflectionNote} maxLength={500} multiline style={[styles.input, styles.noteInput]} placeholder="잘된 점이나 바꿀 점" />
              <Text style={styles.fieldLabel}>이번 세션에서 끝낸 할 일</Text>
              {completionCandidates.map((todo) => {
                const selected = selectedCompletionTodoIds.includes(todo.id);
                return (
                  <Pressable key={todo.id} style={[styles.todoChoice, selected ? styles.todoChoiceSelected : null]} onPress={() => toggleCompletionTodo(todo.id)}>
                    <View style={[styles.todoCheck, selected ? styles.todoCheckSelected : null]}><Text style={styles.todoCheckText}>{selected ? "✓" : ""}</Text></View>
                    <Text style={styles.todoChoiceText}>{todo.title}</Text>
                  </Pressable>
                );
              })}
              <Pressable style={styles.primaryButton} onPress={completeTimer} disabled={busy}>
                <Text style={styles.primaryButtonText}>{busy ? "저장하는 중..." : "회고 저장하고 종료"}</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={() => setReflectionOpen(false)} disabled={busy}>
                <Text style={styles.ghostButtonText}>계속 공부하기</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
function ScorePicker({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.scoreField} accessibilityRole="radiogroup">
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.scoreChoices}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Pressable
            key={score}
            style={[styles.scoreChoice, value === score ? styles.scoreChoiceSelected : null]}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === score }}
            onPress={() => onChange(score)}
          >
            <Text style={styles.scoreChoiceText}>{score}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function getLocalDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return date.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
function attendanceLabel(status?: AttendanceDay["status"]) {
  if (status === "present") return "출석";
  if (status === "missed") return "결석";
  if (status === "pending") return "대기 중";
  return "아직 기록 없음";
}

function getCurrentBreakSeconds(pausedAt: string | null | undefined, nowMs: number) {
  if (!pausedAt) return 0;
  const pausedAtMs = Date.parse(pausedAt);
  if (!Number.isFinite(pausedAtMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.floor((nowMs - pausedAtMs) / 1000));
}

function formatTimerClock(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
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
    backgroundColor: mobilePalette.canvas,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobilePalette.canvas,
  },
  content: {
    padding: 18,
    paddingBottom: 36,
    gap: 16,
  },
  loginPanel: {
    flex: 1,
    justifyContent: "center",
    margin: 18,
    borderWidth: 3,
    borderColor: mobilePalette.border,
    borderRadius: 16,
    backgroundColor: mobilePalette.surface,
    padding: 24,
    gap: 18,
    shadowColor: mobilePalette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 0,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderWidth: 3,
    borderColor: mobilePalette.border,
    borderRadius: 14,
    backgroundColor: mobilePalette.surface,
    padding: 18,
    shadowColor: mobilePalette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 4,
  },
  kicker: {
    color: mobilePalette.coral,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: mobilePalette.primary,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 0,
  },
  copy: {
    color: mobilePalette.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  statusPanel: {
    borderWidth: 3,
    borderColor: mobilePalette.border,
    borderRadius: 14,
    backgroundColor: mobilePalette.surfaceWarm,
    padding: 20,
    gap: 9,
  },
  statusLabel: {
    color: mobilePalette.coral,
    fontSize: 13,
    fontWeight: "900",
  },
  statusValue: {
    color: mobilePalette.primary,
    fontSize: 42,
    fontWeight: "900",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  metric: {
    flex: 1,
    minHeight: 108,
    justifyContent: "center",
    borderWidth: 2,
    borderColor: mobilePalette.softBorder,
    borderRadius: 12,
    backgroundColor: mobilePalette.surface,
    padding: 16,
  },
  metricValue: {
    color: mobilePalette.primary,
    fontSize: 24,
    fontWeight: "900",
  },
  metricLabel: {
    color: mobilePalette.muted,
    marginTop: 6,
    fontWeight: "700",
  },
  todoPanel: {
    borderWidth: 2,
    borderColor: mobilePalette.border,
    borderRadius: 14,
    backgroundColor: mobilePalette.surface,
    padding: 16,
    gap: 14,
  },
  todoPanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  todoPanelHeading: {
    flex: 1,
    gap: 4,
  },
  todoCount: {
    borderRadius: 999,
    backgroundColor: mobilePalette.primarySoft,
    color: mobilePalette.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900",
  },
  todoChoices: {
    gap: 8,
  },
  todoChoice: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 2,
    borderColor: mobilePalette.softBorder,
    borderRadius: 11,
    backgroundColor: mobilePalette.surfaceWarm,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  todoChoiceSelected: {
    borderColor: mobilePalette.primary,
    backgroundColor: mobilePalette.primarySoft,
  },
  todoCheck: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: mobilePalette.border,
    borderRadius: 7,
    backgroundColor: mobilePalette.surface,
  },
  todoCheckSelected: {
    backgroundColor: mobilePalette.primary,
  },
  todoCheckText: {
    color: mobilePalette.surface,
    fontWeight: "900",
  },
  todoChoiceText: {
    flex: 1,
    color: mobilePalette.text,
    fontSize: 15,
    fontWeight: "800",
  },
  emptyTodo: {
    color: mobilePalette.muted,
    lineHeight: 21,
    fontWeight: "700",
  },
  quickTodoRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  quickTodoInput: {
    flex: 1,
  },
  quickTodoButton: {
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: mobilePalette.coral,
    paddingHorizontal: 14,
  },
  quickTodoButtonText: {
    color: mobilePalette.surface,
    fontWeight: "900",
  },
  controls: {
    gap: 12,
  },
  settings: {
    borderWidth: 2,
    borderColor: mobilePalette.border,
    borderRadius: 14,
    backgroundColor: mobilePalette.surface,
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    color: mobilePalette.primary,
    fontSize: 20,
    fontWeight: "900",
  },
  input: {
    minHeight: 52,
    borderRadius: 10,
    borderColor: mobilePalette.softBorder,
    borderWidth: 2,
    backgroundColor: mobilePalette.surface,
    color: mobilePalette.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobilePalette.primary,
    paddingHorizontal: 16,
    shadowColor: mobilePalette.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 0,
    elevation: 3,
  },
  primaryButtonText: {
    color: mobilePalette.surface,
    fontWeight: "900",
    fontSize: 16,
  },
  breakButton: {
    minHeight: 54,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobilePalette.gold,
    paddingHorizontal: 16,
    shadowColor: mobilePalette.goldDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  breakButtonText: {
    color: mobilePalette.text,
    fontWeight: "900",
    fontSize: 16,
  },
  dangerButton: {
    minHeight: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobilePalette.coral,
    paddingHorizontal: 16,
    shadowColor: "#8b3e2f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  dangerButtonText: {
    color: mobilePalette.surface,
    fontWeight: "900",
    fontSize: 15,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobilePalette.gold,
    paddingHorizontal: 16,
    shadowColor: mobilePalette.goldDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  secondaryButtonText: {
    color: mobilePalette.text,
    fontWeight: "900",
    fontSize: 15,
  },
  ghostButton: {
    borderWidth: 2,
    borderColor: mobilePalette.border,
    borderRadius: 999,
    backgroundColor: mobilePalette.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ghostButtonText: {
    color: mobilePalette.primary,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.45,
  },
  breakPanel: {
    borderWidth: 2,
    borderColor: mobilePalette.goldDark,
    borderRadius: 14,
    backgroundColor: "#fff2b8",
    padding: 18,
    gap: 6,
  },
  breakLabel: {
    color: "#8a4f23",
    fontSize: 12,
    fontWeight: "900",
  },
  breakValue: {
    color: "#6f3f20",
    fontSize: 24,
    fontWeight: "900",
  },
  leasePanel: {
    borderWidth: 2,
    borderColor: mobilePalette.goldDark,
    borderRadius: 14,
    backgroundColor: mobilePalette.surfaceWarm,
    padding: 18,
    gap: 12,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(32, 52, 43, 0.68)",
    padding: 16,
  },
  reflectionModal: {
    maxHeight: "92%",
    borderWidth: 3,
    borderColor: mobilePalette.border,
    borderRadius: 16,
    backgroundColor: mobilePalette.surface,
    overflow: "hidden",
  },
  reflectionContent: {
    padding: 20,
    gap: 14,
  },
  fieldLabel: {
    color: mobilePalette.text,
    fontSize: 15,
    fontWeight: "900",
  },
  scoreField: {
    gap: 8,
  },
  scoreChoices: {
    flexDirection: "row",
    gap: 8,
  },
  scoreChoice: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: mobilePalette.softBorder,
    borderRadius: 10,
    backgroundColor: mobilePalette.surfaceWarm,
  },
  scoreChoiceSelected: {
    borderColor: mobilePalette.primary,
    backgroundColor: mobilePalette.primarySoft,
  },
  scoreChoiceText: {
    color: mobilePalette.primary,
    fontWeight: "900",
  },
  reasonChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reasonChoice: {
    borderWidth: 2,
    borderColor: mobilePalette.softBorder,
    borderRadius: 999,
    backgroundColor: mobilePalette.surfaceWarm,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  reasonChoiceSelected: {
    borderColor: mobilePalette.primary,
    backgroundColor: mobilePalette.primarySoft,
  },
  reasonChoiceText: {
    color: mobilePalette.text,
    fontWeight: "800",
  },
  noteInput: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top",
  },
});
