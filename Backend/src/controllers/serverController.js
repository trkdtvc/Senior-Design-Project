const serverModel = require("../models/serverModel");

const createServer = async (req, res) => {
  try {
    const { server_name, server_description } = req.body;
    const ownerId = req.user.user_id;

    if (!server_name) {
      return res.status(400).json({ message: "Server name is required" });
    }

    const serverResult = await serverModel.createServer(
      ownerId,
      server_name,
      server_description || null
    );

    const serverId = serverResult.insertId;

    await serverModel.addServerMember(serverId, ownerId);
    await serverModel.createDefaultChannel(serverId);

    return res.status(201).json({
      message: "Server created successfully",
      server_id: serverId
    });
  } catch (error) {
    console.error("Create server error:", error);
    return res.status(500).json({ message: "Server creation failed" });
  }
};

const getUserServers = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const servers = await serverModel.getServersByUserId(userId);

    return res.status(200).json(servers);
  } catch (error) {
    console.error("Get user servers error:", error);
    return res.status(500).json({ message: "Failed to fetch servers" });
  }
};

module.exports = {
  createServer,
  getUserServers
};