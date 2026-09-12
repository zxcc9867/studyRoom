import {Pause, Play, Search, Sparkles} from 'lucide-react';
import {interestPromptResult, searchStatusLabel} from './techFeed.mjs';
import type {FeedPreferences, FeedSearchStatus} from './techFeedTypes';

type Props = {
  preferences:FeedPreferences;
  searchStatus:FeedSearchStatus;
  serviceAvailable:boolean;
  draft:string;
  busy:boolean;
  conflict:boolean;
  onDraftChange:(value:string)=>void;
  onSave:()=>void;
  onReceivingChange:(receiving:boolean)=>void;
  onRetry:()=>void;
};

export function FeedInterestSettings({
  preferences,searchStatus,serviceAvailable,draft,busy,conflict,
  onDraftChange,onSave,onReceivingChange,onRetry,
}:Props) {
  const validation=interestPromptResult(draft);
  const primaryLabel=preferences.prompt ? '관심 내용 변경' : '소식 받아보기';
  const availabilityCopy=!preferences.receiving
    ? '수신을 쉬는 동안에도 저장한 글과 공부할 일 연결은 그대로 남아 있어요.'
    : !serviceAvailable
      ? '설정은 저장됐지만 현재 새 소식 수집은 중지되어 있어요. 저장한 글은 계속 볼 수 있어요.'
      : searchStatus.state==='not_configured'
        ? '관심 설정은 저장됐어요. 웹 검색 연결 전에도 사용 가능한 공개 출처의 소식은 계속 확인할 수 있어요.'
        : '설정한 관심 내용에 맞춰 공개 기술 소식을 준비하고 있어요.';

  return <section className="feed-interest-settings" aria-labelledby="feed-interest-title">
    <div className="feed-interest-heading">
      <div>
        <p className="feed-kicker"><Sparkles size={14}/> MY READING SIGNAL</p>
        <h3 id="feed-interest-title">무엇을 더 깊이 보고 싶나요?</h3>
        <p>키워드 몇 개보다, 지금 궁금한 기술과 맥락을 짧은 문장으로 적어 주세요.</p>
      </div>
      <span className={`feed-search-state is-${searchStatus.state}`} role="status" aria-live="polite"><Search size={15}/>{searchStatusLabel(searchStatus)}</span>
    </div>
    <form onSubmit={event=>{event.preventDefault();onSave();}}>
      <label htmlFor="feed-interest-prompt">관심 내용</label>
      <textarea
        id="feed-interest-prompt"
        name="feed-interest-prompt"
        maxLength={300}
        value={draft}
        onChange={event=>onDraftChange(event.target.value)}
        aria-describedby="feed-interest-examples feed-interest-consent feed-interest-validation"
        aria-invalid={Boolean(validation.error)}
        placeholder="예: React 접근성과 PostgreSQL 성능 개선 사례"
        disabled={busy}
      />
      <div className="feed-interest-undertext">
        <p id="feed-interest-examples">예: 작은 팀의 AI 도구 활용 · 웹 접근성 실전 사례 · 서버리스 비용 최적화</p>
        <span>{[...draft].length}/300</span>
      </div>
      <p id="feed-interest-consent" className="feed-consent">입력한 공개 기술 관심 내용은 검색 서비스에 전달됩니다. 개인정보나 비밀 정보, 이메일, API 키, 비공개 주소는 입력하지 마세요.</p>
      <p id="feed-interest-validation" className="feed-validation" aria-live="polite">{draft && validation.error ? validation.error : ''}</p>
      <div className="feed-interest-actions">
        <button className="primary" type="submit" disabled={busy||Boolean(validation.error)}>
          <Search size={16}/>{busy? '저장하는 중…':primaryLabel}
        </button>
        {preferences.prompt && <button className="secondary" type="button" disabled={busy} onClick={()=>onReceivingChange(!preferences.receiving)}>
          {preferences.receiving ? <Pause size={16}/> : <Play size={16}/>}
          {preferences.receiving ? '수신 잠시 멈추기' : '저장한 관심사로 다시 받기'}
        </button>}
      </div>
    </form>
    <div className="feed-interest-status" role="status" aria-live="polite">
      <strong>{preferences.receiving ? '관심 소식 수신 설정됨' : '관심 소식 수신 쉬는 중'}</strong>
      <span>{availabilityCopy}</span>
      {searchStatus.last_success_at && <small>웹 검색 결과는 마지막 성공 시각의 캐시를 이어서 보여 줄 수 있어요.</small>}
    </div>
    {conflict && <div className="feed-interest-conflict" role="alert">
      <p>다른 곳에서 설정이 변경되어 최신 상태를 불러왔어요. 작성 중인 내용은 그대로 두었습니다.</p>
      <button className="secondary" type="button" disabled={busy} onClick={onRetry}>현재 내용으로 다시 저장</button>
    </div>}
  </section>;
}
