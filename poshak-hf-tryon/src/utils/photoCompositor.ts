import type { BodyParameters, GarmentProduct, NormalizedPoseAnchors } from '../types/poshak';
import { clamp, computeParameterScale, lerp } from './tryonMath';

interface MatteBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

const imageCache = new Map<string, HTMLImageElement>();
const boundsCache = new Map<string, MatteBounds>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const existing = imageCache.get(src);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function getMatteBounds(img: HTMLImageElement, cacheKey: string): MatteBounds {
  const cached = boundsCache.get(cacheKey);
  if (cached) return cached;

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d');
  if (!ctx) {
    return { minX: 0, maxX: w, minY: 0, maxY: h, width: w, height: h };
  }
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);

  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;

  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const alpha = data[(y * w + x) * 4 + 3];
      if (alpha > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    const fallback = { minX: 0, maxX: w, minY: 0, maxY: h, width: w, height: h };
    boundsCache.set(cacheKey, fallback);
    return fallback;
  }

  const bounds: MatteBounds = {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
  boundsCache.set(cacheKey, bounds);
  return bounds;
}

export interface PhotoCompositeOptions {
  personSrc: string;
  garment: GarmentProduct;
  anchors: NormalizedPoseAnchors;
  bodyParams: BodyParameters;
  adjustment?: {
    scale: number;
    xOffset: number;
    yOffset: number;
  };
}

/**
 * Composites a pre-matted garment onto a person or White Dummy studio image
 * using multi-strip torso/waist/hip contour warping and soft ambient shadow blending.
 */
