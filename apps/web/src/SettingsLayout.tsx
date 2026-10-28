import { useState, type ReactNode } from 'react';
import { Bell, BookOpen, Info, Smartphone, UserRound } from 'lucide-react';

const categories = [
  { id: 'account', label: '계정', Icon: UserRound },
  { id: 'study', label: '공부와 화면', Icon: BookOpen },
  { id: 'notifications', label: '알림', Icon: Bell },
  { id: 'device', label: '기기 연결', Icon: Smartphone },
  { id: 'app', label: '앱 정보', Icon: Info },
] as const;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const [category, setCategory] = useState<string>('account');
  return <section id="settings" className="settings-panel app-settings-panel" data-settings-category={category}>
    <header className="app-settings-heading"><h1>설정</h1></header>
    <div className="settings-layout">
      <nav className="settings-category-nav" aria-label="설정 분류">
        {categories.map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={category === id} aria-controls={`settings-panel-${id}`} onClick={() => setCategory(id)}>
          <Icon size={20} aria-hidden="true" /><span>{label}</span>
        </button>)}
      </nav>
      <div className="settings-content">{children}</div>
    </div>
  </section>;
}
