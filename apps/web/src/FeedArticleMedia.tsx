import {useState} from 'react';
import {Play, X} from 'lucide-react';
import {safeMediaUrl,videoEmbedUrl} from '../../../packages/core/src/feedMedia.mjs';
import type {FeedArticle} from './techFeedTypes';

export function FeedArticleMedia({media,title,original}:{media:FeedArticle['media'];title:string;original:string|null}){
 const [failed,setFailed]=useState(false),[playing,setPlaying]=useState(false);
 const image=failed?null:safeMediaUrl(media?.image_url),embed=videoEmbedUrl(media?.video);
 if(!image&&!embed)return null;
 return <figure className="feed-media">
  <div className={'feed-media-frame'+(embed?' has-video':'')}>
   {playing&&embed?<iframe src={embed} title={title+' · 첨부 영상'} allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation"/>:<>
    {image&&(original?<a href={original} target="_blank" rel="noopener noreferrer" tabIndex={embed?-1:0}><img src={image} alt={title+' · 원문 제공 이미지'} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/></a>:<img src={image} alt={title+' · 원문 제공 이미지'} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>)}
    {embed&&<button type="button" className="feed-media-play" onClick={()=>setPlaying(true)} aria-expanded={false}><Play size={23} aria-hidden="true"/>영상 불러오기</button>}
   </>}
  </div>
  <figcaption><span>{playing?'재생이 안 되면 원문에서 확인해 주세요.':embed?'클릭하면 외부 영상 플레이어에 연결돼요.':'원문 제공 이미지 · 눌러서 출처 보기'}</span>{playing&&<button type="button" className="feed-media-close" onClick={()=>setPlaying(false)}><X size={15} aria-hidden="true"/>영상 닫기</button>}</figcaption>
 </figure>;
}
