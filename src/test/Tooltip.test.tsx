import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Tooltip } from "../components/Tooltip";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe("Tooltip Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the child element correctly and hides tooltip content by default", () => {
    render(
      <Tooltip content="Tooltip message">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.getByText("Hover me")).toBeInTheDocument();
    expect(screen.queryByText("Tooltip message")).not.toBeInTheDocument();
  });

  it("shows tooltip content after the specified delay on mouse enter", () => {
    render(
      <Tooltip content="Tooltip message" delay={200}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText("Hover me");

    fireEvent.mouseEnter(button);

    // Still hidden before delay is over
    expect(screen.queryByText("Tooltip message")).not.toBeInTheDocument();

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText("Tooltip message")).toBeInTheDocument();
  });

  it("hides tooltip content on mouse leave", () => {
    render(
      <Tooltip content="Tooltip message" delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText("Hover me");

    // Enter
    fireEvent.mouseEnter(button);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByText("Tooltip message")).toBeInTheDocument();

    // Leave
    fireEvent.mouseLeave(button);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("Tooltip message")).not.toBeInTheDocument();
  });
});
