import { BellRing, Clock3, Sparkles } from "lucide-react";
import { getAdaptiveReminderRecommendation } from "./adaptiveReminder.mjs";

type Props = {
  sessions: Array<{ local_date: string; started_at: string; status: string }>;
  todayDateKey: string;
  timeZone: string;
  currentReminderTime: string;
  enabled: boolean;
  busy: boolean;
  onApply: (enabled: boolean, recommendedTime: string) => void;
};

export default function AdaptiveReminderCard({ sessions, todayDateKey, timeZone, currentReminderTime, enabled, busy, onApply }: Props) {
  const recommendation = getAdaptiveReminderRecommendation({ sessions, todayDateKey, timeZone, currentReminderTime });
  const canEnable = recommendation.status !== "insufficient-data";
  return (
    <section className="adaptive-reminder-card" aria-labelledby="adaptive-reminder-title">
      <div className="adaptive-reminder-icon"><BellRing size={28} /></div>
      <div className="adaptive-reminder-copy">
        <p className="eyebrow">adaptive reminder</p>
        <h3 id="adaptive-reminder-title">내 공부 흐름에 맞춘 알림</h3>
        <p>{recommendation.reason}</p>
        <div className="adaptive-reminder-time"><Clock3 size={18} /><span>추천 시작 시간</span><strong>{recommendation.recommendedTime}</strong></div>
        <small>최근 완료 세션 중 하루 첫 시작 {recommendation.sampleSize}건을 바탕으로 15분 단위로 계산해요.</small>
      </div>
      <button
        className={enabled ? "secondary adaptive-enabled" : "primary"}
        type="button"
        disabled={busy || (!enabled && !canEnable)}
        onClick={() => onApply(!enabled, recommendation.recommendedTime)}
      >
        <Sparkles size={17} />{enabled ? "자동 조정 끄기" : canEnable ? "추천 시간으로 자동 조정" : "기록을 더 모아주세요"}
      </button>
    </section>
  );
}
