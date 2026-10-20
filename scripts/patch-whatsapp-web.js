#!/usr/bin/env node
/**
 * whatsapp-web.js runtime patch (idempotent).
 *
 * Fixes media/file sending on recent WhatsApp Web builds, which fails with:
 *   "Data passed to getter must include an id property (it's how we memoize) but got undefined"
 *   at getSender -> getValidatedSender -> Msg.initialize
 *
 * Root causes inside node_modules/whatsapp-web.js/src/util/Injected/Utils.js (window.WWebJS.sendMessage):
 *   1. `...mediaOptions` spreads the internal MediaData *model instance* into the outgoing message,
 *      leaking private model fields (__x_id, parent, collection, mirror, _uiObservers) into the Msg model.
 *   2. For @lid chats, `from` can resolve to undefined when one of the "me" WIDs is not available,
 *      so WhatsApp's memoized sender getter receives an object without an id.
 *   3. The sent Msg lookup by serialized key can miss, so callers get `undefined` instead of the sent message.
 *
 * Runs automatically on `npm install` (postinstall) and on every server start (whatsapp-manager.js).
 */

const fs = require('fs');
const path = require('path');

const MARKER = '/* WA-AI-API-PATCH v1 */';

function resolveUtilsPath() {
  try {
    const pkgDir = path.dirname(require.resolve('whatsapp-web.js/package.json'));
    return path.join(pkgDir, 'src', 'util', 'Injected', 'Utils.js');
  } catch (e) {
    return null;
  }
}

const PATCHES = [
  {
    name: 'safe-from-wid',
    find: `        const lidUser = getMaybeMeLidUser();
        const meUser = getMaybeMePnUser();
        const newId = await window.require('WAWebMsgKey').newId();
        let from = chat.id.isLid() ? lidUser : meUser;`,
    replace: `        ${MARKER}
        const lidUser = typeof getMaybeMeLidUser === 'function' ? getMaybeMeLidUser() : null;
        const meUser = typeof getMaybeMePnUser === 'function' ? getMaybeMePnUser() : null;
        const connWid = window.require('WAWebConnModel')?.Conn?.wid || null;
        const newId = await window.require('WAWebMsgKey').newId();
        let from = chat.id.isLid()
            ? lidUser || meUser || connWid
            : meUser || lidUser || connWid;`
  },
  {
    name: 'plain-media-fields',
    find: `            ...ephemeralFields,
            ...mediaOptions,
            ...(mediaOptions.toJSON ? mediaOptions.toJSON() : {}),`,
    replace: `            ...ephemeralFields,
            ...(mediaOptions.toJSON ? mediaOptions.toJSON() : mediaOptions),`
  },
  {
    name: 'sanitize-message',
    find: `        // Bot's won't reply if canonicalUrl is set (linking)
        if (botOptions) {
            delete message.canonicalUrl;
        }`,
    replace: `        // WA-AI-API: strip leaked model internals and guarantee id/from/author
        delete message.__x_id;
        delete message.parent;
        delete message.collection;
        delete message.mirror;
        delete message._uiObservers;
        message.id = newMsgKey;
        if (from) {
            message.from = from;
            message.author = from;
        }

        // Bot's won't reply if canonicalUrl is set (linking)
        if (botOptions) {
            delete message.canonicalUrl;
        }`
  },
  {
    name: 'robust-sent-lookup',
    find: `        if (options.waitUntilMsgSent) await sendMsgResultPromise;

        return window
            .require('WAWebCollections')
            .Msg.get(newMsgKey._serialized);`,
    replace: `        if (options.waitUntilMsgSent) await sendMsgResultPromise;

        const MsgCollection = window.require('WAWebCollections').Msg;
        return (
            MsgCollection.get(newMsgKey._serialized) ||
            MsgCollection.get(newMsgKey) ||
            (chat.msgs?.getModelsArray?.() || []).find(
                (m) => m?.id?.id === newMsgKey.id,
            )
        );`
  }
];

function applyPatch({ silent = false } = {}) {
  const log = (...a) => { if (!silent) console.log(...a); };
  const utilsPath = resolveUtilsPath();
  if (!utilsPath || !fs.existsSync(utilsPath)) {
    log('[wwebjs-patch] whatsapp-web.js not installed yet, skipping.');
    return { applied: false, reason: 'not-installed' };
  }

  let src = fs.readFileSync(utilsPath, 'utf8');
  if (src.includes(MARKER)) {
    log('[wwebjs-patch] Already patched.');
    return { applied: false, reason: 'already-patched' };
  }

  const missing = PATCHES.filter((p) => !src.includes(p.find)).map((p) => p.name);
  if (missing.length) {
    // Upstream changed; never half-patch the file.
    console.warn(`[wwebjs-patch] ⚠️ Upstream code changed, patch skipped (unmatched: ${missing.join(', ')}). File sending may need a new patch.`);
    return { applied: false, reason: 'unmatched', missing };
  }

  for (const p of PATCHES) {
    src = src.replace(p.find, p.replace);
  }
  fs.writeFileSync(utilsPath, src, 'utf8');
  log('[wwebjs-patch] ✅ whatsapp-web.js media sending patch applied.');
  return { applied: true };
}

module.exports = { applyPatch, PATCHES, MARKER };

if (require.main === module) {
  applyPatch();
}
