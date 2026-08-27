const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || process.env.AI_MODEL || "gemini-2.5-flash";
const OPENAI_API_URL =
  process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
const GEMINI_API_BASE_URL =
  process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com/v1beta";

const MAX_PROMPT_LENGTH = 1800;
const MAX_TRANSCRIPT_MESSAGES = 80;
const MAX_SOURCE_MESSAGES = 6;
const MAX_HISTORY_MESSAGES = 8;
const MAX_GEMINI_OUTPUT_TOKENS = 900;
const MAX_OPENAI_OUTPUT_TOKENS = 900;
const parsedProviderTimeoutMs = Number.parseInt(
  process.env.AI_PROVIDER_TIMEOUT_MS || "45000",
  10
);
const AI_PROVIDER_TIMEOUT_MS =
  Number.isFinite(parsedProviderTimeoutMs) && parsedProviderTimeoutMs > 0
    ? parsedProviderTimeoutMs
    : 45000;

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "anyone",
  "because",
  "before",
  "being",
  "could",
  "does",
  "doing",
  "from",
  "have",
  "here",
  "into",
  "just",
  "like",
  "mention",
  "mentioned",
  "more",
  "much",
  "need",
  "only",
  "please",
  "should",
  "some",
  "something",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "your"
]);

const SEARCH_SYNONYMS = {
  appointment: ["appointment", "appointments", "meeting", "meet", "schedule", "scheduled", "call"],
  appointments: ["appointment", "appointments", "meeting", "schedule", "scheduled"],
  meeting: ["meeting", "meet", "appointment", "call", "schedule"],
  deadline: ["deadline", "due", "finish", "final", "submit", "submission"],
  decide: ["decide", "decided", "decision", "agree", "agreed", "final"],
  decided: ["decide", "decided", "decision", "agree", "agreed", "final"],
  decision: ["decide", "decided", "decision", "agree", "agreed", "final"],
  task: ["task", "todo", "to do", "need to", "should", "finish", "implement"],
  tasks: ["task", "tasks", "todo", "to do", "need to", "should", "finish", "implement"],
  bug: ["bug", "issue", "problem", "error", "broken", "fix"],
  issue: ["issue", "problem", "bug", "error", "broken", "fix"],
  problem: ["problem", "issue", "bug", "error", "broken", "fix"],
  deploy: ["deploy", "deployment", "production", "host", "hosting"],
  deployment: ["deploy", "deployment", "production", "host", "hosting"],
  test: ["test", "testing", "selenium", "unit", "jest", "qa"],
  testing: ["test", "testing", "selenium", "unit", "jest", "qa"],
  password: ["password", "pass", "reset", "login", "credential"],
  login: ["login", "log in", "signin", "sign in", "auth", "password"],
  email: ["email", "mail", "gmail", "smtp"],
  file: ["file", "attachment", "upload", "download"],
  attachment: ["attachment", "file", "upload", "download"],
  ai: ["ai", "bot", "assistant", "openai", "gemini", "chatgpt"]
};

const KNOWN_SEARCH_WORDS = Object.keys(SEARCH_SYNONYMS);

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

const normalizeTextForSearch = (value = "") =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const levenshteinDistance = (left = "", right = "") => {
  const a = String(left || "");
  const b = String(right || "");

  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
};

const correctLikelySearchTypo = (token) => {
  if (!token || token.length < 6) {
    return token;
  }

  let bestMatch = token;
  let bestDistance = Number.POSITIVE_INFINITY;

  KNOWN_SEARCH_WORDS.forEach((knownWord) => {
    const distance = levenshteinDistance(token, knownWord);
    const maxAllowedDistance = knownWord.length >= 9 ? 4 : 3;

    if (distance < bestDistance && distance <= maxAllowedDistance) {
      bestMatch = knownWord;
      bestDistance = distance;
    }
  });

  return bestMatch;
};

const extractSearchTerms = (prompt = "") => {
  const normalizedPrompt = normalizeTextForSearch(prompt);
  const rawTokens = normalizedPrompt
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
  const terms = new Set();

  rawTokens.forEach((rawToken) => {
    const token = correctLikelySearchTypo(rawToken);

    if (token.length < 3 || STOP_WORDS.has(token)) {
      return;
    }

    terms.add(token);

    const singularToken = token.endsWith("s") ? token.slice(0, -1) : token;

    if (singularToken.length >= 3 && !STOP_WORDS.has(singularToken)) {
      terms.add(singularToken);
    }

    (SEARCH_SYNONYMS[token] || SEARCH_SYNONYMS[singularToken] || []).forEach(
      (synonym) => terms.add(synonym)
    );
  });

  return [...terms]
    .map((term) => normalizeTextForSearch(term))
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term))
    .slice(0, 18);
};

