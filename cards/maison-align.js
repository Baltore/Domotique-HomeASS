/* Alignement par le bas des colonnes d'une vue « sections » : la dernière carte de chaque colonne qui s'enregistre (option `align_bottom: true`)
   s'étire pour que le bas de sa colonne arrive au niveau de la colonne la plus basse de la même rangée. */
(() => {
  if (window.__m3dAlign) return;
  const reg = new Map();      // section -> { extra, set(extra) }
  const sectionOf = (n) => { while (n) { if (n.localName === 'hui-section') return n; n = n.parentNode || n.host; } return null; };
  const sectionsOf = (sec) => { let n = sec.parentNode; while (n && !(n.querySelectorAll && n.querySelectorAll('hui-section').length > 1)) n = n.parentNode || n.host; return n ? [...n.querySelectorAll('hui-section')] : [sec]; };
  let tm = 0, ro = null;
  const compute = () => {
    for (const [sec, r] of [...reg]) {
      if (!sec.isConnected) { reg.delete(sec); continue; }
      const mine = sec.getBoundingClientRect(); if (!mine.height) continue;
      let target = mine.bottom - r.extra;
      for (const o of sectionsOf(sec)) {
        if (o === sec) continue; const b = o.getBoundingClientRect(); if (!b.height || Math.abs(b.top - mine.top) > 40) continue;
        const e = reg.get(o) ? reg.get(o).extra : 0; target = Math.max(target, b.bottom - e);
      }
      const extra = Math.max(0, Math.round(target - (mine.bottom - r.extra)));
      if (Math.abs(extra - r.extra) > 1) { r.extra = extra; r.set(extra); }
    }
  };
  const run = () => { clearTimeout(tm); tm = setTimeout(compute, 30); };
  window.__m3dAlign = {
    add(el, set) {
      const sec = sectionOf(el); if (!sec) return;
      reg.set(sec, { extra: 0, set });
      if (window.ResizeObserver) { ro = ro || new ResizeObserver(run); ro.observe(sec); sectionsOf(sec).forEach((s) => ro.observe(s)); }
      [300, 900, 2000, 4000].forEach((t) => setTimeout(run, t)); run();
    },
    remove(el) { const sec = sectionOf(el); if (sec) reg.delete(sec); },
    run,
  };
  window.addEventListener('resize', run);
})();
