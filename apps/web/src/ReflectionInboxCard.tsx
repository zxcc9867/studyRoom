import { ArrowRight, Clock3, Leaf, Mailbox } from "lucide-react";

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
        <span className="reflection-inbox-mailbox" aria-hidden="true">
          <Mailbox size={28} strokeWidth={2.2} />
          <Leaf size={15} fill="currentColor" />
        </span>
        <div>
          <p className="eyebrow">forest postbox</p>
          <h3 id="reflection-inbox-title">아직 열어보지 않은 집중 편지</h3>
        </div>
        <strong className="reflection-inbox-count">{items.length}통</strong>
      </div>
      <p className="reflection-inbox-intro">
        바쁘게 마친 세션을 지금 짧게 돌아보면, 다음 시작 때 바로 할 한 가지로 이어져요.
      </p>
      <ul className="reflection-inbox-list">
        {items.map((item, index) => {
          const dateLabel = formatSessionDate(item.local_date);
          const durationLabel = formatSessionDuration(item.duration_seconds);
          return (
            <li className="reflection-inbox-item" key={item.id}>
              <span className="reflection-inbox-stamp" aria-hidden="true">{index + 1}</span>
              <span className="reflection-inbox-copy">
                <strong>{dateLabel}의 집중</strong>
                <span><Clock3 size={15} />{durationLabel}</span>
              </span>
              <button
                type="button"
                aria-label={`${dateLabel} ${durationLabel} 세션 회고 남기기`}
                onClick={() => onOpen(item.id)}
              >
                회고 남기기 <ArrowRight size={17} />
              </button>
            </li>
          );
        })}
      </ul>
      <small className="reflection-inbox-note">최근 7일 중 가장 최근 세션 3개까지만 가볍게 보여드려요.</small>
    </section>
  );
}
