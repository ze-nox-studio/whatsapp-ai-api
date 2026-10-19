const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Kalıcı veriler kod klasörüne değil, kullanıcının bilgisayarındaki yerel uygulama verisi dizinine kaydedilir
const DEFAULT_BASE_DIR =
  process.env.LOCALAPPDATA ||
  process.env.APPDATA ||
  path.join(os.homedir(), '.local', 'share');

const DATA_DIR = process.env.WA_DATA_DIR || path.join(DEFAULT_BASE_DIR, 'WhatsApp-AI-API');
const AUTH_DIR = path.join(DATA_DIR, 'wwebjs_auth');
const CACHE_DIR = path.join(DATA_DIR, 'wwebjs_cache');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

// Turkish-aware lowercase normalization for smart name search
function normalizeTr(str) {
  if (!str) return '';
  return String(str)
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase()
    .trim();
}

function jidToPhone(jid) {
  if (!jid) return '';
  const str = String(jid);
  if (str.endsWith('@g.us')) return 'Grup';
  return str
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace('@g.us', '')
    .replace('@lid', '')
    .split(':')[0];
}

function isPureDigits(str) {
  if (!str) return false;
  return /^\d+$/.test(String(str).trim());
}

function toWwebJid(jidOrPhone) {
  const str = String(jidOrPhone || '').trim();
  if (str.endsWith('@c.us') || str.endsWith('@g.us') || str.endsWith('@lid')) {
    return str;
  }
  if (str.endsWith('@s.whatsapp.net')) {
    return str.replace('@s.whatsapp.net', '@c.us');
  }
  let digits = str.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('05')) {
    digits = '9' + digits;
  } else if (digits.length === 10 && digits.startsWith('5')) {
    digits = '90' + digits;
  }
  return `${digits}@c.us`;
}

const IGNORED_MSG_TYPES = new Set([
  'e2e_notification',
  'notification_template',
  'gp2',
  'protocol',
  'ciphertext',
  'revoked',
  'call_log',
  'system',
  'unknown'
]);

