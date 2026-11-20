import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BODY_PARAMS,
  DEFAULT_CALIBRATION,
  computeParameterScale,
  computeTorsoFitFrame,
  generateCalibrationTestPose,
  normalizedToCoverPixels,
  recommendSize,
  smoothFitFrame,
  validateUploadFile,
} from './tryonMath';

test('computeTorsoFitFrame produces valid centered bounds for upright pose', () => {
  const pose = generateCalibrationTestPose(0);
  const frame = computeTorsoFitFrame(pose, 'upper', DEFAULT_CALIBRATION);
  assert.equal(frame.valid, true);
  assert.ok(frame.centerX > 0.4 && frame.centerX < 0.6);
  assert.ok(frame.centerY > 0.3 && frame.centerY < 0.5);
  assert.ok(frame.width > 0.2 && frame.width < 0.5);
  assert.ok(frame.height > 0.2 && frame.height < 0.6);
});

test('computeTorsoFitFrame rejects low-confidence pose landmarks', () => {
  const pose = generateCalibrationTestPose(0);
  pose.leftShoulder.visibility = 0.1;
  const frame = computeTorsoFitFrame(pose, 'upper', DEFAULT_CALIBRATION);
  assert.equal(frame.valid, false);
});

test('computeTorsoFitFrame adapts height for lower and full-body garments', () => {
  const pose = generateCalibrationTestPose(0);
  const upper = computeTorsoFitFrame(pose, 'upper', DEFAULT_CALIBRATION);
  const lower = computeTorsoFitFrame(pose, 'lower', DEFAULT_CALIBRATION);
  const full = computeTorsoFitFrame(pose, 'full', DEFAULT_CALIBRATION);

  assert.ok(lower.centerY > upper.centerY, 'lower garment should anchor lower than upper garment');
  assert.ok(full.height > upper.height, 'full garment (kurta/saree) should span taller than upper garment');
});

test('smoothFitFrame holds previous valid estimate during brief tracking loss', () => {
  const pose = generateCalibrationTestPose(0);
  const validFrame = computeTorsoFitFrame(pose, 'upper', DEFAULT_CALIBRATION);
  const invalidFrame = { ...validFrame, valid: false, confidence: 0.1 };

  const held = smoothFitFrame(validFrame, invalidFrame, 0.35, 0, 5);
  assert.equal(held.frame.valid, true);
  assert.equal(held.missedFrames, 1);

  const dropped = smoothFitFrame(validFrame, invalidFrame, 0.35, 5, 5);
  assert.equal(dropped.frame.valid, false);
});

test('normalizedToCoverPixels maps center consistently across aspect ratios', () => {
  const mapped = normalizedToCoverPixels({ x: 0.5, y: 0.5 }, 640, 480, 900, 900, false);
  assert.equal(Math.round(mapped.x), 450);
  assert.equal(Math.round(mapped.y), 450);
});

test('recommendSize responds to chest measurements and fit preference', () => {
  assert.equal(recommendSize('shirts', { ...DEFAULT_BODY_PARAMS, chestCm: 84 }), 'XS');
  assert.equal(recommendSize('shirts', { ...DEFAULT_BODY_PARAMS, chestCm: 95 }), 'M');
  assert.equal(recommendSize('shirts', { ...DEFAULT_BODY_PARAMS, chestCm: 110 }), 'XL');
  assert.equal(recommendSize('sarees', DEFAULT_BODY_PARAMS), 'Free Size');
});

test('computeParameterScale adjusts width and height proportionally', () => {
  const small = computeParameterScale('upper', { ...DEFAULT_BODY_PARAMS, chestCm: 84, heightCm: 160 });
  const large = computeParameterScale('upper', { ...DEFAULT_BODY_PARAMS, chestCm: 112, heightCm: 185 });
  assert.ok(large.widthScale > small.widthScale);
  assert.ok(large.heightScale > small.heightScale);
});

test('validateUploadFile enforces MIME types and size limits', () => {
  assert.equal(validateUploadFile({ type: 'image/jpeg', size: 250000 }).valid, true);
  assert.equal(validateUploadFile({ type: 'application/pdf', size: 250000 }).valid, false);
  assert.equal(validateUploadFile({ type: 'image/png', size: 15 * 1024 * 1024 }).valid, false);
});
