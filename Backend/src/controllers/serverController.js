const serverModel = require("../models/serverModel");
const { canManageServerContent } = require("../models/permissionModel");
const { deleteStoredFiles } = require("../services/attachmentFileService");

const MAX_SERVER_NAME_LENGTH = 100;
const MAX_SERVER_DESCRIPTION_LENGTH = 500;

const normalizeServerName = (value) => String(value || "").trim();
const normalizeServerDescription = (value) => String(value || "").trim();

const validateServerInput = (serverName, description, res) => {
  if (!serverName) {
    res.status(400);
    throw new Error("Server name is required");
  }

  if (serverName.length > MAX_SERVER_NAME_LENGTH) {
    res.status(400);
    throw new Error(`Server name cannot exceed ${MAX_SERVER_NAME_LENGTH} characters`);
  }

  if (description.length > MAX_SERVER_DESCRIPTION_LENGTH) {
    res.status(400);
    throw new Error(
      `Server description cannot exceed ${MAX_SERVER_DESCRIPTION_LENGTH} characters`
    );
  }
};

const createServer = async (req, res, next) => {
  try {
    const { server_name, description } = req.body || {};
    const ownerId = req.user.user_id;
    const normalizedName = normalizeServerName(server_name);
    const normalizedDescription = normalizeServerDescription(description);

    validateServerInput(normalizedName, normalizedDescription, res);

    const createdServer = await serverModel.createServerWithDefaults(
      ownerId,
      normalizedName,
      normalizedDescription || null
    );

    res.status(201).json({
      message: "Server created successfully",
      server_id: createdServer.server_id
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

const updateServer = async (req, res, next) => {
  try {
    const serverId = Number(req.params.serverId);
    const userId = req.user.user_id;
    const normalizedName = normalizeServerName(req.body?.server_name ?? req.body?.serverName);
    const normalizedDescription = normalizeServerDescription(
      req.body?.description ?? req.body?.server_description
    );

    if (!Number.isInteger(serverId) || serverId <= 0) {
      res.status(400);
      throw new Error("Valid server ID is required");
    }

    validateServerInput(normalizedName, normalizedDescription, res);

    const permission = await canManageServerContent(serverId, userId);

    if (!permission.serverExists) {
      res.status(404);
      throw new Error("Server not found");
    }

    if (!permission.allowed) {
      res.status(403);
      throw new Error("Only server owners and admins can edit this server");
    }

    await serverModel.updateServer(
      serverId,
      normalizedName,
      normalizedDescription || null
    );

    const updatedServer = await serverModel.getServerById(serverId);
    const io = req.app.get("io");

    if (io) {
      io.to(`server_${serverId}`).emit("server_updated", updatedServer);
    }

    res.status(200).json({
      message: "Server updated successfully",
      server: updatedServer
    });
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

    if (Number(server.owner_id) !== Number(userId)) {
      res.status(403);
      throw new Error("Only the server owner can delete this server");
    }

    const attachments = await serverModel.getServerAttachmentUrls(serverId);

    await serverModel.deleteServer(serverId);
    await deleteStoredFiles(attachments);

    const io = req.app.get("io");

    if (io) {
      io.to(`server_${serverId}`).emit("server_deleted", {
        server_id: Number(serverId)
      });
    }

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
  updateServer,
  deleteServer
};
