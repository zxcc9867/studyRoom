import { Component, Suspense, type ReactNode } from "react";
import { AccessibleDialog } from "./AccessibleDialog";
import "./RecoverableSection.css";

type Props = {
  children: ReactNode;
  fallback: ReactNode;
  title: string;
  reloadBlocked: boolean;
  onReturn: () => void;
  modal?: boolean;
};

// Keep failures below DashboardApp, which owns the study and camera lifecycle.
export default class RecoverableSection extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return <Suspense fallback={this.props.fallback}>{this.props.children}</Suspense>;

    const { title, reloadBlocked, onReturn, modal } = this.props;
    const notice = <section className="section-load-recovery" role="alert">
      <h2>{title} 연결을 확인해 주세요</h2>
      <p>이 영역을 불러오지 못했어요. 다른 메뉴는 계속 이용할 수 있어요.</p>
      <div className="section-load-recovery-actions">
        <button type="button" onClick={onReturn}>{modal ? "닫고 돌아가기" : "오늘로 돌아가기"}</button>
        <button type="button" className="secondary" disabled={reloadBlocked} onClick={() => {
          if (!this.props.reloadBlocked) window.location.reload();
        }}>새 화면 불러오기</button>
      </div>
      <p className="section-load-recovery-hint">{reloadBlocked
        ? "공부·휴식 중이거나 학습 정보를 처리하는 동안에는 새로고침하지 않아요."
        : "새로 불러오면 저장하지 않은 입력은 사라질 수 있어요. 저장된 기록은 유지돼요."}</p>
    </section>;

    return modal
      ? <AccessibleDialog className="section-load-recovery-dialog" ariaLabel="화면 연결 확인" onClose={onReturn}>{notice}</AccessibleDialog>
      : notice;
  }
}
