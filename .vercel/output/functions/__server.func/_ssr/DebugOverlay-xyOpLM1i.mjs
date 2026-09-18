//#region node_modules/.nitro/vite/services/ssr/assets/DebugOverlay-xyOpLM1i.js
var DEFAULT_DEBUG_SETTINGS = {
	enabled: false,
	showP1: true,
	showP2: true,
	showFrameWindows: true,
	showAABB: true,
	showImpactMarkers: true,
	showRigState: true,
	showHurtboxRegions: true
};
var DEFAULT_HURTBOX_REGIONS = [
	{
		region: "head",
		yOffset: -.75,
		height: .18,
		wasHit: false,
		damageMultiplier: 1.5
	},
	{
		region: "torso",
		yOffset: -.3,
		height: .35,
		wasHit: false,
		damageMultiplier: 1
	},
	{
		region: "leftArm",
		yOffset: -.25,
		height: .3,
		wasHit: false,
		damageMultiplier: .8
	},
	{
		region: "rightArm",
		yOffset: -.25,
		height: .3,
		wasHit: false,
		damageMultiplier: .8
	},
	{
		region: "leftLeg",
		yOffset: .25,
		height: .35,
		wasHit: false,
		damageMultiplier: .7
	},
	{
		region: "rightLeg",
		yOffset: .25,
		height: .35,
		wasHit: false,
		damageMultiplier: .7
	}
];
/** Compute frame window data from state machine hitbox window */
function computeFrameWindowData(hitboxWindow, actionState) {
	if (!hitboxWindow.move) return null;
	const FPS = 60;
	const move = hitboxWindow.move;
	const totalFrames = move.totalFrames ?? Math.round((move.startup + move.active + move.recovery) * FPS);
	const startupFrames = Math.round(move.startup * FPS);
	const activeFrames = Math.round(move.active * FPS);
	const recoveryFrames = totalFrames - startupFrames - activeFrames;
	const currentFrame = hitboxWindow.currentFrame;
	let phase = "idle";
	let phaseProgress = 0;
	if (actionState === "Attacking" || actionState === "Startup" || actionState === "Active") {
		if (currentFrame < startupFrames) {
			phase = "startup";
			phaseProgress = currentFrame / Math.max(1, startupFrames);
		} else if (currentFrame < startupFrames + activeFrames) {
			phase = "active";
			phaseProgress = (currentFrame - startupFrames) / Math.max(1, activeFrames);
		} else {
			phase = "recovery";
			phaseProgress = (currentFrame - startupFrames - activeFrames) / Math.max(1, recoveryFrames);
		}
	}
	return {
		phase,
		currentFrame,
		totalFrames,
		startupFrames,
		activeFrames,
		recoveryFrames,
		phaseProgress: Math.min(1, Math.max(0, phaseProgress))
	};
}
/** Build rig state data from animation clip name and elapsed time */
function computeRigState(activeClip, elapsedSeconds, totalDurationSeconds, playbackSpeed = 1, isCrossfading = false, crossfadeProgress = 0) {
	const FPS = 60;
	const clipTotalFrames = Math.max(1, Math.round(totalDurationSeconds * FPS));
	return {
		activeClip,
		clipFrame: Math.min(clipTotalFrames - 1, Math.round(elapsedSeconds * FPS * playbackSpeed)),
		clipTotalFrames,
		playbackSpeed,
		isCrossfading,
		crossfadeProgress: Math.min(1, Math.max(0, crossfadeProgress))
	};
}
/** Get CSS color for frame phase */
function getPhaseColor(phase) {
	switch (phase) {
		case "startup": return "#facc15";
		case "active": return "#22c55e";
		case "recovery": return "#ef4444";
		case "idle": return "#52525b";
	}
}
/** Get CSS color label for phase */
function getPhaseName(phase) {
	switch (phase) {
		case "startup": return "STARTUP";
		case "active": return "ACTIVE";
		case "recovery": return "RECOVERY";
		case "idle": return "IDLE";
	}
}
/** Get color for hurtbox region */
function getRegionColor(region, wasHit) {
	if (wasHit) return "#ef4444";
	switch (region) {
		case "head": return "#a78bfa";
		case "torso": return "#60a5fa";
		case "leftArm":
		case "rightArm": return "#34d399";
		case "leftLeg":
		case "rightLeg": return "#fbbf24";
	}
}
//#endregion
export { getPhaseColor as a, computeRigState as i, DEFAULT_HURTBOX_REGIONS as n, getPhaseName as o, computeFrameWindowData as r, getRegionColor as s, DEFAULT_DEBUG_SETTINGS as t };
