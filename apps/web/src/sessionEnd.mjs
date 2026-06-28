export const ACTIVE_STUDY_SESSION_NOT_FOUND_MESSAGE = "Active study session not found";

export function isStaleActiveSessionEndError(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  return message.toLowerCase().includes(ACTIVE_STUDY_SESSION_NOT_FOUND_MESSAGE.toLowerCase());
}
