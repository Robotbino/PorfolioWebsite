import { CAMERA_PERSPECTIVE_PX } from './camera';

describe('CAMERA_PERSPECTIVE_PX', () => {
  it('matches the --camera-perspective token in styles.css', () => {
    const token = getComputedStyle(document.documentElement)
      .getPropertyValue('--camera-perspective')
      .trim();
    expect(token).toBe(`${CAMERA_PERSPECTIVE_PX}px`);
  });
});
