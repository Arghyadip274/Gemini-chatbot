import "dotenv/config";

import cors from "cors";
import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";

import { generateChatResponse } from "./gemini.js";
import { createChat, requireChat, resetChat, serializeChat, touchChat } from "./store.js";

const app = express();
const port = Number(process.env.PORT || 4000);

const DOCUMENT_LIMIT_BYTES = 8 * 1024 * 1024;
const IMAGE_LIMIT_BYTES = 6 * 1024 * 1024;

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  const hostname = (() => {
    try {
      return new URL(origin).hostname;
    } catch {
      return "";
    }
  })();

  return (
    allowedOrigins.includes("*") ||
    allowedOrigins.includes(origin) ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".vercel.app")
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("This origin is not allowed by CORS."));
    }
  })
);
app.use(express.json({ limit: "1mb" }));

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_LIMIT_BYTES }
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_LIMIT_BYTES }
});

function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function isDocument(file) {
  return file.mimetype === "application/pdf" || file.mimetype === "text/plain";
}

function isImage(file) {
  return file.mimetype === "image/png" || file.mimetype === "image/jpeg";
}

async function extractDocumentText(file) {
  if (file.mimetype === "text/plain") {
    return file.buffer.toString("utf8").trim();
  }

  const parsed = await pdfParse(file.buffer);
  return parsed.text.trim();
}

app.get("/health", (request, response) => {
  response.json({ status: "ok" });
});

app.post("/api/chats", (request, response) => {
  const chat = createChat();
  response.status(201).json(serializeChat(chat));
});

app.get(
  "/api/chats/:chatId",
  asyncHandler(async (request, response) => {
    const chat = requireChat(request.params.chatId);
    response.json(serializeChat(chat));
  })
);

app.delete(
  "/api/chats/:chatId",
  asyncHandler(async (request, response) => {
    const chat = resetChat(request.params.chatId);
    response.json(serializeChat(chat));
  })
);

app.post(
  "/api/chats/:chatId/documents",
  documentUpload.single("document"),
  asyncHandler(async (request, response) => {
    const chat = requireChat(request.params.chatId);
    const file = request.file;

    if (!file) {
      response.status(400).json({ error: "Upload a PDF or TXT document." });
      return;
    }

    if (!isDocument(file)) {
      response.status(415).json({ error: "Only PDF and TXT documents are supported." });
      return;
    }

    const text = await extractDocumentText(file);

    if (!text) {
      response.status(422).json({ error: "No readable text was found in this document." });
      return;
    }

    chat.document = {
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      text
    };
    touchChat(chat);

    response.json({
      document: {
        fileName: chat.document.fileName,
        characters: chat.document.text.length
      }
    });
  })
);

app.post(
  "/api/chats/:chatId/images",
  imageUpload.single("image"),
  asyncHandler(async (request, response) => {
    const chat = requireChat(request.params.chatId);
    const file = request.file;

    if (!file) {
      response.status(400).json({ error: "Upload a PNG or JPG image." });
      return;
    }

    if (!isImage(file)) {
      response.status(415).json({ error: "Only PNG and JPG images are supported." });
      return;
    }

    chat.image = {
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      base64: file.buffer.toString("base64")
    };
    touchChat(chat);

    response.json({
      image: {
        fileName: chat.image.fileName,
        mimeType: chat.image.mimeType,
        size: chat.image.size
      }
    });
  })
);

app.post(
  "/api/chats/:chatId/messages",
  asyncHandler(async (request, response) => {
    const chat = requireChat(request.params.chatId);
    const message = String(request.body?.message || "").trim();

    if (!message) {
      response.status(400).json({ error: "Message is required." });
      return;
    }

    const answer = await generateChatResponse(message, chat);

    chat.messages.push(
      {
        role: "user",
        text: message,
        createdAt: new Date().toISOString()
      },
      {
        role: "assistant",
        text: answer,
        createdAt: new Date().toISOString()
      }
    );
    touchChat(chat);

    response.json({
      message: {
        role: "assistant",
        text: answer
      },
      chat: serializeChat(chat)
    });
  })
);

app.use((error, request, response, next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    response.status(413).json({ error: "The uploaded file is too large." });
    return;
  }

  const status = error.status || 500;
  const message = status >= 500 && !error.expose ? "Something went wrong on the server." : error.message;

  if (status >= 500 && !error.expose) {
    console.error(error);
  }

  response.status(status).json({ error: message });
});

app.listen(port, () => {
  console.log(`Gemini chatbot API running on http://localhost:${port}`);
});
