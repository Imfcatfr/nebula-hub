/**
 * @name LocalEdit
 * @description Locally edit other people's messages until restart
 * @author Imfcatfr
 * @version 1.0.0
 */

import { instead } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
import { showInputAlert } from "@vendetta/ui/alerts";
import { after } from "@vendetta/patcher";

const MessageActions = findByProps("openContextMenuLazy");
const Messages = findByProps("sendMessage", "receiveMessage");
const originalRender = new Map();

export default {
  onLoad() {
    this.patches = [];

    // patch context menu
    this.patches.push(after("openContextMenuLazy", MessageActions, (_, args, ret) => {
      const [event, contextMenu] = args;
      if (!contextMenu) return;

      const orig = contextMenu.then;
      contextMenu.then = (...a) =>
        orig.apply(contextMenu, a).then((res) => {
          const props = res?.props;
          if (!props?.children) return res;

          // Insert our custom button
          props.children.push({
            label: "Edit locally",
            onPress: () => {
              const msg = props.message;
              if (!msg || msg.author?.id === Messages.getCurrentUser().id) return;

              showInputAlert({
                title: "Local Edit",
                placeholder: "Enter new text",
                initialValue: msg.content,
                onConfirm: (text) => {
                  if (!originalRender.has(msg.id)) {
                    originalRender.set(msg.id, msg.content);
                  }
                  msg.content = text;
                  // force rerender
                  Messages.receiveMessage(msg.channel_id, { ...msg });
                },
              });
            },
          });

          return res;
        });
    }));
  },

  onUnload() {
    this.patches.forEach((u) => u());
    this.patches = [];

    // restore messages to original if modified
    for (const [id, content] of originalRender) {
      const msg = Messages.getMessage?.(id);
      if (msg) {
        msg.content = content;
        Messages.receiveMessage(msg.channel_id, { ...msg });
      }
    }
    originalRender.clear();
  },
};    } catch(e){}
    return null;
  }
  _scanNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches && (node.matches('input, textarea, [contenteditable="true"]') || node.closest && node.closest('input,textarea,[contenteditable="true"]'))) return;
    const messageAncestor = this._findMessageAncestor(node);
    if (!messageAncestor) return;
    const mid = this._deriveMessageId(messageAncestor);
    const override = this._getOverride(mid);
    if (!override) return;
    this._applyOverrideToElement(messageAncestor, override);
    if (messageAncestor.dataset) messageAncestor.dataset[this.processedFlag] = Date.now().toString();
  }
  _deriveMessageId(el) {
    try {
      const a = el.getAttribute && (el.getAttribute('data-message-id') || el.getAttribute('data-list-item-id') || el.getAttribute('data-author-id') || el.getAttribute('data-user-id'));
      if (a) return a;
      const author = this._detectAuthorId(el) || 'unknown';
      const txt = (this._extractTextFromMessage(el) || '').slice(0,200);
      return `${author}:${this._hashString(txt)}`;
    } catch(e){ return 'unknown'; }
  }
  _findMessageAncestor(node) {
    let el = node;
    for (let i=0;i<10 && el;i++,el=el.parentElement) {
      try {
        if (!el) break;
        if (el.getAttribute) {
          const listId = el.getAttribute('data-list-item-id') || '';
          if (listId && listId.toLowerCase().includes('chat-messages')) return el;
        }
        const role = el.getAttribute && el.getAttribute('role');
        if (role === 'article' || role === 'listitem') {
          const c = el.className || '';
          if (typeof c === 'string' && c.toLowerCase().includes('message')) return el;
        }
        if (el.hasAttribute && (el.hasAttribute('data-message-id') || el.hasAttribute('data-author-id') || el.hasAttribute('data-list-id'))) return el;
      } catch(e){}
    }
    return null;
  }
  _detectAuthorId(el) {
    try {
      if (el.getAttribute) {
        const aid = el.getAttribute('data-author-id') || el.getAttribute('data-user-id') || el.getAttribute('data-sender-id');
        if (aid) return aid;
      }
      const anchor = el.querySelector && (el.querySelector('a[href*="/users/"]') || el.querySelector('a[href*="users/"]'));
      if (anchor && anchor.href) {
        const m = anchor.href.match(/users\/(\d+)/);
        if (m) return m[1];
      }
      const child = el.querySelector && (el.querySelector('[data-user-id]') || el.querySelector('[data-author-id]'));
      if (child) return child.getAttribute('data-user-id') || child.getAttribute('data-author-id');
    } catch(e){}
    return null;
  }
  _extractTextFromMessage(el) {
    try {
      const txtEl = el.querySelector && (el.querySelector('[data-slate-editor], [data-message-content], [class*="markup"], [class*="messageContent"], p, span'));
      if (txtEl) return txtEl.innerText || txtEl.textContent || '';
      return el.textContent || '';
    } catch(e){ return ''; }
  }
  _applyOverrideToElement(el, override) {
    try {
      const txtNodes = this._gatherTextNodes(el);
      if (!txtNodes.length) return;
      if (!override) {
        this._reloadElementText(el);
        return;
      }
      const first = txtNodes[0];
      first.nodeValue = override;
      for (let i=1;i<txtNodes.length;i++) txtNodes[i].nodeValue = '';
    } catch(e){}
  }
  _gatherTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n)=> n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    const nodes = []; let cur;
    while ((cur = walker.nextNode())) nodes.push(cur);
    return nodes;
  }
  _reloadElementText(el) {
    try {
      const txt = this._extractTextFromMessage(el);
      const nodes = this._gatherTextNodes(el);
      if (!nodes.length) return;
      const first = nodes[0];
      first.nodeValue = txt;
      for (let i=1;i<nodes.length;i++) nodes[i].nodeValue = '';
    } catch(e){}
  }
  _applyAllOverrides() {
    try {
      const msgs = document.querySelectorAll('div,article,[data-message-id]');
      for (const m of Array.from(msgs)) {
        const id = this._deriveMessageId(m);
        const o = this._getOverride(id);
        if (o) this._applyOverrideToElement(m, o);
      }
    } catch(e){}
  }
  _getOverride(id) { return this.overrides[id] || null; }
  _setOverride(id, text) { this.overrides[id] = text; this._save(); }
  _removeOverride(id) { if (this.overrides[id]) delete this.overrides[id]; this._save(); }
  _save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.overrides));
    } catch(e){}
  }
  _load() {
    try {
      const v = localStorage.getItem(this.storageKey);
      return v ? JSON.parse(v) : {};
    } catch(e){ return {}; }
  }
  _reloadVisibleChats() {
    try { document.querySelectorAll('[data-list-item-id],[data-message-id],article,div').forEach(el=>{ if (el && el.dataset && el.dataset[this.processedFlag]) { delete el.dataset[this.processedFlag]; } }); } catch(e){}
    try { const evt = new Event('visibilitychange'); document.dispatchEvent(evt); } catch(e){}
  }
  _hashString(s) { let h = 5381; for (let i=0;i<s.length;i++) h = ((h<<5)+h) + s.charCodeAt(i); return (h >>> 0).toString(16); }
};
