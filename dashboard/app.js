// Token Radar dashboard, radar-3: renders window.RADAR (written by main.ts) with no network.
// Board, detail view, filters, sorting, live-token tab, model panel, stats, top-10 chart and
// early finds all read the same data.js, so the page can never disagree with board.json: the
// detail view even recomputes each protocol's implied value from the row's own multipliers and
// shows it matching, and names why the protocol ranks where it does.
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) { document.body.textContent = 'Token Radar data did not load.'; return; }

  var $ = function (id) { return document.getElementById(id); };
  var rows = R.rows;
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });
  var maxImplied = rows.length ? rows[0].implied_value_usd : 1;

  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return '$' + n;
  }
  function moneyFull(n) { return '$' + n.toLocaleString('en-US'); }
  function pct(v) {
    if (v === null || v === undefined) return '—';
    var s = (v > 0 ? '+' : '') + v.toFixed(1) + '%';
    return s;
  }
  function ageText(days) {
    if (days === null || days === undefined) return '—';
    if (days < 365) return days + 'd';
    return (days / 365).toFixed(1).replace(/\.0$/, '') + 'y';
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  // Header, lede, stats and model panel: the same figures the program computed.
  $('asof').textContent = 'snapshot ' + R.as_of;
  $('asof2').textContent = R.as_of;
  $('modelver').textContent = R.model_version;
  $('counts').textContent = R.board_size + ' protocols · ' + R.watchlist_size + ' on the watchlist';
  $('lede-text').textContent =
    R.watchlist_size + ' watchlist protocols, ranked by implied value, plus ' + R.early_size +
    ' early ones below the watchlist floor — ' + R.board_size + ' in all. The top launch, ' +
    rows[0].name + ', is valued at ' + moneyFull(rows[0].implied_value_usd) +
    '; the live-token tab shows the market values the model is calibrated on.';
  $('globalmult').textContent = R.global_multiple.toFixed(3);
  // Board statistics: what the board contains, in one paragraph, so a reader can judge
  // whether the top is one giant and a long tail or a genuinely spread field.
  (function renderStats() {
    var s = R.stats;
    if (!s) return;
    var top10pct = (s.top10_share * 100).toFixed(1);
    var medAge = s.median_age_days === null ? 'unknown' : s.median_age_days + ' days';
    var medChg = s.median_change_7d === null ? '—' : (s.median_change_7d > 0 ? '+' : '') + s.median_change_7d.toFixed(1) + '%';
    $('board-stats').textContent =
      'The board holds ' + money(s.total_implied_usd) + ' of implied value across ' + R.board_size +
      ' protocols and ' + s.category_count + ' categories. The median launch is worth ' + money(s.median_implied_usd) +
      '; the top 10 hold ' + top10pct + '% of the total. The median protocol is ' + medAge +
      ' old with a 7-day TVL change of ' + medChg + '. The category holding the most value is ' +
      (s.top_category || 'none') + ' at ' + money(s.top_category_implied_usd) + '.';
  })();
  $('st-board').textContent = String(R.board_size);
  $('st-tvl').textContent = money(R.total_pretoken_tvl);
  $('st-watch').textContent = R.watchlist_size + '/' + R.watchlist_size;
  $('st-top').textContent = money(rows[0].implied_value_usd);
  $('st-top-label').textContent = 'top launch · ' + rows[0].name;

  // Top-10 chart: one bar per launch, width against the largest.
  (function renderChart() {
    var box = $('chart');
    box.textContent = '';
    R.top10.forEach(function (t) {
      var row = el('div', 'chart-row');
      var lab = el('span', 'chart-label', '#' + t.rank + ' ' + t.name);
      var track = el('div', 'chart-track');
      var bar = el('div', 'chart-bar');
      bar.style.width = Math.max(2, Math.round(100 * t.implied_value_usd / maxImplied)) + '%';
      var val = el('span', 'chart-value', money(t.implied_value_usd));
      track.appendChild(bar);
      row.appendChild(lab);
      row.appendChild(track);
      row.appendChild(val);
      box.appendChild(row);
    });
  })();

  // Early finds: strongest below the floor, and the fastest growers.
  (function renderEarly() {
    var tb = $('early-rows');
    tb.textContent = '';
    R.early_finds.forEach(function (e) {
      var tr = document.createElement('tr');
      tr.tabIndex = 0;
      tr.appendChild(el('td', 'rank', '#' + e.rank));
      var tdName = el('td');
      tdName.appendChild(el('span', null, e.name));
      tdName.appendChild(el('span', 'sub', e.category || 'No category'));
      tr.appendChild(tdName);
      tr.appendChild(el('td', 'num', money(e.tvl_usd)));
      tr.appendChild(el('td', 'num', money(e.implied_value_usd)));
      tr.addEventListener('click', function () { openDetailBySlug(rows.filter(function (r) { return r.rank === e.rank; })[0].slug); });
      tb.appendChild(tr);
    });
    var tf = $('fast-rows');
    tf.textContent = '';
    R.fastest.forEach(function (f) {
      var tr = document.createElement('tr');
      tr.tabIndex = 0;
      var tdName = el('td');
      tdName.appendChild(el('span', null, f.name));
      tdName.appendChild(el('span', 'sub', f.category || 'No category'));
      tr.appendChild(tdName);
      tr.appendChild(el('td', 'num ' + (f.change_7d >= 0 ? 'up' : 'down'), pct(f.change_7d)));
      tr.appendChild(el('td', 'num', money(f.implied_value_usd)));
      tr.addEventListener('click', function () { openDetailBySlug(rows.filter(function (r) { return r.rank === f.rank; })[0].slug); });
      tf.appendChild(tr);
    });
  })();

  // Filter dropdowns from the data itself.
  var cats = [], chains = [];
  rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  cats.forEach(function (c) { $('category').appendChild(el('option', null, c)); });
  chains.forEach(function (c) { $('chain').appendChild(el('option', null, c)); });

  // State: filters, sorting, tab, detail — all reflected in the hash so a view is linkable.
  var state = { q: '', category: '', chain: '', watchlist: false, tab: 'pre', sort: 'rank', dir: 1, p: '' };
  function readHash() {
    var h = location.hash.replace(/^#/, '');
    var parts = h ? h.split('&') : [];
    var next = { q: '', category: '', chain: '', watchlist: false, tab: 'pre', sort: 'rank', dir: 1, p: '' };
    parts.forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0) return;
      var k = kv.slice(0, i), v = decodeURIComponent(kv.slice(i + 1));
      if (k === 'q') next.q = v;
      else if (k === 'category') next.category = v;
      else if (k === 'chain') next.chain = v;
      else if (k === 'watchlist') next.watchlist = v === '1';
      else if (k === 'tab') next.tab = v === 'live' ? 'live' : 'pre';
      else if (k === 'sort') next.sort = v;
      else if (k === 'dir') next.dir = v === '-1' ? -1 : 1;
      else if (k === 'p') next.p = v;
    });
    state = next;
  }
  function writeHash() {
    var bits = [];
    if (state.q) bits.push('q=' + encodeURIComponent(state.q));
    if (state.category) bits.push('category=' + encodeURIComponent(state.category));
    if (state.chain) bits.push('chain=' + encodeURIComponent(state.chain));
    if (state.watchlist) bits.push('watchlist=1');
    if (state.tab === 'live') bits.push('tab=live');
    if (state.sort !== 'rank' || state.dir !== 1) { bits.push('sort=' + state.sort); bits.push('dir=' + state.dir); }
    if (state.p) bits.push('p=' + encodeURIComponent(state.p));
    var h = bits.length ? '#' + bits.join('&') : '#';
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var out = rows.filter(function (r) {
      if (state.watchlist && !r.watchlist) return false;
      if (state.category && r.category !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (q) {
        var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + r.chains.join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var key = state.sort, dir = state.dir;
    out.sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'string') return dir * (av < bv ? -1 : av > bv ? 1 : 0);
      return dir * (av - bv);
    });
    return out;
  }

  function renderBoard() {
    var list = filtered();
    var tb = $('rows');
    tb.textContent = '';
    list.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.tabIndex = 0;
      tr.dataset.slug = r.slug;
      var tdRank = el('td', 'rank', '#' + r.rank);
      var tdName = el('td');
      tdName.appendChild(el('span', null, r.name));
      if (r.watchlist) tdName.appendChild(el('span', 'badge', 'WATCHLIST'));
      var sub = (r.category || 'No category') + ' · ' + (r.chains.slice(0, 3).join(', ') || '—');
      tdName.appendChild(el('span', 'sub', sub));
      var tdTvl = el('td', 'num', money(r.tvl_usd));
      var tdChg = el('td', 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'), pct(r.change_7d));
      var tdAge = el('td', 'num', ageText(r.age_days));
      var tdImp = el('td', 'num', money(r.implied_value_usd));
      var bar = el('div', 'bar');
      bar.style.width = Math.max(2, Math.round(100 * r.implied_value_usd / maxImplied)) + '%';
      tdImp.appendChild(bar);
      tr.appendChild(tdRank); tr.appendChild(tdName); tr.appendChild(tdTvl);
      tr.appendChild(tdChg); tr.appendChild(tdAge); tr.appendChild(tdImp);
      tr.addEventListener('click', function () { openDetail(r.slug); });
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') openDetail(r.slug); });
      tb.appendChild(tr);
    });
    $('rowcount').textContent = 'Showing ' + list.length + ' of ' + rows.length + ' protocols' +
      (state.watchlist ? ' (watchlist only)' : '') + '.';
  }

  function renderLive() {
    var tb = $('live-rows');
    tb.textContent = '';
    R.live.forEach(function (p) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, p.name));
      tr.appendChild(el('td', null, p.category || '—'));
      tr.appendChild(el('td', 'num', money(p.tvl_usd)));
      tr.appendChild(el('td', 'num', p.mcap_usd === null ? '—' : money(p.mcap_usd)));
      tr.appendChild(el('td', 'num', p.mcap_per_tvl === null ? '—' : p.mcap_per_tvl.toFixed(3)));
      tb.appendChild(tr);
    });
  }

  function renderCalib() {
    var tb = $('calib-rows');
    tb.textContent = '';
    R.calibration.forEach(function (c) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', null, c.category));
      tr.appendChild(el('td', 'num', String(c.live_count)));
      tr.appendChild(el('td', 'num', c.multiple.toFixed(3)));
      tb.appendChild(tr);
    });
  }

  function renderTabs() {
    var live = state.tab === 'live';
    $('tab-pre').setAttribute('aria-selected', live ? 'false' : 'true');
    $('tab-live').setAttribute('aria-selected', live ? 'true' : 'false');
    $('board-wrap').hidden = live;
    $('live-wrap').hidden = !live;
    $('rowcount').hidden = live;
  }

  function syncControls() {
    $('q').value = state.q;
    $('category').value = state.category;
    $('chain').value = state.chain;
    $('watchlist').checked = state.watchlist;
  }

  function renderAll() {
    syncControls();
    renderTabs();
    if (state.tab === 'pre') renderBoard();
  }

  // Detail view: why this rank, model breakdown, a page-side recompute, and the farm plan.
  var dlg = $('detail');
  function openDetail(slug) {
    var r = bySlug[slug];
    if (!r) return;
    state.p = slug;
    writeHash();
    $('d-name').textContent = '#' + r.rank + ' ' + r.name;
    $('d-sub').textContent = (r.category || 'No category') + ' · ' + (r.chains.join(', ') || '—') +
      ' · listed ' + (r.listed_at || 'unknown') + ' · records no token';
    $('d-why').textContent = 'Why this rank: ' + (r.rank_reason || '');
    var dl = $('d-model');
    dl.textContent = '';
    var rows2 = [
      ['TVL', moneyFull(r.tvl_usd)],
      ['7-day TVL change', pct(r.change_7d)],
      ['Age', r.age_days === null ? 'unknown (model uses 365 days)' : r.age_days + ' days'],
      ['Category multiple (' + (r.category || 'no category') + ', ' + r.category_live_count + ' live)', r.category_multiple.toFixed(4)],
      ['Growth multiplier', r.growth_multiplier.toFixed(4)],
      ['Maturity multiplier', r.maturity_multiplier.toFixed(4)],
      ['Chain multiplier (' + r.chains.length + ' chains)', r.chain_multiplier.toFixed(4)],
      ['Implied value', moneyFull(r.implied_value_usd)],
    ];
    rows2.forEach(function (kv) {
      dl.appendChild(el('dt', null, kv[0]));
      dl.appendChild(el('dd', null, kv[1]));
    });
    var recomputed = Math.max(1, Math.round(r.tvl_usd * r.category_multiple * r.growth_multiplier * r.maturity_multiplier * r.chain_multiplier));
    $('d-recompute').textContent = recomputed === r.implied_value_usd
      ? 'Page recompute: ' + moneyFull(recomputed) + ' — matches board.json exactly.'
      : 'Page recompute: ' + moneyFull(recomputed) + ' (board.json: ' + moneyFull(r.implied_value_usd) + ').';
    var ol = $('d-farm');
    ol.textContent = '';
    r.farm_steps.forEach(function (s) { ol.appendChild(el('li', null, s)); });
    if (!dlg.open) dlg.showModal();
  }
  function openDetailBySlug(slug) { openDetail(slug); }
  function closeDetail() {
    if (dlg.open) dlg.close();
    if (state.p) { state.p = ''; writeHash(); }
  }
  $('d-close').addEventListener('click', closeDetail);
  dlg.addEventListener('close', function () { if (state.p) { state.p = ''; writeHash(); } });

  // Controls.
  $('csv').addEventListener('click', function () {
    // Download the filtered board as a CSV: the same rows the table shows, in the same
    // order, so the file can never disagree with the page. No network, no server.
    var list = filtered();
    var head = ['rank', 'slug', 'name', 'category', 'chains', 'tvl_usd', 'change_7d', 'age_days', 'implied_value_usd', 'watchlist'];
    function csvCell(v) {
      if (v === null || v === undefined) return '';
      var s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var lines = [head.join(',')];
    list.forEach(function (r) {
      lines.push([
        r.rank, r.slug, r.name, r.category || '', r.chains.join(';'),
        r.tvl_usd, r.change_7d === null ? '' : r.change_7d,
        r.age_days === null ? '' : r.age_days, r.implied_value_usd, r.watchlist ? '1' : '0',
      ].map(csvCell).join(','));
    });
    var blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'token-radar-board.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('q').addEventListener('input', function (e) { state.q = e.target.value; state.tab = 'pre'; writeHash(); renderAll(); });
  $('category').addEventListener('change', function (e) { state.category = e.target.value; state.tab = 'pre'; writeHash(); renderAll(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; state.tab = 'pre'; writeHash(); renderAll(); });
  $('watchlist').addEventListener('change', function (e) { state.watchlist = e.target.checked; state.tab = 'pre'; writeHash(); renderAll(); });
  $('tab-pre').addEventListener('click', function () { state.tab = 'pre'; writeHash(); renderAll(); });
  $('tab-live').addEventListener('click', function () { state.tab = 'live'; writeHash(); renderAll(); });
  document.querySelectorAll('#board th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.dataset.sort;
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = (key === 'name' || key === 'rank') ? 1 : -1; }
      state.tab = 'pre';
      writeHash();
      renderAll();
    });
  });
  window.addEventListener('hashchange', function () {
    readHash();
    renderAll();
    if (state.p) openDetail(state.p);
    else if (dlg.open) dlg.close();
  });

  renderLive();
  renderCalib();
  readHash();
  renderAll();
  if (state.p) openDetail(state.p);
})();
