---
name: whatsapp-ai-bridge
description: Read, search, send, and wait for WhatsApp messages and files by contact name or phone number via the local WhatsApp AI API (http://localhost:3000). Use this skill whenever the user asks to check WhatsApp, read unread messages, message someone, send a file over WhatsApp, or carry out an interactive WhatsApp conversation.
---

# WhatsApp AI API & Wake-Up Skill

## Overview
A persistent WhatsApp Web session runs locally at `http://localhost:3000`. You can control it via MCP tools (`whatsapp_*`), Plain-Text HTTP (`POST http://localhost:3000/text`), or CLI (`node wa-cli.js`).

## Workflow & Best Practices

1. **Check Status / Unread First:**
   - Call `whatsapp_get_unread` or send `OKUNMAMIS` (`UNREAD`) to `POST http://localhost:3000/text` to see all new unread messages at a glance.
2. **Interactive Conversations (Zero Polling):**
   - When you send a message and expect the recipient to reply, **do NOT poll in a loop**.
   - Use `whatsapp_send_and_wait_reply` (or plain-text `SOR <Contact> | <Message> | 120` / `ASK <Contact> | <Message> | 120`).
   - This sends the message and blocks until the person replies on WhatsApp, automatically grouping rapid multi-line replies (`1.5s` burst window) and waking you up immediately.
3. **Waiting for Incoming Messages:**
   - To listen for a reply without sending a new message first, use `whatsapp_wait_for_reply` (or plain-text `BEKLE <Contact or *> | 120` / `WAIT <Contact or *> | 120`).
4. **Natural Presence ("typing..." & Blue Ticks):**
   - Use `whatsapp_send_presence` with `state: "seen"` (`OKUNDU <Contact>`) when reading a message, and `state: "typing"` (`YAZIYOR <Contact>`) while preparing a response.
5. **Sending Files & Media:**
   - Use `whatsapp_send_file` (or plain-text `DOSYA <Contact> | <FilePath or URL> | <Caption>`) to send PDFs, images, documents, audio, video, or archives.
