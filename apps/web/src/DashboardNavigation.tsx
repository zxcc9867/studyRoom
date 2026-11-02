import { Home, Leaf, Rss, Settings, Target, TreePine, UserRound, UsersRound } from "lucide-react";

export const dashboardDestinations = [
  { id: "today", label: "오늘", icon: Home },
  { id: "together", label: "팀 공부", icon: UsersRound },
  { id: "goals", label: "목표", icon: Target },
  { id: "feed", label: "기술 피드", icon: Rss },
  { id: "forest", label: "공부 숲", icon: TreePine },
  { id: "me", label: "내 페이지", icon: UserRound },
  { id: "settings", label: "설정", icon: Settings },
] as const;
const destinations = dashboardDestinations.filter(({id}) => id !== "together" && id !== "me");

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
