import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { GarmentProduct, TorsoFitFrame } from '../types/poshak';

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export interface Garment3DController {
  setGarment: (garment: GarmentProduct) => void;
  updateFit: (
    frame: TorsoFitFrame,
    viewportWidth: number,
    viewportHeight: number,
    elapsedSec: number
  ) => void;
  resize: (width: number, height: number) => void;
  renderNow: () => void;
  dispose: () => void;
  isSoftwareGl: boolean;
}

interface CroppedGarmentTexture {
  texture: THREE.CanvasTexture;
  aspect: number;
}

/**
 * Loads a pre-matted PNG and crops it tightly around opaque pixels so 3D UV space
 * covers 100% of the garment silhouette without transparent border slack.
 */
function loadCroppedMatteTexture(url: string): Promise<CroppedGarmentTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const probe = document.createElement('canvas');
      probe.width = w;
      probe.height = h;
      const pCtx = probe.getContext('2d');
      if (!pCtx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      pCtx.drawImage(img, 0, 0);
      const { data } = pCtx.getImageData(0, 0, w, h);

      let minX = w;
      let maxX = 0;
      let minY = h;
      let maxY = 0;
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          if (data[(y * w + x) * 4 + 3] > 24) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX <= minX || maxY <= minY) {
        minX = 0;
        minY = 0;
        maxX = w;
        maxY = h;
      }

      const cropW = Math.max(1, maxX - minX + 1);
      const cropH = Math.max(1, maxY - minY + 1);

      const out = document.createElement('canvas');
      const maxDim = 768;
      const scale = Math.min(1, maxDim / Math.max(cropW, cropH));
      out.width = Math.max(1, Math.round(cropW * scale));
      out.height = Math.max(1, Math.round(cropH * scale));

      const oCtx = out.getContext('2d');
      if (!oCtx) {
        reject(new Error('Output canvas unavailable'));
        return;
      }
      oCtx.drawImage(img, minX, minY, cropW, cropH, 0, 0, out.width, out.height);

      const tex = new THREE.CanvasTexture(out);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;

      resolve({ texture: tex, aspect: cropW / cropH });
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * Creates a pose-driven 3D contoured cloth shell rendered with Three.js MeshPhysicalMaterial
 * and RoomEnvironment studio lighting, avoiding blocky primitive artifacts.
 */
