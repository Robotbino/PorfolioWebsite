/**
 * The site's one lens: the distance, in CSS pixels, from the viewer to the
 * screen plane the page's 3D projects through. CSS reads it as
 * `--camera-perspective` (styles.css) and the WebGL star map derives its field
 * of view from it, so a depth of -160px means the same thing in a stylesheet
 * and in the star field. The two copies are pinned together by camera.spec.ts.
 * The Toolset orbit is the exception: an illustration with its own stage, it
 * scales a camera to that stage instead (tool-orbit.math.ts).
 */
export const CAMERA_PERSPECTIVE_PX = 1600;
