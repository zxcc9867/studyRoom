import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
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
import { getDateKey, getStudyDateKey } from "../../packages/core/src/index.mjs";
import * as WebBrowser from "expo-web-browser";
import { completeMobileOAuthCallback, signInWithMobileGoogle } from "./src/mobileOAuth";

import { registerExpoPushTarget } from "./src/notifications";
import {
  connectStudyFocus,
  disconnectStudyFocus,
  getLocalFocusStatus,
  openFocusPolicySettings,
  reconcileStudyFocus,
  type FocusSnapshot,
} from "./src/focus";
import { supabase } from "./src/supabase";
import { WebFeatureScreen } from "./src/WebFeatureScreen";
import { FocusStatusPanel } from "./src/FocusStatusPanel";
import { AppUpdatePanel } from "./src/AppUpdatePanel";
import { useAppUpdate, type InstallGate } from "./src/useAppUpdate";
import type { FocusAction, LocalFocusStatus } from "./src/focusStatus";

const retryCooldownMs = 15 * 60 * 1000;
const emailOtpLength = 8;
WebBrowser.maybeCompleteAuthSession();

const mobilePalette = {
  canvas: "#f3f4ed",
  surface: "#fffdf5",
  surfaceWarm: "#edf3ea",
  primary: "#2f6b52",
  primarySoft: "#edf3ea",
  border: "#d7ddd2",
  gold: "#fff1d3",
  goldDark: "#805b20",
  coral: "#9a3f33",
  text: "#28372e",
  muted: "#4e5b50",
  softBorder: "#d7ddd2",
} as const;

function readLocalFocusStatus(): LocalFocusStatus | null {
  try { return getLocalFocusStatus(); }
  catch { return null; }
}

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
  local_date: string;
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

