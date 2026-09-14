import type { ReactNode } from 'react';
import { parseFeedMarkdown, type FeedInline } from '../../../packages/core/src/feedMarkdown.mjs';
import { safeFeedUrl } from './techFeed.mjs';

function inline(nodes:FeedInline[]):ReactNode {
  return nodes.map((node,index)=>{
    if(node.type==='text')return node.text;
    if(node.type==='code')return <code key={index}>{node.text}</code>;
    if(node.type==='strong')return <strong key={index}>{inline(node.children)}</strong>;
    if(node.type==='emphasis')return <em key={index}>{inline(node.children)}</em>;
    const href=safeFeedUrl(node.href);
    return href ? <a key={index} href={href} target="_blank" rel="noopener noreferrer">{inline(node.children)}</a> : <span key={index}>{inline(node.children)}</span>;
  });
}

export function FeedArticleText({text}:{text:string}) {
  return <div className="feed-article-text">{parseFeedMarkdown(text).map((block,index)=>{
    if(block.type==='heading')return <div key={index} className="feed-text-heading" role="heading" aria-level={block.level}>{inline(block.children)}</div>;
    if(block.type==='paragraph')return <p key={index}>{inline(block.children)}</p>;
    if(block.type==='code_block')return <pre key={index} tabIndex={0} aria-label={block.language ? `${block.language} 코드` : '코드'}><code>{block.text}</code></pre>;
    const items=block.items.map((item,i)=><li key={i}>{inline(item)}</li>);
    return block.ordered ? <ol key={index} start={block.start ?? undefined}>{items}</ol> : <ul key={index}>{items}</ul>;
  })}</div>;
}
