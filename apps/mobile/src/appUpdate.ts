import type { AndroidRelease, InstalledVersion } from "../modules/my-module/src/StudyAppUpdateModule";
export type { AndroidRelease, InstalledVersion } from "../modules/my-module/src/StudyAppUpdateModule";

const packageName = "com.jini9867.studyroomattendance";
const integerInRange = (value: unknown, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;
export function validateAndroidRelease(value: unknown): AndroidRelease {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_RELEASE");
  const r = value as Record<string, unknown>;
  const date = typeof r.releasedAt === "string" && /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(r.releasedAt);
  const calendar = date ? new Date(Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]))) : null;
  const validDate = Boolean(date && calendar && calendar.getUTCFullYear() === Number(date[1]) && calendar.getUTCMonth() + 1 === Number(date[2]) && calendar.getUTCDate() === Number(date[3]) && Number.isFinite(Date.parse(r.releasedAt as string)));
  // Validate raw path before URL normalization can hide dot segments or credentials.
  const validUrl = typeof r.apkUrl === "string" && /^https:\/\/github\.com\/zxcc9867\/studyRoom\/releases\/download\/[A-Za-z0-9_-][A-Za-z0-9._-]*\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.apk$/.test(r.apkUrl);
  if (r.schemaVersion !== 1 || r.packageName !== packageName || typeof r.versionName !== "string" || !r.versionName.trim() || r.versionName.length > 32
    || !integerInRange(r.versionCode, 2100000000) || !integerInRange(r.sizeBytes, 150 * 1024 * 1024) || !validDate || !validUrl
    || typeof r.sha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(r.sha256)
    || !Array.isArray(r.releaseNotes) || r.releaseNotes.length > 8 || r.releaseNotes.some(n => typeof n !== "string" || !n.trim() || n.length > 200)) throw new Error("INVALID_RELEASE");
  return { schemaVersion: 1, packageName, versionName: r.versionName, versionCode: r.versionCode, releasedAt: r.releasedAt as string,
    releaseNotes: [...r.releaseNotes] as string[], apkUrl: r.apkUrl as string, sha256: r.sha256, sizeBytes: r.sizeBytes };
}
export function isNewerRelease(release: AndroidRelease, installed: InstalledVersion): boolean {
  return installed.supported && installed.packageName === packageName && integerInRange(installed.versionCode, 2100000000) && release.versionCode > installed.versionCode;
}
export function getUpdateErrorMessage(error: unknown): string {
  const value = error as { code?: unknown; message?: unknown } | null;
  const code = typeof value?.code === "string" ? value.code : typeof value?.message === "string" ? value.message : "";
  if (code === "CHECK_TIMEOUT" || code === "TIMEOUT") return "업데이트 확인 시간이 초과됐어요. 연결을 확인하고 다시 시도해 주세요.";
  if (code === "INVALID_RELEASE") return "출시 정보를 안전하게 확인하지 못했어요. 잠시 후 다시 확인해 주세요.";
  if (code === "CANCELLED") return "다운로드를 취소했어요. 현재 앱을 계속 사용할 수 있어요.";
  if (code === "INSUFFICIENT_STORAGE") return "저장 공간이 부족해요. 여유 공간을 확보하고 다시 시도해 주세요.";
  if (code === "install_failed" || code === "install_unavailable") return "Android 설치 화면을 열지 못했어요. 기기 관리자나 제조사의 보안 정책으로 설치가 제한될 수 있어요. 보안 설정을 우회하지 말고 설치 안내를 확인해 주세요. 기존 앱을 삭제하지 않아도 현재 앱과 로그인 데이터를 유지할 수 있어요.";
  return "업데이트를 완료하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요. 현재 앱은 계속 사용할 수 있어요.";
}
