import { Home, Leaf, Rss, Settings, Target, TreePine, UserRound } from "lucide-react";

const destinations = [
  { id: "today", label: "오늘", icon: Home },
  { id: "goals", label: "목표", icon: Target },
  { id: "feed", label: "기술 피드", icon: Rss },
  { id: "forest", label: "공부 숲", icon: TreePine },
  { id: "settings", label: "설정", icon: Settings },
];

export default function DashboardNavigation({ activeSection }: { activeSection: string }) {
  const current = activeSection === "together" ? "today" : activeSection;
  return <>
    <header className="dashboard-navigation">
      <a className="dashboard-brand" href="#today" aria-label="독서실 오늘"><Leaf size={23} aria-hidden="true" />독서실</a>
      <nav className="desktop-navigation" aria-label="대시보드 섹션">
        {destinations.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} aria-current={current === id ? "page" : undefined}><Icon size={21} aria-hidden="true" /><span>{label}</span></a>)}
        <a href="#me" className="dashboard-profile-link" aria-current={activeSection === "me" ? "page" : undefined}><UserRound size={21} aria-hidden="true" /><span>내 페이지</span></a>
      </nav>
    </header>
    <nav className="mobile-navigation" aria-label="대시보드 섹션">
      {destinations.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} aria-current={current === id ? "page" : undefined}><Icon size={21} aria-hidden="true" /><span>{label}</span></a>)}
    </nav>
  </>;
}
