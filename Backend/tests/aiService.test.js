const aiService = require("../src/services/aiService");

describe("AI service local conversation assistant", () => {
  const originalProvider = process.env.AI_PROVIDER;

  beforeEach(() => {
    process.env.AI_PROVIDER = "local";
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    if (originalProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = originalProvider;
    }
  });

  test("generates summary, action items, questions, and suggested pins from context", async () => {
    const intelligence = await aiService.generateConversationIntelligence({
      context: {
        title: "#general",
        type: "channel",
        messages: [
          {
            id: 1,
            author: "Tarik",
            content: "We need to implement the AI bot before testing.",
            created_at: "2026-06-14T10:00:00Z"
          },
          {
            id: 2,
            author: "Aid",
            content: "Should we use Selenium for browser testing?",
            created_at: "2026-06-14T10:01:00Z"
          },
          {
            id: 3,
            author: "Tarik",
            content: "Important: deployment comes after testing.",
            created_at: "2026-06-14T10:02:00Z"
          }
        ]
      }
    });

    expect(intelligence.provider).toBe("local");
    expect(intelligence.summary).toContain("#general");
    expect(intelligence.action_items.length).toBeGreaterThan(0);
    expect(intelligence.unanswered_questions.length).toBeGreaterThan(0);
    expect(intelligence.suggested_pins.length).toBeGreaterThan(0);
  });

  test("askAssistant gives a direct local answer from relevant messages", async () => {
    const response = await aiService.askAssistant({
      prompt: "Does anyone mention an appointment?",
      context: {
        title: "Project chat",
        type: "channel",
        retrieval: { search_terms: ["appointment"] },
        messages: [
          {
            id: 1,
            message_id: 1,
            author: "Tarik",
            content: "I have an appointment tomorrow at 2pm.",
            created_at: "2026-06-14T10:00:00Z"
          }
        ]
      }
    });

    expect(response.provider).toBe("local");
    expect(response.answer).toContain("Yes");
    expect(response.answer).toContain("Tarik");
    expect(response.answer).toContain("appointment tomorrow at 2pm");
    expect(response.sources).toHaveLength(1);
  });

  test("extractSearchTerms corrects common long typos", () => {
    const terms = aiService.extractSearchTerms(
      "does anyone mention an appontmnnet?"
    );

    expect(terms).toContain("appointment");
  });
});
