const DEFAULT_AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const OPENAI_API_URL =
  process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
const MAX_PROMPT_LENGTH = 1200;
const MAX_TRANSCRIPT_MESSAGES = 80;

const clampText = (value = "", maxLength = 2000) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
};

const normalizePrompt = (prompt) => clampText(prompt, MAX_PROMPT_LENGTH);

const formatTimestamp = (value) => {
  if (!value) {
    return "Unknown time";
  }

  try {
    return new Date(value).toISOString();
  } catch (error) {
    return String(value);
  }
};

const normalizeContext = (context = {}) => ({
  title: context.title || "Conversation",
  type: context.type || "conversation",
  messages: Array.isArray(context.messages)
    ? context.messages.slice(-MAX_TRANSCRIPT_MESSAGES).map((message) => ({
        id: message.id,
        author: message.author || "Unknown user",
        content: clampText(message.content || "", 700),
        created_at: message.created_at || null
      }))
    : []
});

const buildTranscript = (context = {}) => {
  const normalizedContext = normalizeContext(context);

  if (!normalizedContext.messages.length) {
    return "No messages are available in this conversation yet.";
  }

  return normalizedContext.messages
    .map((message, index) => {
      const messageNumber = index + 1;
      const timestamp = formatTimestamp(message.created_at);
      const content = message.content || "[empty message]";

      return `${messageNumber}. [${timestamp}] ${message.author}: ${content}`;
    })
    .join("\n");
};

const keywordScore = (message, keywords) => {
  const content = String(message.content || "").toLowerCase();

  return keywords.reduce((score, keyword) => {
    if (keyword && content.includes(keyword)) {
      return score + 1;
    }

    return score;
  }, 0);
};

const getMeaningfulMessages = (messages = []) =>
  messages.filter((message) => String(message.content || "").trim().length > 0);

const pickImportantMessages = (messages = [], limit = 5) => {
  const importantWords = [
    "important",
    "decided",
    "decision",
    "deadline",
    "todo",
    "task",
    "fix",
    "bug",
    "problem",
    "issue",
    "question",
    "should",
    "need",
    "must",
    "next",
    "final"
  ];

  return getMeaningfulMessages(messages)
    .map((message) => ({
      ...message,
      score:
        keywordScore(message, importantWords) +
        Math.min(String(message.content || "").length / 200, 3)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((message) => ({
      message_id: message.id,
      author: message.author,
      content: clampText(message.content, 180),
      created_at: message.created_at
    }));
};

const extractQuestions = (messages = [], limit = 5) =>
  getMeaningfulMessages(messages)
    .filter((message) => String(message.content || "").includes("?"))
    .slice(-limit)
    .map((message) => ({
      message_id: message.id,
      author: message.author,
      question: clampText(message.content, 180),
      created_at: message.created_at
    }));

const extractActionItems = (messages = [], limit = 6) => {
  const actionWords = [
    "todo",
    "to do",
    "need to",
    "needs to",
    "should",
    "must",
    "fix",
    "implement",
    "finish",
    "deploy",
    "test",
    "review"
  ];

  return getMeaningfulMessages(messages)
    .filter((message) => keywordScore(message, actionWords) > 0)
    .slice(-limit)
    .map((message) => ({
      message_id: message.id,
      owner: message.author,
      task: clampText(message.content, 180),
      created_at: message.created_at
    }));
};

const buildLocalSummary = (context = {}) => {
  const normalizedContext = normalizeContext(context);
  const messages = normalizedContext.messages;
  const meaningfulMessages = getMeaningfulMessages(messages);
  const participants = [...new Set(meaningfulMessages.map((message) => message.author))];
  const latestMessages = meaningfulMessages.slice(-5);
  const topicPreview = latestMessages
    .map((message) => `${message.author}: ${clampText(message.content, 120)}`)
    .join(" ");

  if (!meaningfulMessages.length) {
    return `There are no readable messages in ${normalizedContext.title} yet.`;
  }

  return clampText(
    `${normalizedContext.title} has ${meaningfulMessages.length} recent message${
      meaningfulMessages.length === 1 ? "" : "s"
    } from ${participants.slice(0, 5).join(", ") || "the participants"}. Recent discussion: ${topicPreview}`,
    650
  );
};

const buildLocalIntelligence = (context = {}) => {
  const normalizedContext = normalizeContext(context);
  const messages = normalizedContext.messages;
  const actionItems = extractActionItems(messages);
  const unansweredQuestions = extractQuestions(messages);
  const importantMoments = pickImportantMessages(messages);

  return {
    provider: "local",
    model: "local-conversation-intelligence",
    title: normalizedContext.title,
    summary: buildLocalSummary(normalizedContext),
    decisions:
      importantMoments.length > 0
        ? importantMoments.slice(0, 3).map((moment) => ({
            message_id: moment.message_id,
            text: moment.content,
            author: moment.author,
            created_at: moment.created_at
          }))
        : [],
    action_items: actionItems,
    unanswered_questions: unansweredQuestions,
    important_moments: importantMoments,
    suggested_pins: importantMoments.slice(0, 3),
    next_best_step:
      actionItems[0]?.task ||
      unansweredQuestions[0]?.question ||
      "Continue the conversation or ask the AI assistant a specific question.",
    generated_at: new Date().toISOString()
  };
};

const parseJsonFromText = (text) => {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return null;
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch (nestedError) {
      return null;
    }
  }
};

const extractOpenAiText = (data) => {
  if (typeof data?.output_text === "string") {
    return data.output_text.trim();
  }

  const chatContent = data?.choices?.[0]?.message?.content;

  if (typeof chatContent === "string") {
    return chatContent.trim();
  }

  if (Array.isArray(data?.output)) {
    return data.output
      .flatMap((item) => item.content || [])
      .map((contentItem) => contentItem.text || "")
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
};

const shouldUseOpenAi = () =>
  process.env.AI_PROVIDER !== "local" && Boolean(process.env.OPENAI_API_KEY);

const callOpenAi = async ({ systemPrompt, userPrompt, jsonMode = false }) => {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEFAULT_AI_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.2,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {})
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        "The AI provider could not complete the request. Please try again."
    );
  }

  return extractOpenAiText(data);
};

