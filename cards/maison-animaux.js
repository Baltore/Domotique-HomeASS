/* Cartes de l'onglet Animaux (chat) : chiffres clés, litière, réglages repliables, purificateur d'air.
   - custom:maison-stats-card      : layout 'list' (lignes à gros chiffres) ou 'tiles' (tuiles côte à côte) + lignes d'info (extra)
   - custom:maison-litiere-card    : état, alertes, jauges circulaires, pastilles, actions principales + actions secondaires repliées
   - custom:maison-reglages-card   : groupes repliables d'interrupteurs / listes / nombres
   - custom:maison-air-card        : purificateur (marche/arrêt, puissance 1-5, qualité de l'air, filtre, réglages) */
(() => {
  const COL = { amber: '#ffb84a', blue: '#4aa3ff', green: '#4cd08a', cyan: '#3cc4e8', purple: '#a98bff', pink: '#ff7ab8', red: '#ff5a5a', orange: '#ff9a4a', teal: '#35c9b8' };
  const col = (c) => COL[c] || c || COL.blue;
  const BAD = ['unavailable', 'unknown', 'none', ''];
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
  const fr = (n, d = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: d });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dur = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return h ? `${h} h ${String(m).padStart(2, '0')}` : m ? `${m} min ${String(r).padStart(2, '0')} s` : `${r} s`; };
  const rel = (d) => {
    const m = Math.round((Date.now() - d.getTime()) / 60000);
    if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`;
    const j = Math.floor(h / 24); return j === 1 ? 'hier' : `il y a ${j} j`;
  };
  const EVT = { 'periodic odor completed': 'Désodorisation périodique terminée', 'cleaning completed': 'Nettoyage terminé', 'cat entered': 'Chat entré', 'cat left': 'Chat sorti', 'auto clean completed': 'Nettoyage auto terminé' };
  const cap = (s) => { s = String(s).replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };

  const BASE = `
    :host { display:block; } ha-card { padding:0; background:transparent; box-shadow:none; border:none; }
    button, select { font:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
    .panel { border-radius:20px; padding:14px; background:var(--card-background-color,#101a30); border:1.5px solid rgba(120,150,200,.2); }
    .lab { font:700 11px/1 system-ui,sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--secondary-text-color,#9aa4b5); }
    .v { font:700 26px/1.1 system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); }
    .v small { font:600 13px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); margin-left:3px; }
    .sub { font:500 12.5px/1.3 system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); }
    .sw { flex:none; width:46px; height:28px; border-radius:14px; background:rgba(130,150,190,.28); position:relative; transition:background .3s; }
    .sw i { position:absolute; left:3px; top:3px; width:22px; height:22px; border-radius:50%; background:#cfd8ee; box-shadow:0 1px 4px rgba(0,0,0,.45); transition:transform .25s, background .25s; }
    .on > .sw, .sw.on { background:var(--c,#4aa3ff); } .on > .sw i, .sw.on i { transform:translateX(18px); background:#fff; }
    .pill { display:inline-flex; align-items:center; gap:6px; padding:4px 11px; border-radius:99px; font:700 12px system-ui,sans-serif; }
    .ok { background:rgba(60,220,150,.16); color:#7df0b8; } .info { background:rgba(60,170,255,.18); color:#8fdcff; } .warn { background:rgba(255,190,90,.18); color:#ffd08a; } .bad { background:rgba(255,100,100,.18); color:#ff9b9b; }
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

  // ---------------------------------------------------------------------------------------- chiffres clés
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const fmtVal = (it, s) => {
    if (!s || BAD.includes(s.state)) return ['—', ''];
    const f = it.fmt || 'num', at = s.attributes || {};
    if (f === 'dur') return [dur(parseFloat(s.state)), ''];
    if (f === 'date') { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.state); return m ? [`${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`, ''] : [s.state, '']; }
    if (f === 'text') return [s.state, ''];
    const n = num(s.state); return n === null ? [s.state, ''] : [fr(n, it.digits != null ? it.digits : (Number.isInteger(n) ? 0 : 1)), it.unit != null ? it.unit : (at.unit_of_measurement || '')];
  };

  class StatsCard extends Base {
    setConfig(c) { if (!c || !Array.isArray(c.items)) throw new Error('items manquant'); this._cfg = c; this._built = false; }
    getCardSize() { return 3; }
    _build() {
      const c = this._cfg, tiles = c.layout === 'tiles';
      this.shadowRoot.innerHTML = `<style>${BASE}
        :host { ${tiles ? '' : 'height:100%;'} } ha-card { ${tiles ? '' : 'height:100%;'} }
        .g { display:grid; gap:${tiles ? 10 : 8}px; ${tiles ? `grid-template-columns:repeat(${c.items.length},minmax(0,1fr));` : `grid-template-rows:repeat(${c.items.length},minmax(0,1fr)); height:100%;`} }
        .it { --c:#4aa3ff; display:flex; min-width:0; ${tiles ? 'flex-direction:column; align-items:flex-start; gap:8px; padding:12px 12px;' : 'align-items:center; gap:12px; padding:6px 12px; overflow:hidden;'} border-radius:${tiles ? 18 : 16}px; cursor:pointer;
          background:linear-gradient(135deg, color-mix(in srgb, var(--c) 16%, var(--card-background-color,#101a30)), var(--card-background-color,#101a30) 70%); border:1.5px solid color-mix(in srgb, var(--c) 40%, transparent); }
        .ic { flex:none; width:${tiles ? 38 : 34}px; height:${tiles ? 38 : 34}px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:color-mix(in srgb, var(--c) 28%, transparent); color:var(--c); --mdc-icon-size:${tiles ? 21 : 19}px; }
        .tx { min-width:0; } .tx .v { font-size:${tiles ? 18 : 17}px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .tx .v small { font-size:12px; } .tx .lab { display:block; margin-top:${tiles ? 5 : 3}px; letter-spacing:.08em; font-size:${tiles ? 10.5 : 9.5}px; }
        .x { margin-top:10px; display:flex; flex-direction:column; gap:8px; padding:12px 14px; border-radius:18px; background:rgba(130,150,190,.08); }
        .x div { display:flex; justify-content:space-between; gap:10px; font:500 13px system-ui,sans-serif; } .x span { color:var(--secondary-text-color,#9aa4b5); } .x b { color:var(--primary-text-color,#e6edf7); text-align:right; }
      </style><ha-card><div class="g">${c.items.map((it, i) => `<div class="it" data-i="${i}" style="--c:${col(it.color)}"><div class="ic"><ha-icon icon="${it.icon}"></ha-icon></div><div class="tx"><div class="v"></div><span class="lab">${esc(it.name)}</span></div></div>`).join('')}</div>
        ${(c.extra || []).length ? `<div class="x">${c.extra.map((e, i) => `<div data-e="${i}"><span>${esc(e.label)}</span><b></b></div>`).join('')}</div>` : ''}</ha-card>`;
      this.qa('.it').forEach((el) => el.addEventListener('click', () => this.more(c.items[+el.dataset.i].entity)));
    }
    _update() {
      const c = this._cfg;
      this.qa('.it').forEach((el) => { const it = c.items[+el.dataset.i], [v, u] = fmtVal(it, this.st(it.entity)); el.querySelector('.v').innerHTML = `${esc(v)}${u ? `<small>${esc(u)}</small>` : ''}`; });
      this.qa('[data-e]').forEach((el) => {
        const e = c.extra[+el.dataset.e], s = this.st(e.entity); let t = '—';
        if (s && !BAD.includes(s.state)) {
          if (e.fmt === 'since') { const d = new Date(s.last_updated || s.last_changed), x = e.with && this.st(e.with); t = `${rel(d)}${x && num(x.state) !== null ? ' · ' + dur(num(x.state)) : ''}`; }
          else t = EVT[s.state.toLowerCase()] || cap(s.state);
        }
        el.querySelector('b').textContent = t;
      });
    }
  }

  // ---------------------------------------------------------------------------------------- litière
  const LITTER = { idle: ['En veille', 'ok'], working: ['En marche', 'info'], cleaning: ['Nettoyage en cours', 'info'], cat_in: ['Chat dans le bac', 'info'], cat_inside: ['Chat dans le bac', 'info'], maintenance: ['Maintenance', 'warn'],
    paused: ['En pause', 'warn'], error: ['Erreur', 'bad'], dumping: ['Vidange en cours', 'info'], odor_removing: ['Désodorisation', 'info'], resetting: ['Réinitialisation', 'info'] };

  class LitiereCard extends Base {
    setConfig(c) { if (!c || !c.state) throw new Error('state requis'); this._cfg = c; this._built = false; }
    getCardSize() { return 8; }
    _ring(g, i) {
      return `<div class="rg" data-g="${i}" style="--c:${col(g.color)}"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" class="bg"/><circle cx="22" cy="22" r="18" class="fg" pathLength="100" stroke-dasharray="0 100"/></svg>
        <div class="in"><ha-icon icon="${g.icon}"></ha-icon><b></b></div><span>${esc(g.name)}</span></div>`;
    }
    _build() {
      const c = this._cfg, main = c.main || {}, more = c.more || [];
      this.shadowRoot.innerHTML = `<style>${BASE}
        .hd { display:flex; align-items:center; gap:12px; } .hd .ic { width:46px; height:46px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(60,170,255,.18); color:#8fdcff; --mdc-icon-size:26px; }
        .hd .t { flex:1; min-width:0; } .hd .t b { display:block; font:700 17px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); margin-bottom:4px; }
        .al { margin-top:12px; display:flex; flex-direction:column; gap:7px; } .al .pill { justify-content:flex-start; border-radius:12px; padding:8px 12px; --mdc-icon-size:18px; }
        .rings { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:14px; }
        .rg { --c:#4aa3ff; position:relative; display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; }
        .rg svg { width:92px; height:92px; transform:rotate(-90deg); overflow:visible; } .rg circle { fill:none; stroke-width:4.2; stroke-linecap:round; } .rg .bg { stroke:rgba(130,150,190,.2); } .rg .fg { stroke:var(--c); transition:stroke-dasharray .8s; filter:drop-shadow(0 0 3px var(--c)); }
        .rg .in { position:absolute; top:0; left:0; right:0; height:92px; display:flex; flex-direction:column; align-items:center; justify-content:center; --mdc-icon-size:20px; color:var(--c); }
        .rg .in b { font:700 17px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); margin-top:2px; } .rg span { font:600 12px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); text-align:center; }
        .chips { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-top:14px; }
        .ch { display:flex; align-items:center; gap:10px; padding:9px 11px; border-radius:14px; background:rgba(130,150,190,.09); cursor:pointer; --mdc-icon-size:20px; }
        .ch ha-icon { color:var(--secondary-text-color,#9aa4b5); } .ch b { display:block; font:700 14px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); } .ch span { font:500 11.5px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); }
        .ch.warn ha-icon, .ch.warn b { color:#ffd08a; } .ch.bad ha-icon, .ch.bad b { color:#ff9b9b; } .ch.ok ha-icon { color:#7df0b8; }
        .acts { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; }
        .big { display:flex; align-items:center; justify-content:center; gap:8px; height:54px; border-radius:16px; border:1.5px solid rgba(130,150,190,.3); background:rgba(130,150,190,.1); color:var(--primary-text-color,#e6edf7); font:700 15px system-ui,sans-serif; --mdc-icon-size:22px; }
        .big.go { background:linear-gradient(135deg,#1f7fe0,#35c9b8); border-color:transparent; color:#fff; box-shadow:0 4px 14px rgba(40,150,230,.35); } .big.act { box-shadow:0 0 0 2px #ffb84a inset; }
        .big:active { transform:scale(.97); }
        .mo { margin-top:10px; display:flex; align-items:center; justify-content:center; gap:6px; padding:9px; border-radius:14px; border:1px dashed rgba(130,150,190,.3); background:rgba(130,150,190,.06); color:var(--secondary-text-color,#9aa4b5); font:600 13px system-ui,sans-serif; --mdc-icon-size:20px; cursor:pointer; }
        .mo.open ha-icon { transform:rotate(180deg); } .more { display:none; grid-template-columns:repeat(2,1fr); gap:8px; margin-top:8px; } .more.open { display:grid; }
        .sm { display:flex; align-items:center; gap:8px; padding:10px 12px; border-radius:14px; border:1px solid rgba(130,150,190,.25); background:rgba(130,150,190,.08); color:var(--primary-text-color,#dbe9ff); font:600 13px system-ui,sans-serif; --mdc-icon-size:19px; }
        .sm:active { background:rgba(90,160,255,.3); }
      </style><ha-card><div class="panel">
        <div class="hd"><div class="ic"><ha-icon icon="mdi:cat"></ha-icon></div><div class="t"><b>${esc(c.title || 'Litière')}</b><span class="pill info st">—</span></div></div>
        <div class="al"></div>
        <div class="rings">${(c.gauges || []).map((g, i) => this._ring(g, i)).join('')}</div>
        <div class="chips">${(c.chips || []).map((x, i) => `<div class="ch" data-c="${i}"><ha-icon icon="${x.icon}"></ha-icon><div><b>—</b><span>${esc(x.name)}</span></div></div>`).join('')}</div>
        <div class="acts"><button class="big go" data-b="${main.start}"><ha-icon icon="mdi:play"></ha-icon>Nettoyer</button><button class="big" data-b="${main.pause}"><ha-icon icon="mdi:pause"></ha-icon>Pause</button></div>
        ${more.length ? `<div class="mo"><span>Autres actions</span><ha-icon icon="mdi:chevron-down"></ha-icon></div><div class="more">${more.map((m, i) => `<button class="sm" data-m="${i}"><ha-icon icon="${m.icon}"></ha-icon>${esc(m.name)}</button>`).join('')}</div>` : ''}
      </div></ha-card>`;
      this.qa('.rg').forEach((el) => el.addEventListener('click', () => this.more(c.gauges[+el.dataset.g].entity)));
      this.qa('.ch').forEach((el) => el.addEventListener('click', () => this.more(c.chips[+el.dataset.c].entity)));
      this.qa('[data-b]').forEach((el) => el.addEventListener('click', () => this.call('button', 'press', { entity_id: el.dataset.b })));
      this.qa('[data-m]').forEach((el) => el.addEventListener('click', () => { const m = more[+el.dataset.m]; if (m.confirm && !window.confirm(m.confirm)) return; this.call('button', 'press', { entity_id: m.entity }); }));
      const mo = this.q('.mo'); if (mo) mo.addEventListener('click', () => { mo.classList.toggle('open'); this.q('.more').classList.toggle('open'); });
    }
    _update() {
      const c = this._cfg, s = this.st(c.state), stt = s ? s.state : 'unavailable', [lab, k] = LITTER[stt] || (stt === 'unavailable' ? ['Hors ligne', 'bad'] : [cap(stt), 'info']);
      const pill = this.q('.st'); pill.textContent = lab; pill.className = `pill ${k} st`;
      const alerts = [];
      const er = c.error && this.val(c.error); if (er && er !== 'no_error') alerts.push(['bad', 'mdi:alert-circle', `Erreur : ${cap(er)}`]);
      (c.gauges || []).forEach((g) => { const n = num(this.val(g.entity)); if (n !== null && g.low != null && n < g.low) alerts.push([n < g.low / 2 ? 'bad' : 'warn', g.icon, `${g.name} basse (${fr(n)} %)`]); });
      (c.chips || []).forEach((x) => { const v = this.st(x.entity); if (!v) return;
        if (x.kind === 'bin' && v.state === 'on') alerts.push(['warn', 'mdi:trash-can', 'Bac à déchets à vider']);
        if (x.kind === 'days' && num(v.state) === 0) alerts.push(['warn', 'mdi:air-filter', `${x.name} à changer`]); });
      this.q('.al').innerHTML = alerts.map(([kk, ic, t]) => `<span class="pill ${kk}"><ha-icon icon="${ic}"></ha-icon>${esc(t)}</span>`).join('');
      this.qa('.rg').forEach((el) => { const g = c.gauges[+el.dataset.g], n = num(this.val(g.entity)); el.querySelector('b').textContent = n === null ? '—' : `${fr(n)} %`; el.querySelector('.fg').setAttribute('stroke-dasharray', `${n === null ? 0 : Math.max(0, Math.min(100, n))} 100`); });
      this.qa('.ch').forEach((el) => {
        const x = c.chips[+el.dataset.c], v = this.st(x.entity), b = el.querySelector('b'); let t = '—', k = '';
        if (v && !BAD.includes(v.state)) {
          if (x.kind === 'bin') { t = v.state === 'on' ? 'À vider' : 'OK'; k = v.state === 'on' ? 'warn' : 'ok'; }
          else if (x.kind === 'days') { const n = num(v.state); t = n === 0 ? 'À changer' : `${fr(n)} j`; k = n === 0 ? 'warn' : ''; }
          else if (x.kind === 'wifi') { const n = num(v.state); t = n > -60 ? 'Excellent' : n > -70 ? 'Bon' : n > -80 ? 'Moyen' : 'Faible'; k = n > -70 ? 'ok' : 'warn'; }
          else { const n = num(v.state); t = n === null ? v.state : `${fr(n, 1)} ${x.unit || v.attributes.unit_of_measurement || ''}`; }
        }
        b.textContent = t; el.className = `ch ${k}`;
      });
      const run = ['cleaning', 'working'].includes(stt);
      this.qa('.big')[0].classList.toggle('act', run); this.qa('.big')[1].classList.toggle('act', stt === 'paused');
    }
  }

  // ---------------------------------------------------------------------------------------- réglages repliables
  class ReglagesCard extends Base {
    setConfig(c) { if (!c || !Array.isArray(c.groups)) throw new Error('groups requis'); this._cfg = c; this._built = false; this._open = -1; }
    getCardSize() { return 6; }
    _build() {
      const c = this._cfg;
      this.shadowRoot.innerHTML = `<style>${BASE}
        .gr { margin-bottom:10px; border-radius:18px; overflow:hidden; background:var(--card-background-color,#101a30); border:1.5px solid rgba(120,150,200,.2); transition:border-color .3s; } .gr.open { border-color:rgba(110,180,255,.55); }
        .gh { display:flex; align-items:center; gap:12px; padding:13px 14px; cursor:pointer; user-select:none; --mdc-icon-size:22px; } .gh > ha-icon:first-child { color:#8fdcff; }
        .gh b { flex:1; font:700 15px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); } .gh .n { font:600 12px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); }
        .gh .chev { transition:transform .3s; color:var(--secondary-text-color,#9aa4b5); } .gr.open .chev { transform:rotate(180deg); }
        .bd { display:none; padding:0 8px 8px; } .gr.open .bd { display:block; }
        .rw { --c:#4aa3ff; display:flex; align-items:center; gap:10px; padding:11px 8px; border-top:1px solid rgba(130,150,190,.14); cursor:pointer; }
        .rw .nm { flex:1; min-width:0; font:500 14px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); } .rw .nm small { display:block; font:500 11.5px system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); margin-top:2px; }
        .rw select, .rw input[type=number] { max-width:150px; height:34px; border-radius:10px; border:1px solid rgba(130,150,190,.3); background:rgba(130,150,190,.1); color:var(--primary-text-color,#dbe9ff); padding:0 8px; font:13px system-ui,sans-serif; }
        .rw input[type=number] { width:76px; }
      </style><ha-card>${c.groups.map((g, gi) => `<div class="gr" data-g="${gi}"><div class="gh"><ha-icon icon="${g.icon}"></ha-icon><b>${esc(g.title)}</b><span class="n"></span><ha-icon class="chev" icon="mdi:chevron-down"></ha-icon></div>
        <div class="bd">${g.items.map((it, ii) => `<div class="rw" data-g="${gi}" data-i="${ii}"><div class="nm">${esc(it.name)}${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</div><span class="ctl"></span></div>`).join('')}</div></div>`).join('')}</ha-card>`;
      this.qa('.gh').forEach((el) => el.addEventListener('click', () => { const gi = +el.parentNode.dataset.g; this._open = this._open === gi ? -1 : gi; this.qa('.gr').forEach((g) => g.classList.toggle('open', +g.dataset.g === this._open)); }));
      this.qa('.rw').forEach((el) => {
        const it = c.groups[+el.dataset.g].items[+el.dataset.i], d = it.entity.split('.')[0], ctl = el.querySelector('.ctl');
        if (d === 'switch') { ctl.className = 'ctl sw'; ctl.innerHTML = '<i></i>'; el.addEventListener('click', () => this.call('homeassistant', 'toggle', { entity_id: it.entity })); }
        else if (d === 'select') { ctl.innerHTML = '<select></select>'; ctl.firstChild.addEventListener('change', (e) => { this.call('select', 'select_option', { entity_id: it.entity, option: e.target.value }); this._busy = Date.now() + 1500; }); ctl.addEventListener('click', (e) => e.stopPropagation()); }
        else if (d === 'number') { ctl.innerHTML = '<input type="number">'; ctl.firstChild.addEventListener('change', (e) => this.call('number', 'set_value', { entity_id: it.entity, value: +e.target.value })); ctl.addEventListener('click', (e) => e.stopPropagation()); }
      });
    }
    _update() {
      const c = this._cfg;
      this.qa('.rw').forEach((el) => {
        const it = c.groups[+el.dataset.g].items[+el.dataset.i], s = this.st(it.entity), d = it.entity.split('.')[0], ctl = el.querySelector('.ctl');
        el.style.opacity = s && s.state !== 'unavailable' ? '' : '.45';
        if (d === 'switch') ctl.classList.toggle('on', !!s && s.state === 'on');
        else if (d === 'select' && s) { const sel = ctl.firstChild, opts = s.attributes.options || []; if (sel.dataset.k !== opts.join('|')) { sel.innerHTML = opts.map((o) => `<option>${esc(o)}</option>`).join(''); sel.dataset.k = opts.join('|'); } if (!(this._busy > Date.now())) sel.value = s.state; }
        else if (d === 'number' && s) { const inp = ctl.firstChild; inp.min = s.attributes.min; inp.max = s.attributes.max; inp.step = s.attributes.step || 1; if (document.activeElement !== inp && this.shadowRoot.activeElement !== inp) inp.value = s.state; }
      });
      this.qa('.gr').forEach((el) => { const g = c.groups[+el.dataset.g], sw = g.items.filter((x) => x.entity.startsWith('switch.')), on = sw.filter((x) => { const s = this.st(x.entity); return s && s.state === 'on'; }).length; el.querySelector('.n').textContent = sw.length ? `${on}/${sw.length} actifs` : ''; });
    }
  }

  // ---------------------------------------------------------------------------------------- purificateur
  const AQ = (pm) => (pm < 12 ? ['Excellente', 'ok', '#4cd08a'] : pm < 35 ? ['Bonne', 'ok', '#9be26b'] : pm < 55 ? ['Moyenne', 'warn', '#ffb84a'] : pm < 150 ? ['Mauvaise', 'bad', '#ff7a4a'] : ['Très mauvaise', 'bad', '#ff4a4a']);

  class AirCard extends Base {
    setConfig(c) { if (!c || !c.fan) throw new Error('fan requis'); this._cfg = c; this._built = false; }
    getCardSize() { return 6; }
    _build() {
      const c = this._cfg, ex = c.extras || [];
      this.shadowRoot.innerHTML = `<style>${BASE}
        .panel { --c:#4cd08a; } .pw { display:flex; align-items:center; gap:14px; cursor:pointer; } .pw .ic { flex:none; width:54px; height:54px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(130,150,190,.14); color:var(--secondary-text-color,#8fa3c4); --mdc-icon-size:30px; transition:all .3s; }
        .panel.on { border-color:var(--c); background:linear-gradient(135deg,color-mix(in srgb, var(--c) 20%, var(--card-background-color,#101a30)),var(--card-background-color,#101a30) 75%); box-shadow:0 0 18px color-mix(in srgb, var(--c) 30%, transparent); }
        .panel.on .ic { background:var(--c); color:#07130c; box-shadow:0 0 16px color-mix(in srgb, var(--c) 65%, transparent); } .pw .t { flex:1; min-width:0; } .pw .t b { display:block; font:700 17px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); margin-bottom:3px; }
        .panel.on .sub { color:color-mix(in srgb, var(--c) 75%, #fff); }
        .seg { display:none; gap:6px; margin-top:12px; } .panel.on .seg { display:flex; } .seg button { flex:1; height:36px; border-radius:11px; border:1px solid rgba(130,150,190,.3); background:rgba(130,150,190,.1); color:var(--primary-text-color,#cfe6ff); font:700 14px system-ui,sans-serif; }
        .seg button.on { background:var(--c); border-color:var(--c); color:#07130c; box-shadow:0 0 12px color-mix(in srgb, var(--c) 55%, transparent); }
        .stats { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
        .s1 { padding:12px 14px; border-radius:18px; background:var(--card-background-color,#101a30); border:1.5px solid rgba(120,150,200,.2); cursor:pointer; } .s1 .v { font-size:22px; margin:6px 0 4px; } .s1 .bar { height:5px; border-radius:5px; background:rgba(130,150,190,.2); overflow:hidden; margin-top:6px; } .s1 .bar i { display:block; height:100%; border-radius:5px; transition:width .6s; }
        .ex { margin-top:10px; border-radius:18px; background:var(--card-background-color,#101a30); border:1.5px solid rgba(120,150,200,.2); } .rw { --c:#4aa3ff; display:flex; align-items:center; gap:10px; padding:12px 14px; cursor:pointer; } .rw + .rw { border-top:1px solid rgba(130,150,190,.14); } .rw .nm { flex:1; font:500 14px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); }
        .off { text-align:center; padding:8px; font:600 13px system-ui,sans-serif; color:#ff9b9b; }
      </style><ha-card><div class="panel"><div class="pw"><div class="ic"><ha-icon icon="mdi:air-purifier"></ha-icon></div><div class="t"><b>Purificateur d'air</b><div class="sub">—</div></div><div class="sw"><i></i></div></div>
          <div class="seg">${[20, 40, 60, 80, 100].map((p, i) => `<button data-p="${p}">${i + 1}</button>`).join('')}</div></div>
        <div class="stats"><div class="s1" data-e="${c.pm25}"><span class="lab">Qualité de l'air</span><div class="v">—</div><div class="sub">PM2.5</div><div class="bar"><i></i></div></div>
          <div class="s1" data-e="${c.filter}"><span class="lab">Filtre</span><div class="v">—</div><div class="sub">—</div><div class="bar"><i></i></div></div></div>
        ${ex.length ? `<div class="ex">${ex.map((x, i) => `<div class="rw" data-x="${i}"><div class="nm">${esc(x.name)}</div><div class="sw"><i></i></div></div>`).join('')}</div>` : ''}</ha-card>`;
      this.q('.pw').addEventListener('click', () => { const s = this.st(c.fan); if (s && s.state !== 'unavailable') this.call('fan', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: c.fan }); });
      this.qa('.seg button').forEach((b) => b.addEventListener('click', () => this.call('fan', 'set_percentage', { entity_id: c.fan, percentage: +b.dataset.p })));
      this.qa('.s1').forEach((el) => el.addEventListener('click', () => this.more(el.dataset.e)));
      this.qa('.rw').forEach((el) => el.addEventListener('click', () => this.call('homeassistant', 'toggle', { entity_id: ex[+el.dataset.x].entity })));
    }
    _update() {
      const c = this._cfg, s = this.st(c.fan), stt = s ? s.state : 'unavailable', on = stt === 'on', at = (s && s.attributes) || {};
      const panel = this.q('.panel'); panel.classList.toggle('on', on); this.q('.pw .sw').classList.toggle('on', on);
      const cur = on ? Math.max(20, Math.min(100, Math.round((at.percentage || 20) / 20) * 20)) : 0;
      this.q('.pw .sub').textContent = stt === 'unavailable' ? 'Hors ligne' : on ? `Puissance ${cur / 20} sur 5${at.preset_mode ? ' · ' + cap(at.preset_mode) : ''}` : 'Éteint';
      this.qa('.seg button').forEach((b) => b.classList.toggle('on', +b.dataset.p === cur));
      const [a, f] = this.qa('.s1'), pm = num(this.val(c.pm25));
      if (pm === null) { a.querySelector('.v').textContent = '—'; a.querySelector('.sub').textContent = 'PM2.5'; a.querySelector('.bar i').style.width = '0'; }
      else { const [t, , cc] = AQ(pm); a.querySelector('.v').textContent = t; a.querySelector('.v').style.color = cc; a.querySelector('.sub').textContent = `PM2.5 · ${fr(pm)} µg/m³`; const i = a.querySelector('.bar i'); i.style.width = `${Math.min(100, pm / 150 * 100)}%`; i.style.background = cc; }
      const fl = num(this.val(c.filter)), days = num(this.val(c.days));
      f.querySelector('.v').textContent = fl === null ? '—' : `${fr(fl)} %`; f.querySelector('.sub').textContent = days === null ? 'Durée de vie' : `${fr(days)} jours restants`;
      const fi = f.querySelector('.bar i'); fi.style.width = `${fl === null ? 0 : fl}%`; fi.style.background = fl !== null && fl < 15 ? '#ff5a5a' : '#4cd08a';
      this.qa('.rw').forEach((el) => { const x = (c.extras || [])[+el.dataset.x], v = this.st(x.entity); el.querySelector('.sw').classList.toggle('on', !!v && v.state === 'on'); el.style.opacity = v && v.state !== 'unavailable' ? '' : '.45'; });
    }
  }

  const reg = (n, k, name, description) => { if (!customElements.get(n)) customElements.define(n, k); window.customCards = window.customCards || []; window.customCards.push({ type: n, name, description }); };
  reg('maison-stats-card', StatsCard, 'Chiffres clés', 'Lignes ou tuiles à gros chiffres');
  reg('maison-litiere-card', LitiereCard, 'Litière', 'État, alertes, jauges et actions de la litière');
  reg('maison-reglages-card', ReglagesCard, 'Réglages repliables', 'Groupes repliables de réglages');
  reg('maison-air-card', AirCard, 'Purificateur d\'air', 'Purificateur : marche/arrêt, puissance, qualité de l\'air, filtre');
})();
