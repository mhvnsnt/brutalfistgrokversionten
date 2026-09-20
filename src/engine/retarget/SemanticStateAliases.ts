/**
 * SemanticStateAliases.ts
 * Canonical semantic state alias tables shared between CharacterPipeline,
 * AnimationBridge, and FighterMesh.
 */

/**
 * Resolution takes the FIRST alias whose name is present in the clip set, so
 * order is meaning. The owner-granted Schwarzerblitz entries (uppercase ids like
 * STANCE, ROUNDHOUSEKICK, WAKEUPANIMATION) are appended as FALLBACKS on purpose:
 * they add locomotion and combat the Bannon bank does not carry - sidesteps,
 * real guards, jump attacks, throw starts, landings and getups - without
 * displacing anything that already resolves.
 *
 * ONE KNOWN EXCEPTION WORTH THE OWNER'S CALL: `HURRICANE_KICK` is the first
 * alias for attack_2 and attack_rk and is a frozen capture - measured at source,
 * every bone reads a span of exactly 0 except the hips, which sweep ~180
 * degrees. It plays as a spinning statue. ROUNDHOUSEKICK and QUICKKICK are now
 * available as real alternatives; moving them ahead of it is a design decision,
 * so the order is left as it is and the gate reports the defect instead.
 */
export const SEMANTIC_STATE_ALIASES: Record<string, string[]> = {
  idle:           ['idle', 'Idle', 'IDLE', 'BOX_IDLE', 'STANCE_BLADED', 'STANCE_WIDE', 'DRUNK_IDLE_VARIATION', 'ACTION_IDLE_TO_STANDING_IDLE', 'neutral', 'Neutral', 'standing', 'Standing', 'stance', 'Stance', 'combatIdle', 'CombatIdle', 'idle_procedural_placeholder', 'STANCE', 'LOWSTANCE', 'LOWSTANCENEW', 'TIGERSTANCE', 'GRAFSTANCE', 'SHAZSTANCE', 'JOHNSON_STANCE', 'KRAVESTANCE'],
  walk_forward:   ['walk_forward', 'walk', 'Walk', 'DWARF_WALK', 'DRUNK_WALK', 'GINGA_FORWARD', 'LOCO_STRUT', 'LOCO_LIGHT', 'DRUNK_RUN_FORWARD', 'walkForward', 'WalkForward', 'walking', 'Walking', 'walk_fwd', 'SBW_walk_fwd', 'walk_forward_procedural_placeholder', 'WALK', 'WALKFAST', 'SHAZWALK'],
  walk_back:      ['walk_back', 'walkBack', 'WalkBack', 'GINGA_BACKWARD', 'INJURED_RUN_BACKWARDS_RIGHT_TURN', 'walkBackward', 'WalkBackward', 'walk_bwd', 'SBW_walk_back', 'walk_back_procedural_placeholder', 'WALK'],
  strafe_left:    ['strafe_left', 'strafeLeft', 'StrafeLeft', 'GINGA_SIDEWAYS_2', 'LOCO_PROWL', 'sidestepLeft', 'SidestepLeft', 'SBW_strafe_left', 'sidestepUp', 'SIDESTEP', 'SIDESTEPF', 'SIDESTEPMEDIUM', 'SIDESTEPFAST'],
  strafe_right:   ['strafe_right', 'strafeRight', 'StrafeRight', 'CROUCH_TORCH_WALK_RIGHT', 'INJURED_TURN_RIGHT', 'sidestepRight', 'SidestepRight', 'SBW_strafe_right', 'sidestepDown', 'SIDESTEPF', 'SIDESTEP', 'SIDESTEPMEDIUM'],
  attack_1:       ['attack_1', 'lightAttack', 'LightAttack', 'BOXING', 'BODY_JAB_CROSS', 'BOXING__1_', 'punch', 'Punch', 'jab', 'Jab', 'attack', 'Attack', 'LP', 'T_1', 'bf_jab', 'attack_1_procedural_placeholder', 'HIGHPUNCH', 'GRAFQUICKJAB', 'GYAKUZUKI'],
  attack_rp:      ['attack_rp', 'heavyAttack', 'HeavyAttack', 'COMBO_PUNCH', 'BOXING__2_', 'BOXING__3_', 'ILLEGAL_ELBOW_PUNCH', 'ILLEGAL_ELBOW_PUNCH__1_', 'BASEBALL_HIT', 'cross', 'Cross', 'RP', 'T_2', 'bf_cross', 'UPPERCUT', 'PUNCHKICKCOMBO', 'GRAFPUNCHCOMBO'],
  attack_2:       ['attack_2', 'HURRICANE_KICK', 'DROP_KICK', 'ILLEGAL_KNEE', 'TIGER_FEINT_KICK', 'BASH', 'AU', 'CAPOEIRA', 'kick', 'Kick', 'bf_kick', 'QUICKKICK', 'AXEKICK', 'GRAFPUSHINGKICK'],
  attack_lk:      ['attack_lk', 'lightKick', 'LightKick', 'DROP_KICK', 'ILLEGAL_KNEE', 'TIGER_FEINT_KICK', 'LK', 'T_3', 'bf_lk', 'QUICKKICK', 'CROUCHINGKICK', 'ROUNDHOUSELOW'],
  attack_rk:      ['attack_rk', 'heavyKick', 'HeavyKick', 'HURRICANE_KICK', 'AU', 'CAPOEIRA', 'BASH', 'CROSS_JUMPS', 'RK', 'T_4', 'bf_rk', 'HEAVYKICK', 'AXEKICK', 'TIGER_HEAVYKICK', 'ROUNDHOUSEKICK'],
  // THE FINISHER AND THE OVERDRIVE ARE THEIR OWN MOVES.
  //
  // Both used to map onto attack_rk, so spending a full meter played the
  // same clip as a heavy kick — the redundancy the owner keeps reporting,
  // on the two moves that are supposed to be the payoff.
  //
  // Chosen by measurement and then RENDERED (owner LAW), from every clip in
  // the bake that animates, plants on the floor, faces forward, strikes
  // forward and stands upright:
  //   ORAORAORA             2.46 s  spineUp 0.996  strike 0.64  a sustained
  //                                 flurry from a planted guard — the shape
  //                                 a rage art has in the games this borrows
  //                                 from, and long enough to read as one.
  //   GYAKUZUKI_COMBO       1.13 s  spineUp 0.995  strike 0.85  step into a
  //                                 committed reverse punch, arm fully out.
  //   TIGER_HEAVYKICKCOMBO  1.75 s  spineUp 0.998  strike 0.72  knee up into
  //                                 a kick combination.
  // REJECTED AFTER RENDERING, all of which the numbers alone liked:
  //   NECKBREAKER    starts as a crumpled heap — it is the RECEIVING half.
  //   GRAFHAMMERCOMBO  goes horizontal and stays there.
  //   FACEGOUGE / CARTWHEEL / HURRICANERANA  inverted (see UPRIGHT_SPINE_MIN).
  // DROP_KICK, BASH and ILLEGAL_KNEE were on these lists and are off them:
  // the owner looked at the first two and said the dropkick "kind of looks
  // like it stays vertical" instead of going horizontal (measured: spine-up
  // 0.66, where a dropkick should approach 0), and ILLEGAL_KNEE keeps both
  // hand and foot tucked by design so it cannot pass the reach gate.
  finisher:       ['finisher', 'Finisher', 'ORAORAORA', 'TIGER_HEAVYKICKCOMBO', 'GYAKUZUKI_COMBO', 'GRAFSURPRISEPUNCHLOW', 'attack_rk'],
  overdrive:      ['overdrive', 'Overdrive', 'GYAKUZUKI_COMBO', 'TIGER_HEAVYKICKCOMBO', 'GRAFJUMPKICK', 'ORAORAORA', 'attack_rp'],
  block:          ['block', 'guard', 'Guard', 'CENTER_BLOCK', 'GUARD_HIGH', 'GUARD_LOW', 'DEFENDER', 'ESQUIVA_4', 'Block', 'defend', 'Defend', 'SBW_guard', 'T_guard', 'block_procedural_placeholder', 'GUARD', 'LOWSTANCEGUARD'],
  hit_reaction:   ['hit_reaction', 'hit', 'Hit', 'HIT_REACTION', 'HIT_TO_BODY', 'HIT_TO_HEAD', 'BIG_RIB_HIT', 'HIT_ON_THE_BACK', 'HIT_ON_SIDE_OF_HEAD', 'BIG_BODY_BLOW', 'hurt', 'Hurt', 'flinch', 'Flinch', 'hitstun', 'Hitstun', 'SBW_hit', 'T_hit', 'hit_reaction_procedural_placeholder', 'REACTION_HITWEAKHIGH', 'REACTION_HITWEAKMEDIUM', 'REACTION_HITSTRONGHIGH', 'REACTION_HITSTRONGMID'],
  knockdown:      ['knockdown', 'Knockdown', 'FALLING_FLAT_IMPACT', 'FALLING_FORWARD_DEATH', 'DEFEAT', 'DYING_BACKWARDS', 'ko', 'KO', 'fall', 'Fall', 'SBW_knockdown', 'T_knockdown', 'knockdown_procedural_placeholder', 'REACTION_HEAVYHITAIRREVOLT', 'REACTION_HEAVYHITAIRREVOLTBACK', 'SUPINE'],
  getup:          ['getup', 'getUp', 'GetUp', 'KIP_UP', 'CORKSCREW_KIP_UP', 'CORKSCREW_EVADE', 'quickStand', 'QuickStand', 'gettingUp', 'GettingUp', 'T_quickstand', 'getup_procedural_placeholder', 'WAKEUPANIMATION', 'ROLLOUT', 'ROLLOUTRIGHT', 'LAZORFORWARDROLL', 'LAZORBACKROLL'],
  // THE FIVE CLIPS THAT USED TO LEAD THIS LIST WERE THE RECEIVER'S HALF.
  // Measured head height at the first frame, over the clip's tallest:
  // NECKBREAKER 0.04, DDT 0.04, CHOKESLAM -0.10, GERMANSUPLEX -0.08,
  // SUPLEX 0.42 — a man throwing a grapple was starting it on the mat.
  // DOUBLE_LEG_TAKEDOWN___VICTIM is the same thing and says so in its name.
  // They stay in the bank; they belong to the fighter TAKING the move, and
  // the deliverer's halves lead now.
  // TZ_SCOOP_SLAM AND TZ_TILT_WHIRL_SLAM LED THIS LIST FOR ONE PASS AND WERE
  // MY MISTAKE. They measure identically — 17.43 s, 14 of 14 bones, the same
  // arm spread to three decimals — because they are the same clip under two
  // names, and RENDERED they hold a T-POSE from end to end. Their spread is
  // 0.49 against a T-pose gate of 0.50, which is how they slipped through;
  // seventeen seconds should have been enough on its own. LOOK AT IT, every
  // time, even when the numbers are clean.
  grapple:        ['grapple', 'grab', 'Grab', 'THROWSTART', 'THROWSTART_STEP', 'KNEETHROW', 'RENZOTHROW', 'GRAFTHROW', 'throw', 'Throw', 'SBW_throw', 'T_1_3', 'SUPLEX', 'GERMANSUPLEX', 'DDT', 'CHOKESLAM'],
  crouch:         ['crouch', 'Crouch', 'STANCE_CROUCH', 'CROUCH_IDLE_02_LOOKING_AROUND', 'CROUCH_WALK_FORWARD', 'duck', 'Duck', 'SBW_crouch', 'T_crouch', 'CROUCHING'],
  run:            ['run', 'Run', 'DRUNK_RUN_FORWARD', 'LOCO_LIGHT', 'running', 'Running', 'sprint', 'Sprint', 'RUNNING', 'RUNNINGLOW'],
  dash_forward:   ['dash_forward', 'dashForward', 'DashForward', 'dash', 'Dash', 'DRUNK_RUN_FORWARD', 'SPINJUMPF', 'SPINJUMPFFAST', 'RUNNING'],
  backdash:       ['backdash', 'Backdash', 'backDash', 'BackDash', 'GINGA_BACKWARD', 'SBW_backdash', 'T_backdash', 'Backdashing', 'SPINJUMPB', 'SPINJUMPBFAST'],
  jump:           ['jump', 'Jump', 'hop', 'Hop', 'CROSS_JUMPS', 'jumpForward', 'jumpBack', 'JUMP', 'JUMP2', 'SPINJUMPF', 'SPINJUMPB', 'JUMPAXEKICK', 'DEFAULTJUMPKICK'],
  victory:        ['victory', 'Victory', 'win', 'Win', 'BREAKDANCE_READY', 'STANCE_WIDE', 'victoryPose', 'VictoryPose', 'TIGERWINPOSE', 'JOHNSONWINPOSE'],
  defeat:         ['defeat', 'Defeat', 'DEFEAT', 'lose', 'Lose', 'knockdown', 'Knockdown'],
  taunt:          ['taunt', 'Taunt', 'TAUNT', 'TAUNT_CALLOUT', 'BREAKDANCE_READY', 'CAPOEIRA', 'idle', 'Idle', 'TIGERINTROPOSE', 'JOHNSONINTROPOSE', 'GRAFINTRO', 'SHAZENTRANCE'],
};

