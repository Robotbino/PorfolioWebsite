import { InjectionToken } from '@angular/core';
import { Geometry, Mesh, OGLRenderingContext, Program, Renderer, Transform } from 'ogl';
import { StarMapPalette } from '../core/star-map-palette';
import { STAR_COUNT } from '../constellation/constellation.figures';
import { FIELD, FOCAL, fieldPoints } from './star-map.math';
import { LINK_SLOTS, LINK_STRIDE, STAR_STRIDE, StarMapScene } from './star-map.scene';
import {
  FIELD_FRAGMENT,
  FIELD_VERTEX,
  LINK_FRAGMENT,
  LINK_VERTEX,
  STAR_FRAGMENT,
  STAR_VERTEX,
} from './star-map.shaders';

/**
 * What the star map component needs from a renderer. The OGL implementation
 * below is the only real one; the component's specs swap in a fake through
 * STAR_MAP_RENDERER, because a headless test browser has no WebGL.
 */
export interface StarMapRenderer {
  /** The renderer's own canvas, sized to fill its container. */
  readonly canvas: HTMLCanvasElement;
  /** Reallocate the drawing buffer for a canvas `cssW`×`cssH` CSS px at `dpr`. */
  resize(cssW: number, cssH: number, dpr: number): void;
  setPalette(palette: StarMapPalette): void;
  /** How many of the field's stars to draw, up to the `maxField` it was built with. */
  setFieldCount(count: number): void;
  draw(scene: StarMapScene): void;
  /** Called once if the GPU drops the context; the renderer does not try to restore it. */
  onContextLost(callback: () => void): void;
  dispose(): void;
}

/** Builds a renderer, or returns null when this device should get the SVG instead. */
export type StarMapRendererFactory = (options: {
  maxField: number;
  seed: number;
}) => StarMapRenderer | null;

export const STAR_MAP_RENDERER = new InjectionToken<StarMapRendererFactory>('STAR_MAP_RENDERER', {
  providedIn: 'root',
  factory: () => createOglStarMapRenderer,
});

/**
 * The context the star map asks for. No antialiasing or depth buffer (links
 * antialias from coverage, and nothing is depth-tested), and a low-power GPU
 * is plenty. `failIfMajorPerformanceCaveat` refuses software rendering, where
 * a full-screen canvas would cost more than the map is worth: those devices
 * get the SVG.
 */
const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: 'low-power',
  failIfMajorPerformanceCaveat: true,
};

/** Corner order shared by every quad: (−1,−1), (1,−1), (−1,1), (1,1). */
const QUAD_X = [-1, 1, -1, 1];
const QUAD_Y = [-1, -1, 1, 1];
const LINK_VERTEX_FLOATS = 8; // aA.xy, aB.xy, aAlpha.xy, aSideEnd.xy
const STAR_VERTEX_FLOATS = 11; // aCorner.xy, aCenter.xy, aShape.xyzw, aColor.rgb

