import assert from "node:assert/strict";
import test from "node:test";

const input = {
  versionName: "0.2.0", versionCode: 3, releasedAt: "2026-10-05T09:00:00+09:00",
  releaseNotes: ["앱에서 업데이트를 확인하고 직접 설치할 수 있어요."],
  apkUrl: "https://github.com/zxcc9867/studyRoom/releases/download/android-v0.2.0-build3/study-room-0.2.0-build3.apk",
  apkBytes: Buffer.from("apk-fixture"),
};

test("release builder derives schema metadata from the actual APK Buffer, not caller guesses", async () => {
  const { buildAndroidRelease } = await import("./android-release.mjs");
  const release = buildAndroidRelease({ ...input, sizeBytes: 99, sha256: "guessed", token: "not-public", localPath: "not-public" });
  assert.deepEqual(release, {
    schemaVersion: 1, packageName: "com.jini9867.studyroomattendance",
    versionName: "0.2.0", versionCode: 3, releasedAt: "2026-10-05T09:00:00+09:00",
    releaseNotes: ["앱에서 업데이트를 확인하고 직접 설치할 수 있어요."],
    apkUrl: "https://github.com/zxcc9867/studyRoom/releases/download/android-v0.2.0-build3/study-room-0.2.0-build3.apk",
    sha256: "3934be6f0ca5c6c3efc3576bb846f79a8512db715c6a8103b034cb29e676fd8e", sizeBytes: 11,
  });
  assert.notEqual(release.releaseNotes, input.releaseNotes);
});

test("release builder rejects untrusted URLs instead of publishing arbitrary installation targets", async () => {
  const { buildAndroidRelease } = await import("./android-release.mjs");
  for (const apkUrl of [
    input.apkUrl.replace("zxcc9867", "someone"), input.apkUrl.replace("studyRoom", "another"),
    input.apkUrl.replace("https:", "http:"), input.apkUrl.replace("github.com", "github.com.evil.test"),
    input.apkUrl.replace("github.com", "user:pass@github.com"), input.apkUrl + "?token=secret", input.apkUrl + "#fragment",
    input.apkUrl.replace("github.com", "github.com:444"), input.apkUrl.replace("android-v0.2.0-build3", "../android-v0.2.0-build3"),
    input.apkUrl.replace("android-v0.2.0-build3", "%2e%2e"), input.apkUrl.replace(".apk", ".zip"),
  ]) assert.throws(() => buildAndroidRelease({ ...input, apkUrl }), /apkUrl/);
});

test("release builder rejects out-of-contract versions, dates, notes and APK bytes", async () => {
  const { buildAndroidRelease } = await import("./android-release.mjs");
  for (const versionCode of [0, -1, 1.5, 2100000001, "3", NaN]) assert.throws(() => buildAndroidRelease({ ...input, versionCode }), /versionCode/);
  for (const versionName of ["", " ", "v".repeat(33), 2]) assert.throws(() => buildAndroidRelease({ ...input, versionName }), /versionName/);
  for (const releasedAt of ["invalid", "2026-10-05", "2026-10-05T09:00:00", "2026-02-30T00:00:00Z", "2026-10-05T25:00:00Z", "2026-10-05T00:00:00+24:00"]) assert.throws(() => buildAndroidRelease({ ...input, releasedAt }), /releasedAt/);
  for (const releaseNotes of ["note", [2], Array(9).fill("note"), ["n".repeat(201)]]) assert.throws(() => buildAndroidRelease({ ...input, releaseNotes }), /releaseNotes/);
  for (const apkBytes of [Buffer.alloc(0), "apk-fixture", new Uint8Array(11)]) assert.throws(() => buildAndroidRelease({ ...input, apkBytes }), /apkBytes/);
  assert.throws(() => buildAndroidRelease({ ...input, apkBytes: Buffer.alloc(150 * 1024 * 1024 + 1) }), /apkBytes/);
});

test("release builder accepts valid boundary values without changing the supplied release time", async () => {
  const { buildAndroidRelease } = await import("./android-release.mjs");
  const release = buildAndroidRelease({ ...input, versionName: "v".repeat(32), versionCode: 2100000000, releasedAt: "2024-02-29T23:59:59.123Z", releaseNotes: Array(8).fill("n".repeat(200)), apkBytes: Buffer.from([0]) });
  assert.equal(release.versionCode, 2100000000);
  assert.equal(release.releasedAt, "2024-02-29T23:59:59.123Z");
  assert.equal(release.sizeBytes, 1);
  assert.ok(Buffer.byteLength(JSON.stringify(release)) <= 16 * 1024);
});

test("release builder refuses a serialized manifest above the 16KiB client limit", async () => {
  const { buildAndroidRelease } = await import("./android-release.mjs");
  assert.throws(() => buildAndroidRelease({ ...input, apkUrl: `https://github.com/zxcc9867/studyRoom/releases/download/${"v".repeat(16 * 1024)}/release.apk` }), /16KiB/);
});
