// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PtyService, PermissionService, MaintenanceService, SynchronizationService } from "../backend/services";
import * as db from "../backend/db";

describe("Backend Services Unit Tests", () => {
  // Test 1: PTY Session Lifecycle (Business Logic tests)
  describe("PtyService", () => {
    let ptyService: PtyService;

    beforeEach(() => {
      ptyService = PtyService.getInstance();
    });

    afterEach(() => {
      ptyService.shutdownAll();
    });

    it("should instantiate as a singleton", () => {
      const instance1 = PtyService.getInstance();
      const instance2 = PtyService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should create, fetch, and delete a PTY session", () => {
      const id = "test_pty_id";
      const session = ptyService.createSession(id, "Test Terminal", process.cwd());

      expect(session).toBeDefined();
      expect(session.id).toBe(id);
      expect(session.name).toBe("Test Terminal");

      const fetched = ptyService.getSession(id);
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(id);

      const deleted = ptyService.deleteSession(id);
      expect(deleted).toBe(true);

      const fetchedAfterDelete = ptyService.getSession(id);
      expect(fetchedAfterDelete).toBeUndefined();
    });
  });

  // Test 2: Permission Verification Engine (RBAC tests)
  describe("PermissionService", () => {
    it("should correctly validate role-based actions", () => {
      // Admins are authorized for everything
      expect(PermissionService.isAuthorized("admin", "write_system")).toBe(true);
      expect(PermissionService.isAuthorized("admin", "execute_terminal")).toBe(true);

      // Developers can execute terminals but cannot write system files
      expect(PermissionService.isAuthorized("developer", "execute_terminal")).toBe(true);
      expect(PermissionService.isAuthorized("developer", "write_system")).toBe(false);

      // Guests cannot do anything except read_system
      expect(PermissionService.isAuthorized("guest", "read_system")).toBe(true);
      expect(PermissionService.isAuthorized("guest", "execute_terminal")).toBe(false);
    });

    it("should protect critical system paths based on role", () => {
      // Admins can access anything
      expect(PermissionService.validatePathAccess("/etc/shadow", "admin")).toBe(true);
      expect(PermissionService.validatePathAccess("/root/.bashrc", "admin")).toBe(true);

      // Developers and guests are blocked from restricted paths
      expect(PermissionService.validatePathAccess("/etc/shadow", "developer")).toBe(false);
      expect(PermissionService.validatePathAccess("/root/.bashrc", "guest")).toBe(false);

      // Safe user-space directories are allowed
      expect(PermissionService.validatePathAccess("/home/user/document.txt", "developer")).toBe(true);
      expect(PermissionService.validatePathAccess("/tmp/app.log", "guest")).toBe(true);
    });
  });

  // Test 3: Maintenance Command Resolution
  describe("MaintenanceService", () => {
    it("should formulate correct maintenance shell commands", () => {
      const updateCmd = MaintenanceService.getMaintenanceCommand("apt-update");
      expect(updateCmd).toContain("apt-get update");

      const cleanCmd = MaintenanceService.getMaintenanceCommand("apt-clean");
      expect(cleanCmd).toContain("apt-get clean");

      const purgeCmd = MaintenanceService.getMaintenanceCommand("logs-purge");
      expect(purgeCmd).toContain("/var/log");

      const topCmd = MaintenanceService.getMaintenanceCommand("top-processes");
      expect(topCmd).toContain("ps aux");
    });
  });

  // Test 4: Database Access Logic (PostgreSQL SQL unit tests)
  describe("PostgreSQL Access Layer", () => {
    it("should insert and fetch SSH Hosts", async () => {
      const mockHost = {
        id: "host_test_1",
        name: "Test Host",
        host: "10.0.0.5",
        port: 22,
        username: "root",
        description: "Test Host Node",
      };

      await db.insertSshHost(mockHost);
      const hosts = await db.fetchAllSshHosts();
      const fetched = hosts.find((h) => h.id === "host_test_1");

      expect(fetched).toBeDefined();
      expect(fetched.name).toBe("Test Host");
      expect(fetched.host).toBe("10.0.0.5");

      await db.deleteSshHost("host_test_1");
      const hostsAfter = await db.fetchAllSshHosts();
      expect(hostsAfter.find((h) => h.id === "host_test_1")).toBeUndefined();
    });

    it("should insert and fetch Snippets", async () => {
      const mockSnippet = {
        id: "snippet_test_1",
        title: "Test Snippet",
        command: "echo hello",
        category: "Test",
        description: "A test command snippet",
      };

      await db.insertSnippet(mockSnippet);
      const snippets = await db.fetchAllSnippets();
      const fetched = snippets.find((s) => s.id === "snippet_test_1");

      expect(fetched).toBeDefined();
      expect(fetched.title).toBe("Test Snippet");
      expect(fetched.command).toBe("echo hello");

      await db.deleteSnippet("snippet_test_1");
      const snippetsAfter = await db.fetchAllSnippets();
      expect(snippetsAfter.find((s) => s.id === "snippet_test_1")).toBeUndefined();
    });
  });

  // Test 5: Sync Reconciliation Audit Trails
  describe("SynchronizationService", () => {
    it("should record entities sync operations and generate report", async () => {
      const initialLogs = await db.fetchSyncLogs();
      const initialCount = initialLogs.length;

      await SynchronizationService.syncEntity("ssh_host", "host_test_1", "create", "Added host test 1");
      await SynchronizationService.syncEntity("snippet", "snippet_test_1", "update", "Updated snippet content");

      const report = await SynchronizationService.getSynchronizationReport();
      expect(report.status).toBe("synchronized");
      expect(report.totalRecordsSynced).toBe(initialCount + 2);

      const lastLog = report.logs[0];
      expect(lastLog.entity_id).toBe("snippet_test_1");
      expect(lastLog.action).toBe("update");
    });
  });
});
