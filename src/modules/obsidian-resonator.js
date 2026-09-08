/** A damped wave equation in two GPU storage buffers, rendered as black metal. */
import { createGPUStage, gpuOptions, gpuShader } from '../lib/webgpu-stage.js';
import { gpuCamera } from '../lib/webgpu-camera.js';
import { scale } from '../lib/device.js';

export const defaults = { drive: 0.65, damping: 0.985, frequency: 1.1, speed: 1 };
const limits = { drive: [0, 1.5], damping: [0.96, 0.998], frequency: [0.3, 2.5], speed: [0, 2] };
const layout = /* wgsl */ `
struct Settings { matrix: mat4x4f, field: vec4f, source: vec4f, eye: vec4f }
@group(0) @binding(0) var<uniform> settings: Settings;
@group(0) @binding(1) var<storage, read> current: array<vec2f>;
fn sampleHeight(x: i32, y: i32) -> f32 {
  let n = i32(settings.field.x);
  return current[u32(clamp(y, 0, n - 1) * n + clamp(x, 0, n - 1))].x;
}
`;

export const computeShader = layout + /* wgsl */ `
@group(0) @binding(2) var<storage, read_write> next: array<vec2f>;
@compute @workgroup_size(16, 16)
fn compute(@builtin(global_invocation_id) id: vec3u) {
  let n = u32(settings.field.x);
  if (id.x >= n || id.y >= n) { return; }
  let index = id.y * n + id.x;
  let p = vec2f(id.xy) / f32(n - 1u) * 2.0 - 1.0;
  let radius = length(p);
  if (radius >= 0.89) { next[index] = vec2f(0.0); return; }
  let state = current[index];
  let x = i32(id.x); let y = i32(id.y);
  let laplacian = sampleHeight(x - 1, y) + sampleHeight(x + 1, y)
    + sampleHeight(x, y - 1) + sampleHeight(x, y + 1) - 4.0 * state.x;
  let delta = p - settings.source.xy;
  let drive = exp(-dot(delta, delta) * 230.0) * sin(settings.field.w * settings.source.w * 6.2831853) * settings.field.z * 0.0035;
  // Fixed 120 Hz steps, c²dt²/dx² = 0.22 < 0.5 (the 2D CFL bound).
  let absorb = 1.0 - smoothstep(0.75, 0.89, radius) * 0.3;
  let velocity = (state.y + laplacian * 0.22 + drive) * settings.field.y * absorb;
  next[index] = vec2f(clamp(state.x + velocity, -0.22, 0.22), velocity);
}
`;

export const renderShader = layout + /* wgsl */ `
struct Vertex { @builtin(position) position: vec4f, @location(0) world: vec3f, @location(1) normal: vec3f }
@vertex
fn vertex(@builtin(vertex_index) id: u32) -> Vertex {
  let n = u32(settings.field.x);
  let cell = id / 6u;
  var corners = array<vec2u, 6>(vec2u(0,0), vec2u(0,1), vec2u(1,0), vec2u(1,0), vec2u(0,1), vec2u(1,1));
  let grid = vec2u(cell % (n - 1u), cell / (n - 1u)) + corners[id % 6u];
  let p = vec2f(grid) / f32(n - 1u) * 2.0 - 1.0;
  let x = i32(grid.x); let y = i32(grid.y);
  let rim = smoothstep(0.885, 0.905, length(p));
  let height = mix(sampleHeight(x, y) * 1.5, 0.022, rim);
  let dx = (sampleHeight(x + 1, y) - sampleHeight(x - 1, y)) * f32(n - 1u) * 0.25 * 1.5;
  let dz = (sampleHeight(x, y + 1) - sampleHeight(x, y - 1)) * f32(n - 1u) * 0.25 * 1.5;
  var out: Vertex;
  out.world = vec3f(p.x * 1.65, height, p.y * 1.65);
  out.normal = normalize(mix(vec3f(-dx / 1.65, 1.0, -dz / 1.65), vec3f(0,1,0), rim));
  out.position = settings.matrix * vec4f(out.world, 1.0);
  return out;
}
@fragment
fn fragment(in: Vertex) -> @location(0) vec4f {
  let radius = length(in.world.xz) / 1.65;
  if (radius > 1.0) { discard; }
  let n = normalize(in.normal);
  let view = normalize(settings.eye.xyz - in.world);
  let reflected = reflect(-view, n);
  let key = normalize(vec3f(-0.4, 0.8, 0.35));
  let specular = pow(max(dot(reflect(-key, n), view), 0.0), 100.0);
  let coolBox = pow(max(dot(reflected, normalize(vec3f(0.6, 0.8, -0.15))), 0.0), 22.0);
  let warmBox = pow(max(dot(reflected, normalize(vec3f(-0.6, 0.6, 0.5))), 0.0), 38.0);
  let fresnel = pow(1.0 - max(dot(n, view), 0.0), 5.0);
  let rim = smoothstep(0.893, 0.91, radius);
  var color = mix(vec3f(0.018, 0.032, 0.047), vec3f(0.23, 0.13, 0.055), rim);
  color += vec3f(0.35, 0.64, 0.87) * (coolBox * 1.7 + fresnel * 0.18);
  color += vec3f(1.0, 0.7, 0.34) * warmBox * 1.6 + vec3f(specular * 2.0);
  let angle = atan2(in.world.z, in.world.x);
  let ticks = pow(max(cos(angle * 120.0), 0.0), 24.0) * smoothstep(0.94, 0.947, radius) * (1.0 - smoothstep(0.966, 0.97, radius));
  let trim = exp(-pow((radius - 0.914) * 700.0, 2.0)) + exp(-pow((radius - 0.989) * 700.0, 2.0));
  color += vec3f(0.7, 0.49, 0.25) * (ticks * 0.7 + trim * 0.6);
  return vec4f(pow(color / (color + vec3f(1.0)), vec3f(0.454545)), 1.0);
}
`;

