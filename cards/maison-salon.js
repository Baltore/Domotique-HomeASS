/* Carte « salon » : TV, barre de son et télécommande réunies dans une seule interface.
   Config : tv: { media, remote, name, icon }, bar: { media, name, icon } (optionnelle), collapse_remote: true (télécommande repliée derrière un bouton),
   apps: [{ name, icon, color, activity }] (lancement d'applis par la télécommande Sony) */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));   // valeurs de la config ou des entités : toujours échappées avant le HTML
  const OFF = ['off', 'unavailable', 'unknown', 'standby'];
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

  class MaisonSalonCard extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); }

    setConfig(c) {
      if (!c || !c.tv) throw new Error('tv requis');
      this._cfg = c; this._built = false;
    }

    set hass(h) { this._hass = h; if (!this._built) this._build(); this._update(); }
    getCardSize() { return 9; }
    getGridOptions() { return { columns: 12, rows: 'auto' }; }
    static getStubConfig() { return { tv: {}, bar: {} }; }


    // alignement par le bas de la colonne (option align_bottom, voir maison-align.js)
    _alignInit() {
      if (!this._cfg || !this._cfg.align_bottom) return;
      const go = () => { if (!window.__m3dAlign) { setTimeout(go, 300); return; } window.__m3dAlign.add(this, (e) => { const w = this.shadowRoot.querySelector('ha-card'); w.style.minHeight = ''; const h0 = w.offsetHeight; w.style.minHeight = `${h0 + e}px`; }); };
      go();
    }
    connectedCallback() { if (this._built) this._alignInit(); }

    _dev(k, d, color) {
      return `<div class="dev" data-k="${k}" style="--c:${esc(color)}">
        <div class="top"><div class="ic"><ha-icon icon="${esc(d.icon)}"></ha-icon></div><div class="tx"><div class="n">${esc(d.name)}</div><div class="s"></div></div>
          <button class="pw" data-a="power" data-k="${k}" aria-label="Marche / arrêt"><ha-icon icon="mdi:power"></ha-icon></button></div>
        <div class="vol"><button data-a="mute" data-k="${k}" aria-label="Muet"><ha-icon icon="mdi:volume-high"></ha-icon></button>
          <button data-a="vdown" data-k="${k}" aria-label="Volume moins"><ha-icon icon="mdi:volume-minus"></ha-icon></button>
          <input type="range" min="0" max="100" data-k="${k}" aria-label="Volume">
          <button data-a="vup" data-k="${k}" aria-label="Volume plus"><ha-icon icon="mdi:volume-plus"></ha-icon></button></div>
        <select data-k="${k}" aria-label="Source"></select></div>`;
    }

    _rb(cmd, icon, label, cls) {
      return `<button class="rb ${cls || ''}" data-cmd="${cmd}" aria-label="${label}"><ha-icon icon="${icon}"></ha-icon></button>`;
    }

    _build() {
      const c = this._cfg, apps = c.apps || [];
      this.shadowRoot.innerHTML = `<style>
        :host { display:block; }
        ha-card { padding:0; background:transparent; box-shadow:none; border:none; display:flex; flex-direction:column; } .devs { flex:1; }
        button { font:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
        .devs { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:10px; }
        .dev { --c:#4aa3ff; border-radius:20px; padding:12px 14px; background:var(--card-background-color,#101a30); border:1.5px solid rgba(120,150,200,.2); transition:all .3s; }
        .dev.on { border-color:var(--c); background:linear-gradient(135deg, color-mix(in srgb, var(--c) 22%, var(--card-background-color,#101a30)), var(--card-background-color,#101a30) 75%);
          box-shadow:0 0 18px color-mix(in srgb, var(--c) 35%, transparent); }
        .dev.unav { opacity:.5; }
        .top { display:flex; align-items:center; gap:12px; }
        .ic { flex:none; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; --mdc-icon-size:25px; background:rgba(130,150,190,.14); color:var(--secondary-text-color,#8fa3c4); transition:all .3s; }
        .on .ic { background:var(--c); color:#07121f; box-shadow:0 0 16px color-mix(in srgb, var(--c) 70%, transparent); }
        .tx { flex:1; min-width:0; }
        .n { font:700 15px/1.2 system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); }
        .s { margin-top:3px; font:500 12px/1.25 system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .on .s { color:color-mix(in srgb, var(--c) 75%, #fff); }
        .pw { flex:none; width:40px; height:40px; border-radius:50%; border:1.5px solid rgba(130,150,190,.35); background:rgba(130,150,190,.12); color:var(--secondary-text-color,#9aa4b5); --mdc-icon-size:22px; display:flex; align-items:center; justify-content:center; transition:all .25s; }
        .on .pw { background:var(--c); border-color:var(--c); color:#07121f; box-shadow:0 0 12px color-mix(in srgb, var(--c) 60%, transparent); }
        .vol { display:flex; align-items:center; gap:6px; margin-top:12px; }
        .vol button { flex:none; width:36px; height:34px; border-radius:11px; border:1px solid rgba(130,150,190,.28); background:rgba(130,150,190,.1); color:var(--primary-text-color,#cfe0ff); --mdc-icon-size:19px; display:flex; align-items:center; justify-content:center; }
        .vol input { flex:1; min-width:0; height:26px; margin:0; accent-color:var(--c); }
        select { width:100%; margin-top:10px; height:34px; border-radius:11px; border:1px solid rgba(130,150,190,.28); background:rgba(130,150,190,.1); color:var(--primary-text-color,#dbe9ff); padding:0 8px; font:13px system-ui,sans-serif; display:none; }
        .dev.on select.has { display:block; }
        .dev:not(.on) .vol, .dev.unav .vol { opacity:.4; pointer-events:none; }
        .mo { margin-top:10px; display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; border-radius:16px; border:1.5px solid rgba(110,180,255,.35); background:rgba(60,140,255,.1); color:#9fd8ff; font:700 14px system-ui,sans-serif; --mdc-icon-size:21px; cursor:pointer; } .mo.open ha-icon:last-child { transform:rotate(180deg); } .rem.hid { display:none; }
        .rem { margin-top:12px; border-radius:22px; padding:14px; background:var(--card-background-color,#101a30); border:1.5px solid rgba(120,150,200,.2); }
        .rh { display:flex; align-items:center; gap:8px; margin-bottom:12px; font:700 11px/1 system-ui,sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--secondary-text-color,#9aa4b5); }
        .rh ha-icon { --mdc-icon-size:16px; }
        .rb { height:44px; min-width:44px; border-radius:14px; border:1px solid rgba(130,150,190,.25); background:rgba(130,150,190,.1); color:var(--primary-text-color,#dbe9ff); --mdc-icon-size:22px; display:flex; align-items:center; justify-content:center; transition:transform .12s, background .2s; }
        .rb:active { transform:scale(.92); background:rgba(90,160,255,.35); }
        .rb.red { color:#ff7d7d; border-color:rgba(255,100,100,.4); }
        .main { display:flex; flex-wrap:wrap; gap:12px 14px; align-items:center; justify-content:center; }
        .pad { display:grid; grid-template-columns:repeat(3,48px); grid-template-rows:repeat(3,48px); gap:6px; padding:4px; width:fit-content; }
        .pad .rb { width:48px; height:48px; border-radius:15px; } .pad .ok { border-radius:50%; background:color-mix(in srgb, #4aa3ff 35%, transparent); border-color:#4aa3ff; font-weight:700; }
        .side { display:grid; grid-template-columns:repeat(2,48px); gap:8px; }
        .side .rb { height:48px; min-width:0; }
        .pill { display:flex; flex-direction:column; border-radius:18px; overflow:hidden; border:1px solid rgba(130,150,190,.25); background:rgba(130,150,190,.08); }
        .pill .rb { border:0; border-radius:0; background:transparent; height:46px; width:50px; } .pill .lab { text-align:center; font:700 10px system-ui,sans-serif; letter-spacing:.1em; color:var(--secondary-text-color,#9aa4b5); padding:2px 0; }
        .pills { display:flex; gap:10px; justify-content:center; }
        .row4 { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:12px; }
        .apps { display:grid; grid-template-columns:repeat(auto-fit,minmax(78px,1fr)); gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid rgba(130,150,190,.18); }
        .app { --c:#4aa3ff; display:flex; flex-direction:column; align-items:center; gap:5px; padding:10px 4px 8px; border-radius:16px; border:1px solid color-mix(in srgb, var(--c) 55%, transparent);
          background:linear-gradient(160deg, color-mix(in srgb, var(--c) 32%, transparent), color-mix(in srgb, var(--c) 6%, transparent)); color:var(--primary-text-color,#fff); --mdc-icon-size:26px; }
        .app:active { transform:scale(.93); } .app span { font:600 11.5px system-ui,sans-serif; } .app ha-icon { color:var(--c); filter:brightness(1.4); }
      </style><ha-card>
        <div class="devs">${this._dev('tv', Object.assign({ name: 'TV', icon: 'mdi:television' }, c.tv), '#4aa3ff')}${c.bar ? this._dev('bar', Object.assign({ name: 'Barre de son', icon: 'mdi:soundbar' }, c.bar), '#3cc4e8') : ''}</div>
        ${c.collapse_remote ? '<div class="mo"><ha-icon icon="mdi:remote-tv"></ha-icon><span>Télécommande</span><ha-icon icon="mdi:chevron-down"></ha-icon></div>' : ''}
        <div class="rem ${c.collapse_remote ? 'hid' : ''}"><div class="rh"><ha-icon icon="mdi:remote-tv"></ha-icon><span>Télécommande</span></div>
          <div class="main">
            <div class="pad"><span></span>${this._rb('DPAD_UP', 'mdi:chevron-up', 'Haut')}<span></span>${this._rb('DPAD_LEFT', 'mdi:chevron-left', 'Gauche')}${this._rb('DPAD_CENTER', 'mdi:circle-medium', 'OK', 'ok')}${this._rb('DPAD_RIGHT', 'mdi:chevron-right', 'Droite')}<span></span>${this._rb('DPAD_DOWN', 'mdi:chevron-down', 'Bas')}<span></span></div>
            <div class="side">${this._rb('BACK', 'mdi:undo-variant', 'Retour')}${this._rb('HOME', 'mdi:home', 'Accueil')}${this._rb('MENU', 'mdi:menu', 'Menu')}${this._rb('MEDIA_PLAY_PAUSE', 'mdi:play-pause', 'Lecture / pause')}</div>
            <div class="pills"><div class="pill">${this._rb('VOLUME_UP', 'mdi:plus', 'Volume +')}<div class="lab">VOL</div>${this._rb('VOLUME_DOWN', 'mdi:minus', 'Volume −')}</div>
              <div class="pill">${this._rb('CHANNEL_UP', 'mdi:chevron-up', 'Chaîne +')}<div class="lab">CH</div>${this._rb('CHANNEL_DOWN', 'mdi:chevron-down', 'Chaîne −')}</div></div>
          </div>
          <div class="row4">${this._rb('TV_INPUT', 'mdi:import', 'Entrée')}${this._rb('TV_CONTENTS_MENU', 'mdi:wrench', 'Outils')}${this._rb('GUIDE', 'mdi:format-list-bulleted', 'Guide')}${this._rb('VOLUME_MUTE', 'mdi:volume-off', 'Muet')}</div>
          ${apps.length ? `<div class="apps">${apps.map((a, i) => `<button class="app" data-app="${i}" style="--c:${esc(a.color || '#4aa3ff')}"><ha-icon icon="${esc(a.icon)}"></ha-icon><span>${esc(a.name)}</span></button>`).join('')}</div>` : ''}
        </div></ha-card>`;
      const root = this.shadowRoot, h = () => this._hass;
      root.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b || !h()) return;
        if (b.dataset.cmd) { h().callService('remote', 'send_command', { entity_id: c.tv.remote, command: b.dataset.cmd }); return; }
        if (b.dataset.app) { const a = apps[+b.dataset.app]; h().callService('remote', 'turn_on', { entity_id: c.tv.remote, activity: a.activity }); return; }
        const k = b.dataset.k, id = (k === 'tv' ? c.tv : c.bar).media, s = h().states[id], on = s && !OFF.includes(s.state);
        const mp = (svc, data) => h().callService('media_player', svc, Object.assign({ entity_id: id }, data || {}));
        if (b.dataset.a === 'power') mp(on ? 'turn_off' : 'turn_on');
        else if (b.dataset.a === 'mute') { if (k === 'tv') h().callService('remote', 'send_command', { entity_id: c.tv.remote, command: 'VOLUME_MUTE' }); else mp('volume_mute', { is_volume_muted: !(s && s.attributes.is_volume_muted) }); }
        else if (b.dataset.a === 'vup') mp('volume_up');
        else if (b.dataset.a === 'vdown') mp('volume_down');
      });
      const mo = root.querySelector('.mo'); if (mo) mo.addEventListener('click', () => { mo.classList.toggle('open'); root.querySelector('.rem').classList.toggle('hid'); });
      root.querySelectorAll('input[type=range]').forEach((inp) => {
        inp.addEventListener('input', () => { this._busy = Date.now() + 2000; });
        inp.addEventListener('change', () => { const k = inp.dataset.k, id = (k === 'tv' ? c.tv : c.bar).media; this._hass.callService('media_player', 'volume_set', { entity_id: id, volume_level: +inp.value / 100 }); this._busy = Date.now() + 800; });
      });
      root.querySelectorAll('select').forEach((sel) => sel.addEventListener('change', () => {
        const k = sel.dataset.k, id = (k === 'tv' ? c.tv : c.bar).media; this._hass.callService('media_player', 'select_source', { entity_id: id, source: sel.value }); this._busy = Date.now() + 1500;
      }));
      this._built = true; this._alignInit();
    }

    _update() {
      const h = this._hass; if (!h || !this._built) return;
      [['tv', this._cfg.tv], ['bar', this._cfg.bar]].filter(([, d]) => d).forEach(([k, d]) => {
        const el = this.shadowRoot.querySelector(`.dev[data-k="${k}"]`), s = h.states[d.media];
        const st = s ? s.state : 'unavailable', on = !OFF.includes(st), at = (s && s.attributes) || {};
        el.classList.toggle('on', on); el.classList.toggle('unav', st === 'unavailable');
        let sub = st === 'unavailable' ? 'Indisponible' : on ? (at.media_title || at.app_name || at.source || (st === 'playing' ? 'Lecture' : 'Allumée')) : 'Éteinte';
        el.querySelector('.s').textContent = sub;
        const v = num(at.volume_level), inp = el.querySelector('input');
        inp.style.visibility = v === null ? 'hidden' : 'visible';
        if (v !== null && !(this._busy && this._busy > Date.now())) inp.value = Math.round(v * 100);
        el.querySelector('.vol button ha-icon').setAttribute('icon', at.is_volume_muted ? 'mdi:volume-off' : 'mdi:volume-high');
        const sel = el.querySelector('select'), list = Array.isArray(at.source_list) ? at.source_list : [];
        sel.classList.toggle('has', list.length > 0);
        const key = list.join('|');
        if (sel.dataset.key !== key) { sel.innerHTML = list.map((x) => `<option>${esc(x)}</option>`).join(''); sel.dataset.key = key; }
        if (at.source && !(this._busy && this._busy > Date.now())) sel.value = at.source;
      });
    }
  }

  if (!customElements.get('maison-salon-card')) customElements.define('maison-salon-card', MaisonSalonCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'maison-salon-card', name: 'Salon (TV, barre de son, télécommande)', description: 'TV, barre de son et télécommande réunies' });
})();