export function createGarment3DController(container: HTMLElement): Garment3DController {
  const isSoftwareGl = detectSoftwareWebGL();
  const width = Math.max(320, container.clientWidth || 640);
  const height = Math.max(240, container.clientHeight || 480);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.pointerEvents = 'none';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 0, 5);

  const hemiLight = new THREE.HemisphereLight(0xf8f9ff, 0xe4ddd0, 1.45);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff6ea, 1.55);
  keyLight.position.set(2.0, 2.8, 3.6);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xdce6f5, 0.72);
  rimLight.position.set(-2.4, 1.4, -1.8);
  scene.add(rimLight);

  const garmentGroup = new THREE.Group();
  garmentGroup.visible = false;
  scene.add(garmentGroup);

  // Sculpted 20x28 cloth grid with anatomical torso curvature & subtle breathing displacement
  const segX = 20;
  const segY = 28;
  const clothGeo = new THREE.PlaneGeometry(1, 1, segX, segY);
  const basePositions = new Float32Array(clothGeo.attributes.position.array);

  const applyClothShape = (elapsedSec: number) => {
    const pos = clothGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const bx = basePositions[i * 3]; // [-0.5 .. 0.5]
      const by = basePositions[i * 3 + 1]; // [-0.5 .. 0.5]
      // Cylindrical wrap across chest & slight shoulder-to-hem taper
      const chestCurve = Math.cos(bx * Math.PI * 0.92) * 0.16;
      const chestBulge = Math.max(0, 0.5 - Math.abs(by - 0.12)) * 0.06;
      const hemRipple =
        Math.sin(bx * 8.5 + elapsedSec * 2.2) *
        Math.max(0, 0.15 - by) *
        0.025;
      pos.setXYZ(i, bx, by, chestCurve + chestBulge + hemRipple);
    }
    pos.needsUpdate = true;
    clothGeo.computeVertexNormals();
  };
  applyClothShape(0);

  const fabricMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0.02,
    sheen: 0.4,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(0xf6f0e6),
    transparent: true,
    alphaTest: 0.12,
    side: THREE.DoubleSide,
  });

  const clothMesh = new THREE.Mesh(clothGeo, fabricMaterial);
  clothMesh.renderOrder = 2;
  garmentGroup.add(clothMesh);

  const textureCache = new Map<string, CroppedGarmentTexture>();
  let currentProduct: GarmentProduct | null = null;
  let textureReady = false;
  let activeAspect = 0.72;
  let disposed = false;

  // Software-WebGL on-demand render coalescing
  let renderBusy = false;
  let renderDirty = false;
  let pendingSyncId = 0;
  let lastFrame: TorsoFitFrame | null = null;

  function scheduleDraw() {
    if (disposed) return;
    if (!isSoftwareGl) {
      renderer.render(scene, camera);
      return;
    }
    if (renderBusy) {
      renderDirty = true;
      return;
    }
    renderBusy = true;
    renderer.render(scene, camera);

    const gl = renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    gl.flush();

    const finish = () => {
      renderBusy = false;
      if (renderDirty && !disposed) {
        renderDirty = false;
        scheduleDraw();
      }
    };

    if (!sync) {
      pendingSyncId = window.setTimeout(finish, 60);
      return;
    }

    const poll = () => {
      if (disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        pendingSyncId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        pendingSyncId = window.setTimeout(finish, 40);
      }
    };
    pendingSyncId = window.setTimeout(poll, 5);
  }

  function applyGarmentTexture(garment: GarmentProduct) {
    currentProduct = garment;
    fabricMaterial.roughness = garment.category === 'jackets' ? 0.56 : 0.78;
    fabricMaterial.sheen = garment.category === 'sarees' || garment.category === 'kurtas' ? 0.55 : 0.3;

    const cached = textureCache.get(garment.matteUrl);
    if (cached) {
      fabricMaterial.map = cached.texture;
      fabricMaterial.needsUpdate = true;
      activeAspect = cached.aspect;
      textureReady = true;
      if (lastFrame?.valid) {
        garmentGroup.visible = true;
      }
      scheduleDraw();
      return;
    }

    // Keep mesh hidden until cropped texture is loaded so no white rectangle ever flashes
    textureReady = false;
    garmentGroup.visible = false;

    void loadCroppedMatteTexture(garment.matteUrl)
      .then((entry) => {
        if (disposed) {
          entry.texture.dispose();
          return;
        }
        entry.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        textureCache.set(garment.matteUrl, entry);
        if (currentProduct?.id === garment.id) {
          fabricMaterial.map = entry.texture;
          fabricMaterial.needsUpdate = true;
          activeAspect = entry.aspect;
          textureReady = true;
          if (lastFrame?.valid) {
            garmentGroup.visible = true;
          }
          scheduleDraw();
        }
      })
      .catch(() => {
        // Leave hidden cleanly if texture fails
      });
  }

  function updateFit(
    frame: TorsoFitFrame,
    _viewportWidth: number,
    _viewportHeight: number,
    elapsedSec: number
  ) {
    lastFrame = frame;
    if (!frame.valid || !textureReady) {
      garmentGroup.visible = false;
      scheduleDraw();
      return;
    }

    garmentGroup.visible = true;
    applyClothShape(elapsedSec);

    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const frustumH = 2 * Math.tan(vFovRad / 2) * camera.position.z;
    const frustumW = frustumH * camera.aspect;

    const worldX = (frame.centerX - 0.5) * frustumW;
    const worldY = (0.5 - frame.centerY) * frustumH;
    const targetH = frame.height * frustumH * 1.04;
    const aspectW = targetH * activeAspect;
    const worldW = Math.max(frame.width * frustumW * 1.05, aspectW * 0.96);

    garmentGroup.position.set(worldX, worldY, 0);
    garmentGroup.scale.set(worldW, targetH, worldW * 0.65);
    garmentGroup.rotation.set(0.02, frame.yawRad, -frame.rotationRad);

    scheduleDraw();
  }

  function resize(newW: number, newH: number) {
    const safeW = Math.max(240, newW);
    const safeH = Math.max(180, newH);
    camera.aspect = safeW / safeH;
    camera.updateProjectionMatrix();
    renderer.setSize(safeW, safeH);
    scheduleDraw();
  }

  function renderNow() {
    renderer.render(scene, camera);
  }

  function dispose() {
    disposed = true;
    window.clearTimeout(pendingSyncId);
    clothGeo.dispose();
    fabricMaterial.dispose();
    textureCache.forEach((entry) => entry.texture.dispose());
    textureCache.clear();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  }

  return {
    setGarment: applyGarmentTexture,
    updateFit,
    resize,
    renderNow,
    dispose,
    isSoftwareGl,
  };
}
