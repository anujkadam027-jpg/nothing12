import type { NormalizedPoseAnchors } from '../types/poshak';

type PoseLandmarkerType = import('@mediapipe/tasks-vision').PoseLandmarker;

let poseLandmarkerPromise: Promise<PoseLandmarkerType | null> | null = null;

/**
 * Loads MediaPipe Pose Landmarker lazily using the locally hosted WASM runtime
 * under /mediapipe/wasm. Returns null gracefully if the model cannot load offline.
 */
export async function getPoseLandmarker(
  runningMode: 'IMAGE' | 'VIDEO' = 'VIDEO'
): Promise<PoseLandmarkerType | null> {
  if (!poseLandmarkerPromise) {
    poseLandmarkerPromise = (async () => {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const filesetResolver = await vision.FilesetResolver.forVisionTasks('/mediapipe/wasm');
        const landmarker = await vision.PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'CPU',
          },
          runningMode,
          numPoses: 1,
          minPoseDetectionConfidence: 0.45,
          minPosePresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
          outputSegmentationMasks: false,
        });
        return landmarker;
      } catch (err) {
        console.warn('MediaPipe Pose Landmarker unavailable, using fallback calibration anchors:', err);
        return null;
      }
    })();
  }
  return poseLandmarkerPromise;
}

export function landmarksToAnchors(
  landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }> | undefined
): NormalizedPoseAnchors | null {
  if (!landmarks || landmarks.length < 29) return null;

  const pt = (idx: number) => ({
    x: landmarks[idx]?.x ?? 0.5,
    y: landmarks[idx]?.y ?? 0.5,
    visibility: landmarks[idx]?.visibility ?? 0.9,
  });

  // MediaPipe Pose landmark indices:
  // 0: nose, 11: left_shoulder, 12: right_shoulder, 13: left_elbow, 14: right_elbow
  // 15: left_wrist, 16: right_wrist, 23: left_hip, 24: right_hip
  // 25: left_knee, 26: right_knee, 27: left_ankle, 28: right_ankle
  return {
    nose: pt(0),
    leftShoulder: pt(12), // mirrored anatomical left/right in camera view
    rightShoulder: pt(11),
    leftElbow: pt(14),
    rightElbow: pt(13),
    leftWrist: pt(16),
    rightWrist: pt(15),
    leftHip: pt(24),
    rightHip: pt(23),
    leftKnee: pt(26),
    rightKnee: pt(25),
    leftAnkle: pt(28),
    rightAnkle: pt(27),
  };
}
