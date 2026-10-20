# 🤖 Yapay Zekalar İçin WhatsApp Plain-Text & MCP Kullanım Kılavuzu

Bu doküman **Gemini (Antigravity / CLI)**, **OpenCode**, **Claude Code / Claude Desktop**, **Cursor**, **ChatGPT** ve diğer tüm yapay zeka ajanlarının bu bilgisayardaki WhatsApp hesabıyla **Düz Metin (Plain Text)**, **CLI** veya **MCP** üzerinden nasıl iletişim kuracağını açıklar.

---

## 🎯 YAPAY ZEKA AJANI İÇİN DOĞRUDAN TALİMAT (BU DOSYA SANA SÜRÜKLENDİYSE OKU!)

Eğer kullanıcı bu dosyayı (veya `AI_BURAYA_SURUKLE.md` / `AGENTS.md` dosyasını) sohbet penceresine sürüklediyse, senden bu bilgisayardaki **`http://localhost:3000`** adresinde çalışan WhatsApp hesabını yönetmeni istiyordur. **Hiçbir ek kurulum yapmadan veya kodları taramadan şu adımları izle:**

1. **İlk Adım (Bağlantı ve Okunmamışları Gör):**
   - Hemen `OKUNMAMIS` (veya `DURUM`) komutunu çalıştır (`whatsapp_get_unread` MCP aracıyla, `node wa-cli.js OKUNMAMIS` ile veya `POST http://localhost:3000/text` adresine `OKUNMAMIS` göndererek).
   - Kullanıcıya hangi kişilerden okunmamış mesaj olduğunu özetle ve ne yapmak istediğini sor.
2. **Bir Kişiyle Sohbet Ederken (Neyi Nasıl Yapacaksın?):**
   - **Adım A (Bağlamı Öğren):** Yazmadan önce `MESAJLAR <Kişi Adı> | 30` ile o kişiyle olan son konuşmaları oku.
   - **Adım B (Doğal Görün):** Mesaj hazırlarken `YAZIYOR <Kişi Adı>` gönder ki karşı tarafta *"yazıyor..."* görünsün; gelen mesajı okuduğunda `OKUNDU <Kişi Adı>` ile Mavi Tik at.
   - **Adım C (Mesaj Gönder ve Yanıt Gelince Uyan — ASLA Döngü Kurma!):**
     Mesaj atıp karşıdan cevap bekleyeceksen `GONDER` kullanıp saniyede bir kontrol etme! Doğrudan şu komutu çalıştır:
     ```text
     SOR <Kişi Adı> | <Mesajın> | 180
     ```
     *(MCP kullanıyorsan: `whatsapp_send_and_wait_reply`)*
     Bu komut mesajı gönderir, karşı taraf WhatsApp'tan cevap yazana kadar bekler, peş peşe yazdığı satırları birleştirir ve **yanıt geldiği salisede seni uyandırır**!
   - **Adım D (Sadece Yanıt Bekleyeceksen):** Mesaj atmadan birinden (veya `*` ile herkesten) mesaj beklemek için `BEKLE <Kişi Adı veya *> | 180` (`whatsapp_wait_for_reply`) kullan.
3. **Kullanıcı Sohbete Bir Dosya (PDF, Görsel, Belge, ZIP) Sürükleyip "Bunu Gönder" Derse:**
   - Sürüklenen dosyanın bilgisayardaki tam yolunu (`C:\...`) al ve doğrudan şu komutu çalıştır:
     ```text
     DOSYA <Kişi Adı> | <Tam Dosya Yolu veya URL> | [Açıklama]
     ```
     *(MCP kullanıyorsan: `whatsapp_send_file`)*

---

## 1. Düz Metin (Plain Text) Komut Protokolü (`POST /text` & `GET /text`)

Yapay zeka ajanları hiçbir JSON ayrıştırma (parsing) işlemine gerek duymadan `http://localhost:3000/text` adresine **düz metin (`text/plain`)** gönderip **düz metin** yanıt alabilirler.

### Desteklenen Düz Metin Komutları