type RecoveryRequest = {
  id: string;
  local_date: string;
  covered_start_date: string | null;
  covered_end_date: string | null;
  covered_missed_days: number | null;
  trigger_type: string;
  status: "pending";
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
  const [focusSnapshot, setFocusSnapshot] = useState<FocusSnapshot | null>(null);
  const [focusError, setFocusError] = useState("");
  const [pendingRecoveryRequests, setPendingRecoveryRequests] = useState<RecoveryRequest[]>([]);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryReason, setRecoveryReason] = useState("");
  const [recoveryMakeupTitle, setRecoveryMakeupTitle] = useState("");
  const [recoveryPledge, setRecoveryPledge] = useState("");
  const [resumeStartAfterRecovery, setResumeStartAfterRecovery] = useState(false);
  const dismissedRecoveryIdRef = useRef<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const googleBusyRef = useRef(false);
  const [webFallback, setWebFallback] = useState(false);
  const [focusAction, setFocusAction] = useState<FocusAction>(null);
  const [localFocusStatus, setLocalFocusStatus] = useState<LocalFocusStatus | null>(readLocalFocusStatus);
  const [focusSettingsOpen, setFocusSettingsOpen] = useState(false);
  const focusOwnerRef = useRef(session?.user.id ?? null);
  focusOwnerRef.current = session?.user.id ?? null;
  const focusOperationRef = useRef<{
    running: boolean;
    pendingRefresh: boolean;
    pendingLogout: { userId: string; run: () => Promise<void> } | null;
    sequence: number;
  }>({ running: false, pendingRefresh: false, pendingLogout: null, sequence: 0 });
  const updateOwnerRef = useRef({ owner: session?.user.id ?? null, revision: 0 });
  const updateOwner = session?.user.id ?? null;
  if (updateOwnerRef.current.owner !== updateOwner) {
    updateOwnerRef.current = { owner: updateOwner, revision: updateOwnerRef.current.revision + 1 };
  }
  const appUpdate = useAppUpdate(beforeInstallUpdate);

  async function beforeInstallUpdate(): Promise<InstallGate> {
    const { owner, revision } = updateOwnerRef.current;
    if (!owner) return "allowed";
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Dedicated read only: bulk refresh also invokes unrelated RPCs and must not gate installation.
      const result = await Promise.race([
        supabase.from("study_sessions").select("id,status,paused_at,lease_expires_at")
          .eq("user_id", owner).eq("status", "active"),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("STUDY_STATE_TIMEOUT")), 12000); }),
      ]);
      if (owner !== updateOwnerRef.current.owner || revision !== updateOwnerRef.current.revision || result.error || !Array.isArray(result.data)) return "unknown";
      if (result.data.some(row => row.status !== "active" || !(row.paused_at === null || typeof row.paused_at === "string" && Number.isFinite(Date.parse(row.paused_at))))) return "unknown";
      // An expired or legacy lease is not permission to interrupt a still-active server session.
      return result.data.some(row => row.paused_at === null) ? "studying" : "allowed";
    } catch { return "unknown"; }
    finally { if (timer !== undefined) clearTimeout(timer); }
  }

  async function loginWithGoogle() {
    if (googleBusyRef.current || busy) return;
    googleBusyRef.current = true;
    setGoogleBusy(true);
    try {
      await signInWithMobileGoogle(supabase, WebBrowser.openAuthSessionAsync, process.env.EXPO_PUBLIC_SUPABASE_URL!);
    } catch (error) {
      Alert.alert("Google 로그인 실패", formatError(error));
    } finally {
      googleBusyRef.current = false;
      setGoogleBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl?.startsWith("studyroom://auth/callback")) {
            await completeMobileOAuthCallback(supabase, initialUrl);
            const restored = await supabase.auth.getSession();
            if (!cancelled) setSession(restored.data.session);
          } else if (!cancelled) setSession(null);
        } else if (!cancelled) setSession(data.session);
      } catch (error) {
        if (!cancelled) Alert.alert("세션 확인 실패", formatError(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restoreSession();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const owner = nextSession?.user.id ?? null;
      if (updateOwnerRef.current.owner !== owner) updateOwnerRef.current = { owner, revision: updateOwnerRef.current.revision + 1 };
      setSession(nextSession);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setWebFallback(false);
    setFocusSettingsOpen(false);
    setFocusAction(null);
    if (session?.user.id) {
      setFocusSnapshot(null);
      setFocusError("");
      void refreshData(session.user.id);
      void refreshFocus(session.user.id);
    } else {
      setFocusSnapshot(null);
      setFocusError("");
      setPendingRecoveryRequests([]);
      setRecoveryOpen(false);
      setResumeStartAfterRecovery(false);
      dismissedRecoveryIdRef.current = null;
    }
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id || !focusSnapshot?.device_connected) return;
    const userId = session.user.id;
    // Foreground-only, bounded status checks; no background polling or new push registration.
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refreshFocus(userId);
    }, 60_000);
    return () => clearInterval(timer);
  }, [session?.user.id, focusSnapshot?.device_connected]);

  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active" && session?.user.id) {
        void refreshFocus(session.user.id);
        void refreshData(session.user.id);
      }
    });
    return () => listener.remove();
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
  const refreshedStudyDayRef = useRef<string | null>(null);
  const todayDateKey = useMemo(
    () => activeSession?.local_date ?? getStudyDateKey(new Date(nowMs), profile?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone),
    [activeSession?.local_date, nowMs, profile?.time_zone],
  );
  useEffect(() => {
    if (!session?.user.id) { refreshedStudyDayRef.current = null; return; }
    const key = `${session.user.id}:${todayDateKey}`;
    const previous = refreshedStudyDayRef.current;
    refreshedStudyDayRef.current = key;
    if (previous !== null && previous !== key) void refreshData(session.user.id);
  }, [session?.user.id, todayDateKey]);
  const todayTodos = useMemo(
    () => studyTodos.filter((todo) => (todo.local_date === todayDateKey || todo.local_date === getDateKey(new Date(nowMs), profile?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)) && !todo.is_completed),
    [studyTodos, todayDateKey, nowMs, profile?.time_zone],
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
  const activeStudySeconds = getActiveStudySeconds(activeSession, nowMs);
  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - nowMs) / 1000));

  async function runFocusAction(userId: string, action: Exclude<FocusAction, null>, operation: () => Promise<FocusSnapshot | null>) {
    if (focusOwnerRef.current !== userId) return;
    const state = focusOperationRef.current;
    if (state.running) {
      if (action === "checking") state.pendingRefresh = true;
      return;
    }
    state.running = true;
    const sequence = ++state.sequence;
    setFocusAction(action);
    setFocusError("");
    try {
      const snapshot = await operation();
      if (focusOwnerRef.current === userId && state.sequence === sequence) {
        setFocusSnapshot(snapshot);
        setLocalFocusStatus(getLocalFocusStatus());
      }
    } catch (error) {
      if (focusOwnerRef.current === userId && state.sequence === sequence) {
        setFocusError(formatError(error));
        try { setLocalFocusStatus(getLocalFocusStatus()); } catch { setLocalFocusStatus(null); }
      }
    } finally {
      state.running = false;
      if (focusOwnerRef.current === userId) setFocusAction(null);
      const pendingLogout = state.pendingLogout;
      state.pendingLogout = null;
      const pending = state.pendingRefresh;
      state.pendingRefresh = false;
      if (pendingLogout && pendingLogout.userId === focusOwnerRef.current) void pendingLogout.run();
      else if (pending && focusOwnerRef.current) void refreshFocus(focusOwnerRef.current);
    }
  }

  async function refreshFocus(userId: string) {
    await runFocusAction(userId, "checking", () => reconcileStudyFocus(userId));
  }

  async function signalFocusChange(userId: string) {
    try {
      const { error } = await supabase.functions.invoke("focus-sync", { body: {} });
      if (error) throw error;
      await refreshFocus(userId);
    } catch (error) {
      if (focusOwnerRef.current === userId) setFocusError(`휴대폰 집중 모드 동기화를 확인하지 못했습니다: ${formatError(error)}`);
    }
  }

  async function connectFocus() {
    if (!session?.user.id) return;
    await runFocusAction(session.user.id, "connecting", async () => {
      const status = getLocalFocusStatus();
      setLocalFocusStatus(status);
      if (!status.supported) throw new Error("Android 15 이상에서 지원합니다.");
      if (!status.hasAccess) {
        openFocusPolicySettings();
        throw new Error("Android 설정에서 독서실의 방해금지 접근을 허용한 뒤 연결 버튼을 다시 눌러 주세요.");
      }
      return connectStudyFocus(session.user.id);
    });
  }

  async function disconnectFocus() {
    if (!session?.user.id) return;
    await runFocusAction(session.user.id, "disconnecting", async () => {
      await disconnectStudyFocus(session.user.id);
      return null;
    });
  }

  function openAndroidFocusSettings() {
    try { openFocusPolicySettings(); }
    catch (error) { setFocusError(`Android 방해금지 설정을 열지 못했습니다: ${formatError(error)}`); }
  }

  async function logout() {
    const userId = session?.user.id;
    if (!userId) {
      await supabase.auth.signOut();
      return;
    }
    if (focusOwnerRef.current !== userId) return;
    const state = focusOperationRef.current;
    if (state.running) {
      state.pendingLogout = { userId, run: logout };
      return;
    }
    await runFocusAction(userId, "disconnecting", async () => {
      try { await disconnectStudyFocus(userId); }
      catch (error) { Alert.alert("집중 모드 해제 확인 필요", formatError(error)); }
      if (focusOwnerRef.current === userId) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        state.pendingRefresh = false;
      }
      return null;
    });
  }

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
      Alert.alert("코드를 보냈습니다", `이메일로 받은 ${emailOtpLength}자리 코드를 입력하세요.`);
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
    if (!nextEmail || token.length !== emailOtpLength || !/^\d+$/.test(token)) {
      Alert.alert("입력 확인", `이메일과 ${emailOtpLength}자리 숫자 코드를 확인하세요.`);
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
      const sessionsResult = await supabase.from("study_sessions").select("*").eq("user_id", userId)
        .order("started_at", { ascending: false }).limit(20);
      if (sessionsResult.error) throw sessionsResult.error;
      const localDate = (sessionsResult.data as StudySession[] | null)?.find(item => item.status === "active")?.local_date
        ?? getStudyDateKey(new Date(), resolvedTimeZone);
      const calendarDate = getDateKey(new Date(), resolvedTimeZone);
      const [attendanceResult, todosResult, sessionTodoResult, studySummaryResult, recoveryResult] = await Promise.all([
        supabase
          .from("attendance_days")
          .select("*")
          .eq("user_id", userId)
          .eq("local_date", localDate)
          .maybeSingle(),
        supabase
          .from("study_todos")
          .select("id,user_id,local_date,title,is_completed,position")
          .eq("user_id", userId)
          .in("local_date", [...new Set([localDate, calendarDate])])
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
        supabase
          .from("study_recovery_requests")
          .select("id,local_date,covered_start_date,covered_end_date,covered_missed_days,trigger_type,status")
          .eq("user_id", userId)
          .eq("status", "pending")
          .order("local_date", { ascending: true }),
      ]);
      const queryError = attendanceResult.error
        ?? sessionsResult.error
        ?? todosResult.error
        ?? sessionTodoResult.error
        ?? studySummaryResult.error
        ?? recoveryResult.error;
      if (queryError) throw queryError;

      if (profileData) {
        setProfile(profileData as Profile);
        setReminderTime(profileData.reminder_time.slice(0, 5));
      }
      setAttendance((attendanceResult.data ?? null) as AttendanceDay | null);
      setSessions((sessionsResult.data ?? []) as StudySession[]);
      setStudySessionTodoLinks((sessionTodoResult.data ?? []) as StudySessionTodoLink[]);
      const nextRecovery = (recoveryResult.data ?? []) as RecoveryRequest[];
      setPendingRecoveryRequests(nextRecovery);
      if (nextRecovery[0] && nextRecovery[0].id !== dismissedRecoveryIdRef.current) {
        setRecoveryOpen(true);
      }
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
          local_date: getDateKey(new Date(), profile?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone),
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
      const { data: recoveryData, error: recoveryError } = await supabase
        .from("study_recovery_requests")
        .select("id,local_date,covered_start_date,covered_end_date,covered_missed_days,trigger_type,status")
        .eq("user_id", session.user.id)
        .eq("status", "pending")
        .order("local_date", { ascending: true });
      if (recoveryError) throw recoveryError;
      if (recoveryData?.length) {
        setPendingRecoveryRequests(recoveryData as RecoveryRequest[]);
        setResumeStartAfterRecovery(true);
        dismissedRecoveryIdRef.current = null;
        setRecoveryOpen(true);
        return;
      }
      const { error } = await supabase.rpc("start_study_session", {
        p_todo_ids: selectedSessionTodoIds,
      });
      if (error) throw error;
      await refreshData(session.user.id);
      void signalFocusChange(session.user.id);
    } catch (error) {
      if (formatError(error).includes("Recovery routine required")) {
        const { data: recoveryData, error: reloadError } = await supabase
          .from("study_recovery_requests")
          .select("id,local_date,covered_start_date,covered_end_date,covered_missed_days,trigger_type,status")
          .eq("user_id", session.user.id)
          .eq("status", "pending")
          .order("local_date", { ascending: true });
        if (!reloadError && recoveryData?.length) {
          setPendingRecoveryRequests(recoveryData as RecoveryRequest[]);
          setResumeStartAfterRecovery(true);
          dismissedRecoveryIdRef.current = null;
          setRecoveryOpen(true);
        } else {
          Alert.alert("회복 루틴 확인 필요", "서버에서 회복 루틴을 요청했습니다. 잠시 후 다시 확인해 주세요.");
        }
      } else {
        Alert.alert("시작 실패", formatError(error));
      }
    } finally {
      setBusy(false);
    }
  }

  function closeRecoveryRoutine() {
    dismissedRecoveryIdRef.current = pendingRecoveryRequests[0]?.id ?? null;
    setResumeStartAfterRecovery(false);
    setRecoveryOpen(false);
  }

  async function submitRecoveryRoutine() {
    const request = pendingRecoveryRequests[0];
    if (!session?.user.id || !request) return;
    const reason = recoveryReason.trim();
    const makeupTitle = recoveryMakeupTitle.trim();
    const pledge = recoveryPledge.trim();
    if (!reason || !makeupTitle || !pledge) {
      Alert.alert("입력 확인", "사유, 오늘 보충 과제, 내일 재도전 약속을 모두 입력해 주세요.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.rpc("submit_study_recovery_request", {
        p_request_id: request.id,
        p_reason: reason,
        p_makeup_todo_title: makeupTitle,
        p_pledge_todo_title: pledge,
      });
      if (error) throw error;
      const { data: nextRequests, error: reloadError } = await supabase
        .from("study_recovery_requests")
        .select("id,local_date,covered_start_date,covered_end_date,covered_missed_days,trigger_type,status")
        .eq("user_id", session.user.id)
        .eq("status", "pending")
        .order("local_date", { ascending: true });
      if (reloadError) throw reloadError;
      setPendingRecoveryRequests((nextRequests ?? []) as RecoveryRequest[]);
      dismissedRecoveryIdRef.current = null;
      setRecoveryReason("");
      setRecoveryMakeupTitle("");
      setRecoveryPledge("");
      if (!nextRequests?.length) {
        setRecoveryOpen(false);
        if (resumeStartAfterRecovery) {
          setResumeStartAfterRecovery(false);
          await startTimer();
        }
      }
    } catch (error) {
      Alert.alert("회복 루틴 저장 확인 필요", formatError(error));
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
      void signalFocusChange(session.user.id);
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
      void signalFocusChange(session.user.id);
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
      void signalFocusChange(session.user.id);
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
      void signalFocusChange(session.user.id);
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
        <AppUpdatePanel palette={mobilePalette} beforeInstall={beforeInstallUpdate} controller={appUpdate} />
        <ActivityIndicator color={mobilePalette.primary} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={mobilePalette.canvas} />
        <AppUpdatePanel palette={mobilePalette} beforeInstall={beforeInstallUpdate} controller={appUpdate} />
        <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
        <View style={styles.loginPanel}>
          <Text style={styles.kicker}>STUDY ROOM</Text>
          <Text style={styles.title}>독서실에 로그인</Text>
          <Text style={styles.copy}>
            웹에서 쓰던 같은 Google 계정 또는 이메일로 로그인하세요. 공부 기록과 기술 피드가 함께 연결됩니다.
          </Text>
          <Pressable accessibilityRole="button" style={[styles.secondaryButton, (busy || googleBusy) && styles.disabledButton]} onPress={() => void loginWithGoogle()} disabled={busy || googleBusy} accessibilityState={{ disabled: busy || googleBusy, busy: googleBusy }}>
            <Text style={[styles.secondaryButtonText, (busy || googleBusy) && styles.disabledButtonText]}>{googleBusy ? "Google 로그인 연결 중…" : "Google로 계속하기"}</Text>
          </Pressable>
          <Text style={styles.copy}>또는 이메일로 {emailOtpLength}자리 코드 받기</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="email@example.com"
            accessibilityLabel="이메일"
            placeholderTextColor={mobilePalette.muted}
            style={styles.input}
          />
          {codeSent && (
            <TextInput
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, emailOtpLength))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              placeholder="12345678"
              accessibilityLabel="8자리 인증 코드"
              placeholderTextColor={mobilePalette.muted}
              style={styles.input}
            />
          )}
          <Pressable accessibilityRole="button" style={[styles.primaryButton, (busy || googleBusy) && styles.disabledButton]} onPress={requestCode} disabled={busy || googleBusy} accessibilityState={{ disabled: busy || googleBusy, busy }}>
            <Text style={[styles.primaryButtonText, (busy || googleBusy) && styles.disabledButtonText]}>
              {busy ? "전송 중..." : resendSeconds > 0 ? `${resendSeconds}초 후 재전송` : codeSent ? "코드 다시 받기" : "코드 받기"}
            </Text>
          </Pressable>
          {codeSent && (
            <Pressable accessibilityRole="button" style={[styles.secondaryButton, (busy || googleBusy) && styles.disabledButton]} onPress={verifyCode} disabled={busy || googleBusy} accessibilityState={{ disabled: busy || googleBusy }}>
              <Text style={[styles.secondaryButtonText, (busy || googleBusy) && styles.disabledButtonText]}>코드로 로그인</Text>
            </Pressable>
          )}
        </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!webFallback) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={mobilePalette.canvas} />
        <AppUpdatePanel palette={mobilePalette} beforeInstall={beforeInstallUpdate} controller={appUpdate} />
        <FocusStatusPanel snapshot={focusSnapshot} local={localFocusStatus} error={focusError} action={focusAction}
          paused={activeSessionPaused} nowMs={nowMs} palette={mobilePalette} settingsOpen={focusSettingsOpen}
          onOpenSettings={() => setFocusSettingsOpen(true)} onCloseSettings={() => setFocusSettingsOpen(false)}
          onConnect={() => void connectFocus()} onCheck={() => void refreshFocus(session.user.id)}
          onDisconnect={() => void disconnectFocus()} onPolicySettings={openAndroidFocusSettings} onLogout={() => void logout()} />
        <WebFeatureScreen
          key={session.user.id}
          sessionUserId={session.user.id}
          onStudyStateChanged={() => {
            void refreshData(session.user.id);
            void refreshFocus(session.user.id);
          }}
          onNativeSignOut={() => { void logout(); }}
          onFallback={() => {
            setWebFallback(true);
            void refreshData(session.user.id);
            void refreshFocus(session.user.id);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={mobilePalette.canvas} />
      <AppUpdatePanel palette={mobilePalette} beforeInstall={beforeInstallUpdate} controller={appUpdate} />
      <View style={styles.webNativeBar}>
        <Text style={styles.webNativeStatus}>네이티브 공부방 · 웹 화면을 열 수 없을 때 사용</Text>
        <Pressable accessibilityRole="button" style={styles.webNativeAction} onPress={() => setWebFallback(false)}>
          <Text style={styles.webNativeActionText}>웹 화면 다시 열기</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>study room</Text>
            <Text style={styles.title}>강제 출석 독서실</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(focusAction) }} disabled={Boolean(focusAction)} onPress={() => void logout()} style={styles.ghostButton}>
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
            <Text style={styles.metricValue}>{formatTimerClock(activeStudySeconds)}</Text>
            <Text style={styles.metricLabel}>현재 세션 공부 · {activeSessionPaused ? "휴식 중" : activeSession ? "진행 중" : "대기"}</Text>
          </View>
        </View>

        <FocusStatusPanel snapshot={focusSnapshot} local={localFocusStatus} error={focusError} action={focusAction}
          paused={activeSessionPaused} nowMs={nowMs} palette={mobilePalette} settingsOpen={focusSettingsOpen}
          onOpenSettings={() => setFocusSettingsOpen(true)} onCloseSettings={() => setFocusSettingsOpen(false)}
          onConnect={() => void connectFocus()} onCheck={() => void refreshFocus(session.user.id)}
          onDisconnect={() => void disconnectFocus()} onPolicySettings={openAndroidFocusSettings} onLogout={() => void logout()} />

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
              <Text style={[styles.quickTodoButtonText, activeSession && styles.disabledButtonText]}>추가</Text>
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
            <Text style={[activeSession && !activeSessionPaused ? styles.breakButtonText : styles.primaryButtonText, !activeSession && selectedSessionTodoIds.length === 0 && styles.disabledButtonText]}>
              {!activeSession ? "입장하고 타이머 시작" : activeSessionPaused ? "공부 계속하기" : "잠시 쉬기"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.dangerButton, !activeSession ? styles.disabledButton : null]}
            onPress={openReflection}
            disabled={busy || !activeSession}
          >
            <Text style={[styles.dangerButtonText, !activeSession && styles.disabledButtonText]}>퇴실하고 종료</Text>
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
              <Text style={styles.sectionTitle}>세션 유지 시간</Text>
              <Text style={styles.copy}>남은 시간 {formatSeconds(leaseRemainingSeconds)} · 누를 때마다 1시간 연장 · 현재 시각 기준 최대 2시간</Text>
            </View>
            <Pressable style={styles.secondaryButton} onPress={extendSessionLease} disabled={busy}>
              <Text style={styles.secondaryButtonText}>+1시간 연장</Text>
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
      <Modal visible={recoveryOpen} transparent animationType="fade" onRequestClose={closeRecoveryRoutine}>
        <View style={styles.modalBackdrop}>
          <View style={styles.reflectionModal}>
            <ScrollView contentContainerStyle={styles.reflectionContent}>
              <Text style={styles.sectionTitle}>회복 루틴</Text>
              <Text style={styles.copy}>
                {pendingRecoveryRequests[0]?.covered_missed_days && pendingRecoveryRequests[0].covered_missed_days > 1
                  ? `${pendingRecoveryRequests[0].covered_start_date}~${pendingRecoveryRequests[0].covered_end_date} 누적 ${pendingRecoveryRequests[0].covered_missed_days}일`
                  : pendingRecoveryRequests[0]?.local_date}{" "}
                미제출 회복 루틴을 작성해야 공부를 시작할 수 있어요.
              </Text>
              <Text style={styles.fieldLabel}>결석/이탈 사유</Text>
              <TextInput value={recoveryReason} onChangeText={setRecoveryReason} placeholder="결석/이탈 사유" placeholderTextColor={mobilePalette.muted} maxLength={400} multiline style={styles.input} />
              <Text style={styles.fieldLabel}>오늘 보충 과제</Text>
              <TextInput value={recoveryMakeupTitle} onChangeText={setRecoveryMakeupTitle} placeholder="오늘 보충 과제" placeholderTextColor={mobilePalette.muted} maxLength={120} style={styles.input} />
              <Text style={styles.fieldLabel}>내일 재도전 약속</Text>
              <TextInput value={recoveryPledge} onChangeText={setRecoveryPledge} placeholder="내일 재도전 약속" placeholderTextColor={mobilePalette.muted} maxLength={120} style={styles.input} />
              <Pressable style={styles.primaryButton} onPress={submitRecoveryRoutine} disabled={busy}>
                <Text style={styles.primaryButtonText}>제출하고 {resumeStartAfterRecovery ? "시작" : "잠금 해제"}</Text>
              </Pressable>
            </ScrollView>
            <Pressable style={styles.secondaryButton} onPress={closeRecoveryRoutine} disabled={busy}>
              <Text style={styles.secondaryButtonText}>나중에</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return typeof error === "string" ? error : "오류 내용을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
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

