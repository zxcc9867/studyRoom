import {
  StrictMode,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  Camera,
  CameraOff,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Chrome,
  ArrowDown,
  ArrowUp,
  GripVertical,
  KeyRound,
  ListChecks,
  LogOut,
  Mail,
  Pencil,
  Pin,
  Play,
  Plus,
  Repeat2,
  Save,
  Clock3,
  Square,
  Trash2,
  X,
  Send,
  Target,
  UserRound,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";

import { EMAIL_OTP_LENGTH, extractEmailOtpCandidate, isValidEmailOtp, sanitizeEmailOtp } from "./authCode.mjs";
import { SUCCESS_MESSAGE_AUTO_DISMISS_MS, shouldAutoDismissMessage } from "./appMessage.mjs";
import {
  DEFAULT_WEEKDAY_REMINDER_TIME,
  WEEKEND_REMINDER_TIME,
  formatAttendanceGoalHours,
  getAttendanceRuleLabel,
  getDailyAttendanceGoalSeconds,
  getEffectiveReminderTime,
} from "./attendancePolicy.mjs";
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
  isAuthCallbackUrl,
  type IdentityPayload,
} from "./authProviders.mjs";
import {
  canStartStudySessionWithCamera,
  createPresenceState,
  getActiveStudySeconds,
  getCameraSupport,
  getCurrentExcludedSeconds,
  getPresenceStatusLabel,
  markPresenceWarningSent,
  updatePresenceState,
  type PresenceState,
  type PresenceStatus,
} from "./cameraPresence.mjs";
import {
  createCameraFrameRecoveryState,
  updateCameraFrameRecoveryState,
  type CameraFrameRecoveryState,
} from "./cameraFrameRecovery.mjs";
import { getCameraDiagnostic, type CameraDiagnostic } from "./cameraDiagnostics.mjs";
import {
  cameraMonitoringIntentKey,
  createCameraMonitoringIntent,
  parseCameraMonitoringIntent,
  shouldRestoreCameraMonitoring,
} from "./cameraResume.mjs";
import { recordCameraPresenceEvent, sendCameraPresenceWarning } from "./cameraWarning.mjs";
import { createUpperBodyPresenceDetector, type UpperBodyPresenceDetector } from "./bodyPresenceDetection.mjs";
import {
  cameraHealthMessage,
  getCameraFrameHealth,
  getCameraStreamHealth,
  type CameraHealth,
} from "./cameraVideoHealth.mjs";
import {
  getDashboardSectionFromHash,
  type DashboardSection,
} from "./dashboardRoute.mjs";
import {
  buildDailyPlannerSegments,
  plannerAngleToTime,
  type DailyPlannerSegment,
} from "./dailyPlanner.mjs";
import {
  DEFAULT_TODAY_SECTION_ORDER,
  DEFAULT_TODAY_TASK_VIEW,
  moveTodaySection,
  normalizeTodaySectionOrder,
  normalizeTodayTaskView,
  type TodaySectionId,
  type TodayTaskView,
} from "./dashboardLayout.mjs";
import { shouldShowStudyReminderPopup } from "./reminderPopup.mjs";
import { shouldResumeStartAfterRecoveryUnlock } from "./recoveryStartResume.mjs";
import {
  createSessionLeaseDeadlineMs,
  getLeaseAwareActiveNowMs,
  getSessionLeaseExcludedSeconds,
  getSessionLeaseRemainingSeconds,
  getSessionLeaseStorageKey,
  getStoredSessionLeaseDeadlineMs,
  isSessionLeaseExpired,
} from "./sessionLease.mjs";
import {
  STUDY_SESSION_ACTIVITY_HEARTBEAT_MS,
  getStudySessionActivityExcludedSeconds,
  getStudySessionActivityStorageKey,
  parseStudySessionActivityMs,
  shouldEndStudySessionForInactivity,
} from "./sessionActivity.mjs";
import { requestEndStudySessionOnExit, shouldEndStudySessionForPageEvent } from "./sessionExit.mjs";
import {
  buildSessionTodoLinkRows,
  getIncompleteTodayTodos,
  getSessionLinkedTodos,
  normalizeSessionTodoDraft,
  shouldDisableSessionTodoStart,
  shouldRequestSessionTodoSelection,
  summarizeSessionTodos,
} from "./sessionTodoLinks.mjs";
import {
  calculateGoalProgress,
  formatDdayLabel,
  getActiveStudyGoal,
  getGoalLinkedTodos,
  sortStudyGoals,
} from "./studyGoals.mjs";
import { isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl } from "./supabase";
import {
  getSlackNotificationStatus,
  isValidSlackChannelId,
  normalizeSlackChannelId,
  saveSlackNotificationTarget,
  sendSlackTestAlarm,
  type SlackNotificationStatus,
} from "./slackNotifications.mjs";
import {
  DEFAULT_TODO_HISTORY_PAGE_SIZE,
  calculateTodoHistoryStats,
  getCompletedTodoHistory,
  paginateTodoHistory,
} from "./todoHistory.mjs";
import {
  buildRecurringTodoDates,
  filterNewTodoDates,
  formatTodoRepeatLabel,
  getDefaultRepeatEndDate,
  getForeverRepeatEndDate,
  getTodoSaveFocusDate,
  getWeekdayFromDateKey,
  isWeeklyTodo,
  normalizeTodoRepeatWeekdays,
  todoWeekdayOptions,
} from "./todoRecurrence.mjs";
import {
  formatTodoScheduleLabel,
  formatTodoWithSchedule,
  normalizeTodoSchedule,
} from "./todoSchedule.mjs";
import { getWebPushStatus, registerWebPushTarget, showLocalTestNotification, type WebPushStatus } from "./webPush";
import "./styles.css";

const resendCooldownKey = "study-room-auth-resend-available-at";
const emailOtpLength = EMAIL_OTP_LENGTH;
const googleAuthEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === "true";
const cameraRequiredWarningCooldownMs = 10 * 60 * 1000;
type TodoRepeatMode = "single" | "weekly";
type CameraSetupPrompt = {
  mode: "start" | "resume";
};
type CameraDiagnosticReason = CameraHealth["reason"] | "permission-denied" | "unknown-error" | null;
type SessionLeaseState = {
  sessionId: string;
  deadlineMs: number;
};

type Profile = {
  user_id: string;
  email: string | null;
  time_zone: string;
  reminder_time: string;
  email_reminders_enabled: boolean;
  today_task_view?: string | null;
  today_section_order?: unknown;
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
  start_time: string | null;
  end_time: string | null;
  goal_id: string | null;
  repeat_group_id: string | null;
  repeat_mode: TodoRepeatMode;
  repeat_weekdays: number[] | null;
  repeat_until: string | null;
  repeat_forever: boolean;
  created_at: string;
};

type StudySessionTodoLink = {
  id: string;
  user_id: string;
  session_id: string;
  todo_id: string;
  linked_at: string;
  completed_during_session: boolean;
};

type StudyGoal = {
  id: string;
  user_id: string;
  title: string;
  target_date: string;
  target_study_seconds: number;
  status: "active" | "completed" | "archived";
  created_at: string;
  updated_at: string;
};

type StudyRecoveryRequest = {
  id: string;
  local_date: string;
  trigger_type: "missed_attendance" | "camera_absence_repeat";
  status: "pending" | "submitted";
  reason: string | null;
  makeup_todo_title: string | null;
  pledge_todo_title: string | null;
  created_at: string;
};

const todaySectionLabels: Record<TodaySectionId, string> = {
  topbar: "타이머/목표",
  attendance: "출석 캘린더",
  focus: "카메라 감시",
  tasks: "오늘 할 일",
};

