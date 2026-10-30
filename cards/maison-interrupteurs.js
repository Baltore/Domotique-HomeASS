/* Carte « interrupteurs » : une grosse tuile par appareil (icône dans une pastille qui s'illumine à la couleur réelle de la lumière, nom, état,
   interrupteur à bascule), curseur de luminosité pour les lumières variables. Un appui sur la tuile allume/éteint, un appui long ouvre la fiche.
   Config : title, icon,
     master: { entity, name, icon, color_from: [entités] } (tuile principale plus grande, ex. un groupe),
     ambiances: [{ scene, name, icon, color }] (boutons de scènes sous la tuile principale),
     collapse: true (les `items` sont repliés derrière un bouton « Détail des lampes »), collapse_label,
     items: [{ entity, name, icon, color: amber|blue|… ou #rrggbb (couleur par défaut), dimmer: true|false, info: { entity, unit } }] */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));   // valeurs de la config ou des entités : toujours échappées avant le HTML
  const COLORS = { amber: '#ffb84a', blue: '#4aa3ff', green: '#4cd08a', cyan: '#3cc4e8', purple: '#a98bff', pink: '#ff7ab8', red: '#ff5a5a', teal: '#35c9b8' };
  const OFF = ['off', 'unavailable', 'unknown', 'standby', 'idle'];

  const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); return m ? [0, 2, 4].map((i) => parseInt(m[1].substr(i, 2), 16)) : null; };
  const kelvin = (k) => {          // température de couleur -> RVB approximatif
    const t = k / 100; let r, g, b;
    r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332); g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
    b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
    return [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))));
  };
  const bright = (rgb) => { const m = Math.max(...rgb, 1); return rgb.map((x) => Math.round(x * 255 / m)); };   // teinte à pleine intensité (la luminosité a son curseur)
  const css = (rgb) => `rgb(${rgb.join(',')})`;
  const dark = (rgb) => (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) < 150;

  class MaisonInterrupteursCard extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); this._open = false; }

    setConfig(c) {
      if (!c || !Array.isArray(c.items)) throw new Error('items manquant');
      this._cfg = c; this._all = (c.master ? [Object.assign({ big: true }, c.master)] : []).concat(c.items.map((x) => Object.assign({ kid: !!(c.master && c.collapse) }, x)));
      this._built = false;
    }

    set hass(h) { this._hass = h; if (!this._built) this._build(); this._update(); }
    getCardSize() { return 1 + this._all.length; }
    getGridOptions() { return { columns: 12, rows: 'auto' }; }
    static getStubConfig() { return { items: [] }; }

    _tile(it, i) {
      return `<div class="t ${it.big ? 'big' : ''} ${it.kid ? 'kid' : ''}" data-i="${i}"><div class="r"><div class="ic"><ha-icon></ha-icon></div><div class="tx"><div class="n"></div><div class="s"></div></div><div class="sw"><i></i></div></div>
          <div class="dim"><ha-icon icon="mdi:brightness-6"></ha-icon><input type="range" min="1" max="100" step="1"><b></b></div></div>`;
    }

    _build() {
      const c = this._cfg, amb = c.ambiances || [], hasKids = c.master && c.collapse;
      const tiles = this._all.map((it, i) => ({ it, i }));
      this.shadowRoot.innerHTML = `<style>
        :host { display:block; }
        ha-card { padding:6px 0 4px; background:transparent; box-shadow:none; border:none; }
        .hd { display:flex; align-items:center; gap:8px; padding:0 4px 8px; font:700 11px/1 system-ui,sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--secondary-text-color,#9aa4b5); }
        .hd ha-icon { --mdc-icon-size:16px; }
        .list { display:flex; flex-direction:column; gap:10px; }
        .t { --c:#ffb84a; --fg:#14110a; position:relative; border-radius:20px; padding:12px 14px; cursor:pointer; user-select:none; -webkit-user-select:none; touch-action:manipulation;
          background:var(--card-background-color,#101a30); border:1.5px solid rgba(120,150,200,.2); transition:background .3s, border-color .3s, box-shadow .3s; }
        .t:active { transform:scale(.985); }
        .t.on { border-color:var(--c); background:linear-gradient(135deg, color-mix(in srgb, var(--c) 22%, var(--card-background-color,#101a30)), var(--card-background-color,#101a30) 75%);
          box-shadow:0 0 18px color-mix(in srgb, var(--c) 35%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--c) 25%, transparent); }
        .t.unav { opacity:.5; }
        .t.big { padding:16px 16px 14px; }
        .t.kid { padding:9px 12px; border-radius:16px; }
        .r { display:flex; align-items:center; gap:14px; }
        .ic { flex:none; width:46px; height:46px; border-radius:50%; display:flex; align-items:center; justify-content:center; --mdc-icon-size:26px;
          background:rgba(130,150,190,.14); color:var(--secondary-text-color,#8fa3c4); transition:all .3s; }
        .big .ic { width:54px; height:54px; --mdc-icon-size:30px; }
        .kid .ic { width:38px; height:38px; --mdc-icon-size:22px; }
        .on .ic { background:var(--c); color:var(--fg); box-shadow:0 0 16px color-mix(in srgb, var(--c) 70%, transparent); }
        .tx { flex:1; min-width:0; }
        .n { font:600 15px/1.2 system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .big .n { font-size:17px; font-weight:700; }
        .s { margin-top:3px; font:500 12.5px/1.2 system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .on .s { color:color-mix(in srgb, var(--c) 80%, #fff); }
        .sw { flex:none; width:54px; height:32px; border-radius:16px; background:rgba(130,150,190,.28); position:relative; transition:background .3s; }
        .kid .sw { width:46px; height:28px; border-radius:14px; }
        .sw i { position:absolute; left:3px; top:3px; width:26px; height:26px; border-radius:50%; background:#cfd8ee; box-shadow:0 1px 4px rgba(0,0,0,.45); transition:transform .25s, background .25s; }
        .kid .sw i { width:22px; height:22px; }
        .on .sw { background:var(--c); } .on .sw i { transform:translateX(22px); background:#fff; } .on.kid .sw i { transform:translateX(18px); }
        .dim { display:none; align-items:center; gap:10px; margin-top:12px; }
        .dim.show { display:flex; }
        .dim ha-icon { --mdc-icon-size:18px; color:var(--secondary-text-color,#8fa3c4); }
        .dim input { flex:1; min-width:0; height:26px; margin:0; accent-color:var(--c); cursor:pointer; }
        .dim b { width:42px; text-align:right; font:700 12.5px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); }
        .amb { display:grid; grid-template-columns:repeat(${Math.max(1, amb.length)},1fr); gap:10px; }
        .a { --c:#888; position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 6px 12px; border-radius:18px; cursor:pointer; user-select:none; -webkit-user-select:none; touch-action:manipulation;
          background:linear-gradient(160deg, color-mix(in srgb, var(--c) 55%, #0b1224), color-mix(in srgb, var(--c) 12%, #0b1224)); border:1.5px solid color-mix(in srgb, var(--c) 70%, transparent);
          box-shadow:0 0 14px color-mix(in srgb, var(--c) 28%, transparent); transition:transform .15s, box-shadow .3s; }
        .a:active { transform:scale(.95); } .a.hit { box-shadow:0 0 26px var(--c); }
        .a ha-icon { --mdc-icon-size:26px; color:#fff; filter:drop-shadow(0 1px 3px rgba(0,0,0,.5)); }
        .a span { font:700 13px/1.1 system-ui,sans-serif; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.55); }
        .ex { display:flex; align-items:center; justify-content:center; gap:8px; padding:9px; border-radius:16px; cursor:pointer; user-select:none; font:600 13px system-ui,sans-serif;
          color:var(--secondary-text-color,#9aa4b5); background:rgba(130,150,190,.08); border:1px dashed rgba(130,150,190,.3); }
        .ex ha-icon { --mdc-icon-size:20px; transition:transform .3s; } .ex.open ha-icon { transform:rotate(180deg); }
        .kids { display:none; flex-direction:column; gap:8px; } .kids.open { display:flex; }
      </style><ha-card>${c.title ? `<div class="hd">${c.icon ? `<ha-icon icon="${esc(c.icon)}"></ha-icon>` : ''}<span>${esc(c.title)}</span></div>` : ''}<div class="list">
        ${tiles.filter((x) => !x.it.kid).map((x) => this._tile(x.it, x.i)).join('')}
        ${amb.length ? `<div class="amb">${amb.map((a, k) => `<div class="a" data-k="${k}" style="--c:${esc(a.color || '#888')}"><ha-icon icon="${esc(a.icon || 'mdi:palette')}"></ha-icon><span>${esc(a.name)}</span></div>`).join('')}</div>` : ''}
        ${hasKids ? `<div class="ex"><ha-icon icon="mdi:chevron-down"></ha-icon><span class="exl"></span></div><div class="kids">${tiles.filter((x) => x.it.kid).map((x) => this._tile(x.it, x.i)).join('')}</div>` : ''}
      </div></ha-card>`;
      this.shadowRoot.querySelectorAll('.t').forEach((el) => {
        const i = +el.dataset.i; let timer = 0, held = false;
        const d = el.querySelector('.dim');
        d.addEventListener('pointerdown', (e) => e.stopPropagation()); d.addEventListener('click', (e) => e.stopPropagation());
        const inp = el.querySelector('input');
        inp.addEventListener('input', () => { el.querySelector('.dim b').textContent = inp.value + ' %'; this._busy = Date.now() + 1500; });
        inp.addEventListener('change', () => { this._hass.callService('light', 'turn_on', { entity_id: this._all[i].entity, brightness_pct: +inp.value }); this._busy = Date.now() + 800; });
        el.addEventListener('pointerdown', () => { held = false; timer = setTimeout(() => { held = true; this._more(i); }, 550); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => el.addEventListener(t, () => clearTimeout(timer)));
        el.addEventListener('click', () => { if (!held) this._toggle(i); });
        el.addEventListener('contextmenu', (e) => e.preventDefault());
      });
      this.shadowRoot.querySelectorAll('.a').forEach((el) => el.addEventListener('click', () => {
        const a = amb[+el.dataset.k]; if (!a || !this._hass) return;
        this._hass.callService('scene', 'turn_on', { entity_id: a.scene });
        el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 900);
      }));
      const ex = this.shadowRoot.querySelector('.ex');
      if (ex) ex.addEventListener('click', () => { this._open = !this._open; this._sync(); });
      this._built = true;
    }

    _sync() {
      const ex = this.shadowRoot.querySelector('.ex'), kids = this.shadowRoot.querySelector('.kids'); if (!ex) return;
      ex.classList.toggle('open', this._open); kids.classList.toggle('open', this._open);
      const n = this._cfg.items.length, on = this._cfg.items.filter((x) => { const s = this._hass && this._hass.states[x.entity]; return s && !OFF.includes(s.state); }).length;
      ex.querySelector('.exl').textContent = `${this._cfg.collapse_label || 'Détail des lampes'} · ${on}/${n} allumée${on > 1 ? 's' : ''}`;
    }

    _toggle(i) {
      const it = this._all[i], s = this._hass.states[it.entity]; if (!s || s.state === 'unavailable') return;
      this._hass.callService('homeassistant', 'toggle', { entity_id: it.entity });
    }

    _more(i) { this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: this._all[i].entity }, bubbles: true, composed: true })); }

    _rgb(it, at, on) {
      let rgb = on && Array.isArray(at.rgb_color) ? at.rgb_color : (on && at.color_temp_kelvin ? kelvin(at.color_temp_kelvin) : null);
      if (!rgb && on && it.color_from) {
        for (const id of it.color_from) { const s = this._hass.states[id], a = s && s.attributes; if (s && !OFF.includes(s.state) && a) { rgb = Array.isArray(a.rgb_color) ? a.rgb_color : (a.color_temp_kelvin ? kelvin(a.color_temp_kelvin) : null); if (rgb) break; } }
      }
      return rgb ? bright(rgb) : (hex(it.color) || hex(COLORS[it.color]) || hex(COLORS.amber));
    }

    _update() {
      const h = this._hass; if (!h || !this._built) return;
      this._all.forEach((it, i) => {
        const el = this.shadowRoot.querySelector(`.t[data-i="${i}"]`), s = h.states[it.entity];
        const st = s ? s.state : 'unavailable', on = !OFF.includes(st), unav = st === 'unavailable';
        el.classList.toggle('on', on); el.classList.toggle('unav', unav);
        const at = (s && s.attributes) || {};
        const rgb = this._rgb(it, at, on);
        el.style.setProperty('--c', css(rgb)); el.style.setProperty('--fg', dark(rgb) ? '#fff' : '#14110a');
        el.querySelector('ha-icon').setAttribute('icon', it.icon || at.icon || 'mdi:lightbulb');
        el.querySelector('.n').textContent = it.name || at.friendly_name || it.entity;
        const modes = at.supported_color_modes || [];
        const dimmable = it.dimmer === true || (it.dimmer !== false && it.entity.startsWith('light.') && modes.length > 0 && !(modes.length === 1 && modes[0] === 'onoff'));
        const pct = typeof at.brightness === 'number' ? Math.max(1, Math.round(at.brightness / 2.55)) : null;
        let sub = unav ? 'Indisponible' : on ? (dimmable && pct ? `Allumée · ${pct} %` : st === 'playing' ? 'Lecture' : 'Allumée') : 'Éteinte';
        const inf = it.info && h.states[it.info.entity];
        if (inf && !['unavailable', 'unknown'].includes(inf.state) && Number.isFinite(parseFloat(inf.state))) sub += ` · ${(Math.round(parseFloat(inf.state) * 10) / 10).toLocaleString('fr-FR')} ${it.info.unit || inf.attributes.unit_of_measurement || ''}`;
        el.querySelector('.s').textContent = sub;
        const d = el.querySelector('.dim'); d.classList.toggle('show', dimmable && on && !unav);
        if (dimmable && pct && !(this._busy && this._busy > Date.now())) { el.querySelector('input').value = pct; d.querySelector('b').textContent = pct + ' %'; }
      });
      this._sync();
    }
  }

  if (!customElements.get('maison-interrupteurs-card')) customElements.define('maison-interrupteurs-card', MaisonInterrupteursCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'maison-interrupteurs-card', name: 'Interrupteurs', description: 'Tuiles interrupteur avec pastille lumineuse, ambiances et curseur de luminosité' });
})();
