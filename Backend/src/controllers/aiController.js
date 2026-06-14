const aiModel = require("../models/aiModel");
const messageModel = require("../models/messageModel");
const {
  isUserInConversation,
  getConversationById
} = require("../models/directMessageModel");
const aiService = require("../services/aiService");

const getUserId = (req) => req.user?.user_id || req.user?.id;

const ensureChannelAccess = async (channelId, userId, res) => {
  if (!channelId) {
    res.status(400);
    throw new Error("Channel ID is required.");
  }

  const isMember = await messageModel.isUserMemberOfChannelServer(
    channelId,
    userId
  );

  if (!isMember) {
    res.status(403);
    throw new Error("You are not allowed to use AI in this channel.");
  }
};

const ensureConversationAccess = async (conversationId, userId, res) => {
  if (!conversationId) {
    res.status(400);
    throw new Error("Conversation ID is required.");
  }

  const [conversation, isMember] = await Promise.all([
    getConversationById(conversationId),
    isUserInConversation(conversationId, userId)
  ]);

  if (!conversation) {
    res.status(404);
    throw new Error("Direct conversation not found.");
  }

  if (!isMember) {
    res.status(403);
    throw new Error("You are not allowed to use AI in this conversation.");
  }
};

const askChannelAi = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = getUserId(req);
    const prompt = req.body?.prompt || req.body?.question || "";
    const limit = req.body?.limit || req.query?.limit;

    await ensureChannelAccess(channelId, userId, res);

    const context = await aiModel.getChannelConversationContext(channelId, limit);
    const result = await aiService.askAssistant({ prompt, context });

    res.status(200).json({
      message: "AI response generated successfully.",
      data: {
        ...result,
        context: {
          type: context.type,
          title: context.title,
          message_count: context.messages.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const askDirectAi = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = getUserId(req);
    const prompt = req.body?.prompt || req.body?.question || "";
    const limit = req.body?.limit || req.query?.limit;

    await ensureConversationAccess(conversationId, userId, res);

    const context = await aiModel.getDirectConversationContext(
      conversationId,
      userId,
      limit
    );
    const result = await aiService.askAssistant({ prompt, context });

    res.status(200).json({
      message: "AI response generated successfully.",
      data: {
        ...result,
        context: {
          type: context.type,
          title: context.title,
          message_count: context.messages.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getChannelIntelligence = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = getUserId(req);
    const limit = req.body?.limit || req.query?.limit;

    await ensureChannelAccess(channelId, userId, res);

    const context = await aiModel.getChannelConversationContext(channelId, limit);
    const intelligence = await aiService.generateConversationIntelligence({
      context
    });

    res.status(200).json({
      message: "Conversation intelligence generated successfully.",
      data: {
        ...intelligence,
        context: {
          type: context.type,
          title: context.title,
          message_count: context.messages.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getDirectIntelligence = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = getUserId(req);
    const limit = req.body?.limit || req.query?.limit;

    await ensureConversationAccess(conversationId, userId, res);

    const context = await aiModel.getDirectConversationContext(
      conversationId,
      userId,
      limit
    );
    const intelligence = await aiService.generateConversationIntelligence({
      context
    });

    res.status(200).json({
      message: "Conversation intelligence generated successfully.",
      data: {
        ...intelligence,
        context: {
          type: context.type,
          title: context.title,
          message_count: context.messages.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  askChannelAi,
  askDirectAi,
  getChannelIntelligence,
  getDirectIntelligence
};