function addMinutesToTime(time: string, minutesToAdd: number) {
  const [hour = "0", minute = "0"] = time.slice(0, 5).split(":");
  const totalMinutes = ((Number(hour) * 60 + Number(minute) + minutesToAdd) % 1440 + 1440) % 1440;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function getPlannerClickAngle(event: MouseEvent<SVGSVGElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const x = event.clientX - centerX;
  const y = event.clientY - centerY;
  return (Math.atan2(y, x) * 180) / Math.PI + 90 + 360;
}

function getPlannerPoint(angle: number, radius: number, center = 180) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

function getPlannerArcPath(startAngle: number, endAngle: number, innerRadius = 72, outerRadius = 168) {
  const normalizedEndAngle = endAngle <= startAngle ? endAngle + 360 : endAngle;
  const sweep = normalizedEndAngle - startAngle;
  const largeArcFlag = sweep > 180 ? 1 : 0;
  const startOuter = getPlannerPoint(startAngle, outerRadius);
  const endOuter = getPlannerPoint(normalizedEndAngle, outerRadius);
  const startInner = getPlannerPoint(startAngle, innerRadius);
  const endInner = getPlannerPoint(normalizedEndAngle, innerRadius);

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${startInner.x} ${startInner.y}`,
    "Z",
  ].join(" ");
}

function getPlannerLabelPoint(startAngle: number, endAngle: number) {
  const normalizedEndAngle = endAngle <= startAngle ? endAngle + 360 : endAngle;
  return getPlannerPoint(startAngle + (normalizedEndAngle - startAngle) / 2, 120);
}

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
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attendanceDays, setAttendanceDays] = useState<AttendanceDay[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [studyTodos, setStudyTodos] = useState<StudyTodo[]>([]);
  const [studySessionTodoLinks, setStudySessionTodoLinks] = useState<StudySessionTodoLink[]>([]);
  const [studyGoals, setStudyGoals] = useState<StudyGoal[]>([]);
  const [studyRecoveryRequests, setStudyRecoveryRequests] = useState<StudyRecoveryRequest[]>([]);
  const [recoveryModalRequest, setRecoveryModalRequest] = useState<StudyRecoveryRequest | null>(null);
  const [recoveryReason, setRecoveryReason] = useState("");
  const [makeupTodoTitle, setMakeupTodoTitle] = useState("");
  const [pledgeTodoTitle, setPledgeTodoTitle] = useState("");
  const [recoverySubmitBusy, setRecoverySubmitBusy] = useState(false);
  const [resumeStartAfterRecoveryUnlock, setResumeStartAfterRecoveryUnlock] = useState(false);
  const [recoveryUnlockRefreshing, setRecoveryUnlockRefreshing] = useState(false);
  const [reminderTime, setReminderTime] = useState(DEFAULT_WEEKDAY_REMINDER_TIME);
  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(true);
  const [alarmEditing, setAlarmEditing] = useState(false);
  const [selectedTodoDate, setSelectedTodoDate] = useState(() => getPlainDateKey(new Date()));
  const [todoDraft, setTodoDraft] = useState("");
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [todoRepeatMode, setTodoRepeatMode] = useState<TodoRepeatMode>("single");
  const [todoRepeatEndDate, setTodoRepeatEndDate] = useState(() =>
    getDefaultRepeatEndDate(getPlainDateKey(new Date())),
  );
  const [todoRepeatForever, setTodoRepeatForever] = useState(false);
  const [todoRepeatWeekdays, setTodoRepeatWeekdays] = useState<number[]>(() => [
    getWeekdayFromDateKey(getPlainDateKey(new Date())),
  ]);
  const [todoTimeEnabled, setTodoTimeEnabled] = useState(false);
  const [todoStartTime, setTodoStartTime] = useState("09:00");
  const [todoEndTime, setTodoEndTime] = useState("10:00");
  const [todoGoalId, setTodoGoalId] = useState("");
  const [todoModalOpen, setTodoModalOpen] = useState(false);
  const [todayTaskView, setTodayTaskView] = useState<TodayTaskView>(DEFAULT_TODAY_TASK_VIEW);
  const [savedTodayTaskView, setSavedTodayTaskView] = useState<TodayTaskView>(DEFAULT_TODAY_TASK_VIEW);
  const [todaySectionOrder, setTodaySectionOrder] = useState<TodaySectionId[]>(() => [
    ...DEFAULT_TODAY_SECTION_ORDER,
  ]);
  const [draftTodaySectionOrder, setDraftTodaySectionOrder] = useState<TodaySectionId[]>(() => [
    ...DEFAULT_TODAY_SECTION_ORDER,
  ]);
  const [sectionOrderEditing, setSectionOrderEditing] = useState(false);
  const [draggingSectionId, setDraggingSectionId] = useState<TodaySectionId | null>(null);
  const [selectedPlannerTodoId, setSelectedPlannerTodoId] = useState<string | null>(null);
  const [sessionTodoModalOpen, setSessionTodoModalOpen] = useState(false);
  const [sessionTodoStartRequest, setSessionTodoStartRequest] = useState<{ cameraReadyOverride: boolean } | null>(null);
  const [selectedSessionTodoIds, setSelectedSessionTodoIds] = useState<string[]>([]);
  const [sessionTodoDraft, setSessionTodoDraft] = useState("");
  const [sessionTodoAddBusy, setSessionTodoAddBusy] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState(() => addDaysToDateKey(getPlainDateKey(new Date()), 30));
  const [goalLinkedTodoIds, setGoalLinkedTodoIds] = useState<string[]>([]);
  const [goalBusy, setGoalBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [todoBusy, setTodoBusy] = useState(false);
  const [webPushStatus, setWebPushStatus] = useState<WebPushStatus | null>(null);
  const [slackStatus, setSlackStatus] = useState<SlackNotificationStatus | null>(null);
  const [slackChannelId, setSlackChannelId] = useState("");
  const [reminderPopup, setReminderPopup] = useState<{ dateKey: string; reminderTime: string } | null>(null);
  const [activeSection, setActiveSection] = useState<DashboardSection>(() =>
    getDashboardSectionFromHash(window.location.hash),
  );
  const [calendarMonth, setCalendarMonth] = useState(() => getMonthKey(new Date()));
  const [todoHistoryPage, setTodoHistoryPage] = useState(1);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<PresenceStatus>("idle");
  const [cameraMessage, setCameraMessage] = useState("");
  const [cameraDiagnosticReason, setCameraDiagnosticReason] = useState<CameraDiagnosticReason>(null);
  const [presenceState, setPresenceState] = useState<PresenceState>(() => createPresenceState(Date.now()));
  const [absenceWarningPopup, setAbsenceWarningPopup] = useState<{
    absenceSeconds: number;
    slackSent: boolean;
    slackMissing: boolean;
  } | null>(null);
  const [cameraSetupPrompt, setCameraSetupPrompt] = useState<CameraSetupPrompt | null>(null);
  const [sessionLease, setSessionLease] = useState<SessionLeaseState | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraFrameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const presenceDetectorRef = useRef<UpperBodyPresenceDetector | null>(null);
  const presenceStateRef = useRef<PresenceState>(createPresenceState(Date.now()));
  const cameraSessionIdRef = useRef<string | null>(null);
  const cameraSessionStartingRef = useRef(false);
  const cameraAutoRestoreAttemptedRef = useRef(false);
  const cameraRecoveryInFlightRef = useRef(false);
  const cameraFrameRecoveryStateRef = useRef<CameraFrameRecoveryState>(createCameraFrameRecoveryState());
  const lastCameraRequiredWarningAtRef = useRef(0);
  const warningInFlightRef = useRef(false);
  const sessionLeaseAutoEndInFlightRef = useRef(false);
  const sessionActivityAutoEndInFlightRef = useRef(false);
  const recoveryAutoEndInFlightRef = useRef(false);
  const recoveryModalDismissedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    async function initializeSession() {
      try {
        if (isAuthCallbackUrl(window.location.href)) {
          await finishOAuthCallback();
          return;
        }

        const { data } = await supabase.auth.getSession();
        setSession(data.session);
      } finally {
        setSessionInitialized(true);
      }
    }

    void initializeSession();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
    if (!shouldAutoDismissMessage(message)) return;

    const timeoutId = window.setTimeout(() => setMessage(""), SUCCESS_MESSAGE_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  useEffect(() => {
    if (session?.user.id) {
      void syncSignedInUser(session);
      void loadDashboard(session.user.id);
      void refreshWebPushStatus();
      void refreshSlackStatus(session.user.id);
    }
  }, [session?.user.id]);

  useEffect(() => {
    if (!session) return;

    const syncRoute = () => setActiveSection(getDashboardSectionFromHash(window.location.hash));
    syncRoute();
    window.addEventListener("hashchange", syncRoute);

    return () => window.removeEventListener("hashchange", syncRoute);
  }, [session]);

  const timeZone = profile?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const activeSession = studySessions.find((item) => item.status === "active") ?? null;
  const pendingRecoveryRequests = useMemo(
    () => studyRecoveryRequests.filter((item) => item.status === "pending").sort(compareRecoveryRequests),
    [studyRecoveryRequests],
  );
  const cameraSupport = useMemo(() => getCameraSupport(window), []);
  const cameraDiagnostic: CameraDiagnostic = useMemo(
    () =>
      getCameraDiagnostic({
        activeSession: Boolean(activeSession),
        cameraEnabled,
        cameraStatus,
        supportReason: cameraSupport.reason,
        healthReason: cameraDiagnosticReason,
        absenceSeconds: presenceState.absenceSeconds,
        timerPaused: presenceState.timerPaused,
      }),
    [
      activeSession,
      cameraDiagnosticReason,
      cameraEnabled,
      cameraStatus,
      cameraSupport.reason,
      presenceState.absenceSeconds,
      presenceState.timerPaused,
    ],
  );
  const activeExcludedSeconds = activeSession ? getCurrentExcludedSeconds(presenceState) : 0;
  const activeSessionStartedAtMs = activeSession ? new Date(activeSession.started_at).getTime() : null;
  const activeSessionLeaseDeadlineMs =
    activeSession && activeSessionStartedAtMs !== null && Number.isFinite(activeSessionStartedAtMs)
      ? sessionLease?.sessionId === activeSession.id
        ? sessionLease.deadlineMs
        : createSessionLeaseDeadlineMs(activeSessionStartedAtMs)
      : null;
  const activeSessionClockNowMs =
    activeSessionLeaseDeadlineMs !== null
      ? getLeaseAwareActiveNowMs({ deadlineMs: activeSessionLeaseDeadlineMs, nowMs })
      : nowMs;
  const activeElapsedSeconds = activeSession
    ? getActiveStudySeconds({
        startedAtMs: activeSessionStartedAtMs ?? nowMs,
        nowMs: activeSessionClockNowMs,
        excludedSeconds: activeExcludedSeconds,
      })
    : 0;
  const todayDateKey = getLocalDateKey(new Date(nowMs), timeZone);
  const blockingRecoveryRequests = pendingRecoveryRequests;
  const autoOpenRecoveryRequests = useMemo(() => blockingRecoveryRequests, [blockingRecoveryRequests]);
  const recoveryModalQueuePosition = recoveryModalRequest
    ? pendingRecoveryRequests.findIndex((request) => request.id === recoveryModalRequest.id) + 1
    : 0;
  const recoveryModalRemainingCount = recoveryModalRequest
    ? pendingRecoveryRequests.filter((request) => request.id !== recoveryModalRequest.id).length
    : 0;

  useEffect(() => {
    if (!session?.user.id || recoveryModalRequest || autoOpenRecoveryRequests.length === 0) {
      return;
    }

    const nextRequest = autoOpenRecoveryRequests.find(
      (request) => !recoveryModalDismissedIdsRef.current.has(request.id),
    );
    if (nextRequest) {
      openRecoveryRoutineModal(nextRequest, { auto: true });
    }
  }, [session?.user.id, autoOpenRecoveryRequests, recoveryModalRequest?.id]);

  useEffect(() => {
    if (!session?.user.id || !activeSession || blockingRecoveryRequests.length === 0 || busy) {
      return;
    }

    if (recoveryAutoEndInFlightRef.current) {
      return;
    }

    recoveryAutoEndInFlightRef.current = true;
    const nextRequest = blockingRecoveryRequests[0];
    openRecoveryRoutineModal(nextRequest, { auto: true });
    void endTimer({
      successMessage: "회복 루틴이 필요해 진행 중인 세션을 자동 종료했습니다. 회복 루틴을 제출한 뒤 다시 시작하세요.",
    }).finally(() => {
      recoveryAutoEndInFlightRef.current = false;
    });
  }, [activeSession?.id, blockingRecoveryRequests, busy, session?.user.id]);

  useEffect(() => {
    if (
      !shouldResumeStartAfterRecoveryUnlock({
        resumeRequested: resumeStartAfterRecoveryUnlock,
        blockingRecoveryCount: blockingRecoveryRequests.length,
        recoveryModalOpen: Boolean(recoveryModalRequest),
        activeSession: Boolean(activeSession),
        busy,
        refreshing: recoveryUnlockRefreshing,
      })
    ) {
      return;
    }

    setResumeStartAfterRecoveryUnlock(false);
    void startTimer();
  }, [
    activeSession?.id,
    blockingRecoveryRequests.length,
    busy,
    recoveryModalRequest?.id,
    recoveryUnlockRefreshing,
    resumeStartAfterRecoveryUnlock,
  ]);

  const todayCompletedSeconds = studySessions
    .filter((item) => item.local_date === todayDateKey && item.status !== "active")
    .reduce((sum, item) => sum + item.duration_seconds, 0);
  const activeCountsForToday = activeSession?.local_date === todayDateKey;
  const todaySeconds = todayCompletedSeconds + (activeCountsForToday ? activeElapsedSeconds : 0);
  const monthCompletedSeconds = studySessions
    .filter((item) => item.local_date.startsWith(calendarMonth) && item.status !== "active")
    .reduce((sum, item) => sum + item.duration_seconds, 0);
  const monthSeconds =
    monthCompletedSeconds +
    (activeSession?.local_date.startsWith(calendarMonth) ? activeElapsedSeconds : 0);
  const sessionLeaseRemainingSeconds =
    activeSessionLeaseDeadlineMs !== null
      ? getSessionLeaseRemainingSeconds({ deadlineMs: activeSessionLeaseDeadlineMs, nowMs })
      : 0;
  const todayGoalSeconds = getDailyAttendanceGoalSeconds(todayDateKey);
  const todayGoalLabel = formatAttendanceGoalHours(todayGoalSeconds);
  const effectiveReminderTime = getEffectiveReminderTime(todayDateKey, profile?.reminder_time ?? reminderTime);
  const todayAttendanceRuleLabel = getAttendanceRuleLabel(todayDateKey, profile?.reminder_time ?? reminderTime);
  const todayProgress = Math.min(100, Math.round((todaySeconds / todayGoalSeconds) * 100));
  const todayTodos = useMemo(
    () => studyTodos.filter((todo) => todo.local_date === todayDateKey),
    [studyTodos, todayDateKey],
  );
  const dailyPlanner = useMemo(
    () => buildDailyPlannerSegments(todayTodos, todayDateKey),
    [todayTodos, todayDateKey],
  );
  const selectedPlannerSegment = useMemo(
    () =>
      dailyPlanner.segments.find((segment) => segment.id === selectedPlannerTodoId) ??
      dailyPlanner.segments[0] ??
      null,
    [dailyPlanner.segments, selectedPlannerTodoId],
  );
  const renderedTodaySectionOrder = sectionOrderEditing ? draftTodaySectionOrder : todaySectionOrder;
  const incompleteTodayTodos = useMemo(
    () => getIncompleteTodayTodos(studyTodos, todayDateKey),
    [studyTodos, todayDateKey],
  );
  const activeSessionTodos = useMemo(
    () =>
      getSessionLinkedTodos({
        activeSessionId: activeSession?.id,
        links: studySessionTodoLinks,
        todos: studyTodos,
      }),
    [activeSession?.id, studySessionTodoLinks, studyTodos],
  );
  const selectedDateTodos = useMemo(
    () => studyTodos.filter((todo) => todo.local_date === selectedTodoDate),
    [studyTodos, selectedTodoDate],
  );
  const editingTodo = useMemo(
    () => studyTodos.find((todo) => todo.id === editingTodoId) ?? null,
    [studyTodos, editingTodoId],
  );
  const reminderTodos = useMemo(
    () => (reminderPopup ? studyTodos.filter((todo) => todo.local_date === reminderPopup.dateKey) : []),
    [studyTodos, reminderPopup?.dateKey],
  );
  const todayTodoStats = useMemo(() => calculateTodoStats(todayTodos), [todayTodos]);
  const visibleTodoModalItems = useMemo(() => editingTodo ? [editingTodo] : selectedDateTodos, [editingTodo, selectedDateTodos]);
  const selectedTodoStats = useMemo(() => calculateTodoStats(visibleTodoModalItems), [visibleTodoModalItems]);
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
  const sortedGoals = useMemo(() => sortStudyGoals(studyGoals), [studyGoals]);
  const goalTitleById = useMemo(
    () => new Map(studyGoals.map((goal) => [goal.id, goal.title])),
    [studyGoals],
  );
  const activeGoal = useMemo(() => getActiveStudyGoal(sortedGoals), [sortedGoals]);
  const activeGoalTodos = useMemo(
    () => (activeGoal ? getGoalLinkedTodos(activeGoal.id, studyTodos) : []),
    [activeGoal?.id, studyTodos],
  );
  const activeGoalProgress = activeGoal
    ? calculateGoalProgress({
        goal: { ...activeGoal, target_study_seconds: 0 },
        linkedTodos: activeGoalTodos,
        studiedSeconds: 0,
      })
    : null;
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
    if (!session?.user.id || !activeSession || activeSessionStartedAtMs === null || !Number.isFinite(activeSessionStartedAtMs)) {
      setSessionLease(null);
      sessionLeaseAutoEndInFlightRef.current = false;
      return;
    }

    const storageKey = getSessionLeaseStorageKey({
      userId: session.user.id,
      sessionId: activeSession.id,
    });
    const deadlineMs = getStoredSessionLeaseDeadlineMs({
      rawValue: window.localStorage.getItem(storageKey),
      startedAtMs: activeSessionStartedAtMs,
    });

    window.localStorage.setItem(storageKey, String(deadlineMs));
    setSessionLease((current) =>
      current?.sessionId === activeSession.id && current.deadlineMs === deadlineMs
        ? current
        : { sessionId: activeSession.id, deadlineMs },
    );
    sessionLeaseAutoEndInFlightRef.current = false;
  }, [activeSession?.id, activeSession?.started_at, activeSessionStartedAtMs, session?.user.id]);

  useEffect(() => {
    if (
      !activeSession ||
      activeSessionStartedAtMs === null ||
      activeSessionLeaseDeadlineMs === null ||
      !session?.user.id ||
      busy
    ) {
      return;
    }

    if (!isSessionLeaseExpired({ deadlineMs: activeSessionLeaseDeadlineMs, nowMs })) {
      return;
    }

    if (sessionLeaseAutoEndInFlightRef.current) {
      return;
    }

    sessionLeaseAutoEndInFlightRef.current = true;
    const excludedSeconds = getSessionLeaseExcludedSeconds({
      deadlineMs: activeSessionLeaseDeadlineMs,
      nowMs,
      baseExcludedSeconds: getCurrentExcludedSeconds(presenceStateRef.current),
    });

    void endTimer({
      excludedSeconds,
      successMessage: "세션 유지 시간이 만료되어 자동 종료되었습니다.",
    }).finally(() => {
      sessionLeaseAutoEndInFlightRef.current = false;
    });
  }, [
    activeSession?.id,
    activeSessionLeaseDeadlineMs,
    activeSessionStartedAtMs,
    busy,
    nowMs,
    session?.user.id,
  ]);

  useEffect(() => {
    if (!session?.user.id || !activeSession) {
      sessionActivityAutoEndInFlightRef.current = false;
      return;
    }

    if (busy) {
      return;
    }

    const lastActivityMs = getStoredStudySessionActivityMs(activeSession.id);
    if (!shouldEndStudySessionForInactivity({ lastActivityMs, nowMs })) {
      return;
    }

    if (sessionActivityAutoEndInFlightRef.current) {
      return;
    }

    sessionActivityAutoEndInFlightRef.current = true;
    const excludedSeconds =
      getCurrentExcludedSeconds(presenceStateRef.current) +
      getStudySessionActivityExcludedSeconds({ lastActivityMs, nowMs });

    void endTimer({
      excludedSeconds,
      successMessage: "\uBE0C\uB77C\uC6B0\uC800\uAC00 \uB2EB\uD600 \uC788\uB358 \uC2DC\uAC04\uC740 \uACF5\uBD80 \uC2DC\uAC04\uC5D0\uC11C \uC81C\uC678\uD558\uACE0 \uC138\uC158\uC744 \uC885\uB8CC\uD588\uC2B5\uB2C8\uB2E4.",
    }).finally(() => {
      sessionActivityAutoEndInFlightRef.current = false;
    });
  }, [activeSession?.id, busy, nowMs, session?.user.id]);

  useEffect(() => {
    if (!session?.user.id || !activeSession) {
      sessionActivityAutoEndInFlightRef.current = false;
      return;
    }

    if (sessionActivityAutoEndInFlightRef.current) {
      return;
    }

    if (getStoredStudySessionActivityMs(activeSession.id) === null) {
      persistStudySessionActivity(activeSession.id);
    }

    const persistCurrentActivity = () => {
      const currentNowMs = Date.now();
      const lastActivityMs = getStoredStudySessionActivityMs(activeSession.id);
      if (shouldEndStudySessionForInactivity({ lastActivityMs, nowMs: currentNowMs })) {
        return;
      }

      persistStudySessionActivity(activeSession.id, currentNowMs);
    };

    const persistVisibleActivity = () => {
      if (document.visibilityState === "visible") {
        persistStudySessionActivity(activeSession.id);
      }
    };

    const intervalId = window.setInterval(persistCurrentActivity, STUDY_SESSION_ACTIVITY_HEARTBEAT_MS);
    window.addEventListener("pagehide", persistCurrentActivity);
    window.addEventListener("beforeunload", persistCurrentActivity);
    document.addEventListener("visibilitychange", persistVisibleActivity);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("pagehide", persistCurrentActivity);
      window.removeEventListener("beforeunload", persistCurrentActivity);
      document.removeEventListener("visibilitychange", persistVisibleActivity);
    };
  }, [activeSession?.id, session?.user.id]);

  useEffect(() => {
    if (!session?.user.id || !profile) return;

    const configuredReminderTime = getEffectiveReminderTime(todayDateKey, profile.reminder_time ?? reminderTime);
    const popupKey = `study-room-reminder-popup:${session.user.id}:${todayDateKey}:${configuredReminderTime}`;
    const hasPopupRecord = Boolean(window.localStorage.getItem(popupKey));
    const shouldShowPopup = shouldShowStudyReminderPopup({
      nowMs,
      reminderTime: configuredReminderTime,
      todayDateKey,
      attendanceDays,
      activeSession,
      hasPopupRecord,
      timeZone,
    });

    if (!shouldShowPopup) return;

    window.localStorage.setItem(popupKey, new Date(nowMs).toISOString());
    setReminderPopup({ dateKey: todayDateKey, reminderTime: configuredReminderTime });
  }, [activeSession, attendanceDays, profile, reminderTime, nowMs, session?.user.id, timeZone, todayDateKey]);
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
    const sendExitRequest = (eventType: string) => {
      if (!shouldEndStudySessionForPageEvent({ type: eventType, visibilityState: document.visibilityState })) {
        return;
      }

      if (exitRequestSent) {
        return;
      }

      exitRequestSent = requestEndStudySessionOnExit({
        supabaseUrl,
        anonKey: supabaseAnonKey,
        accessToken,
        sessionId: activeSessionId,
        excludedSeconds: getCurrentExcludedSeconds(presenceStateRef.current),
        fetch: window.fetch.bind(window),
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && exitRequestSent && userId) {
        void loadDashboard(userId);
      }
    };

    const handlePageHide = () => sendExitRequest("pagehide");
    const handleBeforeUnload = () => sendExitRequest("beforeunload");
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeSession?.id, session?.access_token, session?.user.id]);

  useEffect(() => {
    if (!activeSession && cameraEnabled && !cameraSessionStartingRef.current) {
      stopCameraMonitoring({ recordEvent: true });
    }
    if (!activeSession) {
      cameraAutoRestoreAttemptedRef.current = false;
    }
  }, [activeSession?.id, cameraEnabled]);

  useEffect(() => {
    if (!activeSession || !session?.user.id || cameraEnabled || cameraStatus === "starting") {
      return;
    }

    if (cameraAutoRestoreAttemptedRef.current) {
      return;
    }

    const intent = parseCameraMonitoringIntent(
      window.localStorage.getItem(cameraMonitoringIntentKey(session.user.id)),
    );
    if (
      shouldRestoreCameraMonitoring({
        intent,
        userId: session.user.id,
        activeSessionId: activeSession.id,
        nowMs: Date.now(),
      })
    ) {
      cameraAutoRestoreAttemptedRef.current = true;
      setCameraMessage("새로고침 전 카메라 감시를 다시 연결하고 있습니다.");
      void startCameraMonitoring().then((restored) => {
        if (!restored) {
          cameraAutoRestoreAttemptedRef.current = false;
          setCameraSetupPrompt({ mode: "resume" });
        }
      });
    }
  }, [activeSession?.id, session?.user.id, cameraEnabled, cameraStatus]);

  useEffect(() => {
    if (!activeSession || cameraEnabled || cameraStatus === "starting" || cameraAutoRestoreAttemptedRef.current) {
      return;
    }

    setCameraSetupPrompt({ mode: "resume" });
    setCameraMessage("공부 세션 중에는 카메라 감시가 필요합니다.");
    void sendCameraRequiredWarning();
  }, [activeSession?.id, cameraEnabled, cameraStatus, session?.access_token]);

  useEffect(() => {
    if (!cameraEnabled || !activeSession || !session) {
      return;
    }

    let cancelled = false;
    const checkPresence = async () => {
      if (cancelled || !videoRef.current || !presenceDetectorRef.current) {
        return;
      }

      const streamHealth = getCameraStreamHealth(cameraStreamRef.current);
      if (!streamHealth.ok) {
        cameraFrameRecoveryStateRef.current = createCameraFrameRecoveryState();
        setCameraDiagnosticReason(streamHealth.reason);
        markCameraHealthIssue(streamHealth.reason);
        return;
      }

      const video = videoRef.current;
      const frameHealth = getCameraFrameHealth({
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        pixels: readCameraFramePixels(video),
      });
      if (!frameHealth.ok) {
        setCameraDiagnosticReason(frameHealth.reason);
        await handleCameraFrameHealthIssue(frameHealth.reason);
        return;
      }

      try {
        cameraFrameRecoveryStateRef.current = createCameraFrameRecoveryState();
        const presenceDetected = presenceDetectorRef.current.detect(video, performance.now());
        setCameraDiagnosticReason("visible-frame");
        const nextState = updatePresenceState(presenceStateRef.current, {
          presenceDetected,
          nowMs: Date.now(),
        });
        presenceStateRef.current = nextState;
        setPresenceState(nextState);
        setCameraStatus(nextState.timerPaused ? "warning" : "watching");
        setCameraMessage(
          presenceDetected
            ? "카메라 감시 중"
            : "상반신이 보이지 않습니다. 머리와 양어깨가 카메라에 나오도록 화면을 조정하세요.",
        );

        if (nextState.warningDue && !warningInFlightRef.current) {
          await sendAbsenceWarning(nextState);
        }
      } catch (error) {
        setCameraStatus("error");
        setCameraMessage(formatNotificationError(error));
      }
    };

    const intervalId = window.setInterval(() => {
      void checkPresence();
    }, 5000);
    void checkPresence();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [cameraEnabled, activeSession?.id, session?.access_token]);

  useEffect(() => {
    return () => {
      cleanupCameraResources();
    };
  }, []);

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
      setMessage("로그인되었습니다.");
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
    setMessage("로그인되었습니다.");
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
    const [
      { data: profileData },
      { data: attendanceData },
      { data: sessionData },
      { data: todoData },
      { data: sessionTodoLinkData },
      { data: goalData },
      { data: recoveryData },
    ] = await Promise.all([
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
      supabase
        .from("study_session_todos")
        .select("*")
        .eq("user_id", userId)
        .order("linked_at", { ascending: false })
        .limit(1000),
      supabase
        .from("study_goals")
        .select("*")
        .eq("user_id", userId)
        .order("status", { ascending: true })
        .order("target_date", { ascending: true })
        .limit(100),
      supabase
        .from("study_recovery_requests")
        .select("id,local_date,trigger_type,status,reason,makeup_todo_title,pledge_todo_title,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (profileData) {
      const typedProfile = profileData as Profile;
      const normalizedTaskView = normalizeTodayTaskView(typedProfile.today_task_view);
      const normalizedSectionOrder = normalizeTodaySectionOrder(typedProfile.today_section_order);
      setProfile(typedProfile);
      setReminderTime(profileData.reminder_time.slice(0, 5));
      setEmailRemindersEnabled(profileData.email_reminders_enabled ?? true);
      setTodayTaskView(normalizedTaskView);
      setSavedTodayTaskView(normalizedTaskView);
      setTodaySectionOrder(normalizedSectionOrder);
      setDraftTodaySectionOrder(normalizedSectionOrder);
    } else {
      setTodayTaskView(DEFAULT_TODAY_TASK_VIEW);
      setSavedTodayTaskView(DEFAULT_TODAY_TASK_VIEW);
      setTodaySectionOrder([...DEFAULT_TODAY_SECTION_ORDER]);
      setDraftTodaySectionOrder([...DEFAULT_TODAY_SECTION_ORDER]);
    }
    setAttendanceDays(attendanceData ?? []);
    setStudySessions(sessionData ?? []);
    setStudyTodos(todoData ?? []);
    setStudySessionTodoLinks((sessionTodoLinkData ?? []) as StudySessionTodoLink[]);
    setStudyGoals(sortStudyGoals((goalData ?? []) as StudyGoal[]));
    setStudyRecoveryRequests((recoveryData ?? []) as StudyRecoveryRequest[]);
    setBusy(false);
  }

  function selectTodoDate(dateKey: string) {
    setSelectedTodoDate(dateKey);
    setCalendarMonth(dateKey.slice(0, 7));
    resetTodoDraftForDate(dateKey);
    setTodoModalOpen(true);
  }

  function resetTodoDraftForDate(dateKey: string) {
    setEditingTodoId(null);
    setTodoDraft("");
    setTodoRepeatMode("single");
    setTodoRepeatEndDate(getDefaultRepeatEndDate(dateKey));
    setTodoRepeatForever(false);
    setTodoRepeatWeekdays([getWeekdayFromDateKey(dateKey)]);
    setTodoTimeEnabled(false);
    setTodoStartTime("09:00");
    setTodoEndTime("10:00");
    setTodoGoalId(activeGoal?.id ?? "");
  }

  function closeTodoModal() {
    setTodoModalOpen(false);
    setEditingTodoId(null);
  }

  function openPlannerTodoCreate(startTime: string) {
    const normalizedStartTime = startTime.slice(0, 5);
    setSelectedTodoDate(todayDateKey);
    setCalendarMonth(todayDateKey.slice(0, 7));
    resetTodoDraftForDate(todayDateKey);
    setTodoTimeEnabled(true);
    setTodoStartTime(normalizedStartTime);
    setTodoEndTime(addMinutesToTime(normalizedStartTime, 60));
    setTodoModalOpen(true);
  }

  function openPlannerTodoFromClick(event: MouseEvent<SVGSVGElement>) {
    openPlannerTodoCreate(plannerAngleToTime(getPlannerClickAngle(event)));
  }

  function getTodaySectionSortOrder(sectionId: TodaySectionId) {
    const sectionIndex = renderedTodaySectionOrder.indexOf(sectionId);
    return (sectionIndex >= 0 ? sectionIndex + 1 : 1) * 10;
  }

  function moveDraftTodaySection(sectionId: TodaySectionId, direction: "up" | "down") {
    setDraftTodaySectionOrder((current) => moveTodaySection(current, sectionId, direction));
  }

  function dropDraftTodaySection(targetSectionId: TodaySectionId) {
    if (!draggingSectionId || draggingSectionId === targetSectionId) {
      setDraggingSectionId(null);
      return;
    }

    setDraftTodaySectionOrder((current) => {
      const normalized = normalizeTodaySectionOrder(current).filter((sectionId) => sectionId !== draggingSectionId);
      const targetIndex = normalized.indexOf(targetSectionId);
      if (targetIndex < 0) {
        return normalizeTodaySectionOrder(current);
      }
      const next = [...normalized];
      next.splice(targetIndex, 0, draggingSectionId);
      return normalizeTodaySectionOrder(next);
    });
    setDraggingSectionId(null);
  }

  async function saveTodayTaskViewPreference() {
    if (!session?.user.id) return;

    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      email: session.user.email ?? profile?.email ?? null,
      reminder_time: profile?.reminder_time ?? reminderTime,
      time_zone: profile?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      email_reminders_enabled: profile?.email_reminders_enabled ?? emailRemindersEnabled,
      today_task_view: todayTaskView,
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSavedTodayTaskView(todayTaskView);
    setProfile((current) => ({
      user_id: session.user.id,
      email: session.user.email ?? current?.email ?? null,
      time_zone: current?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      reminder_time: current?.reminder_time ?? reminderTime,
      email_reminders_enabled: current?.email_reminders_enabled ?? emailRemindersEnabled,
      today_task_view: todayTaskView,
      today_section_order: current?.today_section_order ?? todaySectionOrder,
    }));
    setMessage("오늘 할 일 보기를 고정했습니다.");
  }

  async function saveTodaySectionOrderPreference() {
    if (!session?.user.id) return;

    const normalizedOrder = normalizeTodaySectionOrder(draftTodaySectionOrder);
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      email: session.user.email ?? profile?.email ?? null,
      reminder_time: profile?.reminder_time ?? reminderTime,
      time_zone: profile?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      email_reminders_enabled: profile?.email_reminders_enabled ?? emailRemindersEnabled,
      today_section_order: normalizedOrder,
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setTodaySectionOrder(normalizedOrder);
    setDraftTodaySectionOrder(normalizedOrder);
    setSectionOrderEditing(false);
    setProfile((current) => ({
      user_id: session.user.id,
      email: session.user.email ?? current?.email ?? null,
      time_zone: current?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      reminder_time: current?.reminder_time ?? reminderTime,
      email_reminders_enabled: current?.email_reminders_enabled ?? emailRemindersEnabled,
      today_task_view: current?.today_task_view ?? savedTodayTaskView,
      today_section_order: normalizedOrder,
    }));
    setMessage("오늘 화면 순서를 저장했습니다.");
  }

  function cancelTodaySectionOrderEditing() {
    setDraftTodaySectionOrder(todaySectionOrder);
    setDraggingSectionId(null);
    setSectionOrderEditing(false);
  }

  function startTodoEditing(todo: StudyTodo) {
    setSelectedTodoDate(todo.local_date);
    setCalendarMonth(todo.local_date.slice(0, 7));
    setEditingTodoId(todo.id);
    setTodoDraft(todo.title);

    const hasTime = Boolean(todo.start_time && todo.end_time);
    setTodoTimeEnabled(hasTime);
    setTodoStartTime(todo.start_time?.slice(0, 5) ?? "09:00");
    setTodoEndTime(todo.end_time?.slice(0, 5) ?? "10:00");
    setTodoGoalId(todo.goal_id ?? "");

    if (isWeeklyTodo(todo)) {
      setTodoRepeatMode("weekly");
      setTodoRepeatForever(Boolean(todo.repeat_forever));
      setTodoRepeatEndDate(todo.repeat_until ?? getForeverRepeatEndDate(todo.local_date));
      setTodoRepeatWeekdays(normalizeTodoRepeatWeekdays(todo.repeat_weekdays));
    } else {
      setTodoRepeatMode("single");
      setTodoRepeatForever(false);
      setTodoRepeatEndDate(getDefaultRepeatEndDate(todo.local_date));
      setTodoRepeatWeekdays([getWeekdayFromDateKey(todo.local_date)]);
    }

    setTodoModalOpen(true);
  }

  function toggleTodoRepeatWeekday(weekday: number) {
    setTodoRepeatWeekdays((current) => {
      if (current.includes(weekday)) {
        return current.filter((item) => item !== weekday);
      }
      return [...current, weekday].sort((left, right) => left - right);
    });
  }

  function toggleSessionTodoSelection(todoId: string) {
    setSelectedSessionTodoIds((current) =>
      current.includes(todoId)
        ? current.filter((item) => item !== todoId)
        : [...current, todoId],
    );
  }

  function openSessionTodoSelection(cameraReadyOverride: boolean) {
    setSessionTodoStartRequest({ cameraReadyOverride });
    setSelectedSessionTodoIds([]);
    setSessionTodoModalOpen(true);
  }

  function closeSessionTodoSelection() {
    if (sessionTodoStartRequest?.cameraReadyOverride && !activeSession) {
      stopCameraMonitoring({ recordEvent: false });
      cameraSessionStartingRef.current = false;
    }
    setSessionTodoModalOpen(false);
    setSessionTodoStartRequest(null);
    setSelectedSessionTodoIds([]);
    setSessionTodoDraft("");
  }

  async function confirmSessionTodoSelection() {
    if (selectedSessionTodoIds.length === 0) {
      setMessage("이번 세션에서 할 일을 1개 이상 선택하세요.");
      return;
    }

    const request = sessionTodoStartRequest;
    setSessionTodoModalOpen(false);
    setSessionTodoStartRequest(null);
    await startTimer(request?.cameraReadyOverride ?? false, selectedSessionTodoIds);
  }

  function getNextTodoPositions(excludedTodoIds = new Set<string>()) {
    const nextPositionsByDate = new Map<string, number>();
    for (const todo of studyTodos) {
      if (excludedTodoIds.has(todo.id)) continue;
      nextPositionsByDate.set(
        todo.local_date,
        Math.max(nextPositionsByDate.get(todo.local_date) ?? 0, todo.position + 1),
      );
    }
    return nextPositionsByDate;
  }

  function buildTodoInsertRows({
    targetDates,
    title,
    userId,
    schedule,
    repeatGroupId,
    repeatMode,
    repeatWeekdays,
    repeatUntil,
    repeatForever,
    goalId,
    excludedTodoIds = new Set<string>(),
  }: {
    targetDates: string[];
    title: string;
    userId: string;
    schedule: { startTime: string | null; endTime: string | null };
    repeatGroupId: string | null;
    repeatMode: TodoRepeatMode;
    repeatWeekdays: number[];
    repeatUntil: string | null;
    repeatForever: boolean;
    goalId: string | null;
    excludedTodoIds?: Set<string>;
  }) {
    const nextPositionsByDate = getNextTodoPositions(excludedTodoIds);
    return targetDates.map((localDate) => {
      const position = nextPositionsByDate.get(localDate) ?? 0;
      nextPositionsByDate.set(localDate, position + 1);
      return {
        user_id: userId,
        local_date: localDate,
        title,
        start_time: schedule.startTime,
        end_time: schedule.endTime,
        goal_id: goalId,
        repeat_group_id: repeatGroupId,
        repeat_mode: repeatMode,
        repeat_weekdays: repeatMode === "weekly" ? repeatWeekdays : [],
        repeat_until: repeatMode === "weekly" ? repeatUntil : null,
        repeat_forever: repeatMode === "weekly" ? repeatForever : false,
        position,
      };
    });
  }

  async function addSessionTodo() {
    if (!session?.user.id) return;

    const title = normalizeSessionTodoDraft(sessionTodoDraft);
    if (!title) {
      setMessage("이번 세션에 추가할 할 일을 입력하세요.");
      return;
    }

    const rows = buildTodoInsertRows({
      targetDates: [todayDateKey],
      title,
      userId: session.user.id,
      schedule: { startTime: null, endTime: null },
      repeatGroupId: null,
      repeatMode: "single",
      repeatWeekdays: [],
      repeatUntil: null,
      repeatForever: false,
      goalId: activeGoal?.id ?? null,
    });

    setSessionTodoAddBusy(true);
    const { data, error } = await supabase
      .from("study_todos")
      .insert(rows)
      .select("*")
      .single();
    setSessionTodoAddBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data) {
      const insertedTodo = data as StudyTodo;
      setStudyTodos((current) => sortTodos([insertedTodo, ...current]));
      setSelectedSessionTodoIds((current) =>
        current.includes(insertedTodo.id) ? current : [...current, insertedTodo.id],
      );
      setSessionTodoDraft("");
      setMessage("이번 세션 할 일을 추가했습니다.");
    }
  }

  async function saveTodo() {
    if (!session?.user.id) return;

    const title = todoDraft.trim();
    if (!title) {
      setMessage("할 일을 입력하세요.");
      return;
    }

    const schedule = normalizeTodoSchedule({
      enabled: todoTimeEnabled,
      startTime: todoStartTime,
      endTime: todoEndTime,
    });
    if (!schedule.ok) {
      setMessage(schedule.message);
      return;
    }

    const repeatWeekdays = normalizeTodoRepeatWeekdays(todoRepeatWeekdays);
    const repeatEndDateForGeneration = todoRepeatForever
      ? getForeverRepeatEndDate(selectedTodoDate)
      : todoRepeatEndDate;
    const candidateDates =
      todoRepeatMode === "weekly"
        ? buildRecurringTodoDates({
            startDate: selectedTodoDate,
            endDate: repeatEndDateForGeneration,
            weekdays: repeatWeekdays,
          })
        : [selectedTodoDate];

    if (candidateDates.length === 0) {
      setMessage("반복할 요일과 종료일을 확인하세요.");
      return;
    }

    if (editingTodo) {
      await updateTodo(editingTodo, title, schedule, candidateDates, repeatWeekdays);
      return;
    }

    const targetDates = filterNewTodoDates({
      dates: candidateDates,
      title,
      existingTodos: studyTodos,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    });

    if (targetDates.length === 0) {
      setMessage("이미 같은 날짜에 같은 할 일이 등록되어 있습니다.");
      return;
    }

    const repeatGroupId = todoRepeatMode === "weekly" ? crypto.randomUUID() : null;
    const rows = buildTodoInsertRows({
      targetDates,
      title,
      userId: session.user.id,
      schedule,
      repeatGroupId,
      repeatMode: todoRepeatMode,
      repeatWeekdays,
      repeatUntil: todoRepeatMode === "weekly" && !todoRepeatForever ? todoRepeatEndDate : null,
      repeatForever: todoRepeatMode === "weekly" ? todoRepeatForever : false,
      goalId: todoGoalId || null,
    });

    setTodoBusy(true);
    const { data, error } = await supabase
      .from("study_todos")
      .insert(rows)
      .select("*");
    setTodoBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data?.length) {
      setStudyTodos((current) => sortTodos([...(data as StudyTodo[]), ...current]));
    }
    const focusDate = getTodoSaveFocusDate({ selectedDate: selectedTodoDate, targetDates });
    setSelectedTodoDate(focusDate);
    setCalendarMonth(focusDate.slice(0, 7));
    setTodoDraft("");
    closeTodoModal();
    setMessage(
      todoRepeatMode === "weekly"
        ? `${targetDates.length}개 날짜에 반복 할 일을 저장했습니다.`
        : `${formatTodoDate(selectedTodoDate)} 할 일을 저장했습니다.`,
    );
  }

  async function updateTodo(
    todo: StudyTodo,
    title: string,
    schedule: { startTime: string | null; endTime: string | null },
    targetDates: string[],
    repeatWeekdays: number[],
  ) {
    if (!session?.user.id) return;

    setTodoBusy(true);
    try {
      if (todoRepeatMode === "single") {
        const { data, error } = await supabase
          .from("study_todos")
          .update({
            title,
            start_time: schedule.startTime,
            end_time: schedule.endTime,
            goal_id: todoGoalId || null,
            repeat_group_id: null,
            repeat_mode: "single",
            repeat_weekdays: [],
            repeat_until: null,
            repeat_forever: false,
          })
          .eq("id", todo.id)
          .select("*")
          .single();

        if (error) throw new Error(error.message);

        if (todo.repeat_group_id) {
          const { error: deleteError } = await supabase
            .from("study_todos")
            .delete()
            .eq("repeat_group_id", todo.repeat_group_id)
            .neq("id", todo.id);
          if (deleteError) throw new Error(deleteError.message);
        }

        const updatedTodo = data as StudyTodo;
        setStudyTodos((current) =>
          sortTodos(
            current
              .filter((item) => !todo.repeat_group_id || item.id === todo.id || item.repeat_group_id !== todo.repeat_group_id)
              .map((item) => (item.id === todo.id ? updatedTodo : item)),
          ),
        );
        setSelectedTodoDate(updatedTodo.local_date);
        setCalendarMonth(updatedTodo.local_date.slice(0, 7));
        setMessage(`${formatTodoDate(updatedTodo.local_date)} 할 일을 수정했습니다.`);
        closeTodoModal();
        return;
      }

      const repeatGroupId = todo.repeat_group_id ?? crypto.randomUUID();
      const targetDateSet = new Set(targetDates);
      const groupTodos = todo.repeat_group_id
        ? studyTodos.filter((item) => item.repeat_group_id === todo.repeat_group_id)
        : [todo];
      const groupTodoIds = new Set(groupTodos.map((item) => item.id));
      const updateIds = groupTodos.filter((item) => targetDateSet.has(item.local_date)).map((item) => item.id);
      const removeIds = groupTodos.filter((item) => !targetDateSet.has(item.local_date)).map((item) => item.id);
      const existingTargetDates = new Set(
        groupTodos.filter((item) => targetDateSet.has(item.local_date)).map((item) => item.local_date),
      );
      const missingDates = targetDates.filter((dateKey) => !existingTargetDates.has(dateKey));

      const updatePayload = {
        title,
        start_time: schedule.startTime,
        end_time: schedule.endTime,
        goal_id: todoGoalId || null,
        repeat_group_id: repeatGroupId,
        repeat_mode: "weekly",
        repeat_weekdays: repeatWeekdays,
        repeat_until: todoRepeatForever ? null : todoRepeatEndDate,
        repeat_forever: todoRepeatForever,
      };
      const updatedRows: StudyTodo[] = [];
      const insertedRows: StudyTodo[] = [];

      if (updateIds.length > 0) {
        const { data, error } = await supabase
          .from("study_todos")
          .update(updatePayload)
          .in("id", updateIds)
          .select("*");
        if (error) throw new Error(error.message);
        updatedRows.push(...((data ?? []) as StudyTodo[]));
      }

      if (missingDates.length > 0) {
        const rows = buildTodoInsertRows({
          targetDates: missingDates,
          title,
          userId: session.user.id,
          schedule,
          repeatGroupId,
          repeatMode: "weekly",
          repeatWeekdays,
          repeatUntil: todoRepeatForever ? null : todoRepeatEndDate,
          repeatForever: todoRepeatForever,
          goalId: todoGoalId || null,
          excludedTodoIds: groupTodoIds,
        });
        const { data, error } = await supabase.from("study_todos").insert(rows).select("*");
        if (error) throw new Error(error.message);
        insertedRows.push(...((data ?? []) as StudyTodo[]));
      }

      if (removeIds.length > 0) {
        const { error } = await supabase.from("study_todos").delete().in("id", removeIds);
        if (error) throw new Error(error.message);
      }

      const touchedIds = new Set([...updateIds, ...removeIds]);
      setStudyTodos((current) =>
        sortTodos([
          ...current.filter((item) => !touchedIds.has(item.id)),
          ...updatedRows,
          ...insertedRows,
        ]),
      );
      const focusDate = getTodoSaveFocusDate({ selectedDate: selectedTodoDate, targetDates });
      setSelectedTodoDate(focusDate);
      setCalendarMonth(focusDate.slice(0, 7));
      setMessage(`${targetDates.length}개 날짜의 반복 할 일을 수정했습니다.`);
      closeTodoModal();
    } catch (error) {
      setMessage(formatNotificationError(error));
    } finally {
      setTodoBusy(false);
    }
  }

  async function toggleTodo(todo: StudyTodo) {
    const nextCompleted = !todo.is_completed;
    setTodoBusy(true);
    const { error } = await supabase
      .from("study_todos")
      .update({ is_completed: nextCompleted })
      .eq("id", todo.id);
    setTodoBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setStudyTodos((current) =>
      current.map((item) =>
        item.id === todo.id ? { ...item, is_completed: nextCompleted } : item,
      ),
    );

    if (activeSession && studySessionTodoLinks.some((link) => link.session_id === activeSession.id && link.todo_id === todo.id)) {
      const { data: linkData, error: linkError } = await supabase
        .from("study_session_todos")
        .update({ completed_during_session: nextCompleted })
        .eq("session_id", activeSession.id)
        .eq("todo_id", todo.id)
        .select("*");

      if (!linkError && linkData) {
        const updatedLinks = linkData as StudySessionTodoLink[];
        const updatedIds = new Set(updatedLinks.map((link) => link.id));
        setStudySessionTodoLinks((current) => [
          ...updatedLinks,
          ...current.filter((link) => !updatedIds.has(link.id)),
        ]);
      }
    }
  }

  async function deleteTodo(todo: StudyTodo) {
    const deleteRepeatGroup =
      Boolean(todo.repeat_group_id) &&
      window.confirm(
        "이 반복 일정 전체를 삭제할까요?\n확인: 모든 날짜의 반복 일정 삭제\n취소: 이 날짜의 할 일만 삭제",
      );

    setTodoBusy(true);
    const deleteQuery = supabase.from("study_todos").delete();
    const { error } =
      deleteRepeatGroup && todo.repeat_group_id
        ? await deleteQuery.eq("repeat_group_id", todo.repeat_group_id)
        : await deleteQuery.eq("id", todo.id);
    setTodoBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setStudyTodos((current) =>
      deleteRepeatGroup && todo.repeat_group_id
        ? current.filter((item) => item.repeat_group_id !== todo.repeat_group_id)
        : current.filter((item) => item.id !== todo.id),
    );
    setMessage(deleteRepeatGroup ? "반복 일정 전체를 삭제했습니다." : "할 일을 삭제했습니다.");
  }

  function openNewGoalModal() {
    setEditingGoalId(null);
    setGoalTitle("");
    setGoalTargetDate(addDaysToDateKey(todayDateKey, 30));
    setGoalLinkedTodoIds([]);
    setGoalModalOpen(true);
  }

  function openGoalEditor(goal: StudyGoal) {
    setEditingGoalId(goal.id);
    setGoalTitle(goal.title);
    setGoalTargetDate(goal.target_date);
    setGoalLinkedTodoIds(studyTodos.filter((todo) => todo.goal_id === goal.id).map((todo) => todo.id));
    setGoalModalOpen(true);
  }

  function closeGoalModal() {
    setGoalModalOpen(false);
    setEditingGoalId(null);
  }

  function toggleGoalLinkedTodo(todoId: string) {
    setGoalLinkedTodoIds((current) =>
      current.includes(todoId) ? current.filter((id) => id !== todoId) : [...current, todoId],
    );
  }

  async function applyGoalTodoLinks(goalId: string, selectedTodoIds: string[]) {
    const selectedSet = new Set(selectedTodoIds);
    const currentlyLinkedIds = studyTodos.filter((todo) => todo.goal_id === goalId).map((todo) => todo.id);
    const removeIds = currentlyLinkedIds.filter((todoId) => !selectedSet.has(todoId));

    if (removeIds.length > 0) {
      const { error } = await supabase.from("study_todos").update({ goal_id: null }).in("id", removeIds);
      if (error) throw new Error(error.message);
    }

    if (selectedTodoIds.length > 0) {
      const { error } = await supabase.from("study_todos").update({ goal_id: goalId }).in("id", selectedTodoIds);
      if (error) throw new Error(error.message);
    }

    setStudyTodos((current) =>
      current.map((todo) => {
        if (selectedSet.has(todo.id)) return { ...todo, goal_id: goalId };
        if (removeIds.includes(todo.id)) return { ...todo, goal_id: null };
        return todo;
      }),
    );
  }

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user.id) return;

    const title = goalTitle.trim();
    if (!title) {
      setMessage("목표 이름을 입력하세요.");
      return;
    }
    if (!goalTargetDate) {
      setMessage("목표 날짜를 선택하세요.");
      return;
    }

    setGoalBusy(true);
    try {
      const payload = {
        user_id: session.user.id,
        title,
        target_date: goalTargetDate,
        target_study_seconds: 0,
        status: "active",
      };
      const goalResult = editingGoalId
        ? await supabase.from("study_goals").update(payload).eq("id", editingGoalId).select("*").single()
        : await supabase.from("study_goals").insert(payload).select("*").single();

      if (goalResult.error) throw new Error(goalResult.error.message);
      const savedGoal = goalResult.data as StudyGoal;
      await applyGoalTodoLinks(savedGoal.id, goalLinkedTodoIds);
      setStudyGoals((current) =>
        sortStudyGoals(
          editingGoalId
            ? current.map((goal) => (goal.id === savedGoal.id ? savedGoal : goal))
            : [savedGoal, ...current],
        ),
      );
      closeGoalModal();
      setMessage(editingGoalId ? "목표를 수정했습니다." : "목표를 만들었습니다.");
    } catch (error) {
      setMessage(formatNotificationError(error));
    } finally {
      setGoalBusy(false);
    }
  }

  async function updateGoalStatus(goal: StudyGoal, status: StudyGoal["status"]) {
    setGoalBusy(true);
    const { data, error } = await supabase.from("study_goals").update({ status }).eq("id", goal.id).select("*").single();
    setGoalBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setStudyGoals((current) => sortStudyGoals(current.map((item) => (item.id === goal.id ? (data as StudyGoal) : item))));
    setMessage(status === "completed" ? "목표를 완료 처리했습니다." : "목표 상태를 변경했습니다.");
  }

  async function deleteGoal(goal: StudyGoal) {
    setGoalBusy(true);
    try {
      const linkedTodoIds = studyTodos.filter((todo) => todo.goal_id === goal.id).map((todo) => todo.id);
      if (linkedTodoIds.length > 0) {
        const { error: unlinkError } = await supabase.from("study_todos").update({ goal_id: null }).in("id", linkedTodoIds);
        if (unlinkError) throw new Error(unlinkError.message);
      }
      const { error } = await supabase.from("study_goals").delete().eq("id", goal.id);
      if (error) throw new Error(error.message);

      setStudyTodos((current) => current.map((todo) => (todo.goal_id === goal.id ? { ...todo, goal_id: null } : todo)));
      setStudyGoals((current) => current.filter((item) => item.id !== goal.id));
      setMessage("목표를 삭제했습니다.");
    } catch (error) {
      setMessage(formatNotificationError(error));
    } finally {
      setGoalBusy(false);
    }
  }

  async function saveNotificationSettings() {
    if (!session?.user.id) return;

    const nextSlackChannelId = normalizeSlackChannelId(slackChannelId);
    if (nextSlackChannelId && !isValidSlackChannelId(nextSlackChannelId)) {
      setMessage("Slack Channel ID 형식을 확인하세요. C 또는 G로 시작하는 채널 ID여야 합니다.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      email: session.user.email ?? profile?.email ?? null,
      reminder_time: reminderTime,
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      email_reminders_enabled: emailRemindersEnabled,
    });

    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }

    try {
      if (nextSlackChannelId) {
        setSlackStatus(await saveSlackNotificationTarget(session.user.id, nextSlackChannelId));
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
      await refreshSlackStatus(session.user.id);
    }
  }

  function startAlarmEditing() {
    setReminderTime((profile?.reminder_time ?? reminderTime).slice(0, 5));
    setEmailRemindersEnabled(profile?.email_reminders_enabled ?? emailRemindersEnabled);
    setAlarmEditing(true);
  }

  function cancelAlarmEditing() {
    setReminderTime((profile?.reminder_time ?? DEFAULT_WEEKDAY_REMINDER_TIME).slice(0, 5));
    setEmailRemindersEnabled(profile?.email_reminders_enabled ?? true);
    setAlarmEditing(false);
  }

  async function saveAlarmSettings() {
    if (!session?.user.id) return;

    const nextReminderTime = reminderTime.slice(0, 5);
    const nextTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      email: session.user.email ?? profile?.email ?? null,
      reminder_time: nextReminderTime,
      time_zone: nextTimeZone,
      email_reminders_enabled: emailRemindersEnabled,
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setProfile((current) => ({
      user_id: session.user.id,
      email: session.user.email ?? current?.email ?? null,
      time_zone: nextTimeZone,
      reminder_time: nextReminderTime,
      email_reminders_enabled: emailRemindersEnabled,
      today_task_view: current?.today_task_view ?? savedTodayTaskView,
      today_section_order: current?.today_section_order ?? todaySectionOrder,
    }));
    setReminderTime(nextReminderTime);
    setAlarmEditing(false);
    setMessage("알람 설정을 저장했습니다.");
  }

  async function saveSlackChannelSettings() {
    if (!session?.user.id) return;

    const nextSlackChannelId = normalizeSlackChannelId(slackChannelId);
    if (!nextSlackChannelId) {
      setMessage("Slack Channel ID를 입력하세요.");
      return;
    }
    if (!isValidSlackChannelId(nextSlackChannelId)) {
      setMessage("Slack Channel ID 형식을 확인하세요. C 또는 G로 시작하는 채널 ID여야 합니다.");
      return;
    }

    setBusy(true);
    try {
      const nextStatus = await saveSlackNotificationTarget(session.user.id, nextSlackChannelId);
      setSlackStatus(nextStatus);
      setSlackChannelId(nextStatus.channelId);
      setMessage("Slack Channel ID를 저장했습니다. 이제 Slack 테스트 알림을 보낼 수 있습니다.");
    } catch (error) {
      setMessage(formatNotificationError(error));
    } finally {
      setBusy(false);
      await refreshSlackStatus(session.user.id);
    }
  }

  async function sendSlackTestNotification() {
    if (!session?.user.id) return;

    if (!slackStatus?.connected) {
      setMessage("Slack Channel ID를 저장한 뒤 테스트 알림을 보낼 수 있습니다.");
      return;
    }

    setBusy(true);
    try {
      const result = await sendSlackTestAlarm(session);
      const todoMessage =
        result.todoCount > 0
          ? `오늘 할 일 ${result.todoCount}개를 포함해 Slack 테스트 알림을 보냈습니다.`
          : "Slack 테스트 알림을 보냈습니다. 오늘 할 일은 아직 없습니다.";
      setMessage(todoMessage);
      await loadDashboard(session.user.id);
    } catch (error) {
      setMessage(formatNotificationError(error));
    } finally {
      setBusy(false);
    }
  }

  function persistSessionLease(sessionId: string, deadlineMs: number) {
    if (!session?.user.id) return;

    window.localStorage.setItem(
      getSessionLeaseStorageKey({
        userId: session.user.id,
        sessionId,
      }),
      String(deadlineMs),
    );
    setSessionLease({ sessionId, deadlineMs });
  }

  function forgetSessionLease(sessionId: string) {
    if (!session?.user.id) return;

    window.localStorage.removeItem(
      getSessionLeaseStorageKey({
        userId: session.user.id,
        sessionId,
      }),
    );
    setSessionLease((current) => (current?.sessionId === sessionId ? null : current));
  }

  function getStoredStudySessionActivityMs(sessionId: string) {
    if (!session?.user.id) return null;

    return parseStudySessionActivityMs(
      window.localStorage.getItem(
        getStudySessionActivityStorageKey({
          userId: session.user.id,
          sessionId,
        }),
      ),
    );
  }

  function persistStudySessionActivity(sessionId: string, activityMs = Date.now()) {
    if (!session?.user.id) return;

    window.localStorage.setItem(
      getStudySessionActivityStorageKey({
        userId: session.user.id,
        sessionId,
      }),
      String(Math.floor(activityMs)),
    );
  }

  function forgetStudySessionActivity(sessionId: string) {
    if (!session?.user.id) return;

    window.localStorage.removeItem(
      getStudySessionActivityStorageKey({
        userId: session.user.id,
        sessionId,
      }),
    );
  }

  function extendSessionLease() {
    if (!activeSession) return;

    persistSessionLease(activeSession.id, createSessionLeaseDeadlineMs(Date.now()));
    setMessage("세션을 2시간 더 유지합니다.");
  }

  function openRecoveryRoutineModal(request: StudyRecoveryRequest, options: { auto?: boolean } = {}) {
    if (!options.auto) {
      recoveryModalDismissedIdsRef.current.delete(request.id);
    }
    setRecoveryModalRequest(request);
    setRecoveryReason(request.reason ?? "");
    setMakeupTodoTitle(request.makeup_todo_title ?? "");
    setPledgeTodoTitle(request.pledge_todo_title ?? "");
  }

  function closeRecoveryRoutineModal() {
    if (recoveryModalRequest) {
      recoveryModalDismissedIdsRef.current.add(recoveryModalRequest.id);
    }
    setResumeStartAfterRecoveryUnlock(false);
    setRecoveryModalRequest(null);
  }

  async function submitRecoveryRoutine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user.id || !recoveryModalRequest) return;

    const submittedRequest = recoveryModalRequest;
    const remainingRequests = pendingRecoveryRequests.filter((request) => request.id !== submittedRequest.id);
    const nextBlockingRequest = remainingRequests[0] ?? null;
    const shouldResumeStart = resumeStartAfterRecoveryUnlock && !nextBlockingRequest;

    setRecoverySubmitBusy(true);
    const { error } = await supabase.rpc("submit_study_recovery_request", {
      p_request_id: submittedRequest.id,
      p_reason: recoveryReason,
      p_makeup_todo_title: makeupTodoTitle,
      p_pledge_todo_title: pledgeTodoTitle,
    });
    setRecoverySubmitBusy(false);

    if (error) {
      setMessage(formatNotificationError(error));
      return;
    }

    setRecoveryUnlockRefreshing(shouldResumeStart);
    recoveryModalDismissedIdsRef.current.delete(submittedRequest.id);
    setStudyRecoveryRequests((requests) =>
      requests.map((request) =>
        request.id === submittedRequest.id
          ? {
              ...request,
              status: "submitted",
              reason: recoveryReason,
              makeup_todo_title: makeupTodoTitle,
              pledge_todo_title: pledgeTodoTitle,
            }
          : request,
      ),
    );
    setRecoveryModalRequest(null);
    setRecoveryReason("");
    setMakeupTodoTitle("");
    setPledgeTodoTitle("");
    if (nextBlockingRequest) {
      setMessage(
        `회복 루틴을 제출했습니다. 아직 ${remainingRequests.length}건이 남아 있습니다: ${formatRecoveryRequestSummary(nextBlockingRequest)}`,
      );
      openRecoveryRoutineModal(nextBlockingRequest, { auto: true });
    } else if (remainingRequests.length > 0) {
      setMessage(
        `회복 루틴을 제출했습니다. 아직 ${remainingRequests.length}건이 남아 있습니다. 다음 회복 루틴을 제출해야 공부를 다시 시작할 수 있습니다.`,
      );
    } else {
      setMessage("회복 루틴을 제출했습니다. 다시 공부를 시작할 수 있습니다.");
    }

    try {
      await loadDashboard(session.user.id);
    } finally {
      if (shouldResumeStart) {
        setRecoveryUnlockRefreshing(false);
      }
    }
  }

  async function startTimer(cameraReadyOverride = false, selectedTodoIds?: string[]) {
    if (blockingRecoveryRequests.length > 0) {
      setResumeStartAfterRecoveryUnlock(true);
      openRecoveryRoutineModal(blockingRecoveryRequests[0]);
      setMessage("회복 루틴 필요: Slack에서 사유와 보충 계획을 제출해야 다음 공부 세션을 시작할 수 있습니다.");
      return;
    }

    const startGate = canStartStudySessionWithCamera({
      activeSession,
      cameraEnabled: cameraEnabled || cameraReadyOverride,
      cameraRequired: true,
    });

    if (!startGate.allowed) {
      if (startGate.reason === "camera-required") {
        setCameraSetupPrompt({ mode: "start" });
        setCameraMessage("출석하려면 카메라 감시를 먼저 켜야 합니다.");
        return;
      }

      setMessage("이미 진행 중인 집중 세션이 있습니다.");
      return;
    }

    const todoSelection = shouldRequestSessionTodoSelection({
      activeSession: Boolean(activeSession),
      incompleteTodayTodos,
      selectedTodoIds,
    });

    if (todoSelection.required) {
      if (todoSelection.reason === "no-todos") {
        setMessage("이번 세션에서 할 일을 추가하거나 선택하세요.");
        openSessionTodoSelection(cameraReadyOverride);
        return;
      }

      openSessionTodoSelection(cameraReadyOverride);
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.rpc("start_study_session");
    setBusy(false);
    if (error) {
      if (error.message.includes("Recovery routine required")) {
        setMessage("회복 루틴 필요: Slack에서 회복 루틴을 제출한 뒤 다시 시작하세요.");
        if (session?.user.id) {
          await loadDashboard(session.user.id);
        }
      } else {
        setMessage(error.message);
      }
      if (cameraSessionStartingRef.current && cameraEnabled && !activeSession) {
        stopCameraMonitoring({ recordEvent: false });
      }
      cameraSessionStartingRef.current = false;
    } else if (session?.user.id) {
      let startMessage = "집중 세션을 시작했습니다.";
      if (data) {
        const startedSession = data as StudySession;
        persistSessionLease(startedSession.id, createSessionLeaseDeadlineMs(Date.now()));
        persistStudySessionActivity(startedSession.id);
        setStudySessions((current) => [
          startedSession,
          ...current.filter((item) => item.id !== startedSession.id),
        ]);
        const linkRows = buildSessionTodoLinkRows({
          userId: session.user.id,
          sessionId: startedSession.id,
          todoIds: selectedTodoIds ?? [],
        });
        if (linkRows.length > 0) {
          const { data: linkData, error: linkError } = await supabase
            .from("study_session_todos")
            .insert(linkRows)
            .select("*");
          if (linkError) {
            startMessage = `세션은 시작됐지만 할 일 연결에 실패했습니다: ${linkError.message}`;
          } else if (linkData) {
            setStudySessionTodoLinks((current) => [
              ...((linkData ?? []) as StudySessionTodoLink[]),
              ...current.filter((link) => link.session_id !== startedSession.id),
            ]);
            startMessage = `집중 세션을 시작했습니다. 이번 세션 할 일 ${linkRows.length}개를 연결했습니다.`;
          }
        }
        setNowMs(Date.now());
        if (cameraEnabled || cameraReadyOverride) {
          cameraSessionIdRef.current = startedSession.id;
          rememberCameraMonitoringIntent(startedSession.id);
          await recordCameraPresenceEvent(session.user.id, startedSession.id, "camera_started", {
            metadata: { source: "web-camera", requiredForAttendance: true },
          }).catch((error) => {
            setCameraMessage(formatNotificationError(error));
          });
          setCameraMessage("카메라 감시 중");
        }
      }
      setMessage(startMessage);
      setCameraSetupPrompt(null);
      cameraSessionStartingRef.current = false;
      await loadDashboard(session.user.id);
    }
  }

  async function endTimer(options: { excludedSeconds?: number; successMessage?: string } = {}) {
    if (!activeSession) return;

    const sessionTodoSummary = summarizeSessionTodos(activeSessionTodos);
    const excludedSeconds = Math.max(
      0,
      Math.floor(options.excludedSeconds ?? getCurrentExcludedSeconds(presenceStateRef.current)),
    );
    setBusy(true);
    const { error } = await supabase.rpc("end_study_session", {
      p_session_id: activeSession.id,
      p_excluded_seconds: excludedSeconds,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
    } else if (session?.user.id) {
      forgetCameraMonitoringIntent();
      forgetSessionLease(activeSession.id);
      forgetStudySessionActivity(activeSession.id);
      setMessage(options.successMessage ?? sessionTodoSummary.message);
      await loadDashboard(session.user.id);
    }
  }

  function cleanupCameraResources() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    presenceDetectorRef.current?.close();
    presenceDetectorRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function resetPresenceState(now = Date.now()) {
    const nextState = createPresenceState(now);
    presenceStateRef.current = nextState;
    setPresenceState(nextState);
  }

  function markCameraHealthIssue(reason: string) {
    resetPresenceState();
    setCameraStatus(reason === "no-current-frame" || reason === "no-video-size" ? "starting" : "error");
    setCameraMessage(cameraHealthMessage(reason));
  }

  async function handleCameraFrameHealthIssue(reason: string) {
    const recovery = updateCameraFrameRecoveryState(cameraFrameRecoveryStateRef.current, {
      reason,
      nowMs: Date.now(),
    });
    cameraFrameRecoveryStateRef.current = recovery.state;

    if (recovery.action === "restart") {
      if (cameraRecoveryInFlightRef.current) {
        return;
      }
      cameraRecoveryInFlightRef.current = true;
      setCameraStatus("starting");
      setCameraMessage("카메라 영상이 멈춰 다시 연결하고 있습니다.");
      try {
        await restartCameraMonitoring();
      } finally {
        cameraRecoveryInFlightRef.current = false;
      }
      return;
    }

    if (recovery.action === "fail") {
      cleanupCameraResources();
      cameraFrameRecoveryStateRef.current = createCameraFrameRecoveryState();
      setCameraEnabled(false);
      setCameraStatus("error");
      setCameraMessage("카메라 영상을 불러오지 못했습니다. 카메라 감시를 다시 켜주세요.");
      resetPresenceState();
      return;
    }

    markCameraHealthIssue(reason);
  }

  function readCameraFramePixels(video: HTMLVideoElement) {
    const canvas = cameraFrameCanvasRef.current ?? document.createElement("canvas");
    cameraFrameCanvasRef.current = canvas;
    canvas.width = 32;
    canvas.height = 24;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  }

  function rememberCameraMonitoringIntent(sessionId: string) {
    if (!session?.user.id || !sessionId) return;

    window.localStorage.setItem(
      cameraMonitoringIntentKey(session.user.id),
      JSON.stringify(
        createCameraMonitoringIntent({
          userId: session.user.id,
          sessionId,
          savedAtMs: Date.now(),
        }),
      ),
    );
  }

  function forgetCameraMonitoringIntent() {
    if (!session?.user.id) return;

    window.localStorage.removeItem(cameraMonitoringIntentKey(session.user.id));
  }

  function stopCameraMonitoring({ recordEvent = false }: { recordEvent?: boolean } = {}) {
    const stoppedSessionId = cameraSessionIdRef.current;
    cleanupCameraResources();
    cameraSessionIdRef.current = null;
    warningInFlightRef.current = false;
    cameraRecoveryInFlightRef.current = false;
    cameraFrameRecoveryStateRef.current = createCameraFrameRecoveryState();
    setCameraEnabled(false);
    setCameraStatus("idle");
    setCameraMessage("");
    setCameraDiagnosticReason(null);
    resetPresenceState();
    if (recordEvent) {
      forgetCameraMonitoringIntent();
    }

    if (recordEvent && session?.user.id && stoppedSessionId) {
      void recordCameraPresenceEvent(session.user.id, stoppedSessionId, "camera_stopped", {
        metadata: { source: "web-camera" },
      }).catch(() => undefined);
    }
  }

  async function startCameraMonitoring({
    allowWithoutSession = false,
    restart = false,
  }: { allowWithoutSession?: boolean; restart?: boolean } = {}) {
    if (cameraEnabled && !restart) {
      return true;
    }

    if ((!activeSession && !allowWithoutSession) || !session?.user.id) {
      setCameraMessage("공부 세션을 시작한 뒤 카메라 감시를 켤 수 있습니다.");
      return false;
    }

    const support = getCameraSupport(window);
    if (!support.supported) {
      setCameraStatus("error");
      setCameraDiagnosticReason(null);
      setCameraMessage(
        support.reason === "secure-context-required"
          ? "HTTPS 또는 localhost에서만 카메라를 사용할 수 있습니다."
          : "이 브라우저에서는 카메라를 사용할 수 없습니다.",
      );
      return false;
    }

    setCameraStatus("starting");
    setCameraMessage("카메라 준비 중");
    setCameraDiagnosticReason(null);

    try {
      if (restart) {
        cleanupCameraResources();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      presenceDetectorRef.current = await createUpperBodyPresenceDetector();
      cameraSessionIdRef.current = activeSession?.id ?? null;
      if (activeSession?.id) {
        rememberCameraMonitoringIntent(activeSession.id);
      }
      resetPresenceState();
      cameraFrameRecoveryStateRef.current = createCameraFrameRecoveryState();
      setCameraEnabled(true);
      setCameraStatus("watching");
      setCameraMessage("카메라 감시 중");
      setCameraDiagnosticReason("visible-frame");
      if (activeSession) {
        await recordCameraPresenceEvent(session.user.id, activeSession.id, "camera_started", {
          metadata: { source: "web-camera" },
        });
      }
      return true;
    } catch (error) {
      cleanupCameraResources();
      setCameraEnabled(false);
      setCameraStatus("error");
      setCameraDiagnosticReason(
        error instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(error.name)
          ? "permission-denied"
          : "unknown-error",
      );
      setCameraMessage(formatCameraError(error));

      const denied = error instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(error.name);
      if (denied && activeSession) {
        await recordCameraPresenceEvent(session.user.id, activeSession.id, "camera_permission_denied", {
          metadata: { source: "web-camera" },
        }).catch(() => undefined);
      }
      return false;
    }
  }

  async function restartCameraMonitoring() {
    return await startCameraMonitoring({ restart: true });
  }

  async function toggleCameraMonitoring() {
    if (cameraEnabled) {
      stopCameraMonitoring({ recordEvent: true });
      void sendCameraRequiredWarning();
      return;
    }

    await startCameraMonitoring();
  }

  async function confirmCameraSetupPrompt() {
    if (!cameraSetupPrompt) return;

    const promptMode = cameraSetupPrompt.mode;
    cameraSessionStartingRef.current = promptMode === "start";
    const cameraReady = await startCameraMonitoring({ allowWithoutSession: promptMode === "start" });
    if (!cameraReady) {
      cameraSessionStartingRef.current = false;
      return;
    }

    setCameraSetupPrompt(null);
    if (promptMode === "start") {
      await startTimer(true);
    } else {
      cameraSessionStartingRef.current = false;
    }
  }

  async function sendCameraRequiredWarning() {
    if (!activeSession || !session) return;

    const now = Date.now();
    if (now - lastCameraRequiredWarningAtRef.current < cameraRequiredWarningCooldownMs) {
      return;
    }
    lastCameraRequiredWarningAtRef.current = now;

    try {
      const result = await sendCameraPresenceWarning(session, {
        sessionId: activeSession.id,
        absenceSeconds: 0,
        detectedAt: new Date().toISOString(),
        eventType: "camera_required_warning",
      });
      setCameraMessage(
        result.slackSent
          ? "카메라 켜기 경고를 Slack으로 보냈습니다."
          : "카메라 켜기 경고를 기록했습니다. 이 계정에는 Slack Channel ID가 저장되어 있지 않습니다.",
      );
    } catch (error) {
      setCameraMessage(formatNotificationError(error));
    }
  }

  async function sendAbsenceWarning(nextState: PresenceState) {
    if (!activeSession || !session) return;

    warningInFlightRef.current = true;
    setAbsenceWarningPopup({
      absenceSeconds: nextState.absenceSeconds,
      slackSent: false,
      slackMissing: false,
    });

    try {
      const result = await sendCameraPresenceWarning(session, {
        sessionId: activeSession.id,
        absenceSeconds: nextState.absenceSeconds,
        detectedAt: new Date().toISOString(),
      });
      setAbsenceWarningPopup({
        absenceSeconds: nextState.absenceSeconds,
        slackSent: result.slackSent,
        slackMissing: result.slackMissing,
      });
      setCameraMessage(
        result.slackSent
          ? "자리 비움 경고를 Slack으로 보냈습니다."
          : "자리 비움 이벤트를 기록했습니다. 설정에서 Slack Channel ID를 저장하면 Slack으로도 받을 수 있습니다.",
      );
    } catch (error) {
      setCameraMessage(formatNotificationError(error));
    } finally {
      const markedState = markPresenceWarningSent(presenceStateRef.current, { nowMs: Date.now() });
      presenceStateRef.current = markedState;
      setPresenceState(markedState);
      warningInFlightRef.current = false;
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

  async function refreshSlackStatus(userId: string) {
    try {
      const nextStatus = await getSlackNotificationStatus(userId);
      setSlackStatus(nextStatus);
      if (nextStatus.channelId) {
        setSlackChannelId(nextStatus.channelId);
      }
    } catch {
      setSlackStatus(null);
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
            <div className="todo-main">
              <label className="todo-check-row">
                <input
                  type="checkbox"
                  checked={todo.is_completed}
                  disabled={todoBusy}
                  onChange={() => void toggleTodo(todo)}
                />
                <span className="todo-title">{todo.title}</span>
              </label>
              <div className="todo-meta-row" aria-label={`${todo.title} 설정`}>
                {formatTodoScheduleLabel(todo) && (
                  <span className="todo-time-chip">{formatTodoScheduleLabel(todo)}</span>
                )}
                <span className="todo-meta-chip">{formatTodoRepeatLabel(todo)}</span>
                {todo.goal_id && goalTitleById.has(todo.goal_id) && (
                  <span className="todo-goal-chip">{goalTitleById.get(todo.goal_id)}</span>
                )}
              </div>
            </div>
            <div className="todo-actions">
              <button
                className="todo-edit"
                type="button"
                aria-label={`${todo.title} 편집`}
                disabled={todoBusy}
                onClick={() => startTodoEditing(todo)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="todo-delete"
                type="button"
                aria-label={`${todo.title} 삭제`}
                disabled={todoBusy}
                onClick={() => void deleteTodo(todo)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  function renderDailyPlanner() {
    const hasOverlap = dailyPlanner.segments.some((segment) => segment.overlaps);

    return (
      <div className="daily-planner">
        <div className="daily-planner-layout">
          <div className="planner-wheel-card">
            <svg
              className="planner-wheel"
              viewBox="0 0 360 360"
              role="img"
              aria-label="24시간 생활계획표"
              onClick={openPlannerTodoFromClick}
            >
              <circle className="planner-wheel-bg" cx="180" cy="180" r="168" />
              <circle className="planner-wheel-inner" cx="180" cy="180" r="72" />
              {[0, 90, 180, 270].map((angle) => {
                const outer = getPlannerPoint(angle, 171);
                const inner = getPlannerPoint(angle, 74);
                return (
                  <line
                    className="planner-hour-line"
                    key={angle}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                  />
                );
              })}
              {[
                { label: "12AM", angle: 0 },
                { label: "6AM", angle: 90 },
                { label: "12PM", angle: 180 },
                { label: "6PM", angle: 270 },
              ].map((mark) => {
                const point = getPlannerPoint(mark.angle, 150);
                return (
                  <text className="planner-hour-label" key={mark.label} x={point.x} y={point.y}>
                    {mark.label}
                  </text>
                );
              })}
              {dailyPlanner.segments.map((segment: DailyPlannerSegment<StudyTodo>) => {
                const labelPoint = getPlannerLabelPoint(segment.startAngle, segment.endAngle);
                const shortTitle = segment.title.length > 8 ? `${segment.title.slice(0, 8)}...` : segment.title;
                return (
                  <g
                    className={`planner-segment ${segment.overlaps ? "planner-segment-overlap" : ""}`}
                    key={segment.id}
                    onMouseEnter={() => setSelectedPlannerTodoId(segment.id)}
                    onFocus={() => setSelectedPlannerTodoId(segment.id)}
                  >
                    <path
                      d={getPlannerArcPath(segment.startAngle, segment.endAngle)}
                      fill={segment.color}
                      role="button"
                      tabIndex={0}
                      aria-label={`${segment.title} 편집`}
                      onClick={(event) => {
                        event.stopPropagation();
                        startTodoEditing(segment.todo);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          startTodoEditing(segment.todo);
                        }
                      }}
                    />
                    <text className="planner-segment-label" x={labelPoint.x} y={labelPoint.y}>
                      {shortTitle}
                    </text>
                  </g>
                );
              })}
              <circle className="planner-wheel-pin" cx="180" cy="180" r="11" />
            </svg>
            <button
              className="secondary compact-action planner-quick-add"
              type="button"
              onClick={() => openPlannerTodoCreate("09:00")}
            >
              <Plus size={16} />
              일정 추가
            </button>
          </div>

          <div className="planner-detail-panel">
            {selectedPlannerSegment ? (
              <>
                <p className="eyebrow">selected plan</p>
                <h3>{selectedPlannerSegment.title}</h3>
                <p>
                  {selectedPlannerSegment.startTime} - {selectedPlannerSegment.endTime}
                  {selectedPlannerSegment.todo.is_completed ? " · 완료" : " · 미완료"}
                </p>
                {selectedPlannerSegment.overlaps && (
                  <strong className="planner-overlap-note">시간 겹침이 있습니다.</strong>
                )}
                <div className="planner-detail-actions">
                  <button className="secondary compact-action" type="button" onClick={() => startTodoEditing(selectedPlannerSegment.todo)}>
                    <Pencil size={16} />
                    수정
                  </button>
                  <button className="secondary compact-action" type="button" onClick={() => void toggleTodo(selectedPlannerSegment.todo)}>
                    <CheckCircle2 size={16} />
                    완료 체크
                  </button>
                  <button className="todo-delete" type="button" onClick={() => void deleteTodo(selectedPlannerSegment.todo)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">selected plan</p>
                <h3>시간 있는 할 일이 없습니다.</h3>
                <p>원형 빈 시간대를 누르면 해당 시간으로 새 할 일을 만들 수 있습니다.</p>
              </>
            )}
            {hasOverlap && <p className="planner-help">점선 테두리는 서로 겹치는 일정입니다.</p>}
          </div>
        </div>

        <div className="planner-unscheduled">
          <div className="todo-header compact">
            <div>
              <p className="eyebrow">no time</p>
              <h3>시간 없는 할 일</h3>
            </div>
            <button className="secondary compact-action" type="button" onClick={() => selectTodoDate(todayDateKey)}>
              <Plus size={16} />
              추가
            </button>
          </div>
          {renderTodoList(dailyPlanner.unscheduledTodos, "시간 없는 할 일이 없습니다.")}
        </div>
      </div>
    );
  }

  function renderTodaySectionOrderEditor() {
    if (!sectionOrderEditing) {
      return (
        <section className="section-order-toolbar today-ordered-section" style={{ order: 0 }}>
          <button
            className="secondary compact-action"
            type="button"
            onClick={() => {
              setDraftTodaySectionOrder(todaySectionOrder);
              setSectionOrderEditing(true);
            }}
          >
            <GripVertical size={16} />
            화면 순서 편집
          </button>
        </section>
      );
    }

    return (
      <section className="section-order-editor today-ordered-section" style={{ order: 0 }}>
        <div className="history-header">
          <div>
            <p className="eyebrow">dashboard order</p>
            <h2>오늘 화면 순서 편집</h2>
          </div>
          <div className="section-order-actions">
            <button className="primary compact-action" type="button" onClick={saveTodaySectionOrderPreference} disabled={busy}>
              <Save size={16} />
              순서 저장
            </button>
            <button className="secondary compact-action" type="button" onClick={cancelTodaySectionOrderEditing}>
              <X size={16} />
              취소
            </button>
          </div>
        </div>
        <div className="section-order-list" aria-label="오늘 화면 섹션 순서">
          {draftTodaySectionOrder.map((sectionId, index) => (
            <div
              className={`section-order-row ${draggingSectionId === sectionId ? "section-order-row-dragging" : ""}`}
              draggable
              key={sectionId}
              onDragStart={() => setDraggingSectionId(sectionId)}
              onDragEnd={() => setDraggingSectionId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                dropDraftTodaySection(sectionId);
              }}
            >
              <span className="section-order-handle" aria-hidden="true">
                <GripVertical size={18} />
              </span>
              <strong>{todaySectionLabels[sectionId]}</strong>
              <div className="section-order-move">
                <button
                  className="secondary icon-action"
                  type="button"
                  aria-label={`${todaySectionLabels[sectionId]} 위로 이동`}
                  disabled={index === 0}
                  onClick={() => moveDraftTodaySection(sectionId, "up")}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="secondary icon-action"
                  type="button"
                  aria-label={`${todaySectionLabels[sectionId]} 아래로 이동`}
                  disabled={index === draftTodaySectionOrder.length - 1}
                  onClick={() => moveDraftTodaySection(sectionId, "down")}
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderSessionTodoList() {
    if (!activeSession) {
      return null;
    }

    const summary = summarizeSessionTodos(activeSessionTodos);

    return (
      <div className="session-todo-panel" aria-label="이번 세션 할 일">
        <div className="session-todo-head">
          <div>
            <p className="eyebrow">session tasks</p>
            <h3>이번 세션 할 일</h3>
          </div>
          <strong>{summary.completed}/{summary.total} 완료</strong>
        </div>
        {activeSessionTodos.length === 0 ? (
          <p className="todo-empty">이번 세션에 연결된 할 일이 없습니다.</p>
        ) : (
          <ul className="session-todo-list">
            {activeSessionTodos.map((todo) => (
              <li className={`todo-item ${todo.is_completed ? "todo-done" : ""}`} key={todo.id}>
                <div className="todo-main">
                  <label className="todo-check-row">
                    <input
                      type="checkbox"
                      checked={todo.is_completed}
                      disabled={todoBusy}
                      onChange={() => void toggleTodo(todo)}
                    />
                    <span className="todo-title">{todo.title}</span>
                  </label>
                  <div className="todo-meta-row" aria-label={`${todo.title} 설정`}>
                    {formatTodoScheduleLabel(todo) && (
                      <span className="todo-time-chip">{formatTodoScheduleLabel(todo)}</span>
                    )}
                    <span className="todo-meta-chip">{formatTodoRepeatLabel(todo)}</span>
                    {todo.goal_id && goalTitleById.has(todo.goal_id) && (
                      <span className="todo-goal-chip">{goalTitleById.get(todo.goal_id)}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  function getGoalView(goal: StudyGoal) {
    const linkedTodos = getGoalLinkedTodos(goal.id, studyTodos);
    const progress = calculateGoalProgress({
      goal: { ...goal, target_study_seconds: 0 },
      linkedTodos,
      studiedSeconds: 0,
    });
    return { linkedTodos, progress };
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
              <span>{formatTodoWithSchedule(todo)}</span>
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
                <span>
                  {formatTodoDate(todo.local_date)}
                  {formatTodoScheduleLabel(todo) ? ` · ${formatTodoScheduleLabel(todo)}` : ""}
                </span>
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

  if (!sessionInitialized) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <p className="eyebrow">session</p>
          <h1>로그인 상태 확인 중</h1>
          <p className="login-copy">저장된 세션이 있는지 확인하고 있습니다.</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="login-shell">
        <section className="login-panel" onPaste={handleLoginPaste}>
          <p className="eyebrow">forced attendance</p>
          <h1>매일 같은 시간, 독서실 입장</h1>
          <p className="login-copy">
            이메일로 받은 8자리 코드를 입력하면 로그인됩니다. 알림 후 30분 안에 타이머를 시작하거나,
            오늘 목표 시간을 채우면 출석으로 인정됩니다.
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
          <a className={activeSection === "goals" ? "active" : ""} href="#goals">
            <Target size={17} />
            목표
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
        {activeSection === "today" && renderTodaySectionOrderEditor()}

        {activeSection === "today" && (
          <header className="topbar today-ordered-section" style={{ order: getTodaySectionSortOrder("topbar") }}>
            <div className="topbar-head">
              <div>
                <p className="eyebrow">deadline rule</p>
                <h2>{todayAttendanceRuleLabel}</h2>
              </div>
              <div className="topbar-actions" aria-label="집중 세션 조작">
                <button
                  className="primary"
                  onClick={() => {
                    void startTimer();
                  }}
                  disabled={busy || Boolean(activeSession) || blockingRecoveryRequests.length > 0}
                >
                  <Play size={18} />
                  입장하고 시작
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    void endTimer();
                  }}
                  disabled={busy || !activeSession}
                >
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
            <section className="goal-hero-card" aria-label="대표 목표">
              {activeGoal && activeGoalProgress ? (
                <>
                  <div className="goal-hero-main">
                    <span className="goal-dday">{formatDdayLabel(todayDateKey, activeGoal.target_date)}</span>
                    <div>
                      <p className="eyebrow">today goal</p>
                      <h3>{activeGoal.title}</h3>
                      <p>{formatGoalDate(activeGoal.target_date)}까지</p>
                    </div>
                  </div>
                  <div className="goal-hero-progress">
                    <div className="progress-track">
                      <span className="progress-fill" style={{ width: `${activeGoalProgress.percent}%` }} />
                    </div>
                    <strong>{activeGoalProgress.percent}%</strong>
                    <span>
                      {activeGoalProgress.linkedTodoCount > 0
                        ? `할 일 ${activeGoalProgress.completedTodoCount}/${activeGoalProgress.linkedTodoCount}`
                        : "연결된 할 일이 없습니다"}
                    </span>
                  </div>
                  <div className="goal-hero-actions">
                    <button className="secondary compact-action" type="button" onClick={() => openGoalEditor(activeGoal)}>
                      <Pencil size={16} />
                      목표 편집
                    </button>
                    <a className="secondary compact-action goal-view-link" href="#goals">
                      목표 보기
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <div className="goal-hero-main">
                    <span className="goal-dday">D-day</span>
                    <div>
                      <p className="eyebrow">today goal</p>
                      <h3>아직 목표가 없습니다</h3>
                      <p>시험일이나 프로젝트 마감일을 등록하면 남은 D-day와 연결된 할 일이 표시됩니다.</p>
                    </div>
                  </div>
                  <button className="primary" type="button" onClick={openNewGoalModal}>
                    <Plus size={18} />
                    목표 만들기
                  </button>
                </>
              )}
            </section>
            {activeSession && activeSessionLeaseDeadlineMs !== null && (
              <div
                className={`session-lease ${
                  sessionLeaseRemainingSeconds <= 5 * 60 ? "session-lease-warning" : ""
                }`}
                aria-live="polite"
              >
                <div>
                  <span>세션 유지 남은 시간</span>
                  <strong>{formatTimerClock(sessionLeaseRemainingSeconds)}</strong>
                  <small>2시간마다 유지 버튼을 눌러야 세션이 계속됩니다.</small>
                </div>
                <button className="secondary" type="button" onClick={extendSessionLease} disabled={busy}>
                  <Clock3 size={18} />
                  세션 유지
                </button>
              </div>
            )}
          </header>
        )}

        {activeSection === "today" && blockingRecoveryRequests.length > 0 && (
          <section
            className="recovery-blocker today-ordered-section"
            style={{ order: getTodaySectionSortOrder("topbar") + 1 }}
            role="status"
            aria-live="polite"
          >
            <div>
              <p className="eyebrow">recovery required</p>
              <h3>회복 루틴 필요</h3>
              <p>
                Slack에서 결석/이탈 사유와 보충 계획을 제출해야 다음 공부 세션을 시작할 수 있습니다.
              </p>
            </div>
            <ul>
              {blockingRecoveryRequests.map((request) => (
                <li key={request.id}>
                  <span>{request.local_date}</span>
                  <strong>
                    {request.trigger_type === "missed_attendance" ? "출석 실패" : "자리 비움 반복"}
                  </strong>
                </li>
              ))}
            </ul>
            <div className="recovery-actions">
              <button className="secondary" type="button" onClick={() => openRecoveryRoutineModal(blockingRecoveryRequests[0])}>
                회복 루틴 작성
              </button>
            </div>
          </section>
        )}

        {message && (
          <p
            className="message"
            style={activeSection === "today" ? { order: getTodaySectionSortOrder("topbar") + 2 } : undefined}
          >
            {message}
          </p>
        )}

        {activeSection === "today" && (
        <section
          id="today"
          className="history-panel today-ordered-section"
          style={{ order: getTodaySectionSortOrder("attendance") }}
        >
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
        )}

        {todoModalOpen && (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={closeTodoModal}
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
                  onClick={closeTodoModal}
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
                  void saveTodo();
                }}
              >
                <div className="todo-entry-row">
                  <input
                    value={todoDraft}
                    onChange={(event) => setTodoDraft(event.target.value)}
                    placeholder="예: AWS 공부"
                    disabled={todoBusy}
                    autoFocus
                  />
                  <button className="secondary" type="submit" disabled={todoBusy}>
                    {editingTodo ? <Pencil size={18} /> : <Plus size={18} />}
                    {editingTodo ? "수정 저장" : "저장"}
                  </button>
                </div>
                <div className="todo-repeat-panel" aria-label="할 일 시간 설정">
                  <div className="todo-mode-toggle" role="group" aria-label="시간 설정 방식">
                    <button
                      className={!todoTimeEnabled ? "selected" : ""}
                      type="button"
                      aria-pressed={!todoTimeEnabled}
                      onClick={() => setTodoTimeEnabled(false)}
                      disabled={todoBusy}
                    >
                      <Clock3 size={17} />
                      시간 없음
                    </button>
                    <button
                      className={todoTimeEnabled ? "selected" : ""}
                      type="button"
                      aria-pressed={todoTimeEnabled}
                      onClick={() => setTodoTimeEnabled(true)}
                      disabled={todoBusy}
                    >
                      <Clock3 size={17} />
                      시간 설정
                    </button>
                  </div>
                  {todoTimeEnabled && (
                    <div className="todo-time-details">
                      <label>
                        시작
                        <input
                          type="time"
                          value={todoStartTime}
                          onChange={(event) => setTodoStartTime(event.target.value)}
                          disabled={todoBusy}
                        />
                      </label>
                      <label>
                        종료
                        <input
                          type="time"
                          value={todoEndTime}
                          onChange={(event) => setTodoEndTime(event.target.value)}
                          disabled={todoBusy}
                        />
                      </label>
                    </div>
                  )}
                </div>
                <div className="todo-repeat-panel" aria-label="할 일 반복 설정">
                  <div className="todo-mode-toggle" role="group" aria-label="저장 방식">
                    <button
                      className={todoRepeatMode === "single" ? "selected" : ""}
                      type="button"
                      aria-pressed={todoRepeatMode === "single"}
                      onClick={() => {
                        setTodoRepeatMode("single");
                        setTodoRepeatForever(false);
                      }}
                      disabled={todoBusy}
                    >
                      <CalendarDays size={17} />
                      하루만
                    </button>
                    <button
                      className={todoRepeatMode === "weekly" ? "selected" : ""}
                      type="button"
                      aria-pressed={todoRepeatMode === "weekly"}
                      onClick={() => setTodoRepeatMode("weekly")}
                      disabled={todoBusy}
                    >
                      <Repeat2 size={17} />
                      요일 반복
                    </button>
                  </div>
                  {todoRepeatMode === "weekly" && (
                    <div className="todo-repeat-details">
                      <div className="todo-mode-toggle compact" role="group" aria-label="반복 종료 방식">
                        <button
                          className={!todoRepeatForever ? "selected" : ""}
                          type="button"
                          aria-pressed={!todoRepeatForever}
                          onClick={() => setTodoRepeatForever(false)}
                          disabled={todoBusy}
                        >
                          반복 종료일
                        </button>
                        <button
                          className={todoRepeatForever ? "selected" : ""}
                          type="button"
                          aria-pressed={todoRepeatForever}
                          onClick={() => setTodoRepeatForever(true)}
                          disabled={todoBusy}
                        >
                          영구 반복
                        </button>
                      </div>
                      {todoRepeatForever ? (
                        <p className="todo-repeat-note">
                          종료일 없이 반복합니다. 앱은 앞으로 1년치 일정을 먼저 만들고, 같은 반복 그룹으로 관리합니다.
                        </p>
                      ) : (
                        <label>
                          반복 종료일
                          <input
                            type="date"
                            min={selectedTodoDate}
                            value={todoRepeatEndDate}
                            onChange={(event) => setTodoRepeatEndDate(event.target.value)}
                            disabled={todoBusy}
                          />
                        </label>
                      )}
                      <div className="weekday-picker" role="group" aria-label="반복 요일 선택">
                        {todoWeekdayOptions.map((weekday) => {
                          const selected = todoRepeatWeekdays.includes(weekday.value);
                          return (
                            <button
                              className={selected ? "selected" : ""}
                              type="button"
                              key={weekday.value}
                              aria-pressed={selected}
                              onClick={() => toggleTodoRepeatWeekday(weekday.value)}
                              disabled={todoBusy}
                            >
                              {weekday.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <label className="todo-goal-select">
                  목표 연결
                  <select
                    value={todoGoalId}
                    onChange={(event) => setTodoGoalId(event.target.value)}
                    disabled={todoBusy}
                  >
                    <option value="">연결 안 함</option>
                    {sortedGoals
                      .filter((goal) => goal.status === "active")
                      .map((goal) => (
                        <option value={goal.id} key={goal.id}>
                          {goal.title}
                        </option>
                      ))}
                  </select>
                </label>
              </form>
              {renderTodoList(visibleTodoModalItems, "이 날짜에 저장된 할 일이 없습니다.")}
            </section>
          </div>
        )}

        {sessionTodoModalOpen && (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={closeSessionTodoSelection}
          >
            <section
              className="todo-modal session-todo-modal"
              role="dialog"
              aria-modal="true"
              aria-label="이번 세션에서 할 일 선택"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="todo-header">
                <div>
                  <p className="eyebrow">session plan</p>
                  <h3>이번 세션에서 할 일</h3>
                </div>
                <button
                  className="modal-close"
                  type="button"
                  aria-label="세션 할 일 선택 닫기"
                  onClick={closeSessionTodoSelection}
                >
                  <X size={18} />
                </button>
              </div>
              <p className="reminder-copy">
                오늘 미완료 할 일 중 이번 집중 세션에서 처리할 일을 1개 이상 선택하세요.
              </p>
              <form
                className="session-todo-quick-add"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  void addSessionTodo();
                }}
              >
                <input
                  type="text"
                  value={sessionTodoDraft}
                  onChange={(event) => setSessionTodoDraft(event.target.value)}
                  placeholder="예: AWS 기출 1회 풀기"
                  disabled={busy || sessionTodoAddBusy}
                />
                <button className="secondary" type="submit" disabled={busy || sessionTodoAddBusy}>
                  <Plus size={18} />
                  추가
                </button>
              </form>
              {incompleteTodayTodos.length === 0 && (
                <p className="todo-empty session-todo-empty">
                  미리 등록한 할 일이 없습니다. 위에서 바로 추가하면 이번 세션 할 일로 선택됩니다.
                </p>
              )}
              <ul className="session-todo-choice-list">
                {incompleteTodayTodos.map((todo) => {
                  const selected = selectedSessionTodoIds.includes(todo.id);
                  return (
                    <li key={todo.id}>
                      <label className={selected ? "selected" : ""}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSessionTodoSelection(todo.id)}
                          disabled={busy || sessionTodoAddBusy}
                        />
                        <span>{formatTodoWithSchedule(todo)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="reminder-actions">
                <button
                  className="primary"
                  type="button"
                  disabled={shouldDisableSessionTodoStart({
                    busy,
                    addBusy: sessionTodoAddBusy,
                    selectedTodoIds: selectedSessionTodoIds,
                  })}
                  onClick={() => {
                    void confirmSessionTodoSelection();
                  }}
                >
                  <Play size={18} />
                  선택한 할 일로 시작
                </button>
                <button className="secondary" type="button" onClick={closeSessionTodoSelection}>
                  <X size={18} />
                  나중에
                </button>
              </div>
            </section>
          </div>
        )}

        {goalModalOpen && (
          <div className="modal-backdrop" role="presentation" onClick={closeGoalModal}>
            <section
              className="todo-modal goal-modal"
              role="dialog"
              aria-modal="true"
              aria-label={editingGoalId ? "목표 편집" : "목표 만들기"}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="todo-header">
                <div>
                  <p className="eyebrow">study goal</p>
                  <h3>{editingGoalId ? "목표 편집" : "목표 만들기"}</h3>
                </div>
                <button className="modal-close" type="button" aria-label="목표 모달 닫기" onClick={closeGoalModal}>
                  <X size={18} />
                </button>
              </div>
              <form className="goal-form" onSubmit={saveGoal}>
                <label>
                  목표 이름
                  <input
                    value={goalTitle}
                    maxLength={80}
                    required
                    onChange={(event) => setGoalTitle(event.target.value)}
                    placeholder="예: 정보처리기사 실기 합격"
                    disabled={goalBusy}
                    autoFocus
                  />
                </label>
                <div className="goal-form-grid">
                  <label>
                    목표 날짜
                    <input
                      type="date"
                      value={goalTargetDate}
                      onChange={(event) => setGoalTargetDate(event.target.value)}
                      disabled={goalBusy}
                      required
                    />
                  </label>
                </div>
                <div className="goal-link-panel">
                  <div>
                    <p className="eyebrow">linked tasks</p>
                    <strong>연결할 할 일</strong>
                  </div>
                  {studyTodos.length === 0 ? (
                    <p className="todo-empty">아직 연결할 할 일이 없습니다. 캘린더에서 할 일을 먼저 추가해도 됩니다.</p>
                  ) : (
                    <div className="goal-link-list">
                      {sortTodos(studyTodos).slice(0, 80).map((todo) => (
                        <label className="goal-link-row" key={todo.id}>
                          <input
                            type="checkbox"
                            checked={goalLinkedTodoIds.includes(todo.id)}
                            onChange={() => toggleGoalLinkedTodo(todo.id)}
                            disabled={goalBusy}
                          />
                          <span>
                            <strong>{todo.title}</strong>
                            <small>{formatTodoDate(todo.local_date)} · {formatTodoScheduleLabel(todo) || "시간 없음"}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="reminder-actions">
                  <button className="primary" type="submit" disabled={goalBusy}>
                    <CheckCircle2 size={18} />
                    저장
                  </button>
                  <button className="secondary" type="button" onClick={closeGoalModal} disabled={goalBusy}>
                    <X size={18} />
                    취소
                  </button>
                </div>
              </form>
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
                {reminderPopup.reminderTime} 알림이 도착했습니다. 15분 뒤 한 번 더 재촉하고, 30분 안에 타이머를
                시작하거나 오늘 {todayGoalLabel} 목표를 채우면 출석으로 인정됩니다.
              </p>
              {renderReminderTodoList(reminderTodos)}
              <div className="reminder-actions">
                <button
                  className="primary"
                  type="button"
                  disabled={busy || Boolean(activeSession) || blockingRecoveryRequests.length > 0}
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

        {recoveryModalRequest && (
          <div className="modal-backdrop reminder-backdrop" role="presentation">
            <section
              className="todo-modal reminder-modal recovery-modal"
              role="dialog"
              aria-modal="true"
              aria-label="회복 루틴 작성"
            >
              <div className="todo-header">
                <div>
                  <p className="eyebrow">recovery routine</p>
                  <h3>회복 루틴 작성</h3>
                </div>
                <button
                  className="modal-close"
                  type="button"
                  aria-label="회복 루틴 모달 닫기"
                  onClick={closeRecoveryRoutineModal}
                >
                  <X size={18} />
                </button>
              </div>
              <p className="reminder-copy">
                Slack에서 작성해도 되고, 여기에서 바로 사유와 보충 계획을 제출해도 됩니다.
              </p>
              <div className="recovery-modal-summary">
                <span>{formatTodoDate(recoveryModalRequest.local_date)}</span>
                <strong>{getRecoveryRequestTitle(recoveryModalRequest)}</strong>
                <small>
                  {recoveryModalQueuePosition > 0
                    ? `${recoveryModalQueuePosition}/${pendingRecoveryRequests.length}번째 회복 루틴`
                    : "회복 루틴"}
                  {recoveryModalRemainingCount > 0 ? ` · 제출 후 ${recoveryModalRemainingCount}건 남음` : ""}
                </small>
              </div>
              <form className="recovery-form" onSubmit={submitRecoveryRoutine}>
                <label>
                  <span>결석/이탈 사유</span>
                  <textarea
                    name="recoveryReason"
                    value={recoveryReason}
                    maxLength={400}
                    required
                    rows={4}
                    onChange={(event) => setRecoveryReason(event.target.value)}
                    placeholder="예: 알림을 봤지만 바로 시작하지 못했습니다."
                  />
                </label>
                <label>
                  <span>오늘 보충 과제</span>
                  <input
                    name="makeupTodoTitle"
                    value={makeupTodoTitle}
                    maxLength={120}
                    required
                    onChange={(event) => setMakeupTodoTitle(event.target.value)}
                    placeholder="예: MOS 공부 1시간 보충"
                  />
                </label>
                <label>
                  <span>내일 재도전 약속</span>
                  <input
                    name="pledgeTodoTitle"
                    value={pledgeTodoTitle}
                    maxLength={120}
                    required
                    onChange={(event) => setPledgeTodoTitle(event.target.value)}
                    placeholder="예: 20:30 전에 카메라 켜고 입장"
                  />
                </label>
                <div className="reminder-actions">
                  <button className="primary" type="submit" disabled={recoverySubmitBusy}>
                    <CheckCircle2 size={18} />
                    제출하고 잠금 해제
                  </button>
                  <button className="secondary" type="button" onClick={closeRecoveryRoutineModal}>
                    <X size={18} />
                    나중에
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {cameraSetupPrompt && (
          <div className="modal-backdrop reminder-backdrop" role="presentation">
            <section
              className="todo-modal reminder-modal camera-required-modal"
              role="dialog"
              aria-modal="true"
              aria-label="카메라 인증 필요"
            >
              <div className="todo-header">
                <div>
                  <p className="eyebrow">camera required</p>
                  <h3>카메라 인증이 필요합니다</h3>
                </div>
                <button
                  className="modal-close"
                  type="button"
                  aria-label="카메라 인증 안내 닫기"
                  onClick={() => setCameraSetupPrompt(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <p className="reminder-copy">
                {cameraSetupPrompt.mode === "start"
                  ? "출석으로 인정받으려면 카메라 감시를 켠 뒤 타이머를 시작해야 합니다."
                  : "현재 공부 세션의 카메라 감시가 꺼져 있습니다. 다시 켜야 출석 유지 상태를 확인할 수 있습니다."}
              </p>
              <div className="reminder-actions">
                <button
                  className="primary"
                  type="button"
                  disabled={busy || cameraStatus === "starting"}
                  onClick={() => {
                    void confirmCameraSetupPrompt();
                  }}
                >
                  <Camera size={18} />
                  {cameraSetupPrompt.mode === "start" ? "카메라 켜고 시작" : "카메라 켜기"}
                </button>
                <button className="secondary" type="button" onClick={() => setCameraSetupPrompt(null)}>
                  <X size={18} />
                  나중에
                </button>
              </div>
            </section>
          </div>
        )}

        {absenceWarningPopup && (
          <div className="modal-backdrop reminder-backdrop" role="presentation">
            <section
              className="todo-modal reminder-modal camera-warning-modal"
              role="dialog"
              aria-modal="true"
              aria-label="자리 비움 경고"
            >
              <div className="todo-header">
                <div>
                  <p className="eyebrow">camera warning</p>
                  <h3>자리 비움 경고</h3>
                </div>
                <button
                  className="modal-close"
                  type="button"
                  aria-label="자리 비움 경고 닫기"
                  onClick={() => setAbsenceWarningPopup(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <p className="reminder-copy">
                5분 동안 카메라에서 상반신이 감지되지 않았습니다. 다시 자리로 돌아와 공부를 이어가세요.
              </p>
              <p className="camera-warning-note">
                {absenceWarningPopup.slackSent
                  ? "Slack 경고를 보냈습니다."
                  : absenceWarningPopup.slackMissing
                    ? "이 계정에는 Slack Channel ID가 저장되어 있지 않습니다. 설정에서 Slack Channel ID를 저장하세요."
                    : "앱 안에 경고를 표시하고 있습니다."}
              </p>
              <div className="reminder-actions">
                <button className="primary" type="button" onClick={() => setAbsenceWarningPopup(null)}>
                  <CheckCircle2 size={18} />
                  확인
                </button>
              </div>
            </section>
          </div>
        )}

        {activeSection === "today" && (
        <section className="daily-visual"
          style={{ order: getTodaySectionSortOrder("focus") }}
          aria-label="집중 세션 카메라 감시와 목표 진행률"
        >
          <div className="focus-control">
            <div className="progress-block">
              <div className="progress-track">
                <span className="progress-fill" style={{ width: `${todayProgress}%` }} />
              </div>
              <span>{todayProgress}% / {todayGoalLabel}</span>
            </div>
            {renderSessionTodoList()}
            <div className={`camera-monitor camera-monitor-${cameraStatus}`}>
              <div className="camera-monitor-head">
                <strong>카메라 감시 · {getPresenceStatusLabel({ cameraEnabled, status: cameraStatus, absenceSeconds: presenceState.absenceSeconds })}</strong>
              </div>
              <div className="camera-monitor-body">
                <video
                  ref={videoRef}
                  className={`camera-preview ${cameraEnabled ? "" : "camera-preview-idle"}`}
                  muted
                  playsInline
                  aria-hidden={!cameraEnabled}
                />
                <button
                  className="secondary camera-toggle"
                  type="button"
                  onClick={() => {
                    void toggleCameraMonitoring();
                  }}
                  disabled={!activeSession || (!cameraEnabled && cameraStatus === "starting")}
                >
                  {cameraEnabled ? <CameraOff size={18} /> : <Camera size={18} />}
                  {cameraEnabled ? "카메라 감시 끄기" : "카메라 감시 켜기"}
                </button>
              </div>
              {cameraMessage && cameraStatus !== "watching" && <span className="camera-message">{cameraMessage}</span>}
              <div className={`camera-diagnostic camera-diagnostic-${cameraDiagnostic.tone}`} aria-live="polite">
                <div className="camera-diagnostic-head">
                  <span>상태 진단</span>
                  <strong>{cameraDiagnostic.title}</strong>
                </div>
                <p>{cameraDiagnostic.detail}</p>
                <ul>
                  {cameraDiagnostic.checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
        )}

        {activeSection === "today" && (
        <section className="today-task-panel"
          style={{ order: getTodaySectionSortOrder("tasks") }}
          aria-label="오늘 할 일"
        >
          <div className="todo-header">
            <div>
              <p className="eyebrow">today tasks</p>
              <h2>오늘 할 일</h2>
            </div>
            <strong>{todayTodoStats.percent}% 달성</strong>
          </div>
          <div className="task-view-switcher" aria-label="오늘 할 일 보기 방식">
            <button
              className={todayTaskView === "checklist" ? "selected" : ""}
              type="button"
              aria-pressed={todayTaskView === "checklist"}
              onClick={() => setTodayTaskView("checklist")}
            >
              <ListChecks size={16} />
              체크리스트
            </button>
            <button
              className={todayTaskView === "planner" ? "selected" : ""}
              type="button"
              aria-pressed={todayTaskView === "planner"}
              onClick={() => setTodayTaskView("planner")}
            >
              <CalendarDays size={16} />
              생활계획표
            </button>
            <button
              className="secondary compact-action"
              type="button"
              onClick={saveTodayTaskViewPreference}
              disabled={busy || todayTaskView === savedTodayTaskView}
            >
              <Pin size={16} />
              {todayTaskView === savedTodayTaskView ? "고정됨" : "고정"}
            </button>
          </div>
          <div className="todo-progress-track">
            <span className="todo-progress-fill" style={{ width: `${todayTodoStats.percent}%` }} />
          </div>
          {todayTaskView === "planner"
            ? renderDailyPlanner()
            : renderTodoList(todayTodos, "오늘 할 일이 없습니다. 캘린더에서 오늘 날짜를 눌러 추가하세요.")}
        </section>
        )}

        {activeSection === "goals" && (
        <section id="goals" className="history-panel goals-panel">
          <div className="history-header">
            <div>
              <p className="eyebrow">study goals</p>
              <h2>목표</h2>
            </div>
            <button className="primary compact-action" type="button" onClick={openNewGoalModal}>
              <Plus size={18} />
              새 목표
            </button>
          </div>

          {sortedGoals.length === 0 ? (
            <div className="goal-empty-state">
              <span className="goal-dday">D-day</span>
              <div>
                <h3>목표를 만들면 공부의 마감일이 보입니다</h3>
                <p>시험일, 자격증, 프로젝트 마감일을 등록하고 관련 할 일을 연결하세요.</p>
              </div>
            </div>
          ) : (
            <div className="goal-grid">
              {sortedGoals.map((goal) => {
                const view = getGoalView(goal);
                return (
                  <article className={`goal-card goal-card-${goal.status}`} key={goal.id}>
                    <div className="goal-card-head">
                      <span className="goal-dday">{formatDdayLabel(todayDateKey, goal.target_date)}</span>
                      <div>
                        <p className="eyebrow">{goal.status}</p>
                        <h3>{goal.title}</h3>
                        <p>{formatGoalDate(goal.target_date)}까지</p>
                      </div>
                    </div>
                    <div className="goal-hero-progress">
                      <div className="progress-track">
                        <span className="progress-fill" style={{ width: `${view.progress.percent}%` }} />
                      </div>
                      <strong>{view.progress.percent}% 완료</strong>
                      <span>
                        {view.progress.linkedTodoCount > 0
                          ? `할 일 ${view.progress.completedTodoCount}/${view.progress.linkedTodoCount}`
                          : "연결된 할 일이 없습니다"}
                      </span>
                    </div>
                    <div className="goal-stat-row">
                      <span>연결 할 일</span>
                      <strong>{view.progress.completedTodoCount}/{view.progress.linkedTodoCount}</strong>
                    </div>
                    <ul className="goal-linked-list">
                      {view.linkedTodos.slice(0, 4).map((todo) => (
                        <li className={todo.is_completed ? "todo-done" : ""} key={todo.id}>
                          <span>{todo.is_completed ? "✓" : "□"}</span>
                          {formatTodoWithSchedule(todo)}
                        </li>
                      ))}
                      {view.linkedTodos.length === 0 && <li>아직 연결된 할 일이 없습니다.</li>}
                    </ul>
                    <div className="goal-card-actions">
                      <button className="secondary compact-action" type="button" onClick={() => openGoalEditor(goal)}>
                        <Pencil size={16} />
                        편집
                      </button>
                      <button
                        className="secondary compact-action"
                        type="button"
                        disabled={goalBusy}
                        onClick={() => void updateGoalStatus(goal, goal.status === "completed" ? "active" : "completed")}
                      >
                        <CheckCircle2 size={16} />
                        {goal.status === "completed" ? "다시 진행" : "완료"}
                      </button>
                      <button
                        className="todo-delete"
                        type="button"
                        aria-label={`${goal.title} 삭제`}
                        disabled={goalBusy}
                        onClick={() => void deleteGoal(goal)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        )}

        {activeSection === "me" && (
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
              <strong>평일 {profile?.reminder_time?.slice(0, 5) ?? reminderTime} · 주말 {WEEKEND_REMINDER_TIME}</strong>
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
        )}

        {activeSection === "settings" && (
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
              <div className={`notification-state ${slackNotificationStatusClass(slackStatus)}`}>
                <span>Slack</span>
                <strong>{slackNotificationSummary(slackStatus)}</strong>
              </div>
            </div>
          </div>
          <div className={`alarm-summary-card ${alarmEditing ? "alarm-edit-mode" : ""}`}>
            <div className="alarm-summary-top">
              <div>
                <p className="eyebrow">daily alarm</p>
                <h3>설정된 알람</h3>
              </div>
              {!alarmEditing && (
                <button className="secondary compact-action" onClick={startAlarmEditing} disabled={busy}>
                  <Clock3 size={17} />
                  알람 편집
                </button>
              )}
            </div>

            {alarmEditing ? (
              <div className="alarm-edit-fields">
                <label>
                  평일 알림 시간
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(event) => setReminderTime(event.target.value)}
                  />
                </label>
                <label className="toggle-row alarm-toggle-row">
                  <input
                    type="checkbox"
                    checked={emailRemindersEnabled}
                    onChange={(event) => setEmailRemindersEnabled(event.target.checked)}
                  />
                  이메일 보완 알림 사용
                </label>
                <div className="alarm-edit-actions">
                  <button className="secondary compact-action" onClick={cancelAlarmEditing} disabled={busy}>
                    <X size={17} />
                    취소
                  </button>
                  <button className="primary compact-action" onClick={saveAlarmSettings} disabled={busy}>
                    <Bell size={17} />
                    {busy ? "알람 저장 중" : "알람 저장"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="alarm-summary-main">
                  <Clock3 size={30} />
                  <div>
                    <span>오늘 적용 알림</span>
                    <strong>{formatAlarmTime(effectiveReminderTime)}</strong>
                  </div>
                </div>
                <div className="alarm-detail-grid">
                  <div>
                    <span>평일 알림</span>
                    <strong>{formatAlarmTime(profile?.reminder_time ?? reminderTime)}</strong>
                  </div>
                  <div>
                    <span>주말 알림</span>
                    <strong>{formatAlarmTime(WEEKEND_REMINDER_TIME)}</strong>
                  </div>
                  <div>
                    <span>이메일 보완</span>
                    <strong>{emailRemindersEnabled ? "사용" : "사용 안 함"}</strong>
                  </div>
                  <div>
                    <span>컴퓨터 알림</span>
                    <strong>{notificationSummary(webPushStatus)}</strong>
                  </div>
                  <div>
                    <span>Slack</span>
                    <strong>{slackNotificationSummary(slackStatus)}</strong>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="notification-channel-card">
            <div className="channel-card-header">
              <div>
                <p className="eyebrow">channels</p>
                <h3>알림 수단</h3>
              </div>
              <span>브라우저와 Slack 발송 상태를 관리합니다.</span>
            </div>
            <label>
              Slack Channel ID
              <input
                value={slackChannelId}
                onChange={(event) => setSlackChannelId(event.target.value)}
                placeholder="예: C123ABC456"
                inputMode="text"
              />
            </label>
            <div className="channel-actions">
              <button className="secondary wide-action" onClick={saveSlackChannelSettings} disabled={busy}>
                <Send size={18} />
                Slack 채널 저장
              </button>
              <button className="primary wide-action" onClick={saveNotificationSettings} disabled={busy}>
                <Bell size={18} />
                {busy ? "알림 설정 중" : "저장하고 컴퓨터 알림 켜기"}
              </button>
              <button
                className="secondary wide-action"
                onClick={sendSlackTestNotification}
                disabled={busy || !slackStatus?.connected}
              >
                <Send size={18} />
                Slack 테스트 알림
              </button>
            </div>
          </div>
        </section>
        )}

      </section>
    </main>
  );
}

function attendanceLabel(status: AttendanceDay["status"]) {
  if (status === "present") return "출석";
  if (status === "missed") return "결석";
  return "대기";
}

function compareRecoveryRequests(left: StudyRecoveryRequest, right: StudyRecoveryRequest) {
  if (left.local_date !== right.local_date) {
    return left.local_date.localeCompare(right.local_date);
  }
  return left.created_at.localeCompare(right.created_at);
}

function getRecoveryRequestTitle(request: StudyRecoveryRequest) {
  return request.trigger_type === "missed_attendance" ? "출석 실패" : "자리 비움 반복";
}

function formatRecoveryRequestSummary(request: StudyRecoveryRequest) {
  return `${formatTodoDate(request.local_date)} · ${getRecoveryRequestTitle(request)}`;
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
    const leftStartTime = left.start_time ?? "99:99";
    const rightStartTime = right.start_time ?? "99:99";
    if (leftStartTime !== rightStartTime) {
      return leftStartTime.localeCompare(rightStartTime);
    }
    if (left.position !== right.position) {
      return left.position - right.position;
    }
    return left.created_at.localeCompare(right.created_at);
  });
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getPlainDateKey(date);
}

function formatGoalDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(year, month - 1, day));
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

function formatAlarmTime(value: string) {
  const [hourText = "0", minuteText = "0"] = value.slice(0, 5).split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return value.slice(0, 5);
  }
  const period = hour >= 12 ? "오후" : "오전";
  const displayHour = hour % 12 || 12;
  return `${period} ${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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

function formatCameraError(error: unknown) {
  if (error instanceof DOMException) {
    if (["NotAllowedError", "PermissionDeniedError"].includes(error.name)) {
      return "카메라 권한이 거부되었습니다.";
    }
    if (error.name === "NotFoundError") {
      return "사용 가능한 카메라를 찾지 못했습니다.";
    }
    if (error.name === "NotReadableError") {
      return "다른 앱이 카메라를 사용 중입니다.";
    }
  }

  return error instanceof Error ? error.message : String(error);
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

function slackNotificationSummary(status: SlackNotificationStatus | null) {
  if (!status) return "확인 중";
  return status.connected ? "등록됨" : "미등록";
}

function slackNotificationStatusClass(status: SlackNotificationStatus | null) {
  if (!status) return "notification-checking";
  return status.connected ? "notification-ready" : "notification-needed";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
