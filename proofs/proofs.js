(() => {
  'use strict';

  /* ---------- navigation ---------- */
  const menuBtn = document.querySelector('[data-menu]');
  const setNav = (open) => { document.body.classList.toggle('nav-open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
  document.querySelector('[data-dismiss]').addEventListener('click', () => setNav(false));
  document.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setNav(false)));

  const scenes = [...document.querySelectorAll('main .scene')];
  const navLinks = new Map([...document.querySelectorAll('.nav a')].map((a) => [a.getAttribute('href').slice(1), a]));
  const dashes = document.getElementById('strip-dashes');
  scenes.forEach(() => dashes.appendChild(document.createElement('i')));
  const pad = (n) => String(n).padStart(2, '0');
  const setActive = (i) => {
    const s = scenes[i];
    document.getElementById('strip-count').textContent = `${pad(i + 1)} / ${pad(scenes.length)}`;
    document.getElementById('strip-title').textContent = s.dataset.title;
    [...dashes.children].forEach((d, k) => d.classList.toggle('on', k === i));
    navLinks.forEach((a, id) => a.classList.toggle('active', id === s.id));
  };
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const line = window.innerHeight * 0.3;
    let idx = 0;
    scenes.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) idx = i; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) idx = scenes.length - 1;
    setActive(idx);
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- figure: two blocks of the barrier tube, s = 3, five columns ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  const edges = document.getElementById('fig-edges'), nodes = document.getElementById('fig-nodes');
  if (edges && nodes) {
    const X = (c) => 205 + 112 * c, H = 56;
    const Y0 = [410, 365, 320], YP = 265, Y1 = [210, 165, 120];
    const R = 11;
    const arrow = (x1, y1, x2, y2, green) => {
      const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
      el('line', { x1: x1 + (dx / d) * R, y1: y1 + (dy / d) * R, x2: x2 - (dx / d) * (R + 2), y2: y2 - (dy / d) * (R + 2),
        stroke: green ? '#1e7a45' : '#8a978f', 'stroke-width': green ? 1.8 : 1.5, 'marker-end': `url(#${green ? 'ahg' : 'ah'})` }, edges);
    };
    for (let c = 0; c < 5; c++) {
      const x = X(c);
      arrow(x, Y0[0], x, Y0[1]); arrow(x, Y0[1], x, Y0[2]);
      arrow(x, Y1[0], x, Y1[1]); arrow(x, Y1[1], x, Y1[2]);
      arrow(x, Y0[2], x, Y1[0]);                               // old loop knitted through again
      const px = x + H;
      arrow(x, Y0[2], px, YP, true);                           // split: port through the old loop
      if (c < 4) arrow(px, YP, X(c + 1), Y1[0], true);         // port into the neighbour's first loop
      else arrow(px, YP, 752, 236, true);                      // around the tube
    }
    arrow(X(0) - H, 236, X(0), Y1[0], true);                         // arriving from column 4
    for (let c = 0; c < 5; c++) {
      const x = X(c);
      for (const y of [...Y0, ...Y1]) el('circle', { cx: x, cy: y, r: R, fill: '#efe7d8', stroke: '#8a7d64', 'stroke-width': 1.4 }, nodes);
      const px = x + H;
      el('path', { d: `M${px} ${YP - 12} L${px + 12} ${YP} L${px} ${YP + 12} L${px - 12} ${YP} Z`, fill: '#cfe9d8', stroke: '#1e7a45', 'stroke-width': 1.5 }, nodes);
      el('text', { x, y: 446, class: 'fig-col', 'text-anchor': 'middle' }, nodes).textContent = `column ${c}`;
    }
  }

  /* ---------- the checks ---------- */
  const button = document.getElementById('run-checks');
  const list = document.getElementById('check-list');
  const summary = document.getElementById('check-summary');
  if (button && window.RunsafeCheck) {
    button.addEventListener('click', () => {
      button.disabled = true;
      list.textContent = '';
      summary.textContent = 'Running…';
      const items = window.RunsafeCheck.checks();
      let i = 0, failed = 0;
      const t0 = performance.now();
      const step = () => {
        if (i >= items.length) {
          const secs = ((performance.now() - t0) / 1000).toFixed(1);
          summary.textContent = failed ? `${failed} of ${items.length} checks failed.` : `All ${items.length} checks passed on this device in ${secs} s.`;
          summary.className = `check-summary ${failed ? 'bad' : 'good'}`;
          button.disabled = false;
          return;
        }
        const c = items[i++];
        let r;
        try { r = c.run(); } catch (e) { r = { ok: false, detail: String(e) }; }
        if (!r.ok) failed++;
        const li = document.createElement('li');
        li.className = r.ok ? 'pass' : 'fail';
        li.innerHTML = '<span class="mark"></span><div><span class="grp"></span> <b></b><span class="det"></span></div>';
        li.querySelector('.mark').textContent = r.ok ? '✓' : '✗';
        li.querySelector('.grp').textContent = c.group;
        li.querySelector('b').textContent = c.name;
        li.querySelector('.det').textContent = r.detail;
        list.appendChild(li);
        setTimeout(step, 0);
      };
      setTimeout(step, 30);
    });
  }
})();
