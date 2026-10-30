/* Cartes des onglets Système et Électroménager.
   - custom:maison-debit-card   : tests de débit (jauges), débit en direct de la box internet
   - custom:maison-sante-card   : bandeau d'état + lignes (sauvegardes, alimentation…) avec alertes
   - custom:maison-encre-card   : réservoirs d'encre verticaux
   - custom:maison-maj-card     : mises à jour disponibles (installer / voir), « tout est à jour » sinon
   - custom:maison-frigo-card   : compartiment (température, consigne +/-, porte, boost) ou glaçons + filtre à eau */
(() => {
  const COL = { amber: '#ffb84a', blue: '#4aa3ff', green: '#4cd08a', cyan: '#3cc4e8', purple: '#a98bff', pink: '#ff7ab8', red: '#ff5a5a', orange: '#ff9a4a', teal: '#35c9b8' };
  const col = (c) => COL[c] || c || COL.blue;
  const BAD = ['unavailable', 'unknown', 'none', ''];
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
  const fr = (n, d = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: d });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const relPast = (d) => {
    const m = Math.round((Date.now() - d.getTime()) / 60000);
    if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
    const j = Math.floor(h / 24); return j === 1 ? 'hier' : `il y a ${j} jours`;
  };
  const when = (d) => {
    const t = new Date(), tm = new Date(Date.now() + 864e5), hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === t.toDateString()) return `aujourd'hui ${hm}`; if (d.toDateString() === tm.toDateString()) return `demain ${hm}`;
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + hm;
  };

  const BASE = `
    :host { display:block; } ha-card { padding:0; background:transparent; box-shadow:none; border:none; }
    button { font:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
    .panel { border-radius:20px; padding:14px; background:var(--card-background-color,#101a30); border:1.5px solid rgba(120,150,200,.2); }
    .lab { font:700 10.5px/1 system-ui,sans-serif; letter-spacing:.12em; text-transform:uppercase; color:var(--secondary-text-color,#9aa4b5); }
    .v { font:700 24px/1.1 system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); } .v small { font:600 12px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); margin-left:3px; }
    .sub { font:500 12.5px/1.3 system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); }
    .pill { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:99px; font:700 12.5px system-ui,sans-serif; --mdc-icon-size:17px; }
    .pill.ok, .bn.ok { background:rgba(60,220,150,.16); color:#7df0b8; } .pill.info { background:rgba(60,170,255,.18); color:#8fdcff; } .pill.warn, .bn.warn { background:rgba(255,190,90,.18); color:#ffd08a; } .pill.bad, .bn.bad { background:rgba(255,100,100,.18); color:#ff9b9b; }
    .sw { flex:none; width:46px; height:28px; border-radius:14px; background:rgba(130,150,190,.28); position:relative; transition:background .3s; }
    .sw i { position:absolute; left:3px; top:3px; width:22px; height:22px; border-radius:50%; background:#cfd8ee; box-shadow:0 1px 4px rgba(0,0,0,.45); transition:transform .25s, background .25s; }
    .sw.on { background:var(--c,#4aa3ff); } .sw.on i { transform:translateX(18px); background:#fff; }
  `;

  class Base extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    set hass(h) { this._hass = h; if (!this._built) { this._build(); this._built = true; } this._update(); }
    getGridOptions() { return { columns: 12, rows: 'auto' }; }
    st(id) { return this._hass && this._hass.states ? this._hass.states[id] : undefined; }
    val(id) { const s = this.st(id); return s && !BAD.includes(s.state) ? s.state : null; }
    more(id) { this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: id }, bubbles: true, composed: true })); }
    call(d, s, data) { this._hass.callService(d, s, data); }
    q(sel) { return this.shadowRoot.querySelector(sel); }
    qa(sel) { return [...this.shadowRoot.querySelectorAll(sel)]; }
  }

  // ---------------------------------------------------------------------------------------- débit internet
  class DebitCard extends Base {
    setConfig(c) { if (!c || !Array.isArray(c.tests)) throw new Error('tests requis'); this._cfg = c; this._built = false; }
    getCardSize() { return 4; }
    _build() {
      const c = this._cfg, cp = !!c.compact;
      this.shadowRoot.innerHTML = `<style>${BASE}
        .g { display:grid; grid-template-columns:repeat(${c.tests.length},minmax(0,1fr)); gap:${cp ? 8 : 10}px; }
        ${cp ? '.t ha-icon { display:none; } .t .v { margin:3px 0 2px !important; font-size:17px !important; } .t { padding:8px 10px !important; border-radius:14px !important; } .bar { margin-top:5px !important; } .lv { margin-top:8px !important; padding:8px 10px !important; border-radius:14px !important; gap:8px !important; } .lv > ha-icon, .lv .tx b { display:none; } .lv .sp { font-size:13px !important; gap:10px !important; }' : ''}
        .xt { display:flex; align-items:center; gap:5px; padding:4px 9px; border-radius:99px; background:rgba(130,150,190,.12); font:600 11.5px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); white-space:nowrap; --mdc-icon-size:15px; cursor:pointer; } .xt.warn { color:#ffd08a; background:rgba(255,190,90,.16); }
        .t { --c:#4aa3ff; padding:12px; border-radius:18px; cursor:pointer; background:linear-gradient(135deg,color-mix(in srgb,var(--c) 16%,var(--card-background-color,#101a30)),var(--card-background-color,#101a30) 70%); border:1.5px solid color-mix(in srgb,var(--c) 40%,transparent); }
        .t ha-icon { --mdc-icon-size:22px; color:var(--c); } .t .v { margin:8px 0 6px; font-size:21px; white-space:nowrap; } .bar { height:5px; border-radius:5px; background:rgba(130,150,190,.2); overflow:hidden; margin-top:8px; } .bar i { display:block; height:100%; border-radius:5px; background:var(--c); transition:width .6s; box-shadow:0 0 8px var(--c); }
        .lv { margin-top:10px; display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:18px; background:rgba(130,150,190,.08); --mdc-icon-size:22px; }
        .lv > ha-icon { color:var(--secondary-text-color,#9aa4b5); } .lv .tx { flex:1; min-width:0; } .lv .tx b { display:block; font:700 14px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); margin-bottom:3px; }
        .lv .sp { display:flex; gap:14px; font:700 15px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); white-space:nowrap; } .lv .sp small { font:600 11px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); }
        .w { display:flex; flex-direction:column; } .lv { order:${c.live_first ? -1 : 1}; ${c.live_first ? 'margin:0 0 8px !important;' : ''} }
      </style><ha-card><div class="w"><div class="g">${c.tests.map((t, i) => `<div class="t" data-i="${i}" style="--c:${col(t.color)}"><ha-icon icon="${t.icon}"></ha-icon><div class="v">—</div><span class="lab">${esc(t.name)}</span><div class="bar"><i></i></div></div>`).join('')}</div>
        ${c.live ? `<div class="lv"><ha-icon icon="mdi:router-wireless"></ha-icon><div class="tx"><b>${esc(c.live.name || 'Box internet')}</b><span class="pill info st">—</span></div><div class="sp"><span class="dn">↓ —</span><span class="up">↑ —</span></div>${(c.extra || []).map((x, i) => `<span class="xt" data-x="${i}"><ha-icon icon="${x.icon}"></ha-icon><span></span></span>`).join('')}</div>` : ''}</div></ha-card>`;
      this.qa('.xt').forEach((el) => el.addEventListener('click', () => this.more(c.extra[+el.dataset.x].entity)));
      this.qa('.t').forEach((el) => el.addEventListener('click', () => this.more(c.tests[+el.dataset.i].entity)));
    }
    _update() {
      const c = this._cfg;
      this.qa('.t').forEach((el) => {
        const t = c.tests[+el.dataset.i], n = num(this.val(t.entity)), s = this.st(t.entity), u = t.unit || (s && s.attributes.unit_of_measurement) || '';
        el.querySelector('.v').innerHTML = n === null ? '—' : `${fr(n, n < 100 ? 1 : 0)}<small>${esc(u)}</small>`;
        let p = n === null ? 0 : t.invert ? Math.max(0, 100 - n / (t.max || 100) * 100) : Math.min(100, n / (t.max || 1000) * 100);
        el.querySelector('.bar i').style.width = `${p}%`;
      });
      if (c.live) {
        const w = c.live.wan && this.st(c.live.wan), up = w && w.state === 'on', pill = this.q('.st');
        pill.textContent = up ? 'Connectée' : w ? 'Hors ligne' : 'Inconnue'; pill.className = `pill ${up ? 'ok' : w ? 'bad' : 'warn'} st`;
        const sp = (id) => { const s = this.st(id), n = s && num(s.state); return n === null || n === undefined ? '—' : `${fr(s.attributes.unit_of_measurement === 'MB/s' ? n * 8 : n, 1)} <small>Mb/s</small>`; };
        this.q('.dn').innerHTML = `↓ ${sp(c.live.down)}`; this.q('.up').innerHTML = `↑ ${sp(c.live.up)}`;
        this.qa('.xt').forEach((el) => { const x = (c.extra || [])[+el.dataset.x], v = this.st(x.entity); let t = '—', w = false;
          const raw = v && (x.attr ? v.attributes[x.attr] : v.state);
          if (raw && !BAD.includes(raw)) { const d = new Date(raw); t = `${x.label || ''} ${relPast(d)}`.trim(); w = x.warn_h && (Date.now() - d.getTime()) / 36e5 > x.warn_h; } el.querySelector('span').textContent = t; el.classList.toggle('warn', !!w); });
      }
    }
  }

  // ---------------------------------------------------------------------------------------- santé / sauvegardes
  class SanteCard extends Base {
    setConfig(c) { if (!c || !Array.isArray(c.rows)) throw new Error('rows requis'); this._cfg = c; this._built = false; }
    getCardSize() { return 5; }
    _build() {
      const c = this._cfg;
      this.shadowRoot.innerHTML = `<style>${BASE}
        .bn { display:flex; align-items:center; gap:12px; padding:14px; border-radius:18px; --mdc-icon-size:28px; margin-bottom:10px; } .bn b { display:block; font:700 16px system-ui,sans-serif; } .bn span { font:500 12.5px system-ui,sans-serif; opacity:.85; }
        .rw { display:flex; align-items:center; gap:12px; padding:11px 4px; cursor:pointer; --mdc-icon-size:21px; } .rw + .rw { border-top:1px solid rgba(130,150,190,.14); }
        .rw .ic { flex:none; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(130,150,190,.14); color:var(--secondary-text-color,#9aa4b5); }
        .rw.ok .ic { background:rgba(60,220,150,.16); color:#7df0b8; } .rw.warn .ic { background:rgba(255,190,90,.18); color:#ffd08a; } .rw.bad .ic { background:rgba(255,100,100,.18); color:#ff9b9b; }
        .rw .tx { flex:1; min-width:0; font:600 14px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); } .rw .tx small { display:block; margin-top:2px; font:500 12px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); }
        .rw .r { font:700 13px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); text-align:right; white-space:nowrap; } .rw.warn .r { color:#ffd08a; } .rw.bad .r { color:#ff9b9b; } .rw.ok .r { color:#7df0b8; }
      </style><ha-card><div class="panel"><div class="bn"><ha-icon></ha-icon><div><b></b><span></span></div></div>
        ${c.rows.map((r, i) => `<div class="rw" data-i="${i}"><div class="ic"><ha-icon icon="${r.icon}"></ha-icon></div><div class="tx">${esc(r.label)}<small></small></div><div class="r"></div></div>`).join('')}</div></ha-card>`;
      this.qa('.rw').forEach((el) => el.addEventListener('click', () => this.more(c.rows[+el.dataset.i].entity)));
    }
    _update() {
      const c = this._cfg; let worst = 'ok', msg = '';
      this.qa('.rw').forEach((el) => {
        const r = c.rows[+el.dataset.i], s = this.st(r.entity); let k = '', t = '—', sub = '';
        if (r.fmt === 'problem') { if (s && s.state !== 'unavailable') { const bad = s.state === 'on'; k = bad ? 'bad' : 'ok'; t = bad ? (r.bad || 'Problème') : (r.ok || 'OK'); } }
        else if (r.tpl) { if (s && s.state !== 'unavailable') { t = r.tpl.replace(/\{(\w+)\}/g, (m, a) => (s.attributes[a] != null ? s.attributes[a] : '—')); k = r.ok_state ? (s.state === r.ok_state ? 'ok' : 'warn') : ''; } }
        else if (s && !BAD.includes(r.attr ? (s.attributes[r.attr] || '') : s.state)) {
          const d = new Date(r.attr ? s.attributes[r.attr] : s.state);
          if (r.fmt === 'ago') { const h = (Date.now() - d.getTime()) / 36e5; t = relPast(d); sub = d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); k = r.warn_h && h > r.warn_h ? (h > r.warn_h * 2 ? 'bad' : 'warn') : 'ok'; }
          else if (r.fmt === 'when') { t = when(d); }
        } else if (r.fmt === 'when') { t = 'Non planifiée'; }
        el.className = `rw ${k}`; el.querySelector('.r').textContent = t; el.querySelector('small').textContent = sub;
        if (r.count !== false) { if (k === 'bad') worst = 'bad'; else if (k === 'warn' && worst !== 'bad') worst = 'warn'; if (k && k !== 'ok' && !msg) msg = `${r.label} : ${t}`; }
      });
      const bn = this.q('.bn'), T = { ok: ['mdi:check-circle', 'Tout est en ordre', 'Aucune alerte sur le système', 'ok'], warn: ['mdi:alert', 'À surveiller', msg, 'warn'], bad: ['mdi:alert-circle', 'Attention', msg, 'bad'] }[worst];
      bn.className = `bn ${T[3]}`; bn.querySelector('ha-icon').setAttribute('icon', T[0]); bn.querySelector('b').textContent = T[1]; bn.querySelector('span').textContent = T[2];
    }
  }

  // ---------------------------------------------------------------------------------------- encre
  class EncreCard extends Base {
    setConfig(c) { if (!c || !Array.isArray(c.items)) throw new Error('items requis'); this._cfg = c; this._built = false; }
    getCardSize() { return 4; }

    // alignement par le bas de la colonne (option align_bottom, voir maison-align.js)
    _alignInit() {
      if (!this._cfg || !this._cfg.align_bottom) return;
      const go = () => { if (!window.__m3dAlign) { setTimeout(go, 300); return; } window.__m3dAlign.add(this, (e) => { const w = this.shadowRoot.querySelector('ha-card'); w.style.minHeight = ''; const h0 = w.offsetHeight; w.style.minHeight = `${h0 + e}px`; }); };
      go();
    }
    connectedCallback() { if (this._built) this._alignInit(); }

    _build() {
      const c = this._cfg, cp = !!c.compact;
      this.shadowRoot.innerHTML = `<style>${BASE}
        ha-card { display:flex; } .panel { flex:1; display:flex; flex-direction:column; justify-content:center; }
        ${cp ? '.panel { padding:10px 12px !important; } .hd { display:none !important; } .cup { height:8px !important; max-width:none !important; width:100% !important; border-radius:6px !important; border-width:1px !important; } .cup i { top:0; right:auto !important; height:100%; bottom:0; box-shadow:0 0 8px var(--c) !important; } .k { gap:5px !important; } .k span { order:0; } .cup { order:1; } .k b { order:2; font-size:14px !important; } .tk { gap:12px !important; }' : ''}
        .hd { display:flex; align-items:center; gap:12px; margin-bottom:14px; --mdc-icon-size:24px; } .hd .ic { width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(60,170,255,.16); color:#8fdcff; } .hd b { flex:1; font:700 16px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); }
        .tk { display:grid; grid-template-columns:repeat(${c.items.length},1fr); gap:10px; } .k { --c:#888; display:flex; flex-direction:column; align-items:center; gap:7px; cursor:pointer; }
        .cup { position:relative; width:100%; max-width:64px; height:116px; border-radius:14px 14px 18px 18px; border:2px solid color-mix(in srgb,var(--c) 55%,transparent); background:rgba(130,150,190,.1); overflow:hidden; }
        .cup i { position:absolute; left:0; right:0; bottom:0; background:linear-gradient(180deg,var(--c),color-mix(in srgb,var(--c) 65%,#000)); transition:height .8s; box-shadow:0 0 14px var(--c); }
        .k b { font:700 15px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); } .k.low b { color:#ff9b9b; } .k span { font:600 11.5px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); }
      </style><ha-card><div class="panel"><div class="hd"><div class="ic"><ha-icon icon="mdi:printer"></ha-icon></div><b>${esc(c.name || 'Imprimante')}</b><span class="pill info st">—</span></div>
        <div class="tk">${c.items.map((it, i) => `<div class="k" data-i="${i}" style="--c:${col(it.color)}"><div class="cup"><i style="${cp ? 'width:0' : 'height:0'}"></i></div><b>—</b><span>${esc(it.name)}</span></div>`).join('')}</div></div></ha-card>`;
      this.qa('.k').forEach((el) => el.addEventListener('click', () => this.more(c.items[+el.dataset.i].entity)));
      this._alignInit();
    }
    _update() {
      const c = this._cfg, s = c.state && this.st(c.state), P = { idle: ['Prête', 'ok'], printing: ['Impression en cours', 'info'], stopped: ['Arrêtée', 'warn'], unavailable: ['Hors ligne', 'bad'] }, [lab, k] = s ? (P[s.state] || [s.state, 'info']) : ['—', 'info'];
      const pill = this.q('.st'); pill.textContent = lab; pill.className = `pill ${k} st`;
      this.qa('.k').forEach((el) => { const it = c.items[+el.dataset.i], n = num(this.val(it.entity)), low = n !== null && n < 15;
        el.querySelector('i').style[c.compact ? 'width' : 'height'] = `${n === null ? 0 : Math.max(2, Math.min(100, n))}%`; el.querySelector('b').textContent = n === null ? '—' : `${fr(n)} %`; el.classList.toggle('low', low); });
    }
  }

  // ---------------------------------------------------------------------------------------- mises à jour
  class MajCard extends Base {
    setConfig(c) { this._cfg = c || {}; this._built = false; }
    getCardSize() { return 4; }
    _build() {
      this.shadowRoot.innerHTML = `<style>${BASE}
        .bn { display:flex; align-items:center; gap:12px; padding:14px; border-radius:18px; --mdc-icon-size:28px; } .bn b { display:block; font:700 16px system-ui,sans-serif; } .bn span { font:500 12.5px system-ui,sans-serif; opacity:.85; }
        .ls { margin-top:10px; display:flex; flex-direction:column; gap:8px; }
        .u { display:flex; align-items:center; gap:10px; padding:11px 12px; border-radius:16px; background:rgba(255,190,90,.08); border:1px solid rgba(255,190,90,.3); }
        .u .tx { flex:1; min-width:0; } .u .tx b { display:block; font:700 14px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .u .tx span { font:500 12px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); }
        .u button { height:36px; padding:0 14px; border-radius:11px; border:1px solid rgba(130,150,190,.3); background:rgba(130,150,190,.1); color:var(--primary-text-color,#dbe9ff); font:700 13px system-ui,sans-serif; } .u button.go { background:linear-gradient(135deg,#1f7fe0,#35c9b8); border-color:transparent; color:#fff; }
        .ft { margin-top:10px; text-align:center; font:500 12px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); }
      </style><ha-card><div class="bn"><ha-icon></ha-icon><div><b></b><span></span></div></div><div class="ls"></div><div class="ft"></div></ha-card>`;
      this.shadowRoot.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b || !this._hass) return; const id = b.dataset.id;
        if (b.dataset.a === 'info') this.more(id);
        else if (b.dataset.a === 'inst') { const s = this.st(id), n = (s && (s.attributes.title || s.attributes.friendly_name)) || id; if (window.confirm(`Installer la mise à jour de « ${n} » ?`)) this.call('update', 'install', { entity_id: id }); }
      });
    }
    _update() {
      const ups = Object.values(this._hass.states).filter((s) => s.entity_id.startsWith('update.')), on = ups.filter((s) => s.state === 'on');
      const bn = this.q('.bn'), k = on.length ? 'warn' : 'ok';
      bn.className = `bn ${k}`; bn.querySelector('ha-icon').setAttribute('icon', on.length ? 'mdi:package-up' : 'mdi:check-decagram');
      bn.querySelector('b').textContent = on.length ? `${on.length} mise${on.length > 1 ? 's' : ''} à jour disponible${on.length > 1 ? 's' : ''}` : 'Tout est à jour';
      bn.querySelector('span').textContent = on.length ? 'Pense à faire une sauvegarde avant d\'installer' : `${ups.length} éléments suivis (HA, modules, intégrations)`;
      this.q('.ls').innerHTML = on.map((s) => { const a = s.attributes, n = String(a.title || a.friendly_name || s.entity_id).replace(/ (mise à jour|update)$/i, ''), busy = a.in_progress;
        return `<div class="u"><div class="tx"><b>${esc(n)}</b><span>${esc(a.installed_version || '?')} → ${esc(a.latest_version || '?')}</span></div>
          <button data-a="info" data-id="${esc(s.entity_id)}">Voir</button>${busy ? '<span class="pill info">En cours…</span>' : `<button class="go" data-a="inst" data-id="${esc(s.entity_id)}">Installer</button>`}</div>`; }).join('');
      this.q('.ft').textContent = '';
    }
  }

  // ---------------------------------------------------------------------------------------- frigo / glaçons
  class FrigoCard extends Base {
    setConfig(c) { if (!c) throw new Error('config requise'); this._cfg = c; this._built = false; }
    getCardSize() { return 5; }
    _buildCompact() {
      const c = this._cfg, cells = [['f', c.fridge], ['z', c.freezer]];
      this.shadowRoot.innerHTML = `<style>${BASE}
        .g { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; } .m { --c:#4aa3ff; padding:9px 10px; border-radius:14px; cursor:pointer; background:linear-gradient(135deg,color-mix(in srgb,var(--c) 16%,var(--card-background-color,#101a30)),var(--card-background-color,#101a30) 70%); border:1.5px solid color-mix(in srgb,var(--c) 40%,transparent); }
        .m .v { font-size:24px; color:var(--c); margin:3px 0 4px; text-shadow:0 0 12px color-mix(in srgb,var(--c) 45%,transparent); white-space:nowrap; } .m .v small { font-size:12px; } .m .dr { font:600 11px system-ui,sans-serif; color:#7df0b8; display:flex; align-items:center; gap:5px; } .m .dr.open { color:#ffd08a; } .m .dr::before { content:''; width:7px; height:7px; border-radius:50%; background:currentColor; }
      </style><ha-card><div class="g">${cells.map(([k, x]) => `<div class="m" data-k="${k}" style="--c:${col(x.color)}"><span class="lab">${esc(x.name)}</span><div class="v">—</div><div class="dr">—</div></div>`).join('')}
        <div class="m" data-k="p" style="--c:${col('amber')}"><span class="lab">Puissance</span><div class="v">—</div><div class="dr" style="color:var(--secondary-text-color,#9aa4b5)">Consommation</div></div></div></ha-card>`;
      this.qa('.m').forEach((el) => el.addEventListener('click', () => this.more({ f: c.fridge.temp, z: c.freezer.temp, p: c.power }[el.dataset.k])));
    }

    _updateCompact() {
      const c = this._cfg;
      this.qa('.m').forEach((el) => {
        const k = el.dataset.k;
        if (k === 'p') { const n = num(this.val(c.power)); el.querySelector('.v').innerHTML = n === null ? '—' : `${fr(n)}<small> W</small>`; return; }
        const x = k === 'f' ? c.fridge : c.freezer, n = num(this.val(x.temp)), d = this.st(x.door), op = d && d.state === 'on';
        el.querySelector('.v').innerHTML = n === null ? '—' : `${fr(n, 1)}<small> °C</small>`; const dr = el.querySelector('.dr'); dr.textContent = d && d.state !== 'unavailable' ? (op ? 'Porte ouverte' : 'Porte fermée') : '—'; dr.classList.toggle('open', !!op);
      });
    }

    _build() {
      if (this._cfg.kind === 'compact') return this._buildCompact();
      const c = this._cfg, ice = c.kind === 'ice';
      this.shadowRoot.innerHTML = `<style>${BASE}
        .hd { display:flex; align-items:center; gap:12px; --mdc-icon-size:26px; } .hd .ic { width:46px; height:46px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:color-mix(in srgb,var(--c) 22%,transparent); color:var(--c); } .hd b { flex:1; font:700 17px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); }
        .panel { --c:${col(c.color)}; } .big { margin:14px 0 4px; text-align:center; } .big .v { font-size:54px; letter-spacing:-.02em; color:var(--c); text-shadow:0 0 18px color-mix(in srgb,var(--c) 50%,transparent); } .big .v small { font-size:22px; }
        .big .sub { margin-top:2px; }
        .sp { display:flex; align-items:center; justify-content:center; gap:14px; margin:12px 0; } .sp button { width:46px; height:46px; border-radius:50%; border:1.5px solid color-mix(in srgb,var(--c) 50%,transparent); background:rgba(130,150,190,.1); color:var(--c); --mdc-icon-size:24px; display:flex; align-items:center; justify-content:center; } .sp button:active { background:color-mix(in srgb,var(--c) 35%,transparent); }
        .sp div { min-width:110px; text-align:center; } .sp .v { font-size:22px; }
        .tog { display:flex; align-items:center; gap:12px; padding:12px; border-radius:16px; cursor:pointer; background:rgba(130,150,190,.08); border:1.5px solid rgba(130,150,190,.2); transition:all .3s; --mdc-icon-size:22px; } .tog + .tog { margin-top:8px; } .tog > ha-icon { color:var(--secondary-text-color,#9aa4b5); }
        .tog.on { border-color:var(--c); background:color-mix(in srgb,var(--c) 14%,transparent); } .tog.on > ha-icon { color:var(--c); } .tog b { flex:1; font:600 14px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); } .tog b small { display:block; margin-top:2px; font:500 11.5px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); }
        .ring { display:flex; align-items:center; gap:16px; margin:14px 0 6px; } .ring svg { width:84px; height:84px; transform:rotate(-90deg); overflow:visible; flex:none; } .ring circle { fill:none; stroke-width:4.4; stroke-linecap:round; } .ring .bg { stroke:rgba(130,150,190,.2); } .ring .fg { stroke:var(--c); transition:stroke-dasharray .8s; filter:drop-shadow(0 0 3px var(--c)); }
        .ring .tx b { display:block; font:700 24px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); } .rst { margin-top:10px; width:100%; height:42px; border-radius:13px; border:1px dashed rgba(130,150,190,.4); background:rgba(130,150,190,.06); color:var(--secondary-text-color,#9aa4b5); font:600 13px system-ui,sans-serif; }
      </style><ha-card><div class="panel"><div class="hd"><div class="ic"><ha-icon icon="${c.icon}"></ha-icon></div><b>${esc(c.name)}</b><span class="pill info door">—</span></div>
        ${ice ? `<div class="ring"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" class="bg"/><circle cx="22" cy="22" r="18" class="fg" pathLength="100" stroke-dasharray="0 100"/></svg><div class="tx"><b class="fv">—</b><span class="sub">Usure du filtre à eau</span><div class="sub fs"></div></div></div>
          ${(c.toggles || []).map((t, i) => `<div class="tog" data-t="${i}"><ha-icon icon="${t.icon}"></ha-icon><b>${esc(t.name)}${t.hint ? `<small>${esc(t.hint)}</small>` : ''}</b><div class="sw"><i></i></div></div>`).join('')}
          <button class="rst">Réinitialiser le compteur du filtre</button>`
        : `<div class="big"><div class="v">—</div><div class="sub">Température actuelle</div></div>
          <div class="sp"><button data-d="-1" aria-label="Moins"><ha-icon icon="mdi:minus"></ha-icon></button><div><span class="lab">Consigne</span><div class="v spv">—</div></div><button data-d="1" aria-label="Plus"><ha-icon icon="mdi:plus"></ha-icon></button></div>
          ${c.boost ? `<div class="tog" data-t="0"><ha-icon icon="${c.boost.icon}"></ha-icon><b>${esc(c.boost.name)}<small>${esc(c.boost.hint || '')}</small></b><div class="sw"><i></i></div></div>` : ''}`}
      </div></ha-card>`;
      this.qa('.tog').forEach((el) => el.addEventListener('click', () => { const t = ice ? c.toggles[+el.dataset.t] : c.boost; this.call('homeassistant', 'toggle', { entity_id: t.entity }); }));
      this.qa('.sp button').forEach((b) => b.addEventListener('click', () => {
        const s = this.st(c.setpoint); if (!s || BAD.includes(s.state)) return; const a = s.attributes, step = a.step || 1;
        const v = Math.max(a.min, Math.min(a.max, num(s.state) + (+b.dataset.d) * step)); this.call('number', 'set_value', { entity_id: c.setpoint, value: v }); this._busy = Date.now() + 1500; this._sv = v; this._update();
      }));
      const rst = this.q('.rst'); if (rst) rst.addEventListener('click', () => { if (window.confirm('Réinitialiser le compteur du filtre à eau (filtre neuf installé) ?')) this.call('button', 'press', { entity_id: c.reset }); });
      const hd = this.q('.hd'); hd.style.cursor = 'pointer'; hd.addEventListener('click', () => this.more(c.temp || c.filter));
    }
    _update() {
      if (this._cfg.kind === 'compact') return this._updateCompact();
      const c = this._cfg, ice = c.kind === 'ice', d = c.door && this.st(c.door), pill = this.q('.door');
      pill.textContent = !d || d.state === 'unavailable' ? 'Porte ?' : d.state === 'on' ? 'Porte ouverte' : 'Porte fermée'; pill.className = `pill ${d && d.state === 'on' ? 'warn' : 'ok'} door`;
      if (ice) {
        const n = num(this.val(c.filter)), st = c.filter_state && this.st(c.filter_state);
        this.q('.fv').textContent = n === null ? '—' : `${fr(n)} %`; this.q('.fg').setAttribute('stroke-dasharray', `${n === null ? 0 : Math.min(100, n)} 100`);
        this.q('.fs').textContent = st && st.state === 'on' ? 'À remplacer' : 'Filtre en bon état';
        this.qa('.tog').forEach((el) => { const t = c.toggles[+el.dataset.t], s = this.st(t.entity), on = !!s && s.state === 'on'; el.classList.toggle('on', on); el.querySelector('.sw').classList.toggle('on', on); el.style.opacity = s && s.state !== 'unavailable' ? '' : '.45'; });
      } else {
        const n = num(this.val(c.temp)), sp = num(this.val(c.setpoint)), u = (this.st(c.temp) && this.st(c.temp).attributes.unit_of_measurement) || '°C';
        this.q('.big .v').innerHTML = n === null ? '—' : `${fr(n, 1)}<small>${esc(u)}</small>`;
        this.q('.spv').textContent = (this._busy > Date.now() && this._sv != null) ? `${fr(this._sv)} ${u}` : sp === null ? '—' : `${fr(sp)} ${u}`;
        const t = c.boost && this.st(c.boost.entity), el = this.q('.tog'); if (el) { const on = !!t && t.state === 'on'; el.classList.toggle('on', on); el.querySelector('.sw').classList.toggle('on', on); }
      }
    }
  }

  const reg = (n, k, name, description) => { if (!customElements.get(n)) customElements.define(n, k); window.customCards = window.customCards || []; window.customCards.push({ type: n, name, description }); };
  reg('maison-debit-card', DebitCard, 'Débit internet', 'Tests de débit et état de la box internet');
  reg('maison-sante-card', SanteCard, 'Santé du système', 'Bandeau d\'état et lignes avec alertes');
  reg('maison-encre-card', EncreCard, 'Encre imprimante', 'Réservoirs d\'encre verticaux');
  reg('maison-maj-card', MajCard, 'Mises à jour', 'Mises à jour disponibles avec bouton Installer');
  reg('maison-frigo-card', FrigoCard, 'Réfrigérateur', 'Compartiment (température, consigne) ou glaçons et filtre');
})();
