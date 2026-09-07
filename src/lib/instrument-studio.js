/** Small studio lighting rig for the instrument modules. No external assets. */
import * as THREE from 'three';

export function lightInstrument(stage, { warmth = '#ead7b4', rim = 0x8aaac8 } = {}) {
  // Narrow softboxes give polished metal a readable edge, even against black.
  // This is a reflection map, never a background image.
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#141920';
  context.fillRect(0, 0, 512, 256);
  const boxes = [
    [65, 32, 46, 152, warmth],
    [228, 12, 110, 25, '#f6f3eb'],
    [393, 52, 18, 160, '#a4b9d2'],
    [15, 215, 350, 12, '#596572'],
  ];
  for (const [x, y, width, height, color] of boxes) {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  }
  const environment = new THREE.CanvasTexture(canvas);
  environment.mapping = THREE.EquirectangularReflectionMapping;
  environment.colorSpace = THREE.SRGBColorSpace;
  stage.scene.environment = environment;
  stage.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  stage.renderer.toneMappingExposure = 1.12;

  const key = new THREE.DirectionalLight(0xffeed9, 3.1);
  key.position.set(-3, 5, 5);
  const edge = new THREE.DirectionalLight(rim, 3.6);
  edge.position.set(4, 2, -3);
  stage.scene.add(key, edge, new THREE.HemisphereLight(0xcbd9ed, 0x201914, 0.7));
  // The stage traverses mesh-owned textures; scene.environment lives outside it.
  stage.onDispose(() => environment.dispose());
}

/** Keep the whole instrument in frame, including on tall, narrow canvases. */
export function frameInstrument(stage, radius, direction = [0, 0.3, 1], target = [0, 0, 0]) {
  const view = new THREE.Vector3(...direction).normalize();
  const centre = new THREE.Vector3(...target);
  function fit({ aspect }) {
    const vertical = THREE.MathUtils.degToRad(stage.camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * aspect);
    const distance = radius / Math.sin(Math.min(vertical, horizontal));
    stage.camera.position.copy(view).multiplyScalar(distance).add(centre);
    stage.camera.lookAt(centre);
    stage.camera.updateProjectionMatrix();
  }
  stage.onResize(fit);
  fit(stage.size);
}

/** A live control must also repaint when reduced motion has stopped the loop. */
export function instrumentParams(stage, params, limits, onChange = () => {}) {
  return (key, value) => {
    if (!Object.hasOwn(limits, key) || !Number.isFinite(value)) return;
    const [min, max] = limits[key];
    params[key] = THREE.MathUtils.clamp(value, min, max);
    onChange(key, params[key]);
    if (stage.reducedMotion || !stage.state.running) stage.renderOnce();
  };
}

export function instrumentOptions(defaults, options, limits) {
  const params = { ...defaults };
  for (const [key, [min, max]] of Object.entries(limits)) {
    if (Number.isFinite(options[key])) params[key] = THREE.MathUtils.clamp(options[key], min, max);
  }
  return params;
}
