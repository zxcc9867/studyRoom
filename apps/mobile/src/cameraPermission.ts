export type CameraPermissionStatus = "granted" | "denied" | "blocked" | "cancelled" | "unavailable";

export async function prepareCameraPermission(ports: {
  check: () => Promise<boolean>;
  explain: () => Promise<boolean>;
  request: () => Promise<string>;
}): Promise<CameraPermissionStatus> {
  if (await ports.check()) return "granted";
  if (!await ports.explain()) return "cancelled";
  const result = await ports.request();
  return result === "granted" ? "granted" : result === "never_ask_again" ? "blocked" : "denied";
}
