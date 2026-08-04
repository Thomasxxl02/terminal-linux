import { describe, it, expect, beforeEach, vi } from "vitest";
import { IndexedDBStore } from "../lib/indexedDB";

describe("IndexedDB Store Unit Tests", () => {
  let dbStore: IndexedDBStore;
  let mockIDBDatabase: any;
  let mockTransaction: any;
  let mockObjectStore: any;
  let mockRequest: any;

  beforeEach(() => {
    dbStore = new IndexedDBStore();

    // Create a mock request object
    mockRequest = {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: null,
      error: null,
    };

    // Create a mock object store
    mockObjectStore = {
      put: vi.fn().mockImplementation(() => {
        const req: any = { onsuccess: null, onerror: null };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      }),
      get: vi.fn().mockImplementation((key) => {
        const req: any = { onsuccess: null, onerror: null, result: null };
        setTimeout(() => {
          req.result = { path: key, content: "mock_content", timestamp: 123456 };
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      }),
      delete: vi.fn().mockImplementation(() => {
        const req: any = { onsuccess: null, onerror: null };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      }),
      clear: vi.fn().mockImplementation(() => {
        const req: any = { onsuccess: null, onerror: null };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      }),
    };

    // Create a mock transaction
    mockTransaction = {
      objectStore: vi.fn().mockReturnValue(mockObjectStore),
    };

    // Create a mock database instance
    mockIDBDatabase = {
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(true),
      },
      transaction: vi.fn().mockReturnValue(mockTransaction),
      close: vi.fn(),
    };

    // Setup global window.indexedDB mock
    if (typeof window !== "undefined") {
      vi.stubGlobal("indexedDB", {
        open: vi.fn().mockImplementation(() => {
          setTimeout(() => {
            mockRequest.result = mockIDBDatabase;
            if (mockRequest.onsuccess) mockRequest.onsuccess();
          }, 0);
          return mockRequest;
        }),
      });
    }
  });

  it("should open the database and return database instance", async () => {
    const db = await dbStore.open();
    expect(db).toBeDefined();
    expect(db).toBe(mockIDBDatabase);
  });

  it("should save a file backup inside the store", async () => {
    await dbStore.saveBackup("/src/App.tsx", "const val = 123;");
    expect(mockTransaction.objectStore).toHaveBeenCalledWith("file_backups");
    expect(mockObjectStore.put).toHaveBeenCalledWith({
      path: "/src/App.tsx",
      content: "const val = 123;",
      timestamp: expect.any(Number),
    });
  });

  it("should retrieve backup content correctly", async () => {
    const backup = await dbStore.getBackup("/src/App.tsx");
    expect(mockObjectStore.get).toHaveBeenCalledWith("/src/App.tsx");
    expect(backup).toEqual({
      path: "/src/App.tsx",
      content: "mock_content",
      timestamp: 123456,
    });
  });

  it("should delete backup content correctly", async () => {
    await dbStore.deleteBackup("/src/App.tsx");
    expect(mockObjectStore.delete).toHaveBeenCalledWith("/src/App.tsx");
  });

  it("should clear all backups correctly", async () => {
    await dbStore.clearAll();
    expect(mockObjectStore.clear).toHaveBeenCalled();
  });
});
