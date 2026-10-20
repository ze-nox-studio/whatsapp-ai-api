/**
 * Shared AI Tools definition for:
 * - MCP (Model Context Protocol - Claude, OpenCode, Gemini / Antigravity, Cursor)
 * - OpenAI / Gemini / Claude Function Calling
 * - OpenAPI 3.1 Specification
 * - Plain Text Command Execution
 */

const { executePlainTextCommand } = require('./plain-text-handler');

const TOOLS = [
  {
    name: 'whatsapp_plain_text',
    description: 'WhatsApp ile doğrudan DÜZ METİN (Plain Text) komutlarıyla iletişim kurar ve düz metin yanıt alır. Komutlar: "DURUM", "OKUNMAMIS", "SOHBETLER 20", "MESAJLAR <Kişi Adı>", "SON_MESAJLAR 25", "GONDER <Kişi Adı veya Numara> | <Mesaj>", "SOR <Kişi Adı> | <Mesaj> | [Saniye]" (Mesaj gönderip yanıt gelene kadar bekler), "BEKLE [Kişi Adı veya *] | [Saniye]" (Yanıt gelince AI\'ı uyandırır), "DOSYA <Kişi Adı> | <Dosya Yolu veya URL> | [Açıklama]", "YAZIYOR <Kişi Adı>", "OKUNDU <Kişi Adı>", "KISILER <Arama>", "ARA <Kelime>", "YARDIM".',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Düz metin komutu (Örn: "SOR Ahmet Yılmaz | Merhaba müsait misin? | 120", "BEKLE Ahmet Yılmaz | 120", "OKUNMAMIS", "MESAJLAR Ahmet Yılmaz", "GONDER Ayşe Demir | Merhaba")'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'whatsapp_get_status',
    description: 'WhatsApp kalıcı bağlantı durumunu, bağlı telefon numarasını, kişi/sohbet/mesaj istatistiklerini ve QR kod durumunu kontrol eder.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'whatsapp_send_message',
    description: 'Belirtilen KİŞİ İSMİNE (örn: "Ahmet Yılmaz", "Ayşe Demir"), telefon numarasına (örn: "05551234567") veya grup adına WhatsApp mesajı gönderir. Rehberdeki isimle doğrudan mesaj atabilir.',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Alıcı KİŞİ İSMİ (örn: "Ahmet Yılmaz", "Ayşe Demir"), telefon numarası (örn: "05551234567", "905551234567") veya WhatsApp JID'
        },
        text: {
          type: 'string',
          description: 'Gönderilecek mesaj metni'
        },
        replyToMessageId: {
          type: 'string',
          description: 'Opsiyonel: Yanıtlanacak (alıntılanacak) mesajın ID değeri'
        }
      },
      required: ['to', 'text']
    }
  },
  {
    name: 'whatsapp_send_and_wait_reply',
    description: 'Belirtilen kişiye mesaj gönderir VE karşı taraf yanıt yazana kadar bekler. Yanıt geldiği anda AI ajanını uyandırır ve karşı tarafın cevabını döndürür (Sürekli yoklama/polling yapmaya gerek kalmaz).',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Alıcı KİŞİ İSMİ (örn: "Ahmet Yılmaz", "Ayşe Demir") veya telefon numarası'
        },
        text: {
          type: 'string',
          description: 'Gönderilecek soru veya mesaj metni'
        },
        timeoutSeconds: {
          type: 'number',
          description: 'Yanıt için beklenecek maksimum süre (saniye, varsayılan: 120)'
        }
      },
      required: ['to', 'text']
    }
  },
  {
    name: 'whatsapp_wait_for_reply',
    description: 'Belirtilen kişiden/gruptan (veya chatId boş/"*" bırakılırsa herhangi birinden) yeni bir WhatsApp mesajı gelene kadar bekler. Mesaj geldiği anda AI ajanını uyandırıp mesajı döndürür.',
    inputSchema: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'Opsiyonel: Yanıt beklenecek KİŞİ İSMİ (örn: "Ahmet Yılmaz"), telefon numarası veya tüm sohbetler için "*"'
        },
        timeoutSeconds: {
          type: 'number',
          description: 'Maksimum bekleme süresi (saniye, varsayılan: 120)'
        }
      },
      required: []
    }
  },
  {
    name: 'whatsapp_get_unread',
    description: 'Okunmamış mesajı bulunan tüm sohbetleri ve bekleyen yeni mesajları tek seferde getirir.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maksimum sohbet sayısı (varsayılan: 30)'
        }
      },
      required: []
    }
  },
  {
    name: 'whatsapp_send_presence',
    description: 'Karşı tarafa WhatsApp\'ta "yazıyor..." (typing) durumunu gösterir veya sohbeti "okundu" (seen / mavi tik) olarak işaretler.',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Kişi adı veya telefon numarası'
        },
        state: {
          type: 'string',
          enum: ['typing', 'seen'],
          description: '"typing" (yazıyor...) veya "seen" (okundu / mavi tik)'
        },
        durationSeconds: {
          type: 'number',
          description: 'Yazıyor durumunun süresi (saniye, varsayılan: 5)'
        }
      },
      required: ['to', 'state']
    }
  },
  {
    name: 'whatsapp_send_file',
    description: 'Belirtilen KİŞİ İSMİNE (örn: "Ahmet Yılmaz") veya telefon numarasına bilgisayardaki bir dosyayı (PDF, görsel, belge, ses, video, ZIP vb.) veya URL adresindeki dosyayı gönderir.',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Alıcı KİŞİ İSMİ (örn: "Ahmet Yılmaz", "Ayşe Demir") veya telefon numarası (örn: "05551234567")'
        },
        filePath: {
          type: 'string',
          description: 'Bilgisayardaki yerel dosya yolu (örn: "C:\\Belgeler\\rapor.pdf") veya HTTP/HTTPS dosya URL adresi'
        },
        caption: {
          type: 'string',
          description: 'Opsiyonel: Dosya ile birlikte gönderilecek açıklama mesajı'
        },
        sendAsDocument: {
          type: 'boolean',
          description: 'Opsiyonel: Görsel/videoları sıkıştırmadan orijinal belge (doküman) olarak gönder (varsayılan: false)'
        }
      },
      required: ['to', 'filePath']
    }
  },
  {
    name: 'whatsapp_get_chats',
    description: 'Son WhatsApp sohbetlerini (kişilerin rehberdeki isimleri, telefon numaraları, son mesajları ve okunmamış mesaj sayılarıyla birlikte) listeler.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Getirilecek maksimum sohbet sayısı (varsayılan: 30)'
        },
        search: {
          type: 'string',
          description: 'Opsiyonel: Kişi adı, numara veya son mesaj içinde arama filtresi'
        }
      },
      required: []
    }
  },
  {
    name: 'whatsapp_get_messages',
    description: 'Belirli bir kişiyle (KİŞİ İSMİ veya telefon numarası ile) olan mesaj geçmişini veya gelen/giden tüm son mesajları isimleriyle birlikte getirir.',
    inputSchema: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'Opsiyonel: Kişi adı (örn: "Ahmet Yılmaz", "Ayşe Demir"), telefon numarası ("0555...") veya JID. Boş bırakılırsa tüm sohbetlerdeki son mesajları getirir.'
        },
        limit: {
          type: 'number',
          description: 'Getirilecek maksimum mesaj sayısı (varsayılan: 30)'
        },
        onlyIncoming: {
          type: 'boolean',
          description: 'Sadece karşıdan gelen mesajları filtrele (varsayılan: false)'
        }
      },
      required: []
    }
  },
  {
    name: 'whatsapp_search_messages',
    description: 'WhatsApp mesaj geçmişinde anahtar kelimeye veya gönderen kişinin ismine göre arama yapar.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Aranacak kelime, cümle veya kişi adı'
        },
        limit: {
          type: 'number',
          description: 'Maksimum sonuç sayısı (varsayılan: 20)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'whatsapp_get_contacts',
    description: 'WhatsApp rehberindeki kişileri, kayıtlı isimlerini ve gerçek telefon numaralarını listeler veya isimle arar.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Opsiyonel: Kişi adı veya telefon numarası araması (örn: "Ahmet", "Ayşe", "Mehmet")'
        },
        limit: {
          type: 'number',
          description: 'Maksimum kişi sayısı (varsayılan: 50)'
        }
      },
      required: []
    }
  }
];

