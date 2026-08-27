jest.mock("../../src/config/db", () => ({
  pool: {
    execute: jest.fn()
  }
}));

const { pool } = require("../../src/config/db");
const {
  SERVER_ROLES,
  normalizeRoleName,
  getServerPermissionContext,
  canManageServerContent,
  canManageServerRoles
} = require("../../src/models/permissionModel");

describe("permission model", () => {
  beforeEach(() => {
    pool.execute.mockReset();
  });

  test("normalizes role names", () => {
    expect(normalizeRoleName(" ADMIN ")).toBe("admin");
    expect(normalizeRoleName(null)).toBe("");
  });

  test("recognizes the server owner even without a membership row", async () => {
    pool.execute.mockResolvedValueOnce([
      [{ server_id: 1, owner_id: 7, member_id: null, server_role: null }]
    ]);

    await expect(getServerPermissionContext(1, 7)).resolves.toEqual({
      serverExists: true,
      isMember: true,
      memberId: null,
      role: SERVER_ROLES.OWNER
    });
  });

  test("recognizes an administrator", async () => {
    pool.execute.mockResolvedValueOnce([
      [{ server_id: 1, owner_id: 1, member_id: 22, server_role: "admin" }]
    ]);

    const result = await canManageServerContent(1, 7);

    expect(result.allowed).toBe(true);
    expect(result.role).toBe(SERVER_ROLES.ADMIN);
  });

  test("does not allow a regular member to manage server content", async () => {
    pool.execute.mockResolvedValueOnce([
      [{ server_id: 1, owner_id: 1, member_id: 22, server_role: "member" }]
    ]);

    const result = await canManageServerContent(1, 7);

    expect(result.allowed).toBe(false);
    expect(result.role).toBe(SERVER_ROLES.MEMBER);
  });

  test("only allows the owner to manage member roles", async () => {
    pool.execute
      .mockResolvedValueOnce([
        [{ server_id: 1, owner_id: 1, member_id: 22, server_role: "admin" }]
      ])
      .mockResolvedValueOnce([
        [{ server_id: 1, owner_id: 7, member_id: null, server_role: null }]
      ]);

    await expect(canManageServerRoles(1, 7)).resolves.toMatchObject({
      allowed: false,
      role: SERVER_ROLES.ADMIN
    });
    await expect(canManageServerRoles(1, 7)).resolves.toMatchObject({
      allowed: true,
      role: SERVER_ROLES.OWNER
    });
  });

  test("returns a safe context when the server does not exist", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await expect(getServerPermissionContext(999, 7)).resolves.toEqual({
      serverExists: false,
      isMember: false,
      memberId: null,
      role: null
    });
  });
});
