import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Affiche l'erreur à l'écran au lieu d'une page blanche silencieuse. */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

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
            padding: "2rem",
          }}
        >
          <h1 style={{ color: "#f87171", fontSize: "1.25rem", marginBottom: "1rem" }}>
            ⚠️ Une erreur est survenue
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
            {this.state.error.message}
          </p>
          <pre
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "0.5rem",
              padding: "1rem",
              fontSize: "0.75rem",
              maxWidth: "100%",
              overflow: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
