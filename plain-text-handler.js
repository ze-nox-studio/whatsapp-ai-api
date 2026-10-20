/**
 * Plain-Text AI Backend Handler
 * Yapay zeka ajanlarının (Gemini, OpenCode, Claude, cURL, Python, Web Fetch vb.)
 * JSON karmaşası olmadan doğrudan düz metin (text/plain) ile WhatsApp'ı
 * yönetmesini sağlayan arka uç motoru.
 */

function formatDateTr(ts) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return new Date(ts).toISOString();
  }
}

function getAiGuideText(port = 3000) {
  return `================================================================================
🤖 WHATSAPP AI API - YAPAY ZEKA DÜZ METİN (PLAIN TEXT) KULLANIM KILAVUZU
================================================================================
Bu sunucu yapay zeka ajanlarının (Gemini, OpenCode, Claude, Cursor, GPT vb.)
hiçbir JSON ayrıştırma (parsing) işlemine gerek duymadan doğrudan DÜZ METİN
(text/plain) okuyup yazarak WhatsApp'ı kullanması için tasarlanmıştır.

SUNUCU ADRESİ : http://localhost:${port}
KILAVUZ URL   : http://localhost:${port}/ai.txt  (veya /text/help)

--------------------------------------------------------------------------------
1. TEK NOKTADAN DÜZ METİN KOMUT GÖNDERME (POST /text veya GET /text?cmd=...)
--------------------------------------------------------------------------------
HTTP POST (Content-Type: text/plain) ile http://localhost:${port}/text adresine
veya GET http://localhost:${port}/text?cmd=<KOMUT> adresine şu düz metin
komutları gönderebilirsiniz:

• DURUM
  (veya STATUS)
  -> WhatsApp bağlantı durumunu, bağlı hesabı ve istatistikleri döndürür.

• SOHBETLER [limit] [arama_kelimesi]
  (veya CHATS [limit] [arama])
  Örnek: SOHBETLER 20
  Örnek: SOHBETLER 10 Proje
  -> Son konuşulan kişileri, grupları ve son mesajları düz metin listeler.

• MESAJLAR <kişi_adı_veya_numara> | [limit]
  (veya OKU <kişi_adı_veya_numara> veya MESSAGES <kişi_adı_veya_numara>)
  Örnek: MESAJLAR Ahmet Yılmaz
  Örnek: MESAJLAR Ayşe Demir | 40
  Örnek: MESAJLAR 05551234567
  -> Belirtilen kişi veya grupla olan geçmiş ve yeni tüm mesajları getirir.

• SON_MESAJLAR [limit]
  (veya GELENLER [limit])
  Örnek: SON_MESAJLAR 25
  -> Tüm sohbetlerdeki en son gelen/giden mesajları listeler.

• GONDER <kişi_adı_veya_numara> | <mesaj_metni>
  (veya SEND <kişi_adı_veya_numara> | <mesaj_metni>)
  Örnek: GONDER Ahmet Yılmaz | Merhaba, nasılsın?
  Örnek: GONDER Ayşe Demir | Yarın toplantı için uygun musun?
  Örnek: GONDER 05551234567 | Selamlar
  -> Rehberdeki kişi ismini (veya numarayı) otomatik bulup mesajı gönderir.

• SOR <kişi_adı_veya_numara> | <mesaj_metni> | [bekleme_saniyesi]
  (veya ASK <kişi_adı_veya_numara> | <mesaj_metni> | [bekleme_saniyesi])
  Örnek: SOR Ahmet Yılmaz | Merhaba, yarın saat kaçta müsait olursun? | 180
  -> Mesajı gönderir ve karşı taraf yanıt yazana kadar bekler; yanıt geldiği anda AI'ı uyandırıp cevabı döndürür!

• BEKLE [kişi_adı_veya_numara_veya_*] | [bekleme_saniyesi]
  (veya WAIT [kişi_adı_veya_numara_veya_*] | [bekleme_saniyesi])
  Örnek: BEKLE Ahmet Yılmaz | 120
  Örnek: BEKLE * | 300
  -> Belirtilen kişiden (veya * ile herhangi birinden) yeni mesaj gelene kadar bekler, mesaj geldiği anda AI'ı uyandırır!

• OKUNMAMIS
  (veya UNREAD)
  -> Okunmamış mesajı olan tüm sohbetleri ve bekleyen mesajları özetler.

• YAZIYOR <kişi_adı_veya_numara>
  (veya TYPING <kişi_adı_veya_numara>)
  -> Karşı tarafa WhatsApp'ta "yazıyor..." (typing...) durumunu gösterir.

• OKUNDU <kişi_adı_veya_numara>
  (veya SEEN <kişi_adı_veya_numara>)
  -> Sohbetteki mesajları okundu (mavi tik) olarak işaretler.

• DOSYA <kişi_adı_veya_numara> | <dosya_yolu_veya_url> | [açıklama_metni]
  (veya FILE <kişi_adı_veya_numara> | <dosya_yolu_veya_url> | [açıklama_metni])
  Örnek: DOSYA Ahmet Yılmaz | C:\\Belgeler\\rapor.pdf | Güncel rapor ektedir
  Örnek: FILE Ayşe Demir | https://ornek.com/gorsel.png | Tasarım görseli
  -> Belirtilen kişiye veya numaraya bilgisayardaki dosyayı (PDF, görsel, belge, ses, video) veya URL'yi gönderir.

• KISILER [arama_kelimesi]
  (veya REHBER [arama_kelimesi] veya CONTACTS [arama_kelimesi])
  Örnek: KISILER Ahmet
  Örnek: KISILER Mehmet
  -> Rehberdeki kişileri gerçek telefon numaralarıyla (+905...) listeler.

• ARA <aranacak_kelime>
  (veya SEARCH <aranacak_kelime>)
  Örnek: ARA toplantı
  -> Tüm mesaj geçmişinde kelime araması yapar ve eşleşen mesajları döndürür.

• SENKRONIZE
  (veya SYNC)
  -> WhatsApp Web üzerinden tüm kişileri, sohbetleri ve geçmişi günceller.

--------------------------------------------------------------------------------
2. DOĞRUDAN DÜZ METİN (PLAIN TEXT) URL ENDPOINT'LERİ (GET & POST)
--------------------------------------------------------------------------------
Tarayıcı, cURL, fetch veya herhangi bir araçla doğrudan çağrılabilir:

1) Bağlantı Durumu:
   GET http://localhost:${port}/text/status

2) Son Sohbetler Listesi:
   GET http://localhost:${port}/text/chats?limit=25&search=

3) Kişiyle Olan Mesaj Geçmişi (İsimle veya Numarayla):
   GET http://localhost:${port}/text/messages/Ahmet?limit=40
   GET http://localhost:${port}/text/messages?chat=Ayse%20Demir&limit=40

4) Tüm Sohbetlerdeki Son Mesajlar:
   GET http://localhost:${port}/text/messages?limit=30

5) İsimle veya Numarayla Mesaj Gönderme (POST veya GET):
   POST http://localhost:${port}/text/send
   Body (text/plain): Ahmet Yılmaz | Merhaba bu bir test mesajıdır

   Veya GET ile tek satırda:
   GET http://localhost:${port}/text/send?to=Ahmet&text=Merhaba%20nasilsin

6) İsimle veya Numarayla Dosya / Medya Gönderme (POST veya GET):
   POST http://localhost:${port}/text/send-file
   Body (text/plain): Ahmet Yılmaz | C:\\Belgeler\\rapor.pdf | Rapor ektedir

   Veya GET ile tek satırda:
   GET http://localhost:${port}/text/send-file?to=Ahmet&filePath=C:\\Belgeler\\rapor.pdf&caption=Rapor

7) Rehberde Kişi Arama / Listeleme:
   GET http://localhost:${port}/text/contacts?search=Ahmet&limit=50
   GET http://localhost:${port}/text/contacts/Ahmet

8) Mesaj İçeriği Arama:
   GET http://localhost:${port}/text/search?q=toplanti&limit=20

9) Yanıt Bekleme & AI Uyandırma (Blocking Wait / Ask / Stream):
   GET  http://localhost:${port}/text/wait?chat=Ahmet%20Yilmaz&timeout=120
   POST http://localhost:${port}/text/ask  (Body: Ahmet Yılmaz | Merhaba, uygun musun? | 120)
   GET  http://localhost:${port}/text/unread
   GET  http://localhost:${port}/text/stream  (Gerçek zamanlı SSE mesaj akışı)

--------------------------------------------------------------------------------
3. TERMINAL / KOMUT SATIRI (CLI) KULLANIMI (OpenCode, Claude Code, Gemini)
--------------------------------------------------------------------------------
Terminal erişimi olan yapay zekalar doğrudan şu komutları çalıştırabilir:

  node wa-cli.js text "DURUM"
  node wa-cli.js text "OKUNMAMIS"
  node wa-cli.js text "SOHBETLER 15"
  node wa-cli.js text "MESAJLAR Ahmet Yılmaz"
  node wa-cli.js text "GONDER Ahmet Yılmaz | Merhaba!"
  node wa-cli.js text "SOR Ahmet Yılmaz | Yarın uygun musun? | 180"
  node wa-cli.js text "BEKLE Ahmet Yılmaz | 120"
  node wa-cli.js text "DOSYA Ahmet Yılmaz | C:\\Belgeler\\rapor.pdf | Rapor ektedir"
================================================================================
`;
}

