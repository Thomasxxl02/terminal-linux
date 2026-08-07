import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MonacoFileEditor } from "../components/MonacoFileEditor";

// Mock `@monaco-editor/react` to prevent async/WebGL issues in jsdom environment
vi.mock("@monaco-editor/react", () => {
  return {
    default: ({ value, onChange, language }: any) => (
      <textarea
        data-testid="monaco-editor-mock"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-language={language}
      />
    ),
  };
});

describe("MonacoFileEditor Component", () => {
  const mockExecuteInTerminal = vi.fn();

  const mockTreeData = {
    currentPath: "/workspace",
    parentPath: "/",
    items: [
      { name: "package.json", path: "/workspace/package.json", isDirectory: false, size: 512 },
      { name: "src", path: "/workspace/src", isDirectory: true, size: 0 },
      { name: "app.ts", path: "/workspace/app.ts", isDirectory: false, size: 2048 },
      { name: "deploy.sh", path: "/workspace/deploy.sh", isDirectory: false, size: 128 },
    ],
  };

  const mockShellFileData = {
    path: "/workspace/deploy.sh",
    name: "deploy.sh",
    content: "#!/bin/bash\necho deploy",
    extension: "sh",
  };

  const mockFileData = {
    path: "/workspace/app.ts",
    name: "app.ts",
    content: "console.log('Hello Tauri');",
    extension: "ts",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    // Mock global fetch
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/fs/tree")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTreeData),
        } as Response);
      }
      if (url.includes("/api/fs/read")) {
        const wanted = (url as string).includes("deploy.sh") ? mockShellFileData : mockFileData;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(wanted),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, message: "OK" }),
      } as Response);
    });
  });

  it("renders the empty state welcome screen initially", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    expect(screen.getByText(/Aucun fichier actif sélectionné/i)).toBeInTheDocument();
    expect(screen.getByText(/Sélectionnez un fichier local ou SFTP/i)).toBeInTheDocument();
  });

  it("loads and displays the directory tree items", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    await waitFor(() => {
      expect(screen.getByText("package.json")).toBeInTheDocument();
      expect(screen.getByText("src")).toBeInTheDocument();
      expect(screen.getByText("app.ts")).toBeInTheDocument();
    });
  });

  it("filters file tree items based on search query", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    await waitFor(() => {
      expect(screen.getByText("package.json")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Filtrer les fichiers/i);
    fireEvent.change(searchInput, { target: { value: "package" } });

    expect(screen.getByText("package.json")).toBeInTheDocument();
    expect(screen.queryByText("app.ts")).not.toBeInTheDocument();
  });

  it("opens file on click and displays content inside the editor mock", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    await waitFor(() => {
      expect(screen.getByText("app.ts")).toBeInTheDocument();
    });

    const appTsItem = screen.getByText("app.ts");
    await act(async () => {
      fireEvent.click(appTsItem);
    });

    await waitFor(() => {
      const editorMock = screen.getByTestId("monaco-editor-mock");
      expect(editorMock).toBeInTheDocument();
      expect(editorMock).toHaveValue("console.log('Hello Tauri');");
    });
  });

  it("toggles the editor settings menu and loads preferences", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    // Open file to see the toolbar
    const appTsItem = screen.getByText("app.ts");
    await act(async () => {
      fireEvent.click(appTsItem);
    });

    await waitFor(() => {
      expect(screen.getByTitle("Paramètres de l'éditeur")).toBeInTheDocument();
    });

    const settingsButton = screen.getByTitle("Paramètres de l'éditeur");
    fireEvent.click(settingsButton);

    expect(screen.getByText("Police")).toBeInTheDocument();
    expect(screen.getByText("Retour à la ligne")).toBeInTheDocument();
    expect(screen.getByText("Minimap")).toBeInTheDocument();
    expect(screen.getByText("Sauvegarde Auto")).toBeInTheDocument();
  });

  it("submits command execution on clicking 'Exécuter dans le PTY'", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    // Open file
    const appTsItem = screen.getByText("app.ts");
    await act(async () => {
      fireEvent.click(appTsItem);
    });

    await waitFor(() => {
      expect(screen.getByText(/Exécuter dans le PTY/i)).toBeInTheDocument();
    });

    const catBtn = screen.getByText(/Exécuter dans le PTY/i);
    fireEvent.click(catBtn);

    expect(mockExecuteInTerminal).toHaveBeenCalledWith('cat "/workspace/app.ts"');
  });

  it("handles saving file with backend write request", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    const appTsItem = screen.getByText("app.ts");
    await act(async () => {
      fireEvent.click(appTsItem);
    });

    await waitFor(() => {
      expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument();
    });

    const editorMock = screen.getByTestId("monaco-editor-mock");
    fireEvent.change(editorMock, { target: { value: "console.log('Modified Tauri');" } });

    const saveBtn = screen.getByText(/Sauvegarder/i);
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/fs/write", expect.objectContaining({
        method: "POST",
      }));
    });
  });

  it("affiche 'Aucun fichier ouvert' quand aucun onglet n'est chargé", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    expect(screen.getByText(/Aucun fichier ouvert/i)).toBeInTheDocument();
  });

  it("'Tout sauver' écrit tous les onglets modifiés", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    // Ouvrir 2 fichiers et les modifier
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("monaco-editor-mock"), {
      target: { value: "// modifié" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("deploy.sh"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("monaco-editor-mock")).toHaveValue("#!/bin/bash\necho deploy");
    });

    const saveAllBtn = screen.getByTitle("Enregistrer tout (Ctrl+Shift+S)");
    await act(async () => {
      fireEvent.click(saveAllBtn);
    });

    await waitFor(() => {
      const writeCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => String(c[0]).includes("/api/fs/write")
      );
      expect(writeCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("exécute un script shell avec bash dans le PTY (quick run)", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    await waitFor(() => expect(screen.getByText("deploy.sh")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("deploy.sh"));
    });

    await waitFor(() => {
      expect(screen.getByText(/Langage:/i)).toBeInTheDocument();
      expect(screen.getByText(/SHELL/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Exécuter ou afficher ce fichier dans le terminal de maintenance"));
    expect(mockExecuteInTerminal).toHaveBeenCalledWith('bash "/workspace/deploy.sh"');
  });

  it("'Ouvrir l'Explorateur' et 'Créer un nouveau fichier' depuis l'état vide", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    // Fermer la sidebar pour voir l'état vide avec ses boutons
    const closeSidebar = screen.queryByTitle(/Fermer l'explorateur/i);
    if (closeSidebar) {
      await act(async () => {
        fireEvent.click(closeSidebar);
      });
    }

    await waitFor(() => {
      expect(screen.getByText(/Aucun fichier actif sélectionné/i)).toBeInTheDocument();
    });
    expect(screen.getByText("Ouvrir l'Explorateur")).toBeInTheDocument();
    expect(screen.getByText("Créer un nouveau fichier")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("Créer un nouveau fichier"));
    });
    // Le mode création est actif dans l'explorateur (placeholder par défaut)
    await waitFor(() => {
      expect(screen.getByPlaceholderText("index.html")).toBeInTheDocument();
    });
  });

  it("bascule d'onglet par clic et ferme un onglet", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    // Ouvrir 2 fichiers
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("deploy.sh"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("monaco-editor-mock")).toHaveValue("#!/bin/bash\necho deploy");
    });

    // Cliquer sur l'onglet app.ts (barre d'onglets) → l'éditeur revient à app.ts
    const appTab = screen.getByTitle("/workspace/app.ts");
    await act(async () => {
      fireEvent.click(appTab);
    });
    await waitFor(() => {
      expect(screen.getByTestId("monaco-editor-mock")).toHaveValue("console.log('Hello Tauri');");
    });

    // Fermer l'onglet app.ts → il disparaît de la barre
    const closeButtons = screen.getAllByTitle("Fermer le fichier");
    await act(async () => {
      fireEvent.click(closeButtons[0]);
    });
    expect(screen.queryByTitle("/workspace/app.ts")).not.toBeInTheDocument();
    // deploy.sh reste ouvert
    expect(screen.getByTitle("/workspace/deploy.sh")).toBeInTheDocument();
  });
});