export const COMBAT_STATE_TO_SEMANTIC: Record<string, string> = {
  idle:              'idle',
  Neutral:           'idle',
  standing:          'idle',
  walk:              'walk_forward',
  walkForward:       'walk_forward',
  Walking:           'walk_forward',
  walkBackward:      'walk_back',
  strafeLeft:        'strafe_left',
  strafeRight:       'strafe_right',
  sidestepLeft:      'strafe_left',
  sidestepRight:     'strafe_right',
  Backdashing:       'backdash',
  run:               'run',
  dash:              'dash_forward',
  dashForward:       'dash_forward',
  jump:              'jump',
  jumpForward:       'jump',
  jumpBack:          'jump',
  Jumping:           'jump',
  crouch:            'crouch',
  crouchWalk:        'walk_forward',
  lightAttack:       'attack_1',
  light:             'attack_1',
  Startup:           'attack_1',
  Active:            'attack_1',
  heavyAttack:       'attack_rp',
  heavy:             'attack_rp',
  lightKick:         'attack_lk',
  heavyKick:         'attack_rk',
  overdrive:         'overdrive',
  finisher:          'finisher',
  superArmor:        'attack_rp',
  crouchLightAttack: 'attack_1',
  crouchHeavyAttack: 'attack_lk',
  jumpAttack:        'attack_rk',
  runAttack:         'attack_rp',
  CommandThrow:      'grapple',
  ThrowWhiff:        'idle',
  guard:             'block',
  Guard:             'block',
  block:             'block',
  Blockstun:         'block',
  guardLow:          'block',
  hit:               'hit_reaction',
  Hitstun:           'hit_reaction',
  HitStun:           'hit_reaction',
  Stunned:           'hit_reaction',
  hitLow:            'hit_reaction',
  hitHigh:           'hit_reaction',
  knockdown:         'knockdown',
  Knockdown:         'knockdown',
  ko:                'knockdown',
  KO:                'knockdown',
  Crumple:           'knockdown',
  WakeupTechRoll:    'getup',
  WakeupBackrise:    'getup',
  WakeupQuickStand:  'getup',
  wake:              'getup',
  victory:           'victory',
  defeat:            'knockdown',
  taunt:             'taunt',
  intro:             'idle',
};

export function inferSemanticStateFromClipName(clipName: string): string | null {
  const lower = clipName.toLowerCase();
  for (const [semanticState, aliases] of Object.entries(SEMANTIC_STATE_ALIASES)) {
    if (aliases.some((a) => a.toLowerCase() === lower || lower === semanticState.toLowerCase())) {
      return semanticState;
    }
  }
  return null;
}
