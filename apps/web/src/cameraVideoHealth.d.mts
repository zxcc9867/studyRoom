export type CameraHealth =
  | { ok: true; reason: "live" | "visible-frame" }
  | {
      ok: false;
      reason:
        | "no-video-track"
        | "track-ended"
        | "track-muted"
        | "track-disabled"
        | "no-current-frame"
        | "no-video-size"
        | "blank-frame";
    };

export function getCameraStreamHealth(stream: MediaStream | null): CameraHealth;

export function getCameraFrameHealth(options: {
  readyState: number;
  videoWidth: number;
  videoHeight: number;
  pixels: Uint8ClampedArray | null;
}): CameraHealth;

export function isProbablyBlankCameraFrame(pixels: Uint8ClampedArray | null): boolean;

export function cameraHealthMessage(reason: string): string;
