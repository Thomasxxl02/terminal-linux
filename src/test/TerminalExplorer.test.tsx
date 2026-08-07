import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TerminalExplorer } from "../components/TerminalExplorer";
import { FileTreeItem } from "../types";

describe("TerminalExplorer", () => {
  const makeProps = (overrides: Partial<Parameters<typeof TerminalExplorer>[0]> = {}) => ({
    explorerPath: "/home/user/projet",
    explorerParent: "/home/user",
    fileItems: [
      { name: "src", path: "/home/user/projet/src", isDirectory: true, size: 0 },
      { name: "index.ts", path: "/home/user/projet/index.ts", isDirectory: false, size: 42 },
    ] as FileTreeItem[],
    loadingExplorer: false,
    isTruncated: false,
    totalItemsCount: 2,
    onNavigate: vi.fn(),
    onRefresh: vi.fn(),
    onOpenMonacoFile: vi.fn(),
    onInjectPath: vi.fn(),
    ...overrides,
  });

  it("affiche le chemin, les items et le badge de troncature", () => {
    render(
      <TerminalExplorer
        {...makeProps({ isTruncated: true, totalItemsCount: 450 })}
      />
    );

    expect(screen.getByText("/home/user/projet")).toBeInTheDocument();
    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.getByText("index.ts")).toBeInTheDocument();
    expect(screen.getByText("300/450")).toBeInTheDocument();
  });

  it("navigue dans un dossier au clic et vers le parent via ..", () => {
    const props = makeProps();
    render(<TerminalExplorer {...props} />);

    fireEvent.click(screen.getByText("src"));
    expect(props.onNavigate).toHaveBeenCalledWith("/home/user/projet/src");

    fireEvent.click(screen.getByText(".. (Dossier parent)"));
    expect(props.onNavigate).toHaveBeenCalledWith("/home/user");
  });

  it("ouvre un fichier dans Monaco et injecte le chemin dans le PTY", () => {
    const props = makeProps();
    render(<TerminalExplorer {...props} />);

    fireEvent.click(screen.getByLabelText("Éditer dans Monaco"));
    expect(props.onOpenMonacoFile).toHaveBeenCalledWith("/home/user/projet/index.ts");

    // Le chemin injecté est entouré de guillemets (usage shell)
    fireEvent.click(screen.getAllByLabelText("Injecter le chemin dans le PTY")[1]);
    expect(props.onInjectPath).toHaveBeenCalledWith('"/home/user/projet/index.ts" ');
  });

  it("rafraîchit via le bouton et n'ouvre pas Monaco sur un dossier", () => {
    const props = makeProps();
    render(<TerminalExplorer {...props} />);

    fireEvent.click(screen.getByLabelText("Rafraîchir l'explorateur"));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);

    // Pas de bouton Monaco sur les dossiers
    expect(screen.getAllByLabelText("Injecter le chemin dans le PTY")).toHaveLength(2);
    expect(screen.getAllByLabelText("Éditer dans Monaco")).toHaveLength(1);
  });

  it("affiche 'Dossier vide' quand la liste est vide", () => {
    render(<TerminalExplorer {...makeProps({ fileItems: [] })} />);
    expect(screen.getByText("Dossier vide")).toBeInTheDocument();
  });

  it("masque le bouton parent quand l'explorateur est à la racine", () => {
    render(
      <TerminalExplorer
        {...makeProps({ explorerPath: "/", explorerParent: "/" })}
      />
    );
    expect(screen.queryByText(".. (Dossier parent)")).not.toBeInTheDocument();
  });
});
