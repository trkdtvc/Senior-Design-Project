jest.mock("../../src/models/userModel", () => ({
  findUserCredentialsById: jest.fn()
}));

jest.mock("../../src/models/messageModel", () => ({
  isUserMemberOfChannelServer: jest.fn()
}));

jest.mock("../../src/models/directMessageModel", () => ({
  isUserInConversation: jest.fn(),
  getConversationById: jest.fn()
}));

jest.mock("../../src/models/aiModel", () => ({
  getChannelConversationContext: jest.fn(),
  getDirectConversationContext: jest.fn(),
  getChannelQuestionContext: jest.fn(),
  getDirectQuestionContext: jest.fn()
}));

jest.mock("../../src/services/aiService", () => ({
  askAssistant: jest.fn(),
  generateConversationIntelligence: jest.fn(),
  getConfiguredProvider: jest.fn()
}));

const request = require("supertest");
const { signAuthToken } = require("../../src/services/authTokenService");
const app = require("../../src/app");
const userModel = require("../../src/models/userModel");
const messageModel = require("../../src/models/messageModel");
const directModel = require("../../src/models/directMessageModel");
const aiModel = require("../../src/models/aiModel");
const aiService = require("../../src/services/aiService");

const USER = {
  user_id: 71,
  username: "alice",
  email: "alice@example.com",
  password_hash: "hash:GoodPassword1!",
  is_verified: 1
};

const token = signAuthToken(USER, { expiresIn: "1h" });

describe("AI route integration flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userModel.findUserCredentialsById.mockResolvedValue({ ...USER });
    messageModel.isUserMemberOfChannelServer.mockResolvedValue(true);
    directModel.getConversationById.mockResolvedValue({
      conversation_id: 90,
      user_one_id: USER.user_id,
      user_two_id: 72
    });
    directModel.isUserInConversation.mockResolvedValue(true);

    aiModel.getChannelQuestionContext.mockResolvedValue({
      type: "channel",
      title: "#general",
      retrieval: { search_terms: ["deadline"] },
      messages: [
        {
          message_id: 1,
          author: "alice",
          content: "The deadline is Friday."
        }
      ]
    });
    aiModel.getDirectQuestionContext.mockResolvedValue({
      type: "direct_message",
      title: "Alice and Bob",
      retrieval: { search_terms: ["meeting"] },
      messages: []
    });
    aiModel.getChannelConversationContext.mockResolvedValue({
      type: "channel",
      title: "#general",
      retrieval: {},
      messages: []
    });
    aiService.askAssistant.mockResolvedValue({
      provider: "gemini",
      model: "gemini-test",
      answer: "The deadline is Friday.",
      sources: [{ message_id: 1 }]
    });
    aiService.generateConversationIntelligence.mockResolvedValue({
      provider: "gemini",
      model: "gemini-test",
      summary: "Project discussion",
      action_items: [],
      unanswered_questions: [],
      suggested_pins: []
    });
  });

  test("requires channel membership before AI can read channel context", async () => {
    messageModel.isUserMemberOfChannelServer.mockResolvedValue(false);

    const response = await request(app)
      .post("/api/ai/channels/12/ask")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "What is the deadline?" });

    expect(response.statusCode).toBe(403);
    expect(aiModel.getChannelQuestionContext).not.toHaveBeenCalled();
    expect(aiService.askAssistant).not.toHaveBeenCalled();
  });

  test("asks the configured AI using only an authorized channel context", async () => {
    const response = await request(app)
      .post("/api/ai/channels/12/ask")
      .set("Authorization", `Bearer ${token}`)
      .send({
        prompt: "What is the deadline?",
        history: [{ role: "user", content: "Earlier question" }]
      });

    expect(response.statusCode).toBe(200);
    expect(aiModel.getChannelQuestionContext).toHaveBeenCalledWith(
      "12",
      "What is the deadline?",
      undefined
    );
    expect(aiService.askAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "What is the deadline?",
        context: expect.objectContaining({ title: "#general" }),
        history: [{ role: "user", content: "Earlier question" }]
      })
    );
    expect(response.body.data.answer).toContain("Friday");
    expect(response.body.data.context.message_count).toBe(1);
  });

  test("requires DM participation before AI can read a direct conversation", async () => {
    directModel.isUserInConversation.mockResolvedValue(false);

    const response = await request(app)
      .post("/api/ai/direct/90/ask")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "What did we decide?" });

    expect(response.statusCode).toBe(403);
    expect(aiService.askAssistant).not.toHaveBeenCalled();
  });

  test("returns 404 when the requested direct conversation does not exist", async () => {
    directModel.getConversationById.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/ai/direct/999/ask")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "What did we decide?" });

    expect(response.statusCode).toBe(404);
  });

  test("generates channel conversation intelligence for a member", async () => {
    const response = await request(app)
      .post("/api/ai/channels/12/intelligence")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.statusCode).toBe(200);
    expect(aiService.generateConversationIntelligence).toHaveBeenCalledWith({
      context: expect.objectContaining({ type: "channel" })
    });
    expect(response.body.data.summary).toBe("Project discussion");
  });
});
