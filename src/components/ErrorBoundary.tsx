import React from "react";

interface ErrorBoundaryState {
  error: Error | null;
}

/** Affiche l'erreur à l'écran au lieu d'une page blanche silencieuse. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary a intercepté une erreur :", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "#020617",
            color: "#f1f5f9",
            fontFamily: "monospace",
            padding: "24px",
            textAlign: "left",
          }}
        >
          <h2 style={{ color: "#f87171", marginBottom: 12 }}>Erreur de rendu</h2>
          <pre
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: 16,
              maxWidth: "90%",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              fontSize: 12,
            }}
          >
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
