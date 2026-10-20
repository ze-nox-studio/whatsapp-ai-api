# CLAUDE.md — Claude Code Instructions for WhatsApp AI API

Read [`AGENTS.md`](./AGENTS.md) for the complete architecture and command reference.

## Quick Commands for Claude Code

- **Start Server:** `npm start` (or `wscript.exe ArkaPlandaBaslat.vbs` on Windows for background mode)
- **Run Tests:** `node test-api.js`
- **Check Status:** `node wa-cli.js DURUM`
- **Check Unread Messages:** `node wa-cli.js OKUNMAMIS`
- **Send & Wait for Reply (Wake-Up):** `node wa-cli.js "SOR <Contact Name or Phone> | <Message> | 120"`
- **Wait for Incoming Message (Wake-Up):** `node wa-cli.js "BEKLE <Contact Name or *> | 120"`
- **Send Message Immediately:** `node wa-cli.js "GONDER <Contact Name or Phone> | <Message>"`
- **Send File / Media:** `node wa-cli.js "DOSYA <Contact Name or Phone> | <FilePath or URL> | <Caption>"`
- **Read Chat History:** `node wa-cli.js "MESAJLAR <Contact Name or Phone> | 40"`

## Critical Rules
1. **Do NOT poll in a loop** (`sleep` + `MESAJLAR`) when waiting for a WhatsApp reply. Always use `SOR` (`ASK` / `whatsapp_send_and_wait_reply`) or `BEKLE` (`WAIT` / `whatsapp_wait_for_reply`), which block until the user replies and wake you up immediately.
2. **Never commit personal data** (real phone numbers, personal names, or session files) into the repository. Persistent data is stored externally in `%LOCALAPPDATA%\WhatsApp-AI-API`.
