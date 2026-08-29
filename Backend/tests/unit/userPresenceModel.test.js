const mockPool = {
  execute: jest.fn()
};

jest.mock("../../src/config/db", () => ({
  pool: mockPool,
  withTransaction: jest.fn()
}));

const {
  getPresenceAudienceUserIds,
  setAllUsersOffline
} = require("../../src/models/userModel");

describe("user presence model hardening", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns only related user ids for presence fan-out", async () => {
    mockPool.execute.mockResolvedValueOnce([[
      { related_user_id: 2 },
      { related_user_id: 3 },
      { related_user_id: "4" }
    ]]);

    const audience = await getPresenceAudienceUserIds(1);

    expect(audience).toEqual([2, 3, 4]);
    expect(mockPool.execute).toHaveBeenCalledWith(
      expect.stringContaining("FROM server_members"),
      [1, 1, 1, 1, 1, 1, 1]
    );
  });

  test("clears stale online flags with a last-seen timestamp", async () => {
    mockPool.execute.mockResolvedValueOnce([{ affectedRows: 2 }]);
    const lastSeenAt = new Date("2030-01-01T00:00:00Z");

    const result = await setAllUsersOffline(lastSeenAt);

    expect(result.affectedRows).toBe(2);
    expect(mockPool.execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE is_online = 1"),
      [lastSeenAt]
    );
  });
});