export function seedWaveGrid(resolution) {
  const data = new Float32Array(resolution * resolution * 2);
  for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    const px = x / (resolution - 1) * 2 - 1, py = y / (resolution - 1) * 2 - 1;
    const radius = Math.hypot(px, py);
    data[(y * resolution + x) * 2] = radius < 0.75 ? Math.cos(radius * 34) * Math.exp(-radius * radius * 14) * 0.018 : 0;
  }
  return data;
}

export default function create(canvas, options = {}) {
  const params = gpuOptions(defaults, options, limits);
  const resolution = scale(128, 192);
  let clock = 0, accumulator = 0;
  const stage = createGPUStage(canvas, {
    async setup(gpu) {
      const { device, format } = gpu;
      const initial = seedWaveGrid(resolution);
      const buffers = [0, 1].map(() => {
        const buffer = gpu.own(device.createBuffer({ size: initial.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }));
        device.queue.writeBuffer(buffer, 0, initial);
        return buffer;
      });
      const settings = gpu.own(device.createBuffer({ size: 112, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
      const compute = await device.createComputePipelineAsync({ layout: 'auto', compute: { module: await gpuShader(device, computeShader, 'Resonator compute'), entryPoint: 'compute' } });
      const shader = await gpuShader(device, renderShader, 'Resonator render');
      const render = await device.createRenderPipelineAsync({
        layout: 'auto', vertex: { module: shader, entryPoint: 'vertex' },
        fragment: { module: shader, entryPoint: 'fragment', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
      });
      const computeGroups = buffers.map((buffer, index) => device.createBindGroup({ layout: compute.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: settings } }, { binding: 1, resource: { buffer } }, { binding: 2, resource: { buffer: buffers[1 - index] } },
      ] }));
      const renderGroups = buffers.map(buffer => device.createBindGroup({ layout: render.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: settings } }, { binding: 1, resource: { buffer } },
      ] }));
      let index = 0, depth = null, depthWidth = 0, depthHeight = 0;
      const values = new Float32Array(28);
      return {
        frame({ width, height, aspect, dt, pointer }) {
          clock += dt * params.speed;
          accumulator += dt * params.speed;
          const camera = gpuCamera(aspect, 0.16 + pointer.x * 0.24, 0.8 + pointer.y * 0.12, 4.6);
          values.set(camera.matrix);
          values.set([resolution, params.damping, params.drive, clock], 16);
          values.set([pointer.x * 0.6, -pointer.y * 0.6, pointer.active ? 1 : 0, params.frequency], 20);
          values.set([...camera.eye, 0], 24);
          device.queue.writeBuffer(settings, 0, values);
          if (width !== depthWidth || height !== depthHeight) {
            depth?.destroy();
            depth = gpu.own(device.createTexture({ size: [width, height], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT }));
            depthWidth = width; depthHeight = height;
          }
          const encoder = device.createCommandEncoder();
          // Separate passes establish read-after-write ordering between buffers.
          let steps = 0;
          while (accumulator >= 1 / 120 && steps < 8) {
            const pass = encoder.beginComputePass();
            pass.setPipeline(compute);
            pass.setBindGroup(0, computeGroups[index]);
            pass.dispatchWorkgroups(Math.ceil(resolution / 16), Math.ceil(resolution / 16));
            pass.end();
            index = 1 - index;
            accumulator -= 1 / 120;
            steps++;
          }
          const pass = encoder.beginRenderPass({
            colorAttachments: [{ view: gpu.context.getCurrentTexture().createView(), clearValue: { r: 0.014, g: 0.019, b: 0.025, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
            depthStencilAttachment: { view: depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
          });
          pass.setPipeline(render);
          pass.setBindGroup(0, renderGroups[index]);
          pass.draw((resolution - 1) * (resolution - 1) * 6);
          pass.end();
          device.queue.submit([encoder.finish()]);
        },
      };
    },
    fallback(surface) {
      const context = surface.getContext('2d');
      return {
        frame({ width, height, dt, pointer }) {
          clock += dt * params.speed;
          context.fillStyle = '#05080c'; context.fillRect(0, 0, width, height);
          const radius = Math.min(width * 0.4, height * 0.53);
          context.save(); context.translate(width / 2, height / 2); context.scale(1, 0.66);
          context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2);
          context.fillStyle = '#111b25'; context.fill();
          context.strokeStyle = '#b59b68'; context.lineWidth = 2; context.stroke();
          context.clip();
          for (let i = 1; i < 42; i++) {
            const r = radius * i / 44;
            const wave = Math.sin(i * 0.7 - clock * params.frequency * 5) * params.drive;
            context.beginPath(); context.ellipse(pointer.x * radius * 0.3, -pointer.y * radius * 0.3 + wave * 3, r, r, 0, 0, Math.PI * 2);
            context.strokeStyle = `rgba(124,163,179,${0.08 + Math.max(0, wave) * 0.5})`;
            context.lineWidth = 1; context.stroke();
          }
          context.restore();
        },
      };
    },
  });
  stage.setParam = (key, value) => {
    if (!Object.hasOwn(limits, key) || !Number.isFinite(value)) return;
    params[key] = Math.max(limits[key][0], Math.min(limits[key][1], value));
    if (stage.reducedMotion || !stage.state.running) stage.renderOnce();
  };
  return stage.start();
}
