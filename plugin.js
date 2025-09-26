module.exports = class LocalMessageModifier {
  constructor() {
    this.storageKey = 'lmm:overrides:v1';
    this.observer = null;
    this.menuObserver = null;
    this.processedFlag = 'lmm-processed-v1';
    this.overrides = this._load() || {};
  }
  get name() { return 'Local Message Modifier'; }
  get author() { return 'You'; }
  get description() { return 'Add a "Modify (local)" entry to message context menus and save a local-only override for message text.'; }
  get version() { return '1.0.0'; }
  start() {
    this._startObservers();
    this._applyAllOverrides();
    console.log('[LMM] started');
  }
  stop() {
    if (this.observer) { this.observer.disconnect(); this.observer = null; }
    if (this.menuObserver) { this.menuObserver.disconnect(); this.menuObserver = null; }
    this._reloadVisibleChats();
    console.log('[LMM] stopped');
  }
  _startObservers() {
    const cfg = { childList: true, subtree: true, characterData: true };
    this.observer = new MutationObserver(m => {
      try {
        for (const mut of m) {
          if (mut.addedNodes && mut.addedNodes.length) {
            for (const n of Array.from(mut.addedNodes)) this._scanNode(n);
          }
          if (mut.type === 'characterData' && mut.target) this._scanNode(mut.target.parentNode || mut.target);
        }
      } catch (e) { console.warn('[LMM] observer', e); }
    });
    try { this.observer.observe(document.body, cfg); } catch(e){}
    this.menuObserver = new MutationObserver(m => {
      try {
        for (const mut of m) {
          if (!mut.addedNodes) continue;
          for (const node of Array.from(mut.addedNodes)) this._enhanceMenu(node);
        }
      } catch(e){ console.warn('[LMM] menuObserver', e); }
    });
    try { this.menuObserver.observe(document.body, { childList: true, subtree: true }); } catch(e){}
    try { document.querySelectorAll('div,span,p').forEach(n=>this._scanNode(n)); } catch(e){}
  }
  _enhanceMenu(node) {
    try {
      const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      if (!el) return;
      const menu = el.querySelector && (el.querySelector('[role="menu"]') || (el.getAttribute && el.getAttribute('role') === 'menu' ? el : null));
      if (!menu) return;
      if (menu.dataset && menu.dataset.lmmEnhanced) return;
      menu.dataset.lmmEnhanced = '1';
      const item = document.createElement('div');
      item.setAttribute('role','menuitem');
      item.style.padding = '8px 12px';
      item.style.cursor = 'pointer';
      item.innerText = 'Modify message (local)';
      item.onclick = (ev) => {
        ev.stopPropagation();
        const ctx = this._findMenuMessageContext(menu);
        if (!ctx) { alert('Could not find message context'); return; }
        const { messageEl, messageId } = ctx;
        const current = this._getOverride(messageId) || this._extractTextFromMessage(messageEl) || '';
        const val = prompt('Local message override (leave empty to clear):', current);
        if (val === null) return;
        if (val.trim() === '') { this._removeOverride(messageId); } else { this._setOverride(messageId, val); }
        this._applyOverrideToElement(messageEl, this._getOverride(messageId));
      };
      const clear = document.createElement('div');
      clear.setAttribute('role','menuitem');
      clear.style.padding = '8px 12px';
      clear.style.cursor = 'pointer';
      clear.innerText = 'Clear local modification';
      clear.onclick = (ev) => {
        ev.stopPropagation();
        const ctx = this._findMenuMessageContext(menu);
        if (!ctx) { alert('Could not find message context'); return; }
        const { messageEl, messageId } = ctx;
        this._removeOverride(messageId);
        this._applyOverrideToElement(messageEl, null);
      };
      menu.appendChild(item);
      menu.appendChild(clear);
    } catch(e){}
  }
  _findMenuMessageContext(menuEl) {
    try {
      let anchor = menuEl;
      for (let i=0;i<12 && anchor;i++,anchor=anchor.parentElement) {
        const msg = anchor.querySelector && (anchor.querySelector('[data-message-id]') || anchor.querySelector('[data-author-id]') || anchor.querySelector('[data-list-item-id]'));
        if (msg) return { messageEl: msg, messageId: this._deriveMessageId(msg) };
      }
      const selection = window.getSelection && window.getSelection().focusNode;
      if (selection) {
        const el = selection.nodeType===3 ? selection.parentElement : selection;
        const ma = this._findMessageAncestor(el);
        if (ma) return { messageEl: ma, messageId: this._deriveMessageId(ma) };
      }
    } catch(e){}
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
