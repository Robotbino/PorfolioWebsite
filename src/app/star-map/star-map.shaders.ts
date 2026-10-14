import { FIELD } from './star-map.math';

/**
 * The star map's three programs, in GLSL ES 1.00 with no `#version` line, so
 * the same source compiles on WebGL 1 (older phones) and WebGL 2. Every
 * fragment writes premultiplied alpha, to match the canvas and the
 * ONE, ONE_MINUS_SRC_ALPHA blend OGL picks for a premultiplied renderer.
 *
 * No uniform is declared in both stages of a program: GLSL ES 1.00 refuses to
 * link a uniform whose precision differs between them, and the vertex stage
 * is highp while the fragment stage is mediump. Values both need travel as
 * varyings instead.
 */

const glFloat = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

/**
 * The background field as points. Positions arrive in screen-relative units
 * (see fieldPoints) and are rebuilt at each star's rest distance, so the field
 * fills any aspect ratio. Fog fades the far stars toward FIELD.fogFloor.
 */
export const FIELD_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute float bright;
uniform mat4 uView;
uniform mat4 uProj;
uniform vec2 uTanHalf;
uniform float uF;
uniform float uDpr;
uniform vec2 uSize;
uniform vec2 uFog;
varying float vA;

void main() {
  float d = uF - position.z;
  vec4 world = vec4(position.x * uTanHalf.x * d, position.y * uTanHalf.y * d, position.z, 1.0);
  gl_Position = uProj * uView * world;
  gl_PointSize = mix(uSize.x, uSize.y, bright) * uDpr;
  vA = bright * mix(${glFloat(FIELD.fogFloor)}, 1.0, 1.0 - smoothstep(uFog.x, uFog.y, d));
}
`;

export const FIELD_FRAGMENT = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
uniform vec2 uAlpha;
uniform float uOpacity;
varying float vA;

void main() {
  float r = length(gl_PointCoord * 2.0 - 1.0);
  float a = (1.0 - smoothstep(0.35, 1.0, r)) * mix(uAlpha.x, uAlpha.y, vA) * uOpacity;
  gl_FragColor = vec4(uColor * a, a);
}
`;

/**
 * Links as screen-space quads between endpoints projected on the CPU. Each
 * quad reaches a pixel past the line's half-width so the edge can be
 * antialiased from coverage; the canvas itself has no MSAA.
 */
export const LINK_VERTEX = /* glsl */ `
precision highp float;
attribute vec2 aA;
attribute vec2 aB;
attribute vec2 aAlpha;
attribute vec2 aSideEnd;
uniform vec2 uResolution;
uniform float uHalfWidth;
varying float vAcross;
varying float vHalfWidth;
varying float vAlpha;

void main() {
  vec2 span = aB - aA;
  float len = length(span);
  vec2 along = len > 0.0001 ? span / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-along.y, along.x);
  vAcross = aSideEnd.x * (uHalfWidth + 1.0);
  vHalfWidth = uHalfWidth;
  vAlpha = mix(aAlpha.x, aAlpha.y, aSideEnd.y);
  vec2 p = mix(aA, aB, aSideEnd.y) + normal * vAcross;
  vec2 ndc = p / uResolution * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}
`;

export const LINK_FRAGMENT = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
uniform float uDpr;
varying float vAcross;
varying float vHalfWidth;
varying float vAlpha;

void main() {
  // One device pixel of ramp centred on the edge, so the line keeps the same
  // ink as an SVG stroke of the same width at any pixel ratio.
  float coverage = clamp((vHalfWidth - abs(vAcross)) * uDpr + 0.5, 0.0, 1.0);
  float a = vAlpha * coverage;
  gl_FragColor = vec4(uColor * a, a);
}
`;

/**
 * Stars as billboard quads around CPU-projected centres: a crisp core over a
 * gaussian halo. The quad reaches far enough for the halo to fall below one
 * 8-bit step.
 */
export const STAR_VERTEX = /* glsl */ `
precision highp float;
attribute vec2 aCorner;
attribute vec2 aCenter;
attribute vec4 aShape;
attribute vec3 aColor;
uniform vec2 uResolution;
varying vec2 vOffset;
varying vec4 vShape;
varying vec3 vColor;

void main() {
  float reach = max(aShape.y * 1.4, aShape.x + 1.5);
  vOffset = aCorner * reach;
  vShape = aShape;
  vColor = aColor;
  vec2 ndc = (aCenter + vOffset) / uResolution * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}
`;

export const STAR_FRAGMENT = /* glsl */ `
precision mediump float;
uniform vec3 uCore;
uniform float uDpr;
varying vec2 vOffset;
varying vec4 vShape;
varying vec3 vColor;

void main() {
  float d = length(vOffset);
  float aa = 0.75 / uDpr;
  float core = (1.0 - smoothstep(vShape.x - aa, vShape.x + aa, d)) * vShape.z;
  float sigma = max(0.45 * vShape.y, 0.001);
  float halo = exp(-d * d / (2.0 * sigma * sigma)) * vShape.w;
  float rest = 1.0 - core;
  gl_FragColor = vec4(uCore * core + vColor * halo * rest, core + halo * rest);
}
`;
