import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = "gemini-2.5-flash";
const MAX_HISTORY_MESSAGES = 12;
const MAX_DOCUMENT_CHARS_FOR_PROMPT = 60000;

let client;

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error("GEMINI_API_KEY is not configured on the server.");
    error.status = 503;
    error.expose = true;
    throw error;
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  return client;
}

function normalizeRole(role) {
  return role === "assistant" ? "model" : "user";
}

function buildPrompt(message, chat) {
  const documentText = chat.document?.text
    ? chat.document.text.slice(0, MAX_DOCUMENT_CHARS_FOR_PROMPT)
    : "";

  const documentBlock = documentText
    ? `Uploaded document (${chat.document.fileName}):\n${documentText}`
    : "No document has been uploaded in this chat.";

  const imageBlock = chat.image
    ? `An image named ${chat.image.fileName} is attached to this request.`
    : "No image has been uploaded in this chat.";

  return [
    "You are a helpful chatbot in a simple internship assignment app.",
    "Answer naturally and use only the current chat's messages, uploaded document text, and uploaded image when they are relevant.",
    "If the user asks about an earlier upload after no file exists in this chat, say that no files have been uploaded yet.",
    "",
    documentBlock,
    "",
    imageBlock,
    "",
    `User message: ${message}`
  ].join("\n");
}

function buildContents(message, chat) {
  const recentMessages = chat.messages.slice(-MAX_HISTORY_MESSAGES).map((item) => ({
    role: normalizeRole(item.role),
    parts: [{ text: item.text }]
  }));

  const parts = [{ text: buildPrompt(message, chat) }];

  if (chat.image) {
    parts.unshift({
      inlineData: {
        mimeType: chat.image.mimeType,
        data: chat.image.base64
      }
    });
  }

  return [
    ...recentMessages,
    {
      role: "user",
      parts
    }
  ];
}

export async function generateChatResponse(message, chat) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: buildContents(message, chat),
    config: {
      thinkingConfig: {
        thinkingBudget: 0
      }
    }
  });

  const text = response.text?.trim();

  if (!text) {
    const error = new Error("Gemini returned an empty response.");
    error.status = 502;
    throw error;
  }

  return text;
}
