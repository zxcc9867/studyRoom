import { Play, X } from "lucide-react";
import { AccessibleDialog } from "./AccessibleDialog";
import type { StudyPeriodRecap } from "./studyReports.mjs";
import { formatStudyDuration } from "./weeklyReview.mjs";
import "./studyPeriodRecap.css";

export default function StudyPeriodRecapDialog({ recaps, onClose, onStart }: {
  recaps: StudyPeriodRecap[];
  onClose: () => void;
  onStart: () => void;
}) {
  return (
    <AccessibleDialog className="todo-modal study-recap-dialog" labelledBy="study-recap-title" describedBy="study-recap-copy" onClose={onClose}>
      <div className="todo-header">
        <h3 id="study-recap-title">지난 학습 요약</h3>
        <button type="button" className="modal-close" aria-label="학습 요약 닫기" onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </div>
      <p id="study-recap-copy" className="todo-copy">지난 공부를 가볍게 돌아보고 오늘 공부를 이어가세요.</p>
      {recaps.map(recap => (
        <section key={recap.mode} className="study-recap-period" aria-label={recap.mode === "week" ? "지난주" : "지난달"}>
          <h4>{recap.mode === "week" ? "지난주" : "지난달"}</h4>
          <p><time dateTime={recap.range.startDate}>{recap.range.startDate}</time> ~ <time dateTime={recap.range.endDate}>{recap.range.endDate}</time></p>
          <dl>
            <div><dt>공부 시간</dt><dd>{formatStudyDuration(recap.studySeconds)}</dd></div>
            <div><dt>출석</dt><dd>{recap.presentDays}일</dd></div>
            <div><dt>완료한 할 일</dt><dd>{recap.completedTodos}개</dd></div>
          </dl>
        </section>
      ))}
      <div className="reminder-actions">
        <button type="button" className="primary" data-dialog-initial-focus onClick={onStart}><Play size={18} aria-hidden="true" />바로 공부 시작</button>
      </div>
    </AccessibleDialog>
  );
}
