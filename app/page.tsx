'use client';

import App from '../src/App';
import { AuthProvider } from '../src/contexts/AuthContext';

/**
 * Next.js compatibility surface. The Vite PWA is the real runtime; this exists
 * so a Next-aware host can render the same game.
 *
 * MEASURED: rendering <App /> bare answered `/` with HTTP 500 —
 * "useAuth must be used within AuthProvider" — because `src/App` calls useAuth
 * at its top level. `src/rocket-main.tsx` already wraps the app in the
 * provider; this surface has to do the same or the route cannot render.
 */
export default function Page() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
