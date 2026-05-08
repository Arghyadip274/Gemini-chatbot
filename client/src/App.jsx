import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Send,
  Sparkles,
  UserRound,
  X
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function formatBytes(bytes) {
  if (!bytes) {
    return "0 KB";
  }

  const units = ["B", "KB", "MB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function App() {
  const [chatId, setChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [documentInfo, setDocumentInfo] = useState(null);
  const [imageInfo, setImageInfo] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isDocumentUploading, setIsDocumentUploading] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);

  const documentInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const initializedRef = useRef(false);

  const busy = isBooting || isSending || isDocumentUploading || isImageUploading;
  const statusText = useMemo(() => {
    if (isBooting) return "Starting";
    if (isSending) return "Thinking";
    if (isDocumentUploading) return "Reading document";
    if (isImageUploading) return "Saving image";
    return "Ready";
  }, [isBooting, isSending, isDocumentUploading, isImageUploading]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    startChat();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }

    return payload;
  }

  async function startChat() {
    setIsBooting(true);
    setError("");

    try {
      const payload = await request("/api/chats", { method: "POST" });
      setChatId(payload.chatId);
      clearLocalChat();
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setIsBooting(false);
    }
  }

  function clearLocalChat() {
    setMessages([]);
    setInput("");
    setDocumentInfo(null);
    setImageInfo(null);
    setImagePreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return "";
    });
  }

  async function handleNewChat() {
    if (!chatId) {
      await startChat();
      return;
    }

    setIsBooting(true);
    setError("");

    try {
      const payload = await request(`/api/chats/${chatId}`, { method: "DELETE" });
      setChatId(payload.chatId);
      clearLocalChat();
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setIsBooting(false);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    const message = input.trim();

    if (!message || !chatId || isSending) {
      return;
    }

    setError("");
    setInput("");
    setMessages((currentMessages) => [...currentMessages, { role: "user", text: message }]);
    setIsSending(true);

    try {
      const payload = await request(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message })
      });

      setMessages((currentMessages) => [...currentMessages, payload.message]);
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setIsSending(false);
    }
  }

  async function handleDocumentChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !chatId) {
      return;
    }

    if (!["application/pdf", "text/plain"].includes(file.type)) {
      setError("Only PDF and TXT documents are supported.");
      return;
    }

    const formData = new FormData();
    formData.append("document", file);
    setIsDocumentUploading(true);
    setError("");

    try {
      const payload = await request(`/api/chats/${chatId}/documents`, {
        method: "POST",
        body: formData
      });
      setDocumentInfo(payload.document);
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setIsDocumentUploading(false);
    }
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !chatId) {
      return;
    }

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Only PNG and JPG images are supported.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const formData = new FormData();
    formData.append("image", file);

    setImagePreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return previewUrl;
    });
    setIsImageUploading(true);
    setError("");

    try {
      const payload = await request(`/api/chats/${chatId}/images`, {
        method: "POST",
        body: formData
      });
      setImageInfo(payload.image);
    } catch (currentError) {
      URL.revokeObjectURL(previewUrl);
      setImagePreviewUrl("");
      setError(currentError.message);
    } finally {
      setIsImageUploading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="chat-surface" aria-label="Gemini chatbot">
        <header className="top-bar">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              <Sparkles size={20} />
            </span>
            <div>
              <h1>Gemini Chatbot</h1>
              <p>{statusText}</p>
            </div>
          </div>

          <button className="secondary-button" type="button" onClick={handleNewChat} disabled={isBooting}>
            {isBooting ? <Loader2 className="spin" size={17} /> : <Plus size={17} />}
            <span>New Chat</span>
          </button>
        </header>

        <div className="workspace">
          <aside className="context-panel" aria-label="Current chat context">
            <div className="context-block">
              <div className="context-heading">
                <FileText size={16} />
                <span>Document</span>
              </div>
              {documentInfo ? (
                <div className="context-detail">
                  <strong>{documentInfo.fileName}</strong>
                  <span>{documentInfo.characters.toLocaleString()} characters</span>
                </div>
              ) : (
                <span className="muted">None</span>
              )}
            </div>

            <div className="context-block">
              <div className="context-heading">
                <ImageIcon size={16} />
                <span>Image</span>
              </div>
              {imageInfo ? (
                <div className="context-detail">
                  {imagePreviewUrl ? <img src={imagePreviewUrl} alt={imageInfo.fileName} /> : null}
                  <strong>{imageInfo.fileName}</strong>
                  <span>{formatBytes(imageInfo.size)}</span>
                </div>
              ) : (
                <span className="muted">None</span>
              )}
            </div>
          </aside>

          <section className="conversation-panel" aria-label="Conversation">
            <div className="messages">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <Bot size={24} />
                  <span>No messages yet</span>
                </div>
              ) : (
                messages.map((message, index) => (
                  <article className={`message-row ${message.role}`} key={`${message.role}-${index}`}>
                    <span className="avatar" aria-hidden="true">
                      {message.role === "user" ? <UserRound size={17} /> : <Bot size={17} />}
                    </span>
                    <p>{message.text}</p>
                  </article>
                ))
              )}

              {isSending ? (
                <div className="message-row assistant">
                  <span className="avatar" aria-hidden="true">
                    <Bot size={17} />
                  </span>
                  <p className="thinking-line">
                    <Loader2 className="spin" size={16} />
                    Thinking
                  </p>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>

            {error ? (
              <div className="error-banner" role="alert">
                <span>{error}</span>
                <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
                  <X size={16} />
                </button>
              </div>
            ) : null}

            <form className="composer" onSubmit={handleSend}>
              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                onChange={handleDocumentChange}
                hidden
              />
              <input
                ref={imageInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                onChange={handleImageChange}
                hidden
              />

              <div className="tool-strip">
                <button
                  className="icon-button"
                  type="button"
                  title="Upload document"
                  aria-label="Upload document"
                  onClick={() => documentInputRef.current?.click()}
                  disabled={!chatId || busy}
                >
                  {isDocumentUploading ? <Loader2 className="spin" size={18} /> : <FileText size={18} />}
                </button>
                <button
                  className="icon-button"
                  type="button"
                  title="Upload image"
                  aria-label="Upload image"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={!chatId || busy}
                >
                  {isImageUploading ? <Loader2 className="spin" size={18} /> : <ImageIcon size={18} />}
                </button>
              </div>

              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend(event);
                  }
                }}
                rows={1}
                placeholder="Message"
                disabled={!chatId || isBooting}
              />

              <button className="send-button" type="submit" disabled={!input.trim() || !chatId || busy}>
                {isSending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                <span>Send</span>
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}

export default App;
