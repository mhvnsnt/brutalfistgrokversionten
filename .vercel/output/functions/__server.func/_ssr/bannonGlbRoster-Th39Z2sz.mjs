//#region node_modules/.nitro/vite/services/ssr/assets/graphicsSettings-DX0c8QCb.js
var RENDER_PROFILES = {
	retro8: {
		mode: "retro8",
		enabled: true,
		renderWidth: 160,
		renderHeight: 120,
		vertexGrid: 1 / 512,
		textureFilter: "nearest",
		textureSize: 128,
		quantizeScreenSpace: true
	},
	ps1: {
		mode: "ps1",
		enabled: true,
		renderWidth: 320,
		renderHeight: 240,
		vertexGrid: 1 / 2048,
		textureFilter: "nearest",
		textureSize: 256,
		quantizeScreenSpace: true
	},
	native: {
		mode: "native",
		enabled: false,
		renderWidth: 1280,
		renderHeight: 720,
		vertexGrid: 1 / 8192,
		textureFilter: "linear",
		textureSize: 1024,
		quantizeScreenSpace: false
	}
};
RENDER_PROFILES.ps1;
var KEY = "bf-graphics-quality-v1";
var DEFAULT_QUALITY = "ps1";
function readStored() {
	if (typeof window === "undefined") return DEFAULT_QUALITY;
	try {
		const raw = window.localStorage.getItem(KEY);
		if (raw === "ps1" || raw === "retro8" || raw === "native") return raw;
	} catch {}
	return DEFAULT_QUALITY;
}
var current = DEFAULT_QUALITY;
var listeners = /* @__PURE__ */ new Set();
if (typeof window !== "undefined") current = readStored();
function getGraphicsQuality() {
	return current;
}
function getActiveRenderProfile() {
	return RENDER_PROFILES[current];
}
function setGraphicsQuality(next) {
	current = next;
	if (typeof window !== "undefined") {
		try {
			window.localStorage.setItem(KEY, next);
		} catch {}
		window.dispatchEvent(new CustomEvent("bf-graphics-quality", { detail: next }));
	}
	listeners.forEach((fn) => fn(next));
}
var GRAPHICS_QUALITY_LABELS = {
	ps1: "PS1 DEFAULT",
	retro8: "8-BIT",
	native: "HIGH RES"
};
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/bannonGlbRoster-Th39Z2sz.js
/** Authoritative remote tree for Bannon character GLBs. */
var BANNON_MODELS_RAW = "https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models";
/**
* Same-origin URL for a character GLB.
*
* Local `public/models/<file>` wins (Next/Vite static). Missing files rewrite
* to mhvnsnt/Bannon `assets/models` via next.config / vite proxy so Meshopt
* GLBs load without a GitHub CORS round-trip. Generated Maime skins live only
* in public/models and are never fetched from GitHub.
*/
function resolveGlbUrl(model, overrideUrl) {
	if (overrideUrl) return overrideUrl;
	return `/models/${encodeURIComponent(model)}`;
}
/**
* HARD BOUNDARY: only actual Bannon character GLBs are catalogued here.
* Rig status below is from measured inspection of mhvnsnt/Bannon assets/models
* (2026-09-16): skins + JOINTS_0 + mixamorig:* joints. Named-part/static files
* are not playable unless a skinned sibling exists.
*
* Preference: *_skinned / *_rigged / *_rig28 over named-part or static previews.
* BANNON.glb is named-part; BANNON_rigged.glb is the Mixamo-skinned default.
* BANNON_fat.glb does not exist — the muscular alt is BANNON_muscular_skinned.glb.
*/
var BANNON_GLB_MODELS = [
	{
		id: "bannon",
		name: "Bannon",
		model: "BANNON_rigged.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "bannon",
		name: "Bannon",
		model: "BANNON_muscular_skinned.glb",
		attire: "Muscular alt",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "maime",
		name: "Maime",
		model: "MAIME_skinned.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "OFFLINE_NAMEDPART_SKIN",
		overrideUrl: "/models/MAIME_skinned.glb",
		measuredJoints: 22,
		measuredJoints0: 15
	},
	{
		id: "maime",
		name: "Maime",
		model: "MAIME_tattered_skinned.glb",
		attire: "Tattered",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "OFFLINE_NAMEDPART_SKIN",
		overrideUrl: "/models/MAIME_tattered_skinned.glb",
		measuredJoints: 22,
		measuredJoints0: 14
	},
	{
		id: "onyx",
		name: "Onyx",
		model: "ONYX_street.glb",
		attire: "Street",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "onyx",
		name: "Onyx",
		model: "ONYX_straightjacket.glb",
		attire: "Straightjacket",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "onyx",
		name: "Onyx",
		model: "ONYX_skinned.glb",
		attire: "Chola/Spiked",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "onyx",
		name: "Onyx",
		model: "ONYX_corset_skinned.glb",
		attire: "Corset/Vamp",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "cain_elias",
		name: "Cain Elias",
		model: "CAIN_ELIAS_ring.glb",
		attire: "Ring",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "cain_elias",
		name: "Cain Elias",
		model: "CAIN_ELIAS_snakeskin.glb",
		attire: "Snakeskin",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "cain_elias",
		name: "Cain Elias",
		model: "CAIN_ELIAS_gear.glb",
		attire: "Wrestling Gear",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "cain_elias",
		name: "Cain Elias",
		model: "CAIN_ELIAS_godwithin.glb",
		attire: "God Within",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "BATCH_RERIG",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "cipher",
		name: "Cipher",
		model: "CIPHER.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "cipher",
		name: "Cipher",
		model: "CIPHER_minion.glb",
		attire: "Minion",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "cipher",
		name: "Cipher",
		model: "CIPHER_feral.glb",
		attire: "Feral",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "stick_up",
		name: "Stick-Up",
		model: "STICKUP.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "echo",
		name: "Echo",
		model: "ECHO.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "cody",
		name: "Cody",
		model: "CODY_sober.glb",
		attire: "Sober",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "cody",
		name: "Cody",
		model: "CODY_stressed.glb",
		attire: "Stressed",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "cody",
		name: "Cody",
		model: "CODY_gear_skinned.glb",
		attire: "Wrestling Gear",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "hall_nighter",
		name: "Hall Nighter",
		model: "HALL_NIGHTER.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "static",
		name: "Static",
		model: "STATIC.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "static",
		name: "Static",
		model: "STATIC_alt.glb",
		attire: "Alt",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "viper",
		name: "Viper",
		model: "VIPER.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "kobra",
		name: "Kobra",
		model: "KOBRA.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "aaron_ruben",
		name: "Aaron Ruben",
		model: "AARON_RUBEN.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "hollow",
		name: "Hollow",
		model: "HOLLOW.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "edwin_kennedy",
		name: "Edwin Kennedy",
		model: "EDWIN_KENNEDY.glb",
		attire: "Mustached Mogul",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "edwin_kennedy",
		name: "Edwin Kennedy",
		model: "EDWIN_KENNEDY_unchained_rig28.glb",
		attire: "Unchained",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "BATCH_RERIG",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "pablo",
		name: "Pablo",
		model: "PABLO.glb",
		attire: "Minotaur Painted",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "pablo",
		name: "Pablo",
		model: "PABLO_goldenbull.glb",
		attire: "Golden Bull",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "BATCH_RERIG",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "pablo",
		name: "Pablo",
		model: "PABLO_blackreign.glb",
		attire: "Black Reign",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "BATCH_RERIG",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "tyneshia",
		name: "Tyneshia",
		model: "TYNESHIA.glb",
		attire: "Wrestling Gear",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "tyneshia",
		name: "Tyneshia",
		model: "TYNESHIA_street.glb",
		attire: "Hall Street / Casual",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "BATCH_RERIG",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "triple_xxx",
		name: "Triple XXX",
		model: "TRIPLE_XXX.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "triple_xxx",
		name: "Triple XXX",
		model: "TRIPLE_XXX_tights.glb",
		attire: "Blue Tights",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "BATCH_RERIG",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "triple_xxx",
		name: "Triple XXX",
		model: "TRIPLE_XXX_trunks.glb",
		attire: "Blue Trunks",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "BATCH_RERIG",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "triple_xxx",
		name: "Triple XXX",
		model: "TRIPLE_XXX_suit.glb",
		attire: "Suit / Manager",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "BATCH_RERIG",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "el_toro_de_oro",
		name: "El Toro de Oro",
		model: "EL_TORO_DE_ORO.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "stan_combs",
		name: "Stan Combs",
		model: "STAN_COMBS_gear.glb",
		attire: "Ring Gear",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "brutus",
		name: "Brutus",
		model: "BRUTUS.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "titan",
		name: "Titan",
		model: "TITAN.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "titan",
		name: "Titan",
		model: "TITAN_unmasked.glb",
		attire: "Unmasked",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "titan",
		name: "Titan",
		model: "TITAN_white.glb",
		attire: "White",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "master_sensei",
		name: "Master Sensei",
		model: "MASTER_SENSEI.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "master_sensei",
		name: "Master Sensei",
		model: "MASTER_SENSEI_rose.glb",
		attire: "Rose",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "wreck_patterson",
		name: "Wreck Patterson",
		model: "WRECK_PATTERSON.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "MODEL_QA",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "wreck_patterson",
		name: "Wreck Patterson",
		model: "WRECK_PATTERSON_attire2.glb",
		attire: "Attire 2",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "wreck_patterson",
		name: "Wreck Patterson",
		model: "WRECK_PATTERSON_attire3.glb",
		attire: "Attire 3",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "wreck_patterson",
		name: "Wreck Patterson",
		model: "WRECK_PATTERSON_godwithin.glb",
		attire: "God Within",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "jager",
		name: "Jager",
		model: "JAGER.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "jager",
		name: "Jager",
		model: "JAGER_beard.glb",
		attire: "Beard",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "finxsse",
		name: "Finxsse",
		model: "NPC_FINXSSE.glb",
		attire: "NPC",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "tarzanian_devil",
		name: "Tarzanian Devil",
		model: "TARZANIAN_DEVIL_skinned.glb",
		attire: "Default",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "CANON_MODELS",
		measuredJoints: 58,
		measuredJoints0: 1
	},
	{
		id: "tarzanian_devil",
		name: "Tarzanian Devil",
		model: "TARZANIAN_DEVIL_dec_rig28.glb",
		attire: "Decimated",
		rigStatus: "skinned",
		playableGate: "PASS",
		source: "BATCH_RERIG",
		measuredJoints: 58,
		measuredJoints0: 1
	}
];
var BANNON_GLB_PLAYABLE_MODELS = BANNON_GLB_MODELS.filter((e) => e.playableGate === "PASS");
BANNON_GLB_MODELS.filter((e) => e.playableGate !== "PASS");
[...new Set(BANNON_GLB_MODELS.map((e) => e.id))];
function getGlbEntryForFighter(fighterId, model) {
	const attires = BANNON_GLB_MODELS.filter((e) => e.id === fighterId && e.playableGate === "PASS");
	if (model) {
		const exact = attires.find((e) => e.model === model);
		if (exact) return exact;
	}
	const quality = getGraphicsQuality();
	if (quality === "ps1" || quality === "retro8") {
		const decimated = attires.find((e) => /_dec/i.test(e.model));
		if (decimated) return decimated;
	}
	if (quality === "native") {
		const hi = attires.find((e) => /skinned|rigged/i.test(e.model) && !/_dec/i.test(e.model));
		if (hi) return hi;
	}
	return attires[0];
}
function getFighterGlbUrl(fighterId, model) {
	const entry = getGlbEntryForFighter(fighterId, model);
	if (!entry) return null;
	return resolveGlbUrl(entry.model, entry.overrideUrl);
}
function getPlayableAttires(fighterId) {
	return BANNON_GLB_MODELS.filter((e) => e.id === fighterId && e.playableGate === "PASS");
}
//#endregion
export { getPlayableAttires as a, getActiveRenderProfile as c, getGlbEntryForFighter as i, getGraphicsQuality as l, BANNON_MODELS_RAW as n, resolveGlbUrl as o, getFighterGlbUrl as r, GRAPHICS_QUALITY_LABELS as s, BANNON_GLB_PLAYABLE_MODELS as t, setGraphicsQuality as u };
