/** Native WGSL compute -> persistent particle buffer -> instanced light ribbons. */
import { createGPUStage, gpuOptions, gpuShader } from '../lib/webgpu-stage.js';
import { gpuCamera } from '../lib/webgpu-camera.js';
import { createRandom } from '../lib/random.js';

export const defaults = { count: 65536, speed: 0.7, twist: 1, size: 1.8 };
const limits = { count: [8192, 131072], speed: [0, 2], twist: [0.3, 1.8], size: [0.7, 3.5] };
const layout = /* wgsl */ `
struct Particle { position: vec4f, velocity: vec4f }
struct Settings { matrix: mat4x4f, timing: vec4f, viewport: vec4f, pointer: vec4f }
@group(0) @binding(0) var<uniform> settings: Settings;
`;

export const computeShader = layout + /* wgsl */ `
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;
@compute @workgroup_size(128)
fn compute(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= arrayLength(&particles)) { return; }
  var particle = particles[index];
  let t = particle.position.w * 6.2831853 + settings.timing.x * 0.13;
  let seed = particle.velocity.w;
  let braid = t * 3.0;
  let radius = 1.0 + cos(braid) * 0.35 * settings.timing.z;
  let strand = seed * 6.2831853 + t * 17.0;
  let thickness = 0.025 + 0.11 * seed;
  let target = vec3f(radius * cos(t * 2.0), sin(braid) * 0.52 * settings.timing.z, radius * sin(t * 2.0))
    + vec3f(cos(strand), sin(strand), cos(strand * 1.7)) * thickness;
  let away = particle.position.xyz - vec3f(settings.pointer.xy, 0.3);
  let repulsion = away / max(dot(away, away), 0.18) * settings.pointer.z * 0.45;
  let dt = settings.timing.y * settings.timing.w;
  let force = (target - particle.position.xyz) * 7.0 - particle.velocity.xyz * 3.2 + repulsion;
  let velocity = particle.velocity.xyz + force * dt;
  particles[index].velocity = vec4f(velocity, seed);
  particles[index].position = vec4f(particle.position.xyz + velocity * dt, particle.position.w);
}
`;

export const renderShader = layout + /* wgsl */ `
@group(0) @binding(1) var<storage, read> particles: array<Particle>;
struct Vertex { @builtin(position) position: vec4f, @location(0) uv: vec2f, @location(1) color: vec3f }
@vertex
fn vertex(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instance: u32) -> Vertex {
  var corners = array<vec2f, 6>(vec2f(-1,-1), vec2f(1,-1), vec2f(-1,1), vec2f(-1,1), vec2f(1,-1), vec2f(1,1));
  let p = particles[instance];
  let corner = corners[vertexIndex];
  var clip = settings.matrix * vec4f(p.position.xyz, 1.0);
  clip = vec4f(clip.xy + corner * settings.viewport.z * 2.0 / settings.viewport.xy * clip.w, clip.zw);
  let warmth = smoothstep(-0.55, 0.6, p.position.y + (p.velocity.w - 0.5) * 0.7);
  let color = mix(vec3f(0.09, 0.3, 0.38), vec3f(0.9, 0.62, 0.26), warmth);
  var out: Vertex;
  out.position = clip;
  out.uv = corner;
  out.color = color * (0.7 + p.velocity.w * 0.6);
  return out;
}
@fragment
fn fragment(in: Vertex) -> @location(0) vec4f {
  let radius = dot(in.uv, in.uv);
  if (radius > 1.0) { discard; }
  let glow = exp(-radius * 3.8);
  return vec4f(in.color, glow * 0.35);
}
`;

export function seedParticles(count, twist = 1) {
  const random = createRandom(71);
  const data = new Float32Array(count * 8);
  for (let i = 0; i < count; i++) {
    const phase = i / count, t = phase * Math.PI * 2, seed = random();
    const radius = 1 + Math.cos(t * 3) * 0.35 * twist;
    const strand = seed * Math.PI * 2 + t * 17, thickness = 0.025 + 0.11 * seed;
    data.set([
      radius * Math.cos(t * 2) + Math.cos(strand) * thickness,
      Math.sin(t * 3) * 0.52 * twist + Math.sin(strand) * thickness,
      radius * Math.sin(t * 2) + Math.cos(strand * 1.7) * thickness,
      phase, 0, 0, 0, seed,
    ], i * 8);
  }
  return data;
}

