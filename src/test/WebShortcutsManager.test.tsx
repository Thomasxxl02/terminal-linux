import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WebShortcutsManager } from "../components/WebShortcutsManager";

describe("WebShortcutsManager Component", () => {
  it("renders default shortcuts correctly", () => {
    render(<WebShortcutsManager />);

    expect(screen.getByText("Raccourcis Web & Services")).toBeInTheDocument();
    expect(screen.getByText("GitHub Repository")).toBeInTheDocument();
    expect(screen.getByText("Documentation Rust")).toBeInTheDocument();
  });

  it("filters shortcuts using the search bar", () => {
    render(<WebShortcutsManager />);

    const searchInput = screen.getByPlaceholderText("Rechercher par titre, URL ou tag...");
    fireEvent.change(searchInput, { target: { value: "Grafana" } });

    expect(screen.getByText("Grafana Local Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Documentation Rust")).not.toBeInTheDocument();
  });

  it("opens modal and creates a new web shortcut", () => {
    render(<WebShortcutsManager />);

    const newBtn = screen.getByText("Nouveau Raccourci");
    fireEvent.click(newBtn);

    expect(screen.getByText("Nouveau Raccourci Web")).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText("ex: Portainer, GitHub, Grafana...");
    const urlInput = screen.getByPlaceholderText("https://github.com ou http://localhost:8080");

    fireEvent.change(titleInput, { target: { value: "Nginx Admin" } });
    fireEvent.change(urlInput, { target: { value: "http://localhost:8080" } });

    const submitBtn = screen.getByText("Créer le Raccourci");
    fireEvent.click(submitBtn);

    expect(screen.getByText("Nginx Admin")).toBeInTheDocument();
  });

  it("triggers terminal execute command when testing cURL", () => {
    const handleExecuteInTerminal = vi.fn();
    render(<WebShortcutsManager onExecuteInTerminal={handleExecuteInTerminal} />);

    const curlButtons = screen.getAllByTitle("Envoyer commande cURL au terminal");
    if (curlButtons.length > 0) {
      fireEvent.click(curlButtons[0]);
      expect(handleExecuteInTerminal).toHaveBeenCalledWith(expect.stringContaining("curl -I"));
    }
  });
});
