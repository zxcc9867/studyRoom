import { BarChart3, CalendarDays, Focus } from "lucide-react";

export type TodayDomain = "focus" | "plan" | "record";

const tabs: Array<{ id: TodayDomain; label: string; description: string; icon: typeof Focus }> = [
  { id: "focus", label: "집중", description: "세션과 카메라", icon: Focus },
  { id: "plan", label: "계획", description: "할 일과 시간표", icon: CalendarDays },
  { id: "record", label: "기록", description: "습관과 출석", icon: BarChart3 },
];

type TodayDomainTabsProps = {
  activeDomain: TodayDomain;
  onChange: (domain: TodayDomain) => void;
};

export default function TodayDomainTabs({ activeDomain, onChange }: TodayDomainTabsProps) {
  return (
    <nav className="today-domain-tabs" aria-label="오늘 화면">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = activeDomain === tab.id;

        return (
          <button
            className={selected ? "selected" : ""}
            type="button"
            key={tab.id}
            aria-pressed={selected}
            onClick={() => onChange(tab.id)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>
              <strong>{tab.label}</strong>
              <small>{tab.description}</small>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
