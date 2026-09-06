export function coachSettingsDraft(settings) {
  const draft = {...settings};
  // Postgres time columns return HH:mm:ss; HTML time inputs and the API use
  // minute precision. Normalize stored values, not only the displayed input.
  for (const key of ['summary_time','quiet_start','quiet_end']) {
    const value = draft[key];
    if (typeof value === 'string' && /^\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)) draft[key] = value.slice(0,5);
  }
  return draft;
}