export default function create(canvas, options = {}) {
  const params = gpuOptions(defaults, options, limits);
  params.count = Math.round(params.count / 128) * 128;
  let clock = 0;
  let reshapeStill = false;
  const stage = createGPUStage(canvas, {
    async setup(gpu) {
      const { device, format } = gpu;
      const data = seedParticles(params.count, params.twist);
      const particles = gpu.own(device.createBuffer({ label: 'Aether particle state', size: data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }));
      device.queue.writeBuffer(particles, 0, data);
      const settings = gpu.own(device.createBuffer({ size: 112, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
      const compute = await device.createComputePipelineAsync({ layout: 'auto', compute: { module: await gpuShader(device, computeShader, 'Aether compute'), entryPoint: 'compute' } });
      const shader = await gpuShader(device, renderShader, 'Aether render');
      const render = await device.createRenderPipelineAsync({
        layout: 'auto', vertex: { module: shader, entryPoint: 'vertex' },
        fragment: { module: shader, entryPoint: 'fragment', targets: [{ format, blend: {
          color: { operation: 'add', srcFactor: 'src-alpha', dstFactor: 'one' },
          alpha: { operation: 'add', srcFactor: 'zero', dstFactor: 'one' },
        } }] }, primitive: { topology: 'triangle-list' },
      });
      const entries = [{ binding: 0, resource: { buffer: settings } }, { binding: 1, resource: { buffer: particles } }];
      const computeGroup = device.createBindGroup({ layout: compute.getBindGroupLayout(0), entries });
      const renderGroup = device.createBindGroup({ layout: render.getBindGroupLayout(0), entries });
      const values = new Float32Array(28);
      return {
        frame({ width, height, aspect, pixelRatio, dt, pointer }) {
          if (reshapeStill) {
            device.queue.writeBuffer(particles, 0, seedParticles(params.count, params.twist));
            reshapeStill = false;
          }
          clock += dt * params.speed;
          values.set(gpuCamera(aspect, 0.3 + pointer.x * 0.5, 0.35 + pointer.y * 0.3, 4.5).matrix);
          values.set([clock, dt, params.twist, params.speed], 16);
          values.set([width, height, params.size * pixelRatio, params.count], 20);
          values.set([pointer.x * 1.6, pointer.y * 1.6, pointer.active ? 1 : 0, 0], 24);
          device.queue.writeBuffer(settings, 0, values);
          const encoder = device.createCommandEncoder();
          if (dt > 0) {
            const pass = encoder.beginComputePass();
            pass.setPipeline(compute);
            pass.setBindGroup(0, computeGroup);
            pass.dispatchWorkgroups(Math.ceil(params.count / 128));
            pass.end();
          }
          const pass = encoder.beginRenderPass({ colorAttachments: [{
            view: gpu.context.getCurrentTexture().createView(), clearValue: { r: 0.012, g: 0.019, b: 0.027, a: 1 }, loadOp: 'clear', storeOp: 'store',
          }] });
          pass.setPipeline(render);
          pass.setBindGroup(0, renderGroup);
          pass.draw(6, params.count);
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
          context.fillStyle = '#04070b';
          context.fillRect(0, 0, width, height);
          const size = Math.min(width, height) * 0.29;
          context.globalCompositeOperation = 'lighter';
          for (let strand = 0; strand < 16; strand++) {
            context.beginPath();
            for (let i = 0; i <= 220; i++) {
              const t = i / 220 * Math.PI * 2 + clock * 0.13;
              const r = 1 + Math.cos(t * 3) * 0.35 * params.twist + strand * 0.006;
              const x = r * Math.cos(t * 2 + pointer.x * 0.3);
              const y = Math.sin(t * 3) * 0.5 * params.twist + r * Math.sin(t * 2) * 0.38;
              const px = width / 2 + x * size, py = height / 2 - y * size;
              if (!i) context.moveTo(px, py); else context.lineTo(px, py);
            }
            context.strokeStyle = strand % 3 ? '#aa8e5140' : '#447e8f60';
            context.lineWidth = params.size * 0.45;
            context.stroke();
          }
          context.globalCompositeOperation = 'source-over';
        },
      };
    },
  });
  stage.setParam = (key, value) => {
    if (!Object.hasOwn(limits, key) || !Number.isFinite(value) || key === 'count') return;
    params[key] = Math.max(limits[key][0], Math.min(limits[key][1], value));
    if (key === 'twist' && (stage.reducedMotion || !stage.state.running)) reshapeStill = true;
    if (stage.reducedMotion || !stage.state.running) stage.renderOnce();
  };
  return stage.start();
}
