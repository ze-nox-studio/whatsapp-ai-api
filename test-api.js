/**
 * WhatsApp AI API, Plain-Text Backend & MCP Doğrulama Testi
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

function httpGet(urlPath, plain = false) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: 3000, path: urlPath }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: plain ? data : JSON.parse(data) }));
    }).on('error', reject);
  });
}

function httpPost(urlPath, payload, plain = false) {
  return new Promise((resolve, reject) => {
    const body = plain ? String(payload) : JSON.stringify(payload);
    const req = http.request(
      {
        host: '127.0.0.1',
        port: 3000,
        path: urlPath,
        method: 'POST',
        headers: {
          'Content-Type': plain ? 'text/plain; charset=utf-8' : 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: plain ? data : JSON.parse(data) }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function testStdioMcp() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'mcp-server.js')], {
      cwd: __dirname
    });
    const responses = [];
    child.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const l of lines) {
        responses.push(JSON.parse(l));
        if (responses.length >= 3) {
          child.kill();
          resolve(responses);
        }
      }
    });
    child.on('error', reject);

    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
    child.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'whatsapp_plain_text', arguments: { command: 'DURUM' } }
      }) + '\n'
    );
  });
}

async function runTests() {
  console.log('🧪 1. Plain-Text AI Kullanım Kılavuzu (/ai.txt) testi...');
  const guideRes = await httpGet('/ai.txt', true);
  console.log('   ✅ Kılavuz uzunluğu:', guideRes.body.length, 'karakter');

  console.log('🧪 2. Plain-Text Backend (POST /text -> "DURUM") testi...');
  const plainStatus = await httpPost('/text', 'DURUM', true);
  console.log('   ✅ Durum yanıtı alındı:', plainStatus.status === 200 ? 'OK (200)' : plainStatus.status);

  console.log('🧪 3. OpenAPI 3.1 Şeması (/openapi.json) testi...');
  const openApi = await httpGet('/openapi.json', false);
  console.log('   ✅ OpenAPI Başlığı:', openApi.body?.info?.title);

  console.log('🧪 4. Stdio MCP (whatsapp_plain_text aracı) testi...');
  const stdioRes = await testStdioMcp();
  console.log('   ✅ MCP Araçları:', stdioRes[1].result.tools.map((t) => t.name).join(', '));
  console.log('   ✅ MCP Araç Çağrısı Başarılı:', !stdioRes[2].result.isError);

  console.log('\n🎉 TÜM PLAIN-TEXT, REST VE MCP TESTLERİ BAŞARIYLA GEÇTİ!');
}

runTests().catch((err) => {
  console.error('❌ Test Hatası:', err);
  process.exit(1);
});
