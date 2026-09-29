/*
 * RUNSAFE proof checker.
 *
 * Rebuilds the capture graph of the barrier tube directly from the construction
 * in the proofs (section 2), computes release closures under both rules, and
 * checks the theorems' statements against exhaustive and targeted attacks.
 *
 * Runs in a browser (the "Run the checks" button on proofs.html) or with Node:
 *   node proofs/check.js
 * No dependencies.
 */
(function (root) {
  'use strict';

  // ---------- the construction ----------
  // Blocks b = 0..m-1, columns c = 0..W-1, levels l = 0..s-1.
  // Chain loop (b,c,l); port (b,c) for b >= 1, split from the top loop of (b-1,c)
  // and knitted into the first loop of column c + step[b] in block b.
  // Loops are numbered in construction order, so every child has a larger index.
  function buildTube(W, s, m, stepOf, targetOf) {
    const mod = (x) => ((x % W) + W) % W;
    const step = (b) => (stepOf ? stepOf(b) : 1);
    const target = targetOf || ((b, c) => mod(c + step(b)));
    const idx = new Map();
    let n = 0;
    const kind = [];
    for (let b = 0; b < m; b++) {
      if (b >= 1) for (let c = 0; c < W; c++) { idx.set(`p${b},${c}`, n); kind.push({ t: 'port', b, c }); n++; }
      for (let l = 0; l < s; l++) for (let c = 0; c < W; c++) { idx.set(`m${b},${c},${l}`, n); kind.push({ t: 'chain', b, c, l }); n++; }
    }
    const children = Array.from({ length: n }, () => []);
    const parents = Array.from({ length: n }, () => []);
    const edge = (u, v) => { children[u].push(v); parents[v].push(u); }; // v is made through u
    for (let b = 0; b < m; b++) {
      for (let c = 0; c < W; c++) {
        for (let l = 0; l + 1 < s; l++) edge(idx.get(`m${b},${c},${l}`), idx.get(`m${b},${c},${l + 1}`));
        if (b >= 1) {
          const top = idx.get(`m${b - 1},${c},${s - 1}`);
          const port = idx.get(`p${b},${c}`);
          edge(top, idx.get(`m${b},${c},0`));                 // direct: old loop knitted through again
          edge(top, port);                                      // split: port made through the old loop
          edge(port, idx.get(`m${b},${target(b, c)},0`));      // port knitted into its target column's first loop
        }
      }
    }
    return { W, s, m, n, idx, kind, children, parents };
  }

  // Downward rule: a loop releases when every loop made through it has released.
  function closeDown(g, seeds) {
    const r = new Uint8Array(g.n);
    for (const x of seeds) r[x] = 1;
    for (let v = g.n - 1; v >= 0; v--) {
      if (r[v]) continue;
      const ch = g.children[v];
      if (ch.length && ch.every((u) => r[u])) r[v] = 1;
    }
    return r;
  }
  // Upward (mirrored) rule: a loop releases when every loop it was made through has released.
  function closeUp(g, seeds) {
    const r = new Uint8Array(g.n);
    for (const x of seeds) r[x] = 1;
    for (let v = 0; v < g.n; v++) {
      if (r[v]) continue;
      const pa = g.parents[v];
      if (pa.length && pa.every((u) => r[u])) r[v] = 1;
    }
    return r;
  }
  const count = (r) => { let k = 0; for (let i = 0; i < r.length; i++) k += r[i]; return k; };

  // Worst case over every seed set of size 1..K, by exhaustive enumeration.
  function exhaustive(g, K, close) {
    const best = new Array(K + 1).fill(0);
    let sets = 0;
    const pick = [];
    const rec = (start, depth) => {
      if (depth > 0) {
        sets++;
        const d = count(close(g, pick));
        if (d > best[depth]) best[depth] = d;
      }
      if (depth === K) return;
      for (let x = start; x < g.n; x++) { pick.push(x); rec(x + 1, depth + 1); pick.pop(); }
    };
    rec(0, 0);
    return { best, sets };
  }

  const tri = (k) => (k * (k + 1)) / 2;
  const fr = (r, k) => { let t = 0; for (let j = 0; r * j < k; j++) t += k - r * j; return t; };

  // Exact macro worst case B_k on a cycle of W columns: any seeds, in any rows, any height.
  // supports[p] lists the offsets of the rows of phase p (one entry for a fixed barrier).
  // G(R, t, p): the most cells released from the current row downward, when the current row
  // holds R so far, t seeds are left, and the erosion below this row has phase p.
  // Moves: add one seed to the current row, or close the row (count it, erode to the next).
  // An empty row may be skipped, which lets the attacker choose the phase of the next row.
  function macroProfile(W, K, supports) {
    const P = supports.length, S = 1 << W, full = S - 1;
    const erode = supports.map((A) => {
      const e = new Int32Array(S);
      for (let R = 0; R < S; R++) {
        let out = 0;
        for (let c = 0; c < W; c++) {
          let ok = true;
          for (const a of A) { const q = (((c + a) % W) + W) % W; if (!((R >> q) & 1)) { ok = false; break; } }
          if (ok) out |= 1 << c;
        }
        e[R] = out;
      }
      return e;
    });
    const pop = new Uint8Array(S);
    for (let R = 1; R < S; R++) pop[R] = pop[R >> 1] + (R & 1);
    const memo = new Int32Array(S * (K + 1) * P).fill(-1);
    const busy = new Uint8Array(S * (K + 1) * P);
    const emptyBest = new Int32Array(K + 1).fill(-1);
    const H = (t) => { // empty row, t seeds left, any phase
      if (t === 0) return 0;
      if (emptyBest[t] < 0) { let b = 0; for (let p = 0; p < P; p++) b = Math.max(b, G(0, t, p)); emptyBest[t] = b; }
      return emptyBest[t];
    };
    const G = (R, t, p) => {
      const key = (R * (K + 1) + t) * P + p;
      if (memo[key] >= 0) return memo[key];
      if (busy[key]) throw new Error('cycle in the release system');
      busy[key] = 1;
      let best = 0;
      if (R !== 0) { // close the row
        const E = erode[p][R];
        best = pop[R] + (E === 0 ? H(t) : G(E, t, (p + 1) % P));
      }
      if (t > 0) for (let c = 0; c < W; c++) if (!((R >> c) & 1)) best = Math.max(best, G(R | (1 << c), t - 1, p));
      if (R === full) throw new Error('a full row is self-sustaining');
      busy[key] = 0;
      memo[key] = best;
      return best;
    };
    const prof = [0];
    for (let k = 1; k <= K; k++) prof.push(H(k));
    return prof;
  }

  function binomSum(n, K) {
    let total = 0n, c = 1n;
    for (let k = 1; k <= K; k++) { c = (c * BigInt(n - k + 1)) / BigInt(k); total += c; }
    return total;
  }

  // ---------- the checks ----------
  function checks() {
    const list = [];
    const add = (group, name, run) => list.push({ group, name, run });

    // Theorem 1 on the macro model, every width up to 8.
    add('Theorem 1', 'Worst case on a cycle equals f_r(k) for every width W > k (r = 1, 2; W = 3..8)', () => {
      const rows = [];
      for (const r of [1, 2]) {
        for (let W = 3; W <= 8; W++) {
          const K = W - 1;
          const A = Array.from({ length: r + 1 }, (_, i) => i);
          const got = macroProfile(W, K, [A]);
          for (let k = 1; k <= K; k++) if (got[k] !== fr(r, k)) return { ok: false, detail: `r=${r} W=${W} k=${k}: ${got[k]} vs ${fr(r, k)}` };
          rows.push(`r=${r} W=${W}: ${got.slice(1).join(', ')}`);
        }
      }
      return { ok: true, detail: `${rows.length} widths, all equal to f_r(k). e.g. ${rows[5]}` };
    });

    // Theorem 2: exhaustive attacks on small emitted-style tubes.
    const small = [[4, 1, 4], [5, 2, 4], [6, 1, 4], [6, 2, 4], [8, 1, 4]];
    for (const [W, s, m] of small) {
      add('Theorem 2', `Every seed set of up to 3 loops, tube W=${W}, s=${s}, ${m} blocks, ladders down`, () => {
        const g = buildTube(W, s, m);
        const { best, sets } = exhaustive(g, 3, closeDown);
        for (let k = 1; k <= 3; k++) {
          const bound = (s + 1) * tri(k);
          if (best[k] > bound) return { ok: false, detail: `k=${k}: ${best[k]} > ${bound}` };
          if (m >= k + 1 && best[k] !== bound) return { ok: false, detail: `k=${k}: ${best[k]} not attained (${bound})` };
        }
        return { ok: true, detail: `${sets.toLocaleString('en-GB')} seed sets over ${g.n} loops; worst ${best.slice(1).join(', ')} = (s+1)·k(k+1)/2` };
      });
    }
    for (const [W, s, m] of [[4, 1, 4], [6, 2, 4], [8, 1, 4]]) {
      add('Theorem 3', `Every seed set of up to 3 loops, tube W=${W}, s=${s}, ${m} blocks, ladders up`, () => {
        const g = buildTube(W, s, m);
        const { best, sets } = exhaustive(g, 3, closeUp);
        for (let k = 1; k <= 3; k++) {
          const bound = (s + 1) * tri(k);
          if (best[k] > bound) return { ok: false, detail: `k=${k}: ${best[k]} > ${bound}` };
          if (m >= k + 1 && best[k] !== bound) return { ok: false, detail: `k=${k}: ${best[k]} not attained (${bound})` };
        }
        return { ok: true, detail: `${sets.toLocaleString('en-GB')} seed sets; worst ${best.slice(1).join(', ')}, the same as downward` };
      });
    }

    // The 160-stitch sleeve: W=160, s=8, 13 blocks.
    add('The sleeve', 'The sleeve has 18,560 loops', () => {
      const g = buildTube(160, 8, 13);
      return { ok: g.n === 18560, detail: `${g.n.toLocaleString('en-GB')} loops = 160 × (8 × 13 + 12)` };
    });
    add('The sleeve', 'Attaining attacks, ladders down: k neighbouring block tops release exactly 9·k(k+1)/2', () => {
      const g = buildTube(160, 8, 13);
      const out = [];
      for (let k = 1; k <= 9; k++) {
        const seeds = Array.from({ length: k }, (_, c) => g.idx.get(`m12,${40 + c},7`));
        const d = count(closeDown(g, seeds));
        if (d !== 9 * tri(k)) return { ok: false, detail: `k=${k}: ${d}` };
        out.push(d);
      }
      return { ok: true, detail: out.join(', ') };
    });
    add('The sleeve', 'Attaining attacks, ladders up: k neighbouring block feet release exactly 9·k(k+1)/2', () => {
      const g = buildTube(160, 8, 13);
      const out = [];
      for (let k = 1; k <= 9; k++) {
        const seeds = Array.from({ length: k }, (_, c) => g.idx.get(`m1,${40 + c},0`));
        const d = count(closeUp(g, seeds));
        if (d !== 9 * tri(k)) return { ok: false, detail: `k=${k}: ${d}` };
        out.push(d);
      }
      return { ok: true, detail: out.join(', ') };
    });
    add('The sleeve', '3,000 random attacks of 1 to 9 loops anywhere, both directions, stay within the bound', () => {
      const g = buildTube(160, 8, 13);
      let seed = 20260929;
      const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
      let worst = 0;
      for (let i = 0; i < 3000; i++) {
        const k = 1 + (i % 9);
        // cluster half of the attacks, so they interact
        const base = Math.floor(rand() * g.n);
        const seeds = Array.from({ length: k }, () => (i % 2 ? Math.floor(rand() * g.n) : Math.min(g.n - 1, base + Math.floor(rand() * 400))));
        for (const close of [closeDown, closeUp]) {
          const d = count(close(g, seeds));
          const kk = new Set(seeds).size;
          if (d > 9 * tri(kk)) return { ok: false, detail: `attack ${i}: ${d} > ${9 * tri(kk)}` };
          worst = Math.max(worst, d / (9 * tri(kk)));
        }
      }
      return { ok: true, detail: `6,000 closures; the largest reached ${(worst * 100).toFixed(0)}% of its bound` };
    });
    add('Theorem 4', 'Dropping all 160 working-edge loops releases every loop', () => {
      const g = buildTube(160, 8, 13);
      const seeds = Array.from({ length: 160 }, (_, c) => g.idx.get(`m12,${c},7`));
      const d = count(closeDown(g, seeds));
      return { ok: d === g.n, detail: `${d.toLocaleString('en-GB')} of ${g.n.toLocaleString('en-GB')} loops` };
    });
    add('Theorem 4', 'Any 159 dropped working-edge loops leave a whole column segment in every block', () => {
      const g = buildTube(160, 8, 13);
      const seeds = Array.from({ length: 159 }, (_, c) => g.idx.get(`m12,${c},7`));
      const r = closeDown(g, seeds);
      for (let b = 0; b < 13; b++) {
        let kept = false;
        for (let c = 0; c < 160 && !kept; c++) {
          let all = true;
          for (let l = 0; l < 8; l++) if (r[g.idx.get(`m${b},${c},${l}`)]) { all = false; break; }
          kept = all;
        }
        if (!kept) return { ok: false, detail: `block ${b} fully released` };
      }
      return { ok: true, detail: `${count(r).toLocaleString('en-GB')} of 18,560 loops released; every block keeps an unreleased column` };
    });
    add('The sleeve', 'Plain knitting, 160 around and 116 courses: one dropped loop at the top releases the whole column', () => {
      const g = buildTube(160, 116, 1); // one block, no barrier: every loop is made through the loop below
      const d = count(closeDown(g, [g.idx.get('m0,40,115')]));
      return { ok: d === 116, detail: `${d} loops` };
    });
    add('The sleeve', 'The number of ways to drop 1 to 9 of the 18,560 loops has 33 digits', () => {
      const t = binomSum(18560, 9).toString();
      return { ok: t.length === 33, detail: t.replace(/\B(?=(\d{3})+(?!\d))/g, ',') };
    });

    // Theorem 5: flat panels.
    const zigzag = (W) => { const order = []; for (let c = 0; c < W; c += 2) order.push(c); for (let c = W % 2 ? W - 2 : W - 1; c >= 1; c -= 2) order.push(c);
      const next = new Array(W); order.forEach((c, i) => { next[c] = order[(i + 1) % W]; }); return (b, c) => next[c]; };
    for (const [W, s, m] of [[5, 1, 4], [6, 2, 4], [7, 1, 4]]) {
      add('Theorem 5', `Flat panel W=${W}, s=${s}, zig-zag port cycle: every seed set of up to 3 loops, both directions`, () => {
        const g = buildTube(W, s, m, null, zigzag(W));
        const down = exhaustive(g, 3, closeDown), up = exhaustive(g, 3, closeUp);
        for (let k = 1; k <= 3; k++) {
          const bound = (s + 1) * tri(k);
          for (const r of [down, up]) {
            if (r.best[k] > bound) return { ok: false, detail: `k=${k}: ${r.best[k]} > ${bound}` };
            if (m >= k + 1 && r.best[k] !== bound) return { ok: false, detail: `k=${k}: ${r.best[k]} not attained` };
          }
        }
        return { ok: true, detail: `${(down.sets * 2).toLocaleString('en-GB')} closures; worst ${down.best.slice(1).join(', ')} both ways` };
      });
    }
    add('Theorem 5', 'Flat panel whose ports form two cycles, (0 1 2 3)(4 5): two dropped loops run the full height', () => {
      const W = 6, s = 2, sigma = [1, 2, 3, 0, 5, 4];
      const out = [];
      for (const m of [4, 8, 16]) {
        const g = buildTube(W, s, m, null, (b, c) => sigma[c]);
        const seeds = [g.idx.get(`m${m - 1},4,${s - 1}`), g.idx.get(`m${m - 1},5,${s - 1}`)];
        out.push(count(closeDown(g, seeds)));
      }
      return { ok: out[0] < out[1] && out[1] < out[2], detail: `damage ${out.join(', ')} at 4, 8 and 16 blocks: it grows with the height` };
    });

    // Theorem 6: staggered barriers.
    for (const [a1, a2, expect] of [[2, 1, [1, 3, 5, 8, 12, 16]], [3, 2, [1, 3, 5, 7, 10, 13]]]) {
      add('Theorem 6', `Steps ${a1}, ${a2}: exact macro worst case on a cycle wider than ${Math.max(a1, a2)}k`, () => {
        const A = Math.max(a1, a2), K = A === 2 ? 6 : 5;
        const W = A * K + 1;
        const got = macroProfile(W, K, [[0, a1], [0, a2]]);
        for (let k = 1; k <= K; k++) if (got[k] !== expect[k - 1]) return { ok: false, detail: `k=${k}: ${got[k]} vs ${expect[k - 1]}` };
        return { ok: true, detail: `W=${W}: ${got.slice(1).join(', ')}` };
      });
    }
    for (const [a1, a2, prof] of [[2, 1, [1, 3, 5, 8, 12, 16, 21, 27, 33]], [3, 2, [1, 3, 5, 7, 10, 13, 16, 20, 24]]]) {
      add('Theorem 6', `Steps ${a1}, ${a2} on the 160-stitch tube: the published witnesses release exactly 9·B_k`, () => {
        const pattern = (b) => (b % 2 === 1 ? a1 : a2);
        const g = buildTube(160, 8, 13, pattern);
        const W = WITNESS[`${a1},${a2}`];
        const out = [];
        for (let k = 1; k <= 9; k++) {
          const w = W[k - 1];
          // witness rows count downward from the attack's first row; choose a block whose barrier phase matches
          let top = 12;
          while ((pattern(top) === a1 ? 0 : 1) !== (w.phase === 0 ? 0 : 1)) top--;
          const seeds = w.seeds.map(([row, col]) => g.idx.get(`m${top - row},${40 + col},7`));
          const d = count(closeDown(g, seeds));
          if (d !== 9 * prof[k - 1]) return { ok: false, detail: `k=${k}: ${d} vs ${9 * prof[k - 1]}` };
          out.push(d);
        }
        return { ok: true, detail: out.join(', ') };
      });
      add('Theorem 6', `Steps ${a1}, ${a2}: every seed set of up to 3 loops on a small tube stays within 2·B_k`, () => {
        const pattern = (b) => (b % 2 === 1 ? a1 : a2);
        const W = Math.max(a1, a2) * 3 + 1;
        const g = buildTube(W, 1, 5, pattern);
        const res = exhaustive(g, 3, closeDown);
        for (let k = 1; k <= 3; k++) if (res.best[k] > 2 * prof[k - 1]) return { ok: false, detail: `k=${k}: ${res.best[k]}` };
        return { ok: true, detail: `W=${W}, ${res.sets.toLocaleString('en-GB')} seed sets; worst ${res.best.slice(1).join(', ')}` };
      });
    }
    return list;
  }

  // Attaining attacks from the exact line computation (staggered_line_*.json):
  // [row, column] with row 0 the attack's top row; phase says which step the first barrier below uses.
  const WITNESS = {
    '2,1': [
      { phase: 1, seeds: [[0, 0]] }, { phase: 1, seeds: [[0, 1], [0, 0]] }, { phase: 1, seeds: [[0, 1], [0, 0], [1, 2]] },
      { phase: 1, seeds: [[0, 3], [0, 2], [0, 1], [0, 0]] }, { phase: 1, seeds: [[0, 4], [0, 3], [0, 2], [0, 1], [0, 0]] },
      { phase: 1, seeds: [0, 1, 2, 3, 4, 5].map((c) => [0, c]) }, { phase: 1, seeds: [0, 1, 2, 3, 4, 5, 6].map((c) => [0, c]) },
      { phase: 1, seeds: [0, 1, 2, 3, 4, 5, 6, 7].map((c) => [0, c]) }, { phase: 1, seeds: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => [0, c]) },
    ],
    '3,2': [
      { phase: 1, seeds: [[0, 0]] }, { phase: 1, seeds: [[0, 2], [0, 0]] }, { phase: 1, seeds: [[0, 2], [0, 0], [1, 3]] },
      { phase: 0, seeds: [[0, 3], [0, 0], [1, 2], [2, 3]] }, { phase: 1, seeds: [[0, 4], [0, 2], [0, 0], [1, 5], [1, 3]] },
      { phase: 1, seeds: [[0, 7], [0, 5], [0, 4], [0, 3], [0, 2], [0, 0]] },
      { phase: 0, seeds: [[0, 6], [0, 3], [0, 0], [1, 7], [1, 5], [1, 4], [1, 2]] },
      { phase: 1, seeds: [[0, 10], [0, 8], [0, 6], [0, 4], [0, 2], [0, 0], [1, 5], [1, 3]] },
      { phase: 0, seeds: [[0, 12], [0, 9], [0, 6], [0, 3], [0, 0], [1, 7], [1, 5], [1, 4], [1, 2]] },
    ],
  };

  const api = { buildTube, closeDown, closeUp, exhaustive, macroProfile, binomSum, checks };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RunsafeCheck = api;

  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    let failed = 0;
    for (const c of checks()) {
      const t = Date.now();
      const r = c.run();
      if (!r.ok) failed++;
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  [${c.group}] ${c.name}\n      ${r.detail}  (${Date.now() - t} ms)`);
    }
    console.log(failed ? `${failed} check(s) failed` : 'All checks passed.');
    process.exit(failed ? 1 : 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
