import { useEffect, useRef } from 'react';

/**
 * A TAP MUST NOT PRESS THE SCREEN IT OPENS.
 *
 * Owner: "when I tap press start it somehow taps a second time in the same spot
 * when the menu pops up and make it tap photo booth probably."
 *
 * He was right, and it is the oldest bug on touch. A tap on a phone produces a
 * real `click`, and THEN the browser synthesises a compatibility mouse sequence
 * at the SAME COORDINATES. The first click advances the screen; React renders
 * the next one under the finger; the synthesised click lands on whatever now
 * occupies that pixel. PRESS START sits in the middle of the display and the
 * mode menu is vertically centred, so the button that inherits the tap is
 * whichever one happens to be at the centre -- PHOTO BOOTH, in his case, which
 * is how a combat session kept turning into a photo booth session.
 *
 * The fix belongs at the app level rather than on one button, because every
 * screen change has the same exposure: title -> menu, menu -> select,
 * select -> stage. This swallows pointer and mouse input for a moment after the
 * screen changes, in the CAPTURE phase, so the event never reaches whatever was
 * just drawn.
 *
 * WHY 350ms: iOS's synthesised click can trail `touchend` by up to ~300ms. The
 * window has to outlast that and stay under the ~500ms where a person would
 * notice their real second tap being eaten.
 *
 * Keyboard is deliberately NOT guarded -- it has no synthesised double, and
 * swallowing it would break the harness and anyone on a controller.
 */
export const TAP_THROUGH_GUARD_MS = 350;

/** Pass the current screen; the guard re-arms whenever it changes. */
export function useTapThroughGuard(screenKey: unknown, ms: number = TAP_THROUGH_GUARD_MS): void {
  const lockedUntil = useRef(0);

  useEffect(() => {
    // Not on the first paint: nothing was under the finger before the app existed.
    lockedUntil.current = performance.now() + ms;
  }, [screenKey, ms]);

  useEffect(() => {
    const swallow = (e: Event) => {
      if (performance.now() >= lockedUntil.current) return;
      e.stopPropagation();
      // `preventDefault` on pointerdown/touchstart is what stops the browser
      // going on to synthesise the mouse pair at all.
      if (e.cancelable) e.preventDefault();
    };
    const events = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend'] as const;
    for (const t of events) document.addEventListener(t, swallow, { capture: true });
    return () => { for (const t of events) document.removeEventListener(t, swallow, { capture: true } as EventListenerOptions); };
  }, []);
}
