/**
 * Otomatik Yapay Zeka (MCP) Kurulum Betiği
 * Gemini (Antigravity & Gemini CLI), OpenCode, Claude Code ve Claude Desktop
 * yapılandırma dosyalarına WhatsApp AI API MCP sunucusunu güvenle ekler.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const home = os.homedir();
const mcpServerPath = path.join(__dirname, 'mcp-server.js');

function updateJsonFile(filePath, updater, label) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let data = {};
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8').trim();
      if (raw) {
        data = JSON.parse(raw);
      }
    }
    const updated = updater(data);
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
    console.log(`✅ [${label}] yapılandırıldı -> ${filePath}`);
  } catch (err) {
    console.warn(`⚠️ [${label}] güncellenemedi (${filePath}): ${err.message}`);
  }
}

// 1. Gemini / Antigravity (mcp_config.json)
updateJsonFile(
  path.join(home, '.gemini', 'antigravity', 'mcp_config.json'),
  (cfg) => {
    cfg.mcpServers = cfg.mcpServers || {};
    cfg.mcpServers.whatsapp = {
      command: 'node',
      args: [mcpServerPath]
    };
    return cfg;
  },
  'Gemini Antigravity'
);

// 2. Gemini CLI (~/.gemini/settings.json)
updateJsonFile(
  path.join(home, '.gemini', 'settings.json'),
  (cfg) => {
    cfg.mcpServers = cfg.mcpServers || {};
    cfg.mcpServers.whatsapp = {
      command: 'node',
      args: [mcpServerPath]
    };
    return cfg;
  },
  'Gemini CLI'
);

// 3. OpenCode (~/.config/opencode/opencode.json)
updateJsonFile(
  path.join(home, '.config', 'opencode', 'opencode.json'),
  (cfg) => {
    cfg.$schema = cfg.$schema || 'https://opencode.ai/config.json';
    cfg.mcp = cfg.mcp || {};
    cfg.mcp.whatsapp = {
      type: 'local',
      command: ['node', mcpServerPath],
      enabled: true
    };
    return cfg;
  },
  'OpenCode'
);

// 4. Claude Code (~/.claude.json)
updateJsonFile(
  path.join(home, '.claude.json'),
  (cfg) => {
    cfg.mcpServers = cfg.mcpServers || {};
    cfg.mcpServers.whatsapp = {
      type: 'stdio',
      command: 'node',
      args: [mcpServerPath]
    };
    return cfg;
  },
  'Claude Code'
);

// 5. Claude Desktop (%APPDATA%/Claude/claude_desktop_config.json)
const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
updateJsonFile(
  path.join(appData, 'Claude', 'claude_desktop_config.json'),
  (cfg) => {
    cfg.mcpServers = cfg.mcpServers || {};
    cfg.mcpServers.whatsapp = {
      command: 'node',
      args: [mcpServerPath]
    };
    return cfg;
  },
  'Claude Desktop'
);

// 6. Install Global Agent Skill (SKILL.md) for Antigravity & Claude Code
const skillSource = path.join(__dirname, 'SKILL.md');
if (fs.existsSync(skillSource)) {
  const skillTargets = [
    { label: 'Antigravity Skill', dest: path.join(home, '.gemini', 'antigravity', 'skills', 'whatsapp-ai-bridge', 'SKILL.md') },
    { label: 'Claude Skill', dest: path.join(home, '.claude', 'skills', 'whatsapp-ai-bridge', 'SKILL.md') }
  ];
  for (const t of skillTargets) {
    try {
      fs.mkdirSync(path.dirname(t.dest), { recursive: true });
      fs.copyFileSync(skillSource, t.dest);
      console.log(`✅ [${t.label}] yüklendi -> ${t.dest}`);
    } catch (err) {
      console.warn(`⚠️ [${t.label}] yüklenemedi: ${err.message}`);
    }
  }
}
