const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const waManager = require('./whatsapp-manager');
const { TOOLS, executeTool } = require('./ai-tools');
const {
  getAiGuideText,
  formatStatusText,
  formatChatsText,
  formatMessagesText,
  formatContactsText,
  executePlainTextCommand
} = require('./plain-text-handler');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const API_KEY = process.env.WA_API_KEY || '';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Güvenlik Başlıkları (Security Headers)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Sadece yerel (localhost / 127.0.0.1) kaynaklardan gelen tarayıcı isteklerine izin ver (CSRF / CORS koruması)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS politikası: Sadece yerel (localhost) bağlantılara izin verilir.'));
    }
  })
);

app.use(express.text({ type: ['text/*', 'application/octet-stream'], limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Opsiyonel API Anahtarı (WA_API_KEY ortam değişkeni tanımlıysa kontrol eder)
app.use((req, res, next) => {
  if (!API_KEY) return next();
  const provided =
    req.headers['x-api-key'] ||
    (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, '')) ||
    req.query.apiKey;
  if (provided === API_KEY) return next();
  return res.status(401).json({ ok: false, error: 'Yetkisiz erişim: Geçerli bir WA_API_KEY gerekli.' });
});

function sendPlain(res, text, status = 200) {
  res.status(status).set('Content-Type', 'text/plain; charset=utf-8').send(String(text));
}

// Broadcast helper for real-time Web Dashboard updates
function broadcast(event, data) {
  const payload = JSON.stringify({ event, data, timestamp: Date.now() });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

wss.on('connection', async (ws) => {
  ws.send(JSON.stringify({ event: 'status', data: waManager.getStatus() }));
  const recent = await waManager.getMessages({ limit: 30 }).catch(() => []);
  ws.send(JSON.stringify({
    event: 'recent_messages',
    data: recent
  }));
});

waManager.on('status', (st) => broadcast('status', st));
waManager.on('qr', (qr) => broadcast('qr', qr));
waManager.on('message', (msg) => broadcast('message', msg));

// ============================================================================
// 1. PLAIN-TEXT AI BACKEND ENDPOINTS (Düz Metin İletişim Katmanı)
// ============================================================================

// AI Kullanım Kılavuzu (Plain Text)
app.get(['/ai.txt', '/llms.txt', '/text/help', '/kullanim-kilavuzu.txt'], (req, res) => {
  sendPlain(res, getAiGuideText(PORT));
});

// Tek Noktadan Düz Metin Komut İşleyici (GET & POST /text, /api/text)
async function handleUnifiedPlainText(req, res) {
  try {
    let rawCmd = '';
    if (typeof req.body === 'string' && req.body.trim()) {
      rawCmd = req.body.trim();
    } else if (req.body && typeof req.body === 'object') {
      rawCmd = req.body.command || req.body.cmd || req.body.text || req.body.q || '';
      if (!rawCmd && (req.body.to || req.body.name) && req.body.message) {
        rawCmd = `GONDER ${req.body.to || req.body.name} | ${req.body.message}`;
      }
    }
    if (!rawCmd) {
      rawCmd = req.query.cmd || req.query.command || req.query.q || req.query.text || 'YARDIM';
    }
    const output = await executePlainTextCommand(waManager, rawCmd, PORT);
    sendPlain(res, output);
  } catch (err) {
    sendPlain(res, `❌ HATA: ${err.message}`, 400);
  }
}

app.get(['/text', '/api/text'], handleUnifiedPlainText);
app.post(['/text', '/api/text'], handleUnifiedPlainText);

// Düz Metin Durum
app.get('/text/status', (req, res) => {
  sendPlain(res, formatStatusText(waManager.getStatus()));
});

// Düz Metin Sohbet Listesi
app.get('/text/chats', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 25;
    const search = req.query.search || req.query.q || '';
    const chats = await waManager.getChats(limit, search);
    sendPlain(res, formatChatsText(chats));
  } catch (err) {
    sendPlain(res, `❌ HATA: ${err.message}`, 400);
  }
});

// Düz Metin Mesaj Geçmişi (İsimle, Numarayla veya Tüm Son Mesajlar)
app.get(['/text/messages', '/text/messages/:chat'], async (req, res) => {
  try {
    const chatTarget = req.params.chat || req.query.chat || req.query.chatId || req.query.to || req.query.name || '';
    const limit = Number(req.query.limit) || 40;
    const onlyIncoming = req.query.onlyIncoming === 'true';

    if (chatTarget) {
      const resolved = waManager.resolveRecipient(chatTarget);
      const msgs = await waManager.getMessages({ chatId: resolved.id, limit, onlyIncoming });
      sendPlain(res, formatMessagesText(msgs, `${resolved.name} (+${resolved.phone}) MESAJ GEÇMİŞİ`));
    } else {
      const msgs = await waManager.getMessages({ limit, onlyIncoming });
      sendPlain(res, formatMessagesText(msgs, 'TÜM SOHBETLERDEKİ SON MESAJLAR'));
    }
  } catch (err) {
    sendPlain(res, `❌ HATA: ${err.message}`, 400);
  }
});

// Düz Metin Kişiler / Rehber
app.get(['/text/contacts', '/text/contacts/:search'], (req, res) => {
  try {
    const search = req.params.search || req.query.search || req.query.q || '';
    const limit = Number(req.query.limit) || 60;
    const contacts = waManager.getContacts(search, limit);
    sendPlain(res, formatContactsText(contacts));
  } catch (err) {
    sendPlain(res, `❌ HATA: ${err.message}`, 400);
  }
});

// Düz Metin Mesaj Arama
app.get(['/text/search', '/text/search/:query'], (req, res) => {
  try {
    const query = req.params.query || req.query.q || req.query.query || '';
    const limit = Number(req.query.limit) || 30;
    const results = waManager.searchMessages(query, limit);
    sendPlain(res, formatMessagesText(results, `"${query}" MESAJ ARAMA SONUÇLARI`));
  } catch (err) {
    sendPlain(res, `❌ HATA: ${err.message}`, 400);
  }
});

// Düz Metin Mesaj Gönderme (GET ve POST destekli)
async function handlePlainTextSend(req, res) {
  try {
    let to = req.query.to || req.query.name || req.query.phone || '';
    let text = req.query.text || req.query.message || req.query.msg || '';

    if (typeof req.body === 'string' && req.body.trim()) {
      const raw = req.body.trim();
      const cleaned = raw.replace(/^(GONDER|GÖNDER|SEND|YAZ)\s+/i, '');
      if (cleaned.includes('|')) {
        const idx = cleaned.indexOf('|');
        to = cleaned.slice(0, idx).trim();
        text = cleaned.slice(idx + 1).trim();
      } else if (cleaned.includes(':') && !to) {
        const idx = cleaned.indexOf(':');
        to = cleaned.slice(0, idx).trim();
        text = cleaned.slice(idx + 1).trim();
      } else if (to && !text) {
        text = raw;
      }
    } else if (req.body && typeof req.body === 'object') {
      to = to || req.body.to || req.body.name || req.body.phone || req.body.chatId || '';
      text = text || req.body.text || req.body.message || req.body.msg || '';
    }

    const output = await executePlainTextCommand(waManager, `GONDER ${to} | ${text}`, PORT);
    sendPlain(res, output);
  } catch (err) {
    sendPlain(res, `❌ HATA: ${err.message}`, 400);
  }
}

app.get('/text/send', handlePlainTextSend);
app.post('/text/send', handlePlainTextSend);

// Düz Metin Dosya / Medya Gönderme (GET ve POST destekli)
async function handlePlainTextSendFile(req, res) {
  try {
    let to = req.query.to || req.query.name || req.query.phone || '';
    let filePath = req.query.filePath || req.query.file || req.query.url || req.query.path || '';
    let caption = req.query.caption || req.query.text || req.query.message || '';

    if (typeof req.body === 'string' && req.body.trim()) {
      const raw = req.body.trim().replace(/^(DOSYA|DOSYA_GONDER|DOSYAGÖNDER|MEDYA|FILE|SEND_FILE)\s+/i, '');
      const parts = raw.split('|').map((s) => s.trim());
      if (parts.length >= 2) {
        to = parts[0];
        filePath = parts[1];
        caption = parts.slice(2).join(' | ');
      }
    } else if (req.body && typeof req.body === 'object') {
      to = to || req.body.to || req.body.name || req.body.phone || req.body.chatId || '';
      filePath = filePath || req.body.filePath || req.body.file || req.body.url || req.body.path || '';
      caption = caption || req.body.caption || req.body.text || req.body.message || '';
    }

    const cmd = caption ? `DOSYA ${to} | ${filePath} | ${caption}` : `DOSYA ${to} | ${filePath}`;
    const output = await executePlainTextCommand(waManager, cmd, PORT);
    sendPlain(res, output);
  } catch (err) {
    sendPlain(res, `❌ HATA: ${err.message}`, 400);
  }
}

app.get('/text/send-file', handlePlainTextSendFile);
app.post('/text/send-file', handlePlainTextSendFile);

// Düz Metin Yanıt Bekleme (AI Uyandırıcı - Blocking Wait)
async function handlePlainTextWait(req, res) {
  try {
    const chat = req.query.chat || req.query.to || req.query.name || (typeof req.body === 'string' ? req.body.trim() : req.body?.chat || '*');
    const timeout = Number(req.query.timeout || req.query.timeoutSeconds || req.body?.timeoutSeconds || 120);
    const output = await executePlainTextCommand(waManager, `BEKLE ${chat || '*'} | ${timeout}`, PORT);
    sendPlain(res, output);
  } catch (err) {
    sendPlain(res, `❌ HATA: ${err.message}`, 400);
  }
}

app.get('/text/wait', handlePlainTextWait);
app.post('/text/wait', handlePlainTextWait);

// Düz Metin Gönder ve Yanıt Bekle (SOR / ASK)
async function handlePlainTextAsk(req, res) {
  try {
    let raw = '';
    if (typeof req.body === 'string' && req.body.trim()) {
      raw = req.body.trim().replace(/^(SOR|ASK|GONDER_BEKLE|SEND_WAIT)\s+/i, '');
    } else {
      const to = req.query.to || req.query.name || req.body?.to || req.body?.name || '';
      const text = req.query.text || req.query.message || req.body?.text || req.body?.message || '';
      const timeout = req.query.timeout || req.body?.timeoutSeconds || 120;
      raw = `${to} | ${text} | ${timeout}`;
    }
    const output = await executePlainTextCommand(waManager, `SOR ${raw}`, PORT);
    sendPlain(res, output);
  } catch (err) {
    sendPlain(res, `❌ HATA: ${err.message}`, 400);
  }
}

app.get('/text/ask', handlePlainTextAsk);
app.post('/text/ask', handlePlainTextAsk);

// Düz Metin Okunmamış Mesajlar Özeti
app.get('/text/unread', async (req, res) => {
  try {
    const output = await executePlainTextCommand(waManager, 'OKUNMAMIS', PORT);
    sendPlain(res, output);
  } catch (err) {
    sendPlain(res, `❌ HATA: ${err.message}`, 400);
  }
});

// Gerçek Zamanlı Düz Metin SSE Akışı (AI Stream Wakeup)
app.get('/text/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write(`# WhatsApp AI Plain-Text Canlı Mesaj Akışı Başladı\n\n`);

  const onIncoming = (msg) => {
    const filter = req.query.chat ? req.query.chat.toLowerCase() : '';
    if (filter && !String(msg.chatName || '').toLowerCase().includes(filter) && !String(msg.senderPhone || '').includes(filter)) {
      return;
    }
    res.write(`data: [${new Date(msg.timestamp).toLocaleString('tr-TR')}] ${msg.senderName} (+${msg.senderPhone}): ${msg.text}\n\n`);
  };

  waManager.on('incoming_message', onIncoming);
  req.on('close', () => {
    waManager.removeListener('incoming_message', onIncoming);
  });
});

