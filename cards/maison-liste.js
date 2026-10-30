/* Carte « liste » compacte : une ligne par entité (icône, nom, valeur) avec une fine barre colorée dessous, comme la liste « par appareil » de l'énergie.
   Config : rows: [{ entity, name, icon, color, max (valeur pleine échelle, ou 'percent'), unit, idle_text, action: 'toggle'|'press'|'cycle' (option suivante d'un input_select)|'more-info', tap_entity, confirm }], title
   ou groups: [{ title, rows }] pour plusieurs listes côte à côte (min_width = largeur mini d'une liste, 230 px par défaut). */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));   // valeurs de la config ou des entités : toujours échappées avant le HTML
  const COLORS = { blue: '#4aa3ff', green: '#4cd08a', teal: '#35c9b8', cyan: '#3cc4e8', amber: '#ffb84a', orange: '#ff9a4a', red: '#ff5a5a', purple: '#a98bff', grey: '#8a94a6' };

  class MaisonListeCard extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); }

    setConfig(c) {
      if (!c || (!Array.isArray(c.rows) && !Array.isArray(c.groups))) throw new Error('rows ou groups manquant');
      this._cfg = c;
      this._groups = Array.isArray(c.groups) ? c.groups : [{ title: c.title, rows: c.rows }];
      this._flat = [].concat(...this._groups.map((g) => g.rows));
      this._built = false;
    }

    set hass(h) { this._hass = h; if (!this._built) this._build(); this._update(); }
    getCardSize() { return 1 + (this._flat ? this._flat.length : 0) * 0.5; }
    getGridOptions() { return { columns: 'full', rows: 'auto', min_columns: 3 }; }
    static getStubConfig() { return { rows: [] }; }

    _build() {
      const mw = +(this._cfg.min_width || 230);
      let n = 0;
      this.shadowRoot.innerHTML = `<style>
        :host { display:block; }
        ha-card { padding:0; background:transparent; box-shadow:none; border:none; }
        .gs { display:grid; grid-template-columns:repeat(auto-fit,minmax(${mw}px,1fr)); gap:12px; align-items:start; }
        .g { padding:10px 8px 6px; border-radius:20px; background:var(--card-background-color,#101a30); border:1.5px solid rgba(120,150,200,.2); }
        .t { display:flex; align-items:center; gap:8px; padding:2px 8px 8px; font:700 11px/1.2 system-ui,sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--secondary-text-color,#9aa4b5); }
        .t::before { content:''; width:4px; height:14px; border-radius:3px; background:linear-gradient(180deg,#4aa3ff,#35c9b8); }
        .r { display:grid; grid-template-columns:36px 1fr auto; align-items:center; column-gap:11px; padding:7px 8px 6px; cursor:pointer; border-radius:14px; transition:background .2s; }
        .r + .r { margin-top:2px; } .r:hover { background:rgba(120,160,220,.10); } .r:active { background:rgba(120,160,220,.18); }
        ha-icon { display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:50%; background:color-mix(in srgb, currentColor 16%, transparent); --mdc-icon-size:20px; }
        .n { font:600 14px/1.2 system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .v { font:700 12.5px/1.2 system-ui,sans-serif; color:#ffd36b; white-space:nowrap; }
        .bar { grid-column:1 / -1; height:5px; margin-top:7px; border-radius:5px; background:rgba(150,170,200,.16); overflow:hidden; }
        .bar i { display:block; height:100%; border-radius:5px; transition:width .6s; }
      </style><ha-card><div class="gs">${this._groups.map((g) =>
        `<div class="g">${g.title ? `<div class="t">${esc(g.title)}</div>` : ''}${g.rows.map(() =>
          `<div class="r" data-i="${n++}"><ha-icon></ha-icon><span class="n"></span><span class="v"></span><div class="bar"><i></i></div></div>`).join('')}</div>`).join('')}</div></ha-card>`;
      this.shadowRoot.querySelectorAll('.r').forEach((el) => el.addEventListener('click', () => this._tap(+el.dataset.i)));
      this._built = true;
    }

    _update() {
      const h = this._hass; if (!h || !this._built) return;
      this._flat.forEach((r, i) => {
        const el = this.shadowRoot.querySelector(`.r[data-i="${i}"]`); if (!el) return;
        const s = h.states[r.entity];
        const col = COLORS[r.color] || r.color || COLORS.blue;
        const ic = el.querySelector('ha-icon');
        ic.setAttribute('icon', r.icon || (s && s.attributes.icon) || 'mdi:circle-outline');
        ic.style.color = col;
        el.querySelector('.n').textContent = r.name || (s && s.attributes.friendly_name) || r.entity;
        let txt = '—', pct = null;
        if (s) {
          if (s.state === 'unavailable' || s.state === 'unknown') txt = r.idle_text || (s.state === 'unknown' ? '—' : 'indispo');
          else {
            txt = h.formatEntityState ? h.formatEntityState(s) : (s.state + (s.attributes.unit_of_measurement ? ' ' + s.attributes.unit_of_measurement : ''));
            const n = parseFloat(s.state);
            if (r.max && !isNaN(n)) pct = Math.max(0, Math.min(100, n / (r.max === 'percent' ? 100 : r.max) * 100));
            if (r.unit && !isNaN(n)) txt = (Math.round(n * 10) / 10) + ' ' + r.unit;
          }
        }
        el.querySelector('.v').textContent = txt;
        const bar = el.querySelector('.bar'), fill = bar.querySelector('i');
        if (pct === null) { bar.style.display = 'none'; } else {
          bar.style.display = 'block'; fill.style.width = pct + '%';
          fill.style.background = (r.warn !== false && pct < 15) ? COLORS.red : col;
        }
      });
    }

    _tap(i) {
      const r = this._flat[i], h = this._hass; if (!r || !h) return;
      const a = r.action || 'more-info', e = r.tap_entity || r.entity;
      if (r.confirm && !window.confirm(r.confirm)) return;
      if (a === 'toggle') h.callService('homeassistant', 'toggle', { entity_id: e });
      else if (a === 'press') h.callService('button', 'press', { entity_id: e });
      else if (a === 'cycle') h.callService('input_select', 'select_next', { entity_id: e, cycle: true });
      else this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: e }, bubbles: true, composed: true }));
    }
  }

  if (!customElements.get('maison-liste-card')) customElements.define('maison-liste-card', MaisonListeCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'maison-liste-card', name: 'Liste compacte', description: 'Lignes icône / nom / valeur avec barre colorée' });
})();
