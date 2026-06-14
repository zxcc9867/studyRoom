export type UpperBodyPresenceDetector = {
  detect(video: HTMLVideoElement, nowMs?: number): boolean;
  close(): void;
};

export const landmarkIndexes: {
  nose: number;
  leftEye: number;
  rightEye: number;
  leftEar: number;
  rightEar: number;
  leftShoulder: number;
  rightShoulder: number;
};

export function createUpperBodyPresenceDetector(options?: {
  wasmBaseUrl?: string;
  modelAssetPath?: string;
}): Promise<UpperBodyPresenceDetector>;

export function hasSeatedUpperBodyPose(result: unknown): boolean;
