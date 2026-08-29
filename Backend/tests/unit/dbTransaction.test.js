const mockConnection = {
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
  ping: jest.fn()
};

const mockPool = {
  getConnection: jest.fn(async () => mockConnection),
  end: jest.fn()
};

jest.mock("mysql2/promise", () => ({
  createPool: jest.fn(() => mockPool)
}));

const { withTransaction } = require("../../src/config/db");

describe("database transaction helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("commits successful transactional work and always releases the connection", async () => {
    const result = await withTransaction(async () => "done");

    expect(result).toBe("done");
    expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    expect(mockConnection.rollback).not.toHaveBeenCalled();
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  test("rolls back failed transactional work and releases the connection", async () => {
    await expect(
      withTransaction(async () => {
        throw new Error("write failed");
      })
    ).rejects.toThrow("write failed");

    expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnection.commit).not.toHaveBeenCalled();
    expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });
});
