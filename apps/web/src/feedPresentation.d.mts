export function feedPageView<T>(articles:T[],requestedPage:number,cursor:string|null,savedOnly?:boolean):{page:number;loadedPages:number;items:T[];numbers:number[];hasNext:boolean};
export function feedExcerptView(value:unknown):{full:string;preview:string;expandable:boolean};

export function feedStructuredIntroduction(value:unknown):string;
