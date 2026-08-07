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
    loader: { config: () => {} },
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

  it("enregistre un fichier modifié (fs/write avec le contenu réel)", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());

    // Modifier le contenu → l'onglet devient "dirty"
    await act(async () => {
      fireEvent.change(screen.getByTestId("monaco-editor-mock"), {
        target: { value: "console.log('modifié');" },
      });
    });

    // Le bouton Enregistrer devient actif et écrit le contenu réel
    await act(async () => {
      fireEvent.click(screen.getByText("Sauvegarder"));
    });

    await waitFor(() => {
      const posts = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url]: [string, RequestInit]) => String(url).includes("/api/fs/write")
      );
      expect(posts.length).toBeGreaterThan(0);
      const body = JSON.parse(String((posts[0][1] as RequestInit).body));
      expect(body.path).toBe("/workspace/app.ts");
      expect(body.content).toBe("console.log('modifié');");
    });
  });

  it("enregistre tous les onglets modifiés (Enregistrer tout)", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    // Ouvrir 2 fichiers
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("deploy.sh"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());

    // Modifier les 2 fichiers (le 2e est actif, le 1er reste dirty)
    await act(async () => {
      fireEvent.change(screen.getByTestId("monaco-editor-mock"), {
        target: { value: "#!/bin/bash\necho modifié" },
      });
    });
    fireEvent.click(screen.getByTitle("/workspace/app.ts"));
    await act(async () => {
      fireEvent.change(screen.getByTestId("monaco-editor-mock"), {
        target: { value: "console.log('a');" },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Tout sauver"));
    });

    await waitFor(() => {
      const posts = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url]: [string, RequestInit]) => String(url).includes("/api/fs/write")
      );
      // 2 écritures : deploy.sh puis app.ts
      expect(posts.length).toBe(2);
      const paths = posts.map(([, init]: [string, RequestInit]) =>
        JSON.parse(String((init as RequestInit).body)).path
      );
      expect(paths).toContain("/workspace/app.ts");
      expect(paths).toContain("/workspace/deploy.sh");
    });
  });

  it("crée un fichier via l'explorateur (fs/create-file)", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("package.json")).toBeInTheDocument());

    // Nouveau fichier → formulaire inline → saisie → Enter
    fireEvent.click(screen.getByTitle("Nouveau fichier"));
    const nameInput = screen.getByPlaceholderText("index.html");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "test.txt" } });
      fireEvent.keyDown(nameInput, { key: "Enter" });
    });

    await waitFor(() => {
      const posts = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url, init]: [string, RequestInit]) =>
          String(url).includes("/api/fs/create-file") && init?.method === "POST"
      );
      expect(posts.length).toBeGreaterThan(0);
      const body = JSON.parse(String((posts[0][1] as RequestInit).body));
      expect(body.path).toBe("/workspace/test.txt");
    });
  });

  it("supprime un fichier après confirmation (fs/delete)", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("package.json")).toBeInTheDocument());

    // Bouton Supprimer de l'item package.json (group hover, cliquable en jsdom)
    fireEvent.click(screen.getAllByTitle("Supprimer")[0]);
    expect(screen.getByText("Supprimer définitivement ?")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getAllByText("Supprimer")[0]);
    });

    await waitFor(() => {
      const dels = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url, init]: [string, RequestInit]) =>
          String(url).includes("/api/fs/delete") && init?.method === "POST"
      );
      expect(dels.length).toBeGreaterThan(0);
      const body = JSON.parse(String((dels[0][1] as RequestInit).body));
      expect(body.path).toBe("/workspace/package.json");
    });
  });

  it("charge les préférences de l'éditeur depuis localStorage", async () => {
    window.localStorage.setItem(
      "monaco_editor_settings",
      JSON.stringify({ fontSize: 18, wordWrap: "off", minimap: false, theme: "light", tabSize: 4, autoSave: false })
    );

    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    fireEvent.click(screen.getByTitle("Paramètres de l'éditeur"));

    expect(screen.getByDisplayValue("18")).toBeInTheDocument();
    const selects = screen.getAllByRole("combobox");
    expect(selects[0]).toHaveValue("off");
    expect(selects[1]).toHaveValue("false");
    expect(selects[2]).toHaveValue("false");
  });

  it("replie sur les réglages par défaut si le localStorage est corrompu", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    window.localStorage.setItem("monaco_editor_settings", "{corrompu");

    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    fireEvent.click(screen.getByTitle("Paramètres de l'éditeur"));

    expect(screen.getByDisplayValue("13")).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith("Failed to parse editor settings", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("met à jour un réglage et le persiste dans localStorage", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    fireEvent.click(screen.getByTitle("Paramètres de l'éditeur"));

    const fontSizeInput = screen.getByDisplayValue("13");
    fireEvent.change(fontSizeInput, { target: { value: "16" } });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "off" } }); // Retour à la ligne
    fireEvent.change(selects[1], { target: { value: "false" } }); // Minimap
    fireEvent.change(selects[2], { target: { value: "false" } }); // Sauvegarde Auto

    const saved = JSON.parse(window.localStorage.getItem("monaco_editor_settings") || "{}");
    expect(saved).toMatchObject({ fontSize: 16, wordWrap: "off", minimap: false, autoSave: false });
  });

  it("détecte le langage Monaco selon l'extension du fichier", async () => {
    const langTree = {
      currentPath: "/workspace",
      parentPath: "/",
      items: [
        { name: "main.js", path: "/workspace/main.js", isDirectory: false, size: 1 },
        { name: "data.json", path: "/workspace/data.json", isDirectory: false, size: 1 },
        { name: "main.rs", path: "/workspace/main.rs", isDirectory: false, size: 1 },
        { name: "main.py", path: "/workspace/main.py", isDirectory: false, size: 1 },
        { name: "index.html", path: "/workspace/index.html", isDirectory: false, size: 1 },
        { name: "style.css", path: "/workspace/style.css", isDirectory: false, size: 1 },
        { name: "README.md", path: "/workspace/README.md", isDirectory: false, size: 1 },
        { name: "config.yml", path: "/workspace/config.yml", isDirectory: false, size: 1 },
        { name: "config.yaml", path: "/workspace/config.yaml", isDirectory: false, size: 1 },
        { name: "Cargo.toml", path: "/workspace/Cargo.toml", isDirectory: false, size: 1 },
        { name: "schema.sql", path: "/workspace/schema.sql", isDirectory: false, size: 1 },
        { name: "Dockerfile", path: "/workspace/Dockerfile", isDirectory: false, size: 1 },
        { name: "notes.txt", path: "/workspace/notes.txt", isDirectory: false, size: 1 },
      ],
    };
    const extOf = (p: string) => p.split(".").pop() || "";
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/api/fs/tree")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(langTree) } as Response);
      }
      if (url.includes("/api/fs/read")) {
        const p = decodeURIComponent(String(url).split("path=")[1]);
        const name = p.split("/").pop() || "";
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ path: p, name, content: "contenu", extension: extOf(name) }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, message: "OK" }) } as Response);
    });

    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("main.js")).toBeInTheDocument());

    const expected: Array<[string, string]> = [
      ["main.js", "javascript"],
      ["data.json", "json"],
      ["main.rs", "rust"],
      ["main.py", "python"],
      ["index.html", "html"],
      ["style.css", "css"],
      ["README.md", "markdown"],
      ["config.yml", "yaml"],
      ["config.yaml", "yaml"],
      ["Cargo.toml", "toml"],
      ["schema.sql", "sql"],
      ["Dockerfile", "dockerfile"],
      ["notes.txt", "plaintext"],
    ];

    for (const [name, lang] of expected) {
      await act(async () => {
        fireEvent.click(screen.getByText(name));
      });
      await waitFor(() => {
        expect(screen.getByTestId("monaco-editor-mock")).toHaveAttribute("data-language", lang);
      });
    }
  });

  it("affiche une erreur si l'arborescence ne charge pas, puis la ferme via le bouton X", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/api/fs/tree")) return Promise.reject(new Error("réseau indisponible"));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, message: "OK" }) } as Response);
    });

    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    await waitFor(() => expect(screen.getByText("réseau indisponible")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Fermer l'erreur"));
    expect(screen.queryByText("réseau indisponible")).not.toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith("Failed to load file tree", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("ne duplique pas un onglet déjà ouvert", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getAllByText("app.ts")[0]);
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());

    // Re-cliquer sur l'item de l'arbre ne crée pas de second onglet
    await act(async () => {
      fireEvent.click(screen.getAllByText("app.ts")[0]);
    });

    expect(screen.getAllByTitle("/workspace/app.ts")).toHaveLength(1);
  });

  it("affiche une erreur si la lecture d'un fichier échoue", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/api/fs/tree")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTreeData) } as Response);
      }
      if (url.includes("/api/fs/read")) return Promise.reject(new Error("fichier introuvable"));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, message: "OK" }) } as Response);
    });

    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });

    await waitFor(() => expect(screen.getByText("fichier introuvable")).toBeInTheDocument());
    expect(errorSpy).toHaveBeenCalledWith("Failed to read file", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("ouvre directement le fichier passé en initialFilePath et charge son dossier parent", async () => {
    await act(async () => {
      render(
        <MonacoFileEditor
          onExecuteInTerminal={mockExecuteInTerminal}
          initialFilePath="/workspace/app.ts"
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("monaco-editor-mock")).toHaveValue("console.log('Hello Tauri');");
    });

    const treeCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => String(c[0]).includes("/api/fs/tree") && String(c[0]).includes("path=")
    );
    expect(treeCalls.length).toBeGreaterThan(0);
    expect(decodeURIComponent(String(treeCalls[0][0]))).toContain("/workspace");
  });

  it("navigue dans un dossier au clic sur un item de type dossier", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("src")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText("src"));
    });

    const treeCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
      String(c[0]).includes("/api/fs/tree")
    );
    expect(treeCalls.some((c) => decodeURIComponent(String(c[0])).includes("/workspace/src"))).toBe(true);
  });

  it("demande confirmation avant de fermer un onglet modifié (annulation)", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("monaco-editor-mock"), { target: { value: "modifié" } });

    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Fermer le fichier")[0]);
    });

    expect(confirmSpy).toHaveBeenCalledWith(
      'Le fichier "app.ts" contient des modifications non sauvegardées. Fermer quand même ?'
    );
    expect(screen.getByTitle("/workspace/app.ts")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("ferme un onglet modifié après confirmation et affiche l'état vide", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("monaco-editor-mock"), { target: { value: "modifié" } });

    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Fermer le fichier")[0]);
    });

    expect(screen.queryByTitle("/workspace/app.ts")).not.toBeInTheDocument();
    expect(screen.getByText(/Aucun fichier actif sélectionné/i)).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("affiche l'état vide après fermeture du dernier onglet (non modifié)", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getAllByTitle("Fermer le fichier")[0]);
    });

    expect(screen.queryByTitle("/workspace/app.ts")).not.toBeInTheDocument();
    expect(screen.getByText(/Aucun fichier actif sélectionné/i)).toBeInTheDocument();
  });

  it("affiche une erreur quand la sauvegarde d'un fichier échoue", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/api/fs/tree")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTreeData) } as Response);
      }
      if (url.includes("/api/fs/read")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFileData) } as Response);
      }
      if (url.includes("/api/fs/write")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ error: "espace insuffisant" }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, message: "OK" }) } as Response);
    });

    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("monaco-editor-mock"), { target: { value: "modifié" } });
    await act(async () => {
      fireEvent.click(screen.getByText("Sauvegarder"));
    });

    await waitFor(() => expect(screen.getByText("espace insuffisant")).toBeInTheDocument());
    expect(errorSpy).toHaveBeenCalledWith("Failed to save file", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("'Tout sauver' n'écrit rien si aucun onglet n'est modifié", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTitle("Enregistrer tout (Ctrl+Shift+S)"));
    });

    const writes = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
      String(c[0]).includes("/api/fs/write")
    );
    expect(writes.length).toBe(0);
  });

  it("continue la sauvegarde de masse même si un fichier échoue", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/fs/tree")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTreeData) } as Response);
      }
      if (url.includes("/api/fs/read")) {
        const wanted = String(url).includes("deploy.sh") ? mockShellFileData : mockFileData;
        return Promise.resolve({ ok: true, json: () => Promise.resolve(wanted) } as Response);
      }
      if (url.includes("/api/fs/write")) {
        const body = JSON.parse(String((init as RequestInit).body));
        if (String(body.path).includes("app.ts")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ error: "refusé" }) } as Response);
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, message: "OK" }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, message: "OK" }) } as Response);
    });

    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("deploy.sh"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("monaco-editor-mock"), { target: { value: "modif deploy" } });
    await act(async () => {
      fireEvent.click(screen.getByTitle("/workspace/app.ts"));
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId("monaco-editor-mock"), { target: { value: "modif app" } });
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle("Enregistrer tout (Ctrl+Shift+S)"));
    });

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith("Failed to save /workspace/app.ts", expect.any(Error)));

    const writes = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url, init]: [string, RequestInit]) => String(url).includes("/api/fs/write") && init?.method === "POST"
    );
    const paths = writes.map(([, init]: [string, RequestInit]) => JSON.parse(String((init as RequestInit).body)).path);
    expect(paths).toContain("/workspace/app.ts");
    expect(paths).toContain("/workspace/deploy.sh");
    errorSpy.mockRestore();
  });

  it("sauvegarde automatiquement un fichier modifié après 1,5 s (auto-save)", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());

    // Ne pas utiliser waitFor sous fake timers : on avance manuellement les timers.
    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.change(screen.getByTestId("monaco-editor-mock"), { target: { value: "contenu auto-sauvegardé" } });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
        await vi.advanceTimersByTimeAsync(0);
      });

      const writes = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
        String(c[0]).includes("/api/fs/write")
      );
      expect(writes.length).toBeGreaterThan(0);
      const body = JSON.parse(String((writes[0][1] as RequestInit).body));
      expect(body.content).toBe("contenu auto-sauvegardé");
    } finally {
      vi.useRealTimers();
    }
  });

  it("affiche puis masque l'indicateur de succès après sauvegarde", async () => {
    let container!: HTMLElement;
    await act(async () => {
      container = render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />).container;
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());

    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.change(screen.getByTestId("monaco-editor-mock"), { target: { value: "modifié" } });
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Sauvegarder"));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      expect(container.querySelector(".lucide-check")).toBeTruthy();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });
      expect(container.querySelector(".lucide-check")).toBeFalsy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("n'appelle pas l'API si le nom du nouvel élément est vide", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("package.json")).toBeInTheDocument());

    fireEvent.click(screen.getByTitle("Nouveau fichier"));
    const nameInput = screen.getByPlaceholderText("index.html");
    await act(async () => {
      fireEvent.keyDown(nameInput, { key: "Enter" });
    });

    const creates = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
      String(c[0]).includes("/api/fs/create-file")
    );
    expect(creates.length).toBe(0);
  });

  it("crée un dossier via l'explorateur (fs/create-directory)", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("package.json")).toBeInTheDocument());

    fireEvent.click(screen.getByTitle("Nouveau dossier"));
    const nameInput = screen.getByPlaceholderText("nouveau-dossier");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "docs" } });
      fireEvent.keyDown(nameInput, { key: "Enter" });
    });

    await waitFor(() => {
      const posts = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url, init]: [string, RequestInit]) =>
          String(url).includes("/api/fs/create-directory") && init?.method === "POST"
      );
      expect(posts.length).toBeGreaterThan(0);
      const body = JSON.parse(String((posts[0][1] as RequestInit).body));
      expect(body.path).toBe("/workspace/docs");
    });
  });

  it("affiche une alerte si la création d'un élément échoue", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/api/fs/tree")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTreeData) } as Response);
      }
      if (url.includes("/api/fs/create-file")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ error: "existe déjà" }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, message: "OK" }) } as Response);
    });

    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("package.json")).toBeInTheDocument());

    fireEvent.click(screen.getByTitle("Nouveau fichier"));
    const nameInput = screen.getByPlaceholderText("index.html");
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "dup.txt" } });
      fireEvent.keyDown(nameInput, { key: "Enter" });
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("existe déjà"));
    expect(errorSpy).toHaveBeenCalledWith("Failed to create filesystem item", expect.any(Error));
    alertSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("annule le renommage si le nom est vide ou inchangé", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());

    // Nom inchangé → aucune requête de renommage
    fireEvent.click(screen.getAllByTitle("Renommer")[2]);
    const renameInput = screen.getByDisplayValue("app.ts");
    await act(async () => {
      fireEvent.keyDown(renameInput, { key: "Enter" });
    });
    expect(screen.queryByDisplayValue("app.ts")).not.toBeInTheDocument();

    const renames = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
      String(c[0]).includes("/api/fs/rename")
    );
    expect(renames.length).toBe(0);

    // Nom vide → idem
    fireEvent.click(screen.getAllByTitle("Renommer")[2]);
    const renameInput2 = screen.getByDisplayValue("app.ts");
    await act(async () => {
      fireEvent.change(renameInput2, { target: { value: "   " } });
      fireEvent.keyDown(renameInput2, { key: "Enter" });
    });
    expect(screen.queryByDisplayValue("app.ts")).not.toBeInTheDocument();
  });

  it("renomme un fichier ouvert et met à jour l'onglet actif", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());

    fireEvent.click(screen.getAllByTitle("Renommer")[2]);
    const renameInput = screen.getByDisplayValue("app.ts");
    await act(async () => {
      fireEvent.change(renameInput, { target: { value: "app2.ts" } });
      fireEvent.keyDown(renameInput, { key: "Enter" });
    });

    await waitFor(() => {
      const renames = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url, init]: [string, RequestInit]) => String(url).includes("/api/fs/rename") && init?.method === "POST"
      );
      expect(renames.length).toBeGreaterThan(0);
      const body = JSON.parse(String((renames[0][1] as RequestInit).body));
      expect(body.oldPath).toBe("/workspace/app.ts");
      expect(body.newPath).toBe("/workspace/app2.ts");
    });

    // L'onglet suit le renommage et reste actif
    expect(screen.getByTitle("/workspace/app2.ts")).toBeInTheDocument();
    expect(screen.queryByTitle("/workspace/app.ts")).not.toBeInTheDocument();
    expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument();
  });

  it("affiche une alerte si le renommage échoue", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/api/fs/tree")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTreeData) } as Response);
      }
      if (url.includes("/api/fs/rename")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ error: "nom invalide" }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, message: "OK" }) } as Response);
    });

    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());

    fireEvent.click(screen.getAllByTitle("Renommer")[2]);
    const renameInput = screen.getByDisplayValue("app.ts");
    await act(async () => {
      fireEvent.change(renameInput, { target: { value: "interdit.txt" } });
      fireEvent.keyDown(renameInput, { key: "Enter" });
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("nom invalide"));
    expect(errorSpy).toHaveBeenCalledWith("Rename failed", expect.any(Error));
    alertSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("supprime le fichier actif et ferme son onglet", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("app.ts"));
    });
    await waitFor(() => expect(screen.getByTestId("monaco-editor-mock")).toBeInTheDocument());

    // Supprimer app.ts (3e item de l'arbre : package.json, src, app.ts, deploy.sh)
    fireEvent.click(screen.getAllByTitle("Supprimer")[2]);
    expect(screen.getByText("Supprimer définitivement ?")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getAllByText("Supprimer")[0]);
    });

    await waitFor(() => {
      const dels = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url, init]: [string, RequestInit]) => String(url).includes("/api/fs/delete") && init?.method === "POST"
      );
      expect(dels.length).toBeGreaterThan(0);
      const body = JSON.parse(String((dels[0][1] as RequestInit).body));
      expect(body.path).toBe("/workspace/app.ts");
    });

    expect(screen.queryByTitle("/workspace/app.ts")).not.toBeInTheDocument();
    expect(screen.getByText(/Aucun fichier actif sélectionné/i)).toBeInTheDocument();
  });

  it("affiche une alerte si la suppression échoue", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/api/fs/tree")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTreeData) } as Response);
      }
      if (url.includes("/api/fs/delete")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ error: "interdit" }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, message: "OK" }) } as Response);
    });

    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    await waitFor(() => expect(screen.getByText("app.ts")).toBeInTheDocument());

    fireEvent.click(screen.getAllByTitle("Supprimer")[2]);
    await act(async () => {
      fireEvent.click(screen.getAllByText("Supprimer")[0]);
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("interdit"));
    expect(errorSpy).toHaveBeenCalledWith("Delete failed", expect.any(Error));
    alertSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("indique visuellement le survol de dépôt de fichiers (drag over / drag leave)", async () => {
    let container!: HTMLElement;
    await act(async () => {
      container = render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />).container;
    });
    await waitFor(() => expect(screen.getByText("package.json")).toBeInTheDocument());

    const dropZone = container.querySelector('div[class*="overflow-y-auto"]') as HTMLElement;
    expect(dropZone).toBeTruthy();

    fireEvent.dragOver(dropZone);
    expect(screen.getByText("Déposer le fichier")).toBeInTheDocument();

    fireEvent.dragLeave(dropZone);
    expect(screen.queryByText("Déposer le fichier")).not.toBeInTheDocument();
  });

  it("téléverse les fichiers déposés en base64 (fs/write avec encodage)", async () => {
    class FakeFileReader {
      result = "";
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      readAsDataURL(file?: File) {
        this.result =
          file?.name === "sansvirgule.txt" ? "contenu-brut" : "data:text/plain;base64,Zm9v";
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", FakeFileReader);

    try {
      let container!: HTMLElement;
      await act(async () => {
        container = render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />).container;
      });
      await waitFor(() => expect(screen.getByText("package.json")).toBeInTheDocument());

      const dropZone = container.querySelector('div[class*="overflow-y-auto"]') as HTMLElement;
      const fileWithComma = new File(["fake"], "dropped.txt");
      const fileWithoutComma = new File(["fake"], "sansvirgule.txt");

      await act(async () => {
        fireEvent.drop(dropZone, { dataTransfer: { files: [fileWithComma, fileWithoutComma] } });
      });

      await waitFor(() => {
        const writes = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
          ([url, init]: [string, RequestInit]) =>
            String(url).includes("/api/fs/write") && String((init as RequestInit).body).includes("base64")
        );
        expect(writes.length).toBe(2);
        const bodies = writes.map(([, init]: [string, RequestInit]) => JSON.parse(String((init as RequestInit).body)));
        const paths = bodies.map((b) => b.path);
        expect(paths).toContain("/workspace/dropped.txt");
        expect(paths).toContain("/workspace/sansvirgule.txt");
        expect(bodies.every((b) => b.encoding === "base64")).toBe(true);
        expect(bodies.find((b) => b.path === "/workspace/dropped.txt").content).toBe("Zm9v");
        expect(bodies.find((b) => b.path === "/workspace/sansvirgule.txt").content).toBe("contenu-brut");
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("affiche une erreur si le téléversement par dépôt échoue", async () => {
    class FakeFileReader {
      result = "";
      onload: (() => void) | null = null;
      onerror: ((e?: unknown) => void) | null = null;
      readAsDataURL() {
        this.onerror?.(new Error("lecture impossible"));
      }
    }
    vi.stubGlobal("FileReader", FakeFileReader);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      let container!: HTMLElement;
      await act(async () => {
        container = render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />).container;
      });
      await waitFor(() => expect(screen.getByText("package.json")).toBeInTheDocument());

      const dropZone = container.querySelector('div[class*="overflow-y-auto"]') as HTMLElement;
      await act(async () => {
        fireEvent.drop(dropZone, { dataTransfer: { files: [new File(["x"], "fail.txt")] } });
      });

      await waitFor(() =>
        expect(screen.getByText("Erreur lors de l'envoi du fichier.")).toBeInTheDocument()
      );
      expect(errorSpy).toHaveBeenCalledWith("Upload failed", expect.any(Error));
    } finally {
      vi.unstubAllGlobals();
      errorSpy.mockRestore();
    }
  });

  it("masque puis réaffiche le panneau latéral", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });
    expect(screen.getByTitle("Masquer le panneau")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTitle("Masquer le panneau"));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByTitle("Afficher le panneau")).toBeInTheDocument();

    // Rouvrir via l'état vide
    await waitFor(() => expect(screen.getByText("Ouvrir l'Explorateur")).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByText("Ouvrir l'Explorateur"));
    });
    expect(screen.getByTitle("Masquer le panneau")).toBeInTheDocument();
  });

  it("rouvre l'explorateur depuis l'état vide", async () => {
    await act(async () => {
      render(<MonacoFileEditor onExecuteInTerminal={mockExecuteInTerminal} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle("Masquer le panneau"));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    await waitFor(() => expect(screen.getByText("Ouvrir l'Explorateur")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText("Ouvrir l'Explorateur"));
    });

    expect(screen.getByText("Navigateur")).toBeInTheDocument();
    expect(screen.getByTitle("Masquer le panneau")).toBeInTheDocument();
  });
});
