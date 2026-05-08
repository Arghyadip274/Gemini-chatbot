import crypto from "node:crypto";

const chats = new Map();

export function createChat() {
  const chatId = crypto.randomUUID();
  const chat = {
    id: chatId,
    messages: [],
    document: null,
    image: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  chats.set(chatId, chat);
  return chat;
}

export function getChat(chatId) {
  return chats.get(chatId);
}

export function requireChat(chatId) {
  const chat = getChat(chatId);

  if (!chat) {
    const error = new Error("Chat not found. Start a new chat and try again.");
    error.status = 404;
    throw error;
  }

  return chat;
}

export function resetChat(chatId) {
  chats.delete(chatId);
  return createChat();
}

export function touchChat(chat) {
  chat.updatedAt = new Date().toISOString();
}

export function serializeChat(chat) {
  return {
    chatId: chat.id,
    messageCount: chat.messages.length,
    document: chat.document
      ? {
          fileName: chat.document.fileName,
          characters: chat.document.text.length
        }
      : null,
    image: chat.image
      ? {
          fileName: chat.image.fileName,
          mimeType: chat.image.mimeType,
          size: chat.image.size
        }
      : null
  };
}