class WhatsAppManager extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.status = 'initializing'; // initializing | qr_ready | authenticated | connected | disconnected
    this.qrRaw = null;
    this.qrDataUrl = null;
    this.user = null;
    this.startTime = Date.now();
    this.lastError = null;
    this.isStarting = false;
    this.isSyncing = false;

    this.lidToPn = {}; // "10000000000000@lid" -> "905551234567@c.us"
    this.pnToLid = {}; // "905551234567@c.us" -> "10000000000000@lid"

    this.store = {
      chats: {},     // id -> { id, rawChatId, name, phone, isGroup, unreadCount, conversationTimestamp, lastMessage }
      contacts: {},  // id -> { id, phone, name, pushname, isGroup }
      messages: []   // Array of messages { id, chatId, chatName, fromMe, sender, senderName, senderPhone, text, timestamp, isoDate }
    };

    this.loadStore();
    this.saveTimer = null;
  }

  loadStore() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        this.lidToPn = parsed.lidToPn || {};
        this.pnToLid = parsed.pnToLid || {};

        const rawContacts = parsed.contacts || {};
        for (const [k, v] of Object.entries(rawContacts)) {
          const id = toWwebJid(v.id || k);
          if (id === 'status@broadcast' || id === '0@c.us') continue;

          // Ignore raw unnamed @lid entries
          if (id.endsWith('@lid') && isPureDigits(v.name) && isPureDigits(v.pushname)) {
            continue;
          }

          // IMPORTANT FIX: If id is @c.us, the REAL phone number is ALWAYS jidToPhone(id), NOT v.phone (which may be an internal LID)!
          const realPhone = id.endsWith('@c.us')
            ? jidToPhone(id)
            : id.endsWith('@g.us')
              ? 'Grup'
              : (v.phone || jidToPhone(id));

          // Fix numeric LID names when pushname is a real name (e.g. name="10000000000000", pushname="Ayşe")
          let bestName = v.name || v.notify || v.pushname || realPhone;
          if (isPureDigits(bestName) && bestName !== realPhone && v.pushname && !isPureDigits(v.pushname)) {
            bestName = v.pushname;
          }

          // Skip contacts whose name is still just a 14-15 digit LID
          if (isPureDigits(bestName) && bestName.length >= 14 && bestName !== realPhone) {
            continue;
          }

          this.store.contacts[id] = {
            id,
            phone: realPhone,
            name: bestName,
            pushname: v.pushname || v.notify || bestName,
            isGroup: id.endsWith('@g.us') || Boolean(v.isGroup)
          };
        }

        const rawChats = parsed.chats || {};
        for (const [k, v] of Object.entries(rawChats)) {
          let id = toWwebJid(v.id || k);
          if (this.lidToPn[id]) id = this.lidToPn[id];
          if (id === 'status@broadcast') continue;
          // Skip empty system notification chats with raw @lid
          if (id.endsWith('@lid') && isPureDigits(v.name) && (v.lastMessage === '[notification_template]' || v.lastMessage === '[e2e_notification]')) {
            continue;
          }
          const contact = this.store.contacts[id];
          const realPhone = id.endsWith('@c.us') ? jidToPhone(id) : id.endsWith('@g.us') ? 'Grup' : jidToPhone(id);
          const lastMsgClean = (v.lastMessage === '[notification_template]' || v.lastMessage === '[e2e_notification]') ? '' : (v.lastMessage || '');
          this.store.chats[id] = {
            ...v,
            id,
            phone: realPhone,
            isGroup: id.endsWith('@g.us') || Boolean(v.isGroup),
            name: contact?.name || (!isPureDigits(v.name) ? v.name : realPhone),
            lastMessage: lastMsgClean
          };
        }

        // Filter out system notification pseudo-messages and deduplicate
        const seenKeys = new Set();
        this.store.messages = (parsed.messages || [])
          .filter((m) => m.text && m.text !== '[notification_template]' && m.text !== '[e2e_notification]' && m.text !== '[gp2]')
          .map((m) => {
            let chatId = toWwebJid(m.chatId);
            if (this.lidToPn[chatId]) chatId = this.lidToPn[chatId];
            const contact = this.store.contacts[chatId];
            const realPhone = chatId.endsWith('@c.us') ? jidToPhone(chatId) : jidToPhone(chatId);
            return {
              ...m,
              chatId,
              chatName: contact?.name || (!isPureDigits(m.chatName) ? m.chatName : realPhone),
              senderName: m.fromMe
                ? 'Ben'
                : (contact?.name || (!isPureDigits(m.senderName) ? m.senderName : realPhone)),
              senderPhone: m.fromMe ? (this.user?.phone || '') : realPhone
            };
          })
          .filter((m) => {
            const key = `${m.chatId}_${m.timestamp}_${m.text}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          });
      }
    } catch (err) {
      console.error('[Store] Yükleme hatası:', err.message);
    }
  }

  scheduleSaveStore() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        if (this.store.messages.length > 4000) {
          this.store.messages = this.store.messages.slice(-4000);
        }
        const toSave = {
          lidToPn: this.lidToPn,
          pnToLid: this.pnToLid,
          chats: this.store.chats,
          contacts: this.store.contacts,
          messages: this.store.messages
        };
        fs.writeFileSync(STORE_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
      } catch (err) {
        console.error('[Store] Kaydetme hatası:', err.message);
      }
    }, 1000);
  }

  canonicalJid(jid) {
    if (!jid) return '';
    const norm = toWwebJid(jid);
    return this.lidToPn[norm] || norm;
  }

  getContactDisplayName(jid, fallback = '') {
    if (!jid) return fallback;
    const norm = this.canonicalJid(jid);
    const c = this.store.contacts[norm];
    if (c && c.name && !isPureDigits(c.name)) return c.name;
    if (c && c.pushname && !isPureDigits(c.pushname)) return c.pushname;
    const ch = this.store.chats[norm];
    if (ch && ch.name && !isPureDigits(ch.name)) return ch.name;
    if (fallback && !isPureDigits(fallback)) return fallback;
    return c?.name || ch?.name || jidToPhone(norm);
  }

  /**
   * Smart Resolver: Accepts a phone number ("05551234567"), JID ("905551234567@c.us"),
   * OR a contact/group name ("Ahmet Yılmaz", "Ayşe Demir", "Proje Grubu").
   */
  resolveRecipient(input) {
    if (!input || !String(input).trim()) {
      throw new Error('Alıcı telefon numarası veya kişi adı gerekli.');
    }
    const raw = String(input).trim();

    // 1. Direct JID
    if (raw.includes('@c.us') || raw.includes('@g.us') || raw.includes('@s.whatsapp.net') || raw.includes('@lid')) {
      const id = this.canonicalJid(raw);
      return {
        id,
        lid: this.pnToLid[id] || (raw.endsWith('@lid') ? raw : null),
        name: this.getContactDisplayName(id, jidToPhone(id)),
        phone: id.endsWith('@c.us') ? jidToPhone(id) : (this.store.contacts[id]?.phone || jidToPhone(id))
      };
    }

    // 2. Phone number (only digits/spaces/plus, >= 10 digits)
    const digitsOnly = raw.replace(/\D/g, '');
    const lettersOnly = raw.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/g, '');
    if (digitsOnly.length >= 10 && lettersOnly.length === 0) {
      const id = this.canonicalJid(toWwebJid(digitsOnly));
      return {
        id,
        lid: this.pnToLid[id] || null,
        name: this.getContactDisplayName(id, jidToPhone(id)),
        phone: jidToPhone(id)
      };
    }

    // 3. Name Search across contacts and chats (Turkish-aware)
    const qNorm = normalizeTr(raw);
    const qWords = qNorm.split(/\s+/).filter(Boolean);

    const candidates = new Map();
    for (const c of Object.values(this.store.contacts)) {
      if (!c.id || c.id === 'status@broadcast') continue;
      const canonId = this.canonicalJid(c.id);
      const realPhone = canonId.endsWith('@c.us') ? jidToPhone(canonId) : (c.phone || jidToPhone(canonId));
      candidates.set(canonId, {
        id: canonId,
        name: c.name || c.pushname || realPhone,
        pushname: c.pushname || '',
        phone: realPhone
      });
    }
    for (const ch of Object.values(this.store.chats)) {
      if (!ch.id || ch.id === 'status@broadcast') continue;
      const canonId = this.canonicalJid(ch.id);
      const realPhone = canonId.endsWith('@c.us') ? jidToPhone(canonId) : (ch.phone || jidToPhone(canonId));
      if (!candidates.has(canonId)) {
        candidates.set(canonId, {
          id: canonId,
          name: ch.name || realPhone,
          pushname: '',
          phone: realPhone
        });
      }
    }

    const scored = [];
    for (const item of candidates.values()) {
      const nameNorm = normalizeTr(item.name);
      const pushNorm = normalizeTr(item.pushname);
      const combined = `${nameNorm} ${pushNorm}`.trim();
      if (!combined) continue;

      let score = 0;
      if (nameNorm === qNorm || pushNorm === qNorm) {
        score = 100;
      } else if (nameNorm.startsWith(qNorm)) {
        score = 85;
      } else if (nameNorm.includes(qNorm) || pushNorm.includes(qNorm)) {
        score = 75;
      } else if (qWords.length > 0 && qWords.every((w) => combined.includes(w))) {
        score = 65;
      }

      if (score > 0) {
        if (item.id.endsWith('@c.us') || item.id.endsWith('@g.us')) {
          score += 5;
        }
        scored.push({ ...item, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      throw new Error(
        `"${raw}" adına sahip bir kişi veya sohbet bulunamadı. Lütfen whatsapp_get_contacts aracıyla rehberi kontrol edin veya telefon numarası girin.`
      );
    }

    const winner = scored[0];
    return {
      id: winner.id,
      lid: this.pnToLid[winner.id] || null,
      name: winner.name,
      phone: winner.id.endsWith('@c.us') ? jidToPhone(winner.id) : winner.phone,
      matchedAlternatives: scored.slice(1, 5).map((x) => ({ name: x.name, phone: x.phone, id: x.id }))
    };
  }

  ingestRawMessage(rawMsg) {
    if (!rawMsg || !rawMsg.id || !rawMsg.chatId) return null;
    if (IGNORED_MSG_TYPES.has(rawMsg.type)) return null;
    if (!rawMsg.text || rawMsg.text === '[notification_template]' || rawMsg.text === '[e2e_notification]') {
      return null;
    }

    const canonChatId = this.canonicalJid(rawMsg.chatId);
    if (canonChatId === 'status@broadcast') return null;

    const canonSenderId = rawMsg.sender ? this.canonicalJid(rawMsg.sender) : (rawMsg.fromMe ? (this.user?.id || 'me') : canonChatId);
    const realChatPhone = canonChatId.endsWith('@c.us') ? jidToPhone(canonChatId) : (canonChatId.endsWith('@g.us') ? 'Grup' : jidToPhone(canonChatId));
    const realSenderPhone = canonSenderId.endsWith('@c.us') ? jidToPhone(canonSenderId) : jidToPhone(canonSenderId);

    const chatName = this.getContactDisplayName(canonChatId, rawMsg.chatName || realChatPhone);
    const senderName = rawMsg.fromMe
      ? (this.user?.name || 'Ben')
      : this.getContactDisplayName(canonSenderId, rawMsg.senderName || chatName);

    const formatted = {
      id: rawMsg.id,
      chatId: canonChatId,
      chatName,
      fromMe: Boolean(rawMsg.fromMe),
      sender: canonSenderId,
      senderName,
      senderPhone: rawMsg.fromMe ? (this.user?.phone || '') : realSenderPhone,
      text: rawMsg.text,
      timestamp: rawMsg.timestamp || Date.now(),
      isoDate: new Date(rawMsg.timestamp || Date.now()).toISOString()
    };

    const existsIdx = this.store.messages.findIndex(
      (m) =>
        m.id === formatted.id ||
        (m.chatId === formatted.chatId && m.timestamp === formatted.timestamp && m.text === formatted.text)
    );
    if (existsIdx >= 0) {
      this.store.messages[existsIdx] = formatted;
    } else {
      this.store.messages.push(formatted);
    }

    // Update chat summary
    const existingChat = this.store.chats[canonChatId] || {
      id: canonChatId,
      rawChatId: rawMsg.rawChatId || canonChatId,
      phone: realChatPhone,
      name: chatName,
      isGroup: canonChatId.endsWith('@g.us'),
      unreadCount: 0
    };
    if (chatName && !isPureDigits(chatName)) {
      existingChat.name = chatName;
    }
    if (!existingChat.conversationTimestamp || formatted.timestamp >= existingChat.conversationTimestamp) {
      existingChat.lastMessage = formatted.text;
      existingChat.lastSenderName = senderName;
      existingChat.conversationTimestamp = formatted.timestamp;
    }
    this.store.chats[canonChatId] = existingChat;

    return formatted;
  }

  /**
   * Directly queries WhatsApp Web's internal WAWebCollections inside Chrome via pupPage.evaluate.
   * This avoids whatsapp-web.js's broken getChatModel/groupMetadata crash and accurately resolves
   * @lid -> @c.us phone numbers, contact names, all chats, and past message history!
   */
  async syncAllData() {
    if (!this.client || !this.client.pupPage || this.status !== 'connected' || this.isSyncing) return;
    this.isSyncing = true;
    try {
      console.log('🔄 [WhatsApp] Kişiler, LID-Numara eşleşmeleri, sohbetler ve mesaj geçmişi çekiliyor...');

      const snapshot = await this.client.pupPage.evaluate(async () => {
        const result = {
          lidToPn: {},
          contacts: [],
          chats: [],
          messages: []
        };

        const Collections = window.require('WAWebCollections');
        let ContactMethods = null;
        try { ContactMethods = window.require('WAWebContactGetters'); } catch (e) {}
        let LidUtils = null;
        try { LidUtils = window.require('WAWebLidMigrationUtils'); } catch (e) {}
        let ApiContact = null;
        try { ApiContact = window.require('WAWebApiContact'); } catch (e) {}
        let LoadMsgs = null;
        try { LoadMsgs = window.require('WAWebChatLoadMessages'); } catch (e) {}

        const isDigits = (s) => s && /^\d+$/.test(String(s).trim());

        // 1. Collect all contacts and build LID <-> PhoneNumber (@c.us) map
        const rawContacts = Collections?.Contact?.getModelsArray?.() || [];
        for (const c of rawContacts) {
          try {
            const rawId = c.id?._serialized;
            if (!rawId || rawId === 'status@broadcast' || rawId === '0@c.us') continue;

            let pnId = null;
            let lidId = null;

            if (rawId.endsWith('@lid')) {
              lidId = rawId;
              if (c.phoneNumber?._serialized) {
                pnId = c.phoneNumber._serialized;
              } else if (LidUtils?.toPn) {
                const pnWid = LidUtils.toPn(c.id);
                if (pnWid?._serialized) pnId = pnWid._serialized;
              } else if (ApiContact?.getAlternateUserWid) {
                const alt = ApiContact.getAlternateUserWid(c.id);
                if (alt?._serialized && alt._serialized.endsWith('@c.us')) pnId = alt._serialized;
              }
            } else if (rawId.endsWith('@c.us')) {
              pnId = rawId;
              if (c.lid?._serialized) {
                lidId = c.lid._serialized;
              } else if (LidUtils?.toLid) {
                const lWid = LidUtils.toLid(c.id);
                if (lWid?._serialized) lidId = lWid._serialized;
              } else if (ApiContact?.getAlternateUserWid) {
                const alt = ApiContact.getAlternateUserWid(c.id);
                if (alt?._serialized && alt._serialized.endsWith('@lid')) lidId = alt._serialized;
              }
            }

            if (lidId && pnId) {
              result.lidToPn[lidId] = pnId;
            }

            const finalId = pnId || rawId;
            const getterName = ContactMethods ? ContactMethods.getName(c) : null;
            const getterPush = ContactMethods ? ContactMethods.getPushname(c) : null;

            const rawName = getterName || c.name || c.shortName || c.formattedName || '';
            const pushname = getterPush || c.pushname || c.verifiedName || '';

            const realPhone = finalId.endsWith('@c.us')
              ? finalId.replace('@c.us', '')
              : finalId.endsWith('@g.us')
                ? 'Grup'
                : finalId.split('@')[0];

            let bestName = rawName;
            if (!bestName || (isDigits(bestName) && bestName !== realPhone)) {
              bestName = (!isDigits(pushname) && pushname) ? pushname : (rawName || realPhone);
            }

            result.contacts.push({
              id: finalId,
              lidId: lidId || null,
              phone: realPhone,
              name: bestName,
              pushname: pushname || bestName,
              isGroup: finalId.endsWith('@g.us') || Boolean(c.isGroup)
            });
          } catch (e) {}
        }

        // Helper to extract message text
        const extractMsgText = (m) => {
          if (!m) return '';
          if (m.isNotification) return '';
          const t = m.type || 'chat';
          if (['e2e_notification', 'notification_template', 'gp2', 'protocol', 'ciphertext', 'revoked', 'call_log'].includes(t)) {
            return '';
          }
          if (m.body && typeof m.body === 'string' && t === 'chat') return m.body;
          if (m.caption && typeof m.caption === 'string') return m.caption;
          if (m.body && typeof m.body === 'string' && !m.body.startsWith('/9j/') && m.body.length < 2000 && t !== 'image' && t !== 'video' && t !== 'sticker') {
            return m.body;
          }
          if (t === 'image') return m.caption ? `[Görsel] ${m.caption}` : '[Görsel]';
          if (t === 'video') return m.caption ? `[Video] ${m.caption}` : '[Video]';
          if (t === 'ptt' || t === 'audio') return '[Sesli Mesaj]';
          if (t === 'document') return `[Belge: ${m.filename || 'Dosya'}]`;
          if (t === 'sticker') return '[Çıkartma]';
          if (t === 'location') return '[Konum]';
          if (t === 'vcard') return '[Kişi Kartı]';
          return m.body || '';
        };

        // 2. Collect all Chats & their Messages
        const rawChats = Collections?.Chat?.getModelsArray?.() || [];
        // Sort chats by timestamp descending
        const sortedChats = [...rawChats].sort((a, b) => (b.t || 0) - (a.t || 0));

        for (let idx = 0; idx < sortedChats.length; idx++) {
          const ch = sortedChats[idx];
          try {
            const rawChatId = ch.id?._serialized;
            if (!rawChatId || rawChatId === 'status@broadcast') continue;

            // Resolve @lid chat to @c.us phone number if possible
            let canonChatId = result.lidToPn[rawChatId] || rawChatId;
            if (rawChatId.endsWith('@lid') && !result.lidToPn[rawChatId]) {
              const pnFromContact = ch.contact?.phoneNumber?._serialized ||
                (LidUtils?.toPn ? LidUtils.toPn(ch.id)?._serialized : null);
              if (pnFromContact) {
                result.lidToPn[rawChatId] = pnFromContact;
                canonChatId = pnFromContact;
              }
            }

            const chatTitle =
              ch.formattedTitle ||
              ch.name ||
              ch.contact?.name ||
              ch.contact?.pushname ||
              canonChatId.split('@')[0];

            // For top 25 recent chats, load earlier messages if fewer than 15 are in memory
            let msgArray = ch.msgs?.getModelsArray?.() || [];
            if (idx < 25 && msgArray.length < 15 && LoadMsgs?.loadEarlierMsgs) {
              try {
                await Promise.race([
                  LoadMsgs.loadEarlierMsgs({ chat: ch }),
                  new Promise((r) => setTimeout(r, 1200))
                ]);
                msgArray = ch.msgs?.getModelsArray?.() || [];
              } catch (e) {}
            }

            let lastValidText = '';
            let lastValidTs = (ch.t || 0) * 1000;

            const recentMsgs = msgArray.slice(-40);
            for (const m of recentMsgs) {
              try {
                const txt = extractMsgText(m);
                if (!txt) continue;
                const ts = (m.t || Math.floor(Date.now() / 1000)) * 1000;
                const fromMe = Boolean(m.id?.fromMe);
                const rawAuthor = m.author?._serialized || m.author || (fromMe ? 'me' : canonChatId);
                const canonAuthor = result.lidToPn[rawAuthor] || rawAuthor;

                lastValidText = txt;
                if (ts > lastValidTs) lastValidTs = ts;

                const deterministicId =
                  m.id?._serialized ||
                  m.id?.id ||
                  `${canonChatId}_${ts}_${txt.slice(0, 20)}`;

                result.messages.push({
                  id: deterministicId,
                  chatId: canonChatId,
                  rawChatId,
                  chatName: chatTitle,
                  fromMe,
                  sender: canonAuthor,
                  senderName: m.notifyName || m.senderObj?.name || m.senderObj?.pushname || '',
                  type: m.type || 'chat',
                  text: txt,
                  timestamp: ts
                });
              } catch (e) {}
            }

            result.chats.push({
              id: canonChatId,
              rawChatId,
              name: chatTitle,
              isGroup: canonChatId.endsWith('@g.us') || Boolean(ch.isGroup),
              unreadCount: ch.unreadCount || 0,
              conversationTimestamp: lastValidTs || 0,
              lastMessage: lastValidText
            });
          } catch (e) {}
        }

        return result;
      });

      // Apply LID <-> PN mappings
      if (snapshot.lidToPn) {
        for (const [lid, pn] of Object.entries(snapshot.lidToPn)) {
          this.lidToPn[lid] = pn;
          this.pnToLid[pn] = lid;
        }
      }

      // Apply Contacts
      for (const c of snapshot.contacts || []) {
        if (c.id.endsWith('@lid') && isPureDigits(c.name) && isPureDigits(c.pushname)) {
          continue;
        }
        const existing = this.store.contacts[c.id] || {};
        const bestName =
          (!isPureDigits(c.name) ? c.name : null) ||
          (!isPureDigits(existing.name) ? existing.name : null) ||
          (!isPureDigits(c.pushname) ? c.pushname : null) ||
          c.phone;

        if (isPureDigits(bestName) && bestName.length >= 14 && bestName !== c.phone) {
          continue;
        }

        this.store.contacts[c.id] = {
          id: c.id,
          phone: c.id.endsWith('@c.us') ? jidToPhone(c.id) : c.phone,
          name: bestName,
          pushname: c.pushname || existing.pushname || bestName,
          isGroup: c.isGroup
        };
      }

      // Remove any stale @lid contacts that have been mapped to @c.us
      for (const lid of Object.keys(this.lidToPn)) {
        delete this.store.contacts[lid];
        delete this.store.chats[lid];
      }

      // Apply Chats
      for (const ch of snapshot.chats || []) {
        const canonId = this.canonicalJid(ch.id);
        const realPhone = canonId.endsWith('@c.us')
          ? jidToPhone(canonId)
          : canonId.endsWith('@g.us')
            ? 'Grup'
            : jidToPhone(canonId);
        const bestName = this.getContactDisplayName(canonId, ch.name || realPhone);

        this.store.chats[canonId] = {
          id: canonId,
          rawChatId: ch.rawChatId || canonId,
          phone: realPhone,
          name: bestName,
          isGroup: ch.isGroup,
          unreadCount: ch.unreadCount || 0,
          conversationTimestamp: Number(ch.conversationTimestamp) || 0,
          lastMessage: ch.lastMessage || this.store.chats[canonId]?.lastMessage || ''
        };

        // Also ensure contact entry has the chat's human name
        if (bestName && !isPureDigits(bestName)) {
          this.store.contacts[canonId] = {
            ...(this.store.contacts[canonId] || { id: canonId, phone: realPhone, isGroup: ch.isGroup }),
            phone: realPhone,
            name: this.store.contacts[canonId]?.name && !isPureDigits(this.store.contacts[canonId].name)
              ? this.store.contacts[canonId].name
              : bestName
          };
        }
      }

      // Apply Messages
      for (const m of snapshot.messages || []) {
        this.ingestRawMessage(m);
      }

      this.scheduleSaveStore();
      console.log(
        `✅ [WhatsApp] Senkronizasyon tamamlandı: ${Object.keys(this.store.contacts).length} kişi, ${Object.keys(this.store.chats).length} sohbet, ${this.store.messages.length} gerçek mesaj hafızada.`
      );
      this.emit('status', this.getStatus());
    } catch (err) {
      console.error('[SyncAllData] Hata:', err.message);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Fetches message history for a specific chat directly from Chrome's WAWebCollections.Chat
   * (supports both @c.us and @lid and loads earlier messages on demand).
   */
  async fetchChatHistoryFromBrowser(resolvedTarget, limit = 40) {
    if (!this.client || !this.client.pupPage || this.status !== 'connected') return [];
    try {
      const targetCanonId = resolvedTarget.id;
      const targetLid = resolvedTarget.lid || this.pnToLid[targetCanonId] || null;
      const targetRawChatId = this.store.chats[targetCanonId]?.rawChatId || null;
      const targetNameNorm = normalizeTr(resolvedTarget.name);

      const rawMsgs = await this.client.pupPage.evaluate(
        async ({ targetCanonId, targetLid, targetRawChatId, targetNameNorm, maxLimit }) => {
          const Collections = window.require('WAWebCollections');
          let LoadMsgs = null;
          try { LoadMsgs = window.require('WAWebChatLoadMessages'); } catch (e) {}

          const chats = Collections?.Chat?.getModelsArray?.() || [];
          let targetChat = null;

          for (const ch of chats) {
            const cid = ch.id?._serialized;
            const pn = ch.contact?.phoneNumber?._serialized;
            if (
              cid === targetCanonId ||
              cid === targetLid ||
              cid === targetRawChatId ||
              pn === targetCanonId
            ) {
              targetChat = ch;
              break;
            }
          }

          // Fallback: match by chat formattedTitle
          if (!targetChat && targetNameNorm) {
            for (const ch of chats) {
              const title = String(ch.formattedTitle || ch.name || '').toLowerCase().trim();
              if (title && title === targetNameNorm) {
                targetChat = ch;
                break;
              }
            }
          }

          if (!targetChat) return [];

          let msgArray = targetChat.msgs?.getModelsArray?.() || [];
          let attempts = 0;
          while (msgArray.length < maxLimit && attempts < 3 && LoadMsgs?.loadEarlierMsgs) {
            attempts++;
            try {
              const loaded = await Promise.race([
                LoadMsgs.loadEarlierMsgs({ chat: targetChat }),
                new Promise((r) => setTimeout(() => r(null), 1500))
              ]);
              if (!loaded || !loaded.length) break;
              msgArray = targetChat.msgs?.getModelsArray?.() || [];
            } catch (e) {
              break;
            }
          }

          const out = [];
          const chatTitle = targetChat.formattedTitle || targetChat.name || '';
          for (const m of msgArray.slice(-maxLimit * 2)) {
            if (!m || m.isNotification) continue;
            const t = m.type || 'chat';
            if (['e2e_notification', 'notification_template', 'gp2', 'protocol', 'ciphertext', 'revoked', 'call_log'].includes(t)) {
              continue;
            }
            let txt = '';
            if (m.body && typeof m.body === 'string' && t === 'chat') txt = m.body;
            else if (m.caption && typeof m.caption === 'string') txt = m.caption;
            else if (t === 'image') txt = '[Görsel]';
            else if (t === 'video') txt = '[Video]';
            else if (t === 'ptt' || t === 'audio') txt = '[Sesli Mesaj]';
            else if (t === 'document') txt = `[Belge: ${m.filename || 'Dosya'}]`;
            else if (t === 'sticker') txt = '[Çıkartma]';
            else txt = m.body || '';

            if (!txt) continue;

            const ts = (m.t || Math.floor(Date.now() / 1000)) * 1000;
            const fromMe = Boolean(m.id?.fromMe);
            const rawAuthor = m.author?._serialized || m.author || (fromMe ? 'me' : targetCanonId);

            out.push({
              id: m.id?._serialized || `msg_${ts}`,
              chatId: targetCanonId,
              rawChatId: targetChat.id?._serialized,
              chatName: chatTitle,
              fromMe,
              sender: rawAuthor,
              senderName: m.notifyName || m.senderObj?.name || m.senderObj?.pushname || '',
              type: t,
              text: txt,
              timestamp: ts
            });
          }
          return out.slice(-maxLimit);
        },
        {
          targetCanonId,
          targetLid,
          targetRawChatId,
          targetNameNorm,
          maxLimit: Number(limit) || 40
        }
      );

      for (const rm of rawMsgs || []) {
        this.ingestRawMessage(rm);
      }
      if (rawMsgs && rawMsgs.length > 0) {
        this.scheduleSaveStore();
      }
      return rawMsgs;
    } catch (err) {
      console.warn('[fetchChatHistoryFromBrowser] Uyarı:', err.message);
      return [];
    }
  }

  async start() {
    if (this.isStarting) return;
    this.isStarting = true;

    try {
      this.status = 'connecting';
      this.emit('status', this.getStatus());

      const executablePath = findBrowserExecutable();
      console.log(`🌐 Kalıcı tarayıcı motoru başlatılıyor: ${executablePath || 'Varsayılan Chromium'}`);

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'masaustu-kalici-oturum',
          dataPath: AUTH_DIR
        }),
        webVersionCache: {
          type: 'local',
          path: CACHE_DIR
        },
        puppeteer: {
          executablePath,
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu'
          ]
        }
      });

      this.client.on('qr', async (qr) => {
        this.qrRaw = qr;
        this.status = 'qr_ready';
        this.qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
        console.log('\n======================================================');
        console.log('📱 WHATSAPP QR KOD HAZIR! (Bir kez okutmanız yeterli)');
        console.log('🌐 Tarayıcıdan okutun: http://localhost:3000');
        console.log('======================================================\n');
        qrcodeTerminal.generate(qr, { small: true });
        this.emit('qr', { qrRaw: this.qrRaw, qrDataUrl: this.qrDataUrl });
        this.emit('status', this.getStatus());
      });

      const markReadyAndSync = async () => {
        if (this.status === 'connected') return;
        try {
          if (this.client?.pupPage) {
            const { LoadUtils } = require('whatsapp-web.js/src/util/Injected/Utils');
            const hasWweb = await this.client.pupPage.evaluate(() => typeof window.WWebJS !== 'undefined').catch(() => false);
            if (!hasWweb) {
              await this.client.pupPage.evaluate(LoadUtils).catch(() => {});
            }
            const meInfo = await this.client.pupPage.evaluate(() => {
              try {
                const MeUser = window.require('WAWebUserPrefsMeUser');
                const Conn = window.require('WAWebConnModel')?.Conn;
                const wid = MeUser?.getMaybeMePnUser?.() || MeUser?.getMaybeMeLidUser?.();
                return {
                  id: wid?._serialized || '',
                  phone: wid?.user || '',
                  name: Conn?.pushname || 'WhatsApp Kullanıcısı'
                };
              } catch (e) {
                return null;
              }
            }).catch(() => null);
            if (meInfo && meInfo.id) {
              this.user = meInfo;
            }
          }
        } catch (e) {}

        if (!this.user && this.client?.info) {
          const info = this.client.info;
          this.user = {
            id: info?.wid?._serialized || '',
            phone: info?.wid?.user || '',
            name: info?.pushname || 'WhatsApp Kullanıcısı'
          };
        }

        this.status = 'connected';
        this.qrRaw = null;
        this.qrDataUrl = null;
        this.lastError = null;
        console.log(`\n✅ WhatsApp Kalıcı Oturum Aktif: ${this.user?.name || ''} (+${this.user?.phone || ''})\n`);
        this.emit('status', this.getStatus());
        await this.syncAllData();
      };

      this.client.on('authenticated', () => {
        console.log('🔐 WhatsApp kimlik doğrulaması başarılı! Kalıcı oturum kaydedildi.');
        this.status = 'authenticated';
        this.qrRaw = null;
        this.qrDataUrl = null;
        this.emit('status', this.getStatus());
        setTimeout(() => {
          if (this.status !== 'connected') {
            markReadyAndSync();
          }
        }, 3000);
      });

      this.client.on('ready', async () => {
        await markReadyAndSync();
      });

      this.client.on('message_create', async (msg) => {
        try {
          if (!msg || IGNORED_MSG_TYPES.has(msg.type)) return;
          const rawChatId = msg.fromMe ? msg.to : msg.from;
          if (!rawChatId || rawChatId === 'status@broadcast') return;

          // If this is a new @lid we haven't mapped yet, try resolving via pupPage
          if (rawChatId.endsWith('@lid') && !this.lidToPn[rawChatId] && this.client.pupPage) {
            try {
              const resolvedPn = await this.client.pupPage.evaluate((lid) => {
                const c = window.require('WAWebCollections')?.Contact?.get?.(lid);
                return c?.phoneNumber?._serialized || null;
              }, rawChatId);
              if (resolvedPn) {
                this.lidToPn[rawChatId] = resolvedPn;
                this.pnToLid[resolvedPn] = rawChatId;
              }
            } catch (e) {}
          }

          let text = msg.body || '';
          if (!text && msg.hasMedia) {
            text = `[Medya: ${msg.type || 'Dosya'}]`;
          }
          if (!text) return;

          const saved = this.ingestRawMessage({
            id: msg.id?._serialized || `msg_${Date.now()}`,
            chatId: rawChatId,
            rawChatId,
            chatName: msg._data?.notifyName || '',
            fromMe: Boolean(msg.fromMe),
            sender: msg.author || (msg.fromMe ? (this.user?.id || 'me') : rawChatId),
            senderName: msg._data?.notifyName || '',
            type: msg.type || 'chat',
            text,
            timestamp: msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now()
          });

          if (saved) {
            this.scheduleSaveStore();
            this.emit('message', saved);
          }
        } catch (e) {}
      });

      this.client.on('disconnected', async (reason) => {
        console.warn(`⚠️ WhatsApp bağlantısı kesildi (${reason}). Oturum silinmeden yeniden bağlanılıyor...`);
        this.lastError = `Bağlantı kesildi: ${reason}`;
        this.status = 'connecting';
        this.emit('status', this.getStatus());
        try {
          await this.client.destroy();
        } catch (e) {}
        this.isStarting = false;
        setTimeout(() => this.start(), 4000);
      });

      await this.client.initialize();
    } catch (err) {
      this.lastError = err.message;
      console.error('[WhatsAppManager] Başlatma hatası:', err.message);
      this.status = 'disconnected';
      this.emit('status', this.getStatus());
      this.isStarting = false;
      setTimeout(() => this.start(), 5000);
    }
  }

  async logoutAndReset() {
    try {
      if (this.client) {
        await this.client.logout().catch(() => {});
        await this.client.destroy().catch(() => {});
        this.client = null;
      }
    } catch (e) {}
    try {
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }
    } catch (e) {}
    this.status = 'disconnected';
    this.user = null;
    this.qrRaw = null;
    this.qrDataUrl = null;
    this.isStarting = false;
    this.emit('status', this.getStatus());
    this.start();
    return this.getStatus();
  }

  getStatus() {
    return {
      status: this.status,
      connected: this.status === 'connected',
      persistentSession: true,
      user: this.user,
      qrAvailable: Boolean(this.qrDataUrl),
      qrDataUrl: this.qrDataUrl,
      qrRaw: this.qrRaw,
      lastError: this.lastError,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      stats: {
        totalChats: Object.keys(this.store.chats).length,
        totalContacts: Object.keys(this.store.contacts).length,
        cachedMessages: this.store.messages.length
      }
    };
  }

  /**
   * Send message by phone number ("05551234567"), JID, OR Contact Name ("Ahmet Yılmaz", "Ayşe Demir")
   */
  async sendMessage(toOrName, text, options = {}) {
    if (this.status !== 'connected' || !this.client) {
      throw new Error('WhatsApp henüz bağlı değil. Lütfen http://localhost:3000 adresinden QR kodu okutun.');
    }
    if (!text || !String(text).trim()) {
      throw new Error('Gönderilecek mesaj metni (text) boş olamaz.');
    }

    const resolved = this.resolveRecipient(toOrName);
    const sendOpts = {};
    if (options.replyToMessageId) {
      sendOpts.quotedMessageId = options.replyToMessageId;
    }

    const sentMsg = await this.client.sendMessage(resolved.id, String(text), sendOpts);

    const saved = this.ingestRawMessage({
      id: sentMsg?.id?._serialized || `sent_${Date.now()}`,
      chatId: resolved.id,
      rawChatId: resolved.id,
      chatName: resolved.name,
      fromMe: true,
      sender: this.user?.id || 'me',
      senderName: this.user?.name || 'Ben',
      type: 'chat',
      text: String(text),
      timestamp: Date.now()
    });
    this.scheduleSaveStore();
    if (saved) this.emit('message', saved);

    return {
      success: true,
      to: resolved.id,
      recipientName: resolved.name,
      recipientPhone: resolved.phone,
      messageId: sentMsg?.id?._serialized || saved?.id,
      text: String(text),
      timestamp: new Date().toISOString()
    };
  }

  async getChats(limit = 50, search = '') {
    if (this.status === 'connected' && Object.keys(this.store.chats).length < 5) {
      await this.syncAllData();
    }

    const q = normalizeTr(search);
    let list = Object.values(this.store.chats).map((ch) => {
      const canonId = this.canonicalJid(ch.id);
      const realPhone = canonId.endsWith('@c.us')
        ? jidToPhone(canonId)
        : canonId.endsWith('@g.us')
          ? 'Grup'
          : jidToPhone(canonId);
      return {
        ...ch,
        id: canonId,
        name: this.getContactDisplayName(canonId, ch.name || realPhone),
        phone: realPhone
      };
    });

    if (q) {
      list = list.filter(
        (c) =>
          normalizeTr(c.name).includes(q) ||
          normalizeTr(c.phone).includes(q) ||
          normalizeTr(c.lastMessage).includes(q)
      );
    }

    list.sort((a, b) => {
      const aHasMsg = a.lastMessage ? 1 : 0;
      const bHasMsg = b.lastMessage ? 1 : 0;
      if (aHasMsg !== bHasMsg) return bHasMsg - aHasMsg;
      return (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0);
    });
    return list.slice(0, Number(limit) || 50);
  }

  /**
   * Fetch messages for a specific person/group (by name or phone) or across all chats.
   * When connected, also fetches live message history directly from Chrome's WAWebCollections.Chat!
   */
  async getMessages({ chatId, limit = 50, onlyIncoming = false } = {}) {
    const maxLimit = Number(limit) || 50;
    let targetJid = null;
    let targetInfo = null;

    if (chatId && String(chatId).trim()) {
      targetInfo = this.resolveRecipient(chatId);
      targetJid = targetInfo.id;

      // Live fetch from WhatsApp Web browser page so older message history is always accessible!
      if (this.status === 'connected') {
        await this.fetchChatHistoryFromBrowser(targetInfo, maxLimit);
      }
    } else if (this.status === 'connected' && this.store.messages.length < 15) {
      await this.syncAllData();
    }

    let msgs = [...this.store.messages];

    if (targetJid) {
      const targetPhone = jidToPhone(targetJid);
      const targetLid = targetInfo?.lid || this.pnToLid[targetJid];
      msgs = msgs.filter(
        (m) =>
          this.canonicalJid(m.chatId) === targetJid ||
          (targetLid && m.chatId === targetLid) ||
          (targetPhone && targetPhone !== 'Grup' && jidToPhone(m.chatId) === targetPhone)
      );
    }

    if (onlyIncoming) {
      msgs = msgs.filter((m) => !m.fromMe);
    }

    // Enrich with latest contact names & real phone numbers
    const seen = new Set();
    msgs = msgs
      .map((m) => {
        const canonChat = this.canonicalJid(m.chatId);
        const canonSender = this.canonicalJid(m.sender || m.chatId);
        const realPhone = canonChat.endsWith('@c.us') ? jidToPhone(canonChat) : jidToPhone(canonChat);
        return {
          ...m,
          chatId: canonChat,
          chatName: this.getContactDisplayName(canonChat, m.chatName || realPhone),
          senderName: m.fromMe
            ? (this.user?.name || 'Ben')
            : this.getContactDisplayName(canonSender, m.senderName || realPhone),
          senderPhone: m.fromMe ? (this.user?.phone || '') : (canonSender.endsWith('@c.us') ? jidToPhone(canonSender) : realPhone)
        };
      })
      .filter((m) => {
        const k = `${m.chatId}_${m.timestamp}_${m.text}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

    msgs.sort((a, b) => a.timestamp - b.timestamp);
    return msgs.slice(-maxLimit);
  }

  searchMessages(query, limit = 30) {
    const q = normalizeTr(query);
    if (!q) return [];
    const matches = this.store.messages
      .map((m) => {
        const canonChat = this.canonicalJid(m.chatId);
        const canonSender = this.canonicalJid(m.sender || m.chatId);
        return {
          ...m,
          chatId: canonChat,
          chatName: this.getContactDisplayName(canonChat, m.chatName || jidToPhone(canonChat)),
          senderName: m.fromMe
            ? 'Ben'
            : this.getContactDisplayName(canonSender, m.senderName || jidToPhone(canonChat))
        };
      })
      .filter(
        (m) =>
          normalizeTr(m.text).includes(q) ||
          normalizeTr(m.chatName).includes(q) ||
          normalizeTr(m.senderName).includes(q) ||
          normalizeTr(m.chatId).includes(q)
      );

    matches.sort((a, b) => b.timestamp - a.timestamp);
    return matches.slice(0, Number(limit) || 30);
  }

  getContacts(search = '', limit = 100) {
    const q = normalizeTr(search);
    let list = Object.values(this.store.contacts)
      .filter((c) => {
        if (!c.id || c.id === 'status@broadcast' || c.id === '0@c.us') return false;
        if (c.id.endsWith('@lid') && isPureDigits(c.name)) return false;
        return true;
      })
      .map((c) => {
        const canonId = this.canonicalJid(c.id);
        const realPhone = canonId.endsWith('@c.us')
          ? jidToPhone(canonId)
          : canonId.endsWith('@g.us')
            ? 'Grup'
            : (c.phone || jidToPhone(canonId));
        return {
          id: canonId,
          phone: realPhone,
          name: c.name || c.pushname || realPhone,
          pushname: c.pushname || null,
          isGroup: canonId.endsWith('@g.us') || Boolean(c.isGroup)
        };
      });

    if (q) {
      list = list.filter(
        (c) =>
          normalizeTr(c.name).includes(q) ||
          normalizeTr(c.pushname).includes(q) ||
          normalizeTr(c.phone).includes(q)
      );
    }

    // Sort contacts alphabetically with named personal contacts first
    list.sort((a, b) => {
      const aNamed = !isPureDigits(a.name) ? 0 : 1;
      const bNamed = !isPureDigits(b.name) ? 0 : 1;
      if (aNamed !== bNamed) return aNamed - bNamed;
      if (a.isGroup !== b.isGroup) return a.isGroup ? 1 : -1;
      return String(a.name).localeCompare(String(b.name), 'tr');
    });

    return list.slice(0, Number(limit) || 100);
  }
}

module.exports = new WhatsAppManager();