// ============================================================================
// 2. JSON REST API ENDPOINTS
// ============================================================================

app.get('/api/status', (req, res) => {
  res.json({ ok: true, ...waManager.getStatus() });
});

app.get('/api/qr', (req, res) => {
  const st = waManager.getStatus();
  if (req.query.format === 'image' && st.qrDataUrl) {
    const base64Data = st.qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const img = Buffer.from(base64Data, 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': img.length
    });
    return res.end(img);
  }
  res.json({
    ok: true,
    status: st.status,
    connected: st.connected,
    qrAvailable: st.qrAvailable,
    qrDataUrl: st.qrDataUrl,
    qrRaw: st.qrRaw
  });
});

app.post('/api/send', async (req, res) => {
  try {
    if (typeof req.body === 'string') {
      const output = await executePlainTextCommand(waManager, `GONDER ${req.body}`, PORT);
      return sendPlain(res, output);
    }
    const {
      to,
      phone,
      chatId,
      name,
      text,
      message,
      caption,
      filePath,
      url,
      base64,
      mimetype,
      filename,
      sendAsDocument,
      replyToMessageId
    } = req.body;
    const target = to || name || phone || chatId;

    // If file/media payload is included in /api/send, automatically route to sendMedia!
    if (filePath || url || base64) {
      const result = await waManager.sendMedia(
        target,
        { filePath, url, base64, mimetype, filename },
        caption || text || message || '',
        { sendAsDocument: Boolean(sendAsDocument), replyToMessageId }
      );
      if (req.query.format === 'text') {
        return sendPlain(
          res,
          `✅ DOSYA GÖNDERİLDİ -> ${result.recipientName} (+${result.recipientPhone}): ${result.filename}`
        );
      }
      return res.json({ ok: true, ...result });
    }

    const bodyText = text || message;
    const result = await waManager.sendMessage(target, bodyText, { replyToMessageId });
    if (req.query.format === 'text') {
      return sendPlain(res, `✅ MESAJ GÖNDERİLDİ -> ${result.recipientName} (+${result.recipientPhone}): ${result.text}`);
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/send-file', async (req, res) => {
  try {
    if (typeof req.body === 'string') {
      const output = await executePlainTextCommand(waManager, `DOSYA ${req.body}`, PORT);
      return sendPlain(res, output);
    }
    const {
      to,
      phone,
      chatId,
      name,
      filePath,
      file,
      path: localPath,
      url,
      base64,
      data,
      mimetype,
      filename,
      caption,
      text,
      message,
      sendAsDocument,
      replyToMessageId
    } = req.body;

    const target = to || name || phone || chatId;
    const result = await waManager.sendMedia(
      target,
      {
        filePath: filePath || file || localPath,
        url,
        base64: base64 || data,
        mimetype,
        filename
      },
      caption || text || message || '',
      { sendAsDocument: Boolean(sendAsDocument), replyToMessageId }
    );

    if (req.query.format === 'text') {
      return sendPlain(
        res,
        `✅ DOSYA GÖNDERİLDİ -> ${result.recipientName} (+${result.recipientPhone}): ${result.filename}`
      );
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get('/api/chats', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 30;
    const search = req.query.search || '';
    const chats = await waManager.getChats(limit, search);
    if (req.query.format === 'text') return sendPlain(res, formatChatsText(chats));
    res.json({ ok: true, chats });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const chatId = req.query.chatId || req.query.to || req.query.phone || req.query.name || '';
    const limit = Number(req.query.limit) || 30;
    const onlyIncoming = req.query.onlyIncoming === 'true';
    const messages = await waManager.getMessages({ chatId, limit, onlyIncoming });
    if (req.query.format === 'text') return sendPlain(res, formatMessagesText(messages));
    res.json({
      ok: true,
      messages
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/sync', async (req, res) => {
  try {
    await waManager.syncAllData();
    res.json({ ok: true, ...waManager.getStatus() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// JSON API: Yanıt Gelene Kadar Bekle (AI Wake-Up)
app.all('/api/wait', async (req, res) => {
  try {
    const chatId = req.query.chatId || req.query.chat || req.query.to || req.body?.chatId || req.body?.to || '*';
    const timeoutSeconds = Number(req.query.timeoutSeconds || req.query.timeout || req.body?.timeoutSeconds || 120);
    const collectBurstMs = Number(req.query.collectBurstMs || req.body?.collectBurstMs || 1500);
    const result = await waManager.waitForReply({ chatId, timeoutSeconds, collectBurstMs });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// JSON API: Mesaj Gönder ve Yanıt Gelene Kadar Bekle (AI Send & Wake-Up)
app.post(['/api/ask', '/api/send-and-wait'], async (req, res) => {
  try {
    const { to, name, phone, chatId, text, message, timeoutSeconds, collectBurstMs, replyToMessageId } = req.body;
    const target = to || name || phone || chatId;
    const bodyText = text || message;
    const result = await waManager.sendAndWaitForReply(target, bodyText, {
      timeoutSeconds: Number(timeoutSeconds) || 120,
      collectBurstMs: Number(collectBurstMs) || 1500,
      replyToMessageId
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// JSON API: Okunmamış Mesajlar Özeti
app.get('/api/unread', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 30;
    const summary = await waManager.getUnreadSummary(limit);
    res.json({ ok: true, ...summary });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// JSON API: Yazıyor... (typing) veya Okundu (seen) Durumu Gönder
app.post('/api/presence', async (req, res) => {
  try {
    const { to, name, phone, chatId, state, durationSeconds } = req.body;
    const target = to || name || phone || chatId;
    const result = await waManager.sendPresenceState(target, state || 'typing', durationSeconds || 5);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// JSON API: Gerçek Zamanlı SSE Mesaj Akışı
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'listening', timestamp: Date.now() })}\n\n`);

  const onIncoming = (msg) => {
    res.write(`event: incoming_message\ndata: ${JSON.stringify(msg)}\n\n`);
  };

  waManager.on('incoming_message', onIncoming);
  req.on('close', () => {
    waManager.removeListener('incoming_message', onIncoming);
  });
});

// JSON API: Webhook Yönetimi (Gelen mesajda AI servisini otomatik tetikler)
app.get('/api/webhooks', (req, res) => {
  res.json({ ok: true, webhooks: waManager.getWebhooks() });
});

app.post('/api/webhooks', (req, res) => {
  try {
    const url = req.body?.url || req.query.url;
    const webhooks = waManager.addWebhook(url);
    res.json({ ok: true, webhooks });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/webhooks', (req, res) => {
  const url = req.body?.url || req.query.url;
  const webhooks = waManager.removeWebhook(url);
  res.json({ ok: true, webhooks });
});

app.get('/api/search', (req, res) => {
  try {
    const query = req.query.query || req.query.q || '';
    const limit = Number(req.query.limit) || 20;
    const results = waManager.searchMessages(query, limit);
    if (req.query.format === 'text') return sendPlain(res, formatMessagesText(results, `"${query}" ARAMA SONUÇLARI`));
    res.json({
      ok: true,
      query,
      results
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get('/api/contacts', (req, res) => {
  try {
    const search = req.query.search || req.query.q || '';
    const limit = Number(req.query.limit) || 50;
    const contacts = waManager.getContacts(search, limit);
    if (req.query.format === 'text') return sendPlain(res, formatContactsText(contacts));
    res.json({
      ok: true,
      contacts
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    const st = await waManager.logoutAndReset();
    res.json({ ok: true, message: 'Oturum sıfırlandı, yeni QR kod oluşturuluyor.', ...st });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/tools', (req, res) => {
  res.json({
    ok: true,
    tools: TOOLS
  });
});

app.post('/api/tool', async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    const result = await executeTool(waManager, name, args || {});
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// OpenAPI 3.1 Specification for AI Agents & Function Calling
app.get('/openapi.json', (req, res) => {
  res.json({
    openapi: '3.1.0',
    info: {
      title: 'WhatsApp AI API Bridge (Plain-Text & JSON)',
      version: '2.1.0',
      description: 'Gemini, OpenCode, Claude ve tüm yapay zeka modelleri için Düz Metin (Plain Text), Dosya Gönderimi, REST API ve MCP servisi.'
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    paths: {
      '/text': {
        post: {
          operationId: 'whatsapp_plain_text',
          summary: 'Düz metin komutu gönderir ve düz metin yanıt alır (Örn: MESAJLAR Ahmet Yılmaz, GONDER Ahmet | Merhaba, DOSYA Ahmet | C:\\rapor.pdf | Rapor)',
          requestBody: {
            required: true,
            content: { 'text/plain': { schema: { type: 'string' } } }
          },
          responses: { '200': { description: 'Düz metin yanıt' } }
        },
        get: {
          operationId: 'whatsapp_plain_text_get',
          summary: 'URL parametresiyle düz metin komutu çalıştırır (?cmd=MESAJLAR%20Ahmet)',
          responses: { '200': { description: 'Düz metin yanıt' } }
        }
      },
      '/text/send-file': {
        post: {
          operationId: 'whatsapp_plain_text_send_file',
          summary: 'Düz metin ile dosya gönderir (Body: Kişi Adı | Dosya Yolu veya URL | Açıklama)',
          requestBody: {
            required: true,
            content: { 'text/plain': { schema: { type: 'string' } } }
          },
          responses: { '200': { description: 'Düz metin dosya gönderim sonucu' } }
        }
      },
      '/ai.txt': {
        get: {
          operationId: 'whatsapp_ai_guide',
          summary: 'Yapay zekalar için düz metin kullanım kılavuzunu getirir',
          responses: { '200': { description: 'Kılavuz metni' } }
        }
      },
      '/api/status': {
        get: {
          operationId: 'whatsapp_get_status',
          summary: 'WhatsApp bağlantı durumunu ve bağlı hesabı kontrol eder',
          responses: { '200': { description: 'Durum bilgisi' } }
        }
      },
      '/api/send': {
        post: {
          operationId: 'whatsapp_send_message',
          summary: 'WhatsApp üzerinden kişi adına, numaraya veya gruba mesaj gönderir',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: TOOLS.find((t) => t.name === 'whatsapp_send_message').inputSchema
              }
            }
          },
          responses: { '200': { description: 'Gönderim sonucu' } }
        }
      },
      '/api/send-file': {
        post: {
          operationId: 'whatsapp_send_file',
          summary: 'WhatsApp üzerinden kişi adına, numaraya veya gruba dosya/görsel/belge gönderir',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: TOOLS.find((t) => t.name === 'whatsapp_send_file').inputSchema
              }
            }
          },
          responses: { '200': { description: 'Dosya gönderim sonucu' } }
        }
      },
      '/api/chats': {
        get: {
          operationId: 'whatsapp_get_chats',
          summary: 'Son sohbetleri ve okunmamış mesaj sayılarını getirir',
          responses: { '200': { description: 'Sohbet listesi' } }
        }
      },
      '/api/messages': {
        get: {
          operationId: 'whatsapp_get_messages',
          summary: 'Kişi adıyla veya numarayla sohbet mesaj geçmişini getirir',
          responses: { '200': { description: 'Mesaj listesi' } }
        }
      },
      '/api/search': {
        get: {
          operationId: 'whatsapp_search_messages',
          summary: 'Mesaj geçmişinde kelime araması yapar',
          responses: { '200': { description: 'Arama sonuçları' } }
        }
      },
      '/api/contacts': {
        get: {
          operationId: 'whatsapp_get_contacts',
          summary: 'Kişileri ve gerçek telefon numaralarını listeler',
          responses: { '200': { description: 'Kişi listesi' } }
        }
      }
    }
  });
});

// ============================================================================
// 3. MCP (Model Context Protocol) JSON-RPC 2.0 Handler (Streamable HTTP + SSE)
// ============================================================================

async function handleMcpJsonRpc(rpcRequest) {
  const { jsonrpc, id, method, params } = rpcRequest;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'whatsapp-ai-api',
          version: '2.0.0'
        }
      }
    };
  }

  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return null;
  }

  if (method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: TOOLS
      }
    };
  }

  if (method === 'tools/call') {
    try {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const output = await executeTool(waManager, toolName, toolArgs);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof output === 'string' ? output : JSON.stringify(output, null, 2)
            }
          ],
          isError: false
        }
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: `Hata: ${err.message}`
            }
          ],
          isError: true
        }
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code: -32601,
      message: `Desteklenmeyen MCP metodu: ${method}`
    }
  };
}

app.post('/mcp', async (req, res) => {
  try {
    const body = req.body;
    if (Array.isArray(body)) {
      const responses = [];
      for (const item of body) {
        const resp = await handleMcpJsonRpc(item);
        if (resp) responses.push(resp);
      }
      if (responses.length === 0) return res.status(202).end();
      return res.json(responses);
    } else {
      const resp = await handleMcpJsonRpc(body);
      if (!resp) return res.status(202).end();
      return res.json(resp);
    }
  } catch (err) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id ?? null,
      error: { code: -32603, message: err.message }
    });
  }
});

const sseClients = new Map();
app.get('/mcp/sse', (req, res) => {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  sseClients.set(sessionId, res);
  res.write(`event: endpoint\ndata: /mcp/messages?sessionId=${sessionId}\n\n`);
  req.on('close', () => {
    sseClients.delete(sessionId);
  });
});

app.post('/mcp/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  const sseRes = sseClients.get(sessionId);
  const resp = await handleMcpJsonRpc(req.body);
  if (resp && sseRes) {
    sseRes.write(`event: message\ndata: ${JSON.stringify(resp)}\n\n`);
  }
  res.status(202).json(resp || { ok: true });
});

// Start Server & WhatsApp Manager
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║ ✅ WHATSAPP AI API SUNUCUSU ZATEN ARKA PLANDA ÇALIŞIYOR!       ║');
    console.log(`║ 🌐 Kontrol Paneli & QR Kod : http://localhost:${PORT}             ║`);
    console.log(`║ 📄 Plain-Text AI Kılavuzu  : http://localhost:${PORT}/ai.txt       ║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
    process.exit(0);
  } else {
    console.error('Sunucu hatası:', err);
  }
});

// Disable HTTP request/socket timeouts so long-polling AI wake-up endpoints (/text/wait, /api/wait, /mcp) never drop early
server.timeout = 0;
server.requestTimeout = 0;
server.keepAliveTimeout = 650000;

server.listen(PORT, HOST, () => {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           🤖 WHATSAPP AI API & MCP SUNUCUSU BAŞLADI            ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║ 🌐 Kontrol Paneli & QR Kod : http://localhost:${PORT}             ║`);
  console.log(`║ 📝 Plain-Text AI Backend   : http://localhost:${PORT}/text        ║`);
  console.log(`║ 📖 Yapay Zeka Kılavuzu     : http://localhost:${PORT}/ai.txt      ║`);
  console.log(`║ 🔌 JSON REST API Adresi    : http://localhost:${PORT}/api         ║`);
  console.log(`║ 🧠 MCP HTTP Adresi         : http://localhost:${PORT}/mcp         ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  waManager.start();
});