function formatStatusText(st) {
  const lines = [
    '=== WHATSAPP BAĞLANTI DURUMU ===',
    `Durum          : ${st.connected ? '✅ BAĞLI (Kalıcı Oturum Aktif)' : `⚠️ ${st.status.toUpperCase()}`}`,
    `Hesap Adı      : ${st.user?.name || '-'}`,
    `Telefon        : ${st.user?.phone ? '+' + st.user.phone : '-'}`,
    `Kayıtlı Kişi   : ${st.stats?.totalContacts || 0}`,
    `Toplam Sohbet  : ${st.stats?.totalChats || 0}`,
    `Hafızadaki Msj : ${st.stats?.cachedMessages || 0}`,
    `Çalışma Süresi : ${st.uptimeSeconds || 0} saniye`
  ];
  if (!st.connected && st.qrAvailable) {
    lines.push('QR Kod Durumu  : Hazır! http://localhost:3000 adresinden okutabilirsiniz.');
  }
  return lines.join('\n');
}

function formatChatsText(chats) {
  if (!chats || chats.length === 0) {
    return 'Hiç sohbet bulunamadı.';
  }
  const lines = [`=== SON SOHBETLER (${chats.length} adet) ===`];
  chats.forEach((c, idx) => {
    const typeLabel = c.isGroup || c.phone === 'Grup' ? '[GRUP]' : `[+${c.phone}]`;
    const unread = c.unreadCount ? ` (${c.unreadCount} okunmamış)` : '';
    const timeStr = c.conversationTimestamp ? formatDateTr(c.conversationTimestamp) : '-';
    const lastMsg = (c.lastMessage || '').replace(/\r?\n/g, ' ').slice(0, 90);
    lines.push(`${idx + 1}. ${c.name} ${typeLabel}${unread} | Son: ${timeStr} -> ${lastMsg || '(Mesaj yok)'}`);
  });
  return lines.join('\n');
}

