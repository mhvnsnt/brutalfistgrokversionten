//#region node_modules/.nitro/vite/services/ssr/assets/V7OrientationContract-Yri4iSAt.js
var PRESENTATION_YAW = Math.PI / 4;
var SELECT_P1_YAW = PRESENTATION_YAW;
var SELECT_P2_YAW = -PRESENTATION_YAW;
/** Image-tested: face toward camera and P2 (right). */
var SELECT_MAIME_P1_YAW = -Math.PI / 4;
/** Image-tested: face toward camera and P1 / Bannon (left). */
var SELECT_MAIME_P2_YAW = -3 * Math.PI / 4;
/** Image-tested: face P1, side to camera. NOT −π/2 (that is face-to-cam). LOCKED. */
var COMBAT_P2_YAW = Math.PI;
/** Standing torso after feet are on the floor — not the sky above busts. */
var HIT_FX_WORLD_Y = 1.05;
/** Select-only sole sink. Combat does not use this. */
var FOOT_PLANT_SINK = .02;
function selectYaw(side, pluginBindPose = false) {
	if (pluginBindPose) return side === -1 ? SELECT_MAIME_P2_YAW : SELECT_MAIME_P1_YAW;
	return side === 1 ? SELECT_P1_YAW : SELECT_P2_YAW;
}
//#endregion
export { selectYaw as i, FOOT_PLANT_SINK as n, HIT_FX_WORLD_Y as r, COMBAT_P2_YAW as t };
