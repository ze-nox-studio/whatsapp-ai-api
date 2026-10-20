# 💬 WhatsApp AI API & MCP Bridge

<p align="center">
  <img src="https://img.shields.io/badge/WhatsApp-Persistent_Web_Session-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp" />
  <img src="https://img.shields.io/badge/AI_Backend-Plain_Text_%26_MCP-00a884?style=for-the-badge" alt="Plain Text & MCP" />
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/OpenAPI-3.1-6BA539?style=for-the-badge&logo=openapiinitiative&logoColor=white" alt="OpenAPI 3.1" />
  <img src="https://img.shields.io/badge/Security-Localhost_Only-38bdf8?style=for-the-badge" alt="Security" />
</p>

> A local **WhatsApp AI API, Plain-Text (`text/plain`) Backend, and Model Context Protocol (MCP) Bridge** that lets AI agents (**Gemini / Antigravity**, **OpenCode**, **Claude Code / Claude Desktop**, **Cursor**, **Custom Scripts**) read message history, search contacts, and send WhatsApp messages by contact name or phone number over a persistent desktop session.

---

## ✨ Key Features

- 🔐 **One-Time QR & Persistent Session (`LocalAuth`)**: Scan the QR code once and stay logged in permanently like WhatsApp Desktop. Session data and message cache are stored securely in your OS user directory (`%LOCALAPPDATA%\WhatsApp-AI-API`), completely outside the project repository.
- ⚡ **AI Wake-Up & Wait-for-Reply Engine (`ASK` / `WAIT`)**: AI agents don't need to waste tokens polling in loops! An AI can send a message and block (`ASK` / `whatsapp_send_and_wait_reply`) or listen (`WAIT` / `whatsapp_wait_for_reply`); the moment a reply arrives on WhatsApp, the request resolves and wakes the AI up with the full burst of messages.
- 📝 **Plain-Text (`text/plain`) AI Backend**: AI agents can interact with WhatsApp without complex JSON parsing by sending plain-text commands to `POST /text` (e.g., `ASK John Doe | Are you free? | 120` or `SEND John Doe | Hello!`) and receiving clean plain-text responses.
- 📎 **File & Media Sending (`FILE` / `DOSYA`)**: Send PDFs, images, documents, audio, video, or ZIP archives from local disk paths, HTTP URLs, or Base64 directly by contact name or phone number.
- 👤 **Smart Contact Name & LID Resolver**: Automatically maps WhatsApp Web's internal `@lid` identifiers to real `@c.us` phone numbers. Send messages or fetch chat history directly by contact name or phone number.
- 🧠 **Full MCP (Model Context Protocol) Support**: Built-in support for both `stdio` (`mcp-server.js`) and Streamable HTTP/SSE (`http://localhost:3000/mcp`).
- 🛡️ **Local-First Security Architecture**:
  - Binds strictly to `127.0.0.1` (localhost) by default — inaccessible from external network devices.
  - Strict CORS policy restricting browser requests to `localhost` origins only.
  - Optional `WA_API_KEY` authentication (`X-API-Key` or `Authorization: Bearer <KEY>`).
  - Zero personal data or session files stored inside the code directory.

---

## 🏗️ Architecture

```mermaid
flowchart LR
    subgraph AI["🤖 AI Agents & Clients"]
        G["Gemini / Antigravity"]
        O["OpenCode"]
        C["Claude Code / Desktop"]
        W["cURL / Python / Scripts"]
    end

    subgraph Bridge["⚡ WhatsApp AI API (127.0.0.1:3000)"]
        PT["📝 Plain-Text Layer (/text & /ai.txt)"]
        MCP["🧠 MCP Server (/mcp & mcp-server.js)"]
        REST["🔌 JSON REST API (/api/*)"]
        UI["🌐 Web Control Panel (/)"]
    end

    subgraph Engine["📱 Persistent WhatsApp Engine"]
        WA["WhatsApp Web (Chrome LocalAuth)"]
        DB[("💾 %LOCALAPPDATA%\\WhatsApp-AI-API")]
    end

    AI --> PT
    AI --> MCP
    AI --> REST
    PT --> WA
    MCP --> WA
    REST --> WA
    UI --> WA
    WA <--> DB
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
git clone https://github.com/ze-nox-studio/whatsapp-ai-api.git
cd whatsapp-ai-api
npm install
```

### 2. Start the Server

Run the server (or double-click **`Baslat.bat`** on Windows, or **`ArkaPlandaBaslat.vbs`** for silent background mode):

```bash
npm start
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser and scan the **QR Code** once from your phone (*WhatsApp > Settings > Linked Devices > Link a Device*).

### 3. Auto-Configure AI Agents (Optional)

Automatically register the `whatsapp` MCP server in **Gemini**, **OpenCode**, **Claude Code**, and **Claude Desktop**:

```bash
npm run setup-ai
```

---

## 📝 Plain-Text AI Protocol (`POST /text` & `GET /text`)

Give any AI agent this simple prompt:

> *"A WhatsApp AI API is running locally at `http://localhost:3000`. First read the plain-text guide at `http://localhost:3000/ai.txt`, then manage my WhatsApp messages by sending plain-text commands to `http://localhost:3000/text`."*

