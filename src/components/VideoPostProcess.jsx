import { Mesh, Program, Renderer, Texture, Triangle } from 'ogl';
import { useEffect } from 'react';

const DEFAULT_SETTINGS = {
  brightness: 80,
  mask: 0,
  saturation: 80,
  contrast: 96,
  blur: 0,
  vignette: 100,
  noise: 8,
  pixel: 31,
  colorDepth: 40,
  dither: 10,
  edge: 20,
  crt: 38,
  glow: 24,
  chroma: 4
};

const vertex = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
precision highp float;

uniform sampler2D tMap;
uniform vec2 uResolution;
uniform vec2 uVideoResolution;
uniform float uTime;
uniform float uBrightness;
uniform float uSaturation;
uniform float uContrast;
uniform float uBlur;
uniform float uPixelation;
uniform float uColorDepth;
uniform float uDither;
uniform float uEdge;
uniform float uCrt;
uniform float uGlow;
uniform float uChroma;
uniform float uNoise;
uniform float uVignette;
uniform float uMask;
uniform float uPassthrough;
varying vec2 vUv;

vec2 coverUv(vec2 uv) {
  vec2 ratio = uResolution / uVideoResolution;
  float scale = max(ratio.x, ratio.y);
  vec2 scaled = uVideoResolution * scale;
  vec2 offset = (scaled - uResolution) / (2.0 * scaled);
  return uv * uResolution / scaled + offset;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float index = q.x + q.y * 4.0;
  if (index < 0.5) return 0.0;
  if (index < 1.5) return 8.0;
  if (index < 2.5) return 2.0;
  if (index < 3.5) return 10.0;
  if (index < 4.5) return 12.0;
  if (index < 5.5) return 4.0;
  if (index < 6.5) return 14.0;
  if (index < 7.5) return 6.0;
  if (index < 8.5) return 3.0;
  if (index < 9.5) return 11.0;
  if (index < 10.5) return 1.0;
  if (index < 11.5) return 9.0;
  if (index < 12.5) return 15.0;
  if (index < 13.5) return 7.0;
  if (index < 14.5) return 13.0;
  return 5.0;
}

vec3 retroPalette(float index) {
  if (index < 0.5) return vec3(0.025, 0.045, 0.12);
  if (index < 1.5) return vec3(0.12, 0.19, 0.48);
  if (index < 2.5) return vec3(0.15, 0.45, 0.75);
  if (index < 3.5) return vec3(0.18, 0.72, 0.78);
  if (index < 4.5) return vec3(0.32, 0.76, 0.24);
  if (index < 5.5) return vec3(0.95, 0.78, 0.18);
  if (index < 6.5) return vec3(0.88, 0.2, 0.14);
  return vec3(0.96, 0.94, 0.82);
}

vec3 nearestPalette(vec3 color) {
  float bestDistance = 100.0;
  vec3 best = color;
  for (int i = 0; i < 8; i++) {
    vec3 candidate = retroPalette(float(i));
    float distanceToCandidate = distance(color, candidate);
    if (distanceToCandidate < bestDistance) {
      bestDistance = distanceToCandidate;
      best = candidate;
    }
  }
  return best;
}

