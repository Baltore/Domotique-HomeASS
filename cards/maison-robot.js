/* Carte « robot aspirateur » : état, batterie, actions, nettoyage d'une pièce (puces) et réglages repliés, dans une seule carte.
   Config : vacuum, name, battery (capteur %), room (capteur pièce actuelle), color,
            rooms: { select: input_select dont les options sont les pièces, script: script à champ `pieces` (liste) }, settings: [{ entity, name, icon }] (select / switch) */
(() => {
  const COL = { amber: '#ffb84a', blue: '#4aa3ff', green: '#4cd08a', cyan: '#3cc4e8', purple: '#a98bff', pink: '#ff7ab8', red: '#ff5a5a', orange: '#ff9a4a', teal: '#35c9b8' };
  const col = (c) => COL[c] || c || COL.blue;
  const BAD = ['unavailable', 'unknown', 'none', ''];
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = (s) => { s = String(s).replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };
  const VAC = { docked: ['Sur la base', 'ok'], charging: ['Sur la base', 'ok'], idle: ['En veille', 'info'], cleaning: ['Nettoyage en cours', 'info'], paused: ['En pause', 'warn'],
    returning: ['Retour à la base', 'info'], error: ['Erreur', 'bad'], unavailable: ['Hors ligne', 'bad'], unknown: ['Inconnu', 'warn'] };

  class MaisonRobotCard extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); this._open = false; this._sel = new Set(); }
    setConfig(c) { if (!c || !c.vacuum) throw new Error('vacuum requis'); this._cfg = c; this._built = false; }
    set hass(h) { this._hass = h; if (!this._built) { this._build(); this._built = true; } this._update(); }
    getCardSize() { return 8; }
    getGridOptions() { return { columns: 'full', rows: 'auto' }; }
    st(id) { return this._hass && this._hass.states ? this._hass.states[id] : undefined; }
    call(d, s, data) { this._hass.callService(d, s, data); }
    q(sel) { return this.shadowRoot.querySelector(sel); }
    qa(sel) { return [...this.shadowRoot.querySelectorAll(sel)]; }
    more(id) { this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: id }, bubbles: true, composed: true })); }

    _build() {
      const c = this._cfg, r = c.rooms, set = c.settings || [];
      this.shadowRoot.innerHTML = `<style>
        :host { display:block; } ha-card { padding:0; background:transparent; box-shadow:none; border:none; }
        button, select { font:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
        .p { --c:${col(c.color)}; border-radius:20px; padding:14px; background:var(--card-background-color,#101a30); border:1.5px solid rgba(120,150,200,.2); transition:all .3s; }
        .p + .p { margin-top:10px; }
        .p.run { border-color:var(--c); background:linear-gradient(135deg,color-mix(in srgb,var(--c) 18%,var(--card-background-color,#101a30)),var(--card-background-color,#101a30) 72%); box-shadow:0 0 18px color-mix(in srgb,var(--c) 30%,transparent); }
        .hd { display:flex; align-items:center; gap:12px; --mdc-icon-size:28px; } .ic { flex:none; width:52px; height:52px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(130,150,190,.14); color:var(--secondary-text-color,#8fa3c4); transition:all .3s; }
        .run .ic { background:var(--c); color:#07121f; box-shadow:0 0 16px color-mix(in srgb,var(--c) 65%,transparent); } .tx { flex:1; min-width:0; } .tx b { display:block; font:700 17px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); margin-bottom:5px; }
        .pill { display:inline-flex; align-items:center; padding:4px 11px; border-radius:99px; font:700 12px system-ui,sans-serif; } .ok { background:rgba(60,220,150,.16); color:#7df0b8; } .info { background:rgba(60,170,255,.18); color:#8fdcff; } .warn { background:rgba(255,190,90,.18); color:#ffd08a; } .bad { background:rgba(255,100,100,.18); color:#ff9b9b; }
        .bt { position:relative; flex:none; width:58px; height:58px; cursor:pointer; } .bt svg { width:58px; height:58px; transform:rotate(-90deg); overflow:visible; } .bt circle { fill:none; stroke-width:4.5; stroke-linecap:round; } .bt .bg { stroke:rgba(130,150,190,.2); } .bt .fg { stroke:#4cd08a; transition:stroke-dasharray .8s; filter:drop-shadow(0 0 3px #4cd08a); }
        .bt b { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font:700 13px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); }
        .rm { margin-top:12px; display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:13px; background:rgba(130,150,190,.09); font:600 13px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); --mdc-icon-size:19px; } .rm ha-icon { color:#35c9b8; } .rm span { color:var(--secondary-text-color,#9aa4b5); font-weight:500; margin-right:auto; }
        .ac { display:grid; grid-template-columns:2fr 1fr 1fr; gap:8px; margin-top:12px; } .b { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; height:58px; border-radius:16px; border:1.5px solid rgba(130,150,190,.3); background:rgba(130,150,190,.1); color:var(--primary-text-color,#e6edf7); font:700 12.5px system-ui,sans-serif; --mdc-icon-size:23px; }
        .b:active { transform:scale(.96); } .b.go { background:linear-gradient(135deg,#1f7fe0,#35c9b8); border-color:transparent; color:#fff; box-shadow:0 4px 14px rgba(40,150,230,.3); } .b.pa { background:linear-gradient(135deg,#e08a1f,#ffb84a); border-color:transparent; color:#1a1005; }
        .lab { font:700 11px/1 system-ui,sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--secondary-text-color,#9aa4b5); display:flex; align-items:center; gap:8px; --mdc-icon-size:16px; margin-bottom:12px; }
        .lk { font:700 11px system-ui,sans-serif; letter-spacing:.08em; color:#8fdcff; cursor:pointer; margin-left:10px; text-transform:none; }
        .chips { display:flex; flex-wrap:wrap; gap:8px; } .chip { padding:8px 13px; border-radius:99px; border:1.5px solid rgba(130,150,190,.3); background:rgba(130,150,190,.08); color:var(--primary-text-color,#dbe9ff); font:600 13px system-ui,sans-serif; transition:all .2s; }
        .chip { display:inline-flex; align-items:center; gap:6px; } .chip::before { content:''; width:9px; height:9px; border-radius:50%; border:1.5px solid rgba(150,170,200,.6); transition:all .2s; }
        .chip.sel { background:color-mix(in srgb,var(--c) 28%,transparent); border-color:var(--c); color:#fff; box-shadow:0 0 10px color-mix(in srgb,var(--c) 40%,transparent); } .chip.sel::before { background:var(--c); border-color:var(--c); box-shadow:0 0 6px var(--c); }
        .clean.off { opacity:.4; background:rgba(130,150,190,.2); box-shadow:none; }
        .clean { margin-top:12px; width:100%; height:50px; border-radius:15px; border:0; background:linear-gradient(135deg,#1f7fe0,#35c9b8); color:#fff; font:700 15px system-ui,sans-serif; display:flex; align-items:center; justify-content:center; gap:8px; --mdc-icon-size:22px; box-shadow:0 4px 14px rgba(40,150,230,.3); } .clean:active { transform:scale(.98); }
        .mo { display:flex; align-items:center; justify-content:center; gap:6px; padding:11px; border-radius:16px; border:1px dashed rgba(130,150,190,.3); background:rgba(130,150,190,.06); color:var(--secondary-text-color,#9aa4b5); font:600 13px system-ui,sans-serif; --mdc-icon-size:20px; cursor:pointer; margin-top:10px; }
        .mo.open ha-icon:last-child { transform:rotate(180deg); } .set { display:none; margin-top:6px; } .set.open { display:block; }
        .rw { display:flex; align-items:center; gap:10px; padding:11px 4px; border-top:1px solid rgba(130,150,190,.14); cursor:pointer; --mdc-icon-size:20px; } .rw > ha-icon { color:var(--secondary-text-color,#9aa4b5); } .rw .nm { flex:1; font:500 14px system-ui,sans-serif; color:var(--primary-text-color,#e6edf7); }
        .rw select { max-width:160px; height:34px; border-radius:10px; border:1px solid rgba(130,150,190,.3); background:rgba(130,150,190,.1); color:var(--primary-text-color,#dbe9ff); padding:0 8px; font:13px system-ui,sans-serif; }
        .sw { flex:none; width:46px; height:28px; border-radius:14px; background:rgba(130,150,190,.28); position:relative; transition:background .3s; } .sw i { position:absolute; left:3px; top:3px; width:22px; height:22px; border-radius:50%; background:#cfd8ee; box-shadow:0 1px 4px rgba(0,0,0,.45); transition:transform .25s; } .sw.on { background:var(--c); } .sw.on i { transform:translateX(18px); background:#fff; }
      </style><ha-card>
        <div class="p"><div class="hd"><div class="ic"><ha-icon icon="mdi:robot-vacuum"></ha-icon></div><div class="tx"><b>${esc(c.name || 'Robot')}</b><span class="pill info st">—</span></div>
          <div class="bt"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" class="bg"/><circle cx="22" cy="22" r="18" class="fg" pathLength="100" stroke-dasharray="0 100"/></svg><b>—</b></div></div>
          ${c.room ? `<div class="rm"><ha-icon icon="mdi:floor-plan"></ha-icon><span>Pièce actuelle</span><b class="rn">—</b></div>` : ''}
          <div class="ac"><button class="b go" data-a="main"><ha-icon icon="mdi:play"></ha-icon><span>Démarrer</span></button><button class="b" data-a="dock"><ha-icon icon="mdi:home-import-outline"></ha-icon><span>Base</span></button><button class="b" data-a="locate"><ha-icon icon="mdi:map-marker-radius"></ha-icon><span>Où es-tu</span></button></div></div>
        ${r ? `<div class="p"><div class="lab"><ha-icon icon="mdi:floor-plan"></ha-icon><span style="flex:1">Nettoyer une ou plusieurs pièces</span><a class="lk" data-l="all">Tout</a><a class="lk" data-l="none">Effacer</a></div><div class="chips"></div><button class="clean"><ha-icon icon="mdi:play-circle"></ha-icon><span></span></button></div>` : ''}
        ${set.length ? `<div class="mo"><ha-icon icon="mdi:tune"></ha-icon><span>Réglages</span><ha-icon icon="mdi:chevron-down"></ha-icon></div><div class="p set">${set.map((x, i) => `<div class="rw" data-s="${i}"><ha-icon icon="${x.icon}"></ha-icon><span class="nm">${esc(x.name)}</span><span class="ctl"></span></div>`).join('')}</div>` : ''}
      </ha-card>`;
      this.shadowRoot.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const v = c.vacuum, s = this.st(v), stt = s ? s.state : 'unavailable';
        if (b.dataset.a === 'main') this.call('vacuum', stt === 'cleaning' ? 'pause' : 'start', { entity_id: v });
        else if (b.dataset.a === 'dock') this.call('vacuum', 'return_to_base', { entity_id: v });
        else if (b.dataset.a === 'locate') this.call('vacuum', 'locate', { entity_id: v });
        else if (b.classList.contains('clean')) {
          const list = [...this._sel]; if (!list.length) return;
          if (window.confirm(`Nettoyer ${list.length > 1 ? list.length + ' pièces' : '1 pièce'} : ${list.join(', ')} ?`)) { this.call('script', r.script.replace(/^script\./, ''), { pieces: list }); this._sel.clear(); this._update(); }
        }
      });
      this.q('.chips') && this.q('.chips').addEventListener('click', (e) => { const ch = e.target.closest('.chip'); if (!ch) return; const o = ch.dataset.o; if (this._sel.has(o)) this._sel.delete(o); else this._sel.add(o); this._update(); });
      this.qa('.lk').forEach((a) => a.addEventListener('click', () => { const sel = this.st(r.select), opts = (sel && sel.attributes.options) || []; this._sel = new Set(a.dataset.l === 'all' ? opts : []); this._update(); }));
      this.q('.bt').addEventListener('click', () => this.more(c.vacuum));
      const mo = this.q('.mo'); if (mo) mo.addEventListener('click', () => { mo.classList.toggle('open'); this.q('.set').classList.toggle('open'); });
      this.qa('.rw').forEach((el) => {
        const it = set[+el.dataset.s], d = it.entity.split('.')[0], ctl = el.querySelector('.ctl');
        if (d === 'switch') { ctl.className = 'ctl sw'; ctl.innerHTML = '<i></i>'; el.addEventListener('click', () => this.call('homeassistant', 'toggle', { entity_id: it.entity })); }
        else { ctl.innerHTML = '<select></select>'; ctl.firstChild.addEventListener('change', (ev) => { this.call('select', 'select_option', { entity_id: it.entity, option: ev.target.value }); this._busy = Date.now() + 1500; }); ctl.addEventListener('click', (ev) => ev.stopPropagation()); }
      });
    }

    _update() {
      const c = this._cfg, s = this.st(c.vacuum), stt = s ? s.state : 'unavailable', [lab, k] = VAC[stt] || [cap(stt), 'info'];
      const run = stt === 'cleaning' || stt === 'returning';
      this.q('.p').classList.toggle('run', run);
      const pill = this.q('.st'); pill.textContent = lab; pill.className = `pill ${k} st`;
      const bs = c.battery && this.st(c.battery), bn = bs ? num(bs.state) : (s && num(s.attributes.battery_level));
      this.q('.bt b').textContent = bn === null ? '—' : `${Math.round(bn)}%`; const fg = this.q('.bt .fg');
      fg.setAttribute('stroke-dasharray', `${bn === null ? 0 : Math.max(0, Math.min(100, bn))} 100`); fg.style.stroke = bn !== null && bn < 20 ? '#ff5a5a' : '#4cd08a';
      if (c.room) { const rs = this.st(c.room); this.q('.rn').textContent = rs && !BAD.includes(rs.state) ? rs.state : '—'; }
      const main = this.q('[data-a="main"]'), cl = stt === 'cleaning';
      main.className = `b ${cl ? 'pa' : 'go'}`; main.querySelector('ha-icon').setAttribute('icon', cl ? 'mdi:pause' : 'mdi:play'); main.querySelector('span').textContent = cl ? 'Pause' : stt === 'paused' ? 'Reprendre' : 'Démarrer';
      const r = c.rooms;
      if (r) {
        const sel = this.st(r.select), opts = (sel && sel.attributes.options) || [], box = this.q('.chips'), key = opts.join('|');
        if (box.dataset.k !== key) { box.innerHTML = opts.map((o) => `<button class="chip" data-o="${esc(o)}">${esc(o)}</button>`).join(''); box.dataset.k = key; }
        this.qa('.chip').forEach((ch) => ch.classList.toggle('sel', this._sel.has(ch.dataset.o)));
        const n = this._sel.size, cl = this.q('.clean'); cl.classList.toggle('off', n === 0);
        cl.querySelector('span').textContent = n === 0 ? 'Choisis une ou plusieurs pièces' : `Nettoyer ${n} pièce${n > 1 ? 's' : ''}`;
      }
      this.qa('.rw').forEach((el) => {
        const it = (c.settings || [])[+el.dataset.s], x = this.st(it.entity), d = it.entity.split('.')[0], ctl = el.querySelector('.ctl');
        el.style.opacity = x && x.state !== 'unavailable' ? '' : '.45';
        if (d === 'switch') ctl.classList.toggle('on', !!x && x.state === 'on');
        else if (x) { const sel = ctl.firstChild, o = x.attributes.options || [], key = o.join('|'); if (sel.dataset.k !== key) { sel.innerHTML = o.map((y) => `<option>${esc(y)}</option>`).join(''); sel.dataset.k = key; } if (!(this._busy > Date.now())) sel.value = x.state; }
      });
    }
  }

  if (!customElements.get('maison-robot-card')) customElements.define('maison-robot-card', MaisonRobotCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'maison-robot-card', name: 'Robot aspirateur', description: 'État, batterie, actions, pièces et réglages' });
})();
