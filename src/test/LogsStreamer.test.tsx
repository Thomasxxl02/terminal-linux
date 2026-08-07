import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LogsStreamer } from "../components/LogsStreamer";

// Mock WebSocket globally for testing real-time components
class MockWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState: number = 0; // CONNECTING

  static instances: MockWebSocket[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Auto trigger connection open
    queueMicrotask(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    });
  }

  send(_data: string) {}
  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }

  // Helper for test to trigger incoming WS message
  triggerMessage(payload: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(payload) });
    }
  }
}

describe("LogsStreamer Component", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    global.WebSocket = MockWebSocket as any;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete (global as any).WebSocket;
  });

  it("renders LogsStreamer with default preset file selected", async () => {
    await act(async () => {
      render(<LogsStreamer />);
    });

    expect(screen.getByText("Visualiseur de Flux de Logs")).toBeInTheDocument();
    expect(screen.getByText("tail -f")).toBeInTheDocument();
    
    // Default selected preset path
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("/tmp/application.log");
  });

  it("connects to WebSocket and displays received log history and lines", async () => {
    await act(async () => {
      render(<LogsStreamer />);
    });

    // Wait for mock connection to open
    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const mockWs = MockWebSocket.instances[0];

    // Simulate sending history log frame
    await act(async () => {
      mockWs.triggerMessage({
        type: "history",
        data: "[2026-08-03 12:00:00] [INFO] Server initialized successfully\n[2026-08-03 12:01:00] [WARN] Heavy resource usage\n[2026-08-03 12:02:00] [ERROR] DB connection failure\n",
      });
    });

    // Verify log lines are rendered
    expect(screen.getByText(/Server initialized successfully/i)).toBeInTheDocument();
    expect(screen.getByText(/Heavy resource usage/i)).toBeInTheDocument();
    expect(screen.getByText(/DB connection failure/i)).toBeInTheDocument();
  });

  it("filters lines by severity when tabs are clicked", async () => {
    await act(async () => {
      render(<LogsStreamer />);
    });

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const mockWs = MockWebSocket.instances[0];

    await act(async () => {
      mockWs.triggerMessage({
        type: "history",
        data: "[INFO] Low memory alert\n[WARN] High CPU temp\n[ERROR] Fatal crash\n",
      });
    });

    expect(screen.getByText(/Low memory alert/i)).toBeInTheDocument();
    expect(screen.getByText(/High CPU temp/i)).toBeInTheDocument();
    expect(screen.getByText(/Fatal crash/i)).toBeInTheDocument();

    // Find and click the 'Errors' tab
    const errorsTab = screen.getByRole("button", { name: /Erreurs/i });
    await act(async () => {
      fireEvent.click(errorsTab);
    });

    // Info and Warn logs should be hidden, but Error is visible
    expect(screen.queryByText(/Low memory alert/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/High CPU temp/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Fatal crash/i)).toBeInTheDocument();
  });

  it("searches log lines and highlights the matched query", async () => {
    await act(async () => {
      render(<LogsStreamer />);
    });

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const mockWs = MockWebSocket.instances[0];

    await act(async () => {
      mockWs.triggerMessage({
        type: "history",
        data: "Access granted for admin\nAccess denied for guest\n",
      });
    });

    const searchInput = screen.getByPlaceholderText(/Surligner un terme dans le terminal.../i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "guest" } });
    });

    // The word 'guest' should be wrapped in a <mark> tag
    const markedElement = screen.getByText("guest");
    expect(markedElement.tagName).toBe("MARK");
  });

  it("pauses streaming and doesn't update view until resumed", async () => {
    await act(async () => {
      render(<LogsStreamer />);
    });

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const mockWs = MockWebSocket.instances[0];

    // Trigger initial logs
    await act(async () => {
      mockWs.triggerMessage({
        type: "history",
        data: "Log line 1\n",
      });
    });

    expect(screen.getByText(/Log line 1/i)).toBeInTheDocument();

    // Toggle pause
    const pauseButton = screen.getByTitle("Mettre en pause le flux");
    await act(async () => {
      fireEvent.click(pauseButton);
    });

    // Send new logs while paused
    await act(async () => {
      mockWs.triggerMessage({
        type: "log",
        data: "Log line 2\n",
      });
    });

    // Log line 2 should NOT be visible yet because we are paused
    expect(screen.queryByText(/Log line 2/i)).not.toBeInTheDocument();

    // Resume streaming
    const resumeButton = screen.getByTitle("Reprendre le flux en direct");
    await act(async () => {
      fireEvent.click(resumeButton);
    });

    // Send a new log line to trigger render update
    await act(async () => {
      mockWs.triggerMessage({
        type: "log",
        data: "Log line 3\n",
      });
    });

    expect(screen.getByText(/Log line 3/i)).toBeInTheDocument();
  });

  it("clears logs when Trash button is clicked", async () => {
    await act(async () => {
      render(<LogsStreamer />);
    });

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const mockWs = MockWebSocket.instances[0];

    await act(async () => {
      mockWs.triggerMessage({
        type: "history",
        data: "Temporary debugging line\n",
      });
    });

    expect(screen.getByText(/Temporary debugging line/i)).toBeInTheDocument();

    const clearButton = screen.getByTitle(/Effacer le journal local/i);
    await act(async () => {
      fireEvent.click(clearButton);
    });

    expect(screen.queryByText(/Temporary debugging line/i)).not.toBeInTheDocument();
  });
});