void main() {
  vec2 sourceUv = coverUv(vUv);
  if (uPassthrough > 0.5) {
    gl_FragColor = texture2D(tMap, sourceUv);
    return;
  }
  float pixelGrid = mix(900.0, 96.0, uPixelation);
  vec2 pixelUv = mix(sourceUv, (floor(sourceUv * pixelGrid) + 0.5) / pixelGrid, step(0.001, uPixelation));
  vec2 chromaOffset = vec2(uChroma * 0.00045, 0.0);
  vec2 blurTexel = 1.0 / uVideoResolution;
  vec3 color;
  color.r = texture2D(tMap, pixelUv + chromaOffset).r;
  color.g = texture2D(tMap, pixelUv).g;
  color.b = texture2D(tMap, pixelUv - chromaOffset).b;
  vec3 softColor = (texture2D(tMap, pixelUv + blurTexel).rgb + texture2D(tMap, pixelUv - blurTexel).rgb + texture2D(tMap, pixelUv + blurTexel.yx).rgb + texture2D(tMap, pixelUv - blurTexel.yx).rgb) * 0.25;
  color = mix(color, softColor, uBlur * 0.35);

  color = mix(vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), color, uSaturation);
  color = (color - 0.5) * uContrast + 0.5;
  color *= uBrightness;

  float dither = (bayer4(gl_FragCoord.xy) / 16.0 - 0.5) * uDither * 0.42;
  float levels = max(2.0, uColorDepth);
  vec3 quantized = floor((color + dither) * levels + 0.5) / levels;
  vec3 paletteColor = nearestPalette(quantized);
  float paletteMix = smoothstep(42.0, 6.0, uColorDepth) * 0.18;
  color = mix(quantized, paletteColor, paletteMix);

  vec2 texel = blurTexel;
  float centerLuma = dot(texture2D(tMap, pixelUv).rgb, vec3(0.2126, 0.7152, 0.0722));
  float edgeLuma = abs(centerLuma - dot(texture2D(tMap, pixelUv + vec2(texel.x, 0.0)).rgb, vec3(0.2126, 0.7152, 0.0722)));
  edgeLuma += abs(centerLuma - dot(texture2D(tMap, pixelUv + vec2(0.0, texel.y)).rgb, vec3(0.2126, 0.7152, 0.0722)));
  color += vec3(0.35, 0.58, 0.72) * smoothstep(0.08, 0.42, edgeLuma) * uEdge * 0.004;

  float scan = sin(vUv.y * uResolution.y * 1.15) * 0.5 + 0.5;
  float aperture = mod(gl_FragCoord.x, 3.0);
  vec3 grille = aperture < 1.0 ? vec3(1.0, 0.94, 0.94) : (aperture < 2.0 ? vec3(0.94, 1.0, 0.94) : vec3(0.94, 0.94, 1.0));
  color *= mix(vec3(1.0), vec3(0.78 + scan * 0.22), uCrt * 0.012);
  color *= mix(vec3(1.0), grille, uCrt * 0.035);
  color += color * uGlow * 0.025;
  color += (hash(gl_FragCoord.xy + uTime * 23.0) - 0.5) * uNoise * 0.012;

  float retroPresence = max(uPixelation, uCrt * 0.01);
  float edge = distance(vUv, vec2(0.5)) * 1.4142;
  color *= 1.0 - smoothstep(0.58, 0.88, edge) * uVignette * 0.9 * retroPresence;
  // The readability mask is scoped to the Hero in CSS; never darken the global video here.
  color *= 1.0;
  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