const normalizeContext = (context = {}) => ({
  title: context.title || "Conversation",
  type: context.type || "conversation",
  retrieval: context.retrieval || {},
  messages: Array.isArray(context.messages)
    ? context.messages.slice(-MAX_TRANSCRIPT_MESSAGES).map((message) => ({
        id: message.id || message.message_id || message.direct_message_id,
        message_id: message.message_id || message.id || null,
        direct_message_id: message.direct_message_id || null,
        author: message.author || message.username || message.sender_username || "Unknown user",
        content: clampText(message.content || "", 1000),
        created_at: message.created_at || null
      }))
    : []
});

const normalizeAiHistory = (history = []) => {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((item) => item && item.role && item.content)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: clampText(item.content, 800)
    }));
};

const buildTranscript = (context = {}) => {
  const normalizedContext = normalizeContext(context);

  if (!normalizedContext.messages.length) {
    return "No relevant messages were found for this question.";
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

const buildAiHistoryText = (history = []) => {
  const normalizedHistory = normalizeAiHistory(history);

  if (!normalizedHistory.length) {
    return "No previous AI assistant messages in this panel.";
  }

  return normalizedHistory
    .map((item) => `${item.role === "assistant" ? "Assistant" : "User"}: ${item.content}`)
    .join("\n");
};

const keywordScore = (message, keywords) => {
  const content = normalizeTextForSearch(message.content || "");

  return keywords.reduce((score, keyword) => {
    if (!keyword) {
      return score;
    }

    const normalizedKeyword = normalizeTextForSearch(keyword);

    if (normalizedKeyword && content.includes(normalizedKeyword)) {
      return score + (normalizedKeyword.includes(" ") ? 2 : 1);
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
      message_id: message.message_id || message.id,
      direct_message_id: message.direct_message_id || null,
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
      message_id: message.message_id || message.id,
      direct_message_id: message.direct_message_id || null,
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
      message_id: message.message_id || message.id,
      direct_message_id: message.direct_message_id || null,
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
            direct_message_id: moment.direct_message_id || null,
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

const createSourceFromMessage = (message) => ({
  message_id: message.message_id || message.id || null,
  direct_message_id: message.direct_message_id || null,
  author: message.author || "Unknown user",
  content: clampText(message.content, 300),
  created_at: message.created_at || null
});

const rankMessagesForQuestion = (messages = [], prompt = "", contextTerms = []) => {
  const terms = contextTerms.length ? contextTerms : extractSearchTerms(prompt);

  return getMeaningfulMessages(messages)
    .map((message, index) => ({
      ...message,
      originalIndex: index,
      score: keywordScore(message, terms)
    }))
    .filter((message) => (terms.length ? message.score > 0 : true))
    .sort((a, b) => b.score - a.score || b.originalIndex - a.originalIndex);
};

const getSourceMessages = (context = {}, prompt = "") => {
  const normalizedContext = normalizeContext(context);
  const contextTerms = Array.isArray(normalizedContext.retrieval?.search_terms)
    ? normalizedContext.retrieval.search_terms
    : extractSearchTerms(prompt);
  const rankedMessages = rankMessagesForQuestion(
    normalizedContext.messages,
    prompt,
    contextTerms
  );
  const fallbackMessages = getMeaningfulMessages(normalizedContext.messages).slice(-MAX_SOURCE_MESSAGES);
  const selectedMessages = rankedMessages.length ? rankedMessages : fallbackMessages;

  return selectedMessages.slice(0, MAX_SOURCE_MESSAGES).map(createSourceFromMessage);
};

const isYesNoLookupQuestion = (prompt = "") => {
  const normalizedPrompt = normalizeTextForSearch(prompt);

  return /\b(does|did|do|is|are|was|were|has|have|anyone)\b/.test(normalizedPrompt);
};

const isTimeQuestion = (prompt = "") =>
  /\b(what\s+time|which\s+time|at\s+what\s+time|time)\b/i.test(prompt);

const isWhenQuestion = (prompt = "") =>
  /\b(when|what\s+day|which\s+day|date)\b/i.test(prompt);

const extractTimeText = (content = "") => {
  const timeMatch = String(content).match(
    /\b(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s?(?:am|pm)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b/i
  );

  return timeMatch ? timeMatch[0].replace(/\s+/g, "") : "";
};

const extractDateText = (content = "") => {
  const dateMatch = String(content).match(
    /\b(today|tonight|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\b/i
  );

  return dateMatch ? dateMatch[0] : "";
};

const buildLocalQuestionAnswer = ({ prompt, context }) => {
  const normalizedContext = normalizeContext(context);
  const sources = getSourceMessages(normalizedContext, prompt);

  if (!sources.length) {
    return {
      provider: "local",
      model: "local-conversation-search",
      answer: `I could not find a relevant message for that question in ${normalizedContext.title}.`,
      sources: [],
      confidence: "low",
      generated_at: new Date().toISOString()
    };
  }

  const [bestSource] = sources;
  const quotedContent = `“${bestSource.content}”`;
  const timeText = extractTimeText(bestSource.content);
  const dateText = extractDateText(bestSource.content);

  let answer;

  if (isTimeQuestion(prompt) && timeText) {
    answer = `The appointment is at ${timeText}. ${bestSource.author} said: ${quotedContent}`;
  } else if (isWhenQuestion(prompt) && (dateText || timeText)) {
    const whenText = [dateText, timeText ? `at ${timeText}` : ""].filter(Boolean).join(" ");
    answer = `It is ${whenText}. ${bestSource.author} said: ${quotedContent}`;
  } else if (isYesNoLookupQuestion(prompt)) {
    answer = `Yes. ${bestSource.author} said: ${quotedContent}`;
  } else {
    answer = `${bestSource.author} said: ${quotedContent}`;
  }

  if (sources.length > 1) {
    answer += ` I also found ${sources.length - 1} other relevant message${sources.length - 1 === 1 ? "" : "s"} below.`;
  }

  return {
    provider: "local",
    model: "local-conversation-search",
    answer,
    sources,
    confidence: bestSource.content ? "medium" : "low",
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

const extractGeminiText = (data) => {
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();

  if (text) {
    return text;
  }

  const blockReason = data?.promptFeedback?.blockReason;

  if (blockReason) {
    throw new Error(`Gemini blocked the request: ${blockReason}.`);
  }

  return "";
};

const fetchAiProvider = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_PROVIDER_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        `The AI provider timed out after ${Math.round(AI_PROVIDER_TIMEOUT_MS / 1000)} seconds. Please try again.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const getConfiguredProvider = () => {
  const requestedProvider = String(process.env.AI_PROVIDER || "local")
    .trim()
    .toLowerCase();

  if (requestedProvider === "local") {
    return "local";
  }

  if (requestedProvider === "gemini") {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "AI_PROVIDER is set to gemini, but GEMINI_API_KEY is missing."
      );
    }

    return "gemini";
  }

  if (requestedProvider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "AI_PROVIDER is set to openai, but OPENAI_API_KEY is missing."
      );
    }

    return "openai";
  }

  throw new Error(
    `Unsupported AI_PROVIDER "${requestedProvider}". Use local, gemini, or openai.`
  );
};

const callOpenAi = async ({ systemPrompt, userPrompt, jsonMode = false }) => {
  const response = await fetchAiProvider(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || process.env.AI_MODEL || DEFAULT_OPENAI_MODEL,
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
      temperature: 0.3,
      max_tokens: MAX_OPENAI_OUTPUT_TOKENS,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {})
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        "The OpenAI provider could not complete the request. Please try again."
    );
  }

  return extractOpenAiText(data);
};

const normalizeGeminiModelName = (model = DEFAULT_GEMINI_MODEL) =>
  String(model || DEFAULT_GEMINI_MODEL).replace(/^models\//, "").trim();

const callGemini = async ({ systemPrompt, userPrompt, jsonMode = false }) => {
  const model = normalizeGeminiModelName(process.env.GEMINI_MODEL || process.env.AI_MODEL || DEFAULT_GEMINI_MODEL);
  const response = await fetchAiProvider(
    `${GEMINI_API_BASE_URL.replace(/\/$/, "")}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: systemPrompt
            }
          ]
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: userPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: MAX_GEMINI_OUTPUT_TOKENS,
          ...(jsonMode ? { responseMimeType: "application/json" } : {})
        }
      })
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        "The Gemini provider could not complete the request. Please try again."
    );
  }

  return extractGeminiText(data);
};

const buildAssistantSystemPrompt = () =>
  "You are the built-in AI assistant in a modern chat application. " +
  "Speak naturally, like a helpful human assistant in a chat. " +
  "When the user asks about the current conversation, answer using the retrieved chat messages. " +
  "Do not dump a generic summary unless the user asks for one. " +
  "If the retrieved messages contain the answer, give the exact answer first, then mention who said it and quote the useful message. " +
  "If the user asks for a time, date, person, decision, task, file, or appointment, extract that exact detail directly. " +
  "If the retrieved messages do not answer a conversation-specific question, say you could not find it in this conversation. " +
  "If the user asks a normal general question that is not about the conversation, answer normally. " +
  "Never invent chat facts that are not present in the retrieved messages. Keep answers concise and useful.";

const buildAssistantUserPrompt = ({ prompt, context, history }) => {
  const normalizedContext = normalizeContext(context);
  const transcript = buildTranscript(normalizedContext);
  const historyText = buildAiHistoryText(history);

  return (
    `Current chat: ${normalizedContext.title}\n` +
    `Chat type: ${normalizedContext.type}\n` +
    `Retrieved message count: ${normalizedContext.messages.length}\n` +
    `Retrieval mode: ${normalizedContext.retrieval?.mode || "unknown"}\n\n` +
    `Recent AI panel history:\n${historyText}\n\n` +
    `Retrieved chat messages:\n${transcript}\n\n` +
    `User's latest question:\n${prompt}\n\n` +
    "Answer the latest question naturally. If the answer comes from the chat, use only the retrieved chat messages as evidence."
  );
};

const askAssistant = async ({ prompt, context, history = [] }) => {
  const safePrompt = normalizePrompt(prompt);
  const normalizedContext = normalizeContext(context);
  const sources = getSourceMessages(normalizedContext, safePrompt);
  const provider = getConfiguredProvider();

  if (!safePrompt) {
    throw new Error("AI question is required.");
  }

  if (provider === "local") {
    return buildLocalQuestionAnswer({ prompt: safePrompt, context: normalizedContext });
  }

  const userPrompt = buildAssistantUserPrompt({
    prompt: safePrompt,
    context: normalizedContext,
    history
  });
  const systemPrompt = buildAssistantSystemPrompt();
  const answer = provider === "gemini"
    ? await callGemini({ systemPrompt, userPrompt, jsonMode: false })
    : await callOpenAi({ systemPrompt, userPrompt, jsonMode: false });

  return {
    provider,
    model:
      provider === "gemini"
        ? normalizeGeminiModelName(process.env.GEMINI_MODEL || process.env.AI_MODEL || DEFAULT_GEMINI_MODEL)
        : process.env.OPENAI_MODEL || process.env.AI_MODEL || DEFAULT_OPENAI_MODEL,
    answer: answer || `I could not find a relevant answer in ${normalizedContext.title}.`,
    sources,
    confidence: normalizedContext.messages.length ? "high" : "low",
    generated_at: new Date().toISOString()
  };
};

const generateConversationIntelligence = async ({ context }) => {
  const normalizedContext = normalizeContext(context);
  const transcript = buildTranscript(normalizedContext);
  const provider = getConfiguredProvider();

  if (provider === "local") {
    return buildLocalIntelligence(normalizedContext);
  }

  const systemPrompt =
    "You generate conversation intelligence for a chat app. Return strict JSON only. Do not invent facts. Keep every field short and useful.";
  const userPrompt =
    `Analyze this ${normalizedContext.type} and return JSON with exactly these keys: ` +
    `summary, decisions, action_items, unanswered_questions, important_moments, suggested_pins, next_best_step. ` +
    `decisions should be an array of objects with text, author, message_id, created_at. ` +
    `action_items should be an array of objects with task, owner, message_id, created_at. ` +
    `unanswered_questions should be an array of objects with question, author, message_id, created_at. ` +
    `important_moments and suggested_pins should be arrays of objects with content, author, message_id, created_at.\n\n` +
    `Conversation title: ${normalizedContext.title}\nTranscript:\n${transcript}`;

  const text = provider === "gemini"
    ? await callGemini({ systemPrompt, userPrompt, jsonMode: true })
    : await callOpenAi({ systemPrompt, userPrompt, jsonMode: true });

  const parsed = parseJsonFromText(text);
  const localFallback = buildLocalIntelligence(normalizedContext);

  return {
    ...localFallback,
    ...(parsed || { summary: text || localFallback.summary }),
    provider,
    model:
      provider === "gemini"
        ? normalizeGeminiModelName(process.env.GEMINI_MODEL || process.env.AI_MODEL || DEFAULT_GEMINI_MODEL)
        : process.env.OPENAI_MODEL || process.env.AI_MODEL || DEFAULT_OPENAI_MODEL,
    generated_at: new Date().toISOString()
  };
};

module.exports = {
  buildTranscript,
  buildLocalIntelligence,
  generateConversationIntelligence,
  askAssistant,
  normalizePrompt,
  extractSearchTerms,
  buildLocalQuestionAnswer,
  getConfiguredProvider,
  extractTimeText,
  extractDateText
};