function formatMessagesText(messages, headerTitle = 'MESAJ GEÇMİŞİ') {
  if (!messages || messages.length === 0) {
    return `=== ${headerTitle} ===\nMesaj bulunamadı.`;
  }
  const lines = [`=== ${headerTitle} (${messages.length} mesaj) ===`];
  for (const m of messages) {
    const timeStr = formatDateTr(m.timestamp);
    const chatLabel = m.chatName || m.chatId;
    const senderLabel = m.fromMe ? `BEN -> ${chatLabel}` : `${m.senderName || chatLabel} (${ m.senderPhone ? '+' + m.senderPhone : chatLabel })`;
    lines.push(`[${timeStr}] ${senderLabel}: ${m.text}`);
  }
  return lines.join('\n');
}

function formatContactsText(contacts) {
  if (!contacts || contacts.length === 0) {
    return 'Eşleşen kişi bulunamadı.';
  }
  const lines = [`=== REHBERDEKİ KİŞİLER (${contacts.length} adet) ===`];
  contacts.forEach((c, idx) => {
    const phoneStr = c.isGroup || c.phone === 'Grup' ? 'Grup Sohbeti' : `+${c.phone}`;
    lines.push(`${idx + 1}. ${c.name} | Tel: ${phoneStr} | ID: ${c.id}`);
  });
  return lines.join('\n');
}

