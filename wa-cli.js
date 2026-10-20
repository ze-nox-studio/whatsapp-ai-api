#!/usr/bin/env node
/**
 * WhatsApp AI CLI Aracı (Gemini, OpenCode, Claude Code terminal komutları için)
 * Hem DÜZ METİN (Plain Text) hem de JSON modunu destekler.
 *
 * Düz Metin (Plain Text) Kullanımı:
 *   node wa-cli.js text "DURUM"
 *   node wa-cli.js text "SOHBETLER 15"
 *   node wa-cli.js text "MESAJLAR Ahmet Yılmaz"
 *   node wa-cli.js text "GONDER Ahmet Yılmaz | Merhaba!"
 *   node wa-cli.js text "KISILER Ayşe"
 *   node wa-cli.js text "ARA toplantı"
 *   node wa-cli.js kilavuz
 *
 * Klasik Komut Kullanımı:
 *   node wa-cli.js status
 *   node wa-cli.js send <isim_veya_numara> <mesaj>
 *   node wa-cli.js chats [limit]
 *   node wa-cli.js messages [isim_veya_numara] [limit]
 *   node wa-cli.js search <kelime>
 *   node wa-cli.js contacts [arama]
 */

const http = require('http');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.WA_API_HOST || '127.0.0.1';
const API_KEY = process.env.WA_API_KEY || '';

function request(method, urlPath, body = null, isPlainText = false) {
  return new Promise((resolve, reject) => {
    const payload = body
      ? isPlainText
        ? String(body)
        : JSON.stringify(body)
      : null;

    const headers = {};
    if (API_KEY) {
      headers['X-API-Key'] = API_KEY;
    }
    if (payload) {
      headers['Content-Type'] = isPlainText ? 'text/plain; charset=utf-8' : 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path: urlPath,
        method,
        headers
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (isPlainText) return resolve(data);
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const [, , cmd, arg1, ...rest] = process.argv;
  const upper = (cmd || 'text').toUpperCase();

  // Direct plain-text command support
  if (
    upper === 'TEXT' ||
    upper === 'PLAIN' ||
    upper === 'KOMUT'
  ) {
    const fullCmd = [arg1, ...rest].filter(Boolean).join(' ') || 'YARDIM';
    const out = await request('POST', '/text', fullCmd, true);
    console.log(out);
    return;
  }

  if (
    [
      'DURUM',
      'OKUNMAMIS',
      'OKUNMAMIŞ',
      'OKUNMAMISLAR',
      'UNREAD',
      'SOHBETLER',
      'MESAJLAR',
      'OKU',
      'SON_MESAJLAR',
      'GELENLER',
      'GONDER',
      'GÖNDER',
      'SOR',
      'ASK',
      'GONDER_BEKLE',
      'BEKLE',
      'YANIT_BEKLE',
      'YAZIYOR',
      'TYPING',
      'OKUNDU',
      'SEEN',
      'DOSYA',
      'DOSYA_GONDER',
      'MEDYA',
      'FILE',
      'SEND_FILE',
      'KISILER',
      'KİŞİLER',
      'REHBER',
      'ARA',
      'YARDIM',
      'KILAVUZ',
      'SENKRONIZE'
    ].includes(upper)
  ) {
    const fullCmd = [cmd, arg1, ...rest].filter(Boolean).join(' ');
    const out = await request('POST', '/text', fullCmd, true);
    console.log(out);
    return;
  }

  switch ((cmd || 'status').toLowerCase()) {
    case 'help':
    case 'guide': {
      const out = await request('GET', '/ai.txt', null, true);
      console.log(out);
      break;
    }
    case 'status': {
      const res = await request('GET', '/api/status');
      delete res.qrDataUrl;
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'unread': {
      const res = await request('GET', '/api/unread');
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'wait': {
      const chatId = arg1 || '*';
      const timeoutSeconds = Number(rest[0]) || 120;
      const res = await request('POST', '/api/wait', { chatId, timeoutSeconds });
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'ask': {
      const to = arg1;
      const lastArg = rest[rest.length - 1];
      const hasTimeout = rest.length > 1 && /^\d+$/.test(lastArg);
      const timeoutSeconds = hasTimeout ? Number(lastArg) : 120;
      const text = (hasTimeout ? rest.slice(0, -1) : rest).join(' ');
      if (!to || !text) {
        console.error('Kullanım: node wa-cli.js ask <isim_veya_numara> <mesaj> [saniye]');
        process.exit(1);
      }
      const res = await request('POST', '/api/ask', { to, text, timeoutSeconds });
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'send': {
      const to = arg1;
      const text = rest.join(' ');
      if (!to || !text) {
        console.error('Kullanım: node wa-cli.js send <isim_veya_numara> <mesaj>');
        process.exit(1);
      }
      const res = await request('POST', '/api/send', { to, text });
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'send-file':
    case 'file': {
      const to = arg1;
      const filePath = rest[0];
      const caption = rest.slice(1).join(' ');
      if (!to || !filePath) {
        console.error('Kullanım: node wa-cli.js send-file <isim_veya_numara> <dosya_yolu_veya_url> [aciklama]');
        process.exit(1);
      }
      const res = await request('POST', '/api/send-file', { to, filePath, caption });
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'chats': {
      const limit = arg1 || 20;
      const res = await request('GET', `/api/chats?limit=${encodeURIComponent(limit)}`);
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'messages': {
      const chatId = arg1 || '';
      const limit = rest[0] || 20;
      const res = await request(
        'GET',
        `/api/messages?chatId=${encodeURIComponent(chatId)}&limit=${encodeURIComponent(limit)}`
      );
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'search': {
      const q = [arg1, ...rest].filter(Boolean).join(' ');
      const res = await request('GET', `/api/search?query=${encodeURIComponent(q)}`);
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'contacts': {
      const q = [arg1, ...rest].filter(Boolean).join(' ');
      const res = await request('GET', `/api/contacts?search=${encodeURIComponent(q)}`);
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    default: {
      const fullCmd = [cmd, arg1, ...rest].filter(Boolean).join(' ');
      const out = await request('POST', '/text', fullCmd, true);
      console.log(out);
    }
  }
}

main().catch((err) => {
  console.error('Hata:', err.message);
  process.exit(1);
});
