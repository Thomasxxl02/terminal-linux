import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MonacoSettingsPanel, EditorSettings } from "../components/MonacoSettingsPanel";

const defaultSettings: EditorSettings = {
  fontSize: 14,
  wordWrap: "on",
  minimap: true,
  theme: "vs-dark",
  tabSize: 4,
  autoSave: false,
};

describe("MonacoSettingsPanel", () => {
  it("affiche les 4 réglages avec les valeurs actuelles", () => {
    render(
      <MonacoSettingsPanel settings={defaultSettings} onUpdateSetting={vi.fn()} />
    );

    expect(screen.getByText("Police")).toBeInTheDocument();
    expect(screen.getByText("Retour à la ligne")).toBeInTheDocument();
    expect(screen.getByText("Minimap")).toBeInTheDocument();
    expect(screen.getByText("Sauvegarde Auto")).toBeInTheDocument();

    expect(screen.getByDisplayValue("14")).toBeInTheDocument();
    // 3 selects : retour à la ligne (on), minimap (true), autosave (false)
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(3);
    expect(selects[0]).toHaveValue("on");
    expect(selects[1]).toHaveValue("true");
    expect(selects[2]).toHaveValue("false");
  });

  it("met à jour la taille de police (bornée 10-24)", () => {
    const onUpdate = vi.fn();
    render(<MonacoSettingsPanel settings={defaultSettings} onUpdateSetting={onUpdate} />);

    const fontInput = screen.getByDisplayValue("14");
    fireEvent.change(fontInput, { target: { value: "18" } });
    expect(onUpdate).toHaveBeenCalledWith("fontSize", 18);
  });

  it("borne la taille de police au minimum 10", () => {
    const onUpdate = vi.fn();
    render(<MonacoSettingsPanel settings={defaultSettings} onUpdateSetting={onUpdate} />);

    fireEvent.change(screen.getByDisplayValue("14"), { target: { value: "5" } });
    expect(onUpdate).toHaveBeenCalledWith("fontSize", 10);
  });

  it("met à jour le retour à la ligne", () => {
    const onUpdate = vi.fn();
    render(<MonacoSettingsPanel settings={defaultSettings} onUpdateSetting={onUpdate} />);

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "off" } });
    expect(onUpdate).toHaveBeenCalledWith("wordWrap", "off");
  });

  it("met à jour la minimap", () => {
    const onUpdate = vi.fn();
    render(<MonacoSettingsPanel settings={defaultSettings} onUpdateSetting={onUpdate} />);

    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "false" } });
    expect(onUpdate).toHaveBeenCalledWith("minimap", false);
  });

  it("met à jour la sauvegarde auto", () => {
    const onUpdate = vi.fn();
    render(<MonacoSettingsPanel settings={defaultSettings} onUpdateSetting={onUpdate} />);

    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "true" } });
    expect(onUpdate).toHaveBeenCalledWith("autoSave", true);
  });
});
