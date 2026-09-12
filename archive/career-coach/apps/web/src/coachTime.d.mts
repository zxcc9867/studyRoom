export function validTimeZone(value: string): boolean;
export function timeZoneChoices(): string[];
export function localParts(instant: string | number | Date, timeZone: string): string;
export function wallTimeToInstant(value: string, timeZone: string): string;
export function shiftDate(value: string, days: number): string;
export function eventsOnDate<T extends {all_day:boolean;start_date?:string|null;end_date?:string|null;start_at?:string|null;end_at?:string|null;repeat_weekdays:number[];repeat_until?:string|null;time_zone:string}>(events:T[],dateKey:string,timeZone:string):T[];