async function executeTool(waManager, name, args = {}) {
  switch (name) {
    case 'whatsapp_plain_text': {
      const textOut = await executePlainTextCommand(waManager, args.command || 'YARDIM');
      return textOut;
    }
    case 'whatsapp_get_status': {
      const st = waManager.getStatus();
      return {
        status: st.status,
        connected: st.connected,
        persistentSession: true,
        user: st.user,
        qrAvailable: st.qrAvailable,
        dashboardUrl: 'http://localhost:3000',
        plainTextGuideUrl: 'http://localhost:3000/ai.txt',
        stats: st.stats,
        uptimeSeconds: st.uptimeSeconds
      };
    }
    case 'whatsapp_send_message': {
      return await waManager.sendMessage(args.to, args.text, {
        replyToMessageId: args.replyToMessageId
      });
    }
    case 'whatsapp_send_and_wait_reply': {
      return await waManager.sendAndWaitForReply(args.to, args.text, {
        timeoutSeconds: args.timeoutSeconds || 120
      });
    }
    case 'whatsapp_wait_for_reply': {
      return await waManager.waitForReply({
        chatId: args.chatId || '*',
        timeoutSeconds: args.timeoutSeconds || 120
      });
    }
    case 'whatsapp_get_unread': {
      return await waManager.getUnreadSummary(args.limit || 30);
    }
    case 'whatsapp_send_presence': {
      return await waManager.sendPresenceState(args.to, args.state || 'typing', args.durationSeconds || 5);
    }
    case 'whatsapp_send_file': {
      return await waManager.sendMedia(
        args.to,
        args.filePath || args.url,
        args.caption || '',
        { sendAsDocument: Boolean(args.sendAsDocument) }
      );
    }
    case 'whatsapp_get_chats': {
      return {
        chats: await waManager.getChats(args.limit || 30, args.search || '')
      };
    }
    case 'whatsapp_get_messages': {
      return {
        messages: await waManager.getMessages({
          chatId: args.chatId,
          limit: args.limit || 30,
          onlyIncoming: Boolean(args.onlyIncoming)
        })
      };
    }
    case 'whatsapp_search_messages': {
      return {
        query: args.query,
        results: waManager.searchMessages(args.query, args.limit || 20)
      };
    }
    case 'whatsapp_get_contacts': {
      return {
        contacts: waManager.getContacts(args.search || '', args.limit || 50)
      };
    }
    default:
      throw new Error(`Bilinmeyen araç (tool): ${name}`);
  }
}

module.exports = {
  TOOLS,
  executeTool
};