function getActiveStudySeconds(studySession: StudySession | null, nowMs: number) {
  if (!studySession || !Number.isFinite(nowMs)) return 0;
  const startedAtMs = Date.parse(studySession.started_at);
  if (!Number.isFinite(startedAtMs)) return 0;
  const leaseDeadlineMs = studySession.lease_expires_at ? Date.parse(studySession.lease_expires_at) : NaN;
  const clockNowMs = Number.isFinite(leaseDeadlineMs) ? Math.min(nowMs, leaseDeadlineMs) : nowMs;
  const elapsedSeconds = Math.max(0, Math.floor((clockNowMs - startedAtMs) / 1000));
  const pastBreakSeconds = Math.max(0, Math.floor(Number(studySession.paused_seconds) || 0));
  return Math.max(0, elapsedSeconds - pastBreakSeconds - getCurrentBreakSeconds(studySession.paused_at, clockNowMs));
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
  webNativeBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: mobilePalette.surface,
    borderBottomWidth: 1,
    borderBottomColor: mobilePalette.border,
  },
  webNativeStatus: { width: "100%", color: mobilePalette.primary, fontSize: 14, fontWeight: "700" },
  webNativeAction: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: mobilePalette.border,
    paddingHorizontal: 12,
  },
  webNativeActionText: { color: mobilePalette.primary, fontWeight: "700", fontSize: 14 },
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
  loginContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  loginPanel: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: mobilePalette.border,
    borderRadius: 16,
    backgroundColor: mobilePalette.surface,
    padding: 24,
    gap: 18,
    shadowColor: mobilePalette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderWidth: 1,
    borderColor: mobilePalette.border,
    borderRadius: 16,
    backgroundColor: mobilePalette.surface,
    padding: 18,
    shadowColor: mobilePalette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  kicker: {
    color: mobilePalette.coral,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: mobilePalette.primary,
    fontSize: 30,
    lineHeight: 41,
    fontWeight: "700",
    letterSpacing: 0,
  },
  copy: {
    color: mobilePalette.muted,
    fontSize: 15,
    lineHeight: 25,
    fontWeight: "400",
  },
  focusError: {
    color: mobilePalette.coral,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  statusPanel: {
    borderWidth: 1,
    borderColor: mobilePalette.border,
    borderRadius: 16,
    backgroundColor: mobilePalette.surfaceWarm,
    padding: 20,
    gap: 9,
  },
  statusLabel: {
    color: mobilePalette.coral,
    fontSize: 14,
    fontWeight: "700",
  },
  statusValue: {
    color: mobilePalette.primary,
    fontSize: 42,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  metric: {
    flex: 1,
    minHeight: 108,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: mobilePalette.softBorder,
    borderRadius: 12,
    backgroundColor: mobilePalette.surface,
    padding: 16,
  },
  metricValue: {
    color: mobilePalette.primary,
    fontSize: 24,
    fontWeight: "700",
  },
  metricLabel: {
    color: mobilePalette.muted,
    marginTop: 6,
    fontWeight: "700",
  },
  todoPanel: {
    borderWidth: 1,
    borderColor: mobilePalette.border,
    borderRadius: 16,
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
    fontSize: 14,
    fontWeight: "700",
  },
  todoChoices: {
    gap: 8,
  },
  todoChoice: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
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
    borderWidth: 1,
    borderColor: mobilePalette.border,
    borderRadius: 7,
    backgroundColor: mobilePalette.surface,
  },
  todoCheckSelected: {
    backgroundColor: mobilePalette.primary,
  },
  todoCheckText: {
    color: mobilePalette.surface,
    fontWeight: "700",
  },
  todoChoiceText: {
    flex: 1,
    color: mobilePalette.text,
    fontSize: 15,
    fontWeight: "700",
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
    fontWeight: "700",
  },
  controls: {
    gap: 12,
  },
  settings: {
    borderWidth: 1,
    borderColor: mobilePalette.border,
    borderRadius: 16,
    backgroundColor: mobilePalette.surface,
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    color: mobilePalette.primary,
    fontSize: 20,
    fontWeight: "700",
  },
  input: {
    minHeight: 52,
    borderRadius: 10,
    borderColor: mobilePalette.softBorder,
    borderWidth: 1,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  primaryButtonText: {
    color: mobilePalette.surface,
    fontWeight: "700",
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  breakButtonText: {
    color: mobilePalette.text,
    fontWeight: "700",
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  dangerButtonText: {
    color: mobilePalette.surface,
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobilePalette.surface,
    borderWidth: 1,
    borderColor: mobilePalette.border,
    paddingHorizontal: 16,
    shadowColor: mobilePalette.goldDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  secondaryButtonText: {
    color: mobilePalette.primary,
    fontWeight: "700",
    fontSize: 15,
  },
  ghostButton: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: mobilePalette.border,
    borderRadius: 10,
    backgroundColor: mobilePalette.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ghostButtonText: {
    color: mobilePalette.primary,
    fontWeight: "700",
    fontSize: 15,
  },
  disabledButton: {
    opacity: 1,
    backgroundColor: "#e6ebe4",
  },
  disabledButtonText: {
    color: "#5e695f",
  },
  breakPanel: {
    borderWidth: 1,
    borderColor: mobilePalette.goldDark,
    borderRadius: 16,
    backgroundColor: mobilePalette.gold,
    padding: 18,
    gap: 6,
  },
  breakLabel: {
    color: mobilePalette.goldDark,
    fontSize: 14,
    fontWeight: "700",
  },
  breakValue: {
    color: mobilePalette.goldDark,
    fontSize: 24,
    fontWeight: "700",
  },
  leasePanel: {
    borderWidth: 1,
    borderColor: mobilePalette.goldDark,
    borderRadius: 16,
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
    borderWidth: 1,
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
    fontWeight: "700",
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
    borderWidth: 1,
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
    fontWeight: "700",
  },
  reasonChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reasonChoice: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
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
    fontWeight: "700",
  },
  noteInput: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top",
  },
});
