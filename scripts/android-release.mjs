import { createHash } from "node:crypto";

export function buildAndroidRelease({ versionName, versionCode, releasedAt, releaseNotes, apkUrl, apkBytes }) {
  if (typeof versionName !== "string" || !versionName.trim() || versionName.length > 32) throw new Error("Invalid versionName");
  if (!Number.isInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) throw new Error("Invalid versionCode");
  const date = typeof releasedAt === "string" && /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(releasedAt);
  const calendar = date ? new Date(`${date[1]}-${date[2]}-${date[3]}T00:00:00Z`) : null;
  if (!date || !calendar || calendar.getUTCFullYear() !== Number(date[1]) || calendar.getUTCMonth() + 1 !== Number(date[2]) || calendar.getUTCDate() !== Number(date[3]) || !Number.isFinite(Date.parse(releasedAt))) throw new Error("Invalid releasedAt");
  if (!Array.isArray(releaseNotes) || releaseNotes.length > 8 || releaseNotes.some(note => typeof note !== "string" || !note.trim() || note.length > 200)) throw new Error("Invalid releaseNotes");
  // Check the raw URL so URL normalization cannot conceal dot segments or credentials.
  if (typeof apkUrl !== "string" || !/^https:\/\/github\.com\/zxcc9867\/studyRoom\/releases\/download\/[A-Za-z0-9_-][A-Za-z0-9._-]*\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.apk$/.test(apkUrl)) throw new Error("Invalid apkUrl");
  if (!Buffer.isBuffer(apkBytes) || apkBytes.length < 1 || apkBytes.length > 150 * 1024 * 1024) throw new Error("Invalid apkBytes");
  const release = {
    schemaVersion: 1, packageName: "com.jini9867.studyroomattendance",
    versionName, versionCode, releasedAt, releaseNotes: [...releaseNotes], apkUrl,
    sha256: createHash("sha256").update(apkBytes).digest("hex"), sizeBytes: apkBytes.length,
  };
  if (Buffer.byteLength(`${JSON.stringify(release, null, 2)}\n`) > 16 * 1024) throw new Error("Release JSON exceeds 16KiB");
  return release;
}
