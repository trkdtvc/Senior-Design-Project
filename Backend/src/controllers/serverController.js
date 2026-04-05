const serverModel = require("../models/serverModel");

const createServer = async (req, res, next) => {
  try {
    const { server_name, description } = req.body;
    const ownerId = req.user.user_id;

    if (!server_name) {
      res.status(400);
      throw new Error("Server name is required");
    }

    const serverResult = await serverModel.createServer(
      ownerId,
      server_name,
      description || null
    );

    const serverId = serverResult.insertId;

    await serverModel.addServerMember(serverId, ownerId);
    await serverModel.createDefaultChannel(serverId);

    res.status(201).json({
      message: "Server created successfully",
      server_id: serverId
    });
  } catch (error) {
    next(error);
  }
};

const getUserServers = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const servers = await serverModel.getServersByUserId(userId);

    res.status(200).json(servers);
  } catch (error) {
    next(error);
  }
};

const deleteServer = async (req, res, next) => {
  try {
    const serverId = Number(req.params.serverId);
    const userId = req.user.user_id;

    const server = await serverModel.getServerById(serverId);

    if (!server) {
      res.status(404);
      throw new Error("Server not found");
    }

    if (server.owner_id !== userId) {
      res.status(403);
      throw new Error("Only the server owner can delete this server");
    }

    await serverModel.deleteServer(serverId);

    res.status(200).json({
      message: "Server deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createServer,
  getUserServers,
  deleteServer
};