/** Column-major perspective/view matrix using WebGPU's zero-to-one clip depth. */
export function gpuCamera(aspect, yaw = 0.2, pitch = 0.35, radius = 5.2) {
  const distance = radius / Math.min(1, aspect);
  const z = [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];
  const x = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const y = [-Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), -Math.sin(pitch) * Math.cos(yaw)];
  const eye = z.map(value => value * distance);
  const view = [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, 0, 0, -distance, 1];
  const f = 1 / Math.tan(42 * Math.PI / 360), near = 0.1, far = 100;
  const projection = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, far / (near - far), -1, 0, 0, far * near / (near - far), 0];
  const matrix = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) matrix[column * 4 + row] += projection[k * 4 + row] * view[column * 4 + k];
    }
  }
  return { matrix, eye };
}