export function createOglStarMapRenderer(options: {
  maxField: number;
  seed: number;
}): StarMapRenderer | null {
  const canvas = document.createElement('canvas');
  // OGL's Renderer throws on a null context, so probe first. Asking twice is
  // safe: once a context exists, getContext returns that same one.
  const webgl2 = canvas.getContext('webgl2', CONTEXT_ATTRIBUTES);
  const context = webgl2 ?? canvas.getContext('webgl', CONTEXT_ATTRIBUTES);
  if (!context) {
    return null;
  }
  try {
    const renderer = new Renderer({
      canvas,
      webgl: webgl2 ? 2 : 1,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      dpr: 1,
    });
    const map = new OglStarMapRenderer(renderer, options.maxField, options.seed);
    if (!map.linked()) {
      map.dispose();
      return null;
    }
    return map;
  } catch {
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
}

class OglStarMapRenderer implements StarMapRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: OGLRenderingContext;
  private readonly root = new Transform();
  private readonly fieldGeometry: Geometry;
  private readonly fieldProgram: Program;
  private readonly linkProgram: Program;
  private readonly starProgram: Program;
  private readonly linkData = new Float32Array(LINK_SLOTS * 4 * LINK_VERTEX_FLOATS);
  private readonly starData = new Float32Array(STAR_COUNT * 4 * STAR_VERTEX_FLOATS);
  private readonly linkBuffer: { needsUpdate?: boolean };
  private readonly starBuffer: { needsUpdate?: boolean };
  private readonly maxField: number;
  private lostCallback: (() => void) | null = null;
  private disposed = false;

  constructor(
    private readonly renderer: Renderer,
    maxField: number,
    seed: number,
  ) {
    const gl = renderer.gl;
    this.gl = gl;
    this.canvas = gl.canvas;
    this.maxField = maxField;
    // OGL's constructor sizes the canvas in inline px; the canvas fills its
    // container instead, so the stylesheet decides its size and resize() only
    // sets the drawing buffer.
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;';
    gl.clearColor(0, 0, 0, 0);
    this.canvas.addEventListener('webglcontextlost', this.onLost);

    // With a premultiplied renderer, transparent programs blend ONE,
    // ONE_MINUS_SRC_ALPHA. Nothing is depth-tested: draw order is the layering.
    const state = {
      transparent: true,
      cullFace: false,
      depthTest: false,
      depthWrite: false,
    } as const;

    // Field: one static interleaved buffer of (u, v, z, brightness).
    const points = fieldPoints(seed, maxField);
    this.fieldGeometry = new Geometry(gl, {
      position: { data: points, size: 3, stride: 16, offset: 0 },
    });
    this.fieldGeometry.addAttribute('bright', {
      buffer: this.fieldGeometry.attributes['position'].buffer,
      type: gl.FLOAT,
      size: 1,
      stride: 16,
      offset: 12,
      count: maxField,
    });
    this.fieldProgram = new Program(gl, {
      vertex: FIELD_VERTEX,
      fragment: FIELD_FRAGMENT,
      ...state,
      uniforms: {
        uView: { value: new Float32Array(16) },
        uProj: { value: new Float32Array(16) },
        uTanHalf: { value: new Float32Array(2) },
        uF: { value: FOCAL },
        uDpr: { value: 1 },
        uSize: { value: [...FIELD.size] },
        uFog: { value: [...FIELD.fog] },
        uAlpha: { value: [0, 0] },
        uColor: { value: [1, 1, 1] },
        uOpacity: { value: 0 },
      },
    });

    // Links and stars: one dynamic interleaved buffer each, re-uploaded per
    // draw. The quads' static corner attributes live in the same buffer and
    // are written once here.
    const linkGeometry = this.quadGeometry(this.linkData, LINK_SLOTS, LINK_VERTEX_FLOATS, [
      ['aA', 2],
      ['aB', 2],
      ['aAlpha', 2],
      ['aSideEnd', 2],
    ]);
    this.linkBuffer = linkGeometry.attributes['aA'];
    for (let v = 0; v < LINK_SLOTS * 4; v++) {
      this.linkData[v * LINK_VERTEX_FLOATS + 6] = QUAD_X[v % 4];
      this.linkData[v * LINK_VERTEX_FLOATS + 7] = QUAD_Y[v % 4] < 0 ? 0 : 1;
    }
    this.linkProgram = new Program(gl, {
      vertex: LINK_VERTEX,
      fragment: LINK_FRAGMENT,
      ...state,
      uniforms: {
        uResolution: { value: [1, 1] },
        uHalfWidth: { value: 0.5 },
        uDpr: { value: 1 },
        uColor: { value: [1, 1, 1] },
      },
    });

    const starGeometry = this.quadGeometry(this.starData, STAR_COUNT, STAR_VERTEX_FLOATS, [
      ['aCorner', 2],
      ['aCenter', 2],
      ['aShape', 4],
      ['aColor', 3],
    ]);
    this.starBuffer = starGeometry.attributes['aCorner'];
    for (let v = 0; v < STAR_COUNT * 4; v++) {
      this.starData[v * STAR_VERTEX_FLOATS] = QUAD_X[v % 4];
      this.starData[v * STAR_VERTEX_FLOATS + 1] = QUAD_Y[v % 4];
    }
    this.starProgram = new Program(gl, {
      vertex: STAR_VERTEX,
      fragment: STAR_FRAGMENT,
      ...state,
      uniforms: {
        uResolution: { value: [1, 1] },
        uDpr: { value: 1 },
        uCore: { value: [1, 1, 1] },
      },
    });

    // Draw order is scene order (render runs with sort off): field, links, stars.
    new Mesh(gl, {
      geometry: this.fieldGeometry,
      program: this.fieldProgram,
      mode: gl.POINTS,
    }).setParent(this.root);
    new Mesh(gl, { geometry: linkGeometry, program: this.linkProgram }).setParent(this.root);
    new Mesh(gl, { geometry: starGeometry, program: this.starProgram }).setParent(this.root);
  }

  /** False when a program failed to link (OGL only logs it), so the caller can fall back. */
  linked(): boolean {
    return [this.fieldProgram, this.linkProgram, this.starProgram].every((p) =>
      this.gl.getProgramParameter(p.program, this.gl.LINK_STATUS),
    );
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    const width = Math.max(1, Math.round(cssW * dpr));
    const height = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    // OGL sets its viewport from width × dpr; handing it device pixels at
    // dpr 1 keeps the viewport exactly the buffer, with no rounding.
    this.renderer.dpr = 1;
    this.renderer.width = width;
    this.renderer.height = height;
    const resolution = [Math.max(1, cssW), Math.max(1, cssH)];
    this.fieldProgram.uniforms['uDpr'].value = dpr;
    this.linkProgram.uniforms['uResolution'].value = resolution;
    this.linkProgram.uniforms['uDpr'].value = dpr;
    this.starProgram.uniforms['uResolution'].value = resolution;
    this.starProgram.uniforms['uDpr'].value = dpr;
  }

  setPalette(palette: StarMapPalette): void {
    this.fieldProgram.uniforms['uColor'].value = unit(palette.field);
    this.fieldProgram.uniforms['uAlpha'].value = [...palette.fieldAlpha];
    this.linkProgram.uniforms['uColor'].value = unit(palette.line);
    this.starProgram.uniforms['uCore'].value = unit(palette.core);
  }

  setFieldCount(count: number): void {
    this.fieldGeometry.setDrawRange(0, Math.max(0, Math.min(this.maxField, Math.round(count))));
  }

  draw(scene: StarMapScene): void {
    if (this.disposed) {
      return;
    }
    const field = this.fieldProgram.uniforms;
    field['uView'].value = scene.view;
    field['uProj'].value = scene.proj;
    field['uTanHalf'].value = scene.fieldExtent;
    field['uOpacity'].value = scene.fieldOpacity;
    this.linkProgram.uniforms['uHalfWidth'].value = scene.lineHalfWidth;

    this.expandLinks(scene.links);
    this.expandStars(scene.stars);
    this.linkBuffer.needsUpdate = true;
    this.starBuffer.needsUpdate = true;

    this.renderer.render({ scene: this.root, sort: false, frustumCull: false });
  }

  onContextLost(callback: () => void): void {
    this.lostCallback = callback;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    // Unhooked first: losing the context on purpose fires the same event.
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.lostCallback = null;
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  private onLost = (event: Event): void => {
    event.preventDefault();
    this.lostCallback?.();
  };

  /** Four vertices per slot, from the scene's per-link records. */
  private expandLinks(links: Float32Array): void {
    const data = this.linkData;
    for (let slot = 0; slot < LINK_SLOTS; slot++) {
      const src = slot * LINK_STRIDE;
      for (let corner = 0; corner < 4; corner++) {
        const o = (slot * 4 + corner) * LINK_VERTEX_FLOATS;
        data[o] = links[src];
        data[o + 1] = links[src + 1];
        data[o + 2] = links[src + 2];
        data[o + 3] = links[src + 3];
        data[o + 4] = links[src + 4];
        data[o + 5] = links[src + 5];
      }
    }
  }

  /** Four vertices per star, from the scene's per-star records. */
  private expandStars(stars: Float32Array): void {
    const data = this.starData;
    for (let i = 0; i < STAR_COUNT; i++) {
      const src = i * STAR_STRIDE;
      for (let corner = 0; corner < 4; corner++) {
        const o = (i * 4 + corner) * STAR_VERTEX_FLOATS;
        for (let f = 0; f < STAR_STRIDE; f++) {
          data[o + 2 + f] = stars[src + f];
        }
      }
    }
  }

  /**
   * An indexed quad list over one interleaved buffer: the first attribute owns
   * the data (and so the uploads), the rest read the same buffer at offsets.
   */
  private quadGeometry(
    data: Float32Array,
    quads: number,
    floatsPerVertex: number,
    layout: readonly (readonly [name: string, size: number])[],
  ): Geometry {
    const gl = this.gl;
    const stride = floatsPerVertex * 4;
    const index = new Uint16Array(quads * 6);
    for (let q = 0; q < quads; q++) {
      index.set(
        [0, 1, 2, 2, 1, 3].map((i) => q * 4 + i),
        q * 6,
      );
    }
    const [first, ...rest] = layout;
    const geometry = new Geometry(gl, {
      [first[0]]: { data, size: first[1], stride, offset: 0, usage: gl.DYNAMIC_DRAW },
      index: { data: index },
    });
    const buffer = geometry.attributes[first[0]].buffer;
    let offset = first[1] * 4;
    for (const [name, size] of rest) {
      geometry.addAttribute(name, {
        buffer,
        type: gl.FLOAT,
        size,
        stride,
        offset,
        count: quads * 4,
      });
      offset += size * 4;
    }
    return geometry;
  }
}

/** 0–255 sRGB to the 0–1 floats a uniform takes. */
function unit(rgb: readonly [number, number, number]): number[] {
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
}
