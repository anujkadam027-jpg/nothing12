import type {
  BodyParameters,
  CalibrationSettings,
  CategoryId,
  GarmentProduct,
  GarmentSize,
  NormalizedPoseAnchors,
  Point2D,
  TorsoFitFrame,
} from '../types/poshak';

export const DEFAULT_CALIBRATION: CalibrationSettings = {
  mirrored: true,
  scaleOffset: 1.0,
  verticalOffset: 0.0,
  horizontalOffset: 0.0,
  shoulderSpread: 1.0,
  smoothingAlpha: 0.35,
  showCalibrationGrid: true,
  showLandmarks: true,
  enableArmOcclusion: true,
};

export const DEFAULT_BODY_PARAMS: BodyParameters = {
  chestCm: 94,
  waistCm: 76,
  hipsCm: 96,
  heightCm: 173,
  fitPreference: 'Regular',
};

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Computes canonical garment fitting frame in normalized [0..1] viewport coordinates
 * from MediaPipe pose landmarks + user camera calibration offsets.
 */
export function computeTorsoFitFrame(
  anchors: NormalizedPoseAnchors | null,
  fitRegion: GarmentProduct['fitRegion'],
  calibration: CalibrationSettings
): TorsoFitFrame {
  if (!anchors) {
    return {
      centerX: 0.5,
      centerY: 0.5,
      width: 0.3,
      height: 0.4,
      rotationRad: 0,
      yawRad: 0,
      confidence: 0,
      valid: false,
    };
  }

  const ls = anchors.leftShoulder;
  const rs = anchors.rightShoulder;
  const lh = anchors.leftHip;
  const rh = anchors.rightHip;
  const la = anchors.leftAnkle;
  const ra = anchors.rightAnkle;

  const minVis = Math.min(
    ls.visibility ?? 1,
    rs.visibility ?? 1,
    lh.visibility ?? 1,
    rh.visibility ?? 1
  );

  if (minVis < 0.35) {
    return {
      centerX: 0.5,
      centerY: 0.5,
      width: 0.3,
      height: 0.4,
      rotationRad: 0,
      yawRad: 0,
      confidence: minVis,
      valid: false,
    };
  }

  // Mirror X once if presentation preview is mirrored (never double-mirror)
  const mapX = (x: number) => (calibration.mirrored ? 1 - x : x);

  const lsX = mapX(ls.x);
  const rsX = mapX(rs.x);
  const lhX = mapX(lh.x);
  const rhX = mapX(rh.x);

  const shoulderMidX = (lsX + rsX) / 2;
  const shoulderMidY = (ls.y + rs.y) / 2;
  const hipMidX = (lhX + rhX) / 2;
  const hipMidY = (lh.y + rh.y) / 2;
  const ankleMidY = (la.y + ra.y) / 2;

  const shoulderSpan = Math.hypot(lsX - rsX, ls.y - rs.y);
  const hipSpan = Math.hypot(lhX - rhX, lh.y - rh.y);
  const torsoLength = Math.max(0.08, Math.hypot(hipMidX - shoulderMidX, hipMidY - shoulderMidY));
  const fullLegLength = Math.max(0.12, ankleMidY - hipMidY);

  // Shoulder roll tilt angle (clamped so tracking noise never flips garment upside-down)
  const dx = rsX - lsX;
  const dy = rs.y - ls.y;
  let rotationRad = Math.atan2(dy, dx);
  // Normalize rotation around 0 for upright front-facing pose
  if (rotationRad > Math.PI / 2) rotationRad -= Math.PI;
  if (rotationRad < -Math.PI / 2) rotationRad += Math.PI;
  rotationRad = clamp(rotationRad, -0.45, 0.45);

  // Approximate torso yaw from shoulder-to-hip ratio & asymmetry
  const rawAsym = (lsX - shoulderMidX) + (rsX - shoulderMidX);
  const yawRad = clamp(rawAsym * 1.4, -0.5, 0.5);

  let baseCenterX = (shoulderMidX + hipMidX) / 2;
  let baseCenterY = shoulderMidY + torsoLength * 0.48;
  let baseWidth = Math.max(shoulderSpan * 1.48, hipSpan * 1.65) * calibration.shoulderSpread;
  let baseHeight = torsoLength * 1.34;

  if (fitRegion === 'lower') {
    baseCenterX = hipMidX;
    baseCenterY = hipMidY + fullLegLength * 0.46;
    baseWidth = Math.max(hipSpan * 1.65, shoulderSpan * 0.95) * calibration.shoulderSpread;
    baseHeight = fullLegLength * 0.98;
  } else if (fitRegion === 'full') {
    baseCenterX = (shoulderMidX * 0.45 + hipMidX * 0.55);
    baseCenterY = shoulderMidY + (torsoLength + fullLegLength * 0.65) * 0.5;
    baseWidth = Math.max(shoulderSpan * 1.48, hipSpan * 1.75) * calibration.shoulderSpread;
    baseHeight = torsoLength + fullLegLength * 0.72;
  }

  return {
    centerX: clamp(baseCenterX + calibration.horizontalOffset, 0.05, 0.95),
    centerY: clamp(baseCenterY + calibration.verticalOffset, 0.05, 0.95),
    width: clamp(baseWidth * calibration.scaleOffset, 0.08, 0.92),
    height: clamp(baseHeight * calibration.scaleOffset, 0.1, 0.94),
    rotationRad,
    yawRad,
    confidence: minVis,
    valid: true,
  };
}

