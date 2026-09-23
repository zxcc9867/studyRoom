import type { FeedFacets } from './techFeedTypes';

type Props={facets:FeedFacets|null;topic:string;source:string;language:string;total:number|null;busy:boolean;loading:boolean;error:string;onTopic:(value:string)=>void;onSource:(value:string)=>void;onLanguage:(value:string)=>void;onReset:()=>void;onRetry:()=>void};
export function FeedViewFilters({facets,topic,source,language,total,busy,loading,error,onTopic,onSource,onLanguage,onReset,onRetry}:Props) {
  const selected=[language==='ko'?'한국어 원문':language==='en'?'영어 원문':'',topic,facets?.sources.find(item=>item.value===source)?.label || source].filter(Boolean);
  return <div className="feed-view-filters">
    <div className="feed-language-filter" role="group" aria-label="원문 언어로 보기"><span>원문 언어</span>{[{value:'',label:'전체'},{value:'ko',label:'한국어 원문'},{value:'en',label:'영어 원문'}].map(option=><button key={option.value} type="button" aria-pressed={language===option.value} disabled={busy} onClick={()=>onLanguage(option.value)}>{option.label}{facets&&<small>{option.value?facets.languages?.find(item=>item.value===option.value)?.count||0:facets.total}</small>}</button>)}</div>
    <p className="feed-language-help">번역된 제목과 관계없이 원문 제목·소개를 기준으로 분류해요.</p>
    <details>
      <summary>모아둔 글 필터 <span>{selected.length ? `${selected.length}개 조건` : '전체 보기'}</span></summary>
      <p className="feed-budget">이미 모아둔 글만 골라 봐요. 소식 수집 설정은 바뀌지 않아요.</p>
      {loading && <p role="status">필터를 불러오는 중…</p>}
      {error && <p className="feed-notice feed-error" role="alert">{error}<button className="secondary" type="button" onClick={onRetry} disabled={loading}>필터 다시 시도</button></p>}
      <div className="feed-filters">
        <label>주제<select value={topic} disabled={busy} onChange={event=>onTopic(event.target.value)}><option value="">전체 주제</option>{topic&&!facets?.topics.some(item=>item.value===topic)&&<option value={topic}>{topic}</option>}{facets?.topics.map(item=><option key={item.value} value={item.value}>{item.label} · {item.count}</option>)}</select></label>
        <label>출처<select value={source} disabled={busy} onChange={event=>onSource(event.target.value)}><option value="">전체 출처</option>{source&&!facets?.sources.some(item=>item.value===source)&&<option value={source}>{source}</option>}{facets?.sources.map(item=><option key={item.value} value={item.value}>{item.label} · {item.count}</option>)}</select></label>
      </div>
    </details>
    <div className="feed-filter-summary"><p role="status">{selected.length?selected.join(' · '):'전체 글'} · {total===null?'결과 확인 중':`결과 ${total}건`}</p>{selected.length>0&&<button className="secondary" type="button" disabled={busy} onClick={onReset}>필터 초기화</button>}</div>
  </div>;
}