### Supported Commands (English & Turkish Aliases)

| Command | Alias | Description | Example |
| :--- | :--- | :--- | :--- |
| `STATUS` | `DURUM` | Check connection status, active account, and stats | `STATUS` |
| `UNREAD` | `OKUNMAMIS` | List all chats that currently have unread messages | `UNREAD` |
| `ASK <Name/Phone> \| <Message> \| [TimeoutSec]` | `SOR`, `GONDER_BEKLE` | **Send & Wait**: Sends a message, waits until the recipient replies, and wakes the AI up with the reply | `ASK Ahmet Yilmaz \| Are you available? \| 120` |
| `WAIT [Name/Phone or *] \| [TimeoutSec]` | `BEKLE`, `YANIT_BEKLE` | **Long-Poll Wake-Up**: Blocks until a new message arrives from a contact (or `*` anyone) and wakes the AI up | `WAIT Ahmet Yilmaz \| 120` or `WAIT * \| 60` |
| `CHATS [limit] [search]` | `SOHBETLER` | List recent conversations, groups, and last messages | `CHATS 20` or `CHATS 10 Project` |
| `MESSAGES <Name or Phone> \| [limit]` | `MESAJLAR`, `OKU` | Fetch full message history with a contact or group | `MESSAGES Ahmet Yilmaz \| 40` |
| `RECENT [limit]` | `SON_MESAJLAR` | List the most recent messages across all chats | `RECENT 25` |
| `SEND <Name or Phone> \| <Message>` | `GONDER`, `YAZ` | Resolve contact name or number and send a message | `SEND Ahmet Yilmaz \| Hello!` |
| `FILE <Name or Phone> \| <Path/URL> \| [Caption]` | `DOSYA`, `MEDYA` | Send a local file (PDF, image, doc, audio, video, ZIP) or URL | `FILE Ahmet Yilmaz \| C:\report.pdf \| Report` |
| `TYPING <Name or Phone>` | `YAZIYOR` | Show `"typing..."` indicator in the recipient's chat while AI thinks | `TYPING Ahmet Yilmaz` |
| `SEEN <Name or Phone>` | `OKUNDU` | Mark all unread messages in a chat as read (Blue Ticks) | `SEEN Ahmet Yilmaz` |
| `CONTACTS [search]` | `KISILER`, `REHBER` | List or search contacts with real phone numbers | `CONTACTS Ayse` |
| `SEARCH <keyword>` | `ARA` | Search message history by keyword | `SEARCH meeting` |
| `SYNC` | `SENKRONIZE` | Force a full sync of contacts, chats, and history | `SYNC` |
| `HELP` | `YARDIM`, `GUIDE` | Return the plain-text AI usage guide | `HELP` |

---

## 🌐 HTTP Endpoints

### Plain-Text (`text/plain`) Endpoints
- `GET  /ai.txt` (or `/llms.txt`) — Live plain-text AI usage guide
- `POST /text` — Execute a plain-text command sent in the request body (`text/plain`)
- `GET  /text?cmd=...` — Execute a plain-text command via query parameter
- `GET  /text/status` — Plain-text connection status
- `GET  /text/unread` — Plain-text summary of all unread chats and messages
- `POST /text/ask` — Send a message and block until a reply arrives (`Contact | Message | [TimeoutSec]`)
- `GET  /text/wait` — Block until a new incoming message arrives (`?chat=Ahmet&timeout=120`)
- `GET  /text/stream` — Live **Server-Sent Events (SSE)** stream emitting incoming messages in plain text
- `GET  /text/chats?limit=25` — Plain-text recent chats list
- `GET  /text/messages/:chat?limit=40` — Plain-text message history by contact name or phone number
- `POST /text/send` — Send a message using `Contact Name | Message` in plain-text body
- `POST /text/send-file` — Send a file using `Contact Name | FilePath or URL | [Caption]` in plain-text body
- `GET  /text/contacts/:search` — Search contacts in plain text
- `GET  /text/search/:query` — Search messages in plain text