/**
 * Exponentially smooths pose fit frames and gracefully retains last valid frame
 * briefly on transient tracking drops.
 */
export function smoothFitFrame(
  prev: TorsoFitFrame | null,
  next: TorsoFitFrame,
  alpha: number,
  missedFrames: number,
  maxHoldFrames = 8
): { frame: TorsoFitFrame; missedFrames: number } {
  if (!next.valid) {
    if (prev && prev.valid && missedFrames < maxHoldFrames) {
      return { frame: prev, missedFrames: missedFrames + 1 };
    }
    return { frame: next, missedFrames: missedFrames + 1 };
  }

  if (!prev || !prev.valid) {
    return { frame: next, missedFrames: 0 };
  }

  const t = clamp(alpha, 0.05, 0.95);
  return {
    missedFrames: 0,
    frame: {
      centerX: lerp(prev.centerX, next.centerX, t),
      centerY: lerp(prev.centerY, next.centerY, t),
      width: lerp(prev.width, next.width, t),
      height: lerp(prev.height, next.height, t),
      rotationRad: lerp(prev.rotationRad, next.rotationRad, t),
      yawRad: lerp(prev.yawRad, next.yawRad, t),
      confidence: next.confidence,
      valid: true,
    },
  };
}

/**
 * Converts a normalized [0..1] point into canvas pixel coordinates matching CSS object-cover.
 */
export function normalizedToCoverPixels(
  pt: Point2D,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  mirrored = false
): { x: number; y: number } {
  const safeSrcW = Math.max(1, sourceWidth);
  const safeSrcH = Math.max(1, sourceHeight);
  const scale = Math.max(targetWidth / safeSrcW, targetHeight / safeSrcH);
  const drawnW = safeSrcW * scale;
  const drawnH = safeSrcH * scale;
  const offsetX = (targetWidth - drawnW) / 2;
  const offsetY = (targetHeight - drawnH) / 2;

  const normX = mirrored ? 1 - pt.x : pt.x;
  return {
    x: offsetX + normX * drawnW,
    y: offsetY + pt.y * drawnH,
  };
}

/**
 * Deterministic garment size recommendation from body parameters & fit preference.
 */
export function recommendSize(category: CategoryId, params: BodyParameters): GarmentSize {
  if (category === 'sarees') {
    return 'Free Size';
  }

  const easeBias =
    params.fitPreference === 'Relaxed' ? 4 : params.fitPreference === 'Slim' ? -3 : 0;

  const metric =
    category === 'bottoms'
      ? (params.waistCm + params.hipsCm * 0.35) / 1.35 + easeBias * 0.6
      : params.chestCm + easeBias;

  if (category === 'bottoms') {
    if (metric < 72) return 'XS';
    if (metric < 78) return 'S';
    if (metric < 85) return 'M';
    if (metric < 92) return 'L';
    if (metric < 100) return 'XL';
    return 'XXL';
  }

  if (metric < 86) return 'XS';
  if (metric < 92) return 'S';
  if (metric < 99) return 'M';
  if (metric < 106) return 'L';
  if (metric < 114) return 'XL';
  return 'XXL';
}

