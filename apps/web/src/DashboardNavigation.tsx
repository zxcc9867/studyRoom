import { useEffect, useState } from "react";
import { Bell, Ellipsis, Home, Leaf, LogOut, Rss, SlidersHorizontal, Target, TreePine, UserRound, X } from "lucide-react";
import { AccessibleDialog } from "./AccessibleDialog";

const destinations = [
  { id: "today", label: "오늘", icon: Home },
  { id: "goals", label: "목표", icon: Target },
  { id: "feed", label: "기술 피드", icon: Rss },
  { id: "forest", label: "공부 숲", icon: TreePine },
];

export default function DashboardNavigation({ activeSection, onLayout, onSignOut }: {
  activeSection: string; onLayout: () => void; onSignOut: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { setMoreOpen(false); }, [activeSection]);
  return <>
    <header className="dashboard-navigation">
      <a className="dashboard-brand" href="#today" aria-label="독서실 오늘"><Leaf size={23} aria-hidden="true" />독서실</a>
      <nav className="desktop-navigation" aria-label="대시보드 섹션">
        {destinations.map(({ id, label }) => <a key={id} href={`#${id}`} aria-current={activeSection === id ? "page" : undefined}>{label}</a>)}
        <a href="#me" aria-current={activeSection === "me" ? "page" : undefined}>내 페이지</a>
      </nav>
      <div className="dashboard-nav-actions">
        <a className="dashboard-icon-link" href="#settings" aria-label="알림 설정" aria-current={activeSection === "settings" ? "page" : undefined}><Bell size={20} aria-hidden="true" /></a>
        <button className="desktop-more" type="button" aria-label="더 보기" aria-haspopup="dialog" onClick={() => setMoreOpen(true)}><Ellipsis size={22} aria-hidden="true" /></button>
      </div>
    </header>
    <nav className="mobile-navigation" aria-label="대시보드 섹션">
      {destinations.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} aria-current={activeSection === id ? "page" : undefined}><Icon size={21} aria-hidden="true" /><span>{label}</span></a>)}
      <button type="button" aria-label="더 보기" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}><Ellipsis size={21} aria-hidden="true" /><span>더 보기</span></button>
    </nav>
    {moreOpen && <AccessibleDialog className="dashboard-more-dialog" ariaLabel="더 보기" onClose={() => setMoreOpen(false)} closeOnBackdrop>
      <div className="dashboard-more-heading"><h2>더 보기</h2><button type="button" aria-label="더 보기 닫기" onClick={() => setMoreOpen(false)}><X size={21} aria-hidden="true" /></button></div>
      <a href="#me" onClick={() => setMoreOpen(false)}><UserRound size={20} aria-hidden="true" />내 페이지</a>
      <a href="#settings" onClick={() => setMoreOpen(false)}><Bell size={20} aria-hidden="true" />알림 설정</a>
      <button type="button" onClick={() => { setMoreOpen(false); onLayout(); }}><SlidersHorizontal size={20} aria-hidden="true" />화면 구성</button>
      <button type="button" onClick={() => { setMoreOpen(false); onSignOut(); }}><LogOut size={20} aria-hidden="true" />로그아웃</button>
    </AccessibleDialog>}
  </>;
}
