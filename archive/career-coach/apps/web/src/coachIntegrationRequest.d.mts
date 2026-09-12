export function requestIntegration<T=Record<string,unknown>>(request:(name:string,body:Record<string,unknown>)=>Promise<T>,payload:Record<string,unknown>):Promise<T>;