### JSON REST API & MCP Endpoints
- `GET  /api/status` — Connection status and session stats
- `GET  /api/unread` — Get all chats with unread messages and their unread message list
- `POST /api/ask` (or `/api/send-and-wait`) — Send a message and wait for the recipient's reply (`{ "to": "Ahmet Yilmaz", "text": "Hello?", "timeout": 120 }`)
- `GET  /api/wait` (or `POST /api/wait`) — Wait for an incoming reply (`?chat=Ahmet%20Yilmaz&timeout=120`)
- `POST /api/presence` — Send `"typing"` indicator or mark chat as `"seen"` (`{ "to": "Ahmet Yilmaz", "state": "typing" }`)
- `GET  /api/stream` — Live **SSE (Server-Sent Events)** JSON event stream for incoming messages
- `POST /api/webhooks` — Register a webhook URL to receive instant `POST` payloads on incoming messages
- `GET  /api/chats` — List recent chats (`?limit=30&search=...`)
- `GET  /api/messages` — Fetch messages (`?chatId=Ahmet%20Yilmaz&limit=40`)
- `POST /api/send` — Send a message (`{ "to": "Ahmet Yilmaz", "text": "Hello!" }`)
- `POST /api/send-file` — Send a file/media (`{ "to": "Ahmet Yilmaz", "filePath": "C:\\report.pdf", "caption": "Report" }` or `{ "to": "...", "base64": "...", "filename": "report.pdf" }`)
- `GET  /api/contacts` — List or search contacts (`?search=Ahmet`)
- `GET  /api/search` — Search message history (`?query=meeting`)
- `POST /mcp` — Model Context Protocol (JSON-RPC 2.0) HTTP endpoint
- `GET  /openapi.json` — OpenAPI 3.1 specification

---

## 🛠️ MCP Tools

When connected via MCP (`mcp-server.js` or `http://localhost:3000/mcp`), AI agents have access to the following tools:

| Tool Name | Description |
| :--- | :--- |
| `whatsapp_plain_text` | Execute any plain-text command (`STATUS`, `UNREAD`, `ASK`, `WAIT`, `CHATS`, `MESSAGES`, `SEND`, `FILE`, `TYPING`, `SEEN`, `CONTACTS`, `SEARCH`) |
| `whatsapp_send_and_wait_reply` | **Send & Wake-Up**: Send a message to a contact and wait until they reply (returns sent message + incoming replies in one tool call) |
| `whatsapp_wait_for_reply` | **Wake-Up Listener**: Block and wait until a specific contact (or anyone) sends a new WhatsApp message |
| `whatsapp_get_unread` | Get all chats that currently have unread messages along with their unread messages |
| `whatsapp_send_presence` | Show `"typing..."` indicator in a chat or mark messages as `"seen"` (Blue Ticks) |
| `whatsapp_get_status` | Get WhatsApp connection status, active phone number, and message/contact counts |
| `whatsapp_send_message` | Send a WhatsApp message by contact name, phone number, or group name |
| `whatsapp_send_file` | Send any file, image, PDF, audio, video, or document by contact name or phone number (`filePath` or `url`) |
| `whatsapp_get_chats` | Retrieve recent chats with contact names, phone numbers, and unread counts |
| `whatsapp_get_messages` | Retrieve chat history for a specific contact/group or recent messages across all chats |
| `whatsapp_search_messages` | Search through message history by keyword or sender name |
| `whatsapp_get_contacts` | Search and list saved contacts with their real phone numbers |

---

## 💻 CLI Usage

```bash
# Plain-text mode
node wa-cli.js text "STATUS"
node wa-cli.js text "UNREAD"
node wa-cli.js text "ASK Ahmet Yilmaz | Are you available? | 120"
node wa-cli.js text "WAIT * | 60"
node wa-cli.js text "CHATS 15"
node wa-cli.js text "MESSAGES Ahmet Yilmaz"
node wa-cli.js text "SEND Ahmet Yilmaz | Hello!"
node wa-cli.js text "FILE Ahmet Yilmaz | C:\report.pdf | Report attached"
node wa-cli.js text "CONTACTS Ayse"
node wa-cli.js text "SEARCH meeting"

# Direct CLI subcommands
node wa-cli.js status
node wa-cli.js unread
node wa-cli.js ask "Ahmet Yilmaz" "Are you available?" 120
node wa-cli.js wait "Ahmet Yilmaz" 120
node wa-cli.js chats 20
node wa-cli.js messages "Ahmet Yilmaz" 30
node wa-cli.js send "Ahmet Yilmaz" "Hello!"
node wa-cli.js send-file "Ahmet Yilmaz" "C:\report.pdf" "Report attached"
```

---

## 🔒 Privacy & Security Configuration

- **External Data Storage**: Session credentials and message caches are **never** stored inside the repository folder. By default, they are saved in your OS user profile:
  - **Windows**: `%LOCALAPPDATA%\WhatsApp-AI-API`
  - **macOS / Linux**: `~/.local/share/WhatsApp-AI-API`
- **Environment Variables (Optional)**:
  - `PORT`: Server port (Default: `3000`)
  - `HOST`: Network interface to bind (Default: `127.0.0.1` — localhost only)
  - `WA_DATA_DIR`: Custom path for persistent session and message storage
  - `WA_API_KEY`: Require `X-API-Key` or `Authorization: Bearer <KEY>` header on all requests

---

## 📄 License

MIT © [ze-nox-studio](https://github.com/ze-nox-studio)
