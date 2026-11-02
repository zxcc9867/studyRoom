import {useEffect, useId, useRef, useState, useSyncExternalStore} from 'react';
import {BookOpen, Camera, Maximize2, Menu, Minimize2, Pause, Play, Settings, X} from 'lucide-react';
import {AccessibleDialog} from './AccessibleDialog';
import {dashboardDestinations} from './DashboardNavigation';
import type {DashboardSection} from './dashboardRoute.mjs';
import AtmosphereSettings from './AtmosphereSettings';
import {atmosphereThemes, getAtmosphereController} from './atmosphere.mjs';
import {getWindowPresentationSupport, isDesktopStudyApp, setWindowPresentation, type WindowPresentation} from './desktopBridge.mjs';
import './scenicStudy.css';

type Props = {task: string; clock: string; status: string; camera: string; actionLabel: string;
  actionDisabled: boolean; endDisabled: boolean; hasSession: boolean; notice: string;
  onAction: () => void; onEnd: () => void; onClose: () => void; onNavigate: (section: DashboardSection) => void};
const focusable = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]';

export default function ScenicStudyView(props: Props) {
  const view = useRef<HTMLElement>(null);
  const close = useRef(props.onClose); close.current = props.onClose;
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const menuOpenRef=useRef(false);menuOpenRef.current=menuOpen;
  const menuRoot=useRef<HTMLDivElement>(null);
  const menuButton=useRef<HTMLButtonElement>(null);
  const suppressMenuFocus=useRef(false);
  const pointerMenuOpen=useRef(false);
  const menuId=useId();
  const [supported,setSupported]=useState(false);
  const capability = useRef(false);
  const [presentation,setPresentation]=useState<WindowPresentation>({mode:'normal'});
  const [nativeBusy,setNativeBusy]=useState(false);
  const [nativeError,setNativeError]=useState('');
  const controller=getAtmosphereController(window);
  const atmosphere=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const theme=atmosphereThemes.find(item=>item.id===atmosphere.background)!;
  const playback=atmosphere.motion!=='live'?'정적 배경':atmosphere.reducedMotion?'움직임 줄이기로 정지':atmosphere.paused?'라이브 일시정지':atmosphere.playing?'라이브 재생 중':'비활성 창에서 정지';
  function dismissMenu(restoreFocus=false) {
    setMenuOpen(false);
    if(restoreFocus){suppressMenuFocus.current=true;menuButton.current?.focus();suppressMenuFocus.current=false;}
  }
  useEffect(()=>{
    if(!menuOpen)return;
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!menuRoot.current?.contains(event.target))dismissMenu();};
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[menuOpen]);
  async function probe() {
    try { const value=await getWindowPresentationSupport(window);capability.current=value;setSupported(value);setNativeError(''); }
    catch {setNativeError('미니 창 지원을 확인하지 못했어요. 풍경 화면은 계속 사용할 수 있어요.');}
  }
  useEffect(()=>{
    let disposed=false;
    if(isDesktopStudyApp(window))void getWindowPresentationSupport(window).then(value=>{
      if(!disposed){capability.current=value;setSupported(value);}
    }).catch(()=>{if(!disposed)setNativeError('미니 창 지원을 확인하지 못했어요. 풍경 화면은 계속 사용할 수 있어요.');});
    return ()=>{disposed=true;if(capability.current)void setWindowPresentation(window,{mode:'normal'}).catch(()=>{});};
  },[]);
  async function change(value: WindowPresentation) {
    if(nativeBusy)return false;
    setNativeBusy(true);setNativeError('');
    try {setPresentation(await setWindowPresentation(window,value));return true;}
    catch {setNativeError('창 크기를 바꾸지 못했어요. 다시 확대하거나 메뉴에서 이동을 시도해 주세요.');return false;}
    finally {setNativeBusy(false);}
  }
  const leaving=useRef(false);
  async function back(destination?: DashboardSection) {
    if(nativeBusy||leaving.current)return;
    leaving.current=true;
    // Restore before removing compact controls: failure must leave a usable mini UI.
    if(capability.current&&!await change({mode:'normal'})){leaving.current=false;return;}
    if(destination)props.onNavigate(destination);else close.current();
  }
  const backRef=useRef(back);backRef.current=back;

  useEffect(()=>{
    const scene=view.current,root=scene?.closest('main');
    if(!scene||!root)return;
    const entry=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';document.documentElement.dataset.scenicStudy='active';
    // Dialogs are inline and interleaved with camera content. Shield only branches
    // with no dialog, retaining DOM/layout/video; never inert a dialog ancestor.
    const shielded=new Map<HTMLElement,{inert:boolean;hidden:string|null}>();
    let modalWasOpen=false;
    let sceneFocus:HTMLElement|null=null;
    const rememberFocus=(event:FocusEvent)=>{if(event.target instanceof HTMLElement&&scene.contains(event.target))sceneFocus=event.target;};
    document.addEventListener('focusin',rememberFocus);
    function clear() {for(const [node,old] of shielded){node.inert=old.inert;if(old.hidden===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',old.hidden);node.removeAttribute('data-scenic-shield');}shielded.clear();}
    function shield() {
      clear();
      const dialogs=Array.from(root!.querySelectorAll<HTMLElement>('[role="dialog"],.modal-backdrop'));
      function walk(parent:Element) {for(const child of Array.from(parent.children)){
        if(!(child instanceof HTMLElement))continue;
        if(dialogs.some(dialog=>child===dialog))continue;
        if(child===scene){child.inert=dialogs.length>0;continue;}
        if(child.contains(scene)||dialogs.some(dialog=>child.contains(dialog))){walk(child);continue;}
        shielded.set(child,{inert:child.inert,hidden:child.getAttribute('aria-hidden')});
        child.inert=true;child.setAttribute('aria-hidden','true');child.dataset.scenicShield='';
      }}
      walk(root!);
      if(modalWasOpen&&dialogs.length===0&&sceneFocus?.isConnected)sceneFocus.focus();
      modalWasOpen=dialogs.length>0;
    }
    shield();const observer=new MutationObserver(shield);observer.observe(root,{childList:true,subtree:true});
    const frame=requestAnimationFrame(()=>scene.focus({preventScroll:true}));
    function keyboard(event:KeyboardEvent) {
      if(root!.querySelector('[role="dialog"],.modal-backdrop'))return;
      if(event.key==='Escape'){event.preventDefault();if(menuOpenRef.current)dismissMenu(true);else void backRef.current();return;}
      if(event.key!=='Tab')return;
      const controls=Array.from(scene!.querySelectorAll<HTMLElement>(focusable)).filter(control=>!control.closest('[inert]')&&control.getClientRects().length>0);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
    document.addEventListener('keydown',keyboard);
    return ()=>{observer.disconnect();cancelAnimationFrame(frame);clear();scene.inert=false;
      document.removeEventListener('focusin',rememberFocus);
      document.removeEventListener('keydown',keyboard);document.body.style.overflow=overflow;
      // An inline child dialog restores its captured "hidden" during unmount.
      // Reconcile after those cleanups, without unlocking any surviving modal.
      queueMicrotask(()=>{if(!document.querySelector('.scenic-study,.modal-backdrop'))document.body.style.overflow=overflow;});
      delete document.documentElement.dataset.scenicStudy;entry?.focus();};
  },[]);

  return <>
    <section ref={view} tabIndex={-1} className={`scenic-study${presentation.mode==='mini'?' scenic-study--mini':''}`} aria-label="풍경 집중 화면">
      <header className="scenic-header">
        <div ref={menuRoot} className="scenic-navigation" onPointerEnter={event=>{if(event.pointerType==='mouse')setMenuOpen(true);}} onPointerLeave={()=>{if(!menuRoot.current?.contains(document.activeElement))dismissMenu();}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))dismissMenu();}}>
          <button ref={menuButton} type="button" disabled={nativeBusy} aria-label="전체 메뉴" aria-expanded={menuOpen} aria-controls={menuId} onFocus={()=>{if(!suppressMenuFocus.current)setMenuOpen(true);}} onPointerDown={()=>{pointerMenuOpen.current=menuOpen;}} onClick={event=>setMenuOpen(event.detail===0?!menuOpen:!pointerMenuOpen.current)}><Menu size={20}/><span>메뉴</span></button>
          <nav id={menuId} className="scenic-menu" aria-label="풍경 화면 메뉴" aria-hidden={!menuOpen} inert={!menuOpen} data-open={menuOpen}>
            {dashboardDestinations.map(({id,label,icon:Icon})=><a key={id} href={`#${id}`} aria-current={id==='today'?'page':undefined} aria-disabled={nativeBusy||undefined} onClick={event=>{event.preventDefault();dismissMenu();void back(id);}}><Icon size={20} aria-hidden="true"/><span>{id==='today'?'내 공부':label}</span></a>)}
          </nav>
        </div>
        <span className="scenic-brand"><BookOpen size={22}/>독서실</span>
        <div className="scenic-tools">
          <span className="scenic-theme"><span>{theme.name}</span><span className="scenic-playback">{playback}</span></span>
          {theme.live&&<button type="button" className="scenic-live" disabled={atmosphere.reducedMotion} aria-label={atmosphere.motion!=='live'?'라이브 켜기':atmosphere.paused?'라이브 재생':'라이브 일시정지'} onClick={()=>controller.setPreferences({...atmosphere,motion:'live',paused:atmosphere.motion==='live'&&!atmosphere.paused})}>{atmosphere.motion==='live'&&!atmosphere.paused?<Pause size={18}/>:<Play size={18}/>}<span>{atmosphere.motion!=='live'?'라이브 켜기':atmosphere.paused?'재생':'일시정지'}</span></button>}
          {supported&&<button type="button" disabled={nativeBusy} onClick={()=>void change({mode:presentation.mode==='mini'?'normal':'mini'})} aria-label={presentation.mode==='mini'?'확대':'미니 창'}>{presentation.mode==='mini'?<Maximize2 size={18}/>:<Minimize2 size={18}/>}<span>{presentation.mode==='mini'?'확대':'미니 창'}</span></button>}
          <button type="button" aria-label="풍경 배경 설정" onClick={()=>setSettingsOpen(true)}><Settings size={18}/></button>
        </div>
      </header>
      <div className="scenic-landscape" aria-hidden="true"/>
      <div className="scenic-dock">
        <div className="scenic-task"><p className="scenic-status">● {props.status}</p><h1>{props.task}</h1><p className="scenic-camera"><Camera size={16}/>{props.camera}</p></div>
        <strong className="scenic-clock" role="timer" aria-label="풍경 세션 공부시간">{props.clock}</strong>
        <div className="scenic-actions"><button type="button" disabled={props.actionDisabled} onClick={props.onAction}>{props.actionLabel}</button>{props.hasSession&&<button type="button" disabled={props.endDisabled} onClick={props.onEnd}>종료</button>}</div>
        {props.notice&&<p className="scenic-notice" role="status">{props.notice}</p>}
        {nativeError&&<div className="scenic-notice" role="alert"><p>{nativeError}</p>{!supported&&<button type="button" onClick={()=>void probe()}>지원 다시 확인</button>}</div>}
      </div>
    </section>
    {settingsOpen&&<AccessibleDialog className="scenic-settings" ariaLabel="풍경 배경 설정" onClose={()=>setSettingsOpen(false)} closeOnBackdrop><div className="scenic-settings-heading"><h2>풍경 배경 설정</h2><button type="button" className="secondary" aria-label="풍경 배경 설정 닫기" onClick={()=>setSettingsOpen(false)}><X size={20}/></button></div><div className="settings-content"><AtmosphereSettings/></div></AccessibleDialog>}
  </>;
}