const askAssistant = async ({ prompt, context }) => {
  const safePrompt = normalizePrompt(prompt);
  const normalizedContext = normalizeContext(context);

  if (!safePrompt) {
    throw new Error("AI question is required.");
  }

  const transcript = buildTranscript(normalizedContext);

  if (!shouldUseOpenAi()) {
    const intelligence = buildLocalIntelligence(normalizedContext);

    return {
      provider: "local",
      model: "local-conversation-assistant",
      answer:
        `${intelligence.summary}\n\nBased on your question, the most relevant next point is: ${intelligence.next_best_step}`,
      generated_at: new Date().toISOString()
    };
  }

  const answer = await callOpenAi({
    systemPrompt:
      "You are the built-in AI assistant for a student chat application. Answer using only the supplied conversation transcript. Be concise, useful, safe, and honest when the transcript does not contain enough information.",
    userPrompt: `Conversation title: ${normalizedContext.title}\nConversation type: ${normalizedContext.type}\n\nTranscript:\n${transcript}\n\nUser question:\n${safePrompt}`,
    jsonMode: false
  });

  return {
    provider: "openai",
    model: DEFAULT_AI_MODEL,
    answer,
    generated_at: new Date().toISOString()
  };
};

const generateConversationIntelligence = async ({ context }) => {
  const normalizedContext = normalizeContext(context);
  const transcript = buildTranscript(normalizedContext);

  if (!shouldUseOpenAi()) {
    return buildLocalIntelligence(normalizedContext);
  }

  const text = await callOpenAi({
    systemPrompt:
      "You generate conversation intelligence for a chat app. Return strict JSON only. Do not invent facts. Keep every field short and useful.",
    userPrompt:
      `Analyze this ${normalizedContext.type} and return JSON with exactly these keys: ` +
      `summary, decisions, action_items, unanswered_questions, important_moments, suggested_pins, next_best_step. ` +
      `decisions should be an array of objects with text, author, message_id, created_at. ` +
      `action_items should be an array of objects with task, owner, message_id, created_at. ` +
      `unanswered_questions should be an array of objects with question, author, message_id, created_at. ` +
      `important_moments and suggested_pins should be arrays of objects with content, author, message_id, created_at.\n\n` +
      `Conversation title: ${normalizedContext.title}\nTranscript:\n${transcript}`,
    jsonMode: true
  });

  const parsed = parseJsonFromText(text);
  const localFallback = buildLocalIntelligence(normalizedContext);

  return {
    ...localFallback,
    ...(parsed || { summary: text || localFallback.summary }),
    provider: "openai",
    model: DEFAULT_AI_MODEL,
    generated_at: new Date().toISOString()
  };
};

module.exports = {
  buildTranscript,
  buildLocalIntelligence,
  generateConversationIntelligence,
  askAssistant,
  normalizePrompt
};