/**
 * Computes subtle garment drape scale multipliers from user's body parameters
 * relative to standard studio mannequin proportions (94cm chest, 76cm waist, 173cm height).
 */
export function computeParameterScale(
  fitRegion: GarmentProduct['fitRegion'],
  params: BodyParameters
): { widthScale: number; heightScale: number } {
  const fitEase =
    params.fitPreference === 'Relaxed' ? 1.05 : params.fitPreference === 'Slim' ? 0.96 : 1.0;

  const chestRatio = clamp(params.chestCm / 94, 0.84, 1.24);
  const hipRatio = clamp(params.hipsCm / 96, 0.84, 1.24);
  const heightRatio = clamp(params.heightCm / 173, 0.88, 1.15);

  if (fitRegion === 'lower') {
    return {
      widthScale: clamp(hipRatio * fitEase, 0.85, 1.25),
      heightScale: heightRatio,
    };
  }

  if (fitRegion === 'full') {
    return {
      widthScale: clamp(((chestRatio + hipRatio) / 2) * fitEase, 0.86, 1.24),
      heightScale: heightRatio,
    };
  }

  return {
    widthScale: clamp(chestRatio * fitEase, 0.85, 1.25),
    heightScale: clamp(0.95 + (heightRatio - 1) * 0.6, 0.88, 1.12),
  };
}

/**
 * Validates customer uploaded image files before client/server processing.
 */
export function validateUploadFile(file: { type: string; size: number }): {
  valid: boolean;
  error?: string;
} {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return {
      valid: false,
      error: 'Please upload a JPEG, PNG, or WebP photograph.',
    };
  }
  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: 'Photo exceeds the 10 MB limit. Please choose a smaller image.',
    };
  }
  if (file.size < 1024) {
    return {
      valid: false,
      error: 'Uploaded file appears empty or corrupted.',
    };
  }
  return { valid: true };
}

/**
 * Generates an animated synthetic standing pose stream for Calibration Test Pose mode
 * when no physical webcam is attached or in automated verification.
 */
export function generateCalibrationTestPose(timeSec: number): NormalizedPoseAnchors {
  const swayX = Math.sin(timeSec * 0.9) * 0.028;
  const breatheY = Math.sin(timeSec * 1.7) * 0.006;
  const tilt = Math.sin(timeSec * 0.65) * 0.01;

  return {
    nose: { x: 0.5 + swayX, y: 0.16 + breatheY, visibility: 0.99 },
    leftShoulder: { x: 0.405 + swayX, y: 0.255 + breatheY + tilt, visibility: 0.98 },
    rightShoulder: { x: 0.595 + swayX, y: 0.255 + breatheY - tilt, visibility: 0.98 },
    leftElbow: { x: 0.365 + swayX, y: 0.405 + breatheY, visibility: 0.95 },
    rightElbow: { x: 0.635 + swayX, y: 0.405 + breatheY, visibility: 0.95 },
    leftWrist: { x: 0.35 + swayX, y: 0.535 + breatheY, visibility: 0.92 },
    rightWrist: { x: 0.65 + swayX, y: 0.535 + breatheY, visibility: 0.92 },
    leftHip: { x: 0.43 + swayX, y: 0.515 + breatheY, visibility: 0.97 },
    rightHip: { x: 0.57 + swayX, y: 0.515 + breatheY, visibility: 0.97 },
    leftKnee: { x: 0.435 + swayX, y: 0.715, visibility: 0.94 },
    rightKnee: { x: 0.565 + swayX, y: 0.715, visibility: 0.94 },
    leftAnkle: { x: 0.44 + swayX, y: 0.905, visibility: 0.92 },
    rightAnkle: { x: 0.56 + swayX, y: 0.905, visibility: 0.92 },
  };
}
