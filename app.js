(() => {
  'use strict';

  /* ---------- mobile navigation ---------- */
  const menuBtn = document.querySelector('[data-menu]');
  const setNav = (open) => { document.body.classList.toggle('nav-open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
  document.querySelector('[data-dismiss]').addEventListener('click', () => setNav(false));
  document.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setNav(false)));

  /* ---------- active section: sidebar + chapter strip ---------- */
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
    const line = window.innerHeight * 0.35;
    let idx = 0;
    scenes.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) idx = i; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) idx = scenes.length - 1;
    setActive(idx);
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- demo film chapters ---------- */
  const CHAPTERS = [
    [0, 'RUNSAFE in one sentence'],
    [20, 'A sweater has no damage rating'],
    [45, 'An auditor looks at knitwear'],
    [65, 'A second holder stops the ladder'],
    [85, 'Proved, not sampled'],
    [130, 'Design from a rating'],
    [170, 'A rating anyone can check'],
    [190, 'Locate. Repair. Recover.'],
    [210, 'Where a proved rating goes'],
    [240, 'Three challenges'],
  ];
  const END = 285;
  const film = document.getElementById('film');
  const list = document.getElementById('chapters');
  const mmss = (t) => `${Math.floor(t / 60)}:${pad(Math.floor(t % 60))}`;
  CHAPTERS.forEach(([t, title], i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="n">${pad(i + 1)}</span><span></span><span class="t">${mmss(t)}</span><span class="bar"></span>`;
    b.children[1].textContent = title;
    b.addEventListener('click', () => { film.currentTime = t + 0.01; film.play().catch(() => {}); });
    li.appendChild(b);
    list.appendChild(li);
  });
  const items = [...list.children];
  const syncChapters = () => {
    const t = film.currentTime;
    let cur = 0;
    CHAPTERS.forEach(([s], i) => { if (t >= s) cur = i; });
    items.forEach((li, i) => {
      li.classList.toggle('active', i === cur);
      const s = CHAPTERS[i][0], e = (CHAPTERS[i + 1] || [END])[0];
      li.querySelector('.bar').style.width = i === cur ? `${Math.min(100, ((t - s) / (e - s)) * 100)}%` : '0';
    });
  };
  film.addEventListener('timeupdate', syncChapters);
  film.addEventListener('seeked', syncChapters);
  syncChapters();
  document.querySelectorAll('[data-seek]').forEach((a) => a.addEventListener('click', () => {
    film.currentTime = Number(a.dataset.seek);
    film.play().catch(() => {});
  }));

  /* ---------- design from a rating (Studio logic, 160-stitch sleeve) ---------- */
  // Compiled designs: verified worst cases and passes counted on the emitted programs.
  // Predicted spacings: theorem L1 (s + 1 loops for one snag, 45(s + 1) for nine) and six extra passes per barrier, 13 blocks.
  const PER_CM = 9, BLOCKS = 13;
  const predicted = (s) => ({ name: `Barrier every ${s} rows`, one: s + 1, nine: 45 * (s + 1), ratio: 1 + (6 * (BLOCKS - 1)) / (2 * BLOCKS * (s + 1) - 2), compiled: false });
  const CANDIDATES = [
    { name: 'Barrier every 8 rows', one: 9, nine: 405, ratio: 72 / 232 + 1, compiled: true, seek: 130 },
    { name: 'Staggered barriers, steps 2 and 1', one: 9, nine: 297, ratio: 1.47, compiled: true, seek: 158 },
    { name: 'Staggered barriers, steps 3 and 2', one: 9, nine: 216, ratio: 1.62, compiled: true },
    ...[2, 4, 6, 12, 16, 24].map(predicted),
  ].sort((a, b) => a.ratio - b.ratio);

  const $ = (id) => document.getElementById(id);
  const rOne = $('r-one'), rNine = $('r-nine'), rBudget = $('r-budget');
  const fmt = (x, d = 0) => x.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
  const cm = (loops) => fmt(loops / PER_CM, 1);
  const shield = '<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>';
  const warn = '<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';

  const render = () => {
    const oneCap = Math.floor((rOne.value / 10) * PER_CM + 1e-9);
    const nineCap = rNine.value * 10;
    const ratioCap = 1 + (rBudget.value * 5) / 100;
    $('v-one').textContent = `${fmt(rOne.value / 10, 1)} cm`;
    $('h-one').textContent = `${oneCap} loops at this gauge`;
    $('v-nine').textContent = `${fmt(nineCap)} loops`;
    $('v-budget').textContent = `+${rBudget.value * 5}%`;
    const check = (c) => ({ one: c.one <= oneCap, nine: c.nine <= nineCap, cost: c.ratio <= ratioCap + 1e-9 });
    const meets = CANDIDATES.filter((c) => { const k = check(c); return k.one && k.nine && k.cost; });
    const best = [...meets].sort((a, b) => a.ratio - b.ratio || a.nine - b.nine)[0] || null;

    const ans = $('answer');
    if (best) {
      const chip = best.compiled ? '<span class="chip proved">Compiled · verified worst case</span>' : '<span class="chip">Predicted · compile to confirm</span>';
      ans.innerHTML = `<div class="card-head"><h3>RUNSAFE's answer</h3>${chip}</div>
        <div class="winner"></div>
        <div class="badge">${shield}<div><b>Ladder rating ≤ ${cm(best.one)} cm</b><span>nine snags ≤ ${fmt(best.nine)} loops · proved in the loop-release model</span></div></div>
        <div class="rate-stats">
          <div><strong>${fmt(best.one)}</strong><span>loops, one snag</span></div>
          <div><strong>${fmt(best.nine)}</strong><span>loops, nine snags</span></div>
          <div><strong>+${fmt((best.ratio - 1) * 100)}%</strong><span>carriage passes</span></div>
        </div>
        ${best.seek != null ? `<a class="btn" href="#demo" data-jump="${best.seek}">See it compiled in the demo</a>` : ''}`;
      ans.querySelector('.winner').textContent = best.name;
      const jump = ans.querySelector('[data-jump]');
      if (jump) jump.addEventListener('click', () => { film.currentTime = Number(jump.dataset.jump); });
    } else {
      ans.innerHTML = `<div class="card-head"><h3>RUNSAFE's answer</h3></div>
        <div class="callout">${warn}<div><b>No proved construction meets this rating within the budget.</b> Relax the rating or allow more machine passes.</div></div>`;
    }

    $('t-count').textContent = `${CANDIDATES.length} candidates · ${meets.length} meet the rating`;
    const body = $('t-body');
    body.textContent = '';
    CANDIDATES.forEach((c) => {
      const k = check(c), ok = k.one && k.nine && k.cost;
      const tr = document.createElement('tr');
      tr.className = c === best ? 'best' : ok ? '' : 'fail';
      const fails = [!k.one && 'one snag', !k.nine && 'nine snags', !k.cost && 'budget'].filter(Boolean).join(', ');
      tr.innerHTML = `<td></td>
        <td class="num ${k.one ? '' : 'bad'}">${fmt(c.one)} loops · ${cm(c.one)} cm</td>
        <td class="num ${k.nine ? '' : 'bad'}">${fmt(c.nine)}</td>
        <td class="num ${k.cost ? '' : 'bad'}">${fmt(c.ratio, 2)}×</td>
        <td class="hint">${c.compiled ? 'compiled, verified' : 'theorem L1, predicted passes'}</td>
        <td>${ok ? (c === best ? '<b class="good">✓ cheapest</b>' : '✓') : `<span class="hint">✗ ${fails}</span>`}</td>`;
      tr.firstElementChild.textContent = c.name;
      body.appendChild(tr);
    });
  };
  [rOne, rNine, rBudget].forEach((r) => r.addEventListener('input', render));
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    const [o, n, g] = b.dataset.preset.split(',');
    rOne.value = o; rNine.value = n; rBudget.value = g;
    render();
  }));
  render();
})();
