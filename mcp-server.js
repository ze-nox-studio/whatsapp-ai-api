#!/usr/bin/env node
/**
 * Stdio MCP (Model Context Protocol) Server for:
 * - Gemini / Antigravity
 * - OpenCode
 * - Claude Code & Claude Desktop
 * - Cursor / Windsurf / Any MCP Client
 *
 * Bridges stdio JSON-RPC 2.0 requests to the running WhatsApp AI API server (http://localhost:3000).
 * If the server is not running yet, it automatically starts server.js in the background!
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
const { TOOLS } = require('./ai-tools');

const API_HOST = process.env.WA_API_HOST || '127.0.0.1';
const API_PORT = Number(process.env.PORT || 3000);

function checkServerAlive() {
  return new Promise((resolve) => {
    const req = http.get(
      { host: API_HOST, port: API_PORT, path: '/api/status', timeout: 1500 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServerRunning() {
  const alive = await checkServerAlive();
  if (alive) return true;

  // Automatically start server.js detached in the background
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: __dirname,
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();

  // Wait up to 8 seconds for server to listen
  for (let i = 0; i < 16; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await checkServerAlive()) return true;
  }
  return false;
}

function forwardRpcToHttp(rpcPayload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(rpcPayload);
    const req = http.request(
      {
        host: API_HOST,
        port: API_PORT,
        path: '/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 650000
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(data ? JSON.parse(data) : null);
          } catch (e) {
            reject(new Error(`Geçersiz JSON yanıtı: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('WhatsApp AI API sunucusu zaman aşımına uğradı.'));
    });
    req.write(body);
    req.end();
  });
}

async function handleRequest(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    // Also trigger background server check without blocking handshake
    ensureServerRunning().catch(() => {});
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
          version: '1.0.0'
        }
      }
    };
  }

  if (method && method.startsWith('notifications/')) {
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
    const ready = await ensureServerRunning();
    if (!ready) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: 'Hata: WhatsApp AI API arka plan sunucusu başlatılamadı. Lütfen masaüstündeki Baslat.bat dosyasını çalıştırın.'
            }
          ],
          isError: true
        }
      };
    }
    return await forwardRpcToHttp(msg);
  }

  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code: -32601,
      message: `Method not found: ${method}`
    }
  };
}

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const parsed = JSON.parse(trimmed);
    const response = await handleRequest(parsed);
    if (response) {
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: err.message }
      }) + '\n'
    );
  }
});
