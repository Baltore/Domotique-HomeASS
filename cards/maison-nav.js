/* Bouton de navigation flottant (en bas à droite, collé à l'écran, indépendant de la disposition des cartes).
   - Sur un onglet autre que l'Accueil : un appui = retour à l'Accueil ; un appui long (ou clic droit) = liste de tous les onglets.
   - Sur l'Accueil : le bouton ouvre directement la liste des onglets.
   Réglage : définir window.MAISON_NAV_DASHBOARD (chemin d'URL du dashboard, défaut « lovelace ») avant ce script.
   Les onglets (titre, icône) sont lus dans la config du dashboard : si tu en ajoutes ou renommes, la liste suit. Masqué en mode édition. */
(() => {
  if (window.__maisonNav) return;
  window.__maisonNav = true;
  const init = () => {
  const DASH = window.MAISON_NAV_DASHBOARD || 'lovelace', HOME = window.MAISON_NAV_HOME || 'home';
  let views = [], open = false, timer = 0, held = false;

  const css = `
    #mnav { position:fixed; right:max(18px, env(safe-area-inset-right)); bottom:max(18px, env(safe-area-inset-bottom)); z-index:6; display:none; flex-direction:column; align-items:flex-end; gap:10px; font-family:system-ui,sans-serif; }
    #mnav.show { display:flex; }
    #mnav .fab { width:56px; height:56px; border-radius:50%; border:1px solid rgba(110,200,255,.65); background:rgba(10,18,36,.8); color:#9fd8ff; --mdc-icon-size:28px; display:flex; align-items:center; justify-content:center; cursor:pointer;
      box-shadow:0 0 16px rgba(70,170,255,.5), inset 0 0 10px rgba(70,170,255,.18); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); transition:transform .15s, box-shadow .3s, background .3s; user-select:none; -webkit-user-select:none; touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
    #mnav .fab:hover { box-shadow:0 0 24px rgba(90,190,255,.8), inset 0 0 12px rgba(70,170,255,.3); } #mnav .fab:active { transform:scale(.92); }
    #mnav.menu .fab { background:rgba(40,110,200,.55); color:#fff; }
    #mnav .list { display:none; flex-direction:column; align-items:flex-end; gap:8px; } #mnav.menu .list { display:flex; }
    #mnav .it { display:flex; align-items:center; gap:10px; padding:5px 6px 5px 16px; border-radius:99px; cursor:pointer; color:#dbe9ff; background:rgba(10,18,36,.88); border:1px solid rgba(110,200,255,.4);
      box-shadow:0 4px 16px rgba(0,0,0,.45); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); font-size:14px; font-weight:600; animation:mnin .18s ease-out both; }
    #mnav .it .c { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(60,160,255,.18); color:#8fdcff; --mdc-icon-size:21px; }
    #mnav .it.cur { border-color:#6fd0ff; background:rgba(40,110,200,.5); color:#fff; } #mnav .it.cur .c { background:#4aa3ff; color:#06121f; }
    #mnav .it:active { transform:scale(.96); }
    @keyframes mnin { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
    #mnbg { position:fixed; inset:0; z-index:5; display:none; background:rgba(0,0,0,.35); } #mnbg.show { display:block; }
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const bg = document.createElement('div'); bg.id = 'mnbg';
  const root = document.createElement('div'); root.id = 'mnav';
  root.innerHTML = '<div class="list"></div><div class="fab" role="button" aria-label="Navigation"><ha-icon icon="mdi:home"></ha-icon></div>';
  const fab = root.querySelector('.fab'), list = root.querySelector('.list'), icon = fab.querySelector('ha-icon');
  document.body.appendChild(bg); document.body.appendChild(root);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hass = () => { const h = document.querySelector('home-assistant'); return h && h.hass; };
  const curView = () => { const p = location.pathname.split('/').filter(Boolean); return p[0] === DASH ? (p[1] || (views[0] && views[0].path) || HOME) : null; };
  const go = (path) => { close(); if (curView() === path) return; history.pushState(null, '', `/${DASH}/${path}`); window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } })); setTimeout(refresh, 150); };

  async function loadViews() {
    try { const h = hass(); if (!h) return;
      const cfg = await h.callWS({ type: 'lovelace/config', url_path: DASH });
      views = (cfg.views || []).filter((v) => v.path).map((v) => ({ path: v.path, title: v.title || v.path, icon: v.icon || 'mdi:view-dashboard' }));
    } catch (e) { /* on garde la liste précédente */ }
    if (!views.length) views = [{ path: HOME, title: 'Accueil', icon: 'mdi:home-variant' }];
  }

  function close() { open = false; root.classList.remove('menu'); bg.classList.remove('show'); }
  function showMenu() {
    const cur = curView();
    list.innerHTML = views.map((v, i) => `<div class="it ${v.path === cur ? 'cur' : ''}" data-p="${esc(v.path)}" style="animation-delay:${(views.length - i) * 18}ms"><span>${esc(v.title)}</span><span class="c"><ha-icon icon="${esc(v.icon)}"></ha-icon></span></div>`).join('');
    open = true; root.classList.add('menu'); bg.classList.add('show');
  }
  function refresh() {
    const p = location.pathname.split('/').filter(Boolean), q = location.search;
    const on = p[0] === DASH && !/[?&]edit=1/.test(q);
    root.classList.toggle('show', on); if (!on) { close(); return; }
    const home = curView() === (views[0] && views[0].path) || curView() === HOME;
    icon.setAttribute('icon', open ? 'mdi:close' : home ? 'mdi:apps' : 'mdi:home');
    fab.setAttribute('aria-label', home ? 'Menu des onglets' : 'Retour à l\'accueil');
  }

  fab.addEventListener('pointerdown', () => { held = false; timer = setTimeout(async () => { held = true; await loadViews(); showMenu(); refresh(); }, 520); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => fab.addEventListener(t, () => clearTimeout(timer)));
  fab.addEventListener('contextmenu', async (e) => { e.preventDefault(); clearTimeout(timer); await loadViews(); showMenu(); refresh(); });
  fab.addEventListener('click', async () => {
    if (held) { held = false; return; }
    if (open) { close(); refresh(); return; }
    const first = views[0] ? views[0].path : HOME, home = curView() === first || curView() === HOME;
    if (home) { await loadViews(); showMenu(); } else go(first);
    refresh();
  });
  list.addEventListener('click', (e) => { const it = e.target.closest('.it'); if (it) go(it.dataset.p); });
  bg.addEventListener('click', () => { close(); refresh(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { close(); refresh(); } });
  window.addEventListener('location-changed', () => setTimeout(refresh, 50));
  window.addEventListener('popstate', () => setTimeout(refresh, 50));
  setInterval(refresh, 800);
  loadViews().then(refresh); refresh();
  };
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
