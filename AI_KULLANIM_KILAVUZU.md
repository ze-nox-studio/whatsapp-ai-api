# 🤖 Yapay Zekalar İçin WhatsApp Plain-Text & MCP Kullanım Kılavuzu

Bu doküman **Gemini (Antigravity / CLI)**, **OpenCode**, **Claude Code / Claude Desktop**, **Cursor**, **ChatGPT** ve diğer tüm yapay zeka ajanlarının bu bilgisayardaki WhatsApp hesabıyla **Düz Metin (Plain Text)**, **CLI** veya **MCP** üzerinden nasıl iletişim kuracağını açıklar.

> **💡 Herhangi Bir Yapay Zekaya Verebileceğiniz Hazır Talimat (Prompt):**
> *"Bilgisayarımda `http://localhost:3000` adresinde WhatsApp AI API çalışıyor. Önce `http://localhost:3000/ai.txt` adresini okuyarak düz metin komutlarını öğren, ardından `http://localhost:3000/text` üzerinden WhatsApp mesajlarımı kontrol et / mesaj gönder."*

---

## 1. Düz Metin (Plain Text) Komut Protokolü (`POST /text` & `GET /text`)

Yapay zeka ajanları hiçbir JSON ayrıştırma (parsing) işlemine gerek duymadan `http://localhost:3000/text` adresine **düz metin (`text/plain`)** gönderip **düz metin** yanıt alabilirler.

### Desteklenen Düz Metin Komutları

| Düz Metin Komutu | Açıklama | Örnek Kullanım |
| :--- | :--- | :--- |
| `DURUM` (veya `STATUS`) | Bağlantı durumunu, aktif numarayı ve kişi/sohbet/mesaj sayılarını verir. | `DURUM` |
| `SOHBETLER [limit] [arama]` | Son konuşulan kişileri, grupları ve son mesajları listeler. | `SOHBETLER 20` veya `SOHBETLER 10 Proje` |
| `MESAJLAR <Kişi Adı veya Tel> \| [limit]` | Kişi ismiyle veya numarayla geçmiş ve yeni tüm mesajları getirir. | `MESAJLAR Ahmet Yılmaz` veya `MESAJLAR Ayşe Demir \| 50` |
| `SON_MESAJLAR [limit]` | Tüm sohbetlerdeki son mesajları listeler. | `SON_MESAJLAR 25` |
| `GELENLER [limit]` | Sadece karşı taraftan gelen son mesajları listeler. | `GELENLER 20` |
| `GONDER <Kişi Adı veya Tel> \| <Mesaj>` | Rehberdeki kişi ismini (veya numarayı) bulup mesaj gönderir. | `GONDER Ahmet Yılmaz \| Merhaba, nasılsın?` |
| `KISILER [arama]` (veya `REHBER`) | Rehberdeki kişileri gerçek telefon numaralarıyla (`+905...`) listeler. | `KISILER Ayşe` |
| `ARA <kelime>` (veya `SEARCH`) | Tüm mesaj geçmişinde kelime araması yapar. | `ARA toplantı` |
| `SENKRONIZE` (veya `SYNC`) | WhatsApp Web üzerinden tüm kişileri ve mesaj geçmişini yeniler. | `SENKRONIZE` |
| `YARDIM` (veya `KILAVUZ`) | Bu kullanım kılavuzunu düz metin olarak döndürür. | `YARDIM` |

---

## 2. Doğrudan Düz Metin URL'leri (HTTP GET & POST)

Yapay zeka ajanları `curl`, `fetch`, `Invoke-RestMethod`, `python requests` veya web okuma araçlarıyla doğrudan şu adresleri çağırabilir:

1. **Kılavuzu Oku:**
   `GET http://localhost:3000/ai.txt`
2. **Durumu Kontrol Et:**
   `GET http://localhost:3000/text/status`
3. **Son Sohbetleri Listele:**
   `GET http://localhost:3000/text/chats?limit=25`
4. **Kişiyle Olan Mesaj Geçmişini Oku (İsimle veya Numarayla):**
   - `GET http://localhost:3000/text/messages/Ahmet`
   - `GET http://localhost:3000/text/messages?chat=Ayse%20Demir&limit=40`
5. **Rehberde Kişi Ara:**
   - `GET http://localhost:3000/text/contacts/Ahmet`
   - `GET http://localhost:3000/text/contacts?search=Mehmet`
6. **Mesajlarda Kelime Ara:**
   - `GET http://localhost:3000/text/search?q=toplanti`
7. **İsimle veya Numarayla Mesaj Gönder:**
   - **POST (`text/plain`):** `POST http://localhost:3000/text/send` $\rightarrow$ Gövde (Body): `Ahmet Yılmaz | Merhaba!`
   - **POST (`/text`):** `POST http://localhost:3000/text` $\rightarrow$ Gövde (Body): `GONDER Ahmet Yılmaz | Merhaba!`
   - **GET (Tek satır URL):** `GET http://localhost:3000/text/send?to=Ahmet&text=Merhaba`

---

## 3. Terminal / CLI Üzerinden Düz Metin Kullanımı

Terminal komutu çalıştırabilen yapay zekalar (**OpenCode**, **Claude Code**, **Gemini**) şu komutları doğrudan çalıştırabilir:

```powershell
# Durum kontrolü
node wa-cli.js DURUM

# Son 15 sohbeti düz metin listele
node wa-cli.js SOHBETLER 15

# Kişi ismiyle geçmiş mesajları düz metin oku
node wa-cli.js MESAJLAR "Ahmet Yılmaz"

# Rehberde kişi ara
node wa-cli.js KISILER "Ayşe"

# Mesaj geçmişinde kelime ara
node wa-cli.js ARA "toplantı"

# Kişi ismiyle mesaj gönder
node wa-cli.js "GONDER Ahmet Yılmaz | Merhaba!"
```

---

## 4. MCP (Model Context Protocol) Araçları

Gemini, OpenCode ve Claude içerisine otomatik tanımlanan `whatsapp` MCP sunucusu şu araçları sunar:

- **`whatsapp_plain_text`**: `command` parametresine yukarıdaki düz metin komutlarından herhangi birini alır (`"MESAJLAR Ahmet Yılmaz"`, `"GONDER Ahmet | Merhaba"` vb.) ve düz metin döner.
- **`whatsapp_get_status`**: Bağlantı ve istatistik bilgisi.
- **`whatsapp_send_message`**: `to` (kişi adı veya numara) ve `text` (mesaj).
- **`whatsapp_get_chats`**: Son sohbetler listesi.
- **`whatsapp_get_messages`**: `chatId` (kişi adı veya numara) ile mesaj geçmişi.
- **`whatsapp_search_messages`**: `query` ile mesaj arama.
- **`whatsapp_get_contacts`**: `search` ile rehberde kişi arama.
