import type { CSSProperties } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { getAppMessagePresentation } from "./appMessage.mjs";

const noticeIcons = { info: Info, success: CheckCircle2, warning: TriangleAlert, danger: AlertCircle };

export default function AppNotice({ message, style }: { message: string; style?: CSSProperties }) {
  const notice = getAppMessagePresentation(message);
  if (!notice) return null;
  const Icon = noticeIcons[notice.tone];

  return (
    <div className={`message app-notice app-notice--${notice.tone}`} role={notice.role} aria-atomic="true" style={style}>
      <Icon className="app-notice-icon" aria-hidden="true" />
      <div className="app-notice-copy">
        <strong>{notice.title}</strong>
        <p>{notice.body}</p>
      </div>
    </div>
  );
}
