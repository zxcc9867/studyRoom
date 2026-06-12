export type FacePresenceDetector = {
  detect(video: HTMLVideoElement, nowMs?: number): boolean;
  close(): void;
};

export function createFacePresenceDetector(options?: {
  wasmBaseUrl?: string;
  modelAssetPath?: string;
}): Promise<FacePresenceDetector>;
