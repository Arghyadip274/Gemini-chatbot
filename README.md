# Gemini Chatbot Assignment

A full-stack Gemini chatbot for the Infollion software developer intern assignment. The app supports text chat, PDF/TXT document upload, PNG/JPG image upload, current-chat context, image preview, loading states, and a New Chat reset.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Gemini SDK: `@google/genai`
- File parsing: `multer` for uploads and `pdf-parse` for basic PDF text extraction
- State: in-memory only

## Project Structure

```text
client/   React chat UI
server/   Express API and Gemini integration
```

## Install

Install dependencies from the repository root:

```bash
npm install
```

You can also install each app separately:

```bash
cd server
npm install

cd ../client
npm install
```

## Gemini API Key

Create a server environment file:

```bash
cd server
copy .env.example .env
```

Set your API key in `server/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=4000
CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

The Gemini key is used only by the backend. Do not put it in the React app.

## Run Locally

Start the backend:

```bash
cd server
npm run dev
```

Start the frontend in another terminal:

```bash
cd client
npm run dev
```

Open the frontend URL printed by Vite, usually:

```text
http://127.0.0.1:5173
```

If your backend URL changes, create `client/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
```

## Example Usage

1. Start a chat and send a text message.
2. Upload a PDF or TXT document, then ask `Summarize the document.`
3. Ask a follow-up such as `What was the third point mentioned?`
4. Upload a PNG or JPG image, then ask `What's in the image?`
5. Click New Chat and ask what was uploaded earlier. The bot should have no prior context.

## API Endpoints

```text
GET    /health
POST   /api/chats
GET    /api/chats/:chatId
DELETE /api/chats/:chatId
POST   /api/chats/:chatId/documents
POST   /api/chats/:chatId/images
POST   /api/chats/:chatId/messages
```

## Deployment

### Backend on Render

Create a new Render Web Service from the GitHub repository:

- Root directory: `server`
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Environment variables:
  - `GEMINI_API_KEY`
  - `CLIENT_ORIGIN=https://your-vercel-app.vercel.app`
  - `NODE_VERSION=20`

Render will provide a backend URL like `https://your-service.onrender.com`.

### Frontend on Vercel

Create a new Vercel project from the same GitHub repository:

- Root directory: `client`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable:
  - `VITE_API_BASE_URL=https://your-service.onrender.com`

Redeploy the frontend after setting `VITE_API_BASE_URL`.

## Notes

- Chat state, document text, and image data are stored in memory only.
- New Chat clears message history, document text, image data, and creates a fresh chat ID.
- The app intentionally avoids databases, authentication, embeddings, vector search, RAG pipelines, and chunking.