/**
 * Executes a plain-text command and returns a plain-text response string.
 */
async function executePlainTextCommand(waManager, rawInput, port = 3000) {
  const input = String(rawInput || '').trim();
  if (!input) {
    return getAiGuideText(port);
  }

  const firstSpaceIdx = input.search(/\s/);
  const cmd = (firstSpaceIdx === -1 ? input : input.slice(0, firstSpaceIdx)).toUpperCase().trim();
  const rest = firstSpaceIdx === -1 ? '' : input.slice(firstSpaceIdx + 1).trim();

  switch (cmd) {
    case 'YARDIM':
    case 'HELP':
    case 'KILAVUZ':
    case 'GUIDE':
      return getAiGuideText(port);

    case 'DURUM':
    case 'STATUS':
      return formatStatusText(waManager.getStatus());

    case 'SENKRONIZE':
    case 'SYNC': {
      await waManager.syncAllData();
      return '✅ Senkronizasyon tamamlandı.\n\n' + formatStatusText(waManager.getStatus());
    }

    case 'SOHBETLER':
    case 'CHATS': {
      let limit = 25;
      let search = '';
      if (rest) {
        const parts = rest.split(/\s+/);
        if (/^\d+$/.test(parts[0])) {
          limit = Number(parts[0]);
          search = parts.slice(1).join(' ');
        } else {
          search = rest;
        }
      }
      const chats = await waManager.getChats(limit, search);
      return formatChatsText(chats);
    }

    case 'SON_MESAJLAR':
    case 'GELENLER':
    case 'RECENT': {
      const limit = /^\d+$/.test(rest) ? Number(rest) : 30;
      const onlyIncoming = cmd === 'GELENLER';
      const msgs = await waManager.getMessages({ limit, onlyIncoming });
      return formatMessagesText(msgs, onlyIncoming ? 'SON GELEN MESAJLAR' : 'TÜM SOHBETLERDEKİ SON MESAJLAR');
    }

    case 'MESAJLAR':
    case 'OKU':
    case 'MESSAGES':
    case 'HISTORY': {
      if (!rest) {
        const msgs = await waManager.getMessages({ limit: 30 });
        return formatMessagesText(msgs, 'SON MESAJLAR');
      }
      let chatTarget = rest;
      let limit = 40;
      if (rest.includes('|')) {
        const [left, right] = rest.split('|').map((s) => s.trim());
        chatTarget = left;
        if (/^\d+$/.test(right)) limit = Number(right);
      }
      const resolved = waManager.resolveRecipient(chatTarget);
      const msgs = await waManager.getMessages({ chatId: resolved.id, limit });
      return formatMessagesText(msgs, `${resolved.name} (+${resolved.phone}) MESAJ GEÇMİŞİ`);
    }

    case 'GONDER':
    case 'GÖNDER':
    case 'SEND':
    case 'YAZ': {
      let toPart = '';
      let textPart = '';
      if (rest.includes('|')) {
        const idx = rest.indexOf('|');
        toPart = rest.slice(0, idx).trim();
        textPart = rest.slice(idx + 1).trim();
      } else if (rest.includes(':')) {
        const idx = rest.indexOf(':');
        toPart = rest.slice(0, idx).trim();
        textPart = rest.slice(idx + 1).trim();
      } else {
        throw new Error('Kullanım: GONDER <Kişi Adı veya Numara> | <Mesaj Metni>');
      }
      const res = await waManager.sendMessage(toPart, textPart);
      return [
        '✅ MESAJ BAŞARIYLA GÖNDERİLDİ',
        `Alıcı Adı      : ${res.recipientName}`,
        `Alıcı Telefon  : +${res.recipientPhone}`,
        `Gönderilen Msj : ${res.text}`,
        `Tarih / Saat   : ${formatDateTr(Date.now())}`
      ].join('\n');
    }

    case 'DOSYA':
    case 'DOSYA_GONDER':
    case 'DOSYAGÖNDER':
    case 'MEDYA':
    case 'FILE':
    case 'SEND_FILE': {
      const parts = rest.split('|').map((s) => s.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        throw new Error('Kullanım: DOSYA <Kişi Adı veya Numara> | <Dosya Yolu veya URL> | [Açıklama Metni]');
      }
      const toPart = parts[0];
      const filePart = parts[1];
      const captionPart = parts.slice(2).join(' | ');
      const res = await waManager.sendMedia(toPart, filePart, captionPart);
      return [
        '✅ DOSYA BAŞARIYLA GÖNDERİLDİ',
        `Alıcı Adı      : ${res.recipientName}`,
        `Alıcı Telefon  : +${res.recipientPhone}`,
        `Dosya Adı      : ${res.filename}`,
        `Dosya Türü     : ${res.mimetype}`,
        `Açıklama       : ${res.caption || '-'}`,
        `Tarih / Saat   : ${formatDateTr(Date.now())}`
      ].join('\n');
    }

    case 'KISILER':
    case 'KİŞİLER':
    case 'REHBER':
    case 'CONTACTS': {
      const contacts = waManager.getContacts(rest, 60);
      return formatContactsText(contacts);
    }

    case 'ARA':
    case 'SEARCH': {
      if (!rest) throw new Error('Kullanım: ARA <aranacak kelime>');
      const results = waManager.searchMessages(rest, 30);
      return formatMessagesText(results, `"${rest}" ARAMA SONUÇLARI`);
    }

    case 'OKUNMAMIS':
    case 'OKUNMAMIŞ':
    case 'OKUNMAMISLAR':
    case 'UNREAD': {
      const limit = /^\d+$/.test(rest) ? Number(rest) : 30;
      const summary = await waManager.getUnreadSummary(limit);
      if (!summary.totalUnreadChats) {
        return '=== OKUNMAMIŞ MESAJLAR ===\n✅ Şu anda okunmamış mesaj bulunmuyor.';
      }
      const lines = [
        `=== OKUNMAMIŞ MESAJLAR (${summary.totalUnreadChats} sohbet, toplam ${summary.totalUnreadMessages} yeni mesaj) ===`
      ];
      summary.chats.forEach((c, idx) => {
        lines.push(`\n${idx + 1}. ${c.name} (+${c.phone}) — ${c.unreadCount} okunmamış mesaj:`);
        for (const m of c.messages) {
          lines.push(`   [${formatDateTr(m.timestamp)}] ${m.senderName}: ${m.text}`);
        }
      });
      return lines.join('\n');
    }

    case 'BEKLE':
    case 'YANIT_BEKLE':
    case 'WAIT':
    case 'WAIT_REPLY': {
      let chatTarget = '*';
      let timeoutSeconds = 120;
      if (rest) {
        if (rest.includes('|')) {
          const [left, right] = rest.split('|').map((s) => s.trim());
          if (left) chatTarget = left;
          if (/^\d+$/.test(right)) timeoutSeconds = Number(right);
        } else if (/^\d+$/.test(rest)) {
          timeoutSeconds = Number(rest);
        } else {
          chatTarget = rest;
        }
      }
      const res = await waManager.waitForReply({ chatId: chatTarget, timeoutSeconds });
      if (!res.received) {
        return [
          '⏱️ YANIT BEKLEME SÜRESİ DOLDU (Zaman Aşımı)',
          `Beklenen Kişi  : ${res.target.name} (+${res.target.phone})`,
          `Beklenen Süre  : ${res.waitedSeconds} saniye`,
          'Durum          : Bu süre içinde yeni bir mesaj gelmedi.'
        ].join('\n');
      }
      const lines = [
        '🔔 YENİ YANIT GELDİ! (AI Uyandırıldı)',
        `Gönderen Sohbet: ${res.target.name} (+${res.target.phone})`,
        `Bekleme Süresi : ${res.waitedSeconds} saniye`,
        `Mesaj Sayısı   : ${res.messages.length}`,
        '--- GELEN MESAJ(LAR) ---'
      ];
      for (const m of res.messages) {
        lines.push(`[${formatDateTr(m.timestamp)}] ${m.senderName} (+${m.senderPhone}): ${m.text}`);
      }
      return lines.join('\n');
    }

    case 'SOR':
    case 'GONDER_BEKLE':
    case 'GÖNDER_BEKLE':
    case 'ASK':
    case 'SEND_WAIT': {
      const parts = rest.split('|').map((s) => s.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        throw new Error('Kullanım: SOR <Kişi Adı veya Numara> | <Mesaj Metni> | [Bekleme Saniyesi]');
      }
      const toPart = parts[0];
      const textPart = parts[1];
      const timeoutSeconds = parts[2] && /^\d+$/.test(parts[2]) ? Number(parts[2]) : 120;

      const res = await waManager.sendAndWaitForReply(toPart, textPart, { timeoutSeconds });
      if (!res.replyReceived) {
        return [
          '✅ MESAJ GÖNDERİLDİ ANCAK SÜRE İÇİNDE YANIT GELMEDİ',
          `Alıcı          : ${res.sent.recipientName} (+${res.sent.recipientPhone})`,
          `Gönderilen Msj : ${res.sent.text}`,
          `Beklenen Süre  : ${res.waitedSeconds} saniye`
        ].join('\n');
      }
      const lines = [
        '🔔 MESAJ GÖNDERİLDİ VE KARŞI TARAFTAN YANIT GELDİ!',
        `Kişi           : ${res.sent.recipientName} (+${res.sent.recipientPhone})`,
        `Gönderilen Msj : ${res.sent.text}`,
        `Yanıt Süresi   : ${res.waitedSeconds} saniye`,
        '--- KARŞI TARAFIN YANITI ---'
      ];
      for (const m of res.replies) {
        lines.push(`[${formatDateTr(m.timestamp)}] ${m.senderName}: ${m.text}`);
      }
      return lines.join('\n');
    }

    case 'YAZIYOR':
    case 'TYPING': {
      if (!rest) throw new Error('Kullanım: YAZIYOR <Kişi Adı veya Numara>');
      const [target, dur] = rest.split('|').map((s) => s.trim());
      const res = await waManager.sendPresenceState(target, 'typing', Number(dur) || 5);
      return `✍️ "${res.recipientName}" (+${res.recipientPhone}) sohbetinde "yazıyor..." durumu gösteriliyor.`;
    }

    case 'OKUNDU':
    case 'SEEN':
    case 'READ': {
      if (!rest) throw new Error('Kullanım: OKUNDU <Kişi Adı veya Numara>');
      const res = await waManager.sendPresenceState(rest, 'seen');
      return `✅ "${res.recipientName}" (+${res.recipientPhone}) sohbeti okundu (mavi tik) olarak işaretlendi.`;
    }

    case 'WEBHOOK_EKLE':
    case 'ADD_WEBHOOK': {
      const list = waManager.addWebhook(rest);
      return `✅ Webhook eklendi. Aktif Webhook sayısı: ${list.length}\n${list.join('\n')}`;
    }

    case 'WEBHOOK_SIL':
    case 'REMOVE_WEBHOOK': {
      const list = waManager.removeWebhook(rest);
      return `✅ Webhook silindi. Aktif Webhook sayısı: ${list.length}`;
    }

    case 'WEBHOOKLAR':
    case 'WEBHOOKS': {
      const list = waManager.getWebhooks();
      return list.length ? `=== AKTİF WEBHOOK URL'LERİ ===\n${list.join('\n')}` : 'Kayıtlı webhook bulunmuyor.';
    }

    default: {
      // If the user/AI sent "Kişi Adı | Mesaj" directly without GONDER prefix
      if (input.includes('|')) {
        const idx = input.indexOf('|');
        const toPart = input.slice(0, idx).trim();
        const textPart = input.slice(idx + 1).trim();
        if (toPart && textPart) {
          const res = await waManager.sendMessage(toPart, textPart);
          return `✅ MESAJ GÖNDERİLDİ -> ${res.recipientName} (+${res.recipientPhone}): ${res.text}`;
        }
      }
      return `⚠️ Bilinmeyen komut: "${cmd}".\n\n` + getAiGuideText(port);
    }
  }
}

module.exports = {
  getAiGuideText,
  formatStatusText,
  formatChatsText,
  formatMessagesText,
  formatContactsText,
  executePlainTextCommand
};