| Düz Metin Komutu | Açıklama | Örnek Kullanım |
| :--- | :--- | :--- |
| `DURUM` (veya `STATUS`) | Bağlantı durumunu, aktif numarayı ve kişi/sohbet/mesaj sayılarını verir. | `DURUM` |
| `OKUNMAMIS` (veya `UNREAD`) | Okunmamış (yeni gelen) mesajı olan tüm sohbetleri ve okunmamış mesaj içeriklerini listeler. | `OKUNMAMIS` |
| `SOR <Kişi Adı veya Tel> \| <Mesaj> \| [Saniye]` | **Gönder ve Yanıt Gelince AI'ı Uyandır:** Mesajı gönderir, karşı taraf yanıt yazana kadar isteği bekletir ve yanıt geldiği anda AI'ı uyandırır! | `SOR Ahmet Yılmaz \| Merhaba müsait misin? \| 120` |
| `BEKLE [Kişi Adı veya *] \| [Saniye]` | **Yanıt Bekle (AI Wake-Up):** Belirtilen kişiden (veya `*` ile herhangi birinden) yeni mesaj gelene kadar bekler, mesaj geldiği an AI'ı uyandırır. | `BEKLE Ahmet Yılmaz \| 120` veya `BEKLE * \| 60` |
| `SOHBETLER [limit] [arama]` | Son konuşulan kişileri, grupları ve son mesajları listeler. | `SOHBETLER 20` veya `SOHBETLER 10 Proje` |
| `MESAJLAR <Kişi Adı veya Tel> \| [limit]` | Kişi ismiyle veya numarayla geçmiş ve yeni tüm mesajları getirir. | `MESAJLAR Ahmet Yılmaz` veya `MESAJLAR Ayşe Demir \| 50` |
| `SON_MESAJLAR [limit]` | Tüm sohbetlerdeki son mesajları listeler. | `SON_MESAJLAR 25` |
| `GELENLER [limit]` | Sadece karşı taraftan gelen son mesajları listeler. | `GELENLER 20` |
| `GONDER <Kişi Adı veya Tel> \| <Mesaj>` | Rehberdeki kişi ismini (veya numarayı) bulup mesaj gönderir. | `GONDER Ahmet Yılmaz \| Merhaba, nasılsın?` |
| `DOSYA <Kişi Adı veya Tel> \| <Dosya Yolu veya URL> \| [Açıklama]` | Kişi ismine veya numaraya bilgisayardaki dosyayı (PDF, görsel, belge, ses, video) veya URL'yi gönderir. | `DOSYA Ahmet Yılmaz \| C:\rapor.pdf \| Rapor ektedir` |
| `YAZIYOR <Kişi Adı veya Tel>` | AI yanıt hazırlarken karşı tarafa `"yazıyor..."` (`typing`) efekti gösterir. | `YAZIYOR Ahmet Yılmaz` |
| `OKUNDU <Kişi Adı veya Tel>` | Kişinin sohbetindeki mesajları okundu (Mavi Tik) olarak işaretler. | `OKUNDU Ahmet Yılmaz` |
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
8. **İsimle veya Numarayla Dosya / Medya Gönder:**
   - **POST (`text/plain`):** `POST http://localhost:3000/text/send-file` $\rightarrow$ Gövde (Body): `Ahmet Yılmaz | C:\rapor.pdf | Rapor ektedir`
   - **POST (`/text`):** `POST http://localhost:3000/text` $\rightarrow$ Gövde (Body): `DOSYA Ahmet Yılmaz | C:\rapor.pdf | Rapor ektedir`
   - **GET (Tek satır URL):** `GET http://localhost:3000/text/send-file?to=Ahmet&filePath=C:\rapor.pdf&caption=Rapor`
9. **Mesaj Gönder ve Yanıt Gelince AI'ı Uyandır (Send & Wait):**
   - **POST (`text/plain`):** `POST http://localhost:3000/text/ask` $\rightarrow$ Gövde (Body): `Ahmet Yılmaz | Merhaba müsait misin? | 120`
   - **GET (Tek satır URL):** `GET http://localhost:3000/text/ask?to=Ahmet&text=Merhaba&timeout=120`
