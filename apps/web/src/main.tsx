import { StrictMode, useEffect, useMemo, useState, type ClipboardEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Chrome,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  Play,
  Plus,
  Square,
  Trash2,
  X,
  Send,
  UserRound,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";

import { EMAIL_OTP_LENGTH, extractEmailOtpCandidate, isValidEmailOtp, sanitizeEmailOtp } from "./authCode.mjs";
import {
  MAX_AUTH_RETRY_COOLDOWN_MS,
  OTP_RETRY_COOLDOWN_MS,
  formatRetryWait,
  getAuthRetryCooldownMs,
  isEmailSendRateLimitError,
  isRateLimitError,
} from "./authLimits.mjs";
import {
  GOOGLE_PROVIDER,
  buildIdentityPayload,
  getAuthCodeFromUrl,
  getAuthErrorFromUrl,
  getAuthRedirectTo,
  getImplicitOAuthSessionFromUrl,
  getKakaoNotificationConnectOptions,
  isAuthCallbackUrl,
  type IdentityPayload,
} from "./authProviders.mjs";
import {
  KAKAO_CONNECT_PENDING_KEY,
  getKakaoNotificationStatus,
  saveKakaoProviderTokens,
  type KakaoNotificationStatus,
} from "./kakaoNotifications.mjs";
import { requestEndStudySessionOnExit } from "./sessionExit.mjs";
import { isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl } from "./supabase";
import {
  getTelegramNotificationStatus,
  isValidTelegramChatId,
  normalizeTelegramChatId,
  saveTelegramNotificationTarget,
  sendTelegramTestAlarm,
  type TelegramNotificationStatus,
} from "./telegramNotifications.mjs";
import {
  DEFAULT_TODO_HISTORY_PAGE_SIZE,
  calculateTodoHistoryStats,
  getCompletedTodoHistory,
  paginateTodoHistory,
} from "./todoHistory.mjs";
import { getWebPushStatus, registerWebPushTarget, showLocalTestNotification, type WebPushStatus } from "./webPush";
import "./styles.css";

const resendCooldownKey = "study-room-auth-resend-available-at";
const emailOtpLength = EMAIL_OTP_LENGTH;
const googleAuthEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === "true";
const defaultDailyGoalSeconds = 2 * 60 * 60;
const dashboardSections = ["today", "me", "settings"] as const;
type DashboardSection = (typeof dashboardSections)[number];

type Profile = {
  user_id: string;
  email: string | null;
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
};

type StudyTodo = {
  id: string;
  user_id: string;
  local_date: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
};

function App() {
  if (!isSupabaseConfigured) {
    return <SetupRequired />;
  }

  return <DashboardApp />;
}

function SetupRequired() {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <p className="eyebrow">local setup</p>
        <h1>Supabase 설정이 필요합니다</h1>
        <p className="login-copy">
          로컬 Vite 서버는 열려 있습니다. 앱을 사용하려면 <code>apps/web/.env.local</code>에 Supabase 값을
          넣어야 합니다.
        </p>
        <pre className="env-box">{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_WEB_PUSH_VAPID_PUBLIC_KEY=your-vapid-public-key`}</pre>
        <p className="message">현재 주소는 http://127.0.0.1:5177 입니다.</p>
      </section>
    </main>
  );
}

function DashboardApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attendanceDays, setAttendanceDays] = useState<AttendanceDay[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [studyTodos, setStudyTodos] = useState<StudyTodo[]>([]);
  const [reminderTime, setReminderTime] = useState("21:00");
  const [selectedTodoDate, setSelectedTodoDate] = useState(() => getPlainDateKey(new Date()));
  const [todoDraft, setTodoDraft] = useState("");
  const [todoModalOpen, setTodoModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [todoBusy, setTodoBusy] = useState(false);
  const [webPushStatus, setWebPushStatus] = useState<WebPushStatus | null>(null);
  const [kakaoStatus, setKakaoStatus] = useState<KakaoNotificationStatus | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramNotificationStatus | null>(null);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [reminderPopup, setReminderPopup] = useState<{ dateKey: string; reminderTime: string } | null>(null);
  const [activeSection, setActiveSection] = useState<DashboardSection>("today");
  const [calendarMonth, setCalendarMonth] = useState(() => getMonthKey(new Date()));
  const [todoHistoryPage, setTodoHistoryPage] = useState(1);

  useEffect(() => {
    async function initializeSession() {
      if (isAuthCallbackUrl(window.location.href)) {
        await finishOAuthCallback();
        return;
      }

      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    }

    void initializeSession();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        void maybeSaveKakaoProviderTokens(nextSession);
      }
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => setNowMs(Date.now()), 1000);
    const currentTime = Date.now();
    const storedResendAt = Number(window.localStorage.getItem(resendCooldownKey) ?? 0);
    if (storedResendAt > currentTime) {
      updateResendAvailableAt(Math.min(storedResendAt, currentTime + MAX_AUTH_RETRY_COOLDOWN_MS));
    } else {
      window.localStorage.removeItem(resendCooldownKey);
    }
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (session?.user.id) {
      void syncSignedInUser(session);
      void loadDashboard(session.user.id);
      void refreshWebPushStatus();
      void refreshKakaoStatus(session);
      void refreshTelegramStatus(session.user.id);
    }
  }, [session?.user.id]);

  useEffect(() => {
    if (!session) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visibleEntry?.target.id && isDashboardSection(visibleEntry.target.id)) {
          setActiveSection(visibleEntry.target.id);
        }
      },
      {
        rootMargin: "-24% 0px -58% 0px",
        threshold: [0.1, 0.35, 0.6],
      },
    );

    dashboardSections.forEach((sectionId) => {
      const element = document.getElementById(sectionId);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [session]);

  const timeZone = profile?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const activeSession = studySessions.find((item) => item.status === "active") ?? null;
  const activeElapsedSeconds = activeSession
    ? Math.max(0, Math.floor((nowMs - new Date(activeSession.started_at).getTime()) / 1000))
    : 0;
  const todayDateKey = getLocalDateKey(new Date(nowMs), timeZone);
  const todayCompletedSeconds = studySessions
    .filter((item) => item.local_date === todayDateKey && item.status !== "active")
    .reduce((sum, item) => sum + item.duration_seconds, 0);
  const todaySeconds = todayCompletedSeconds + (activeSession ? activeElapsedSeconds : 0);
  const monthCompletedSeconds = studySessions
    .filter((item) => item.local_date.startsWith(calendarMonth) && item.status !== "active")
    .reduce((sum, item) => sum + item.duration_seconds, 0);
  const monthSeconds =
    monthCompletedSeconds +
    (activeSession?.local_date.startsWith(calendarMonth) ? activeElapsedSeconds : 0);
  const todayProgress = Math.min(100, Math.round((todaySeconds / defaultDailyGoalSeconds) * 100));
  const todayTodos = useMemo(
    () => studyTodos.filter((todo) => todo.local_date === todayDateKey),
    [studyTodos, todayDateKey],
  );
  const selectedDateTodos = useMemo(
    () => studyTodos.filter((todo) => todo.local_date === selectedTodoDate),
    [studyTodos, selectedTodoDate],
  );
  const reminderTodos = useMemo(
    () => (reminderPopup ? studyTodos.filter((todo) => todo.local_date === reminderPopup.dateKey) : []),
    [studyTodos, reminderPopup?.dateKey],
  );
  const todayTodoStats = useMemo(() => calculateTodoStats(todayTodos), [todayTodos]);
  const selectedTodoStats = useMemo(() => calculateTodoStats(selectedDateTodos), [selectedDateTodos]);
  const todoCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    studyTodos.forEach((todo) => counts.set(todo.local_date, (counts.get(todo.local_date) ?? 0) + 1));
    return counts;
  }, [studyTodos]);
  const completedTodoHistory = useMemo(() => getCompletedTodoHistory(studyTodos), [studyTodos]);
  const todoHistoryStats = useMemo(
    () => calculateTodoHistoryStats(studyTodos, calendarMonth),
    [studyTodos, calendarMonth],
  );
  const todoHistoryPageData = useMemo(
    () => paginateTodoHistory(completedTodoHistory, todoHistoryPage, DEFAULT_TODO_HISTORY_PAGE_SIZE),
    [completedTodoHistory, todoHistoryPage],
  );
  const streak = useMemo(() => calculateStreak(attendanceDays), [attendanceDays]);

  useEffect(() => {
    if (todoHistoryPage !== todoHistoryPageData.currentPage) {
      setTodoHistoryPage(todoHistoryPageData.currentPage);
    }
  }, [todoHistoryPage, todoHistoryPageData.currentPage]);

  useEffect(() => {
    if (!session?.user.id || !profile) return;

    const configuredReminderTime = (profile.reminder_time ?? reminderTime).slice(0, 5);
    const now = new Date(nowMs);
    const currentTime = getLocalHourMinute(now, timeZone);
    if (currentTime !== configuredReminderTime) return;

    const todayAttendance = attendanceDays.find((day) => day.local_date === todayDateKey);
    if (todayAttendance?.status === "present" || todayAttendance?.status === "missed") return;

    const popupKey = `study-room-reminder-popup:${session.user.id}:${todayDateKey}:${configuredReminderTime}`;
    if (window.localStorage.getItem(popupKey)) return;

    window.localStorage.setItem(popupKey, new Date(nowMs).toISOString());
    setReminderPopup({ dateKey: todayDateKey, reminderTime: configuredReminderTime });
  }, [attendanceDays, profile, reminderTime, nowMs, session?.user.id, timeZone, todayDateKey]);
  const attendanceCalendarDays = useMemo(
    () => buildAttendanceCalendar(calendarMonth, attendanceDays),
    [attendanceDays, calendarMonth],
  );
  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - nowMs) / 1000));

  useEffect(() => {
    const activeSessionId = activeSession?.id;
    const accessToken = session?.access_token;
    const userId = session?.user.id;
    if (!activeSessionId || !accessToken || !isSupabaseConfigured) {
      return;
    }

    let exitRequestSent = false;
    const sendExitRequest = () => {
      if (exitRequestSent) {
        return;
      }

      exitRequestSent = requestEndStudySessionOnExit({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        accessToken,
        sessionId: activeSessionId,
        fetch: window.fetch.bind(window),
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendExitRequest();
        return;
      }

      if (document.visibilityState === "visible" && exitRequestSent && userId) {
        void loadDashboard(userId);
      }
    };

    window.addEventListener("pagehide", sendExitRequest);
    window.addEventListener("beforeunload", sendExitRequest);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", sendExitRequest);
      window.removeEventListener("beforeunload", sendExitRequest);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeSession?.id, session?.access_token, session?.user.id]);

  async function requestCode() {
    const nextEmail = email.trim();
    if (!nextEmail) {
      setMessage("이메일을 입력하세요.");
      return;
    }
    if (resendSeconds > 0) {
      setMessage(`${formatRetryWait(resendAvailableAt - nowMs)} 후에 다시 코드를 요청할 수 있습니다.`);
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
        updateResendAvailableAt(Date.now() + getAuthRetryCooldownMs(error.message));
      }
      setMessage(formatAuthError(error.message));
      return;
    }

    setCodeSent(true);
    updateResendAvailableAt(Date.now() + OTP_RETRY_COOLDOWN_MS);
    setMessage(`이메일로 받은 ${emailOtpLength}자리 코드를 입력하세요.`);
  }

  function updateResendAvailableAt(value: number) {
    setResendAvailableAt(value);
    window.localStorage.setItem(resendCooldownKey, String(value));
  }

  async function finishOAuthCallback() {
    const providerError = getAuthErrorFromUrl(window.location.href);
    const code = getAuthCodeFromUrl(window.location.href);
    const implicitSession = getImplicitOAuthSessionFromUrl(window.location.href);

    window.history.replaceState({}, document.title, window.location.origin + "/");

    if (providerError) {
      setMessage(formatAuthError(providerError));
      return;
    }

    if (implicitSession) {
      setBusy(true);
      const { data, error } = await supabase.auth.setSession(implicitSession);
      setBusy(false);

      if (error) {
        setMessage(formatAuthError(error.message));
        return;
      }

      setCodeSent(false);
      setOtp("");
      setSession(data.session);
      if (!(await maybeSaveKakaoProviderTokens(data.session))) {
        setMessage("로그인되었습니다.");
      }
      return;
    }

    if (!code) {
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    setBusy(false);

    if (error) {
      setMessage(formatAuthError(error.message));
      return;
    }

    setCodeSent(false);
    setOtp("");
    setSession(data.session);
    if (!(await maybeSaveKakaoProviderTokens(data.session))) {
      setMessage("로그인되었습니다.");
    }
  }

  async function signInWithGoogle() {
    if (!googleAuthEnabled) {
      setMessage(
        "Google 로그인을 사용하려면 Supabase Auth에서 Google Provider를 켜고 Client ID/Secret을 등록한 뒤 VITE_GOOGLE_AUTH_ENABLED=true로 바꿔야 합니다.",
      );
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: GOOGLE_PROVIDER,
      options: {
        redirectTo: getAuthRedirectTo(window.location.origin),
      },
    });
    setBusy(false);

    if (error) {
      setMessage(formatAuthError(error.message));
    }
  }

  async function connectKakaoNotifications() {
    if (!session) return;

    window.localStorage.setItem(KAKAO_CONNECT_PENDING_KEY, "1");
    setBusy(true);
    const { error } = await supabase.auth.linkIdentity(getKakaoNotificationConnectOptions(window.location.origin));
    setBusy(false);

    if (error) {
      window.localStorage.removeItem(KAKAO_CONNECT_PENDING_KEY);
      setMessage(formatKakaoConnectionError(error));
    }
  }

  async function maybeSaveKakaoProviderTokens(nextSession: Session | null) {
    if (!nextSession?.provider_token || window.localStorage.getItem(KAKAO_CONNECT_PENDING_KEY) !== "1") {
      return false;
    }

    window.localStorage.removeItem(KAKAO_CONNECT_PENDING_KEY);
    setBusy(true);
    try {
      const nextStatus = await saveKakaoProviderTokens(nextSession);
      setKakaoStatus(nextStatus);
      setMessage("카카오톡 알림이 연결되었습니다.");
    } catch (error) {
      setMessage(`카카오톡 연결 실패: ${formatKakaoConnectionError(error)}`);
    } finally {
      setBusy(false);
    }

    return true;
  }

  async function syncSignedInUser(nextSession: Session) {
    const identity = buildIdentityPayload(nextSession.user) as IdentityPayload;
    const profilePayload: {
      user_id: string;
      email: string | null;
      display_name?: string | null;
    } = {
      user_id: identity.user_id,
      email: identity.email,
    };

    if (identity.display_name) {
      profilePayload.display_name = identity.display_name;
    }

    const [{ error: profileError }, { error: identityError }] = await Promise.all([
      supabase.from("profiles").upsert(profilePayload),
      supabase.from("user_identities").upsert(
        {
          ...identity,
          last_sign_in_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      ),
    ]);

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    if (identityError) {
      setMessage(identityError.message);
    }
  }

  async function verifyCode() {
    const nextEmail = email.trim();
    const token = sanitizeEmailOtp(otp);
    if (!nextEmail || !isValidEmailOtp(token)) {
      setMessage(`이메일과 ${emailOtpLength}자리 숫자 코드를 확인하세요.`);
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
      setMessage(formatAuthError(error.message));
      return;
    }

    setMessage("로그인되었습니다.");
  }

  function pasteOtpFromText(text: string) {
    const pastedOtp = extractEmailOtpCandidate(text);

    if (!pastedOtp) {
      return false;
    }

    setOtp(pastedOtp);
    setMessage(
      pastedOtp.length === emailOtpLength
        ? `${emailOtpLength}자리 인증코드를 붙여넣었습니다.`
        : `인증코드 ${pastedOtp.length}자리를 붙여넣었습니다.`,
    );
    return true;
  }

  function handleLoginPaste(event: ClipboardEvent<HTMLElement>) {
    if (!codeSent) {
      return;
    }

    const target = event.target;
    const isTextInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    const isOtpInput = target instanceof HTMLInputElement && target.autocomplete === "one-time-code";

    if (isTextInput && !isOtpInput) {
      return;
    }

    if (pasteOtpFromText(event.clipboardData.getData("text"))) {
      event.preventDefault();
    }
  }

  async function loadDashboard(userId: string) {
    setBusy(true);
    const [{ data: profileData }, { data: attendanceData }, { data: sessionData }, { data: todoData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("attendance_days")
        .select("*")
        .eq("user_id", userId)
        .order("local_date", { ascending: false })
        .limit(370),
      supabase
        .from("study_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(1000),
      supabase
        .from("study_todos")
        .select("*")
        .eq("user_id", userId)
        .order("local_date", { ascending: false })
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(500),
    ]);

    if (profileData) {
      setProfile(profileData);
      setReminderTime(profileData.reminder_time.slice(0, 5));
    }
    setAttendanceDays(attendanceData ?? []);
    setStudySessions(sessionData ?? []);
    setStudyTodos(todoData ?? []);
    setBusy(false);
  }

  function selectTodoDate(dateKey: string) {
    setSelectedTodoDate(dateKey);
    setCalendarMonth(dateKey.slice(0, 7));
    setTodoDraft("");
    setTodoModalOpen(true);
  }

  async function addTodo() {
    if (!session?.user.id) return;

    const title = todoDraft.trim();
    if (!title) {
      setMessage("할 일을 입력하세요.");
      return;
    }

    setTodoBusy(true);
    const { data, error } = await supabase
      .from("study_todos")
      .insert({
        user_id: session.user.id,
        local_date: selectedTodoDate,
        title,
        position: selectedDateTodos.length,
      })
      .select("*")
      .single();
    setTodoBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data) {
      setStudyTodos((current) => sortTodos([data as StudyTodo, ...current]));
    }
    setTodoDraft("");
    setTodoModalOpen(false);
    setMessage(`${formatTodoDate(selectedTodoDate)} 할 일을 저장했습니다.`);
  }

  async function toggleTodo(todo: StudyTodo) {
    setTodoBusy(true);
    const { error } = await supabase
      .from("study_todos")
      .update({ is_completed: !todo.is_completed })
      .eq("id", todo.id);
    setTodoBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setStudyTodos((current) =>
      current.map((item) =>
        item.id === todo.id ? { ...item, is_completed: !todo.is_completed } : item,
      ),
    );
  }

  async function deleteTodo(todoId: string) {
    setTodoBusy(true);
    const { error } = await supabase.from("study_todos").delete().eq("id", todoId);
    setTodoBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setStudyTodos((current) => current.filter((todo) => todo.id !== todoId));
  }

  async function saveNotificationSettings() {
    if (!session?.user.id) return;

    const nextTelegramChatId = normalizeTelegramChatId(telegramChatId);
    if (nextTelegramChatId && !isValidTelegramChatId(nextTelegramChatId)) {
      setMessage("Telegram Chat ID 형식을 확인하세요. 숫자 ID 또는 @channel_name 형식이어야 합니다.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      email: session.user.email ?? profile?.email ?? null,
      reminder_time: reminderTime,
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      email_reminders_enabled: profile?.email_reminders_enabled ?? true,
    });

    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }

    try {
      if (nextTelegramChatId) {
        setTelegramStatus(await saveTelegramNotificationTarget(session.user.id, nextTelegramChatId));
      }
      const nextStatus = await registerWebPushTarget(session.user.id);
      setWebPushStatus(nextStatus);
      await showLocalTestNotification();
      setMessage("알림 설정을 저장했고 컴퓨터 테스트 알림을 보냈습니다.");
    } catch (error) {
      setMessage(`알림 시간은 저장했습니다. ${formatNotificationError(error)}`);
    } finally {
      setBusy(false);
      await loadDashboard(session.user.id);
      await refreshWebPushStatus();
      await refreshTelegramStatus(session.user.id);
    }
  }

  async function sendTelegramTestNotification() {
    if (!session?.user.id) return;

    if (!telegramStatus?.connected) {
      setMessage("Telegram Chat ID를 저장한 뒤 테스트 알림을 보낼 수 있습니다.");
      return;
    }

    setBusy(true);
    try {
      const result = await sendTelegramTestAlarm(session);
      const todoMessage =
        result.todoCount > 0
          ? `오늘 할 일 ${result.todoCount}개를 포함해 Telegram 테스트 알림을 보냈습니다.`
          : "Telegram 테스트 알림을 보냈습니다. 오늘 할 일은 아직 없습니다.";
      setMessage(todoMessage);
      await loadDashboard(session.user.id);
    } catch (error) {
      setMessage(formatNotificationError(error));
    } finally {
      setBusy(false);
    }
  }

  async function startTimer() {
    setBusy(true);
    const { data, error } = await supabase.rpc("start_study_session");
    setBusy(false);
    if (error) {
      setMessage(error.message);
    } else if (session?.user.id) {
      if (data) {
        const startedSession = data as StudySession;
        setStudySessions((current) => [
          startedSession,
          ...current.filter((item) => item.id !== startedSession.id),
        ]);
        setNowMs(Date.now());
      }
      setMessage("집중 세션을 시작했습니다.");
      await loadDashboard(session.user.id);
    }
  }

  async function endTimer() {
    if (!activeSession) return;

    setBusy(true);
    const { error } = await supabase.rpc("end_study_session", { p_session_id: activeSession.id });
    setBusy(false);
    if (error) {
      setMessage(error.message);
    } else if (session?.user.id) {
      setMessage("집중 세션을 종료했습니다.");
      await loadDashboard(session.user.id);
    }
  }

  async function refreshWebPushStatus() {
    try {
      const nextStatus = await getWebPushStatus();
      setWebPushStatus(nextStatus);
    } catch (error) {
      setMessage(formatNotificationError(error));
    }
  }

  async function refreshKakaoStatus(nextSession: Session) {
    try {
      setKakaoStatus(await getKakaoNotificationStatus(nextSession));
    } catch {
      setKakaoStatus(null);
    }
  }

  async function refreshTelegramStatus(userId: string) {
    try {
      const nextStatus = await getTelegramNotificationStatus(userId);
      setTelegramStatus(nextStatus);
      if (nextStatus.chatId) {
        setTelegramChatId(nextStatus.chatId);
      }
    } catch {
      setTelegramStatus(null);
    }
  }

  function renderTodoList(todos: StudyTodo[], emptyText: string) {
    if (todos.length === 0) {
      return <p className="todo-empty">{emptyText}</p>;
    }

    return (
      <ul className="todo-list">
        {todos.map((todo) => (
          <li className={`todo-item ${todo.is_completed ? "todo-done" : ""}`} key={todo.id}>
            <label>
              <input
                type="checkbox"
                checked={todo.is_completed}
                disabled={todoBusy}
                onChange={() => void toggleTodo(todo)}
              />
              <span>{todo.title}</span>
            </label>
            <button
              className="todo-delete"
              type="button"
              aria-label={`${todo.title} 삭제`}
              disabled={todoBusy}
              onClick={() => void deleteTodo(todo.id)}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  function renderReminderTodoList(todos: StudyTodo[]) {
    if (todos.length === 0) {
      return null;
    }

    return (
      <div className="reminder-todos" aria-label="오늘 할 일 알림">
        <strong>오늘 할 일</strong>
        <ul>
          {todos.map((todo) => (
            <li className={todo.is_completed ? "todo-done" : ""} key={todo.id}>
              <span aria-hidden="true">{todo.is_completed ? "✓" : "□"}</span>
              <span>{todo.title}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function renderTodoHistory() {
    if (todoHistoryPageData.totalItems === 0) {
      return <p className="todo-empty">아직 완료한 할 일이 없습니다. 오늘 할 일을 하나 끝내면 여기에 기록됩니다.</p>;
    }

    return (
      <div className="todo-history">
        <ul className="todo-history-list">
          {todoHistoryPageData.items.map((todo) => (
            <li className="todo-history-item" key={todo.id}>
              <span className="todo-history-icon" aria-hidden="true">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <strong>{todo.title}</strong>
                <span>{formatTodoDate(todo.local_date)}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="pagination-controls" aria-label="완료한 일 페이지 이동">
          <button
            className="secondary"
            type="button"
            disabled={!todoHistoryPageData.hasPrevious}
            onClick={() => setTodoHistoryPage((current) => current - 1)}
          >
            <ChevronLeft size={18} />
            이전
          </button>
          <strong>
            {todoHistoryPageData.currentPage} / {todoHistoryPageData.totalPages}
          </strong>
          <button
            className="secondary"
            type="button"
            disabled={!todoHistoryPageData.hasNext}
            onClick={() => setTodoHistoryPage((current) => current + 1)}
          >
            다음
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <main className="login-shell">
        <section className="login-panel" onPaste={handleLoginPaste}>
          <p className="eyebrow">forced attendance</p>
          <h1>매일 같은 시간, 독서실 입장</h1>
          <p className="login-copy">
            이메일로 받은 8자리 코드를 입력하면 로그인됩니다. 알림 후 15분 안에 타이머를 시작해야 출석으로
            인정됩니다.
          </p>
          <div className="login-form">
            <button
              className={`google-login ${googleAuthEnabled ? "" : "google-login-pending"}`}
              onClick={signInWithGoogle}
              disabled={busy}
              type="button"
            >
              <Chrome size={18} />
              {googleAuthEnabled ? "Google로 로그인" : "Google 로그인 설정 필요"}
            </button>
            <div className="login-divider">
              <span>또는 이메일 코드</span>
            </div>
            <label>
              이메일
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@example.com"
                autoComplete="email"
              />
            </label>
            {codeSent && (
              <label>
                인증 코드
                  <input
                    value={otp}
                    onChange={(event) => setOtp(sanitizeEmailOtp(event.target.value))}
                    placeholder="00224379"
                  inputMode="numeric"
                  maxLength={emailOtpLength}
                  autoComplete="one-time-code"
                />
              </label>
            )}
            <div className="button-row">
              <button className="primary" onClick={requestCode} disabled={busy || resendSeconds > 0}>
                <Mail size={18} />
                {resendSeconds > 0 ? `${resendSeconds}초 대기` : codeSent ? "코드 다시 받기" : "코드 받기"}
              </button>
              {codeSent && (
                <button className="secondary" onClick={verifyCode} disabled={busy}>
                  <KeyRound size={18} />
                  코드로 로그인
                </button>
              )}
            </div>
          </div>
          {message && <p className="message">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">study room</p>
          <h1>강제 출석 독서실</h1>
        </div>
        <nav aria-label="대시보드 섹션">
          <a className={activeSection === "today" ? "active" : ""} href="#today">
            오늘
          </a>
          <a className={activeSection === "me" ? "active" : ""} href="#me">
            <UserRound size={17} />
            내 페이지
          </a>
          <a className={activeSection === "settings" ? "active" : ""} href="#settings">
            알림
          </a>
        </nav>
        <button className="plain" onClick={() => supabase.auth.signOut()}>
          <LogOut size={17} />
          로그아웃
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-head">
            <div>
              <p className="eyebrow">deadline rule</p>
              <h2>{profile?.reminder_time?.slice(0, 5) ?? reminderTime} 이후 15분 안에 출석</h2>
            </div>
            <div className="topbar-actions" aria-label="집중 세션 조작">
              <button className="primary" onClick={startTimer} disabled={busy || Boolean(activeSession)}>
                <Play size={18} />
                입장하고 시작
              </button>
              <button className="danger" onClick={endTimer} disabled={busy || !activeSession}>
                <Square size={18} />
                종료
              </button>
            </div>
          </div>
          <div className="study-summary" aria-label="공부 시간 요약">
            <div>
              <span>오늘 공부</span>
              <strong>{formatTimerClock(todaySeconds)}</strong>
            </div>
            <div>
              <span>{formatMonthLabel(calendarMonth)} 누적</span>
              <strong>{formatTimerClock(monthSeconds)}</strong>
            </div>
          </div>
        </header>

        {message && <p className="message">{message}</p>}

        <section id="today" className="history-panel">
          <div className="history-header">
            <div>
              <p className="eyebrow">attendance map</p>
              <h2>출석 캘린더</h2>
            </div>
            <div className="calendar-controls">
              <label>
                월 선택
                <input
                  type="month"
                  value={calendarMonth}
                  onChange={(event) => setCalendarMonth(event.target.value)}
                />
              </label>
              <strong>{streak}일 연속</strong>
            </div>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {["일", "월", "화", "수", "목", "금", "토"].map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className="attendance-calendar" aria-label="월별 출석 캘린더">
            {attendanceCalendarDays.map((day) => {
              const todoCount = todoCountsByDate.get(day.dateKey) ?? 0;
              return (
                <button
                  className={`calendar-day calendar-${day.status ?? "empty"} ${
                    day.inMonth ? "" : "calendar-outside"
                  } ${selectedTodoDate === day.dateKey ? "calendar-selected" : ""}`}
                  key={day.dateKey}
                  type="button"
                  aria-pressed={selectedTodoDate === day.dateKey}
                  onClick={() => selectTodoDate(day.dateKey)}
                >
                  <strong>{day.dayNumber}</strong>
                  {day.status && <small>{attendanceLabel(day.status)}</small>}
                  {todoCount > 0 && <span className="todo-badge">{todoCount}</span>}
                </button>
              );
            })}
          </div>
          <div className="calendar-legend" aria-label="출석 상태 범례">
            <span className="legend-present">출석</span>
            <span className="legend-pending">대기</span>
            <span className="legend-missed">결석</span>
          </div>
        </section>

        {todoModalOpen && (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={() => setTodoModalOpen(false)}
          >
            <section
              className="todo-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`${formatTodoDate(selectedTodoDate)} 할 일`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="todo-header">
                <div>
                  <p className="eyebrow">daily checklist</p>
                  <h3>{formatTodoDate(selectedTodoDate)} 할 일</h3>
                </div>
                <button
                  className="modal-close"
                  type="button"
                  aria-label="할 일 창 닫기"
                  onClick={() => setTodoModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="todo-modal-summary">
                <strong>{selectedTodoStats.completed}/{selectedTodoStats.total} 완료</strong>
                <div className="todo-progress-track">
                  <span className="todo-progress-fill" style={{ width: `${selectedTodoStats.percent}%` }} />
                </div>
              </div>
              <form
                className="todo-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addTodo();
                }}
              >
                <input
                  value={todoDraft}
                  onChange={(event) => setTodoDraft(event.target.value)}
                  placeholder="예: AWS 공부"
                  disabled={todoBusy}
                  autoFocus
                />
                <button className="secondary" type="submit" disabled={todoBusy}>
                  <Plus size={18} />
                  저장
                </button>
              </form>
              {renderTodoList(selectedDateTodos, "이 날짜에 저장된 할 일이 없습니다.")}
            </section>
          </div>
        )}

        {reminderPopup && (
          <div className="modal-backdrop reminder-backdrop" role="presentation">
            <section
              className="todo-modal reminder-modal"
              role="dialog"
              aria-modal="true"
              aria-label="독서실 입장 알림"
            >
              <div className="todo-header">
                <div>
                  <p className="eyebrow">study alarm</p>
                  <h3>독서실 입장 시간입니다</h3>
                </div>
                <button
                  className="modal-close"
                  type="button"
                  aria-label="알림 창 닫기"
                  onClick={() => setReminderPopup(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <p className="reminder-copy">
                {reminderPopup.reminderTime} 알림이 도착했습니다. 15분 안에 타이머를 시작하면 오늘 출석으로
                인정됩니다.
              </p>
              {renderReminderTodoList(reminderTodos)}
              <div className="reminder-actions">
                <button
                  className="primary"
                  type="button"
                  disabled={busy || Boolean(activeSession)}
                  onClick={() => {
                    setReminderPopup(null);
                    void startTimer();
                  }}
                >
                  <Play size={18} />
                  입장하고 시작
                </button>
                <button className="secondary" type="button" onClick={() => setReminderPopup(null)}>
                  <Send size={18} />
                  나중에
                </button>
              </div>
            </section>
          </div>
        )}

        <section className="daily-visual" aria-label="오늘 공부 시간과 집중 세션">
          <div>
            <p className="eyebrow">today focus</p>
            <h2>{formatTimerClock(todaySeconds)}</h2>
            <p className="session-caption">
              {activeSession ? `현재 세션 ${formatTimerClock(activeElapsedSeconds)}` : "입장 준비 완료"}
            </p>
          </div>
          <div className="focus-control">
            <div className="progress-block">
              <div className="progress-track">
                <span className="progress-fill" style={{ width: `${todayProgress}%` }} />
              </div>
              <span>{todayProgress}% / 2시간</span>
            </div>
          </div>
        </section>

        <section className="today-task-panel" aria-label="오늘 할 일">
          <div className="todo-header">
            <div>
              <p className="eyebrow">today tasks</p>
              <h2>오늘 할 일</h2>
            </div>
            <strong>{todayTodoStats.percent}% 달성</strong>
          </div>
          <div className="todo-progress-track">
            <span className="todo-progress-fill" style={{ width: `${todayTodoStats.percent}%` }} />
          </div>
          {renderTodoList(todayTodos, "오늘 할 일이 없습니다. 캘린더에서 오늘 날짜를 눌러 추가하세요.")}
        </section>

        <section id="me" className="history-panel my-page-panel">
          <div className="history-header">
            <div>
              <p className="eyebrow">my page</p>
              <h2>내 페이지</h2>
            </div>
            <strong className="profile-badge">{todoHistoryStats.completedTodos}개 완료</strong>
          </div>

          <div className="profile-summary-grid" aria-label="나의 정보">
            <div>
              <span>이메일</span>
              <strong>{session.user.email ?? profile?.email ?? "등록 없음"}</strong>
            </div>
            <div>
              <span>로그인</span>
              <strong>{formatAuthProvider(session.user.app_metadata?.provider)}</strong>
            </div>
            <div>
              <span>알림 시간</span>
              <strong>{profile?.reminder_time?.slice(0, 5) ?? reminderTime}</strong>
            </div>
            <div>
              <span>타임존</span>
              <strong>{timeZone}</strong>
            </div>
            <div>
              <span>전체 완료</span>
              <strong>{todoHistoryStats.completedTodos}/{todoHistoryStats.totalTodos}</strong>
            </div>
            <div>
              <span>{formatMonthLabel(calendarMonth)} 완료</span>
              <strong>{todoHistoryStats.monthCompletedTodos}개</strong>
            </div>
          </div>

          <div className="todo-header todo-history-header">
            <div>
              <p className="eyebrow">completed tasks</p>
              <h3>완료한 일 이력</h3>
            </div>
            <strong>{todoHistoryStats.completionPercent}% 완료율</strong>
          </div>
          {renderTodoHistory()}
        </section>

        <section id="settings" className="settings-panel">
          <div className="settings-header">
            <div>
              <p className="eyebrow">notification</p>
              <h2>알림</h2>
            </div>
            <div className="notification-state-list">
              <div className={`notification-state ${notificationStatusClass(webPushStatus)}`}>
                <span>컴퓨터 알림</span>
                <strong>{notificationSummary(webPushStatus)}</strong>
              </div>
              <div className={`notification-state ${kakaoNotificationStatusClass(kakaoStatus)}`}>
                <span>카카오톡 알림</span>
                <strong>{kakaoNotificationSummary(kakaoStatus)}</strong>
              </div>
              <div className={`notification-state ${telegramNotificationStatusClass(telegramStatus)}`}>
                <span>Telegram</span>
                <strong>{telegramNotificationSummary(telegramStatus)}</strong>
              </div>
            </div>
          </div>
          <label>
            매일 알림 시간
            <input
              type="time"
              value={reminderTime}
              onChange={(event) => setReminderTime(event.target.value)}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={profile?.email_reminders_enabled ?? true}
              onChange={(event) =>
                setProfile((current) =>
                  current ? { ...current, email_reminders_enabled: event.target.checked } : current,
                )
              }
            />
            이메일 보완 알림 사용
          </label>
          <label>
            Telegram Chat ID
            <input
              value={telegramChatId}
              onChange={(event) => setTelegramChatId(event.target.value)}
              placeholder="예: 123456789"
              inputMode="text"
            />
          </label>
          <button className="primary wide-action" onClick={saveNotificationSettings} disabled={busy}>
            <Bell size={18} />
            {busy ? "알림 설정 중" : "저장하고 컴퓨터 알림 켜기"}
          </button>
          <button className="secondary wide-action" onClick={connectKakaoNotifications} disabled={busy}>
            <MessageCircle size={18} />
            {kakaoStatus?.connected ? "카카오톡 알림 다시 연결" : "카카오톡 알림 연결"}
          </button>
          <button
            className="secondary wide-action"
            onClick={sendTelegramTestNotification}
            disabled={busy || !telegramStatus?.connected}
          >
            <Send size={18} />
            Telegram 테스트 알림
          </button>
        </section>

      </section>
    </main>
  );
}

function attendanceLabel(status: AttendanceDay["status"]) {
  if (status === "present") return "출석";
  if (status === "missed") return "결석";
  return "대기";
}

function calculateTodoStats(todos: StudyTodo[]) {
  const total = todos.length;
  const completed = todos.filter((todo) => todo.is_completed).length;
  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

function sortTodos(todos: StudyTodo[]) {
  return [...todos].sort((left, right) => {
    if (left.local_date !== right.local_date) {
      return right.local_date.localeCompare(left.local_date);
    }
    if (left.position !== right.position) {
      return left.position - right.position;
    }
    return left.created_at.localeCompare(right.created_at);
  });
}

function formatTodoDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(year, month - 1, day));
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
  }).format(new Date(year, month - 1, 1));
}

function formatAuthProvider(provider: unknown) {
  if (provider === "google") return "Google";
  if (provider === "email") return "Email";
  if (provider === "kakao") return "Kakao";
  if (typeof provider === "string" && provider.trim()) return provider;
  return "Email";
}

function calculateStreak(days: AttendanceDay[]) {
  let streak = 0;
  for (const day of days) {
    if (day.status !== "present") break;
    streak += 1;
  }
  return streak;
}

function formatTimerClock(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getLocalDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function getLocalHourMinute(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  return `${hour}:${minute}`;
}

function getMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function buildAttendanceCalendar(monthKey: string, days: AttendanceDay[]) {
  const byDate = new Map(days.map((day) => [day.local_date, day]));
  const [year, month] = monthKey.split("-").map(Number);
  const firstDate = new Date(year, month - 1, 1);
  const startDate = new Date(firstDate);
  startDate.setDate(firstDate.getDate() - firstDate.getDay());

  return Array.from({ length: 42 }, (_item, index) => {
    const calendarDate = new Date(startDate);
    calendarDate.setDate(startDate.getDate() + index);
    const dateKey = getPlainDateKey(calendarDate);
    const attendanceDay = byDate.get(dateKey);

    return {
      dateKey,
      dayNumber: String(calendarDate.getDate()),
      inMonth: calendarDate.getMonth() === month - 1,
      status: attendanceDay?.status,
    };
  });
}

function getPlainDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAuthError(message: string) {
  if (isEmailSendRateLimitError(message)) {
    return "Supabase 기본 이메일 발송 한도에 걸렸습니다. 현재 기본 메일러는 프로젝트 전체 시간당 2통까지만 보낼 수 있어 약 1시간 후 다시 시도해야 합니다. 계속 테스트하려면 Custom SMTP 또는 Google 로그인을 활성화해야 합니다.";
  }

  if (isRateLimitError(message)) {
    return `${formatRetryWait(OTP_RETRY_COOLDOWN_MS)} 후 다시 시도하세요. 계속 막히면 Supabase Auth rate limit 설정을 확인해야 합니다.`;
  }
  return message;
}

function formatNotificationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("permission") || message.includes("권한")) {
    return "브라우저 알림 권한이 필요합니다. 버튼을 누른 뒤 권한 팝업에서 허용을 선택하세요.";
  }
  return message;
}

function notificationSummary(status: WebPushStatus | null) {
  if (!status) return "확인 중";
  if (!status.supported) return "지원 안 됨";
  if (status.permission === "denied") return "브라우저에서 차단됨";
  if (status.permission !== "granted") return "권한 필요";
  if (!status.subscribed) return "등록 필요";
  return "등록됨";
}

function notificationStatusClass(status: WebPushStatus | null) {
  if (!status) return "notification-checking";
  if (!status.supported || status.permission === "denied") return "notification-blocked";
  if (status.permission !== "granted" || !status.subscribed) return "notification-needed";
  return "notification-ready";
}

function kakaoNotificationSummary(status: KakaoNotificationStatus | null) {
  if (!status) return "확인 중";
  if (!status.connected) return "미연결";
  if (status.needsTalkMessage) return "권한 확인 필요";
  return "연결됨";
}

function kakaoNotificationStatusClass(status: KakaoNotificationStatus | null) {
  if (!status) return "notification-checking";
  if (!status.connected) return "notification-needed";
  if (status.needsTalkMessage) return "notification-blocked";
  return "notification-ready";
}

function telegramNotificationSummary(status: TelegramNotificationStatus | null) {
  if (!status) return "확인 중";
  return status.connected ? "등록됨" : "미등록";
}

function telegramNotificationStatusClass(status: TelegramNotificationStatus | null) {
  if (!status) return "notification-checking";
  return status.connected ? "notification-ready" : "notification-needed";
}

function formatKakaoConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/manual linking|linking/i.test(message)) {
    return "Supabase Auth 설정에서 Manual Linking을 켠 뒤 다시 시도해야 합니다.";
  }
  if (/unsupported provider|provider is not enabled/i.test(message)) {
    return "Supabase Auth에서 Kakao Provider가 켜져 있는지 확인해야 합니다.";
  }
  if (/provider token/i.test(message)) {
    return "카카오 OAuth callback에서 provider token을 받지 못했습니다. talk_message scope와 callback URL을 확인해야 합니다.";
  }
  return message;
}

function isDashboardSection(value: string): value is DashboardSection {
  return dashboardSections.includes(value as DashboardSection);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
