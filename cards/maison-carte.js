/* Carte de robot recadrée : affiche une entité image (carte du robot) zoomée sur une zone, avec le nom des pièces par-dessus.
   Config : entity, crop: [x0, y0, x1, y1] (fractions de l'image d'origine), labels: [{ t, x, y }] (fractions de l'image d'origine), size (px de police),
   refresh (secondes mini entre deux mises à jour de l'image, 20 par défaut : évite que la position du robot saute trop souvent), refresh_entity (input_select dont l'état, ex. « 30 s », remplace refresh), max_height (px, hauteur de départ), frame_height (px, hauteur fixe du cadre ; la carte s'y ajuste), align: true (le cadre de la carte descend jusqu'au bas de la colonne voisine et la carte y est affichée au maximum). */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));   // valeurs de la config ou des entités : toujours échappées avant le HTML
  class MaisonCarteCard extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); this._src = ''; }

    setConfig(c) {
      if (!c || !c.entity || !Array.isArray(c.crop)) throw new Error('entity et crop requis');
      this._cfg = c; this._built = false;
    }

    set hass(h) { this._hass = h; if (!this._built) this._build(); this._refresh(); }
    getCardSize() { return 8; }
    getGridOptions() { return { columns: 'full', rows: 'auto' }; }
    static getStubConfig() { return { entity: '', crop: [0, 0, 1, 1] }; }

    _build() {
      const c = this._cfg, [x0, y0, x1, y1] = c.crop, w = x1 - x0, hgt = y1 - y0;
      this.shadowRoot.innerHTML = `<style>
        :host { display:block; }
        ha-card { overflow:hidden; cursor:pointer; display:flex; align-items:center; justify-content:center; min-height:260px; border-radius:20px; border:1.5px solid rgba(120,150,200,.22); background:var(--card-background-color,#101a30); }
        .box { position:relative; width:100%; margin:0 auto; overflow:hidden; aspect-ratio:1.25; }
        .ld { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font:600 13px system-ui,sans-serif; letter-spacing:.08em; color:var(--secondary-text-color,#9aa4b5); pointer-events:none; }
        .ld.gone { display:none; }
        .in { position:absolute; left:${(-x0 / w) * 100}%; top:${(-y0 / hgt) * 100}%; width:${100 / w}%; }
        .in img { display:block; width:100%; height:auto; user-select:none; -webkit-user-drag:none; }
        .l { position:absolute; transform:translate(-50%,-50%); text-align:center; white-space:nowrap; pointer-events:none;
          font:700 ${c.size || 13}px/1.15 system-ui,sans-serif; color:#10161f; text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 5px #fff; }
      </style><ha-card><div class="box"><div class="ld">Chargement de la carte…</div><div class="in"><img alt="carte">${(c.labels || []).map((l) =>
        `<span class="l" style="left:${l.x * 100}%;top:${l.y * 100}%">${esc(l.t).replace(/\n/g, '<br>')}</span>`).join('')}</div></div></ha-card>`;
      const img = this.shadowRoot.querySelector('img');
      img.addEventListener('error', () => this._retry());
      img.addEventListener('load', () => {
        this._tries = 0; this._ok = true; this.shadowRoot.querySelector('.ld').classList.add('gone');
        const box = this.shadowRoot.querySelector('.box');
        this._ar = (img.naturalWidth * w) / (img.naturalHeight * hgt);
        box.style.aspectRatio = `${this._ar}`;
        if (c.frame_height) {
          this.shadowRoot.querySelector('ha-card').style.height = c.frame_height + 'px';
          this._setH(c.frame_height);
        } else if (c.max_height) this._setH(c.max_height);
        this._watch();
      });
      this.shadowRoot.querySelector('ha-card').addEventListener('click', () =>
        this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: c.entity }, bubbles: true, composed: true })));
      this._built = true;
    }

    // l'image n'a pas pu se charger (jeton expiré, robot qui dort, onglet resté en cache) : on relit l'adresse à jour et on réessaie
    _retry() {
      if (this._rt || (this._tries || 0) >= 15) return;
      this._tries = (this._tries || 0) + 1;
      this._rt = setTimeout(() => { this._rt = null; this._reload(); }, Math.min(8000, 1500 * this._tries));
    }

    _reload() {
      const s = this._hass && this._hass.states[this._cfg.entity], pic = s && s.attributes.entity_picture, img = this.shadowRoot.querySelector('img'); if (!pic || !img) return;
      this._ok = false; this._src = pic + (pic.includes('?') ? '&' : '?') + 't=' + encodeURIComponent(s.state) + '&r=' + Date.now(); this._shown = Date.now(); img.src = this._src;
      clearTimeout(this._wd); this._wd = setTimeout(() => { if (!this._ok) this._retry(); }, 8000);
    }

    connectedCallback() {
      // le navigateur garde les onglets en mémoire : au retour sur l'onglet, on recharge la carte et on remet en place la surveillance de taille
      if (!this._built) return;
      this._ok = false; this._tries = 0; setTimeout(() => this._reload(), 50); this._watch();
    }

    _setH(h) { this.shadowRoot.querySelector('.box').style.width = `min(100%, ${Math.round(h * this._ar)}px)`; }

    _section() { let n = this; while (n) { if (n.localName === 'hui-section') return n; n = n.parentNode || n.host; } return null; }

    // le cadre de la carte descend jusqu'au bas de la colonne voisine (même rangée de sections) ; la carte y est affichée la plus grande possible
    _align() {
      if (!this._cfg.align || !this._ar) return;
      const sec = this._section(); if (!sec) return;
      const all = this._sections(sec);
      if (this._ro) all.forEach((e) => this._ro.observe(e));
      const mine = sec.getBoundingClientRect();
      let target = null;
      all.forEach((e) => {
        if (e === sec) return;
        const r = e.getBoundingClientRect();
        if (r.height > 0 && Math.abs(r.top - mine.top) < 40) target = Math.max(target === null ? 0 : target, r.bottom);
      });
      if (target === null) return;
      const card = this.shadowRoot.querySelector('ha-card'), box = this.shadowRoot.querySelector('.box');
      const H = Math.max(260, Math.round(target - card.getBoundingClientRect().top));
      if (card.style.height !== H + 'px') card.style.height = H + 'px';
      const W = Math.round(Math.min(card.getBoundingClientRect().width, H * this._ar));
      if (box.style.width !== W + 'px') box.style.width = W + 'px';
    }

    // toutes les sections de la vue (elles peuvent être enveloppées dans un conteneur : on remonte jusqu'à en trouver plusieurs)
    _sections(sec) {
      let n = sec.parentNode;
      while (n && !(n.querySelectorAll && n.querySelectorAll('hui-section').length > 1)) n = n.parentNode || n.host;
      return n ? [...n.querySelectorAll('hui-section')] : [sec];
    }

    _watch() {
      if (!this._cfg.align) return;
      const run = () => { cancelAnimationFrame(this._raf); this._raf = requestAnimationFrame(() => this._align()); };
      this._run = run;
      [200, 700, 1500, 3000].forEach((t) => setTimeout(run, t));
      const sec = this._section();
      if (sec && window.ResizeObserver && !this._ro) {
        this._ro = new ResizeObserver(run);
        this._ro.observe(sec);
        this._sections(sec).forEach((e) => { if (e !== sec) this._ro.observe(e); });
      }
      window.addEventListener('resize', run);
    }

    disconnectedCallback() { clearTimeout(this._timer); clearTimeout(this._rt); clearTimeout(this._wd); this._timer = null; this._rt = null; if (this._ro) { this._ro.disconnect(); this._ro = null; } if (this._run) window.removeEventListener('resize', this._run); }

    _refresh() {
      const s = this._hass.states[this._cfg.entity]; if (!s) return;
      const pic = s.attributes.entity_picture; if (!pic) return;
      const src = pic + (pic.includes('?') ? '&' : '?') + 't=' + encodeURIComponent(s.state);
      if (src === this._src) return;
      // l'image n'est rechargée qu'une fois toutes les `refresh` secondes (la dernière version reçue est affichée à l'échéance)
      const re = this._cfg.refresh_entity && this._hass.states[this._cfg.refresh_entity], rs = re ? parseFloat(re.state) : NaN,
        gap = (Number.isFinite(rs) ? rs : (this._cfg.refresh != null ? +this._cfg.refresh : 20)) * 1000, wait = (this._shown || 0) + gap - Date.now();
      this._pending = src;
      if (!this._src || wait <= 0) this._apply();
      else if (!this._timer) this._timer = setTimeout(() => this._apply(), wait);
    }

    _apply() {
      clearTimeout(this._timer); this._timer = null;
      if (!this._pending || this._pending === this._src) return;
      this._src = this._pending; this._shown = Date.now();
      const img = this.shadowRoot.querySelector('img'); if (img) img.src = this._src;
      clearTimeout(this._wd); this._wd = setTimeout(() => { if (!this._ok) this._retry(); }, 8000);
    }
  }

  if (!customElements.get('maison-carte-card')) customElements.define('maison-carte-card', MaisonCarteCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'maison-carte-card', name: 'Carte robot recadrée', description: 'Image de carte zoomée avec noms de pièces' });
})();
