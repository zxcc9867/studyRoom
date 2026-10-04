import { requireOptionalNativeModule } from "expo";

export type AndroidRelease = {
  schemaVersion: 1;
  packageName: string;
  versionName: string;
  versionCode: number;
  releasedAt: string;
  releaseNotes: string[];
  apkUrl: string;
  sha256: string;
  sizeBytes: number;
};

export type InstalledVersion = {
  supported: boolean;
  packageName: string;
  versionName: string;
  versionCode: number;
};

export type NativeUpdateState = {
  phase: "idle" | "downloading" | "verifying" | "ready" | "failed" | "cancelled" | "install_pending" | "installed";
  downloadedBytes: number;
  totalBytes: number;
  versionCode: number | null;
  errorCode: string | null;
  release: AndroidRelease | null;
};

export type StudyAppUpdate = {
  getInstalledVersion(): InstalledVersion;
  getState(): NativeUpdateState;
  fetchLatestRelease(): Promise<AndroidRelease>;
  downloadRelease(release: AndroidRelease): Promise<NativeUpdateState>;
  cancelDownload(): NativeUpdateState;
  canInstall(): boolean;
  openInstallPermissionSettings(): void;
  installDownloaded(): Promise<NativeUpdateState>;
  addListener(event: "onUpdateState", listener: (state: NativeUpdateState) => void): { remove(): void };
};

export default requireOptionalNativeModule<StudyAppUpdate>("StudyAppUpdate");
