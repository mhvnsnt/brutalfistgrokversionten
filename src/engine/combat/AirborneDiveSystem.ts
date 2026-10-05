/** Airborne/dive attack routing. Jump creates the window; an attack edge selects the move. */
export type AirborneSource = 'JUMP' | 'STAGE_DIVE';
export type AirborneAttackKind = 'NEUTRAL_DIVE' | 'FORWARD_DIVE' | 'BACK_DIVE';
export interface AirborneDiveContext { airborne:boolean; source:AirborneSource; forward:number; falling:boolean; attackPressed:boolean; kickPressed:boolean; }
export interface AirborneDiveResolution { kind:AirborneAttackKind; command:number; source:AirborneSource; forward:-1|0|1; falling:boolean; }
function sign3(v:number):-1|0|1 { return v>0.3?1:v<-0.3?-1:0; }
export function resolveAirborneDive(ctx:AirborneDiveContext):AirborneDiveResolution|null {
  if (!ctx.airborne || !ctx.attackPressed) return null;
  const forward=sign3(ctx.forward);
  return { kind:forward>0?'FORWARD_DIVE':forward<0?'BACK_DIVE':'NEUTRAL_DIVE', command:forward>0?9:forward<0?7:8, source:ctx.source, forward, falling:ctx.falling };
}