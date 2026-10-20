# 🤖 AGENTS.md — AI Agent Quick-Start & Architecture Guide

> **Purpose:** This file is designed for AI agents (**OpenCode, Gemini / Antigravity, Claude Code, Cursor, Windsurf, Aider, Autonomous Scripts**) to understand and operate the **WhatsApp AI API & MCP Bridge** in seconds without reading the entire codebase.

---

## ⚡ 1. Instant TL;DR for AI Agents

A persistent WhatsApp Web session runs locally at **`http://127.0.0.1:3000`** (`http://localhost:3000`).
You can interact with WhatsApp in **3 ways** (choose whichever is fastest for your environment):

1. **Plain-Text HTTP (`POST http://localhost:3000/text`)** — Send a single plain-text line, receive clean plain-text output (zero JSON parsing).
2. **Terminal CLI (`node wa-cli.js "<COMMAND>"`)** — Run directly from PowerShell / Bash.
3. **MCP Tools (`whatsapp_*`)** — Call native Model Context Protocol tools via `mcp-server.js` (stdio) or `http://localhost:3000/mcp`.

---

## 🚨 2. Golden Rules for AI Agents (Read Before Acting!)

1. **NEVER Poll in a Loop for Replies:**
   - Do **NOT** call `MESSAGES` or `CHATS` repeatedly in a `sleep` loop to check if a user replied.
   - Instead, use **`ASK` (`SOR`)** to send a message and block until the person replies, or **`WAIT` (`BEKLE`)** to block until a new message arrives. The server will hold the request open and **wake you up immediately** with the full reply (including multi-line message bursts) the instant the user writes back!
2. **Send by Contact Name or Phone Number:**
   - You do **NOT** need to look up a contact's JID (`@c.us` or `@lid`) before messaging them. Pass their name directly (e.g., `Ahmet Yılmaz`) or phone number (`05551234567`); the smart resolver handles `@lid <-> @c.us` mapping automatically.
3. **Use Presence Indicators for Natural UX:**
   - Before generating a long response, send `TYPING <Name>` (`YAZIYOR <Kişi>`) so the recipient sees *"typing..."* on WhatsApp, and `SEEN <Name>` (`OKUNDU <Kişi>`) to mark their messages as read (Blue Ticks).
4. **Never Store Personal Data in the Repo:**
   - All WhatsApp session files and message caches live outside this repository in `%LOCALAPPDATA%\WhatsApp-AI-API` (or `~/.local/share/WhatsApp-AI-API`).

---

## 📝 3. Plain-Text Command Cheat Sheet (`POST /text` or `node wa-cli.js`)

Send any of these commands as `text/plain` body to `POST http://localhost:3000/text` or run `node wa-cli.js "<COMMAND>"`:

```text
# 1. Check connection status & account info
STATUS
DURUM

# 2. Check all unread messages across all chats (Best first step!)
UNREAD
OKUNMAMIS

# 3. Send a message AND wait for the recipient's reply (AI Wake-Up!)
ASK Ahmet Yilmaz | Are you free today? | 120
SOR Ahmet Yılmaz | Bugün müsait misin? | 120

# 4. Wait for a new incoming message from a specific contact or anyone (*) (AI Wake-Up!)
WAIT Ahmet Yilmaz | 120
BEKLE Ahmet Yılmaz | 120
WAIT * | 60
BEKLE * | 60

# 5. Send a message immediately (without waiting)
SEND Ahmet Yilmaz | Hello!
GONDER Ahmet Yılmaz | Merhaba!

# 6. Send a file, PDF, image, audio, video, or ZIP (from local path or URL)
FILE Ahmet Yilmaz | C:\report.pdf | Here is the report
DOSYA Ahmet Yılmaz | C:\rapor.pdf | Rapor ektedir

# 7. Show "typing..." or mark chat as read (Blue Ticks)
TYPING Ahmet Yilmaz
YAZIYOR Ahmet Yılmaz
SEEN Ahmet Yilmaz
OKUNDU Ahmet Yılmaz

# 8. Read message history with a contact or group
MESSAGES Ahmet Yilmaz | 40
MESAJLAR Ahmet Yılmaz | 40

# 9. List recent conversations
CHATS 20
SOHBETLER 20

# 10. Search contacts or message history
CONTACTS Ayse
KISILER Ayşe
SEARCH meeting
ARA toplantı
```

---

## 🛠️ 4. MCP Tools Quick Reference

If `whatsapp` MCP server is enabled in your environment, use these tools directly:

| MCP Tool Name | When to Use | Key Arguments |
| :--- | :--- | :--- |
| `whatsapp_send_and_wait_reply` | **Preferred for conversation:** Sends a message and blocks until the user replies | `to`, `text`, `timeoutSeconds` (default `120`) |
| `whatsapp_wait_for_reply` | Wait for an incoming message from a contact or `"*"` (anyone) | `chatId` (`"*"` or name/phone), `timeoutSeconds` |
| `whatsapp_get_unread` | Check all chats that currently have unread messages | `limit` (default `30`) |
| `whatsapp_send_message` | Fire-and-forget text message | `to` (name or phone), `text` |
| `whatsapp_send_file` | Send local file (`filePath`) or remote `url` | `to`, `filePath`, `caption` |
| `whatsapp_send_presence` | Show `"typing"` indicator or mark chat `"seen"` | `to`, `state` (`"typing"` \| `"seen"`) |
| `whatsapp_get_messages` | Read past chat history with a contact/group | `chatId` (name or phone), `limit` |
| `whatsapp_get_chats` | List recent conversations and last messages | `limit`, `search` |
| `whatsapp_get_contacts` | Search saved contacts & real phone numbers | `search`, `limit` |
| `whatsapp_search_messages` | Search message text across all chats | `query`, `limit` |
| `whatsapp_get_status` | Check if WhatsApp session is connected | *(none)* |
| `whatsapp_plain_text` | Execute any plain-text command string | `command` |

---

## 🗺️ 5. Codebase Architecture Map (For Coding Agents Modifying the Project)

```text
whatsapp-ai-api/
├── server.js               # Express HTTP server (127.0.0.1:3000), Plain-Text routes (/text/*), REST API (/api/*), SSE (/text/stream, /api/stream), MCP HTTP (/mcp), OpenAPI (/openapi.json)
├── whatsapp-manager.js     # Core WhatsApp Engine: Puppeteer/Chrome LocalAuth, @lid <-> @c.us resolver, direct WAWebCollections.Msg real-time hook, waitForReply, sendAndWaitForReply, sendMedia
├── plain-text-handler.js   # Parser & formatter for plain-text AI commands (DURUM/STATUS, SOR/ASK, BEKLE/WAIT, GONDER/SEND, DOSYA/FILE, OKUNMAMIS/UNREAD, etc.) and /ai.txt generator
├── ai-tools.js             # MCP & Function-Calling tool schemas (12 tools) and unified executeAiTool() dispatcher
├── mcp-server.js           # Standard stdio Model Context Protocol (MCP) server for Gemini, OpenCode, Claude Code, and Claude Desktop (650s timeout for blocking wait tools)
├── wa-cli.js               # Terminal CLI client supporting both plain-text ("SOR ...", "BEKLE ...") and JSON subcommands
├── setup-ai-configs.js     # Auto-registers the MCP server into ~/.gemini/settings.json, ~/.config/opencode/opencode.json, ~/.claude.json
├── public/index.html       # Local web dashboard (QR scanner, live message stream, file sender, plain-text test console)
└── test-api.js             # End-to-end automated verification suite for Plain-Text, OpenAPI, REST, and MCP tools
```

### Key Technical Internals in `whatsapp-manager.js`:
- **Persistent Storage**: Located at `%LOCALAPPDATA%\WhatsApp-AI-API` (`wwebjs_auth` for Chrome profile, `whatsapp-store.json` for contacts/chats/messages cache).
- **Dual `@c.us` & `@lid` Resolution**: WhatsApp Web uses internal `@lid` identifiers alongside `@c.us` phone numbers. `syncAllData()` and `fetchChatHistoryFromBrowser()` query `WAWebCollections` and `WAWebLidMigrationUtils` inside Chrome to link both chat models seamlessly.
- **Zero-Miss Wake-Up Engine (`waitForReply`)**: Combines three layers:
  1. `installRealtimeBrowserHook()` — Direct `WAWebCollections.Msg.on('add')` & `on('change:body')` listener via `pupPage.exposeFunction('__waBridgeOnNewMsg')` (<20ms latency).
  2. `snapshotKnownMessageIds()` — Baseline message ID snapshot taken *before* sending/waiting so Windows PC vs. WhatsApp server clock skew never drops a newly arrived message.
  3. 1-second active browser scan across all `@c.us` and `@lid` chats + `1500ms` burst timer (`collectBurstMs`) to group rapid multi-line human replies into a single AI wake-up response.