`;

function normalizedSettings(settings = {}) {
  return { ...DEFAULT_SETTINGS, ...settings };
}

function isZeroEffects(settings) {
  return settings.brightness === 100
    && settings.saturation === 100
    && settings.contrast === 100
    && settings.mask === 0
    && settings.blur === 0
    && settings.vignette === 0
    && settings.noise === 0
    && settings.pixel === 0
    && settings.dither === 0
    && settings.edge === 0
    && settings.crt === 0
    && settings.glow === 0
    && settings.chroma === 0;
}

export default function VideoPostProcess() {
  useEffect(() => {
    const video = document.getElementById('hero-video');
    const container = document.getElementById('video-bg');
    if (!video || !container || !window.WebGLRenderingContext) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const renderer = new Renderer({ alpha: false, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, 1.5) });
    const gl = renderer.gl;
    const canvas = gl.canvas;
    canvas.id = 'video-webgl';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.opacity = '0';
    canvas.style.transition = 'opacity .3s ease';
    container.appendChild(canvas);

    const texture = new Texture(gl, { image: video, generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    const geometry = new Triangle(gl);
    const settings = normalizedSettings(window.__videoTuning);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        tMap: { value: texture },
        uResolution: { value: [1, 1] },
        uVideoResolution: { value: [video.videoWidth || 16, video.videoHeight || 9] },
        uTime: { value: 0 },
        uBrightness: { value: settings.brightness / 100 },
        uSaturation: { value: settings.saturation / 100 },
        uContrast: { value: settings.contrast / 100 },
        uBlur: { value: settings.blur / 100 },
        uPixelation: { value: settings.pixel / 100 },
        uColorDepth: { value: settings.colorDepth },
        uDither: { value: settings.dither / 100 },
        uEdge: { value: settings.edge },
        uCrt: { value: settings.crt },
        uGlow: { value: settings.glow },
        uChroma: { value: settings.chroma },
        uNoise: { value: settings.noise },
        uVignette: { value: settings.vignette / 100 },
        uMask: { value: settings.mask / 100 },
        uPassthrough: { value: isZeroEffects(settings) ? 1 : 0 }
      }
    });
    const mesh = new Mesh(gl, { geometry, program });

    const applySettings = (nextSettings) => {
      const next = normalizedSettings(nextSettings);
      window.__videoTuning = next;
      program.uniforms.uBrightness.value = next.brightness / 100;
      program.uniforms.uSaturation.value = next.saturation / 100;
      program.uniforms.uContrast.value = next.contrast / 100;
      program.uniforms.uBlur.value = next.blur / 100;
      program.uniforms.uPixelation.value = next.pixel / 100;
      program.uniforms.uColorDepth.value = next.colorDepth;
      program.uniforms.uDither.value = next.dither / 100;
      program.uniforms.uEdge.value = next.edge;
      program.uniforms.uCrt.value = next.crt;
      program.uniforms.uGlow.value = next.glow;
      program.uniforms.uChroma.value = next.chroma;
      program.uniforms.uNoise.value = next.noise;
      program.uniforms.uVignette.value = next.vignette / 100;
      program.uniforms.uMask.value = next.mask / 100;
      program.uniforms.uPassthrough.value = isZeroEffects(next) ? 1 : 0;
    };

    const onTuningChange = (event) => applySettings(event.detail || {});
    const onResize = () => {
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;
      renderer.setSize(width, height);
      program.uniforms.uResolution.value = [width, height];
      program.uniforms.uVideoResolution.value = [video.videoWidth || width, video.videoHeight || height];
    };
    const onVideoMetadata = () => {
      program.uniforms.uVideoResolution.value = [video.videoWidth || 16, video.videoHeight || 9];
      onResize();
    };
    const revealWebgl = () => {
      if (video.readyState < 2) return;
      canvas.style.opacity = '1';
      container.classList.add('is-webgl-ready');
    };
    let frame = 0;
    let lastRenderAt = 0;
    const renderInterval = window.innerWidth <= 760 ? 1000 / 30 : 1000 / 60;
    const render = (time) => {
      if (document.hidden) {
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(render);
      if (time - lastRenderAt < renderInterval) return;
      lastRenderAt = time;
      if (video.readyState >= 2) texture.needsUpdate = true;
      program.uniforms.uTime.value = time * 0.001;
      renderer.render({ scene: mesh });
    };
    const onVisibilityChange = () => {
      if (!document.hidden && !frame) frame = requestAnimationFrame(render);
    };

    applySettings(settings);
    onResize();
    window.addEventListener('video-tuning-change', onTuningChange);
    video.addEventListener('loadedmetadata', onVideoMetadata);
    video.addEventListener('loadeddata', revealWebgl, { once: true });
    video.addEventListener('canplay', revealWebgl, { once: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    frame = requestAnimationFrame(render);
    revealWebgl();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('video-tuning-change', onTuningChange);
      video.removeEventListener('loadedmetadata', onVideoMetadata);
      window.removeEventListener('resize', onResize);
      video.removeEventListener('loadeddata', revealWebgl);
      video.removeEventListener('canplay', revealWebgl);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      container.classList.remove('is-webgl-ready');
      canvas.remove();
      renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return null;
}
