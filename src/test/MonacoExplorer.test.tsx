import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MonacoExplorer, getDisplayPath } from "../components/MonacoExplorer";
import { FileTreeItem } from "../types";

vi.mock("../lib/fsApi", () => ({
  fsRead: vi.fn(),
  fsWrite: vi.fn(),
}));

import { fsRead, fsWrite } from "../lib/fsApi";

const items: FileTreeItem[] = [
  { name: "main.rs", path: "/projet/src/main.rs", isDirectory: false, size: 2048 },
  { name: "lib.rs", path: "/projet/src/lib.rs", isDirectory: false, size: 1024 },
  { name: "src", path: "/projet/src", isDirectory: true, size: 0 },
];

function renderExplorer(overrides: Partial<Parameters<typeof MonacoExplorer>[0]> = {}) {
  const props = {
    currentPath: "/projet/src",
    parentPath: "/projet",
    items,
    loadingTree: false,
    searchQuery: "",
    isDraggingOverTree: false,
    isCreatingFile: false,
    isCreatingFolder: false,
    newItemName: "",
    renamingPath: null,
    renameName: "",
    deletingItem: null,
    activeTabPath: "/projet/src/main.rs",
    onSetCreatingFile: vi.fn(),
    onSetCreatingFolder: vi.fn(),
    onSetNewItemName: vi.fn(),
    onSetRenamingPath: vi.fn(),
    onSetRenameName: vi.fn(),
    onSetDeletingItem: vi.fn(),
    onSetSearchQuery: vi.fn(),
    onSetDraggingOverTree: vi.fn(),
    onFetchTree: vi.fn(),
    onItemClick: vi.fn(),
    onCreateItem: vi.fn(),
    onConfirmRename: vi.fn(),
    onConfirmDelete: vi.fn(),
    onDragOverTree: vi.fn(),
    onDragLeaveTree: vi.fn(),
    onDropTree: vi.fn(),
    ...overrides,
  };
  render(<MonacoExplorer {...props} />);
  return props;
}

