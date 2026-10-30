/* Plan 3D en direct de la maison : modèle GLB (three.js), rotation à 360°, 3 étages, murs dynamiques,
   boutons de lumière par pièce, appareils avec fiche (Livebox, litière, purificateur, imprimante, robots aspirateurs). */
(() => {
  const VERSION = '11';

  // Entités Home Assistant utilisées par les fiches d'appareils (box internet, litière, purificateur, imprimante).
  // Valeurs de démonstration : à remplacer par les tiennes, soit ici, soit dans scene.json (clé « entities »).
  const ENT = {
    router_wan: 'binary_sensor.demo_router_wan',
    router_ip: 'sensor.demo_router_external_ip',
    router_down: 'sensor.demo_router_download',
    router_up: 'sensor.demo_router_upload',
    litter_state: 'sensor.demo_litter_state',
    litter_last_duration: 'sensor.demo_litter_last_duration',
    litter_last_by: 'sensor.demo_litter_last_by',
    litter_error: 'sensor.demo_litter_error',
    litter_bin: 'binary_sensor.demo_litter_bin',
    litter_level: 'sensor.demo_litter_level',
    litter_weight: 'sensor.demo_litter_weight',
    litter_count: 'sensor.demo_litter_count',
    purifier_fan: 'fan.demo_air_purifier',
    purifier_pm25: 'sensor.demo_air_pm25',
    purifier_filter: 'sensor.demo_air_filter',
    ink_black: 'sensor.demo_printer_ink_black',
    ink_cyan: 'sensor.demo_printer_ink_cyan',
    ink_magenta: 'sensor.demo_printer_ink_magenta',
    ink_yellow: 'sensor.demo_printer_ink_yellow',
    printer_state: 'sensor.demo_printer_state',
  };


  const scripts = (window.__m3dScripts = window.__m3dScripts || {});   // partagé avec la maquette extérieure : three.js n'est chargé qu'une fois
  const loadScript = (src) => {
    const k = src.split('?')[0];
    if (!scripts[k]) {
      scripts[k] = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = () => rej(new Error('Chargement impossible : ' + src));
        document.head.appendChild(s);
      });
    }
    return scripts[k];
  };
  let libsPromise = null;
  const ensureLibs = (base) => {
    if (!libsPromise) {
      libsPromise = (async () => {
        if (!window.THREE) await loadScript(`${base}lib/three.min.js?v=${VERSION}`);
        if (!window.THREE.GLTFLoader) await loadScript(`${base}lib/GLTFLoader.js?v=${VERSION}`);
      })();
    }
    return libsPromise;
  };

  // ---------------------------------------------------------------------------------------- formats
  // toute valeur venue d'une entité (titre média, unité, texte d'état…) est échappée avant d'entrer dans le HTML des fiches
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n.toLocaleString('fr-FR', { maximumFractionDigits: d }) : esc(v); };
  const hhmm = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const rel = (d) => {
    const m = Math.round((Date.now() - d.getTime()) / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`;
    const j = Math.floor(h / 24);
    return j === 1 ? 'hier' : `il y a ${j} j`;
  };
  const dayTime = (d) => {
    const t = new Date(), y = new Date(Date.now() - 864e5);
    if (d.toDateString() === t.toDateString()) return hhmm(d);
    if (d.toDateString() === y.toDateString()) return 'hier ' + hhmm(d);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + hhmm(d);
  };
  const dur = (s) => { s = Math.round(parseFloat(s)); if (!Number.isFinite(s)) return '—'; const m = Math.floor(s / 60); return m ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`; };
  const cap = (s) => { s = String(s).replace(/_/g, ' '); return esc(s.charAt(0).toUpperCase() + s.slice(1)); };

  const LITTER = { idle: 'En veille', working: 'En marche', cleaning: 'Nettoyage en cours', cat_in: 'Chat dans le bac', cat_inside: 'Chat dans le bac',
    maintenance: 'Maintenance', paused: 'En pause', error: 'Erreur', dumping: 'Vidange en cours', odor_removing: 'Désodorisation', resetting: 'Réinitialisation' };
  const PRINTER = { idle: ['Prête', 'ok'], printing: ['Impression en cours', 'info'], stopped: ['Arrêtée', 'warn'], unavailable: ['Hors ligne', 'bad'] };
  const VAC = { docked: ['Sur la base', 'ok'], charging: ['Sur la base', 'ok'], idle: ['En veille', 'info'], cleaning: ['Nettoyage en cours', 'info'], paused: ['En pause', 'warn'],
    returning: ['Retour à la base', 'info'], error: ['Erreur', 'bad'], unavailable: ['Hors ligne', 'bad'], unknown: ['Inconnu', 'warn'] };
  const inks = () => [['Noir', ENT.ink_black, '#cfd8ee'], ['Cyan', ENT.ink_cyan, '#27c6ff'],
    ['Magenta', ENT.ink_magenta, '#ff4fa3'], ['Jaune', ENT.ink_yellow, '#ffd23f']];

  // ---------------------------------------------------------------------------------------- fiches des appareils
  const row = (l, v) => `<div class="row"><span>${l}</span><b>${v}</b></div>`;
  const pill = (t, k) => `<span class="pill ${k}">${t}</span>`;
  const MP_OFF = ['off', 'standby', 'unavailable', 'unknown'];
  const mediaBlock = (a, id, title) => {
    const s = a.st(id); if (!s) return `<div class="mp">${row(title, pill('Indisponible', 'bad'))}</div>`;
    const at = s.attributes || {}, f = at.supported_features || 0;
    const on = !MP_OFF.includes(s.state);
    let h = `<div class="mp"><div class="pw"><button class="big ${on ? 'on' : ''}" data-act="mp-power" data-id="${id}" aria-label="Allumer ou éteindre"><ha-icon icon="mdi:power"></ha-icon></button>
      <div><b>${title}</b><small>${s.state === 'unavailable' ? 'Indisponible' : on ? (at.media_title ? esc(at.media_title) : at.app_name ? esc(at.app_name) : cap(s.state)) : 'Éteint'}</small></div></div>`;
    if (on) {
      const vl = typeof at.volume_level === 'number' ? Math.round(at.volume_level * 100) : null;
      if (vl != null || (f & 1024)) {
        h += `<div class="vol"><button data-act="mp-mute" data-id="${id}" aria-label="Muet"><ha-icon icon="${at.is_volume_muted ? 'mdi:volume-off' : 'mdi:volume-high'}"></ha-icon></button>
          <button data-act="mp-vdown" data-id="${id}" aria-label="Volume moins"><ha-icon icon="mdi:volume-minus"></ha-icon></button>`;
        if (vl != null) h += `<input type="range" min="0" max="100" value="${vl}" data-act="mp-vset" data-id="${id}" aria-label="Volume">`; else h += '<span class="grow"></span>';
        h += `<button data-act="mp-vup" data-id="${id}" aria-label="Volume plus"><ha-icon icon="mdi:volume-plus"></ha-icon></button></div>`;
        if (vl != null) h += `<div class="vl">${vl} %</div>`;
      }
      if (f & (16384 | 1)) h += `<div class="seg tp"><button data-act="mp-prev" data-id="${id}"><ha-icon icon="mdi:skip-previous"></ha-icon></button>
        <button data-act="mp-pp" data-id="${id}"><ha-icon icon="${s.state === 'playing' ? 'mdi:pause' : 'mdi:play'}"></ha-icon></button>
        <button data-act="mp-next" data-id="${id}"><ha-icon icon="mdi:skip-next"></ha-icon></button></div>`;
      if (Array.isArray(at.source_list) && at.source_list.length) {
        h += `<select data-act="mp-src" data-id="${id}" aria-label="Source">` + at.source_list.map((x) => `<option ${x === at.source ? 'selected' : ''}>${esc(x)}</option>`).join('') + '</select>';
      }
    }
    return h + '</div>';
  };
  const PANELS = {
    livebox: {
      title: 'Box internet', icon: 'mdi:router-wireless',
      render(a) {
        const w = a.st(ENT.router_wan);
        const up = w && w.state === 'on';
        const speed = (id) => {
          const s = a.st(id); if (!s || ['unknown', 'unavailable'].includes(s.state)) return '—';
          const u = (s.attributes.unit_of_measurement || '');
          return u === 'MB/s' ? `${num(parseFloat(s.state) * 8, 1)} Mb/s` : `${num(s.state, 1)} ${esc(u)}`;
        };
        const ip = a.st(ENT.router_ip);
        const lab = up ? 'Connectée' : (w ? 'Hors ligne' : 'Indisponible');
        return { sub: up ? 'Connectée à Internet' : lab,
          html: row('État', pill(lab, up ? 'ok' : 'bad')) + row('IP externe', ip ? esc(ip.state) : '—') +
            row('Débit descendant', speed(ENT.router_down)) + row('Débit montant', speed(ENT.router_up)) };
      },
    },
    litter: {
      title: 'Litière automatique', icon: 'mdi:cat',
      render(a) {
        const et = a.st(ENT.litter_state);
        const lab = et ? (LITTER[et.state] || cap(et.state)) : 'Indisponible';
        const last = a.st(ENT.litter_last_duration) || a.st(ENT.litter_last_by);
        const who = a.st(ENT.litter_last_by);
        const d = last && last.last_changed ? new Date(last.last_changed) : null;
        const err = a.st(ENT.litter_error);
        const bin = a.st(ENT.litter_bin);
        const lvl = a.st(ENT.litter_level);
        const wt = a.st(ENT.litter_weight);
        const n = a.st(ENT.litter_count);
        const dd = a.st(ENT.litter_last_duration);
        let h = row('Statut', pill(lab, et && et.state === 'idle' ? 'ok' : 'info'));
        h += row('Dernier passage', d ? `${who && who.state && who.state !== 'unknown' ? esc(who.state) + ' · ' : ''}${dayTime(d)}<small>${rel(d)}</small>` : '—');
        if (dd) h += row('Durée', dur(dd.state));
        if (wt) h += row('Poids', `${num(wt.state, 1)} kg`);
        if (n) h += row("Passages aujourd'hui", num(n.state));
        if (lvl) h += row('Litière', `${num(lvl.state)} %`);
        if (bin) h += row('Bac à déchets', pill(bin.state === 'on' ? 'À vider' : 'OK', bin.state === 'on' ? 'warn' : 'ok'));
        if (err && err.state !== 'no_error') h += row('Erreur', pill(cap(err.state), 'bad'));
        return { sub: lab, html: h };
      },
    },
    purifier: {
      title: "Purificateur d'air", icon: 'mdi:air-purifier',
      render(a) {
        const f = a.st(ENT.purifier_fan);
        const on = f && f.state === 'on';
        const p = f && f.attributes.percentage ? f.attributes.percentage : 0;
        const cur = on ? Math.max(20, Math.min(100, Math.round(p / 20) * 20)) : 0;
        const pm = a.st(ENT.purifier_pm25);
        const fl = a.st(ENT.purifier_filter);
        const mode = f && f.attributes.preset_mode;
        const seg = [20, 40, 60, 80, 100].map((v, i) => `<button class="${cur === v ? 'on' : ''}" data-act="fan-pct" data-v="${v}">${i + 1}</button>`).join('');
        return { sub: !f ? 'Indisponible' : (on ? `Allumé${mode ? ' · ' + esc(mode) : ''}` : 'Éteint'),
          html: `<div class="pw"><button class="big ${on ? 'on' : ''}" data-act="fan-toggle" aria-label="Allumer ou éteindre"><ha-icon icon="mdi:power"></ha-icon></button>
            <div><b>${on ? 'Allumé' : 'Éteint'}</b><small>${on ? `Puissance ${cur / 20} sur 5` : 'Touche pour allumer'}</small></div></div>
            <div class="lab2">Puissance</div><div class="seg">${seg}</div>` +
            (pm ? row('PM2.5', `${num(pm.state)} µg/m³`) : '') + (fl ? row('Filtre', `${num(fl.state)} %`) : '') };
      },
    },

    robot: {
      title: 'Robot aspirateur', icon: 'mdi:robot-vacuum',
      render(a) {
        const d = a.panelOpen.def, s = a.st(d.entity);
        const [lab, k] = s ? (VAC[s.state] || [cap(s.state), 'info']) : ['Indisponible', 'bad'];
        const b = d.battery && a.st(d.battery), lvl = b && Number.isFinite(parseFloat(b.state)) ? Math.round(parseFloat(b.state)) : null;
        const st = s ? s.state : 'unavailable';
        const main = st === 'cleaning' ? ['pause', 'mdi:pause', 'Pause'] : [st === 'paused' ? 'resume' : 'start', 'mdi:play', st === 'paused' ? 'Reprendre' : 'Démarrer'];
        const btn = (act, ic, t) => `<button data-act="vac-${act}" data-id="${d.entity}"><ha-icon icon="${ic}"></ha-icon><span>${t}</span></button>`;
        const er = s && s.attributes && s.attributes.error;
        const err = er && !/no error|^none$/i.test(String(er)) ? row('Erreur', pill(cap(er), 'bad')) : '';
        return { title: d.name, sub: lab,
          html: (d.image ? `<div class="rb"><img src="${a.base}robots/${d.image}?v=${VERSION}" alt="" draggable="false"></div>` : '') + row('État', pill(lab, k)) +
            (lvl !== null ? `<div class="ink"><span>Batterie</span><div class="bar2"><i style="width:${lvl}%;background:${lvl < 20 ? '#ff5a5a' : '#4cd08a'}"></i></div><b class="${lvl < 20 ? 'low' : ''}">${lvl} %</b></div>` : '') + err +
            `<div class="seg vc">${btn(main[0], main[1], main[2])}${btn('dock', 'mdi:home-import-outline', 'Base')}${btn('locate', 'mdi:map-marker-radius', 'Où es-tu')}</div>` };
      },
    },
    media: {
      title: 'TV', icon: 'mdi:television',
      render(a) {
        const d = a.panelOpen.def;
        const ids = [d.entity, d.with].filter(Boolean);
        const blocks = ids.map((id, i) => mediaBlock(a, id, i === 0 ? 'Télévision' : 'Barre de son')).join('');
        const first = a.st(d.entity);
        const on = first && !['off', 'standby', 'unavailable', 'unknown'].includes(first.state);
        return { title: d.with ? 'TV et barre de son' : d.name, sub: on ? 'Allumée' : 'Éteinte', html: blocks };
      },
    },
    printer: {
      title: 'Imprimante', icon: 'mdi:printer',
      render(a) {
        const s = a.st(ENT.printer_state);
        const [lab, k] = s ? (PRINTER[s.state] || [cap(s.state), 'info']) : ['Indisponible', 'bad'];
        const bars = inks().map(([n, id, col]) => {
          const e = a.st(id); const v = e && Number.isFinite(parseFloat(e.state)) ? Math.max(0, Math.min(100, parseFloat(e.state))) : null;
          return `<div class="ink"><span>${n}</span><div class="bar2"><i style="width:${v == null ? 0 : v}%;background:${col}"></i></div><b class="${v != null && v < 15 ? 'low' : ''}">${v == null ? '—' : v + ' %'}</b></div>`;
        }).join('');
        return { sub: lab, html: row('Statut', pill(lab, k)) + `<div class="lab2">Niveau d'encre</div>${bars}` };
      },
    },
  };

  const CSS = `
    :host { display:block; height: calc(100vh - var(--header-height, 56px)); min-height: 420px; position: relative; overflow: hidden; }
    .root { position:absolute; inset:0; overflow:hidden; user-select:none; -webkit-user-select:none; touch-action:none; cursor:grab;
      background: radial-gradient(ellipse 65% 55% at 50% 58%, rgba(40,100,190,.25), rgba(0,0,0,0) 72%); --cyan:#5cd6ff; font-family: system-ui, sans-serif; }
    .root.drag { cursor:grabbing; }
    canvas { position:absolute; inset:0; width:100%; height:100%; display:block; outline:none; }
    .hs { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
    .pt { position:absolute; left:0; top:0; width:0; height:0; will-change: transform; transition: opacity .35s; opacity:0; }
    .badge { position:absolute; left:0; top:0; transform: translate(-50%,-50%); width:40px; height:40px; border-radius:50%;
      background: rgba(10,18,36,.72); border:1px solid rgba(110,200,255,.6); box-shadow: 0 0 14px rgba(70,170,255,.5), inset 0 0 10px rgba(70,170,255,.18);
      display:flex; align-items:center; justify-content:center; color:#9fd8ff; --mdc-icon-size:22px; pointer-events:auto; cursor:pointer;
      backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); transition: box-shadow .3s, color .3s, border-color .3s, background .3s; }
    .badge.room { width:46px; height:46px; --mdc-icon-size:25px; }
    .badge.room.on { color:#ffd58a; border-color:rgba(255,200,120,.95); box-shadow: 0 0 20px rgba(255,190,100,.9), inset 0 0 12px rgba(255,190,100,.35); background: rgba(56,38,10,.75); }
    .badge.room.off { color:#8fa3c4; }
    .badge.room.none { color:#5d6b85; border:1px dashed rgba(120,140,170,.45); box-shadow:none; }
    .badge.media.on, .badge.panel.on { color:#7fe0ff; border-color:rgba(120,230,255,.95); box-shadow: 0 0 18px rgba(80,200,255,.85); }
    .badge.media.off { color:#6c7a93; border-color:rgba(120,140,170,.35); box-shadow:none; }
    .badge.unav { color:#4a5468; border:1px dashed rgba(120,140,170,.4); box-shadow:none; }
    .badge.bad { color:#ff9b9b; border-color:rgba(255,120,120,.8); box-shadow:0 0 14px rgba(255,90,90,.55); }
    .lab { position:absolute; left:0; top:30px; transform: translateX(-50%); font: 600 11px/1 system-ui, sans-serif; letter-spacing:.05em; color:#9fb4d6;
      text-shadow:0 0 6px rgba(0,0,0,.9); white-space:nowrap; pointer-events:none; }
    .lab.sens { top:28px; font-size:12px; color:#aeeaff; text-shadow:0 0 8px #19b0ff; }
    .lab.on { color:#ffd9a0; }
    .dots { position:absolute; right:18px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:14px; align-items:flex-end; z-index:5; }
    .dot { display:flex; align-items:center; gap:10px; cursor:pointer; color:rgba(160,190,230,.5); font:500 11px/1 system-ui,sans-serif; letter-spacing:.18em; text-transform:uppercase; transition: color .4s; }
    .dot i { width:8px; height:8px; border-radius:50%; background: currentColor; transition: all .4s; }
    .dot.act { color:#7fe3ff; } .dot.act i { box-shadow:0 0 12px 2px #3cc8ff; transform: scale(1.35); }
    .title { position:absolute; left:22px; top:18px; color:rgba(170,215,255,.85); font:300 13px/1 system-ui,sans-serif; letter-spacing:.35em; text-transform:uppercase; z-index:5; pointer-events:none; }
    .title b { font-weight:600; color:#7fe3ff; }
    .hint { position:absolute; left:50%; bottom:18px; transform:translateX(-50%); color:rgba(170,200,240,.55); font:500 12px/1.4 system-ui,sans-serif; letter-spacing:.08em;
      transition: opacity 1.2s; pointer-events:none; z-index:5; text-align:center; width:92%; }
    .hint.gone { opacity:0; }
    .load { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; color:#9fd8ff; z-index:9;
      font:300 13px/1 system-ui,sans-serif; letter-spacing:.3em; text-transform:uppercase; transition: opacity .8s; pointer-events:none; }
    .load.gone { opacity:0; }
    .bar { width:220px; height:2px; background:rgba(120,170,230,.2); overflow:hidden; border-radius:2px; }
    .bar i { display:block; height:100%; width:0%; background:linear-gradient(90deg,#2aa8ff,#7fe3ff); box-shadow:0 0 10px #3cc8ff; transition: width .25s; }
    .err { color:#ff8a8a; letter-spacing:.05em; text-transform:none; max-width:80%; text-align:center; }
    .panel { position:absolute; left:0; top:0; width:296px; z-index:8; padding:14px 16px 16px; border-radius:18px; color:#dbe9ff; font:13px/1.35 system-ui,sans-serif;
      background: rgba(9,16,32,.84); border:1px solid rgba(110,200,255,.4); box-shadow: 0 0 28px rgba(60,160,255,.28), 0 18px 40px rgba(0,0,0,.5);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); cursor:default; user-select:none; touch-action:manipulation; display:none; }
    .panel.show { display:block; animation: pop .22s ease-out; }
    @keyframes pop { from { opacity:0; } to { opacity:1; } }
    .ph { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
    .ph .ic { width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(60,160,255,.15); border:1px solid rgba(110,200,255,.5); color:#8fdcff; --mdc-icon-size:21px; }
    .ph .tt { flex:1; min-width:0; } .ph .tt b { display:block; font-size:15px; font-weight:600; letter-spacing:.02em; } .ph .tt small { color:#8fa3c4; }
    .ph .x { background:none; border:0; color:#8fa3c4; cursor:pointer; font-size:20px; line-height:1; padding:4px 6px; border-radius:8px; }
    .ph .x:hover { color:#fff; background:rgba(255,255,255,.08); }
    .row { display:flex; justify-content:space-between; align-items:baseline; gap:12px; padding:7px 0; border-top:1px solid rgba(120,170,230,.14); }
    .row span { color:#8fa3c4; } .row b { font-weight:600; text-align:right; } .row small { color:#7f92b3; font-weight:400; display:block; }
    .pill { display:inline-block; padding:2px 10px; border-radius:99px; font-size:12px; font-weight:600; }
    .pill.ok { background:rgba(60,220,150,.16); color:#7df0b8; } .pill.info { background:rgba(60,170,255,.18); color:#8fdcff; }
    .pill.warn { background:rgba(255,190,90,.18); color:#ffd08a; } .pill.bad { background:rgba(255,100,100,.18); color:#ff9b9b; }
    .lab2 { margin:10px 0 6px; color:#8fa3c4; font-size:12px; letter-spacing:.08em; text-transform:uppercase; }
    .seg { display:flex; gap:6px; margin-bottom:6px; }
    .seg button { flex:1; height:34px; border-radius:10px; border:1px solid rgba(110,200,255,.35); background:rgba(20,40,70,.6); color:#cfe6ff; font:600 14px system-ui; cursor:pointer; }
    .seg button.on { background:rgba(60,170,255,.35); border-color:#6fd0ff; color:#fff; box-shadow:0 0 12px rgba(70,180,255,.5); }
    .pw { display:flex; align-items:center; gap:12px; margin:2px 0 4px; } .pw small { display:block; color:#8fa3c4; }
    .pw .big { width:52px; height:52px; border-radius:50%; border:1px solid rgba(110,200,255,.5); background:rgba(20,40,70,.7); color:#8fa3c4; cursor:pointer; --mdc-icon-size:26px; display:flex; align-items:center; justify-content:center; }
    .pw .big.on { color:#fff; background:rgba(60,170,255,.4); box-shadow:0 0 18px rgba(70,180,255,.7); border-color:#6fd0ff; }
    .mp + .mp { margin-top:12px; padding-top:10px; border-top:1px solid rgba(120,170,230,.2); }
    .vol { display:flex; align-items:center; gap:6px; margin:8px 0 2px; } .vol .grow { flex:1; }
    .vol button { width:36px; height:34px; border-radius:10px; border:1px solid rgba(110,200,255,.35); background:rgba(20,40,70,.6); color:#cfe6ff; cursor:pointer; --mdc-icon-size:20px; display:flex; align-items:center; justify-content:center; }
    .vol input[type=range] { flex:1; min-width:0; accent-color:#4cc6ff; height:28px; }
    .vl { text-align:right; color:#8fa3c4; font-size:12px; margin:0 4px 6px 0; }
    .seg.tp { margin-top:8px; } .seg.tp button { --mdc-icon-size:20px; display:flex; align-items:center; justify-content:center; }
    .mp select { width:100%; margin-top:8px; height:36px; border-radius:10px; border:1px solid rgba(110,200,255,.35); background:rgba(20,40,70,.8); color:#dbe9ff; padding:0 8px; font:13px system-ui; }
    .rb { display:flex; justify-content:center; margin:0 0 6px; } .rb img { height:78px; max-width:100%; object-fit:contain; filter:drop-shadow(0 6px 10px rgba(0,0,0,.5)); pointer-events:none; }
    .seg.vc { margin-top:10px; } .seg.vc button { height:50px; flex-direction:column; gap:1px; font:600 11px system-ui; --mdc-icon-size:20px; display:flex; align-items:center; justify-content:center; }
    .ink { display:flex; align-items:center; gap:10px; padding:4px 0; } .ink span { width:58px; color:#8fa3c4; }
    .ink .bar2 { flex:1; height:8px; border-radius:6px; background:rgba(120,170,230,.16); overflow:hidden; } .ink .bar2 i { display:block; height:100%; border-radius:6px; }
    .ink b { width:44px; text-align:right; font-weight:600; } .ink b.low { color:#ff9b9b; }
  `;

  class App {
    constructor(base) {
      this.base = base;
      this.floor = 0;
      this.az = 0.35; this.elev = 0.74; this.zoom = 1; this.vAz = 0;
      this.tgt = { el: this.elev, zoom: this.zoom };
      this.hass = null; this.anim = null;
      this.hs = []; this.walls = []; this.pool = [];
      this.panelOpen = null;
      this.minDt = 1000 / 60;
      this._buildDom();
      this.ready = this._init().catch((e) => this._fail(e));
    }

    st(id) { return this.hass && this.hass.states ? this.hass.states[id] : undefined; }

    _buildDom() {
      const r = this.root = document.createElement('div');
      r.className = 'root';
      r.innerHTML = `<style>${CSS}</style>
        <div class="hs"></div>
        <div class="title"><b class="ttl">RDC</b> · plan 3D</div>
        <div class="dots"></div>
        <div class="hint">Glisse ↔ pour tourner · molette ou glisse ↓ pour monter d'un étage, ↑ pour descendre · pince ou Ctrl+molette pour zoomer</div>
        <div class="panel"></div>
        <div class="load"><span class="lt">Chargement du plan</span><div class="bar"><i></i></div></div>`;
      this.el = { dotsBox: r.querySelector('.dots'), hs: r.querySelector('.hs'), ttl: r.querySelector('.ttl'), hint: r.querySelector('.hint'), load: r.querySelector('.load'), panel: r.querySelector('.panel'),
        lt: r.querySelector('.lt'), bar: r.querySelector('.bar i'), dots: [] };
      const p = this.el.panel;
      ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel', 'touchstart', 'touchmove', 'touchend'].forEach((t) => p.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
      p.addEventListener('click', (e) => this._panelClick(e));
      p.addEventListener('change', (e) => { const t = e.target; if (t.dataset && (t.dataset.act === 'mp-vset' || t.dataset.act === 'mp-src') && this.hass) this._mediaAct(t.dataset.act, t.dataset.id, t); });
      p.addEventListener('pointerdown', (e) => { if (e.target.closest('input,select')) this._panelBusy = Date.now() + 6000; });
      r.addEventListener('contextmenu', (e) => e.preventDefault());
      ['touchstart', 'touchmove', 'touchend'].forEach((t) => r.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
      setTimeout(() => this.el.hint.classList.add('gone'), 10000);
    }

    _fail(e) {
      console.error('[maison-3d]', e);
      this.el.bar.parentNode.style.display = 'none';
      this.el.lt.className = 'lt err';
      this.el.lt.textContent = 'Plan 3D indisponible : ' + (e && e.message ? e.message : e);
    }

    async _init() {
      await ensureLibs(this.base);
      const THREE = window.THREE;
      const sc = this.cfg = await (await fetch(`${this.base}scene.json?v=${VERSION}`)).json();
      Object.assign(ENT, sc.entities || {});
      this.C = new THREE.Vector3(...sc.center);
      this.NF = sc.floors.length;
      this.look = this._look(0);
      this.alpha = sc.floors.map((_, i) => (i === 0 ? 1 : 0));
      this.el.dotsBox.innerHTML = sc.floors.map((f, i) => `<div class="dot${i === 0 ? ' act' : ''}" data-f="${i}"><span>${f.name}</span><i></i></div>`).reverse().join('');
      this.el.dots = [...this.el.dotsBox.querySelectorAll('.dot')];
      this.el.dots.forEach((d) => {
        d.addEventListener('pointerdown', (e) => e.stopPropagation());
        d.addEventListener('click', (e) => { e.stopPropagation(); this.setFloor(+d.dataset.f); });
      });

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
      } catch (e) { throw new Error('WebGL non disponible sur cet appareil'); }
      this.renderer = renderer;
      this.pr = Math.min(window.devicePixelRatio || 1, 1.75);
      renderer.setPixelRatio(this.pr);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = false;
      renderer.setClearColor(0x000000, 0);
      this.root.insertBefore(renderer.domElement, this.root.firstChild);
      renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); });
      renderer.domElement.addEventListener('webglcontextrestored', () => { renderer.shadowMap.needsUpdate = true; this.invalidate(); });

      const scene = this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(26, 1.4, 60, 30000);
      scene.add(new THREE.HemisphereLight(0xd6e4ff, 0x232a3a, 0.9));
      const sun = this.sun = new THREE.DirectionalLight(0xffffff, 1.3);
      sun.position.set(this.C.x - 700, 1700, this.C.z + 1100);
      sun.target.position.copy(this.C);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const sh = sun.shadow.camera; sh.left = -1500; sh.right = 1500; sh.top = 1300; sh.bottom = -1300; sh.near = 200; sh.far = 5200;
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.2;
      scene.add(sun, sun.target);

      // sol holographique
      const grid = new THREE.PolarGridHelper(2700, 28, 9, 96, 0x2f78b0, 0x1b3a58);
      grid.position.set(this.C.x, -1.5, this.C.z); grid.material.transparent = true; grid.material.opacity = 0.35; grid.material.depthWrite = false;
      scene.add(grid);
      const cv = document.createElement('canvas'); cv.width = cv.height = 256;
      const g = cv.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(40,110,200,0.30)'); gr.addColorStop(0.6, 'rgba(20,60,120,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(2700, 96), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2; disc.position.set(this.C.x, -2, this.C.z); scene.add(disc);
      const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.ShadowMaterial({ opacity: 0.4 }));
      shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.set(this.C.x, -0.5, this.C.z); shadowPlane.receiveShadow = true; scene.add(shadowPlane);

      // modèle
      const gltf = await new Promise((res, rej) => new THREE.GLTFLoader().load(`${this.base}${sc.glb}?v=${VERSION}`, res, (p) => {
        if (p.total) { const k = Math.round(100 * p.loaded / p.total); this.el.bar.style.width = k + '%'; this.el.lt.textContent = 'Chargement du plan ' + k + ' %'; }
      }, rej));
      this.levels = sc.floors.map(() => null);
      this.mats = sc.floors.map(() => []);
      gltf.scene.children.slice().forEach((n) => {
        const li = n.name === 'RDC' ? 0 : /^ETAGE[0-9]+$/.test(n.name) ? +n.name.slice(5) : -1;
        if (li < 0 || li >= this.NF) return;
        this.levels[li] = n; scene.add(n);
        n.traverse((o) => {
          if (!o.isMesh) return;
          o.material = o.material.clone();
          o.material.userData.base = o.material.opacity;
          o.material.userData.glass = !!o.material.transparent;
          o.castShadow = !o.material.transparent; o.receiveShadow = true;
          this.mats[li].push(o.material);
        });
      });
      this._buildWalls();
      this._buildLights();
      this._buildHotspots();
      this._bindGestures();
      this.alpha.forEach((a, i) => this._setLevelAlpha(i, a));
      new ResizeObserver(() => this.resize()).observe(this.root);
      this.resize();
      this._wallKey = ''; this._firstWalls = true;
      renderer.shadowMap.needsUpdate = true;
      this.el.load.classList.add('gone');
      this._applyStates();
      this.invalidate();
    }

    // ---------------------------------------------------------------------------------------- murs dynamiques
    _buildWalls() {
      const byName = {};
      this.walls = this.cfg.walls.map((w) => {
        const o = Object.assign({}, w, { node: this.scene.getObjectByName(w.name), s: 1, target: 1, cutState: true });
        o.sCut = Math.max(0.15, Math.min(1, (w.cut - w.pivot) / Math.max(1, w.y1 - w.pivot)));
        o.s = o.target = o.sCut;
        o.dyn = w.ext !== false && !w.follow;
        byName[w.name] = o;
        return o;
      }).filter((w) => w.node);
      this.walls.forEach((w) => { if (w.follow) w.leader = byName[w.follow]; this._applyWall(w); });
    }

    _applyWall(w) {
      w.node.scale.y = w.s;
      w.node.position.y = w.pivot * (1 - w.s);
    }

    // un mur « gêne » s'il masquerait, à pleine hauteur, des points de sol de l'étage affiché : on le coupe, sinon on le laisse entier
    _updateWalls() {
      const cam = this.camera.position, lv = this.floor, S = this.cfg.samples[lv], n = S.length / 2;
      const sy = this.cfg.floors[lv].base + this.cfg.sampleH;
      const key = [lv, cam.x.toFixed(0), cam.y.toFixed(0), cam.z.toFixed(0)].join('|');
      if (key !== this._wallKey) {
        this._wallKey = key;
        for (const w of this.walls) {
          if (!w.dyn || w.level !== lv) continue;
          const sx = w.b[0] - w.a[0], sz = w.b[1] - w.a[1];
          let cnt = 0;
          for (let i = 0; i < n; i++) {
            const rx = S[2 * i] - cam.x, rz = S[2 * i + 1] - cam.z;
            const den = rx * sz - rz * sx;
            if (Math.abs(den) < 1e-6) continue;
            const apx = w.a[0] - cam.x, apz = w.a[1] - cam.z;
            const t = (apx * sz - apz * sx) / den;
            if (t <= 0.002 || t >= 0.998) continue;
            const u = (apx * rz - apz * rx) / den;
            if (u < 0 || u > 1) continue;
            const hy = cam.y + (sy - cam.y) * t;
            if (hy > w.cut && hy < w.y1) cnt++;
          }
          if (w.cutState && cnt <= 1) w.cutState = false;
          else if (!w.cutState && cnt >= 4) w.cutState = true;
          w.target = w.cutState ? w.sCut : 1;
        }
        if (this._firstWalls) { this._firstWalls = false; for (const w of this.walls) if (w.dyn) w.s = w.target; }
      }
      let moving = false;
      for (const w of this.walls) {
        if (w.follow) { if (w.leader && w.leader.dyn) { w.target = w.leader.target; w.s = w.leader.s; this._applyWall(w); } continue; }
        if (!w.dyn) continue;
        const d = w.target - w.s;
        if (Math.abs(d) > 0.002) { w.s += d * 0.16; moving = true; this._applyWall(w); }
        else if (d !== 0) { w.s = w.target; this._applyWall(w); }
      }
      return moving;
    }

    // ---------------------------------------------------------------------------------------- lumières et pastilles
    _buildLights() {
      const THREE = window.THREE;
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const g = cv.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      this.glowTex = new THREE.CanvasTexture(cv);
      for (let i = 0; i < 6; i++) {          // réserve de lumières : attribuées aux pièces allumées de l'étage affiché
        const pl = new THREE.PointLight(0xffc27a, 0, 500, 2);
        this.scene.add(pl); this.pool.push(pl);
      }
      this.cfg.devices.forEach((d) => {
        if (d.kind !== 'media') return;
        d.sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color('#3da5ff'), transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false }));
        d.sp.position.set(d.pos[0], d.pos[1], d.pos[2]); d.sp.scale.set(170, 170, 1);
        this.scene.add(d.sp);
      });
    }

    _addPoint(kind, def, cls, icon, label) {
      const pt = document.createElement('div'); pt.className = 'pt';
      const b = document.createElement('div'); b.className = `badge ${cls}`;
      const ic = document.createElement('ha-icon'); ic.setAttribute('icon', icon); b.appendChild(ic);
      pt.appendChild(b);
      let lab = null;
      if (label) { lab = document.createElement('div'); lab.className = 'lab'; lab.textContent = label; pt.appendChild(lab); }
      this.el.hs.appendChild(pt);
      const o = { kind, def, pt, b, lab, v: new window.THREE.Vector3(), level: def.level != null ? def.level : def.floor, sx: 0, sy: 0 };
      b._o = o;
      this.hs.push(o);
      return o;
    }

    _buildHotspots() {
      this.cfg.rooms.forEach((r) => this._addPoint('room', r, 'room', 'mdi:lightbulb-group-outline', r.name));
      this.cfg.devices.forEach((d) => {
        const o = this._addPoint('dev', d, d.kind === 'media' ? 'media' : (PANELS[d.kind] ? 'panel' : 'media'), d.icon, null);
        if (d.label || d.kind === 'robot') { o.lab = document.createElement('div'); o.lab.className = 'lab sens'; o.pt.appendChild(o.lab); }
      });
    }

    setHass(hass) { this.hass = hass; if (this.cfg && this.hs.length) { this._applyStates(); if (this.panelOpen) this._renderPanel(); } }

    // lumières d'une zone Home Assistant (registre du frontend, avec repli sur la liste connue)
    _areaLights(area) {
      const out = [];
      const ents = this.hass && this.hass.entities, devs = (this.hass && this.hass.devices) || {};
      if (ents && Object.keys(ents).length) {
        for (const [id, e] of Object.entries(ents)) {
          if (!id.startsWith('light.')) continue;
          const a = e.area_id || (e.device_id && devs[e.device_id] && devs[e.device_id].area_id);
          const s = this.st(id);
          if (a === area && !(s && s.attributes && Array.isArray(s.attributes.entity_id))) out.push(id);
        }
        return out;
      }
      return (this.cfg.areaLights && this.cfg.areaLights[area]) || [];
    }

    _applyStates() {
      if (!this.hass || !this.hs.length) return;
      this.hs.forEach((o) => {
        const d = o.def, b = o.b;
        if (o.kind === 'room') {
          const lights = this._areaLights(d.area);
          o.lights = lights;
          o.on = lights.some((id) => { const s = this.st(id); return s && s.state === 'on'; });
          b.classList.toggle('on', o.on); b.classList.toggle('off', !o.on && lights.length > 0); b.classList.toggle('none', lights.length === 0);
          if (o.lab) o.lab.classList.toggle('on', o.on);
          return;
        }
        const s = this.st(d.entity), stt = s ? s.state : 'unavailable';
        if (d.kind === 'media') {
          const offs = ['off', 'standby', 'unavailable', 'unknown', 'idle'];
          const on = !offs.includes(stt) || !!(d.with && !offs.includes((this.st(d.with) || {}).state || 'off'));
          b.classList.toggle('on', on); b.classList.toggle('off', !on && stt !== 'unavailable'); b.classList.toggle('unav', stt === 'unavailable');
          o.glow = on ? 0.7 : 0;
        } else if (d.kind === 'robot') {
          const bt = d.battery && this.st(d.battery), run = stt === 'cleaning' || stt === 'returning';
          b.classList.toggle('unav', stt === 'unavailable'); b.classList.toggle('on', run); b.classList.toggle('bad', stt === 'error');
          if (o.lab) o.lab.textContent = bt && Number.isFinite(parseFloat(bt.state)) ? `${Math.round(parseFloat(bt.state))} %` : '';
        } else if (d.kind === 'sensor') {
          b.classList.toggle('unav', stt === 'unavailable');
          if (o.lab) o.lab.textContent = s ? `${s.state}${d.unit || ''}` : '';
        } else {
          b.classList.toggle('unav', stt === 'unavailable');
          b.classList.toggle('on', d.kind === 'purifier' && stt === 'on');
          b.classList.toggle('bad', d.kind === 'livebox' && stt === 'off');
        }
      });
      this.invalidate();
    }

    // ---------------------------------------------------------------------------------------- actions et fiches
    _tap(el, hold) {
      if (!el || !this.hass) return;
      const o = el._o; if (!o) return;
      const d = o.def;
      if (o.kind === 'room') {
        if (hold) { const first = (o.lights || [])[0]; if (first) this._moreInfo(first); return; }
        this.hass.callService('script', this.cfg.roomScript || 'toggle_area_lights', { area: d.area });
        return;
      }
      if (!hold && PANELS[d.kind]) { this._openPanel(o); return; }
      this._moreInfo(d.entity);
    }

    _moreInfo(entityId) { this.root.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true })); }

    _openPanel(o) {
      if (this.panelOpen === o) { this._closePanel(); return; }
      this.panelOpen = o; this._panelHtml = ''; this._panelBusy = 0; this._renderPanel(); this.el.panel.classList.add('show'); this._placePanel(); this.invalidate();
    }

    _closePanel() { this.panelOpen = null; this.el.panel.classList.remove('show'); }

    _renderPanel() {
      const o = this.panelOpen; if (!o) return;
      if (this._panelBusy && this._panelBusy > Date.now()) return;
      const P = PANELS[o.def.kind]; const r = P.render(this);
      const html = `<div class="ph"><div class="ic"><ha-icon icon="${P.icon}"></ha-icon></div><div class="tt"><b>${esc(r.title || P.title)}</b><small>${r.sub || ''}</small></div>
        <button class="x" data-act="close" aria-label="Fermer">×</button></div>${r.html}`;
      if (html === this._panelHtml && this.el.panel.firstChild) return;
      this._panelHtml = html; this.el.panel.innerHTML = html;
    }

    _panelClick(e) {
      const t = e.target.closest('[data-act]'); if (!t || !this.hass) return;
      const act = t.dataset.act, id = ENT.purifier_fan, f = this.st(id);
      if (act === 'mp-vset' || act === 'mp-src') return;
      if (act.startsWith('mp-')) { this._mediaAct(act, t.dataset.id, t); return; }
      if (act.startsWith('vac-')) {
        const svc = { start: 'start', resume: 'start', pause: 'pause', dock: 'return_to_base', locate: 'locate' }[act.slice(4)];
        if (svc) this.hass.callService('vacuum', svc, { entity_id: t.dataset.id });
        return;
      }
      if (act === 'close') this._closePanel();
      else if (act === 'fan-toggle') this.hass.callService('fan', f && f.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: id });
      else if (act === 'fan-pct') {
        const v = +t.dataset.v;
        if (f && f.state === 'on') this.hass.callService('fan', 'set_percentage', { entity_id: id, percentage: v });
        else this.hass.callService('fan', 'turn_on', { entity_id: id, percentage: v });
      }
    }

    _mediaAct(act, id, t) {
      const mp = (svc, data) => this.hass.callService('media_player', svc, Object.assign({ entity_id: id }, data || {}));
      const s = this.st(id), on = s && !MP_OFF.includes(s.state);
      if (act === 'mp-power') mp(on ? 'turn_off' : 'turn_on');
      else if (act === 'mp-mute') mp('volume_mute', { is_volume_muted: !(s && s.attributes.is_volume_muted) });
      else if (act === 'mp-vup') mp('volume_up');
      else if (act === 'mp-vdown') mp('volume_down');
      else if (act === 'mp-pp') mp('media_play_pause');
      else if (act === 'mp-prev') mp('media_previous_track');
      else if (act === 'mp-next') mp('media_next_track');
      else if (act === 'mp-vset') mp('volume_set', { volume_level: +t.value / 100 });
      else if (act === 'mp-src') mp('select_source', { source: t.value });
      this._panelBusy = 0;
    }

    _placePanel() {
      const o = this.panelOpen; if (!o) return;
      const p = this.el.panel, w = p.offsetWidth || 296, h = p.offsetHeight || 220;
      let x = o.sx + 34, y = o.sy - h / 2;
      if (x + w > this.w - 10) x = o.sx - 34 - w;
      x = Math.max(10, Math.min(this.w - w - 10, x)); y = Math.max(10, Math.min(this.h - h - 10, y));
      p.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
    }

    // ---------------------------------------------------------------------------------------- étages
    // point visé par la caméra : le centre de la maison pour le RDC et l'Étage 1, puis le centre de l'étage (relevé) pour les étages plus hauts
    _look(f) { const fl = this.cfg.floors[f]; return fl.look ? { x: fl.look[0], y: fl.look[1], z: fl.look[2] } : { x: this.C.x, y: this.C.y, z: this.C.z }; }

    _setLevelAlpha(li, a) {
      const lv = this.levels[li];
      lv.visible = a > 0.003;
      this.mats[li].forEach((m) => {
        const u = m.userData;
        if (a >= 0.999) { m.transparent = u.glass; m.opacity = u.base; m.depthWrite = !u.glass; }
        else { m.transparent = true; m.opacity = u.base * a; m.depthWrite = false; }
      });
    }

    setFloor(f) {
      f = Math.max(0, Math.min(this.NF - 1, f));
      if (f === this.floor || !this.levels) return;
      this.anim = { from: this.floor, to: f, t0: performance.now(), dur: 1250 };
      this.floor = f;
      this._closePanel();
      this.el.ttl.textContent = this.cfg.floors[f].name;
      this.el.dots.forEach((d) => d.classList.toggle('act', +d.dataset.f === f));
      this.el.hint.classList.add('gone');
      this._wallKey = '';
      this.invalidate();
    }

    _stepAnim(now) {
      if (!this.anim) return false;
      const { from, to, t0, dur } = this.anim;
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const lo = this.levels[to], lf = this.levels[from];
      const up = to > from;               // l'étage qui arrive descend du dessus (ou remonte vers sa place)
      lo.position.y = (1 - e) * (up ? 520 : -140);
      lf.position.y = e * (up ? -140 : 520);
      this.alpha[to] = Math.min(1, e * 1.4); this.alpha[from] = Math.max(0, 1 - e * 1.6);
      this._setLevelAlpha(to, this.alpha[to]); this._setLevelAlpha(from, this.alpha[from]);
      this.renderer.shadowMap.needsUpdate = true;
      if (t >= 1) {
        lo.position.y = 0; lf.position.y = 0; this.alpha[to] = 1; this.alpha[from] = 0;
        this._setLevelAlpha(to, 1); this._setLevelAlpha(from, 0); this.anim = null;
        this.renderer.shadowMap.needsUpdate = true;
      }
      return true;
    }

    // ---------------------------------------------------------------------------------------- caméra et rendu
    resize() {
      const r = this.root.getBoundingClientRect();
      if (!r.width || !r.height) return;
      this.w = r.width; this.h = r.height;
      this.renderer.setSize(r.width, r.height, false);
      this.camera.aspect = r.width / r.height;
      this.camera.updateProjectionMatrix();
      this.invalidate();
    }

    invalidate() {
      this.dirty = true;
      if (!this.raf && this.attached) this.raf = requestAnimationFrame((t) => this._frame(t));
    }

    attach(parent) {
      parent.appendChild(this.root);
      this.attached = true;
      if (this.renderer) { this.resize(); this._wallKey = ''; this.invalidate(); }
    }

    detach() { this.attached = false; if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; } }

    _frame(now) {
      this.raf = 0;
      if (!this.attached || !this.renderer || !this.alpha) return;
      // limite à 60 images/s : évite que la carte graphique tourne à fond (et « grésille ») sur un écran très rapide
      if (this._lastRender && now - this._lastRender < this.minDt - 2) { this.raf = requestAnimationFrame((t) => this._frame(t)); return; }
      this._lastRender = now;
      let moving = false;
      if (this._stepAnim(now)) moving = true;
      this.az += this.vAz; this.vAz *= 0.94; if (Math.abs(this.vAz) < 0.00005) this.vAz = 0; else moving = true;
      const k = 0.18;
      this.elev += (this.tgt.el - this.elev) * k; this.zoom += (this.tgt.zoom - this.zoom) * k;
      if (Math.abs(this.tgt.el - this.elev) > 0.0005 || Math.abs(this.tgt.zoom - this.zoom) > 0.0005) moving = true;
      const asp = this.camera.aspect;
      const dist = Math.max(3300, 4200 / asp) * this.zoom;
      const c = this.C, cam = this.camera;
      const L = this.look, T = this._look(this.floor);
      if (Math.abs(T.x - L.x) + Math.abs(T.y - L.y) + Math.abs(T.z - L.z) > 1) { L.x += (T.x - L.x) * 0.12; L.y += (T.y - L.y) * 0.12; L.z += (T.z - L.z) * 0.12; moving = true; } else { L.x = T.x; L.y = T.y; L.z = T.z; }
      cam.position.set(L.x + dist * Math.cos(this.elev) * Math.sin(this.az), L.y + dist * Math.sin(this.elev), L.z + dist * Math.cos(this.elev) * Math.cos(this.az));
      cam.lookAt(L.x, L.y, L.z);
      cam.updateMatrixWorld();
      const wm = this._updateWalls();
      if (wm) { moving = true; this._shadowTick = (this._shadowTick || 0) + 1; if (this._shadowTick % 3 === 0) this.renderer.shadowMap.needsUpdate = true; }
      else if (this._wallMoving) this.renderer.shadowMap.needsUpdate = true;
      this._wallMoving = wm;

      // réserve de lumières : pièces allumées de l'étage affiché
      const act = this.hs.filter((o) => o.kind === 'room' && o.on && this.alpha[o.level] > 0.02).sort((a, b) => this.alpha[b.level] - this.alpha[a.level]);
      this.pool.forEach((pl, i) => {
        const o = act[i];
        if (!o) { pl.intensity = 0; return; }
        const L = o.def.light, lv = this.levels[o.level];
        pl.color.set(L.color); pl.distance = L.distance; pl.intensity = L.intensity * this.alpha[o.level];
        pl.position.set(L.pos[0], L.pos[1] + lv.position.y, L.pos[2]);
      });
      // pastilles
      for (const o of this.hs) {
        const d = o.def, a = this.alpha[o.level], lv = this.levels[o.level];
        const p = d.pos;
        const v = o.v.set(p[0], p[1] + lv.position.y, p[2]).project(cam);
        o.sx = (v.x + 1) / 2 * this.w; o.sy = (1 - v.y) / 2 * this.h;
        const vis = v.z < 1 && a > 0.05;
        o.pt.style.opacity = vis ? String(Math.min(1, a)) : '0';
        o.b.style.pointerEvents = vis && a > 0.6 ? 'auto' : 'none';
        o.pt.style.transform = `translate(${o.sx.toFixed(1)}px, ${o.sy.toFixed(1)}px)`;
        if (o.kind === 'dev' && d.sp) { d.sp.material.opacity = (o.glow || 0) * a; d.sp.position.y = p[1] + lv.position.y; }
      }
      if (this.panelOpen) this._placePanel();
      this.renderer.render(this.scene, cam);
      // résolution adaptative (tablettes modestes)
      this._ft = (this._ft || 16) * 0.9 + (now - (this._last || now)) * 0.1; this._last = now;
      if (moving && this._ft > 38 && this.pr > 0.8) { this.pr = Math.max(0.75, this.pr * 0.85); this.renderer.setPixelRatio(this.pr); this.renderer.setSize(this.w, this.h, false); this._ft = 16; }
      this.dirty = false;
      if (moving && !this.raf) { this.raf = requestAnimationFrame((t) => this._frame(t)); } else if (!moving) { this._last = 0; }
    }

    // ---------------------------------------------------------------------------------------- gestes
    _bindGestures() {
      const st = this.root;
      const ptrs = new Map();
      let down = null, mode = null, holdTimer = 0, pinch0 = null;
      const move1 = (e) => {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!mode && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
          mode = down.btn === 2 || down.shift ? 'tilt' : (Math.abs(dx) >= Math.abs(dy) ? 'rot' : 'swipe');
          clearTimeout(holdTimer); st.classList.add('drag');
        }
        if (mode === 'rot') {
          const d = (e.clientX - down.lx) * 0.0062; this.az -= d; this.vAz = -d * 0.6; down.lx = e.clientX; this.invalidate();
        } else if (mode === 'tilt') {
          this.tgt.el = Math.min(1.45, Math.max(0.2, this.tgt.el + (e.clientY - down.ly) * 0.005)); down.ly = e.clientY; this.invalidate();
        }
      };
      st.addEventListener('pointerdown', (e) => {
        st.setPointerCapture(e.pointerId);
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.vAz = 0;
        const badge = e.composedPath().find((n) => n.classList && n.classList.contains('badge'));
        if (ptrs.size === 1) {
          down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, badge, btn: e.button, shift: e.shiftKey };
          mode = null;
          if (badge) holdTimer = setTimeout(() => { if (down && !mode) { this._tap(down.badge, true); down.badge = null; } }, 550);
        } else if (ptrs.size === 2) {
          clearTimeout(holdTimer); mode = 'pinch';
          const [a, b] = [...ptrs.values()];
          pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.tgt.zoom, my: (a.y + b.y) / 2, el: this.tgt.el };
        }
        this.el.hint.classList.add('gone');
      });
      st.addEventListener('pointermove', (e) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (mode === 'pinch' && ptrs.size >= 2 && pinch0) {
          const [a, b] = [...ptrs.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          this.tgt.zoom = Math.min(1.7, Math.max(0.4, pinch0.zoom * pinch0.d / Math.max(20, d)));
          this.tgt.el = Math.min(1.45, Math.max(0.2, pinch0.el + ((a.y + b.y) / 2 - pinch0.my) * 0.004));
          this.invalidate();
        } else if (down && ptrs.size === 1) move1(e);
      });
      const end = (e) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.delete(e.pointerId);
        if (mode === 'pinch') { if (ptrs.size < 2) { pinch0 = null; if (ptrs.size === 0) { mode = null; down = null; } } st.classList.remove('drag'); return; }
        if (!down) return;
        clearTimeout(holdTimer);
        const dy = e.clientY - down.y;
        if (!mode && down.badge) this._tap(down.badge, false);
        else if (!mode && this.panelOpen) this._closePanel();
        else if (mode === 'swipe') { if (dy > 50) this.setFloor(this.floor + 1); else if (dy < -50) this.setFloor(this.floor - 1); }   // glisser vers le bas = étage au-dessus
        else if (mode === 'rot') this.invalidate();
        st.classList.remove('drag'); down = null; mode = null;
      };
      st.addEventListener('pointerup', end);
      st.addEventListener('pointercancel', end);
      let wheelLock = 0;
      st.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.ctrlKey) {                    // pince du pavé tactile / Ctrl+molette = zoom
          this.tgt.zoom = Math.min(1.7, Math.max(0.4, this.tgt.zoom * (e.deltaY > 0 ? 1.06 : 0.943))); this.invalidate(); return;
        }
        if (Math.abs(e.deltaY) > 20 && performance.now() - wheelLock > 900) {      // défiler vers le bas = Étage 1
          wheelLock = performance.now(); this.setFloor(this.floor + (e.deltaY > 0 ? 1 : -1));
        } else if (Math.abs(e.deltaX) > 6) { this.az -= Math.sign(e.deltaX) * 0.05; this.invalidate(); }
      }, { passive: false });
    }
  }

  const APPS = {};
  const getApp = (base) => (APPS[base] = APPS[base] || new App(base));

  class Maison3dLiveCard extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    setConfig(config) { this._config = { path: '/local/maison3d/', ...config }; }
    getCardSize() { return 10; }
    set hass(h) { this._hass = h; if (this._app) this._app.setHass(h); }
    connectedCallback() {
      if (!this._config) return;
      if (!this.shadowRoot.querySelector('style')) { const s = document.createElement('style'); s.textContent = ':host{display:block;height:calc(100vh - var(--header-height,56px));min-height:420px;position:relative;overflow:hidden}'; this.shadowRoot.appendChild(s); }
      this._app = getApp(this._config.path);
      this._app.attach(this.shadowRoot);
      if (this._hass) this._app.setHass(this._hass);
    }
    disconnectedCallback() { if (this._app) this._app.detach(); }
  }
  customElements.define('maison-3d-live-card', Maison3dLiveCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'maison-3d-live-card', name: 'Plan 3D maison (direct)', description: 'Plan 3D temps réel tournant à 360° avec étages' });
})();