export async function compositeGarmentOnPhoto(
  canvas: HTMLCanvasElement,
  options: PhotoCompositeOptions
): Promise<void> {
  const { personSrc, garment, anchors, bodyParams, adjustment } = options;
  const [personImg, garmentImg] = await Promise.all([
    loadImage(personSrc),
    loadImage(garment.matteUrl),
  ]);

  const targetW = 768;
  const targetH = 1024;
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, targetW, targetH);

  // Draw person/dummy image centered with aspect-cover math
  const srcRatio = personImg.naturalWidth / Math.max(1, personImg.naturalHeight);
  const dstRatio = targetW / targetH;
  let drawW = targetW;
  let drawH = targetH;
  let drawX = 0;
  let drawY = 0;

  if (srcRatio > dstRatio) {
    drawH = targetH;
    drawW = targetH * srcRatio;
    drawX = (targetW - drawW) / 2;
  } else {
    drawW = targetW;
    drawH = targetW / srcRatio;
    drawY = (targetH - drawH) / 2;
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(personImg, drawX, drawY, drawW, drawH);

  const mapPt = (pt: { x: number; y: number }) => ({
    x: drawX + pt.x * drawW,
    y: drawY + pt.y * drawH,
  });

  const ls = mapPt(anchors.leftShoulder);
  const rs = mapPt(anchors.rightShoulder);
  const lh = mapPt(anchors.leftHip);
  const rh = mapPt(anchors.rightHip);
  const lk = mapPt(anchors.leftKnee);
  const rk = mapPt(anchors.rightKnee);
  const la = mapPt(anchors.leftAnkle);
  const ra = mapPt(anchors.rightAnkle);

  const shMidX = (ls.x + rs.x) / 2;
  const shMidY = (ls.y + rs.y) / 2;
  const hipMidX = (lh.x + rh.x) / 2;
  const hipMidY = (lh.y + rh.y) / 2;
  const kneeMidY = (lk.y + rk.y) / 2;
  const ankleMidY = (la.y + ra.y) / 2;

  const shoulderWidth = Math.hypot(rs.x - ls.x, rs.y - ls.y);
  const hipWidth = Math.hypot(rh.x - lh.x, rh.y - lh.y);
  const torsoHeight = Math.max(80, hipMidY - shMidY);

  const paramScale = computeParameterScale(garment.fitRegion, bodyParams);
  const adjScale = adjustment?.scale ?? 1;
  const adjX = (adjustment?.xOffset ?? 0) * targetW;
  const adjY = (adjustment?.yOffset ?? 0) * targetH;

  const bounds = getMatteBounds(garmentImg, garment.matteUrl);
  const garmentAspect = bounds.width / bounds.height;

  // Determine top anchor, bottom anchor, and top/bottom widths by category
  let topY = shMidY - torsoHeight * 0.2;
  let bottomY = hipMidY + torsoHeight * 0.18;
  let topWidth = shoulderWidth * 1.88;
  let bottomWidth = Math.max(shoulderWidth * 1.72, hipWidth * 1.75);
  let topCenterX = shMidX;
  let bottomCenterX = hipMidX;

  if (garment.category === 't-shirts') {
    topY = shMidY - torsoHeight * 0.14;
    bottomY = hipMidY + torsoHeight * 0.12;
    topWidth = shoulderWidth * 1.76;
    bottomWidth = shoulderWidth * 1.56;
  } else if (garment.category === 'jackets') {
    topY = shMidY - torsoHeight * 0.21;
    bottomY = hipMidY + torsoHeight * 0.22;
    topWidth = shoulderWidth * 1.94;
    bottomWidth = shoulderWidth * 1.76;
  } else if (garment.category === 'bottoms') {
    topY = hipMidY - torsoHeight * 0.15;
    bottomY = ankleMidY + 20;
    topWidth = hipWidth * 1.62;
    bottomWidth = hipWidth * 1.74;
    topCenterX = hipMidX;
    bottomCenterX = (la.x + ra.x) / 2;
  } else if (garment.category === 'kurtas') {
    topY = shMidY - torsoHeight * 0.21;
    bottomY = lerp(hipMidY, kneeMidY, 0.78);
    topWidth = shoulderWidth * 1.92;
    bottomWidth = Math.max(hipWidth * 1.88, shoulderWidth * 1.78);
  } else if (garment.category === 'sarees') {
    topY = shMidY - torsoHeight * 0.19;
    bottomY = ankleMidY + 18;
    topWidth = shoulderWidth * 1.58;
    bottomWidth = Math.max(hipWidth * 2.25, (bottomY - topY) * garmentAspect * 0.96);
    topCenterX = shMidX + shoulderWidth * 0.04;
    bottomCenterX = hipMidX;
  }

  const totalH = (bottomY - topY) * paramScale.heightScale * adjScale;
  const centerY = (topY + bottomY) / 2 + adjY;
  const finalTopY = centerY - totalH / 2;
  const finalBottomY = centerY + totalH / 2;

  const finalTopW = topWidth * paramScale.widthScale * adjScale;
  const finalBottomW = bottomWidth * paramScale.widthScale * adjScale;

  // Shoulder slope angle
  let tiltAngle = Math.atan2(rs.y - ls.y, rs.x - ls.x);
  if (tiltAngle > Math.PI / 2) tiltAngle -= Math.PI;
  if (tiltAngle < -Math.PI / 2) tiltAngle += Math.PI;
  tiltAngle = clamp(tiltAngle, -0.25, 0.25);

  const strips = 24;
  ctx.save();
  ctx.translate(topCenterX + adjX, finalTopY);
  ctx.rotate(tiltAngle);
  ctx.translate(-(topCenterX + adjX), -finalTopY);

  // Subtle ambient contact shadow cast onto body/mannequin
  ctx.shadowColor = 'rgba(20, 18, 16, 0.18)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 5;

  for (let i = 0; i < strips; i++) {
    const t0 = i / strips;
    const t1 = (i + 1) / strips;
    // Slight 0.6px overlap prevents hairline gaps between strips
    const sy = bounds.minY + t0 * bounds.height;
    const sh = Math.max(1, (t1 - t0) * bounds.height);

    const w0 = lerp(finalTopW, finalBottomW, Math.pow(t0, 0.92));
    const cx0 = lerp(topCenterX, bottomCenterX, t0) + adjX;
    const dy0 = lerp(finalTopY, finalBottomY, t0);
    const dy1 = lerp(finalTopY, finalBottomY, t1);
    const dh = Math.max(1, dy1 - dy0 + 0.8);

    ctx.drawImage(
      garmentImg,
      bounds.minX,
      sy,
      bounds.width,
      sh,
      cx0 - w0 / 2,
      dy0,
      w0,
      dh
    );
  }

  ctx.restore();
}
