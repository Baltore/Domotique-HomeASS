/* Boutons des robots aspirateurs (photo détourée + nom + état + batterie).
   mode 'select' : onglet Robots, le robot choisi est coloré ; mode 'nav' : accueil, un clic choisit le robot et ouvre l'onglet Robots.
   Config : select (input_select), path, mode, height (px de la photo), robots: [{ key, name, entity, battery, image }] */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));   // valeurs de la config ou des entités : toujours échappées avant le HTML
  class MaisonRobotsCard extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); }

    setConfig(c) {
      if (!c || !Array.isArray(c.robots)) throw new Error('robots manquant');
      this._cfg = Object.assign({ select: 'input_select.robot_selected', path: '/lovelace/robots', mode: 'select', height: 70, version: '1', base: '/local/maison3d/robots/' }, c);
      this._built = false;
    }

    set hass(h) { this._hass = h; if (!this._built) this._build(); this._update(); }
    getCardSize() { return 2; }
    getGridOptions() { return { columns: 'full', rows: 'auto' }; }
    static getStubConfig() { return { robots: [] }; }

    _build() {
      const c = this._cfg;
      this.shadowRoot.innerHTML = `<style>
        :host { display:block; }
        .row { display:grid; grid-template-columns:repeat(${c.robots.length},1fr); gap:10px; }
        .b { position:relative; display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 6px 8px; cursor:pointer; border-radius:18px;
          background:var(--card-background-color,#101a30); border:1.5px solid rgba(120,150,200,.22); transition:all .25s; min-width:0; }
        .b:hover { border-color:rgba(110,180,255,.6); }
        .b img { height:${+c.height}px; max-width:100%; object-fit:contain; filter:drop-shadow(0 6px 10px rgba(0,0,0,.45)); transition:all .25s; }
        .n { font:700 14px/1.2 system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); text-align:center; }
        .s { font:500 11.5px/1.2 system-ui,sans-serif; color:var(--secondary-text-color,#9aa4b5); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
        .bar { width:70%; height:3px; border-radius:3px; background:rgba(150,170,200,.18); overflow:hidden; }
        .bar i { display:block; height:100%; background:#4cd08a; border-radius:3px; transition:width .6s; }
        .sel .b:not(.on) { opacity:.78; }
        .sel .b:not(.on) img { filter:grayscale(.55) brightness(.85) drop-shadow(0 4px 8px rgba(0,0,0,.4)); }
        .b.on { border-color:#4aa3ff; background:linear-gradient(160deg,rgba(60,130,230,.38),rgba(20,50,110,.55)); box-shadow:0 0 18px rgba(70,160,255,.55), inset 0 0 0 1px rgba(120,190,255,.35); }
        .b.on .n { color:#fff; }
        .b.on .s { color:#bcdcff; }
      </style><div class="row ${c.mode === 'select' ? 'sel' : ''}">${c.robots.map((r, i) =>
        `<div class="b" data-i="${i}"><img src="${c.base}${r.image}?v=${c.version}" alt="${esc(r.name)}" draggable="false"><span class="n">${esc(r.name)}</span><span class="s"></span><div class="bar"><i></i></div></div>`).join('')}</div>`;
      this.shadowRoot.querySelectorAll('.b').forEach((el) => el.addEventListener('click', () => this._tap(+el.dataset.i)));
      this._built = true;
    }

    _update() {
      const h = this._hass, c = this._cfg; if (!h || !this._built) return;
      const cur = h.states[c.select] && h.states[c.select].state;
      c.robots.forEach((r, i) => {
        const el = this.shadowRoot.querySelector(`.b[data-i="${i}"]`); if (!el) return;
        el.classList.toggle('on', c.mode === 'select' && cur === r.key);
        const s = h.states[r.entity], b = r.battery && h.states[r.battery];
        const st = s ? (h.formatEntityState ? h.formatEntityState(s) : s.state) : '—';
        const lvl = b && !isNaN(parseFloat(b.state)) ? Math.round(parseFloat(b.state)) : null;
        el.querySelector('.s').textContent = st + (lvl !== null ? ' · ' + lvl + ' %' : '');
        const bar = el.querySelector('.bar');
        bar.style.visibility = lvl === null ? 'hidden' : 'visible';
        if (lvl !== null) { const f = bar.querySelector('i'); f.style.width = lvl + '%'; f.style.background = lvl < 20 ? '#ff5a5a' : '#4cd08a'; }
      });
    }

    _tap(i) {
      const r = this._cfg.robots[i], h = this._hass; if (!r || !h) return;
      h.callService('input_select', 'select_option', { entity_id: this._cfg.select, option: r.key });
      if (this._cfg.mode === 'nav') {
        history.pushState(null, '', this._cfg.path);
        window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
      }
    }
  }

  if (!customElements.get('maison-robots-card')) customElements.define('maison-robots-card', MaisonRobotsCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'maison-robots-card', name: 'Boutons robots', description: 'Photos des robots aspirateurs, sélection ou navigation' });
})();
