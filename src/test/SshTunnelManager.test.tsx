import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SshTunnelManager } from "../components/SshTunnelManager";

describe("SshTunnelManager Component", () => {
  const mockOnExecuteInTerminal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders SshTunnelManager headers and default tunnels", () => {
    render(
      <SshTunnelManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
        sessions={[]}
        activeSessionId={null}
      />
    );

    expect(screen.getByText(/Générateur & Testeur de Tunnels SSH \/ Reverse Proxy/i)).toBeInTheDocument();
    expect(screen.getByText(/Redirection MySQL Staging/i)).toBeInTheDocument();
    expect(screen.getByText(/Reverse Proxy Dev Webserver/i)).toBeInTheDocument();
  });

  it("filters tunnels by searching", () => {
    render(
      <SshTunnelManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
        sessions={[]}
        activeSessionId={null}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Rechercher nom, port local, hôte/i);
    fireEvent.change(searchInput, { target: { value: "MySQL" } });

    expect(screen.getByText(/Redirection MySQL Staging/i)).toBeInTheDocument();
    expect(screen.queryByText(/Reverse Proxy Dev Webserver/i)).not.toBeInTheDocument();
  });

  it("triggers terminal command execution when Exécuter is clicked", () => {
    render(
      <SshTunnelManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
        sessions={[]}
        activeSessionId={null}
      />
    );

    const executeBtns = screen.getAllByRole("button", { name: /Exécuter Terminal/i });
    fireEvent.click(executeBtns[0]);

    expect(mockOnExecuteInTerminal).toHaveBeenCalledTimes(1);
    expect(mockOnExecuteInTerminal.mock.calls[0][0]).toContain("-L");
  });

  it("opens create tunnel modal", () => {
    render(
      <SshTunnelManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
        sessions={[]}
        activeSessionId={null}
      />
    );

    const createBtn = screen.getByRole("button", { name: /Créer un Tunnel SSH/i });
    fireEvent.click(createBtn);

    expect(screen.getByText(/Nouveau Tunnel SSH \/ Port Forwarding/i)).toBeInTheDocument();
  });
});
