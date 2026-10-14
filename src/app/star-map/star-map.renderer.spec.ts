import { createOglStarMapRenderer } from './star-map.renderer';
import {
  FIELD_FRAGMENT,
  FIELD_VERTEX,
  LINK_FRAGMENT,
  LINK_VERTEX,
  STAR_FRAGMENT,
  STAR_VERTEX,
} from './star-map.shaders';

/**
 * The test browser runs without a GPU, so the renderer itself is exercised
 * live, not here. What can be pinned down without WebGL is the fallback
 * contract and the shader rules that would otherwise only fail on a device.
 */
describe('createOglStarMapRenderer', () => {
  it('returns null rather than throwing when no WebGL context is available', () => {
    const getContext = spyOn(HTMLCanvasElement.prototype, 'getContext').and.returnValue(null);

    expect(createOglStarMapRenderer({ maxField: 10, seed: 1 })).toBeNull();
    expect(getContext).toHaveBeenCalledWith(
      'webgl2',
      jasmine.objectContaining({ failIfMajorPerformanceCaveat: true, antialias: false }),
    );
    expect(getContext).toHaveBeenCalledWith('webgl', jasmine.anything());
  });
});

describe('star map shaders', () => {
  const programs: [string, string, string][] = [
    ['field', FIELD_VERTEX, FIELD_FRAGMENT],
    ['links', LINK_VERTEX, LINK_FRAGMENT],
    ['stars', STAR_VERTEX, STAR_FRAGMENT],
  ];
  const uniforms = (source: string) =>
    new Set(Array.from(source.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g), (m) => m[1]));

  it('are GLSL ES 1.00, so WebGL 1 devices compile them too', () => {
    for (const [, vertex, fragment] of programs) {
      expect(vertex).not.toContain('#version');
      expect(fragment).not.toContain('#version');
      expect(fragment).toContain('gl_FragColor');
    }
  });

  it('never declare a uniform in both stages, which GLSL ES 1.00 cannot link across precisions', () => {
    for (const [name, vertex, fragment] of programs) {
      const shared = [...uniforms(vertex)].filter((u) => uniforms(fragment).has(u));
      expect(shared).withContext(name).toEqual([]);
    }
  });
});
