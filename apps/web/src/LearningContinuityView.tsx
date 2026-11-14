import { Bookmark, ExternalLink } from "lucide-react";
import type { LearningBookmark, LearningResult } from "./learningContinuity.mjs";
import "./learningContinuity.css";

export function LearningContinuityStatus({ status, onRetry }: { status: string; onRetry: () => void }) {
  if (status !== "error" && status !== "unsupported") return null;
  return <p role="status" className="learning-read-status">{status === "unsupported" ? "이 서버는 새 시작점·학습 결과 기능을 아직 지원하지 않아요. 기존 공부·회고를 사용할 수 있어요." : "시작점 정보를 불러오지 못했어요. 학습 결과도 확인하지 못했으며, 기존 공부 제어는 사용할 수 있어요."}<button type="button" className="plain" onClick={onRetry}>시작점 다시 확인</button></p>;
}

type StartProps = {
  todos: Array<{ id: string; title: string; local_date: string }>;
  selectedId: string;
  bookmark: LearningBookmark | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onEdit: (bookmark: LearningBookmark) => void;
  onRefresh: () => void;
};
export function LearningStartPoint({ todos, selectedId, bookmark, busy, onSelect, onEdit, onRefresh }: StartProps) {
  return <section className="learning-start" aria-label="다음 시작점">
    <label className="reflection-field">이어갈 할 일<select value={selectedId} disabled={busy} onChange={event => onSelect(event.target.value)}><option value="">할 일 선택</option>{todos.map(todo => <option key={todo.id} value={todo.id}>{todo.title} · {todo.local_date}</option>)}</select></label>
    {bookmark ? <div className="learning-bookmark"><Bookmark size={24} aria-hidden="true" /><div><span>다음 시작점</span><strong>{bookmark.nextAction || bookmark.resourcePosition || "저장한 자료에서 이어가기"}</strong>{bookmark.resourcePosition && <p>{bookmark.resourcePosition}</p>}{bookmark.resourceUrl && <a href={bookmark.resourceUrl} target="_blank" rel="noopener noreferrer">자료 열기 <ExternalLink size={16} aria-hidden="true" /></a>}</div><button type="button" className="plain" disabled={busy} onClick={() => onEdit(bookmark)}>수정</button></div> : <p>선택한 할 일에 저장된 시작점이 없어요. 기존 할 일로 시작할 수 있어요.</p>}
    <button className="plain learning-refresh" type="button" disabled={busy} onClick={onRefresh}>시작점 새로고침</button>
  </section>;
}

export function LearningResults({ results, totalLabel, sessionCount, timeZone, busy, onEdit }: { results: LearningResult[]; totalLabel: string; sessionCount: number; timeZone: string; busy: boolean; onEdit: (result: LearningResult) => void }) {
  if (!results.length) return null;
  return <section className="learning-results" aria-label="오늘의 학습 결과"><h2>오늘의 학습 결과</h2><p>유효 공부 {totalLabel} · 세션 {sessionCount}회</p><ul>{results.map(result => <li key={result.reflectionId}><time dateTime={result.endedAt}>{new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(result.endedAt))}</time><div><strong>{result.note}</strong>{result.todoTitle && <p>{result.todoTitle}</p>}<button type="button" className="plain" disabled={busy} onClick={() => onEdit(result)}>회고에서 수정</button></div></li>)}</ul></section>;
}
