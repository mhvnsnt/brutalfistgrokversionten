# Rocket — Full Brutal Fist Preview

Rocket must treat this repository as one complete playable application, not as a collection of isolated components.

## Runtime contract

- Primary runtime: Vite + React + Three.js PWA.
- Start command: `npm run dev`.
- Bind address: `0.0.0.0`.
- Port: `8080`.
- Browser entry: `/`.
- Application entry: `src/App.tsx`.
- Next.js compatibility entry: `app/page.tsx`.
- Do **not** create or require a `/play` route.

## Full game flow

Rocket's preview should open the existing application at `/` and allow the complete flow already implemented by the game:

`Character Select → Stage Select → VS → Combat`

The preview must keep the same application shell, state, assets, animation runtime, combat systems, and PWA behavior. It must not replace the game with a mock component or a diagnostic-only screen.

## Asset loading

The preview environment must make the repository's runtime asset roots available without rewriting paths:

- `public/`
- `src/assets/`
- `src/generated/`
- `vendor/`

Build-time source synchronization is allowed to populate generated motion data. The game must continue to use authored/native GLB skeletal assets; source animation repositories are motion inputs, not permission to synthesize replacement characters.

## Next.js compatibility

Rocket's Next.js requirement is satisfied by the compatibility surface under `app/` while the established Vite/PWA runtime remains the primary game runtime. Do not migrate or duplicate the game into a second implementation merely to satisfy Rocket.

## Preview acceptance

A Rocket preview is considered connected only when:

1. `/` loads without a blank/error shell.
2. Character Select is reachable.
3. Stage Select is reachable.
4. VS is reachable.
5. Combat loads in the same preview window.
6. The existing fighter models and animation/combat runtime are used.
7. Mobile pointer/touch controls remain available.
8. The preview is served over the runtime's externally reachable HTTPS preview URL when Rocket provides one.

## Non-destructive rule

Do not change combat orientation, training-arena geometry, fighter scale, camera, floor, hit-FX placement, or existing game routes solely to make Rocket preview work. Fix integration/hosting boundaries instead.
