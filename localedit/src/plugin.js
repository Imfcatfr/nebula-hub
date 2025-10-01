const { patch } = vendetta.patcher;
const { findByProps } = vendetta.metro;
const { showInputAlert } = vendetta.ui.alerts;

module.exports = {
  onLoad() {
    // Patch the message context menu
    const unpatchMenu = patch("openContextMenuLazy", (args, original) => {
      const [event, menu] = args;
      const menuElement = original(event, menu);
      // menuElement is (likely) a promise or React element
      // Use .then() if needed and then insert our button
      if (menuElement && menuElement.then) {
        return menuElement.then(res => {
          const props = res.props?.children;
          if (props && res.props.message) {
            // Don't add for your own messages
            if (res.props.message.author.id !== findByProps("getCurrentUser").getCurrentUser().id) {
              props.push({
                label: "Edit Locally",
                onPress: () => {
                  const msg = res.props.message;
                  showInputAlert({
                    title: "Local Edit",
                    placeholder: "New text",
                    initialValue: msg.content,
                    onConfirm: (text) => {
                      // Store original text and update view
                      if (!this.originals) this.originals = new Map();
                      if (!this.originals.has(msg.id)) {
                        this.originals.set(msg.id, msg.content);
                      }
                      msg.content = text;
                      // Force UI update by dispatching (if needed)
                      findByProps("receiveMessage").receiveMessage(msg.channel_id, { ...msg });
                    }
                  });
                }
              });
            }
          }
          return res;
        });
      }
      return menuElement;
    });

    // On unload: revert edits and unpatch
    return {
      onUnload() {
        // Revert any edited messages
        if (this.originals) {
          for (let [id, content] of this.originals) {
            const msg = findByProps("getMessage").getMessage(id);
            if (msg) {
              msg.content = content;
              findByProps("receiveMessage").receiveMessage(msg.channel_id, { ...msg });
            }
          }
          this.originals.clear();
        }
        unpatchMenu();
      }
    };
  }
};          const c = el.className || '';
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
