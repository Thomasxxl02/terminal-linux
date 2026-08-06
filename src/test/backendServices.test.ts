// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PtyService, PermissionService } from "../backend/services";

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
});
