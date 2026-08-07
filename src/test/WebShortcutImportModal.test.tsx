import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WebShortcutImportModal } from "../components/WebShortcutImportModal";

describe("WebShortcutImportModal", () => {
  const setImportJsonText = vi.fn();
  const handleImportJson = vi.fn();
  const onClose = vi.fn();

  const renderModal = () =>
    render(
      <WebShortcutImportModal
        importJsonText=""
        setImportJsonText={setImportJsonText}
        handleImportJson={handleImportJson}
        onClose={onClose}
      />
    );

  it("affiche le titre et le placeholder JSON", () => {
    renderModal();
    expect(screen.getByText("Importer des Raccourcis (Format JSON)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/GitHub/)).toBeInTheDocument();
  });

  it("propage la saisie JSON et soumet", () => {
    renderModal();
    const textarea = screen.getByPlaceholderText(/GitHub/);
    fireEvent.change(textarea, { target: { value: '[{"title":"GitHub"}]' } });
    expect(setImportJsonText).toHaveBeenCalledWith('[{"title":"GitHub"}]');

    fireEvent.submit(screen.getByText("Valider l'import").closest("form")!);
    expect(handleImportJson).toHaveBeenCalledTimes(1);
  });

  it("annule l'import", () => {
    renderModal();
    fireEvent.click(screen.getByText("Annuler"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
