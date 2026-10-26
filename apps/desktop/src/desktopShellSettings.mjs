const validBounds=value=>value&&['x','y','width','height'].every(key=>Number.isSafeInteger(value[key]))
  && Math.abs(value.x)<=100000 && Math.abs(value.y)<=100000
  && value.width>=375 && value.width<=10000 && value.height>=600 && value.height<=10000;
const pickBounds=value=>({x:value.x,y:value.y,width:value.width,height:value.height});
export function validShellSettings(value) {
  return {bounds:validBounds(value?.bounds)?pickBounds(value.bounds):null,firstHideAcknowledged:value?.firstHideAcknowledged===true};
}
export function restoreBounds(saved,displays=[]) {
  const bounds=validBounds(saved)?pickBounds(saved):{width:1440,height:1000};
  const areas=displays.map(display=>display.workArea).filter(area=>area&&['x','y','width','height'].every(key=>Number.isSafeInteger(area[key]))&&area.width>0&&area.height>0);
  if(!areas.length)return bounds;
  const distance=area=>{
    const x=bounds.x??area.x,y=bounds.y??area.y;
    return Math.max(area.x-x,0,x-(area.x+area.width))**2+Math.max(area.y-y,0,y-(area.y+area.height))**2;
  };
  const area=areas.reduce((best,next)=>distance(next)<distance(best)?next:best);
  const width=Math.min(bounds.width,area.width),height=Math.min(bounds.height,area.height);
  return {x:Math.max(area.x,Math.min(bounds.x??area.x,area.x+area.width-width)),y:Math.max(area.y,Math.min(bounds.y??area.y,area.y+area.height-height)),width,height};
}
// Shell-only convenience state: never credentials, learning records or OS policy.
export function createShellSettings({read,write}) {
  let state;
  try {state=validShellSettings(JSON.parse(read()));}catch{state=validShellSettings(null);}
  const persist=()=>{try{write(JSON.stringify(state));}catch{/* Convenience failure never blocks the window or claims durable success. */}};
  return {
    read:()=>({...state,bounds:state.bounds?{...state.bounds}:null}),
    saveBounds(bounds){if(validBounds(bounds)){state.bounds=pickBounds(bounds);persist();}},
    acknowledgeFirstHide(){state.firstHideAcknowledged=true;persist();},
  };
}