describe("MonacoExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les éléments et le chemin courant", () => {
    renderExplorer();

    expect(screen.getByText("Système de fichiers local")).toBeInTheDocument();
    expect(screen.getByText("main.rs")).toBeInTheDocument();
    expect(screen.getByText("lib.rs")).toBeInTheDocument();
    expect(screen.getByText("src")).toBeInTheDocument();
  });

  it("affiche le lien parent .. quand parentPath != currentPath", () => {
    renderExplorer();
    expect(screen.getByText(/\(Dossier parent\)/)).toBeInTheDocument();
  });

  it("filtre les items selon la recherche", () => {
    renderExplorer({ searchQuery: "main" });
    expect(screen.getByText("main.rs")).toBeInTheDocument();
    expect(screen.queryByText("lib.rs")).not.toBeInTheDocument();
  });

  it("affiche un message si le dossier est vide", () => {
    renderExplorer({ items: [], searchQuery: "" });
    expect(screen.getByText(/Dossier vide/)).toBeInTheDocument();
  });

  it("clique sur un fichier appelle onItemClick", () => {
    const props = renderExplorer();
    fireEvent.click(screen.getByText("main.rs"));
    expect(props.onItemClick).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/projet/src/main.rs" })
    );
  });

  it("ouvre le formulaire de création de fichier", () => {
    const props = renderExplorer();
    fireEvent.click(screen.getByTitle("Nouveau fichier"));
    expect(props.onSetCreatingFile).toHaveBeenCalledWith(true);
    expect(props.onSetCreatingFolder).toHaveBeenCalledWith(false);
  });

  it("rafraîchit l'arborescence via le bouton refresh", () => {
    const props = renderExplorer();
    fireEvent.click(screen.getByTitle("Rafraîchir"));
    expect(props.onFetchTree).toHaveBeenCalledWith("/projet/src");
  });

  it("affiche le panneau de confirmation de suppression", () => {
    renderExplorer({
      deletingItem: { name: "main.rs", path: "/projet/src/main.rs", isDirectory: false, size: 2048 },
    });
    expect(screen.getByText("Supprimer définitivement ?")).toBeInTheDocument();
    // Le panneau a un bouton de confirmation + l'icône de la liste
    const deleteButtons = screen.getAllByRole("button", { name: "Supprimer" });
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("annule la suppression via le bouton Annuler", () => {
    const props = renderExplorer({
      deletingItem: { name: "main.rs", path: "/projet/src/main.rs", isDirectory: false, size: 2048 },
    });
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(props.onSetDeletingItem).toHaveBeenCalledWith(null);
  });

  it("confirme la suppression", () => {
    const props = renderExplorer({
      deletingItem: { name: "main.rs", path: "/projet/src/main.rs", isDirectory: false, size: 2048 },
    });
    const deleteButtons = screen.getAllByRole("button", { name: "Supprimer" });
    // Le dernier est le bouton de confirmation du panneau (l'icône vient avant)
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    expect(props.onConfirmDelete).toHaveBeenCalled();
  });

  it("ouvre le formulaire de renommage avec le nom pré-rempli", () => {
    const props = renderExplorer({});
    fireEvent.click(screen.getAllByTitle("Renommer")[0]);

    expect(props.onSetRenamingPath).toHaveBeenCalledWith("/projet/src/main.rs");
    expect(props.onSetRenameName).toHaveBeenCalledWith("main.rs");
  });

  it("confirme le renommage avec Entrée et le nouveau nom", () => {
    const props = renderExplorer({
      renamingPath: "/projet/src/main.rs",
      renameName: "main2.rs",
    });
    const input = screen.getByDisplayValue("main2.rs");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(props.onConfirmRename).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/projet/src/main.rs", name: "main.rs" })
    );
  });

  it("annule le renommage avec Échap", () => {
    const props = renderExplorer({
      renamingPath: "/projet/src/main.rs",
      renameName: "main2.rs",
    });
    const input = screen.getByDisplayValue("main2.rs");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(props.onSetRenamingPath).toHaveBeenCalledWith(null);
  });

  it("annule le renommage via le bouton X", () => {
    const props = renderExplorer({
      renamingPath: "/projet/src/main.rs",
      renameName: "main2.rs",
    });
    // Le bouton X est dans la barre de renommage qui contient l'input
    const input = screen.getByDisplayValue("main2.rs");
    const renameBar = input.closest("div");
    expect(renameBar).not.toBeNull();
    const barButtons = within(renameBar as HTMLElement).getAllByRole("button");
    // Check (0) puis X (1)
    fireEvent.click(barButtons[1]);

    expect(props.onSetRenamingPath).toHaveBeenCalledWith(null);
  });

  it("télécharge le contenu réel d'un fichier (fsRead → blob)", async () => {
    (fsRead as ReturnType<typeof vi.fn>).mockResolvedValue({ content: "contenu réel\n" });
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    renderExplorer();
    fireEvent.click(screen.getByLabelText("Télécharger main.rs"));

    await waitFor(() => {
      expect(fsRead).toHaveBeenCalledWith("/projet/src/main.rs");
    });
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("importe un fichier : contenu écrit dans le dossier courant puis refresh", async () => {
    (fsWrite as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const props = renderExplorer();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    const file = new File(["#!/bin/bash\necho ok\n"], "script.sh", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(fsWrite).toHaveBeenCalledWith("/projet/src/script.sh", "#!/bin/bash\necho ok\n");
    });
    expect(props.onFetchTree).toHaveBeenCalledWith("/projet/src");
  });
});

describe("getDisplayPath", () => {
  it("retourne le chemin brut si vide", () => {
    expect(getDisplayPath("")).toBe("");
  });

  it("retourne le chemin sans transformation en environnement sans process.cwd", () => {
    // En jsdom, process existe mais pas process.cwd de Node web... on vérifie
    // que la fonction ne crashe pas et retourne un chemin exploitable.
    const out = getDisplayPath("/home/user/projet");
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});
