import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';
import { FramePulseService } from '../core/frame-pulse.service';

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \\
  int index = 0;                                            \\
  for (int i = 0; i < 2; i++) {                               \\
     ColorStop currentColor = colors[i];                    \\
     bool isInBetween = currentColor.position <= factor;    \\
     index = int(mix(float(index), float(i), float(isInBetween))); \\
  }                                                         \\
  ColorStop currentColor = colors[index];                   \\
  ColorStop nextColor = colors[index + 1];                  \\
  float range = nextColor.position - currentColor.position; \\
  float lerpFactor = (factor - currentColor.position) / range; \\
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \\
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  vec3 auroraColor = intensity * rampColor;

  vec3 premultiplied = auroraColor * auroraAlpha;

  // Dithering — adds sub-pixel noise (~1/255) to break up the 8-bit colour
  // banding that's most visible across the light-mode gradient. Hash of the
  // pixel coordinate, so it's stable per-pixel and reads as smooth, not grainy.
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  premultiplied += (dither - 0.5) / 255.0;

  fragColor = vec4(premultiplied, auroraAlpha);
}
`;

let auroraFallbackId = 0;

@Component({
  selector: 'app-aurora',
  standalone: false,
  template: '<div #container class="aurora-container"></div>',
  styles: [
    `
      .aurora-container {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class AuroraComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() colorStops: [string, string, string] = ['#3A29FF', '#FF94B4', '#FF3232'];
  @Input() speed = 1.0;
  @Input() blend = 0.5;
  @Input() amplitude = 1.0;

  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private unsub: (() => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  private glContext: any = null;
  private fallbackAnimations: Animation[] = [];
  private program: any = null;
  // Colour stops converted to GPU vec3s, recomputed only when the `colorStops`
  // input changes (a theme flip) — never per frame.
  private colorStopsVec: number[][] = [];

  constructor(private pulse: FramePulseService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['colorStops']) {
      this.colorStopsVec = this.toColorVec(this.colorStops);
    }
    // Once the program exists, a later input change (theme flip) pushes straight
    // to the uniforms; before init, ngAfterViewInit seeds them.
    if (this.program) {
      this.program.uniforms.uColorStops.value = this.colorStopsVec;
      this.program.uniforms.uAmplitude.value = this.amplitude;
      this.program.uniforms.uBlend.value = this.blend;
    }
  }

  private toColorVec(stops: [string, string, string]): number[][] {
    return stops.map((hex) => {
      const c = new Color(hex);
      return [c.r, c.g, c.b];
    });
  }

  ngAfterViewInit(): void {
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
      this.initCssFallback();
      return;
    }

    const ctn = this.containerRef.nativeElement;

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });
    const gl = renderer.gl;
    this.glContext = gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = 'transparent';

    const resize = () => {
      const width = ctn.offsetWidth;
      const height = ctn.offsetHeight;
      renderer.setSize(width, height);
      if (this.program) {
        this.program.uniforms.uResolution.value = [width, height];
      }
    };
    this.resizeHandler = resize;
    window.addEventListener('resize', resize);

    const geometry = new Triangle(gl);
    if ((geometry as any).attributes.uv) {
      delete (geometry as any).attributes.uv;
    }

    // Seeded by ngOnChanges (fires before AfterViewInit for the bound input);
    // fall back for the no-binding case so the array is never empty.
    if (this.colorStopsVec.length === 0) {
      this.colorStopsVec = this.toColorVec(this.colorStops);
    }

    this.program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: this.amplitude },
        uColorStops: { value: this.colorStopsVec },
        uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
        uBlend: { value: this.blend },
      },
    });

    const mesh = new Mesh(gl, { geometry, program: this.program });
    ctn.appendChild(gl.canvas);

    // Only time advances per frame now; palette/amplitude/blend are pushed by
    // ngOnChanges on a theme flip, so there is no per-frame Color allocation.
    this.unsub = this.pulse.onTick((now) => {
      this.program.uniforms.uTime.value = now * 0.01 * this.speed * 0.1;
      renderer.render({ scene: mesh });
    });

    resize();
  }

  private initCssFallback(): void {
    const ctn = this.containerRef.nativeElement;
    Object.assign(ctn.style, { position: 'relative', overflow: 'hidden' });
    this.buildFallbackBlobs(ctn);
    this.buildFallbackNoiseSvg(ctn);
  }

  private buildFallbackBlobs(ctn: HTMLElement): void {
    const blobs = [
      { w: '120%', h: '60%', t: '-30%', l: '-20%', dur: 12000,
        a: 'translate3d(-5%,-8%,0) scale(1.1)', b: 'translate3d(8%,5%,0) scale(0.95)' },
      { w: '100%', h: '50%', t: '-25%', l: '0%', dur: 15000,
        a: 'translate3d(10%,-5%,0) scale(0.9)', b: 'translate3d(-8%,8%,0) scale(1.05)' },
      { w: '110%', h: '55%', t: '-28%', l: '-10%', dur: 18000,
        a: 'translate3d(-3%,5%,0) scale(1.05)', b: 'translate3d(5%,-10%,0) scale(1.1)' },
    ];

    this.colorStops.forEach((hex, i) => {
      const c = blobs[i];
      const el = document.createElement('div');
      Object.assign(el.style, {
        position: 'absolute', borderRadius: '50%', willChange: 'transform',
        opacity: '0.6', width: c.w, height: c.h, top: c.t, left: c.l,
        background: `radial-gradient(ellipse at center, ${hex} 0%, transparent 70%)`,
      });
      this.fallbackAnimations.push(
        el.animate(
          [{ transform: c.a }, { transform: c.b }],
          { duration: c.dur, easing: 'ease-in-out', iterations: Infinity, direction: 'alternate', fill: 'both' }
        )
      );
      ctn.appendChild(el);
    });
  }

  private buildFallbackNoiseSvg(ctn: HTMLElement): void {
    const fId = `aurora-noise-${auroraFallbackId++}`;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    Object.assign(svg.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      opacity: '0.06', pointerEvents: 'none',
    });
    const fl = document.createElementNS(ns, 'filter');
    fl.setAttribute('id', fId);
    const turb = document.createElementNS(ns, 'feTurbulence');
    turb.setAttribute('type', 'fractalNoise');
    turb.setAttribute('baseFrequency', '0.65');
    turb.setAttribute('numOctaves', '3');
    turb.setAttribute('stitchTiles', 'stitch');
    fl.appendChild(turb);
    const cm = document.createElementNS(ns, 'feColorMatrix');
    cm.setAttribute('type', 'saturate');
    cm.setAttribute('values', '0');
    fl.appendChild(cm);
    svg.appendChild(fl);
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('filter', `url(#${fId})`);
    svg.appendChild(rect);
    ctn.appendChild(svg);
  }

  ngOnDestroy(): void {
    this.fallbackAnimations.forEach(a => a.cancel());
    this.unsub?.();
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    const ctn = this.containerRef?.nativeElement;
    if (ctn && this.glContext?.canvas?.parentNode === ctn) {
      ctn.removeChild(this.glContext.canvas);
    }
    this.glContext?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
