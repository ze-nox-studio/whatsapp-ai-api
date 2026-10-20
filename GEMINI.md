# GEMINI.md — Gemini & Antigravity Instructions for WhatsApp AI API

See [`AGENTS.md`](./AGENTS.md) for full details and architecture.

## How to Interact with WhatsApp

1. **MCP Tools (Preferred if `whatsapp` MCP is active):**
   - `whatsapp_get_unread` — Check all unread chats and messages first.
   - `whatsapp_send_and_wait_reply` — Send a message by contact name/phone and block until the person replies (wakes you up automatically).
   - `whatsapp_wait_for_reply` — Wait for a new message from a specific contact or `"*"` (anyone).
   - `whatsapp_send_message` / `whatsapp_send_file` — Send text or files (`filePath` or `url`) by contact name or phone number.
   - `whatsapp_send_presence` — Send `"typing"` (`yazıyor...`) or `"seen"` (Blue Ticks).
   - `whatsapp_get_messages` / `whatsapp_get_chats` / `whatsapp_get_contacts` / `whatsapp_search_messages`.

2. **Plain-Text HTTP (`http://localhost:3000/text`) or CLI (`node wa-cli.js`):**
   - `node wa-cli.js DURUM`
   - `node wa-cli.js OKUNMAMIS`
   - `node wa-cli.js "SOR <Kişi Adı> | <Mesaj> | 120"`
   - `node wa-cli.js "BEKLE <Kişi Adı veya *> | 120"`
   - `node wa-cli.js "GONDER <Kişi Adı> | <Mesaj>"`
   - `node wa-cli.js "DOSYA <Kişi Adı> | <DosyaYolu> | <Açıklama>"`

## Key Guidelines
- **Never poll in a loop** while waiting for a user's WhatsApp reply; use `SOR` (`ASK`) or `BEKLE` (`WAIT`).
- Keep all session/personal data outside the repo (`%LOCALAPPDATA%\WhatsApp-AI-API`).