10. **Yeni Mesaj Gelene Kadar Bekle ve AI'ı Uyandır (Long-Polling Wake-Up):**
    - `GET http://localhost:3000/text/wait?chat=Ahmet&timeout=120` (Belirli kişiden yanıt bekler)
    - `GET http://localhost:3000/text/wait?timeout=120` (Herhangi birinden yeni mesaj bekler)
11. **Okunmamış Mesajları Listele:**
    - `GET http://localhost:3000/text/unread`
12. **Canlı SSE (Server-Sent Events) Mesaj Akışı:**
    - `GET http://localhost:3000/text/stream` (Düz metin canlı akış)
    - `GET http://localhost:3000/api/stream` (JSON canlı akış)

---

## 3. Terminal / CLI Üzerinden Düz Metin Kullanımı

Terminal komutu çalıştırabilen yapay zekalar (**OpenCode**, **Claude Code**, **Gemini**) şu komutları doğrudan çalıştırabilir:

```powershell
# Durum ve okunmamış mesaj kontrolü
node wa-cli.js DURUM
node wa-cli.js OKUNMAMIS

# Mesaj gönder ve karşı taraf yanıt yazana kadar bekleyip AI'ı uyandır (120 sn timeout)
node wa-cli.js "SOR Ahmet Yılmaz | Merhaba, müsait misin? | 120"

# Herhangi birinden (veya belirli kişiden) yeni mesaj gelene kadar bekle ve AI'ı uyandır
node wa-cli.js "BEKLE * | 60"
node wa-cli.js "BEKLE Ahmet Yılmaz | 120"

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

# Kişi ismiyle dosya gönder
node wa-cli.js "DOSYA Ahmet Yılmaz | C:\rapor.pdf | Rapor ektedir"
```

---

## 4. MCP (Model Context Protocol) Araçları

Gemini, OpenCode ve Claude içerisine otomatik tanımlanan `whatsapp` MCP sunucusu şu araçları sunar:

- **`whatsapp_plain_text`**: `command` parametresine yukarıdaki düz metin komutlarından herhangi birini alır (`"SOR Ahmet | Müsait misin? | 120"`, `"BEKLE * | 60"`, `"OKUNMAMIS"`, `"MESAJLAR Ahmet Yılmaz"`, `"GONDER Ahmet | Merhaba"`, `"DOSYA Ahmet | C:\\rapor.pdf | Rapor"` vb.) ve düz metin döner.
- **`whatsapp_send_and_wait_reply`**: Kişiye mesaj gönderir ve karşı taraf WhatsApp'tan yanıt yazana kadar bekleyip yanıt geldiği anda AI'ı uyandırır (Loop/polling yapmadan tek adımda soru-cevap).
- **`whatsapp_wait_for_reply`**: Belirli bir kişiden veya herhangi birinden yeni WhatsApp mesajı gelene kadar bekler, mesaj geldiği anda AI'ı uyandırır.
- **`whatsapp_get_unread`**: Okunmamış (yeni gelen) mesajı olan sohbetleri ve okunmamış mesajları getirir.
- **`whatsapp_send_presence`**: Sohbette `"yazıyor..."` (`typing`) gösterir veya mesajları `"okundu"` (`seen` / Mavi Tik) yapar.
- **`whatsapp_get_status`**: Bağlantı ve istatistik bilgisi.
- **`whatsapp_send_message`**: `to` (kişi adı veya numara) ve `text` (mesaj).
- **`whatsapp_send_file`**: `to` (kişi adı veya numara), `filePath` (dosya yolu veya URL) ve `caption` (açıklama) ile dosya/medya gönderir.
- **`whatsapp_get_chats`**: Son sohbetler listesi.
- **`whatsapp_get_messages`**: `chatId` (kişi adı veya numara) ile mesaj geçmişi.
- **`whatsapp_search_messages`**: `query` ile mesaj arama.
- **`whatsapp_get_contacts`**: `search` ile rehberde kişi arama.
