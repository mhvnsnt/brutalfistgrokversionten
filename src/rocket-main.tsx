import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import "./styles.css";

class RocketPreviewErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BrutalFist][RocketPreview] render failed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#000",
          color: "#fff",
          padding: 24,
          fontFamily: "monospace",
        }}
      >
        <section style={{ maxWidth: 720 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#888" }}>
            BRUTAL FIST / ROCKET PREVIEW
          </div>
          <h1 style={{ margin: "12px 0", fontSize: 24 }}>
            Preview runtime error
          </h1>
          <p style={{ color: "#aaa", lineHeight: 1.5 }}>
            The game shell loaded, but a client module failed while rendering.
            Reloading the preview should retry the module from the current build.
          </p>
          <pre
            style={{
              marginTop: 16,
              padding: 12,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              background: "#111",
              border: "1px solid #333",
              color: "#ccc",
            }}
          >
            {this.state.error.message}
          </pre>
        </section>
      </main>
    );
  }
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Brutal Fist preview root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <RocketPreviewErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </RocketPreviewErrorBoundary>
  </StrictMode>,
);
