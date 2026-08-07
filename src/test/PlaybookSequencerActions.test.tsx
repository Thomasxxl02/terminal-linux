import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlaybookSequencer } from "../components/PlaybookSequencer";

const mockSessions = [
  { id: "session-1", name: "Bash Main", shell: "bash", cwd: "/home/user", createdAt: Date.now() },
];

function renderSequencer() {
  const props = {
    sessions: mockSessions,
    activeSessionId: "session-1",
    onExecuteCommandInTerminal: vi.fn(),
    onOpenTerminalView: vi.fn(),
  };
  render(<PlaybookSequencer {...props} />);
  return props;
}

describe("PlaybookSequencer — export, import, création, suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("télécharge le playbook sélectionné en script .sh", async () => {
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    const clickMock = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("Blob", class { constructor(public parts: unknown[]) {} });

    renderSequencer();
    // Sélectionner le premier playbook (Pipeline Build)
    const item = (await screen.findAllByText(/Pipeline Build/i))[0];
    fireEvent.click(item);

    // Mock du clic sur <a>
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === "a") {
        el.click = clickMock;
      }
      return el;
    });

    fireEvent.click(screen.getByTitle("Télécharger sous forme de script .sh"));
    expect(clickMock).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exporte le playbook sélectionné en JSON", async () => {
    const createObjectURL = vi.fn(() => "blob:json");
    const clickMock = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    vi.stubGlobal("Blob", class { constructor(public parts: unknown[]) {} });
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === "a") el.click = clickMock;
      return el;
    });

    renderSequencer();
    await screen.findAllByText(/Pipeline Build/i);

    fireEvent.click(screen.getByTitle("Exporter au format JSON"));
    expect(clickMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("crée un playbook via le modal", async () => {
    renderSequencer();

    fireEvent.click(await screen.findByRole("button", { name: /Créer un Playbook/i }));
    expect(await screen.findByText("Créer un Nouveau Playbook")).toBeInTheDocument();
  });

  it("ouvre le sélecteur d'import JSON (input fichier caché)", async () => {
    renderSequencer();

    // Le label "Importer JSON" contient un input type=file caché
    const importLabel = screen.getByText("Importer JSON");
    expect(importLabel).toBeInTheDocument();
    const fileInput = document.querySelector('input[type="file"][accept=".json"]');
    expect(fileInput).not.toBeNull();
  });

  it("importe un playbook JSON valide depuis un fichier", async () => {
    renderSequencer();

    const validPb = {
      name: "Playbook Importé",
      description: "Test import",
      category: "custom",
      steps: [{ id: "s1", title: "Étape", command: "echo importé", stopOnError: false, delaySeconds: 1 }],
    };

    const readerMock = vi.fn().mockImplementation(function (this: { onload: ((e: { target: { result: string } }) => void) | null; readAsText: (f: File) => void }) {
      this.onload = null;
      this.readAsText = (_f: File) => {
        setTimeout(() => {
          this.onload?.({ target: { result: JSON.stringify(validPb) } });
        }, 0);
      };
    });
    vi.stubGlobal("FileReader", readerMock);

    const file = new File([JSON.stringify(validPb)], "pb.json", { type: "application/json" });
    const input = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [file], configurable: true });

    fireEvent.change(input);

    // Le playbook importé apparaît après le traitement async
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const imported = await screen.findAllByText("Playbook Importé");
    expect(imported.length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});
