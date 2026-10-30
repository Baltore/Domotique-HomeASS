/* Cartes de l'Accueil.
   - custom:maison-lumieres-card : une tuile par pièce (éclairée à la couleur réelle des lampes), groupes, compteur et « Tout éteindre »
       Config : script (script de bascule d'une zone, champ `area`), groups: [{ title, rooms: [{ area, name, icon, lights: [secours] }] }]
   - custom:maison-famille-card  : destinataire en puces, message (popup browser_mod) et appels « Venez manger » / « Viens ici »
       Config : select (input_select du destinataire), message: { service, data } (action browser_mod), buttons: [{ name, icon, color, script }] */
(() => {
  const COL = { amber: '#ffb84a', blue: '#4aa3ff', green: '#4cd08a', cyan: '#3cc4e8', purple: '#a98bff', pink: '#ff7ab8', red: '#ff5a5a', orange: '#ff9a4a' };
  const col = (c) => COL[c] || c || COL.amber;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hexToRgb = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); return m ? [0, 2, 4].map((i) => parseInt(m[1].substr(i, 2), 16)) : null; };
  const bright = (rgb) => { const m = Math.max(...rgb, 1); return rgb.map((x) => Math.round(x * 255 / m)); };
  const kelvin = (k) => { const t = k / 100; const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332), g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755), b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; return [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x)))); };

  const BASE = `
    :host { display:block; } ha-card { padding:0; background:transparent; box-shadow:none; border:none; }
    button { font:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
    .lab { font:700 11px/1 system-ui,sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--secondary-text-color,#9aa4b5); }
  `;

  class Base extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    set hass(h) { this._hass = h; if (!this._built) { this._build(); this._built = true; } this._update(); }
    getGridOptions() { return { columns: 12, rows: 'auto' }; }
    st(id) { return this._hass && this._hass.states ? this._hass.states[id] : undefined; }
    q(sel) { return this.shadowRoot.querySelector(sel); }
    qa(sel) { return [...this.shadowRoot.querySelectorAll(sel)]; }
  }

  // ---------------------------------------------------------------------------------------- lumières
  class LumieresCard extends Base {
    setConfig(c) { if (!c || !Array.isArray(c.groups)) throw new Error('groups requis'); this._cfg = c; this._built = false; }
    getCardSize() { return 6; }

    // lumières d'une zone : registre du frontend (zone de l'entité ou de son appareil), repli sur la liste de la config
    _lights(room) {
      const h = this._hass, ents = h.entities, devs = h.devices || {}, out = [];
      if (ents && Object.keys(ents).length) {
        for (const [id, e] of Object.entries(ents)) {
          if (!id.startsWith('light.')) continue;
          const a = e.area_id || (e.device_id && devs[e.device_id] && devs[e.device_id].area_id), s = h.states[id];
          if (a === room.area && !(s && s.attributes && Array.isArray(s.attributes.entity_id))) out.push(id);
        }
        return out;
      }
      return room.lights || [];
    }


    // alignement par le bas de la colonne (option align_bottom, voir maison-align.js)
    _alignInit() {
      if (!this._cfg || !this._cfg.align_bottom) return;
      const go = () => { if (!window.__m3dAlign) { setTimeout(go, 300); return; } window.__m3dAlign.add(this, (e) => { const w = this.shadowRoot.querySelector('ha-card'); w.style.minHeight = ''; const h0 = w.offsetHeight; w.style.minHeight = `${h0 + e}px`; }); };
      go();
    }
    connectedCallback() { if (this._built) this._alignInit(); }

    _build() {
      const c = this._cfg; let n = 0;
      this.shadowRoot.innerHTML = `<style>${BASE}
        .hd { display:flex; align-items:center; gap:10px; margin-bottom:12px; } .hd .cnt { flex:1; font:600 13px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); } .hd .cnt b { color:#ffd58a; font-size:15px; }
        .all { padding:7px 13px; border-radius:99px; border:1px solid rgba(130,150,190,.35); background:rgba(130,150,190,.1); color:var(--primary-text-color,#dbe9ff); font:700 12px system-ui,sans-serif; } .all:disabled { opacity:.35; }
        ha-card { display:flex; flex-direction:column; } .gs { flex:1; display:flex; flex-direction:column; justify-content:space-between; gap:12px; } .gt { margin:0 2px 8px; }
        .g { display:grid; grid-template-columns:repeat(auto-fill,minmax(104px,1fr)); gap:8px; }
        .r { --c:#ffb84a; --fg:#14110a; display:flex; flex-direction:column; align-items:center; gap:6px; padding:12px 6px 10px; border-radius:18px; cursor:pointer; user-select:none; -webkit-user-select:none; min-width:0;
          background:var(--card-background-color,#101a30); border:1.5px solid rgba(120,150,200,.2); transition:all .3s; }
        .r:active { transform:scale(.95); } .r.none { border-style:dashed; opacity:.55; cursor:default; }
        .r.on { border-color:var(--c); background:linear-gradient(160deg,color-mix(in srgb,var(--c) 24%,var(--card-background-color,#101a30)),var(--card-background-color,#101a30) 80%); box-shadow:0 0 16px color-mix(in srgb,var(--c) 35%,transparent); }
        .ic { width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(130,150,190,.14); color:var(--secondary-text-color,#8fa3c4); --mdc-icon-size:23px; transition:all .3s; }
        .on .ic { background:var(--c); color:var(--fg); box-shadow:0 0 14px color-mix(in srgb,var(--c) 70%,transparent); }
        .n { font:700 13px/1.15 system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); text-align:center; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .s { font:500 11px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); } .on .s { color:color-mix(in srgb,var(--c) 80%,#fff); }
      </style><ha-card><div class="hd"><span class="lab">Lumières</span><span class="cnt"></span><button class="all">Tout éteindre</button></div>
        <div class="gs">${c.groups.map((g) => `<div class="gp"><div class="gt lab">${esc(g.title)}</div><div class="g">${g.rooms.map((r) => `<div class="r" data-i="${n++}"><div class="ic"><ha-icon icon="${r.icon}"></ha-icon></div><div class="n">${esc(r.name)}</div><div class="s">—</div></div>`).join('')}</div></div>`).join('')}</div></ha-card>`;
      this._rooms = [].concat(...c.groups.map((g) => g.rooms));
      this.qa('.r').forEach((el) => el.addEventListener('click', () => {
        const r = this._rooms[+el.dataset.i]; if (!this._hass || !(this._lights(r).length)) return;
        this._hass.callService('script', c.script.replace(/^script\./, ''), { area: r.area });
      }));
      this._alignInit();
      this.q('.all').addEventListener('click', () => {
        const on = this._on || []; if (!on.length || !window.confirm(`Éteindre ${on.length} lumière${on.length > 1 ? 's' : ''} ?`)) return;
        this._hass.callService('light', 'turn_off', { entity_id: on });
      });
    }

    _update() {
      const h = this._hass; let total = 0; const allOn = new Set();
      this.qa('.r').forEach((el) => {
        const r = this._rooms[+el.dataset.i], ls = this._lights(r), on = ls.filter((id) => { const s = h.states[id]; return s && s.state === 'on'; });
        on.forEach((id) => allOn.add(id)); total += on.length ? 1 : 0;
        el.classList.toggle('on', on.length > 0); el.classList.toggle('none', ls.length === 0);
        let rgb = null;
        for (const id of on) { const a = h.states[id].attributes; rgb = Array.isArray(a.rgb_color) ? bright(a.rgb_color) : a.color_temp_kelvin ? kelvin(a.color_temp_kelvin) : null; if (rgb) break; }
        rgb = rgb || hexToRgb(COL.amber); el.style.setProperty('--c', `rgb(${rgb.join(',')})`);
        el.style.setProperty('--fg', (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) < 150 ? '#fff' : '#14110a');
        el.querySelector('.s').textContent = ls.length === 0 ? 'Sans lumière' : on.length ? (ls.length > 1 ? `${on.length}/${ls.length} allumées` : 'Allumée') : 'Éteinte';
      });
      this._on = [...allOn];
      this.q('.cnt').innerHTML = total ? `<b>${total}</b> pièce${total > 1 ? 's' : ''} allumée${total > 1 ? 's' : ''}` : 'Tout est éteint';
      this.q('.all').disabled = !this._on.length;
    }
  }

  // ---------------------------------------------------------------------------------------- famille
  class FamilleCard extends Base {
    setConfig(c) { if (!c || !c.select) throw new Error('select requis'); this._cfg = c; this._built = false; }
    getCardSize() { return 5; }
    _build() {
      const c = this._cfg, b = c.buttons || [];
      this.shadowRoot.innerHTML = `<style>${BASE}
        .p { border-radius:18px; padding:10px 12px; background:var(--card-background-color,#101a30); border:1.5px solid rgba(120,150,200,.2); }
        .chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:7px; } .chip { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:99px; border:1.5px solid rgba(130,150,190,.3); background:rgba(130,150,190,.08); color:var(--primary-text-color,#dbe9ff); font:600 12.5px system-ui,sans-serif; transition:all .2s; --mdc-icon-size:15px; }
        .chip.sel { background:rgba(76,208,138,.22); border-color:#4cd08a; color:#fff; box-shadow:0 0 10px rgba(76,208,138,.35); }
        .msg { margin-top:8px; width:100%; height:42px; border-radius:14px; border:0; background:linear-gradient(135deg,#1f9d63,#4cd08a); color:#06210f; font:700 14px system-ui,sans-serif; display:flex; align-items:center; justify-content:center; gap:8px; --mdc-icon-size:20px; box-shadow:0 3px 10px rgba(60,200,130,.3); } .msg:active { transform:scale(.98); }
        .bs { display:grid; grid-template-columns:repeat(${Math.max(1, b.length)},1fr); gap:8px; margin-top:8px; }
        .b { --c:#ff9a4a; position:relative; display:flex; flex-direction:row; align-items:center; justify-content:center; gap:8px; padding:9px 6px; border-radius:14px; color:#fff; font:700 13px system-ui,sans-serif; --mdc-icon-size:22px; overflow:hidden; border:1.5px solid color-mix(in srgb,var(--c) 70%,transparent);
          background:linear-gradient(160deg,color-mix(in srgb,var(--c) 50%,#0b1224),color-mix(in srgb,var(--c) 12%,#0b1224)); box-shadow:0 0 14px color-mix(in srgb,var(--c) 28%,transparent); transition:transform .15s, box-shadow .3s; }
        .b:active { transform:scale(.95); } .b.hit { box-shadow:0 0 28px var(--c); } .b ha-icon { filter:drop-shadow(0 1px 3px rgba(0,0,0,.5)); } .b span { text-shadow:0 1px 3px rgba(0,0,0,.55); } .b small { font:600 10.5px system-ui,sans-serif; opacity:.9; }
      </style><ha-card><div class="p"><span class="lab">Envoyer à</span><div class="chips"></div>
        <button class="msg"><ha-icon icon="mdi:message-text-outline"></ha-icon>Envoyer un message</button>
        <div class="bs">${b.map((x, i) => `<button class="b" data-i="${i}" style="--c:${col(x.color)}"><ha-icon icon="${x.icon}"></ha-icon><span>${esc(x.name)}</span><small></small></button>`).join('')}</div></div></ha-card>`;
      this.q('.chips').addEventListener('click', (e) => { const ch = e.target.closest('.chip'); if (ch) this._hass.callService('input_select', 'select_option', { entity_id: c.select, option: ch.dataset.o }); });
      this.q('.msg').addEventListener('click', () => {
        if (c.message) this.dispatchEvent(new CustomEvent('ll-custom', { detail: { action: 'fire-dom-event', browser_mod: c.message }, bubbles: true, composed: true }));
      });
      this.qa('.b').forEach((el) => el.addEventListener('click', () => {
        const x = b[+el.dataset.i]; this._hass.callService('script', x.script.replace(/^script\./, ''), {});
        el.classList.add('hit'); el.querySelector('small').textContent = 'Envoyé ✓'; setTimeout(() => { el.classList.remove('hit'); el.querySelector('small').textContent = ''; }, 1800);
      }));
    }
    _update() {
      const c = this._cfg, s = this.st(c.select), opts = (s && s.attributes.options) || [], box = this.q('.chips'), key = opts.join('|');
      if (box.dataset.k !== key) { box.innerHTML = opts.map((o) => `<button class="chip" data-o="${esc(o)}"><ha-icon icon="${/famille/i.test(o) ? 'mdi:account-group' : 'mdi:account'}"></ha-icon>${esc(o)}</button>`).join(''); box.dataset.k = key; }
      this.qa('.chip').forEach((ch) => ch.classList.toggle('sel', !!s && ch.dataset.o === s.state));
    }
  }

  const reg = (n, k, name, description) => { if (!customElements.get(n)) customElements.define(n, k); window.customCards = window.customCards || []; window.customCards.push({ type: n, name, description }); };
  reg('maison-lumieres-card', LumieresCard, 'Lumières par pièce', 'Tuiles de pièces avec état réel et « Tout éteindre »');
  reg('maison-famille-card', FamilleCard, 'Famille', 'Destinataire, message et appels');
})();
