/* Carte d'accueil « Ma maison » : une vue 3D détourée de la maison (jardin ou rue), qui change toutes les minutes (fondu).
   Toucher la carte ouvre l'onglet Plan 3D. Images simples : aucune charge pour la carte graphique. */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));   // valeurs de la config ou des entités : toujours échappées avant le HTML
  const PERIOD = 60000;      // une vue par minute

  class MaisonExterieurCard extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); this._shown = -1; }

    setConfig(c) {
      this._cfg = Object.assign({ path: '/local/maison3d/', navigation_path: '/lovelace/plan-3d', title: 'Ma maison', height: 340, version: '6',
        images: [{ file: 'maison_jardin.webp', name: 'Façade jardin' }, { file: 'maison_rue.webp', name: 'Façade rue' }] }, c || {});
      const k = this._cfg;
      this.shadowRoot.innerHTML = `<style>
        :host { display:block; }
        ha-card { display:block; position:relative; overflow:hidden; height:${+k.height}px; cursor:pointer; background:transparent; box-shadow:none; border:none; }
        img { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); max-width:100%; max-height:100%; width:auto; height:auto; object-fit:contain; opacity:0;
          transition:opacity 5s ease-in-out; user-select:none; -webkit-user-drag:none; filter:drop-shadow(0 10px 18px rgba(0,0,0,.45)); }
        img.on { opacity:1; }
        .lab { position:absolute; left:14px; top:10px; pointer-events:none; color:#dbe9ff; font:700 15px/1.2 system-ui,sans-serif; letter-spacing:.03em; text-shadow:0 0 10px rgba(0,0,0,.7); }
        .lab small { display:block; margin-top:2px; font:500 12px system-ui; color:#8fb4dc; }
        .go { position:absolute; right:14px; bottom:12px; display:flex; align-items:center; gap:6px; padding:6px 12px 6px 10px; border-radius:99px; pointer-events:none;
          color:#8fe0ff; font:600 12px system-ui,sans-serif; letter-spacing:.08em; text-transform:uppercase; background:rgba(10,18,36,.78); border:1px solid rgba(110,200,255,.6); box-shadow:0 0 14px rgba(70,170,255,.45); --mdc-icon-size:18px; }
        ha-card:hover .go { box-shadow:0 0 22px rgba(70,170,255,.8); }
      </style>
      <ha-card>${k.images.map((m, i) => `<img data-i="${i}" src="${k.path}${m.file}?v=${k.version}" alt="${esc(m.name)}" draggable="false">`).join('')}
        <div class="lab">${esc(k.title)}<small></small></div><div class="go"><ha-icon icon="mdi:cube-scan"></ha-icon>Plan 3D</div></ha-card>`;
      this.shadowRoot.querySelector('ha-card').addEventListener('click', () => this._go());
      this._shown = -1; this._tick();
    }

    set hass(h) { this._hass = h; }
    getCardSize() { return 6; }
    getGridOptions() { return { columns: 'full', min_columns: 6, rows: 6, min_rows: 3 }; }
    static getStubConfig() { return {}; }

    connectedCallback() { this._tick(); this._timer = setInterval(() => this._tick(), 5000); }
    disconnectedCallback() { clearInterval(this._timer); this._timer = null; }

    // une vue par minute, en alternance (fondu enchaîné de 5 s)
    _tick() {
      if (!this._cfg) return;
      const i = Math.floor(Date.now() / PERIOD) % this._cfg.images.length;
      if (i === this._shown) return;
      this._shown = i;
      this.shadowRoot.querySelectorAll('img').forEach((im) => im.classList.toggle('on', +im.dataset.i === i));
      const sm = this.shadowRoot.querySelector('.lab small'); if (sm) sm.textContent = this._cfg.images[i].name;
    }

    _go() {
      history.pushState(null, '', this._cfg.navigation_path);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
    }
  }

  if (!customElements.get('maison-exterieur-card')) customElements.define('maison-exterieur-card', MaisonExterieurCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'maison-exterieur-card', name: 'Ma maison (vue 3D)', description: 'Vue 3D détourée (jardin / rue, change chaque minute), ouvre le plan 3D' });
})();
