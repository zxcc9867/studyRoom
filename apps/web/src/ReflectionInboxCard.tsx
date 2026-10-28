import { ArrowRight, Clock3, NotebookPen } from "lucide-react";

export type ReflectionInboxItem = {
  id: string;
  local_date: string;
  duration_seconds: number;
};

type ReflectionInboxProps = {
  items: ReflectionInboxItem[];
  onOpen: (sessionId: string) => void;
};

function formatSessionDate(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatSessionDuration(durationSeconds: number) {
  const seconds = Math.max(0, Number(durationSeconds) || 0);
  if (seconds === 0) return "0분";
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

export default function ReflectionInbox({ items, onOpen }: ReflectionInboxProps) {
  if (items.length === 0) return null;

  return (
    <section className="reflection-inbox" aria-labelledby="reflection-inbox-title">
      <div className="reflection-inbox-heading">
        <span className="reflection-inbox-icon" aria-hidden="true">
          <NotebookPen size={22} />
        </span>
        <div>
          <h3 id="reflection-inbox-title">남겨둔 회고</h3>
        </div>
        <strong className="reflection-inbox-count">{items.length}개</strong>
      </div>
      <p className="reflection-inbox-intro">
        지난 공부를 짧게 돌아보고 다음 할 일을 정리해 보세요.
      </p>
      <ul className="reflection-inbox-list">
        {items.map((item) => {
          const dateLabel = formatSessionDate(item.local_date);
          const durationLabel = formatSessionDuration(item.duration_seconds);
          return (
            <li className="reflection-inbox-item" key={item.id}>
              <span className="reflection-inbox-copy">
                <strong>{dateLabel}의 집중</strong>
                <span><Clock3 size={15} aria-hidden="true" />{durationLabel}</span>
              </span>
              <button
                type="button"
                className="secondary reflection-inbox-action"
                aria-label={`${dateLabel} ${durationLabel} 세션 회고 남기기`}
                onClick={() => onOpen(item.id)}
              >
                회고 남기기 <ArrowRight size={17} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <small className="reflection-inbox-note">최근 7일의 미작성 회고 · 최대 3개</small>
    </section>
  );
}
