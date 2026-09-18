import { a as __toESM } from "../_runtime.mjs";
import { i as getGlbEntryForFighter, n as BANNON_MODELS_RAW, o as resolveGlbUrl, t as BANNON_GLB_PLAYABLE_MODELS } from "./bannonGlbRoster-Th39Z2sz.mjs";
import { _ as Cache, c as require_jsx_runtime, l as require_react } from "../_libs/@react-three/drei+[...].mjs";
import { n as GLTFLoader, t as MeshoptDecoder } from "../_libs/three.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DbIfrPB2.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var CANON_PRONOUNS = {
	bannon: "he/him",
	maime: "he/him",
	cain_elias: "he/him",
	finxsse: "he/him",
	stick_up: "he/him",
	cody: "he/him",
	edwin_kennedy: "he/him",
	stan_combs: "he/him",
	pablo: "he/him",
	master_sensei: "he/him",
	jager: "he/him",
	wreck_patterson: "he/him",
	brutus: "he/him",
	titan: "he/him",
	tarzanian_devil: "he/him",
	hall_nighter: "he/him",
	aaron_ruben: "he/him",
	el_toro_de_oro: "he/him",
	triple_xxx: "he/him",
	tyneshia: "she/her"
};
function pronounsForFighter(id) {
	return CANON_PRONOUNS[id];
}
/**
* BANNON ROSTER — Full Character Profiles
* 
* Character data sourced from: github.com/mhvnsnt/Bannon
* "Off The Top Rope" cast and characters document.
* All characters, bios, personalities, and move sets are original Bannon IP.
* Used with owner permission.
* 
* Move set animation aliases reference:
*   - Schwarzerblitz open-source engine animations
*   - BrutalfistbaseofTekken3Recompiled animation namespace
*/
var BANNON_RAW = BANNON_MODELS_RAW;
var BANNON_ROSTER = [
	{
		id: "bannon",
		name: "Bannon",
		dna: "BANNON_V1_CORE",
		role: "Protagonist / Power Wrestler",
		faction: "AWE (Rebel)",
		factionAlignment: "alliance",
		poise: 95,
		hp: 1e4,
		speed: 85,
		strength: 90,
		physicsScale: 1.1,
		payback: "Beast Mode",
		manager: "None",
		bio: "The physical nucleus and absolute force of the Bannon Engine. A redeemed anti-hero who found true loyalty after shedding control. Fights to prove that authentic expression and loyalty are stronger than corporate control.",
		personality: "Quiet, intensely focused on philosophy and numerology. Seeks authentic emotional connection. Hates pretense. Driven artist who views every match as a statement.",
		fightingStyle: "Power Wrestling / Technical Hybrid. Explosive grapples, heavy strikes, and high-impact throws. Payback finisher activates when poise is broken.",
		model: "BANNON_rigged.glb",
		portraitUrl: `${BANNON_RAW}/BANNON_rigged.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_cross",
			lowKick: "bf_low_kick",
			highKick: "bf_high_kick",
			primaryCombo: "bf_jab_cross_hook",
			counter: "bf_reversal",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_powerbomb",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_beast_mode",
			extraMove1: "bf_uppercut",
			extraMove2: "bf_body_slam"
		}
	},
	{
		id: "maime",
		name: "Maime",
		dna: "MAIME",
		role: "Technical Striker",
		faction: "AWE",
		factionAlignment: "alliance",
		poise: 85,
		hp: 1e4,
		speed: 90,
		strength: 78,
		physicsScale: 1,
		payback: "Precision Protocol",
		manager: "None",
		bio: "A precise, technically gifted fighter whose speed and accuracy make him a constant threat. He fights with calculated efficiency, never wasting a movement.",
		personality: "Methodical and focused. Speaks little but observes everything. Finds beauty in perfect technique.",
		fightingStyle: "Technical Striking / Speed. Fast combos, precise counters, and quick throws. Excels at punishing mistakes.",
		model: "MAIME_skinned.glb",
		pronouns: "he/him",
		portraitUrl: `${BANNON_RAW}/MAIME_skinned.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_elbow",
			lowKick: "bf_low_kick",
			highKick: "bf_mid_kick",
			primaryCombo: "bf_jab_cross",
			counter: "bf_mars_counter",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_exploder",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_maime_driver",
			extraMove1: "bf_spin_kick",
			extraMove2: "bf_armor_breaker"
		}
	},
	{
		id: "onyx",
		name: "Onyx",
		dna: "ONYX",
		role: "Power Brawler",
		faction: "AWE",
		factionAlignment: "alliance",
		poise: 90,
		hp: 1e4,
		speed: 88,
		strength: 86,
		physicsScale: 1,
		payback: "Onyx Crush",
		manager: "None",
		bio: "A relentless power brawler whose raw physical presence dominates the ring. Onyx fights with crushing force and an iron will that refuses to break.",
		personality: "Stoic and determined. Speaks through actions, not words. Deeply loyal to those who earn it.",
		fightingStyle: "Power Brawler. Heavy strikes, crushing throws, and endurance-based combat. Wears opponents down before finishing them.",
		model: "ONYX_street.glb",
		portraitUrl: `${BANNON_RAW}/ONYX_street.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_chop",
			heavyAttack: "bf_hook",
			lowKick: "bf_low_kick",
			highKick: "bf_high_kick",
			primaryCombo: "bf_rush_combo",
			counter: "bf_armor_breaker",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_body_slam",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_onyx_crush",
			extraMove1: "bf_uppercut",
			extraMove2: "bf_dvd"
		}
	},
	{
		id: "cain_elias",
		name: "Cain Elias",
		dna: "CAIN_ELIAS",
		role: "Ultimate Enforcer / Technical Power",
		faction: "Corporate Structure (Former AWE Enforcer)",
		factionAlignment: "corporate",
		poise: 92,
		hp: 1e4,
		speed: 84,
		strength: 91,
		physicsScale: 1.05,
		payback: "Final Verdict",
		manager: "Edwin J. Kennedy",
		bio: "Kennedy's most trusted, cold-hearted weapon. A technical powerhouse driven by vindictive precision. His LP 6 responsibility manifests as a twisted need to enforce order through pain.",
		personality: "Cold and calculating in the ring. Outside it, he anonymously volunteers at community centers — a deep contradiction between his brutal role and his private need to nurture order.",
		fightingStyle: "Technical Power / Vindictive. Combines submission holds with devastating power moves. Methodical destruction followed by the Final Verdict tombstone piledriver.",
		model: "CAIN_ELIAS_ring.glb",
		attire: "Ring",
		portraitUrl: `${BANNON_RAW}/CAIN_ELIAS_ring.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_elbow",
			heavyAttack: "bf_uppercut",
			lowKick: "bf_low_kick",
			highKick: "bf_mid_kick",
			primaryCombo: "bf_jab_cross",
			counter: "bf_reversal",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_suplex",
			knockdown: "bf_hard_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_final_verdict",
			extraMove1: "bf_full_nelson",
			extraMove2: "bf_brainbuster"
		}
	},
	{
		id: "stick_up",
		name: "Stick-Up",
		dna: "STICKUP",
		role: "The Weapon / System's Optimized Asset",
		faction: "JPCW / Corporate Conspiracy",
		factionAlignment: "corporate",
		poise: 85,
		hp: 1e4,
		speed: 87,
		strength: 82,
		physicsScale: 1,
		payback: "Optimization Drive",
		manager: "Stan 'Honey' Combs",
		bio: "A soul driven to be a Master Builder (LP 11), whose energy is now forced into Stan's rigid physical construction. Fights with machine-like precision, punctuated by conspiracy rants.",
		personality: "Naturally seeks balance and harmony (Libra), but this need is brutally suppressed by the system. Robotic in movement, theatrical in finishers.",
		fightingStyle: "Technical/Brutal Hybrid. Machine-like precision strikes and submissions, with theatrical high-flying finishers. The Leap of Faith (swanton bomb) is his calling card.",
		model: "STICKUP.glb",
		portraitUrl: `${BANNON_RAW}/STICKUP.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_cross",
			lowKick: "bf_low_kick",
			highKick: "bf_spinning_kick",
			primaryCombo: "bf_kickbox_combo",
			counter: "bf_armor_breaker",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_exploder",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup_kick",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_leap_of_faith",
			extraMove1: "bf_cobra_clutch",
			extraMove2: "bf_iron_palm"
		}
	},
	{
		id: "cipher",
		name: "Cipher",
		dna: "CIPHER",
		role: "Agile Disruptor / Speed Fighter",
		faction: "AWE (Rebel)",
		factionAlignment: "alliance",
		poise: 88,
		hp: 1e4,
		speed: 93,
		strength: 80,
		physicsScale: 1,
		payback: "Cipher Protocol",
		manager: "None",
		bio: "A lightning-fast fighter who uses blistering pace and agility to break down opponents. Cipher operates in the shadows, striking from unexpected angles.",
		personality: "Mysterious and calculating. Speaks in riddles. Finds the gaps in every defense and exploits them with surgical precision.",
		fightingStyle: "Speed / Agility. Rapid multi-hit combos, quick counters, and evasive movement. The Cipher Protocol finisher is a rapid multi-hit strike sequence.",
		model: "CIPHER_feral.glb",
		portraitUrl: `${BANNON_RAW}/CIPHER_feral.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_elbow",
			lowKick: "bf_low_kick",
			highKick: "bf_spinning_kick",
			primaryCombo: "bf_rush_combo",
			counter: "bf_mars_counter",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_exploder",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup_kick",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_cipher_strike",
			extraMove1: "bf_shining_wizard",
			extraMove2: "bf_dragon_screw"
		}
	},
	{
		id: "echo",
		name: "Echo",
		dna: "ECHO",
		role: "Psychological Threat / Aerial",
		faction: "AWE (Rebel)",
		factionAlignment: "alliance",
		poise: 86,
		hp: 1e4,
		speed: 91,
		strength: 79,
		physicsScale: 1,
		payback: "Echo Slam",
		manager: "None",
		bio: "A mysterious fighter who uses misdirection and psychological games to unsettle opponents. Echo attacks from unexpected angles and uses rapid counter-strikes to punish overconfidence.",
		personality: "Quiet and unsettling. Moves like a ghost. Uses silence as a weapon.",
		fightingStyle: "Psychological / Aerial. Misdirection, rapid dodges, and unexpected aerial attacks. The Echo Slam reverberates through the opponent.",
		model: "ECHO.glb",
		portraitUrl: `${BANNON_RAW}/ECHO.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_hook",
			lowKick: "bf_dragon_screw",
			highKick: "bf_shining_wizard",
			primaryCombo: "bf_jab_cross",
			counter: "bf_reversal",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_body_slam",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_echo_slam",
			extraMove1: "bf_cobra_clutch",
			extraMove2: "bf_spin_kick"
		}
	},
	{
		id: "cody",
		name: "Cody",
		dna: "CODY",
		role: "Toxic Pawn / Former Manager",
		faction: "Corporate Structure (Kennedy/Combs)",
		factionAlignment: "corporate",
		poise: 84,
		hp: 1e4,
		speed: 86,
		strength: 83,
		physicsScale: 1,
		payback: "Cody Buster",
		manager: "Edwin J. Kennedy",
		bio: "Bannon's former manager, now Kennedy's bodyguard. A volatile cocktail of paranoid intensity and explosive impulse.",
		personality: "Volatile and paranoid. Sprints everywhere, shouts contracts and statistics. Wears immaculate, expensive designer clothes.",
		fightingStyle: "Brawler / Interference. Dirty tactics, rope breaks, and managerial interference. When forced to fight, uses explosive power moves.",
		model: "CODY_sober.glb",
		attire: "Sober",
		portraitUrl: `${BANNON_RAW}/CODY_sober.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_hook",
			lowKick: "bf_low_kick",
			highKick: "bf_mid_kick",
			primaryCombo: "bf_jab_cross_hook",
			counter: "bf_armor_breaker",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_body_slam",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_cody_buster",
			extraMove1: "bf_uppercut",
			extraMove2: "bf_suplex"
		}
	},
	{
		id: "hall_nighter",
		name: "Hall Nighter",
		dna: "HALL_NIGHTER",
		role: "Powerhouse Enforcer",
		faction: "AWE Asset",
		factionAlignment: "corporate",
		poise: 90,
		hp: 1e4,
		speed: 82,
		strength: 88,
		physicsScale: 1,
		payback: "Hall Night Driver",
		manager: "None",
		bio: "A rugged veteran powerhouse built on toughness and sheer physical durability. Hall Nighter represents the old guard — a physical wall that absorbs massive damage and delivers crushing impact.",
		personality: "Aggressive and territorial. Demands adoration. Stomps everywhere in heavy boots.",
		fightingStyle: "Power Brawler / Endurance. Absorbs damage and delivers crushing impact. The Hall Night Driver is a devastating late-night finisher.",
		model: "HALL_NIGHTER.glb",
		portraitUrl: `${BANNON_RAW}/HALL_NIGHTER.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_chop",
			heavyAttack: "bf_discus_clothesline",
			lowKick: "bf_low_kick",
			highKick: "bf_high_kick",
			primaryCombo: "bf_rush_combo",
			counter: "bf_armor_breaker",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_running_powerbomb",
			knockdown: "bf_hard_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_heavy_hit_reaction",
			ko: "bf_ko",
			signature: "bf_hall_nighter_driver",
			extraMove1: "bf_dvd",
			extraMove2: "bf_brainbuster"
		}
	},
	{
		id: "static",
		name: "Static",
		dna: "STATIC",
		role: "Electric Striker / Speed Brawler",
		faction: "AWE Asset",
		factionAlignment: "chaos",
		poise: 87,
		hp: 1e4,
		speed: 89,
		strength: 84,
		physicsScale: 1,
		payback: "Static Shock",
		manager: "None",
		bio: "An unpredictable electric striker whose chaotic energy keeps opponents off-balance. Static fights with reckless abandon, generating momentum through pure kinetic chaos.",
		personality: "Manic and energetic. Never stops moving. Talks constantly during matches.",
		fightingStyle: "Electric Striker / Speed Brawler. Rapid-fire strikes, spinning attacks, and chaotic combos. The Static Shock finisher is an electric rush combo.",
		model: "STATIC.glb",
		portraitUrl: `${BANNON_RAW}/STATIC.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_spinning_kick",
			lowKick: "bf_low_kick",
			highKick: "bf_shining_wizard",
			primaryCombo: "bf_kickbox_combo",
			counter: "bf_mars_counter",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_exploder",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup_kick",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_static_shock",
			extraMove1: "bf_rush_combo",
			extraMove2: "bf_dragon_screw"
		}
	},
	{
		id: "viper",
		name: "Viper",
		dna: "VIPER",
		role: "Assassin / Strike Specialist",
		faction: "Independent",
		factionAlignment: "independent",
		poise: 83,
		hp: 1e4,
		speed: 92,
		strength: 81,
		physicsScale: 1,
		payback: "Viper Strike",
		manager: "None",
		bio: "A deadly assassin who strikes with lethal precision. Viper moves with serpentine grace, delivering venomous attacks that leave opponents reeling.",
		personality: "Cold and calculating. Patient as a predator. Strikes only when the moment is perfect.",
		fightingStyle: "Assassin / Precision Striker. Lightning-fast strikes, evasive movement, and lethal counters. The Viper Strike is a devastating finishing sequence.",
		model: "VIPER.glb",
		portraitUrl: `${BANNON_RAW}/VIPER.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_elbow",
			lowKick: "bf_low_kick",
			highKick: "bf_spinning_kick",
			primaryCombo: "bf_rush_combo",
			counter: "bf_mars_counter",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_exploder",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup_kick",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_viper_strike",
			extraMove1: "bf_cobra_clutch",
			extraMove2: "bf_iron_palm"
		}
	},
	{
		id: "kobra",
		name: "Kobra",
		dna: "KOBRA",
		role: "Street Fighter / Chaos Agent",
		faction: "Chaos",
		factionAlignment: "chaos",
		poise: 86,
		hp: 1e4,
		speed: 88,
		strength: 85,
		physicsScale: 1,
		payback: "Kobra Kai",
		manager: "None",
		bio: "A street-hardened chaos agent who thrives in unpredictable situations. Kobra uses dirty tactics and raw aggression to overwhelm opponents.",
		personality: "Unpredictable and volatile. Thrives on chaos. Laughs during combat.",
		fightingStyle: "Street Fighter / Chaos. Dirty tactics, unpredictable combos, and raw aggression. The Kobra Kai finisher is a brutal street-style beatdown.",
		model: "KOBRA.glb",
		portraitUrl: `${BANNON_RAW}/KOBRA.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_hook",
			lowKick: "bf_low_kick",
			highKick: "bf_high_kick",
			primaryCombo: "bf_jab_cross_hook",
			counter: "bf_reversal",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_body_slam",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_kobra_kai",
			extraMove1: "bf_uppercut",
			extraMove2: "bf_spin_kick"
		}
	},
	{
		id: "aaron_ruben",
		name: "Aaron Ruben",
		dna: "AARON_RUBEN",
		role: "Technical Grappler / Ring General",
		faction: "AWE",
		factionAlignment: "alliance",
		poise: 89,
		hp: 1e4,
		speed: 83,
		strength: 87,
		physicsScale: 1,
		payback: "Ruben Lock",
		manager: "None",
		bio: "A ring general whose technical mastery and grappling expertise make him one of the most dangerous fighters in AWE. Aaron Ruben controls every match with surgical precision.",
		personality: "Composed and analytical. Studies opponents obsessively. Speaks with quiet authority.",
		fightingStyle: "Technical Grappler / Ring General. Submission holds, precise strikes, and ring control. The Ruben Lock submission is nearly impossible to escape.",
		model: "AARON_RUBEN.glb",
		portraitUrl: `${BANNON_RAW}/AARON_RUBEN.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_elbow",
			lowKick: "bf_low_kick",
			highKick: "bf_mid_kick",
			primaryCombo: "bf_jab_cross",
			counter: "bf_reversal",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_suplex",
			knockdown: "bf_hard_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_ruben_lock",
			extraMove1: "bf_full_nelson",
			extraMove2: "bf_brainbuster"
		}
	},
	{
		id: "hollow",
		name: "Hollow",
		dna: "HOLLOW",
		role: "Phantom / Psychological Warfare",
		faction: "Chaos",
		factionAlignment: "chaos",
		poise: 84,
		hp: 1e4,
		speed: 90,
		strength: 80,
		physicsScale: 1,
		payback: "Hollow Point",
		manager: "None",
		bio: "A phantom-like fighter who uses psychological warfare and unpredictable movement to break opponents mentally before finishing them physically.",
		personality: "Eerie and detached. Seems to feel no pain. Stares through opponents rather than at them.",
		fightingStyle: "Phantom / Psychological. Unpredictable movement, mind games, and sudden explosive attacks. The Hollow Point finisher comes from nowhere.",
		model: "HOLLOW.glb",
		portraitUrl: `${BANNON_RAW}/HOLLOW.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_cross",
			lowKick: "bf_low_kick",
			highKick: "bf_shining_wizard",
			primaryCombo: "bf_rush_combo",
			counter: "bf_mars_counter",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_exploder",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup_kick",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_hollow_point",
			extraMove1: "bf_spin_kick",
			extraMove2: "bf_dragon_screw"
		}
	},
	{
		id: "edwin_kennedy",
		name: "Edwin Kennedy",
		dna: "EDWIN_KENNEDY",
		role: "Corporate Mastermind / Power Broker",
		faction: "Corporate Structure",
		factionAlignment: "corporate",
		poise: 88,
		hp: 1e4,
		speed: 80,
		strength: 89,
		physicsScale: 1.05,
		payback: "Corporate Takeover",
		manager: "None",
		bio: "The architect of corporate control in AWE. Edwin Kennedy pulls strings from the shadows, but when forced into the ring, he's a devastating physical specimen who fights with calculated brutality.",
		personality: "Imperious and manipulative. Treats everyone as assets or liabilities. Immaculate in appearance, ruthless in action.",
		fightingStyle: "Corporate Power / Calculated Brutality. Deliberate, powerful strikes and throws. The Corporate Takeover is a devastating power slam sequence.",
		model: "EDWIN_KENNEDY.glb",
		attire: "Mustached Mogul",
		portraitUrl: `${BANNON_RAW}/EDWIN_KENNEDY.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_elbow",
			heavyAttack: "bf_hook",
			lowKick: "bf_low_kick",
			highKick: "bf_mid_kick",
			primaryCombo: "bf_jab_cross_hook",
			counter: "bf_armor_breaker",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_running_powerbomb",
			knockdown: "bf_hard_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_heavy_hit_reaction",
			ko: "bf_ko",
			signature: "bf_corporate_takeover",
			extraMove1: "bf_powerbomb",
			extraMove2: "bf_brainbuster"
		}
	},
	{
		id: "pablo",
		name: "Pablo",
		dna: "PABLO",
		role: "Mythic Powerhouse / Bull of the Ring",
		faction: "Independent",
		factionAlignment: "independent",
		poise: 93,
		hp: 1e4,
		speed: 81,
		strength: 94,
		physicsScale: 1.1,
		payback: "Bull Rush",
		manager: "None",
		bio: "A mythic powerhouse who channels the spirit of the bull. Pablo is an unstoppable force of nature whose raw power and resilience make him one of the most feared fighters in the roster.",
		personality: "Proud and fierce. Fights with the fury of a charging bull. Deeply connected to his cultural heritage.",
		fightingStyle: "Mythic Power / Bull Rush. Charging attacks, devastating throws, and raw physical dominance. The Bull Rush finisher is an unstoppable charge.",
		model: "PABLO.glb",
		attire: "Minotaur Painted",
		portraitUrl: `${BANNON_RAW}/PABLO.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_chop",
			heavyAttack: "bf_discus_clothesline",
			lowKick: "bf_low_kick",
			highKick: "bf_high_kick",
			primaryCombo: "bf_rush_combo",
			counter: "bf_armor_breaker",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_running_powerbomb",
			knockdown: "bf_hard_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_heavy_hit_reaction",
			ko: "bf_ko",
			signature: "bf_bull_rush",
			extraMove1: "bf_powerbomb",
			extraMove2: "bf_body_slam"
		}
	},
	{
		id: "tyneshia",
		name: "Tyneshia",
		dna: "TYNESHIA",
		role: "Street Queen / Technical Brawler",
		faction: "AWE (Rebel)",
		factionAlignment: "alliance",
		poise: 87,
		hp: 1e4,
		speed: 88,
		strength: 85,
		physicsScale: 1,
		payback: "Hall Street Justice",
		manager: "None",
		bio: "A street queen who brings raw Hall Street energy into the ring. Tyneshia combines technical skill with street-smart brawling to dominate opponents.",
		personality: "Fierce and unapologetic. Speaks her mind. Deeply loyal to her community.",
		fightingStyle: "Street Queen / Technical Brawler. Street-smart combos, technical counters, and raw power. Hall Street Justice is her devastating finishing sequence.",
		model: "TYNESHIA.glb",
		attire: "Wrestling Gear",
		portraitUrl: `${BANNON_RAW}/TYNESHIA.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_hook",
			lowKick: "bf_low_kick",
			highKick: "bf_spinning_kick",
			primaryCombo: "bf_kickbox_combo",
			counter: "bf_mars_counter",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_exploder",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup_kick",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_hall_street_justice",
			extraMove1: "bf_spin_kick",
			extraMove2: "bf_dvd"
		}
	},
	{
		id: "triple_xxx",
		name: "Triple XXX",
		dna: "TRIPLE_XXX",
		role: "Showman / High-Flying Entertainer",
		faction: "Corporate Structure",
		factionAlignment: "corporate",
		poise: 85,
		hp: 1e4,
		speed: 90,
		strength: 83,
		physicsScale: 1,
		payback: "Triple Threat",
		manager: "None",
		bio: "A flamboyant showman who combines high-flying athleticism with corporate polish. Triple XXX puts on a show while delivering devastating attacks.",
		personality: "Theatrical and self-absorbed. Every move is a performance. Demands the spotlight.",
		fightingStyle: "Showman / High-Flying. Aerial attacks, theatrical combos, and crowd-pleasing finishers. The Triple Threat is a three-part aerial assault.",
		model: "TRIPLE_XXX.glb",
		attire: "Default",
		portraitUrl: `${BANNON_RAW}/TRIPLE_XXX.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_elbow",
			lowKick: "bf_low_kick",
			highKick: "bf_shining_wizard",
			primaryCombo: "bf_rush_combo",
			counter: "bf_reversal",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_exploder",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup_kick",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_triple_threat",
			extraMove1: "bf_leap_of_faith",
			extraMove2: "bf_spin_kick"
		}
	},
	{
		id: "el_toro_de_oro",
		name: "El Toro de Oro",
		dna: "EL_TORO_DE_ORO",
		role: "Luchador / Golden Bull",
		faction: "Independent",
		factionAlignment: "independent",
		poise: 91,
		hp: 1e4,
		speed: 86,
		strength: 90,
		physicsScale: 1.05,
		payback: "Golden Goring",
		manager: "None",
		bio: "The Golden Bull of the ring. El Toro de Oro combines luchador athleticism with raw power, delivering spectacular aerial attacks and crushing power moves.",
		personality: "Proud and honorable. Fights with passion and flair. Deeply respected by the crowd.",
		fightingStyle: "Luchador / Power. Aerial attacks, power slams, and spectacular finishers. The Golden Goring is a devastating charging attack.",
		model: "EL_TORO_DE_ORO.glb",
		portraitUrl: `${BANNON_RAW}/EL_TORO_DE_ORO.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_chop",
			heavyAttack: "bf_discus_clothesline",
			lowKick: "bf_low_kick",
			highKick: "bf_shining_wizard",
			primaryCombo: "bf_rush_combo",
			counter: "bf_armor_breaker",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_running_powerbomb",
			knockdown: "bf_hard_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_heavy_hit_reaction",
			ko: "bf_ko",
			signature: "bf_golden_goring",
			extraMove1: "bf_body_slam",
			extraMove2: "bf_powerbomb"
		}
	},
	{
		id: "stan_combs",
		name: "Stan Combs",
		dna: "STAN_COMBS",
		role: "Corporate Architect / Manager Fighter",
		faction: "JPCW / Corporate Conspiracy",
		factionAlignment: "corporate",
		poise: 82,
		hp: 1e4,
		speed: 79,
		strength: 86,
		physicsScale: 1,
		payback: "Honey Trap",
		manager: "None",
		bio: "The architect behind the corporate conspiracy. Stan 'Honey' Combs built the system that controls fighters like Stick-Up. When cornered, he fights with surprising ferocity.",
		personality: "Smooth and manipulative. Always smiling. Hides ruthless calculation behind corporate charm.",
		fightingStyle: "Corporate Architect / Dirty Fighter. Underhanded tactics, calculated strikes, and corporate-funded dirty moves. The Honey Trap is a deceptive finishing sequence.",
		model: "STAN_COMBS_gear.glb",
		attire: "Ring Gear",
		portraitUrl: `${BANNON_RAW}/STAN_COMBS_gear.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_hook",
			lowKick: "bf_low_kick",
			highKick: "bf_mid_kick",
			primaryCombo: "bf_jab_cross",
			counter: "bf_reversal",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_body_slam",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_honey_trap",
			extraMove1: "bf_cobra_clutch",
			extraMove2: "bf_iron_palm"
		}
	},
	{
		id: "brutus",
		name: "Brutus",
		dna: "BRUTUS",
		role: "Unstoppable Juggernaut",
		faction: "Independent",
		factionAlignment: "independent",
		poise: 96,
		hp: 1e4,
		speed: 78,
		strength: 96,
		physicsScale: 1.15,
		payback: "Brutus Bomb",
		manager: "None",
		bio: "An unstoppable juggernaut whose sheer size and power make him a walking natural disaster. Brutus absorbs punishment that would destroy lesser fighters and keeps coming.",
		personality: "Simple and direct. Speaks in short sentences. Respects strength above all else.",
		fightingStyle: "Juggernaut / Pure Power. Overwhelming force, crushing throws, and unstoppable charges. The Brutus Bomb is a devastating finishing slam.",
		model: "BRUTUS.glb",
		portraitUrl: `${BANNON_RAW}/BRUTUS.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_chop",
			heavyAttack: "bf_discus_clothesline",
			lowKick: "bf_low_kick",
			highKick: "bf_high_kick",
			primaryCombo: "bf_rush_combo",
			counter: "bf_armor_breaker",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_running_powerbomb",
			knockdown: "bf_hard_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_heavy_hit_reaction",
			ko: "bf_ko",
			signature: "bf_brutus_bomb",
			extraMove1: "bf_powerbomb",
			extraMove2: "bf_body_slam"
		}
	},
	{
		id: "titan",
		name: "Titan",
		dna: "TITAN",
		role: "Colossus / Immovable Object",
		faction: "Independent",
		factionAlignment: "independent",
		poise: 97,
		hp: 1e4,
		speed: 76,
		strength: 97,
		physicsScale: 1.2,
		payback: "Titan Fall",
		manager: "None",
		bio: "The immovable object of the roster. Titan is a colossus whose presence alone intimidates opponents. When he falls, the ring shakes.",
		personality: "Silent and imposing. Communicates through action. Opponents feel his presence before they see him.",
		fightingStyle: "Colossus / Immovable. Slow but devastating attacks, unbreakable defense, and earth-shaking throws. The Titan Fall is a finishing slam that ends matches.",
		model: "TITAN.glb",
		portraitUrl: `${BANNON_RAW}/TITAN.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_chop",
			heavyAttack: "bf_hook",
			lowKick: "bf_low_kick",
			highKick: "bf_high_kick",
			primaryCombo: "bf_rush_combo",
			counter: "bf_armor_breaker",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_running_powerbomb",
			knockdown: "bf_hard_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_heavy_hit_reaction",
			ko: "bf_ko",
			signature: "bf_titan_fall",
			extraMove1: "bf_powerbomb",
			extraMove2: "bf_brainbuster"
		}
	},
	{
		id: "master_sensei",
		name: "Master Sensei",
		dna: "MASTER_SENSEI",
		role: "Martial Arts Master / Discipline Incarnate",
		faction: "Independent",
		factionAlignment: "independent",
		poise: 91,
		hp: 1e4,
		speed: 87,
		strength: 88,
		physicsScale: 1,
		payback: "Five Point Palm",
		manager: "None",
		bio: "A martial arts master whose decades of discipline have forged him into a perfect fighting instrument. Master Sensei fights with economy and precision, never wasting a movement.",
		personality: "Serene and wise. Speaks in lessons. Sees every fight as an opportunity to teach.",
		fightingStyle: "Martial Arts Master / Precision. Perfect technique, devastating counters, and disciplined strikes. The Five Point Palm is a legendary finishing technique.",
		model: "MASTER_SENSEI.glb",
		portraitUrl: `${BANNON_RAW}/MASTER_SENSEI.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_elbow",
			lowKick: "bf_low_kick",
			highKick: "bf_spinning_kick",
			primaryCombo: "bf_kickbox_combo",
			counter: "bf_mars_counter",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_suplex",
			knockdown: "bf_hard_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_five_point_palm",
			extraMove1: "bf_iron_palm",
			extraMove2: "bf_cobra_clutch"
		}
	},
	{
		id: "wreck_patterson",
		name: "Wreck Patterson",
		dna: "WRECK_PATTERSON",
		role: "Wrecking Machine / Demolition Expert",
		faction: "Independent",
		factionAlignment: "independent",
		poise: 93,
		hp: 1e4,
		speed: 82,
		strength: 93,
		physicsScale: 1.1,
		payback: "Wreck Ball",
		manager: "None",
		bio: "A wrecking machine who dismantles opponents piece by piece. Wreck Patterson fights with the methodical destruction of a demolition crew — nothing is left standing.",
		personality: "Methodical and relentless. Treats every fight like a job. Takes pride in thorough destruction.",
		fightingStyle: "Wrecking Machine / Demolition. Systematic destruction, power throws, and relentless pressure. The Wreck Ball is a devastating finishing slam.",
		model: "WRECK_PATTERSON.glb",
		portraitUrl: `${BANNON_RAW}/WRECK_PATTERSON.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_chop",
			heavyAttack: "bf_discus_clothesline",
			lowKick: "bf_low_kick",
			highKick: "bf_high_kick",
			primaryCombo: "bf_rush_combo",
			counter: "bf_armor_breaker",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_running_powerbomb",
			knockdown: "bf_hard_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_heavy_hit_reaction",
			ko: "bf_ko",
			signature: "bf_wreck_ball",
			extraMove1: "bf_powerbomb",
			extraMove2: "bf_dvd"
		}
	},
	{
		id: "jager",
		name: "Jager",
		dna: "JAGER",
		role: "Predator / Hunter",
		faction: "Independent",
		factionAlignment: "independent",
		poise: 90,
		hp: 1e4,
		speed: 89,
		strength: 88,
		physicsScale: 1,
		payback: "Jager Hunt",
		manager: "None",
		bio: "A relentless predator who hunts opponents with calculated aggression. Jager tracks weaknesses and exploits them with devastating precision.",
		personality: "Focused and relentless. Never loses sight of the target. Fights with the patience of a hunter.",
		fightingStyle: "Predator / Hunter. Patient stalking, explosive bursts, and devastating finishing sequences. The Jager Hunt is an unstoppable pursuit combo.",
		model: "JAGER.glb",
		attire: "Default",
		portraitUrl: `${BANNON_RAW}/JAGER.glb`,
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_cross",
			lowKick: "bf_low_kick",
			highKick: "bf_high_kick",
			primaryCombo: "bf_jab_cross_hook",
			counter: "bf_reversal",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_suplex",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_jager_hunt",
			extraMove1: "bf_uppercut",
			extraMove2: "bf_iron_palm"
		}
	},
	{
		id: "finxsse",
		name: "Finxsse",
		dna: "FINXSSE",
		role: "Showman / Power-Agility Hybrid",
		faction: "Street / Stick-Up Alliance",
		factionAlignment: "independent",
		poise: 88,
		hp: 1e4,
		speed: 91,
		strength: 89,
		physicsScale: 1.05,
		payback: "Getbackk",
		manager: "None",
		bio: "NPC Finxsse — pronounced N-P-C Finesse. A direct showman from the books who mixes Brock-Lesnar power with Eddie-Guerrero agility. He wears the gold jeweled diamond cross stolen from Chainlink, a symbol of his alliance with Stick-Up and his feud with Bannon, who he calls a corporate sell-out.",
		personality: "Good and direct. Rapper-style charisma, promo-heavy, never hides the grudge. Sees Bannon as a traitor and a snitch.",
		fightingStyle: "Power + speed hybrid. Signature Chainsnatcher (jumping double-knee backstabber). Finisher Getbackk — a violent fireman-carry tornado slam, a modified F-5.",
		model: "NPC_FINXSSE.glb",
		attire: "NPC",
		portraitUrl: `${BANNON_RAW}/NPC_FINXSSE.glb`,
		gridPortrait: "/portraits/finxsse.png",
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_jab",
			heavyAttack: "bf_cross",
			lowKick: "bf_low_kick",
			highKick: "bf_high_kick",
			primaryCombo: "bf_rush_combo",
			counter: "bf_reversal",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_suplex",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_getbackk",
			extraMove1: "bf_chainsnatcher",
			extraMove2: "bf_uppercut"
		}
	},
	{
		id: "tarzanian_devil",
		name: "Tarzanian Devil",
		dna: "TARZANIAN_DEVIL",
		role: "Wildman Luchador / Hardcore High Flyer",
		faction: "Independent",
		factionAlignment: "independent",
		poise: 86,
		hp: 1e4,
		speed: 92,
		strength: 84,
		physicsScale: 1,
		payback: "Jungle Bomb",
		manager: "None",
		bio: "The Tarzanian Devil is the roster's dirtbag luchador — a shirtless wildman who swings between high-flying lucha and hardcore brawling. Gold hoop, messy hair, Tarzan yell on the way in. Independent circuit energy, no faction leash.",
		personality: "Loose cannon. Hilarious, loud, lives on three things: wrestling, chaos, and the scream. Never more dangerous than when he looks like he is having fun.",
		fightingStyle: "Lucha libre / hardcore hybrid. Hurricanranas, springboards, and deathmatch grit. Finisher Jungle Bomb — a flying senton that ends with a wildman pin.",
		model: "TARZANIAN_DEVIL_skinned.glb",
		attire: "Default",
		portraitUrl: `${BANNON_RAW}/TARZANIAN_DEVIL_skinned.glb`,
		gridPortrait: "/portraits/tarzanian_devil.png",
		defaultMoveSet: {
			idle: "bf_idle",
			walkForward: "bf_walk_fwd",
			walkBackward: "bf_walk_back",
			crouch: "bf_crouch",
			guard: "bf_guard",
			lightAttack: "bf_chop",
			heavyAttack: "bf_cross",
			lowKick: "bf_low_kick",
			highKick: "bf_spin_kick",
			primaryCombo: "bf_rush_combo",
			counter: "bf_mars_counter",
			grappleInitiate: "bf_clinch",
			primaryThrow: "bf_exploder",
			knockdown: "bf_knockdown",
			wakeup: "bf_wakeup_kick",
			hitReaction: "bf_hit_reaction",
			ko: "bf_ko",
			signature: "bf_jungle_bomb",
			extraMove1: "bf_hurricanrana",
			extraMove2: "bf_shining_wizard"
		}
	}
];
var getBannonFighter = (id) => {
	const f = BANNON_ROSTER.find((x) => x.id === id);
	return f ? hydrateFighterGlb(f) : null;
};
var getAllBannonFighters = () => BANNON_ROSTER.map(hydrateFighterGlb);
/** Overlay the measured skinned GLB (and attire URL) onto a roster profile. */
function hydrateFighterGlb(fighter) {
	const conceptArtUrl = fighter.conceptArtUrl ?? `/portraits/concept/${fighter.id}.jpg?v=ai3`;
	const selectMugUrl = fighter.selectMugUrl ?? conceptArtUrl;
	const pixelPortrait = fighter.pixelPortrait ?? `/portraits/pixel/${fighter.id}.png`;
	const likenessUrl = fighter.likenessUrl ?? `/portraits/likeness/${fighter.id}.png?v=glb1`;
	const paintedUrl = fighter.paintedUrl ?? conceptArtUrl;
	const pronouns = fighter.pronouns ?? pronounsForFighter(fighter.id);
	const entry = getGlbEntryForFighter(fighter.id, fighter.model);
	if (!entry) return {
		...fighter,
		pronouns,
		gridPortrait: conceptArtUrl,
		conceptArtUrl,
		selectMugUrl,
		pixelPortrait,
		likenessUrl,
		paintedUrl
	};
	return {
		...fighter,
		pronouns,
		model: entry.model,
		attire: fighter.attire ?? entry.attire,
		portraitUrl: resolveGlbUrl(entry.model, entry.overrideUrl),
		gridPortrait: conceptArtUrl,
		conceptArtUrl,
		selectMugUrl,
		pixelPortrait,
		likenessUrl,
		paintedUrl
	};
}
var AuthContext = (0, import_react.createContext)(null);
var useAuth = () => {
	const context = (0, import_react.useContext)(AuthContext);
	if (!context) throw new Error("useAuth must be used within AuthProvider");
	return context;
};
var AuthProvider = ({ children }) => {
	const value = (0, import_react.useMemo)(() => ({
		user: null,
		session: null,
		loading: false,
		signIn: async () => ({ error: { message: "Local preview — ranked cloud is optional" } }),
		signUp: async () => ({ error: { message: "Local preview — ranked cloud is optional" } }),
		signOut: async () => {},
		getCurrentUser: async () => null
	}), []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthContext.Provider, {
		value,
		children
	});
};
Cache.enabled = true;
var loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
var inflight = /* @__PURE__ */ new Map();
/** Shared GLB fetch — second portrait / fight reuse the same parse. */
function loadGLTF(url) {
	const hit = inflight.get(url);
	if (hit) return hit;
	const p = new Promise((resolve, reject) => {
		loader.load(url, resolve, void 0, reject);
	});
	inflight.set(url, p);
	p.catch(() => inflight.delete(url));
	return p;
}
function warmupGLTF(url) {
	loadGLTF(url);
}
function warmupImages(urls) {
	if (typeof window === "undefined") return;
	for (const url of urls) {
		const img = new Image();
		img.decoding = "async";
		img.src = url;
	}
}
function dynamic(loader, opts) {
	const Comp = (0, import_react.lazy)(loader);
	const Fallback = opts?.loading;
	return function DynamicComp(props) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
			fallback: Fallback ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Fallback, {}) : null,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Comp, { ...props })
		});
	};
}
var AppScreen = {
	Boot: "Boot",
	Title: "Title",
	MainMenu: "MainMenu",
	Options: "Options",
	Select: "Select",
	VS: "VS",
	Combat: "Combat",
	PostMatch: "PostMatch"
};
var FighterState = {
	Neutral: "Neutral",
	Startup: "Startup",
	Active: "Active",
	Recovery: "Recovery",
	Hitstun: "Hitstun",
	Blockstun: "Blockstun",
	Grappled: "Grappled",
	Pinned: "Pinned",
	KO: "KO"
};
var DEFAULT_TOURNAMENT_SETTINGS = {
	difficulty: "normal",
	cameraFov: 55,
	cosmeticPreview: true,
	soundEnabled: true,
	musicEnabled: true
};
var DIFFICULTY_OPTIONS = [
	{
		value: "easy",
		label: "EASY",
		desc: "Reduced AI reaction speed, lower combo damage",
		color: "#22c55e"
	},
	{
		value: "normal",
		label: "NORMAL",
		desc: "Balanced AI — standard Schwarzerblitz behavior",
		color: "#facc15"
	},
	{
		value: "hard",
		label: "HARD",
		desc: "Aggressive AI with counter-hit reads",
		color: "#f97316"
	},
	{
		value: "brutal",
		label: "BRUTAL",
		desc: "Frame-perfect AI, full poise engine active",
		color: "#ef4444"
	}
];
var FOV_PRESETS = [
	45,
	55,
	65,
	75,
	85
];
function TournamentSettingsScreen$1({ onConfirm, onBack, initialSettings = DEFAULT_TOURNAMENT_SETTINGS }) {
	const [settings, setSettings] = (0, import_react.useState)(initialSettings);
	const [cosmeticTab, setCosmeticTab] = (0, import_react.useState)("bannon");
	const set = (key, val) => setSettings((prev) => ({
		...prev,
		[key]: val
	}));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 bg-[#0a0c12] text-white font-mono overflow-y-auto",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-2xl mx-auto px-4 py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[9px] tracking-[0.5em] text-zinc-500 mb-1",
							children: "PRE-TOURNAMENT"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-3xl font-black tracking-widest",
							children: "SETTINGS"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-1 h-px bg-zinc-800" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mb-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[9px] tracking-[0.4em] text-zinc-500 mb-3",
						children: "AI OPPONENT STRENGTH"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-2 gap-2",
						children: DIFFICULTY_OPTIONS.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => set("difficulty", opt.value),
							className: `border px-4 py-3 text-left transition-all ${settings.difficulty === opt.value ? "border-yellow-400 bg-yellow-400/10" : "border-zinc-700 hover:border-zinc-500"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-sm font-black tracking-widest mb-1",
								style: { color: settings.difficulty === opt.value ? opt.color : "#a1a1aa" },
								children: opt.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] text-zinc-500 leading-tight",
								children: opt.desc
							})]
						}, opt.value))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mb-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-[9px] tracking-[0.4em] text-zinc-500 mb-3",
							children: ["CAMERA FOV — ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-yellow-400",
								children: [settings.cameraFov, "°"]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex gap-2 mb-3",
							children: FOV_PRESETS.map((fov) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => set("cameraFov", fov),
								className: `flex-1 border py-2 text-xs font-black tracking-widest transition-all ${settings.cameraFov === fov ? "border-yellow-400 text-yellow-400 bg-yellow-400/10" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`,
								children: [fov, "°"]
							}, fov))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "range",
							min: 40,
							max: 90,
							step: 1,
							value: settings.cameraFov,
							onChange: (e) => set("cameraFov", Number(e.target.value)),
							className: "w-full accent-yellow-400 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex justify-between text-[8px] text-zinc-600 mt-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "40° NARROW" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "90° WIDE" })]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mb-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between mb-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[9px] tracking-[0.4em] text-zinc-500",
							children: "COSMETIC PREVIEW MODE"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => set("cosmeticPreview", !settings.cosmeticPreview),
							className: `relative w-12 h-6 border transition-all ${settings.cosmeticPreview ? "border-yellow-400 bg-yellow-400/20" : "border-zinc-700 bg-zinc-900"}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `absolute top-0.5 w-5 h-5 transition-all ${settings.cosmeticPreview ? "left-6 bg-yellow-400" : "left-0.5 bg-zinc-600"}` })
						})]
					}), settings.cosmeticPreview && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border border-zinc-800 bg-zinc-900/50 p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex gap-2 mb-3",
								children: ["bannon", "maime"].map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setCosmeticTab(f),
									className: `px-3 py-1 text-[9px] tracking-widest border transition-all ${cosmeticTab === f ? "border-yellow-400 text-yellow-400" : "border-zinc-700 text-zinc-500"}`,
									children: f.toUpperCase()
								}, f))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-4 gap-2",
								children: [
									"DEFAULT",
									"CHROME",
									"SHADOW",
									"GOLD",
									"BLOOD",
									"NEON",
									"VOID",
									"FACTION"
								].map((skin, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: `border py-2 text-[8px] tracking-widest transition-all ${i === 0 ? "border-yellow-400 text-yellow-400 bg-yellow-400/10" : "border-zinc-800 text-zinc-600 hover:border-zinc-600"}`,
									children: skin
								}, skin))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2 text-[7px] text-zinc-600",
								children: "PREVIEW ONLY — ACTIVE COSMETICS APPLY FROM PROFILE SCREEN"
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mb-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[9px] tracking-[0.4em] text-zinc-500 mb-3",
						children: "AUDIO"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between border border-zinc-800 px-4 py-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-sm font-black tracking-widest",
								children: "SOUND EFFECTS"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] text-zinc-500",
								children: "Hit impacts, KO, announcer voice lines"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => set("soundEnabled", !settings.soundEnabled),
								className: `relative w-12 h-6 border transition-all ${settings.soundEnabled ? "border-yellow-400 bg-yellow-400/20" : "border-zinc-700 bg-zinc-900"}`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `absolute top-0.5 w-5 h-5 transition-all ${settings.soundEnabled ? "left-6 bg-yellow-400" : "left-0.5 bg-zinc-600"}` })
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between border border-zinc-800 px-4 py-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-sm font-black tracking-widest",
								children: "MUSIC"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[8px] text-zinc-500",
								children: "Background arena music tracks"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => set("musicEnabled", !settings.musicEnabled),
								className: `relative w-12 h-6 border transition-all ${settings.musicEnabled ? "border-yellow-400 bg-yellow-400/20" : "border-zinc-700 bg-zinc-900"}`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `absolute top-0.5 w-5 h-5 transition-all ${settings.musicEnabled ? "left-6 bg-yellow-400" : "left-0.5 bg-zinc-600"}` })
							})]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border border-zinc-800 bg-zinc-900/30 px-4 py-3 mb-6 text-[8px] text-zinc-500 space-y-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "DIFFICULTY" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-yellow-400",
								children: settings.difficulty.toUpperCase()
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "CAMERA FOV" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-yellow-400",
								children: [settings.cameraFov, "°"]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "COSMETIC PREVIEW" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: settings.cosmeticPreview ? "text-green-400" : "text-zinc-600",
								children: settings.cosmeticPreview ? "ON" : "OFF"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "SOUND FX" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: settings.soundEnabled ? "text-green-400" : "text-zinc-600",
								children: settings.soundEnabled ? "ON" : "OFF"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "MUSIC" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: settings.musicEnabled ? "text-green-400" : "text-zinc-600",
								children: settings.musicEnabled ? "ON" : "OFF"
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onBack,
						className: "flex-1 border border-zinc-700 py-4 text-sm font-black tracking-widest hover:border-zinc-500 transition-all",
						children: "← BACK"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => onConfirm(settings),
						className: "flex-[2] border border-yellow-400 bg-yellow-400 text-black py-4 text-sm font-black tracking-widest hover:bg-yellow-300 transition-all",
						children: "ENTER TOURNAMENT →"
					})]
				})
			]
		})
	});
}
function ScreenShell() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "fixed inset-0 bg-[#0a0a0a]" });
}
var CharacterSelect = dynamic(() => import("./CharacterSelect-CgEVGHIW.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var GameBattleArena = dynamic(() => import("./GameBattleArena-Q4F29L8T.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var TournamentBracket = dynamic(() => import("./TournamentBracket-ChZmnajp.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var TournamentStatsScreen = dynamic(() => import("./TournamentStatsScreen-BnZNwY8c.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var TournamentBrowserScreen = dynamic(() => import("./TournamentBrowserScreen-BzQOHsKI.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var AuthScreen = dynamic(() => import("./AuthScreen-BgHWWFUA.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var PostTournamentScreen = dynamic(() => import("./PostTournamentScreen-BlFY3qQA.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var PlayerProfileScreen = dynamic(() => import("./PlayerProfileScreen-BaDlIAwX.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var TournamentSettingsScreen = dynamic(() => import("./TournamentSettingsScreen-DEnb6LUj.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var LeaderboardScreen = dynamic(() => import("./LeaderboardScreen-C2vbp3GZ.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var PracticeArenaScreen = dynamic(() => import("./PracticeArenaScreen-hrkurRU9.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var StoryModeScreen = dynamic(() => import("./StoryModeScreen-BrbjWTA9.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var StageSelectScreen = dynamic(() => import("./StageSelectScreen-CmO2HBjE.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var SeasonalTournamentScreen = dynamic(() => import("./SeasonalTournamentScreen-BdHycftd.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var MatchmakingQueueScreen = dynamic(() => import("./MatchmakingQueueScreen-BWw74LVw.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var SpectatorViewerScreen = dynamic(() => import("./SpectatorViewerScreen-DGBmGaGV.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var AnimationTestArena = dynamic(() => import("./AnimationTestArena-CeV9-9_i.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var PhotoBoothScreen = dynamic(() => import("./PhotoBoothScreen-DhZVeNcf.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var ConceptArtGallery = dynamic(() => import("./ConceptArtGallery-BR6LBoln.mjs"), {
	ssr: false,
	loading: ScreenShell
});
var PreCombatValidationScreen = dynamic(() => import("./PreCombatValidationScreen-ByokrWHV.mjs"), {
	ssr: false,
	loading: ScreenShell
});
function App() {
	const { user, loading: authLoading, signOut } = useAuth();
	const [screen, setScreen] = (0, import_react.useState)(AppScreen?.Boot);
	const [p1BannonFighter, setP1BannonFighter] = (0, import_react.useState)(null);
	const [p2BannonFighter, setP2BannonFighter] = (0, import_react.useState)(null);
	const [matchWinner, setMatchWinner] = (0, import_react.useState)(null);
	const [gameMode, setGameMode] = (0, import_react.useState)("versus");
	const [tournamentEndData, setTournamentEndData] = (0, import_react.useState)(null);
	const [tournamentSettings, setTournamentSettings] = (0, import_react.useState)(DEFAULT_TOURNAMENT_SETTINGS);
	const [selectedStageId, setSelectedStageId] = (0, import_react.useState)("urban_night");
	(0, import_react.useEffect)(() => {
		warmupImages(getAllBannonFighters().map((f) => `/portraits/concept/${f.id}.jpg?v=ai3`));
		import("./CharacterSelect-CgEVGHIW.mjs");
		import("./StageSelectScreen-CmO2HBjE.mjs");
		import("./GameBattleArena-Q4F29L8T.mjs");
		import("./CombatArena3D-Dl-xX8s6.mjs");
	}, []);
	(0, import_react.useEffect)(() => {
		if (screen !== AppScreen?.Boot) return;
		const timer = window.setTimeout(() => setScreen(AppScreen?.Title), 1400);
		return () => window.clearTimeout(timer);
	}, [screen]);
	if (!BANNON_GLB_PLAYABLE_MODELS?.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 bg-black text-white flex items-center justify-center font-mono",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs tracking-[0.45em] text-red-400",
					children: "ROSTER LOCKED"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 text-xl font-black tracking-widest",
					children: "NO VALID BANNON GLB FIGHTERS"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 text-xs text-slate-500",
					children: "NO GLB = NO CHARACTER"
				})
			]
		})
	});
	if (authLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 bg-black text-white flex items-center justify-center font-mono",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[9px] tracking-[0.45em] text-zinc-600 animate-pulse",
			children: "AUTHENTICATING..."
		})
	});
	if (screen === AppScreen?.Boot) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 bg-black text-white flex items-center justify-center font-mono",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "text-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs tracking-[0.45em] text-slate-500",
				children: "SCHWARZERBLITZ RUNTIME"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 text-2xl font-black tracking-widest",
				children: "BRUTAL FIST"
			})]
		})
	});
	if (screen === AppScreen?.Title) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 bg-black text-white flex items-center justify-center font-mono",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			autoFocus: true,
			onClick: () => setScreen(AppScreen?.MainMenu),
			onKeyDown: (e) => {
				if (e.key === "Enter" || e.key === " " || e.code === "Space") {
					e.preventDefault();
					setScreen(AppScreen?.MainMenu);
				}
			},
			className: "text-4xl font-black italic tracking-[0.18em] text-white animate-pulse",
			children: ["BRUTAL FIST", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block mt-8 text-sm tracking-[0.45em] text-yellow-400",
				children: "PRESS START"
			})]
		})
	});
	if (screen === AppScreen?.MainMenu) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 bg-[#10131a] text-white flex items-center justify-center font-mono",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-[min(86vw,420px)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-2 text-xs tracking-[0.45em] text-slate-500",
					children: "3D FIGHTING GAME"
				}),
				user && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-6 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[8px] tracking-widest text-zinc-600",
						children: ["PLAYER: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-zinc-400",
							children: (user.email ?? "").split("@")[0].toUpperCase()
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => signOut(),
						className: "text-[7px] tracking-widest text-zinc-700 hover:text-zinc-400 transition-colors border border-zinc-800 px-2 py-1",
						children: "SIGN OUT"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => {
								setGameMode("arcade");
								setScreen(AppScreen?.Select);
							},
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: "ARCADE"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => {
								setGameMode("versus");
								setScreen(AppScreen?.Select);
							},
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: "VERSUS"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								setGameMode("tournament");
								setScreen("tournament_browser");
							},
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: ["TOURNAMENT", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-3 text-[10px] text-yellow-400 tracking-widest",
								children: "BRACKET MODE"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setScreen("seasonal_tournament"),
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: ["SEASONAL", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-3 text-[10px] text-orange-400 tracking-widest",
								children: "ELO BRACKET"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								if (!user) setScreen("auth");
								else setScreen("matchmaking_queue");
							},
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: ["RANKED QUEUE", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-3 text-[10px] text-cyan-400 tracking-widest",
								children: "LIVE MATCHMAKING"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setScreen("spectator"),
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: ["SPECTATE", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-3 text-[10px] text-red-400 tracking-widest",
								children: "LIVE MATCHES"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setScreen("practice"),
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: ["TRAINING", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-3 text-[10px] text-green-400 tracking-widest",
								children: "PRACTICE ARENA"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setScreen("photo_booth"),
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: ["PHOTO BOOTH", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-3 text-[10px] text-zinc-400 tracking-widest",
								children: "CONCEPT + PIXEL"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setScreen("art_book"),
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: ["ART BOOK", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-3 text-[10px] text-zinc-400 tracking-widest",
								children: "HQ vs SPRITE"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setScreen("anim_test_arena"),
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: ["ANIM TEST", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-3 text-[10px] text-purple-400 tracking-widest",
								children: "MOVESET CREATION"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setScreen("story"),
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: ["STORY", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-3 text-[10px] text-purple-400 tracking-widest",
								children: "CHARACTER ARCS"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setScreen("leaderboard"),
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: ["LEADERBOARD", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-3 text-[10px] text-yellow-400 tracking-widest",
								children: "GLOBAL RANKS"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								if (!user) setScreen("auth");
								else setScreen("stats");
							},
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: ["STATS", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-3 text-[10px] text-zinc-500 tracking-widest",
								children: "RECORDS & RANK"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								if (!user) setScreen("auth");
								else setScreen("profile");
							},
							className: "block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all",
							children: ["PROFILE", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-3 text-[10px] text-zinc-500 tracking-widest",
								children: "MASTERY & COSMETICS"
							})]
						})
					]
				})
			]
		})
	});
	if (screen === "photo_booth") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PhotoBoothScreen, { onBack: () => setScreen(AppScreen?.MainMenu) });
	if (screen === "art_book") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConceptArtGallery, { onBack: () => setScreen(AppScreen?.MainMenu) });
	if (screen === "anim_test_arena") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimationTestArena, { onBack: () => setScreen(AppScreen?.MainMenu) });
	if (screen === "pre_combat_validation") {
		const p1 = p1BannonFighter ?? getBannonFighter("bannon");
		const p2 = p2BannonFighter ?? getBannonFighter("maime");
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreCombatValidationScreen, {
			p1Fighter: p1,
			p2Fighter: p2,
			onCombatApproved: () => setScreen(AppScreen?.Combat),
			onBack: () => setScreen("stage_select")
		});
	}
	if (screen === "auth") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthScreen, { onSuccess: () => setScreen("stats") });
	if (screen === "tournament_browser") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TournamentBrowserScreen, { onBack: () => setScreen(AppScreen?.MainMenu) });
	if (screen === "tournament_settings") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TournamentSettingsScreen, {
		initialSettings: tournamentSettings,
		onBack: () => setScreen(AppScreen?.MainMenu),
		onConfirm: (s) => {
			setTournamentSettings(s);
			setScreen("tournament_browser");
		}
	});
	if (screen === "seasonal_tournament") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SeasonalTournamentScreen, {
		onBack: () => setScreen(AppScreen?.MainMenu),
		playerFighterId: p1BannonFighter?.id ?? "bannon"
	});
	if (screen === "leaderboard") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeaderboardScreen, { onBack: () => setScreen(AppScreen?.MainMenu) });
	if (screen === "spectator") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpectatorViewerScreen, { onBack: () => setScreen(AppScreen?.MainMenu) });
	if (screen === "practice") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PracticeArenaScreen, { onBack: () => setScreen(AppScreen?.MainMenu) });
	if (screen === "story") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StoryModeScreen, {
		onBack: () => setScreen(AppScreen?.MainMenu),
		onStartStoryBattle: (p1f, p2f, chapterTitle) => {
			setP1BannonFighter(p1f);
			setP2BannonFighter(p2f);
			setScreen("stage_select");
		},
		onCosmeticUnlock: (characterId, reward) => {
			console.info("[BrutalFist] Cosmetic unlocked:", reward.name, "for", characterId);
		}
	});
	if (screen === "stage_select") {
		const p1 = p1BannonFighter ?? getBannonFighter("bannon");
		const p2 = p2BannonFighter ?? getBannonFighter("maime");
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StageSelectScreen, {
			p1Fighter: p1,
			p2Fighter: p2,
			onConfirm: (stageId) => {
				setSelectedStageId(stageId);
				setScreen(AppScreen.Combat);
			},
			onBack: () => setScreen(AppScreen?.Select)
		});
	}
	if (screen === "stats") {
		if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthScreen, { onSuccess: () => setScreen("stats") });
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TournamentStatsScreen, { onBack: () => setScreen(AppScreen?.MainMenu) });
	}
	if (screen === "profile") {
		if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthScreen, { onSuccess: () => setScreen("profile") });
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerProfileScreen, { onBack: () => setScreen(AppScreen?.MainMenu) });
	}
	if (screen === "post_tournament" && tournamentEndData) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PostTournamentScreen, {
		playerFighter: tournamentEndData.playerFighter,
		results: tournamentEndData.results,
		stats: tournamentEndData.stats,
		isChampion: tournamentEndData.isChampion,
		rankPointsEarned: tournamentEndData.rankPointsEarned,
		rankTier: tournamentEndData.rankTier,
		onMainMenu: () => {
			setTournamentEndData(null);
			setScreen(AppScreen?.MainMenu);
		},
		onPlayAgain: () => {
			setTournamentEndData(null);
			setScreen("tournament_browser");
		}
	});
	if (screen === AppScreen?.Select) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CharacterSelect, { onStartMatch: (p1f, p2f) => {
		setP1BannonFighter(p1f);
		setP2BannonFighter(p2f);
		if (gameMode === "tournament") setScreen("tournament");
		else setScreen("stage_select");
	} });
	if (screen === "tournament") {
		const player = p1BannonFighter ?? getBannonFighter("bannon");
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TournamentBracket, {
			playerFighter: player,
			onExit: () => setScreen(AppScreen?.MainMenu),
			onTournamentEnd: (data) => {
				setTournamentEndData(data);
				setScreen("post_tournament");
			}
		});
	}
	if (screen === AppScreen?.Combat) {
		const p1 = p1BannonFighter ?? getBannonFighter("bannon");
		const p2 = p2BannonFighter ?? getBannonFighter("maime");
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameBattleArena, {
			p1Fighter: p1,
			p2Fighter: p2,
			onMatchEnd: (winner) => {
				setMatchWinner(winner);
				setScreen(AppScreen?.PostMatch);
			},
			onBack: () => setScreen("stage_select"),
			settings: tournamentSettings,
			stageId: selectedStageId
		});
	}
	if (screen === AppScreen?.PostMatch) {
		const p1 = p1BannonFighter ?? getBannonFighter("bannon");
		const p2 = p2BannonFighter ?? getBannonFighter("maime");
		const winnerName = matchWinner === "p1" ? p1.name : matchWinner === "p2" ? p2.name : null;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "fixed inset-0 bg-black text-white flex flex-col items-center justify-center font-mono gap-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs tracking-[0.45em] text-slate-500",
					children: "MATCH COMPLETE"
				}),
				winnerName ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-3xl font-black tracking-widest text-yellow-400",
					children: [winnerName.toUpperCase(), " WINS"]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-3xl font-black tracking-widest text-zinc-400",
					children: "DRAW"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-4xl font-black tracking-widest text-white",
					children: "BRUTAL FIST"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-4 mt-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setScreen("stage_select"),
						className: "border border-slate-600 px-6 py-3 text-sm font-black tracking-widest hover:bg-white hover:text-black transition-all",
						children: "REMATCH"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setScreen(AppScreen?.MainMenu),
						className: "border border-slate-600 px-6 py-3 text-sm font-black tracking-widest hover:bg-white hover:text-black transition-all",
						children: "MAIN MENU"
					})]
				})
			]
		});
	}
	if (screen === AppScreen?.VS) {
		const p1 = p1BannonFighter;
		const p2 = p2BannonFighter;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "fixed inset-0 bg-black text-white flex items-center justify-center font-mono overflow-hidden",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full px-8 flex items-center justify-between",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-3xl md:text-6xl font-black italic",
						children: p1?.name ?? "P1"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-4xl md:text-7xl font-black text-red-500",
						children: "VS"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-right text-3xl md:text-7xl font-black italic text-slate-500",
						children: p2?.name ?? "P2"
					})
				]
			})
		});
	}
	if (screen === "matchmaking_queue") {
		if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthScreen, { onSuccess: () => setScreen("matchmaking_queue") });
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MatchmakingQueueScreen, {
			onBack: () => setScreen(AppScreen?.MainMenu),
			onMatchFound: (opponentFighterId, _opponentFighterName) => {
				const fighter = getBannonFighter(opponentFighterId);
				if (fighter) setP2BannonFighter(fighter);
				setScreen("stage_select");
			}
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScreenShell, {});
}
var routes_exports = /* @__PURE__ */ __exportAll({ component: () => Home });
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(App, {}) });
}
//#endregion
export { dynamic as a, warmupImages as c, getAllBannonFighters as d, getBannonFighter as f, FighterState as i, useAuth as l, DEFAULT_TOURNAMENT_SETTINGS as n, loadGLTF as o, TournamentSettingsScreen$1 as r, warmupGLTF as s, routes_exports as t, BANNON_ROSTER as u };
