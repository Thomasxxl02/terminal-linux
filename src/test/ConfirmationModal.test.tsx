import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConfirmationModal } from "../components/ConfirmationModal";

describe("ConfirmationModal Component", () => {
  it("does not render when isOpen is false", () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    const { container } = render(
      <ConfirmationModal
        isOpen={false}
        title="Supprimer l'élément ?"
        message="Voulez-vous vraiment effectuer cette action ?"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders correctly with given title and message when isOpen is true", () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <ConfirmationModal
        isOpen={true}
        title="Supprimer l'élément ?"
        message="Voulez-vous vraiment effectuer cette action ?"
        confirmLabel="Oui, supprimer"
        cancelLabel="Non, conserver"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByText("Supprimer l'élément ?")).toBeInTheDocument();
    expect(screen.getByText("Voulez-vous vraiment effectuer cette action ?")).toBeInTheDocument();
    expect(screen.getByText("Oui, supprimer")).toBeInTheDocument();
    expect(screen.getByText("Non, conserver")).toBeInTheDocument();
  });

  it("triggers onConfirm when confirm button is clicked", () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <ConfirmationModal
        isOpen={true}
        title="Supprimer l'élément ?"
        message="Voulez-vous vraiment effectuer cette action ?"
        confirmLabel="Oui, supprimer"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    const confirmButton = screen.getByText("Oui, supprimer");
    fireEvent.click(confirmButton);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleCancel).not.toHaveBeenCalled();
  });

  it("triggers onCancel when cancel button is clicked", () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <ConfirmationModal
        isOpen={true}
        title="Supprimer l'élément ?"
        message="Voulez-vous vraiment effectuer cette action ?"
        cancelLabel="Non, conserver"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    const cancelButton = screen.getByText("Non, conserver");
    fireEvent.click(cancelButton);

    expect(handleCancel).toHaveBeenCalledTimes(1);
    expect(handleConfirm).not.toHaveBeenCalled();
  });
});
