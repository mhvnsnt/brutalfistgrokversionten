//#region node_modules/.nitro/vite/services/ssr/assets/StageConfig-DJ4pMRhO.js
var STAGE_CONFIGS = {
	urban_night: {
		id: "urban_night",
		name: "URBAN NIGHT",
		subtitle: "UNDERGROUND DISTRICT",
		accentColor: "#a855f7",
		bgColor: "#0d0014",
		ringOutEnabled: false,
		boundaryX: 4.5,
		boundaryZ: 3,
		levels: [{
			floorY: 0,
			boundaryX: 4.5,
			boundaryZ: 3,
			hazardDamagePerSec: 0,
			label: "STREET"
		}],
		breakableFloor: false,
		floorBreakThreshold: 0,
		ambientIntensity: .25,
		ambientColor: "#1a0030",
		primaryLightColor: "#c084fc",
		fillLightColor: "#3b0764",
		bgmTrack: "urban_night",
		hazardDamagePerSec: 0,
		hazardLabel: "",
		hasWalls: true,
		hasDestructibleWalls: false,
		hazardVolume: void 0,
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	training: {
		id: "training",
		name: "TRAINING GRID",
		subtitle: "VOID ARENA",
		accentColor: "#22d3ee",
		bgColor: "#001418",
		ringOutEnabled: false,
		boundaryX: 4.5,
		boundaryZ: 3,
		levels: [{
			floorY: 0,
			boundaryX: 4.5,
			boundaryZ: 3,
			hazardDamagePerSec: 0,
			label: "GRID"
		}],
		breakableFloor: false,
		floorBreakThreshold: 0,
		ambientIntensity: .35,
		ambientColor: "#c8d0e0",
		primaryLightColor: "#fff8f0",
		fillLightColor: "#a0b8ff",
		bgmTrack: "training",
		hazardDamagePerSec: 0,
		hazardLabel: "",
		hasWalls: true,
		hasDestructibleWalls: false,
		hazardVolume: void 0,
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	dojo: {
		id: "dojo",
		name: "DOJO",
		subtitle: "ANCIENT TRAINING HALL",
		accentColor: "#f97316",
		bgColor: "#1a0800",
		ringOutEnabled: false,
		boundaryX: 4,
		boundaryZ: 3,
		levels: [{
			floorY: 0,
			boundaryX: 4,
			boundaryZ: 3,
			hazardDamagePerSec: 0,
			label: "DOJO FLOOR"
		}, {
			floorY: -3.5,
			boundaryX: 5,
			boundaryZ: 4,
			hazardDamagePerSec: 0,
			label: "LOWER DOJO"
		}],
		breakableFloor: true,
		floorBreakThreshold: 60,
		ambientIntensity: .3,
		ambientColor: "#3d1a00",
		primaryLightColor: "#fbbf24",
		fillLightColor: "#7c2d12",
		bgmTrack: "dojo",
		hazardDamagePerSec: 0,
		hazardLabel: "",
		hasWalls: true,
		hasDestructibleWalls: true,
		hazardVolume: void 0,
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	wrestling_ring: {
		id: "wrestling_ring",
		name: "WRESTLING RING",
		subtitle: "THE SQUARED CIRCLE",
		accentColor: "#ef4444",
		bgColor: "#1a0000",
		ringOutEnabled: true,
		boundaryX: 3.8,
		boundaryZ: 3.8,
		levels: [{
			floorY: 0,
			boundaryX: 3.8,
			boundaryZ: 3.8,
			hazardDamagePerSec: 0,
			label: "RING"
		}],
		breakableFloor: false,
		floorBreakThreshold: 0,
		ambientIntensity: .2,
		ambientColor: "#1a0000",
		primaryLightColor: "#ffffff",
		fillLightColor: "#fca5a5",
		bgmTrack: "wrestling_ring",
		hazardDamagePerSec: 0,
		hazardLabel: "",
		hasWalls: false,
		hasDestructibleWalls: false,
		hazardVolume: {
			triggerX: 3.5,
			chipDamage: .05,
			label: "CROWD SHOVE"
		},
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	mma_octagon: {
		id: "mma_octagon",
		name: "MMA OCTAGON",
		subtitle: "THE CAGE",
		accentColor: "#facc15",
		bgColor: "#0f0f00",
		ringOutEnabled: false,
		boundaryX: 4.2,
		boundaryZ: 4.2,
		levels: [{
			floorY: 0,
			boundaryX: 4.2,
			boundaryZ: 4.2,
			hazardDamagePerSec: 0,
			label: "OCTAGON"
		}],
		breakableFloor: false,
		floorBreakThreshold: 0,
		ambientIntensity: .3,
		ambientColor: "#1a1a00",
		primaryLightColor: "#fef08a",
		fillLightColor: "#713f12",
		bgmTrack: "mma_octagon",
		hazardDamagePerSec: 0,
		hazardLabel: "",
		hasWalls: true,
		hasDestructibleWalls: false,
		hazardVolume: void 0,
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	steel_cage: {
		id: "steel_cage",
		name: "STEEL CAGE",
		subtitle: "NO ESCAPE",
		accentColor: "#94a3b8",
		bgColor: "#0a0a0a",
		ringOutEnabled: false,
		boundaryX: 4,
		boundaryZ: 4,
		levels: [{
			floorY: 0,
			boundaryX: 4,
			boundaryZ: 4,
			hazardDamagePerSec: 0,
			label: "CAGE"
		}],
		breakableFloor: false,
		floorBreakThreshold: 0,
		ambientIntensity: .15,
		ambientColor: "#0f172a",
		primaryLightColor: "#cbd5e1",
		fillLightColor: "#334155",
		bgmTrack: "steel_cage",
		hazardDamagePerSec: 0,
		hazardLabel: "",
		hasWalls: true,
		hasDestructibleWalls: false,
		hazardVolume: void 0,
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	industrial: {
		id: "industrial",
		name: "INDUSTRIAL",
		subtitle: "FACTORY FLOOR",
		accentColor: "#f59e0b",
		bgColor: "#0f0800",
		ringOutEnabled: false,
		boundaryX: 5,
		boundaryZ: 3.5,
		levels: [{
			floorY: 0,
			boundaryX: 5,
			boundaryZ: 3.5,
			hazardDamagePerSec: 0,
			label: "UPPER PLATFORM"
		}, {
			floorY: -4,
			boundaryX: 6,
			boundaryZ: 4.5,
			hazardDamagePerSec: 5,
			label: "FACTORY FLOOR"
		}],
		breakableFloor: true,
		floorBreakThreshold: 50,
		ambientIntensity: .2,
		ambientColor: "#1c0f00",
		primaryLightColor: "#fbbf24",
		fillLightColor: "#92400e",
		bgmTrack: "industrial",
		hazardDamagePerSec: 5,
		hazardLabel: "MOLTEN METAL",
		hasWalls: true,
		hasDestructibleWalls: true,
		hazardVolume: void 0,
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	ghetto_streets: {
		id: "ghetto_streets",
		name: "GHETTO STREETS",
		subtitle: "BACK ALLEY BRAWL",
		accentColor: "#84cc16",
		bgColor: "#0a0f00",
		ringOutEnabled: true,
		boundaryX: Infinity,
		boundaryZ: Infinity,
		levels: [{
			floorY: 0,
			boundaryX: Infinity,
			boundaryZ: Infinity,
			hazardDamagePerSec: 0,
			label: "STREETS"
		}],
		breakableFloor: false,
		floorBreakThreshold: 0,
		ambientIntensity: .2,
		ambientColor: "#0f1a00",
		primaryLightColor: "#bef264",
		fillLightColor: "#365314",
		bgmTrack: "ghetto_streets",
		hazardDamagePerSec: 0,
		hazardLabel: "",
		hasWalls: false,
		hasDestructibleWalls: false,
		hazardVolume: {
			triggerX: 8,
			chipDamage: .05,
			label: "CROWD SHOVE"
		},
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	junkyard: {
		id: "junkyard",
		name: "JUNKYARD",
		subtitle: "SCRAP METAL GRAVEYARD",
		accentColor: "#78716c",
		bgColor: "#0c0a08",
		ringOutEnabled: true,
		boundaryX: Infinity,
		boundaryZ: Infinity,
		levels: [{
			floorY: 0,
			boundaryX: Infinity,
			boundaryZ: Infinity,
			hazardDamagePerSec: 0,
			label: "JUNK PILE"
		}, {
			floorY: -3,
			boundaryX: Infinity,
			boundaryZ: Infinity,
			hazardDamagePerSec: 0,
			label: "LOWER YARD"
		}],
		breakableFloor: true,
		floorBreakThreshold: 55,
		ambientIntensity: .15,
		ambientColor: "#1c1a18",
		primaryLightColor: "#d6d3d1",
		fillLightColor: "#44403c",
		bgmTrack: "junkyard",
		hazardDamagePerSec: 0,
		hazardLabel: "",
		hasWalls: false,
		hasDestructibleWalls: false,
		hazardVolume: void 0,
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	sky_crane: {
		id: "sky_crane",
		name: "SKY CRANE",
		subtitle: "HIGH ALTITUDE PLATFORM",
		accentColor: "#38bdf8",
		bgColor: "#00080f",
		ringOutEnabled: true,
		boundaryX: 3,
		boundaryZ: 2.5,
		levels: [{
			floorY: 0,
			boundaryX: 3,
			boundaryZ: 2.5,
			hazardDamagePerSec: 0,
			label: "CRANE TOP"
		}, {
			floorY: -6,
			boundaryX: 4,
			boundaryZ: 3.5,
			hazardDamagePerSec: 0,
			label: "LOWER PLATFORM"
		}],
		breakableFloor: true,
		floorBreakThreshold: 45,
		ambientIntensity: .4,
		ambientColor: "#082f49",
		primaryLightColor: "#7dd3fc",
		fillLightColor: "#0c4a6e",
		bgmTrack: "sky_crane",
		hazardDamagePerSec: 0,
		hazardLabel: "",
		hasWalls: false,
		hasDestructibleWalls: false,
		hazardVolume: void 0,
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	spike_pit: {
		id: "spike_pit",
		name: "SPIKE PIT",
		subtitle: "MORTAL HAZARD",
		accentColor: "#dc2626",
		bgColor: "#0f0000",
		ringOutEnabled: false,
		boundaryX: 4.5,
		boundaryZ: 3,
		levels: [{
			floorY: 0,
			boundaryX: 4.5,
			boundaryZ: 3,
			hazardDamagePerSec: 0,
			label: "UPPER LEDGE"
		}, {
			floorY: -4,
			boundaryX: 4.5,
			boundaryZ: 3,
			hazardDamagePerSec: 30,
			label: "SPIKE PIT"
		}],
		breakableFloor: true,
		floorBreakThreshold: 40,
		ambientIntensity: .1,
		ambientColor: "#1a0000",
		primaryLightColor: "#ef4444",
		fillLightColor: "#7f1d1d",
		bgmTrack: "spike_pit",
		hazardDamagePerSec: 30,
		hazardLabel: "⚠ SPIKE PIT",
		hasWalls: true,
		hasDestructibleWalls: false,
		hazardVolume: void 0,
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	acid_pit: {
		id: "acid_pit",
		name: "ACID PIT",
		subtitle: "CORROSIVE DEPTHS",
		accentColor: "#a3e635",
		bgColor: "#030f00",
		ringOutEnabled: false,
		boundaryX: 4.5,
		boundaryZ: 3,
		levels: [{
			floorY: 0,
			boundaryX: 4.5,
			boundaryZ: 3,
			hazardDamagePerSec: 0,
			label: "BRIDGE"
		}, {
			floorY: -3.5,
			boundaryX: 4.5,
			boundaryZ: 3,
			hazardDamagePerSec: 25,
			label: "ACID POOL"
		}],
		breakableFloor: true,
		floorBreakThreshold: 40,
		ambientIntensity: .15,
		ambientColor: "#052e16",
		primaryLightColor: "#86efac",
		fillLightColor: "#14532d",
		bgmTrack: "acid_pit",
		hazardDamagePerSec: 25,
		hazardLabel: "☣ ACID PIT",
		hasWalls: true,
		hasDestructibleWalls: false,
		hazardVolume: void 0,
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	grinder_pit: {
		id: "grinder_pit",
		name: "GRINDER PIT",
		subtitle: "INDUSTRIAL DEATH TRAP",
		accentColor: "#f97316",
		bgColor: "#0f0500",
		ringOutEnabled: false,
		boundaryX: 4.5,
		boundaryZ: 3,
		levels: [{
			floorY: 0,
			boundaryX: 4.5,
			boundaryZ: 3,
			hazardDamagePerSec: 0,
			label: "CATWALK"
		}, {
			floorY: -4.5,
			boundaryX: 4.5,
			boundaryZ: 3,
			hazardDamagePerSec: 40,
			label: "GRINDER"
		}],
		breakableFloor: true,
		floorBreakThreshold: 35,
		ambientIntensity: .1,
		ambientColor: "#1c0a00",
		primaryLightColor: "#fb923c",
		fillLightColor: "#7c2d12",
		bgmTrack: "grinder_pit",
		hazardDamagePerSec: 40,
		hazardLabel: "⚙ GRINDER",
		hasWalls: true,
		hasDestructibleWalls: false,
		hazardVolume: void 0,
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	gang_brawl: {
		id: "gang_brawl",
		name: "GANG BRAWL",
		subtitle: "NO RULES — NO WALLS",
		accentColor: "#e879f9",
		bgColor: "#0f0014",
		ringOutEnabled: true,
		boundaryX: Infinity,
		boundaryZ: Infinity,
		levels: [{
			floorY: 0,
			boundaryX: Infinity,
			boundaryZ: Infinity,
			hazardDamagePerSec: 0,
			label: "STREET LEVEL"
		}, {
			floorY: -3,
			boundaryX: Infinity,
			boundaryZ: Infinity,
			hazardDamagePerSec: 0,
			label: "LOWER ALLEY"
		}],
		breakableFloor: true,
		floorBreakThreshold: 50,
		ambientIntensity: .2,
		ambientColor: "#1a0020",
		primaryLightColor: "#e879f9",
		fillLightColor: "#701a75",
		bgmTrack: "gang_brawl",
		hazardDamagePerSec: 0,
		hazardLabel: "",
		hasWalls: false,
		hasDestructibleWalls: false,
		hazardVolume: {
			triggerX: 8,
			chipDamage: .05,
			label: "CROWD SHOVE"
		},
		hasTrainHazard: false,
		edgeZoneDistance: 1.5
	},
	subway: {
		id: "subway",
		name: "SUBWAY",
		subtitle: "UNDERGROUND TRANSIT — WATCH THE TRACKS",
		accentColor: "#f59e0b",
		bgColor: "#0a0800",
		ringOutEnabled: false,
		boundaryX: 4.5,
		boundaryZ: 3,
		levels: [{
			floorY: 0,
			boundaryX: 4.5,
			boundaryZ: 3,
			hazardDamagePerSec: 0,
			label: "PLATFORM"
		}, {
			floorY: -1.5,
			boundaryX: 4.5,
			boundaryZ: 3,
			hazardDamagePerSec: 0,
			label: "TRACKS"
		}],
		breakableFloor: false,
		floorBreakThreshold: 0,
		ambientIntensity: .15,
		ambientColor: "#1a1200",
		primaryLightColor: "#fbbf24",
		fillLightColor: "#78350f",
		bgmTrack: "subway",
		hazardDamagePerSec: 0,
		hazardLabel: "🚇 TRAIN INCOMING",
		hasWalls: true,
		hasDestructibleWalls: false,
		hazardVolume: void 0,
		hasTrainHazard: true,
		edgeZoneDistance: 1.5
	}
};
/** Resolve a StageId (including 'random') to a concrete StageConfig */
function resolveStageConfig(id) {
	if (id === "random") {
		const real = Object.keys(STAGE_CONFIGS).filter((k) => k !== "random");
		return STAGE_CONFIGS[real[Math.floor(Math.random() * real.length)]];
	}
	return STAGE_CONFIGS[id] ?? STAGE_CONFIGS["urban_night"];
}
function createArenaCombatState(stageId) {
	return {
		stageId,
		config: resolveStageConfig(stageId),
		p1LevelIndex: 0,
		p2LevelIndex: 0,
		p1InHazard: false,
		p2InHazard: false,
		p1RingOut: false,
		p2RingOut: false,
		p1FloorBreakPending: false,
		p2FloorBreakPending: false
	};
}
/**
* Tick arena state — call once per combat frame.
* Returns updated state (pure function, no mutation).
*/
function tickArenaState(prev, p1X, p2X, p1HitDamage, p2HitDamage, p1Slammed, p2Slammed) {
	const cfg = prev.config;
	let next = { ...prev };
	if (cfg.ringOutEnabled && isFinite(cfg.boundaryX)) {
		if (!next.p1RingOut && Math.abs(p1X) > cfg.boundaryX) next.p1RingOut = true;
		if (!next.p2RingOut && Math.abs(p2X) > cfg.boundaryX) next.p2RingOut = true;
	}
	if (cfg.breakableFloor) {
		const maxLevel = cfg.levels.length - 1;
		if (p1Slammed && p1HitDamage >= cfg.floorBreakThreshold && next.p1LevelIndex < maxLevel) {
			next.p1FloorBreakPending = true;
			next.p1LevelIndex = next.p1LevelIndex + 1;
		}
		if (p2Slammed && p2HitDamage >= cfg.floorBreakThreshold && next.p2LevelIndex < maxLevel) {
			next.p2FloorBreakPending = true;
			next.p2LevelIndex = next.p2LevelIndex + 1;
		}
	}
	const p1Level = cfg.levels[next.p1LevelIndex];
	const p2Level = cfg.levels[next.p2LevelIndex];
	next.p1InHazard = (p1Level?.hazardDamagePerSec ?? 0) > 0;
	next.p2InHazard = (p2Level?.hazardDamagePerSec ?? 0) > 0;
	return next;
}
//#endregion
export { tickArenaState as i, createArenaCombatState as n, resolveStageConfig as r, STAGE_CONFIGS as t };
