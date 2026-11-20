import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Crosshair,
  FlipHorizontal,
  Grid3X3,
  RefreshCw,
  Scan,
  Sparkles,
} from 'lucide-react';
import { getPoseLandmarker, landmarksToAnchors } from '../services/poseService';
import type {
  BodyParameters,
  CalibrationSettings,
  GarmentProduct,
  NormalizedPoseAnchors,
  TorsoFitFrame,
} from '../types/poshak';
import { createGarment3DController, type Garment3DController } from '../utils/garment3d';
import {
  DEFAULT_CALIBRATION,
  computeParameterScale,
  computeTorsoFitFrame,
  generateCalibrationTestPose,
  smoothFitFrame,
} from '../utils/tryonMath';

interface LiveCameraStageProps {
  garment: GarmentProduct;
  bodyParams: BodyParameters;
  quickScale?: number;
  quickVertical?: number;
  onCaptureLook: (previewDataUrl: string) => void;
}

export const LiveCameraStage: React.FC<LiveCameraStageProps> = ({
  garment,
  bodyParams,
  quickScale = 1,
  quickVertical = 0,
  onCaptureLook,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const threeMountRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const garment3dRef = useRef<Garment3DController | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number>(0);
  const timerIdRef = useRef<number>(0);

  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'live' | 'test-pose' | 'error'>(
    'test-pose'
  );
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [trackingStatus, setTrackingStatus] = useState<string>('Calibration Test Pose Active');
  const [calibration, setCalibration] = useState<CalibrationSettings>(DEFAULT_CALIBRATION);
  const [captureFlash, setCaptureFlash] = useState(false);

  // Refs so animation loop reads latest props without re-mounting WebGLRenderer
  const garmentRef = useRef(garment);
  garmentRef.current = garment;
  const calibrationRef = useRef(calibration);
  calibrationRef.current = calibration;
  const bodyParamsRef = useRef(bodyParams);
  bodyParamsRef.current = bodyParams;
  const cameraStateRef = useRef(cameraState);
  cameraStateRef.current = cameraState;
  const quickScaleRef = useRef(quickScale);
  quickScaleRef.current = quickScale;
  const quickVerticalRef = useRef(quickVertical);
  quickVerticalRef.current = quickVertical;

  const smoothedFrameRef = useRef<TorsoFitFrame | null>(null);
  const missedFramesRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const latestAnchorsRef = useRef<NormalizedPoseAnchors | null>(null);
  const inferenceBusyRef = useRef(false);

  // Mount Three.js WebGLRenderer once
  useEffect(() => {
    const mountEl = threeMountRef.current;
    if (!mountEl) return;

    const controller = createGarment3DController(mountEl);
    garment3dRef.current = controller;
    controller.setGarment(garmentRef.current);

    const onResize = () => {
      if (!stageRef.current || !garment3dRef.current) return;
      garment3dRef.current.resize(stageRef.current.clientWidth, stageRef.current.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      controller.dispose();
      garment3dRef.current = null;
    };
  }, []);

  // Update 3D garment texture smoothly without restarting camera/detector
  useEffect(() => {
    garment3dRef.current?.setGarment(garment);
  }, [garment]);

  const stopCameraTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startLiveCamera = useCallback(async () => {
    setErrorMessage('');
    setCameraState('starting');
    setTrackingStatus('Requesting camera access...');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('error');
      setErrorMessage(
        'Camera capture is unavailable in this browser context. Use Calibration Test Pose or Upload Photo instead.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('live');
      setTrackingStatus('Initializing on-device pose tracker...');
      // Warm up MediaPipe Pose Landmarker in background
      void getPoseLandmarker('VIDEO').then((detector) => {
        if (cameraStateRef.current === 'live') {
          setTrackingStatus(
            detector
              ? 'Live Pose Tracking Ready (On-Device)'
              : 'Camera Live · Calibration Anchor Active'
          );
        }
      });
    } catch (err) {
      stopCameraTracks();
      setCameraState('error');
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow access in browser settings or switch to Calibration Test Pose.'
          : 'No active camera device detected. You can calibrate using Test Pose or switch to Upload Photo.';
      setErrorMessage(msg);
      setTrackingStatus('Camera unavailable');
    }
  }, [stopCameraTracks]);

  const switchToTestPose = useCallback(() => {
    stopCameraTracks();
    setErrorMessage('');
    setCameraState('test-pose');
    setTrackingStatus('Calibration Test Pose Active');
  }, [stopCameraTracks]);

  const stopAll = useCallback(() => {
    stopCameraTracks();
    setCameraState('idle');
    setTrackingStatus('Camera stopped');
  }, [stopCameraTracks]);

  // Clean up tracks on unmount
  useEffect(() => {
    return () => {
      stopCameraTracks();
    };
  }, [stopCameraTracks]);

  // Render overlay calibration grid, silhouette, landmarks, and drive Three.js 3D fit
  useEffect(() => {
    let active = true;
    const startTime = performance.now();

    const draw2DOverlay = (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      anchors: NormalizedPoseAnchors | null,
      cal: CalibrationSettings,
      mode: typeof cameraState
    ) => {
      ctx.clearRect(0, 0, w, h);

      // In Test Pose mode, draw a clean luxury studio silhouette figure so calibration is visually verifiable
      if (mode === 'test-pose' && anchors) {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#F5F4F0');
        bgGrad.addColorStop(1, '#EAE6DD');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        const mapX = (x: number) => (cal.mirrored ? 1 - x : x) * w;
        const mapY = (y: number) => y * h;

        // Subtle studio floor horizon line
        ctx.strokeStyle = 'rgba(23, 23, 23, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.91);
        ctx.lineTo(w, h * 0.91);
        ctx.stroke();

        // Sculpted neutral atelier form
        const nx = mapX(anchors.nose.x);
        const ny = mapY(anchors.nose.y);
        const lsx = mapX(anchors.leftShoulder.x);
        const lsy = mapY(anchors.leftShoulder.y);
        const rsx = mapX(anchors.rightShoulder.x);
        const rsy = mapY(anchors.rightShoulder.y);
        const lhx = mapX(anchors.leftHip.x);
        const lhy = mapY(anchors.leftHip.y);
        const rhx = mapX(anchors.rightHip.x);
        const rhy = mapY(anchors.rightHip.y);
        const lax = mapX(anchors.leftAnkle.x);
        const lay = mapY(anchors.leftAnkle.y);
        const rax = mapX(anchors.rightAnkle.x);
        const ray = mapY(anchors.rightAnkle.y);
        const lwx = mapX(anchors.leftWrist.x);
        const lwy = mapY(anchors.leftWrist.y);
        const rwx = mapX(anchors.rightWrist.x);
        const rwy = mapY(anchors.rightWrist.y);

        ctx.fillStyle = '#DEDAD1';
        ctx.strokeStyle = '#C7C1B5';
        ctx.lineWidth = 2;

        // Head
        ctx.beginPath();
        ctx.ellipse(nx, ny, w * 0.042, h * 0.055, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Neck + Torso + Legs silhouette
        ctx.beginPath();
        ctx.moveTo(lsx, lsy);
        ctx.lineTo(rsx, rsy);
        ctx.lineTo(rhx, rhy);
        ctx.lineTo(rax, ray);
        ctx.lineTo(rax - w * 0.032, ray);
        ctx.lineTo((lhx + rhx) / 2, lhy + h * 0.04);
        ctx.lineTo(lax + w * 0.032, lay);
        ctx.lineTo(lax, lay);
        ctx.lineTo(lhx, lhy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Arms
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(10, w * 0.025);
        ctx.strokeStyle = '#DCD7CD';
        ctx.beginPath();
        ctx.moveTo(lsx, lsy);
        ctx.lineTo(mapX(anchors.leftElbow.x), mapY(anchors.leftElbow.y));
        ctx.lineTo(lwx, lwy);
        ctx.moveTo(rsx, rsy);
        ctx.lineTo(mapX(anchors.rightElbow.x), mapY(anchors.rightElbow.y));
        ctx.lineTo(rwx, rwy);
        ctx.stroke();
      }

      // Calibration alignment grid
      if (cal.showCalibrationGrid) {
        ctx.save();
        ctx.strokeStyle =
          mode === 'live' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(23, 23, 23, 0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        // Vertical centerline
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        // Shoulder target guide (26%) & waist guide (51%)
        ctx.moveTo(0, h * 0.26);
        ctx.lineTo(w, h * 0.26);
        ctx.moveTo(0, h * 0.51);
        ctx.lineTo(w, h * 0.51);
        ctx.stroke();
        ctx.restore();
      }

      // Pose calibration landmarks
      if (cal.showLandmarks && anchors) {
        const mapX = (x: number) => (cal.mirrored ? 1 - x : x) * w;
        const mapY = (y: number) => y * h;
        const keyPoints = [
          anchors.leftShoulder,
          anchors.rightShoulder,
          anchors.leftHip,
          anchors.rightHip,
          anchors.leftElbow,
          anchors.rightElbow,
        ];

        ctx.save();
        ctx.strokeStyle = 'rgba(154, 123, 79, 0.72)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mapX(anchors.leftShoulder.x), mapY(anchors.leftShoulder.y));
        ctx.lineTo(mapX(anchors.rightShoulder.x), mapY(anchors.rightShoulder.y));
        ctx.lineTo(mapX(anchors.rightHip.x), mapY(anchors.rightHip.y));
        ctx.lineTo(mapX(anchors.leftHip.x), mapY(anchors.leftHip.y));
        ctx.closePath();
        ctx.stroke();

        for (const pt of keyPoints) {
          const px = mapX(pt.x);
          const py = mapY(pt.y);
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#9A7B4F';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    const step = async () => {
      if (!active) return;
      const now = performance.now();
      const elapsedSec = (now - startTime) / 1000;
      const mode = cameraStateRef.current;
      const cal = calibrationRef.current;
      const prod = garmentRef.current;
      const params = bodyParamsRef.current;

      let anchors: NormalizedPoseAnchors | null = latestAnchorsRef.current;

      if (mode === 'test-pose') {
        anchors = generateCalibrationTestPose(elapsedSec);
        latestAnchorsRef.current = anchors;
      } else if (mode === 'live' && videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current;
        if (video.currentTime !== lastVideoTimeRef.current && !inferenceBusyRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          inferenceBusyRef.current = true;
          try {
            const detector = await getPoseLandmarker('VIDEO');
            if (detector && active) {
              const res = detector.detectForVideo(video, now);
              const detected = landmarksToAnchors(res.landmarks?.[0]);
              if (detected) {
                anchors = detected;
                latestAnchorsRef.current = detected;
              }
            } else {
              anchors = generateCalibrationTestPose(0);
              latestAnchorsRef.current = anchors;
            }
          } catch {
            // Keep last valid anchor on transient inference failure
          } finally {
            inferenceBusyRef.current = false;
          }
        }
      } else if (mode === 'idle' || mode === 'error') {
        anchors = null;
      }

      // Compute smoothed garment fit frame adjusted by user parameters
      const paramScale = computeParameterScale(prod.fitRegion, params);
      const effectiveCal: CalibrationSettings = {
        ...cal,
        scaleOffset:
          cal.scaleOffset *
          quickScaleRef.current *
          ((paramScale.widthScale + paramScale.heightScale) / 2),
        verticalOffset: cal.verticalOffset + quickVerticalRef.current,
      };
      const rawFrame = computeTorsoFitFrame(anchors, prod.fitRegion, effectiveCal);
      const smoothed = smoothFitFrame(
        smoothedFrameRef.current,
        rawFrame,
        cal.smoothingAlpha,
        missedFramesRef.current
      );
      smoothedFrameRef.current = smoothed.frame;
      missedFramesRef.current = smoothed.missedFrames;

      const stageEl = stageRef.current;
      const overlay = overlayCanvasRef.current;
      if (stageEl && overlay) {
        const w = stageEl.clientWidth || 640;
        const h = stageEl.clientHeight || 480;
        if (overlay.width !== w) overlay.width = w;
        if (overlay.height !== h) overlay.height = h;
        const ctx = overlay.getContext('2d');
        if (ctx) {
          draw2DOverlay(ctx, w, h, anchors, cal, mode);
        }
        garment3dRef.current?.updateFit(smoothed.frame, w, h, elapsedSec);
      }

      const isSw = garment3dRef.current?.isSoftwareGl ?? true;
      if (isSw) {
        timerIdRef.current = window.setTimeout(() => {
          if (active) rafIdRef.current = requestAnimationFrame(() => void step());
        }, 90);
      } else {
        rafIdRef.current = requestAnimationFrame(() => void step());
      }
    };

    rafIdRef.current = requestAnimationFrame(() => void step());

    return () => {
      active = false;
      cancelAnimationFrame(rafIdRef.current);
      window.clearTimeout(timerIdRef.current);
    };
  }, []);

  const handleCaptureSnapshot = () => {
    const stageEl = stageRef.current;
    const overlay = overlayCanvasRef.current;
    const threeCanvas = threeMountRef.current?.querySelector('canvas');
    if (!stageEl || !overlay) return;

    garment3dRef.current?.renderNow();

    const out = document.createElement('canvas');
    out.width = overlay.width || 640;
    out.height = overlay.height || 480;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    if (cameraState === 'live' && videoRef.current && videoRef.current.readyState >= 2) {
      ctx.save();
      if (calibration.mirrored) {
        ctx.translate(out.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(videoRef.current, 0, 0, out.width, out.height);
      ctx.restore();
    } else {
      ctx.drawImage(overlay, 0, 0, out.width, out.height);
    }

    if (threeCanvas) {
      ctx.drawImage(threeCanvas, 0, 0, out.width, out.height);
    }

    setCaptureFlash(true);
    window.setTimeout(() => setCaptureFlash(false), 300);
    onCaptureLook(out.toDataURL('image/png'));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E1D8] bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {cameraState !== 'live' ? (
            <button
              type="button"
              onClick={startLiveCamera}
              className="inline-flex items-center gap-2 rounded-lg bg-[#171717] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#2C2C2C] cursor-pointer"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Start Live Camera</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopAll}
              className="inline-flex items-center gap-2 rounded-lg border border-[#171717] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F3F1EC] cursor-pointer"
            >
              <CameraOff className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Stop Camera</span>
            </button>
          )}

          <button
            type="button"
            onClick={switchToTestPose}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
              cameraState === 'test-pose'
                ? 'border-[#171717] bg-[#F3F1EC] text-[#171717]'
                : 'border-[#DDD8CE] bg-white text-[#57544E] hover:border-[#171717]'
            }`}
          >
            <Scan className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
            <span>Calibration Test Pose</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#625F59]">{trackingStatus}</span>
          <button
            type="button"
            onClick={handleCaptureSnapshot}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4CFC4] bg-[#FAF9F6] px-3 py-2 text-xs font-medium text-[#171717] hover:border-[#171717] cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
            <span>Capture Look</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Stage */}
      <div
        ref={stageRef}
        data-testid="live-camera-stage"
        className="relative mx-auto aspect-[3/4] w-full max-w-[520px] overflow-hidden rounded-2xl border border-[#E5E1D8] bg-[#F3F1EC]"
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${
            cameraState === 'live' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          } ${calibration.mirrored ? '-scale-x-100' : ''}`}
        />

        <canvas
          ref={overlayCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        {/* Isolated Three.js WebGL Mount */}
        <div
          ref={threeMountRef}
          data-testid="threejs-garment-canvas"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        {captureFlash && (
          <div className="pointer-events-none absolute inset-0 bg-white/70 transition-opacity" />
        )}

        {cameraState === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#FAF9F6]/95 p-8 text-center">
            <CameraOff className="h-8 w-8 text-[#9A7B4F]" aria-hidden="true" />
            <h3 className="font-display mt-3 text-2xl font-semibold text-[#171717]">
              Camera Access Required
            </h3>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#57544E]">{errorMessage}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={startLiveCamera}
                className="rounded-lg bg-[#171717] px-4 py-2 text-xs font-medium text-white hover:bg-[#2C2C2C] cursor-pointer"
              >
                Retry Camera
              </button>
              <button
                type="button"
                onClick={switchToTestPose}
                className="rounded-lg border border-[#D4CFC4] bg-white px-4 py-2 text-xs font-medium text-[#171717] hover:border-[#171717] cursor-pointer"
              >
                Use Calibration Test Pose
              </button>
            </div>
          </div>
        )}

        {cameraState === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#FAF9F6]/95 p-8 text-center">
            <Camera className="h-8 w-8 text-[#9A7B4F]" aria-hidden="true" />
            <p className="font-display mt-3 text-2xl font-semibold text-[#171717]">
              Camera Paused
            </p>
            <p className="mt-1.5 text-xs text-[#625F59]">
              Start your webcam or activate Calibration Test Pose to align the 3D garment.
            </p>
          </div>
        )}
      </div>

      {/* Live Camera Calibration Controls */}
      <div className="rounded-xl border border-[#E5E1D8] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFECE6] pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#171717]">
            <Crosshair className="h-3.5 w-3.5 text-[#9A7B4F]" aria-hidden="true" />
            <span>Camera Calibration & Pose Alignment</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCalibration((c) => ({ ...c, mirrored: !c.mirrored }))}
              aria-pressed={calibration.mirrored}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                calibration.mirrored
                  ? 'border-[#171717] bg-[#171717] text-white'
                  : 'border-[#DDD8CE] bg-white text-[#57544E]'
              }`}
            >
              <FlipHorizontal className="h-3 w-3" aria-hidden="true" />
              <span>Mirror</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setCalibration((c) => ({ ...c, showCalibrationGrid: !c.showCalibrationGrid }))
              }
              aria-pressed={calibration.showCalibrationGrid}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                calibration.showCalibrationGrid
                  ? 'border-[#171717] bg-[#171717] text-white'
                  : 'border-[#DDD8CE] bg-white text-[#57544E]'
              }`}
            >
              <Grid3X3 className="h-3 w-3" aria-hidden="true" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setCalibration((c) => ({ ...c, showLandmarks: !c.showLandmarks }))}
              aria-pressed={calibration.showLandmarks}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                calibration.showLandmarks
                  ? 'border-[#171717] bg-[#171717] text-white'
                  : 'border-[#DDD8CE] bg-white text-[#57544E]'
              }`}
            >
              <span>Landmarks</span>
            </button>
            <button
              type="button"
              onClick={() => setCalibration(DEFAULT_CALIBRATION)}
              className="inline-flex items-center gap-1 rounded-md border border-[#DDD8CE] bg-white px-2.5 py-1 text-[11px] font-medium text-[#57544E] hover:border-[#171717] cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className="flex justify-between text-[11px] text-[#57544E]">
              <label htmlFor="cal-scale">Garment Scale</label>
              <span className="font-mono-num">{calibration.scaleOffset.toFixed(2)}×</span>
            </div>
            <input
              id="cal-scale"
              type="range"
              min={0.75}
              max={1.35}
              step={0.02}
              value={calibration.scaleOffset}
              onChange={(e) =>
                setCalibration((c) => ({ ...c, scaleOffset: Number(e.target.value) }))
              }
              className="mt-1 w-full accent-[#171717] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-[#57544E]">
              <label htmlFor="cal-vertical">Vertical Anchor</label>
              <span className="font-mono-num">{(calibration.verticalOffset * 100).toFixed(0)}%</span>
            </div>
            <input
              id="cal-vertical"
              type="range"
              min={-0.14}
              max={0.14}
              step={0.01}
              value={calibration.verticalOffset}
              onChange={(e) =>
                setCalibration((c) => ({ ...c, verticalOffset: Number(e.target.value) }))
              }
              className="mt-1 w-full accent-[#171717] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-[#57544E]">
              <label htmlFor="cal-shoulder">Shoulder Spread</label>
              <span className="font-mono-num">{calibration.shoulderSpread.toFixed(2)}×</span>
            </div>
            <input
              id="cal-shoulder"
              type="range"
              min={0.85}
              max={1.25}
              step={0.02}
              value={calibration.shoulderSpread}
              onChange={(e) =>
                setCalibration((c) => ({ ...c, shoulderSpread: Number(e.target.value) }))
              }
              className="mt-1 w-full accent-[#171717] cursor-pointer"
            />
          </div>
        </div>

        <p className="mt-3 text-[11px] text-[#78736A]">
          Privacy notice: Live webcam frames are processed strictly on-device and never uploaded.
          3D overlay is illustrative and not a physical size guarantee.
        </p>
      </div>
    </div>
  );
};
