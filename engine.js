/* CRM 매뉴얼 영상 공통 엔진 v2: render(T) 하나로 모든 장면을 그린다 (녹화 때 프레임 단위 호출)
   장(chapter) = 왼쪽 단계 목록 + 오른쪽 시스템 화면 + 아래 띠 자막(현재 단계 설명) */
(function () {
  var clamp = function (x, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return Math.max(a, Math.min(b, x)); };
  var ease = function (x) { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  var eo = function (x) { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
  var seg = function (t, a, b) { return ease((t - a) / (b - a)); };
  var lerp = function (a, b, p) { return a + (b - a) * p; };
  var fade = function (t, a, b, c, d) { return Math.min(seg(t, a, b), 1 - seg(t, c, d)); };

  var stage = document.getElementById('stage');
  stage.insertAdjacentHTML('beforeend', '<div id="layer" class="scene"></div><div class="bar t"></div><div class="bar b"></div><div id="cap"></div>');
  var layer = document.getElementById('layer'), capEl = document.getElementById('cap');
  var scenes = [];

  function el(tag, cls, html, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
  function q(root, s) { return root.querySelector(s); }
  function qa(root, s) { return Array.prototype.slice.call(root.querySelectorAll(s)); }
  function set(e, prop, v) { if (!e) return; if (e['_' + prop] !== v) { e['_' + prop] = v; if (prop === 'html') e.innerHTML = v; else if (prop === 'cls') e.className = v; else e.style[prop] = v; } }
  function show(e, p, a, dy, mul) { var k = seg(p, a, a + .6); set(e, 'opacity', k * (mul == null ? 1 : mul)); set(e, 'transform', 'translateY(' + ((1 - k) * (dy == null ? 12 : dy)) + 'px)'); return k; }
  function count(e, val, p, a, b, suf) { var k = eo((p - a) / (b - a)); set(e, 'html', Math.round(val * k).toLocaleString('ko-KR') + (suf || '')); }
  function type(e, str, p, a, b) { var n = Math.round(str.length * clamp((p - a) / (b - a))); var caret = (p > a - .3 && p < b + .5 && Math.floor(p * 2.4) % 2 === 0) ? '<span style="color:#F5A733;font-weight:400">|</span>' : ''; set(e, 'html', str.slice(0, n) + caret); }
  function rect(e, root) { var x = 0, y = 0, n = e; while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x: x, y: y, w: e.offsetWidth, h: e.offsetHeight }; }
  function pos(e, root) { var r = rect(e, root); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }

  var ARROW = '<svg viewBox="0 0 30 34" width="30" height="34"><path d="M3 2 L3 27 L10 20.5 L15 31 L19.5 29 L14.5 18.8 L24 18.8 Z" fill="#F7EFE8" stroke="#120B08" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  /* 커서: keys = [[t, 요소 또는 {x,y}, dx, dy], ...], clicks = [t, ...] */
  function cursor(root) {
    var c = el('div', 'cur', ARROW, root), r = el('div', 'rip', null, root);
    return function (p, keys, clicks) {
      var P = keys.map(function (k) { var v = k[1].nodeType ? pos(k[1], root) : k[1]; return [k[0], v.x + (k[2] || 0), v.y + (k[3] || 0)]; });
      var x = P[0][1], y = P[0][2];
      for (var i = 0; i < P.length - 1; i++) if (p >= P[i][0]) { var k = seg(p, P[i][0], P[i][0] + Math.min(1.1, P[i + 1][0] - P[i][0])); x = lerp(P[i][1], P[i + 1][1], k); y = lerp(P[i][2], P[i + 1][2], k); }
      var last = keys[keys.length - 1][0];
      set(c, 'opacity', fade(p, P[0][0] - .4, P[0][0], last + 1.4, last + 1.9));
      var press = 0; (clicks || []).forEach(function (t) { if (p > t - .1 && p < t + .14) press = 1; });
      set(c, 'transform', 'translate(' + (x - 4) + 'px,' + (y - 3) + 'px) scale(' + (press ? .86 : 1) + ')');
      var ro = 0, rs = 1;
      (clicks || []).forEach(function (t) { var d = p - t; if (d >= 0 && d < .6) { ro = 1 - d / .6; rs = .3 + d * 1.8; } });
      set(r, 'opacity', ro * .9); set(r, 'transform', 'translate(' + x + 'px,' + y + 'px) scale(' + rs + ')');
    };
  }
  /* 강조 테두리: list = [[t0, t1, 요소, 여백], ...]: 주변을 살짝 어둡게 */
  function focus(root) {
    var f = el('div', 'focus', null, root);
    return function (p, list) {
      var on = null; list.forEach(function (it) { if (p >= it[0] && p < it[1]) on = it; });
      if (!on) { set(f, 'opacity', 0); return; }
      var r = rect(on[2], root), m = on[3] == null ? 8 : on[3];
      set(f, 'left', (r.x - m) + 'px'); set(f, 'top', (r.y - m) + 'px'); set(f, 'width', (r.w + 2 * m) + 'px'); set(f, 'height', (r.h + 2 * m) + 'px');
      set(f, 'opacity', fade(p, on[0], on[0] + .3, on[1] - .3, on[1]));
    };
  }
  /* 화면 전환: list = [[t, 화면번호], ...]: 0.4초 교차 */
  function screens(root) {
    var S = qa(root, ':scope > .scr');
    return function (p, list) {
      var cur = 0, since = 0, prev = -1;
      list.forEach(function (it, i) { if (p >= it[0]) { prev = cur; cur = it[1]; since = it[0]; } });
      var k = list.length && p >= list[0][0] && since > list[0][0] - .001 && since !== list[0][0] ? seg(p, since, since + .45) : 1;
      S.forEach(function (s, i) {
        var o = i === cur ? k : (i === prev && k < 1 ? 1 - k : 0);
        set(s, 'opacity', o); set(s, 'visibility', o > 0 ? 'visible' : 'hidden');
        set(s, 'transform', i === cur ? 'translateX(' + ((1 - k) * 26) + 'px)' : 'none');
      });
      return cur;
    };
  }
  function toast(root, html) { var t = el('div', 'toast', html, root); return function (p, a, b) { var k = fade(p, a, a + .35, b - .35, b); set(t, 'opacity', k); set(t, 'transform', 'translate(-50%,' + ((1 - k) * 12) + 'px)'); }; }
  function modal(root, html) { var m = el('div', 'modal', '<div class="box">' + html + '</div>', root); return { el: m, draw: function (p, a, b) { var k = fade(p, a, a + .3, b - .3, b); set(m, 'opacity', k); set(m, 'visibility', k > 0 ? 'visible' : 'hidden'); set(m.firstChild, 'transform', 'scale(' + lerp(.96, 1, k) + ')'); } }; }

  function nav(kind, active) {
    var items, logo, right;
    if (kind === 'admin') { logo = '통합관리시스템<span class="chip">관리자</span>'; items = ['홈', '신청', '심사', '사업관리', '사후관리', '시스템 관리']; right = '<span>창업육성팀 · 담당</span>'; }
    else { logo = '함께일하는재단'; items = ['공모사업', '사업관리']; right = '<span class="' + (active === '마이페이지' ? 'on' : '') + '">마이페이지</span>'; }
    return '<div class="ph"><span class="logo">' + logo + '</span>' + items.map(function (i) { return '<span class="' + (i === active ? 'on' : '') + '">' + i + '</span>'; }).join('') + '<span class="sp"></span>' + right + '</div>';
  }
  function camAt(cam, p) {
    var c = cam[0];
    if (p <= c[0]) return { s: c[1], x: c[2], y: c[3] };
    for (var i = 0; i < cam.length - 1; i++) { var a = cam[i], b = cam[i + 1]; if (p >= a[0] && p <= b[0]) { var k = seg(p, a[0], b[0]); return { s: lerp(a[1], b[1], k), x: lerp(a[2], b[2], k), y: lerp(a[3], b[3], k) }; } }
    c = cam[cam.length - 1]; return { s: c[1], x: c[2], y: c[3] };
  }

  /* 장: o = {kind, nav, no, title, path, lead, steps:[[t,'단계','자막'],...], html(화면들 .scr), draw(pc,panel)→fn(p,D), cam} */
  function chapter(a, b, o) {
    var root = el('div', 'scene', null, layer); root.style.display = 'none';
    var s = { a: a, b: b, root: root, capOp: 0, label: o.title, cat: o.cat };
    var rail = el('div', 'rail', '<div class="no">' + o.no + '</div><div class="ti">' + o.title + '</div><div class="pa">' + o.path + '</div>' + (o.core ? '<div class="core"><b>핵심</b>' + o.core + '</div>' : '') +
      '<ol>' + o.steps.map(function (st, i) { return '<li><i>' + (i + 1) + '</i><span>' + st[1] + '</span></li>'; }).join('') + '</ol>', root);
    var lis = qa(rail, 'li'), heads = qa(rail, '.no,.ti,.pa,.core');
    var pw = el('div', 'pw', null, root), panel = el('div', 'panel', null, pw);
    panel.insertAdjacentHTML('beforeend', nav(o.kind, o.nav) + '<div class="pc">' + o.html + '</div>');
    var pc = q(panel, '.pc');
    var inner = o.draw ? o.draw(pc, panel) : function () {};
    s.draw = function (lt, d) {
      var op = fade(lt, 0, .5, d - .45, d); set(root, 'opacity', op);
      heads.forEach(function (h, i) { show(h, lt, .05 + i * .1, 10); });
      var cur = -1; o.steps.forEach(function (st, i) { if (lt >= st[0]) cur = i; });
      lis.forEach(function (li, i) { show(li, lt, .3 + i * .08, 8); set(li, 'cls', i === cur ? 'on' : (i < cur ? 'done' : '')); });
      var c = camAt(o.cam || [[0, 1, 565, 390], [d, 1.02, 565, 390]], lt), s0 = lerp(.97, 1, eo(lt / .9));
      set(pw, 'transformOrigin', c.x + 'px ' + c.y + 'px'); set(pw, 'transform', 'scale(' + (s0 * c.s).toFixed(4) + ')');
      inner(lt, d);
      if (cur >= 0) { s.cap = ['STEP ' + (cur + 1), o.steps[cur][2] || o.steps[cur][1]]; s.capOp = op * seg(lt, o.steps[cur][0], o.steps[cur][0] + .35); }
      else s.capOp = 0;
    };
    scenes.push(s);
  }

  function flow(parent, labels, top) {
    var f = el('div', 'flow', '<div class="tr"></div><div class="fl"></div>', parent); f.style.top = top + 'px';
    var n = labels.length, dots = [], lbs = [];
    labels.forEach(function (l, i) { var x = (i / (n - 1)) * 100; var d = el('div', 'dot', null, f); d.style.left = x + '%'; var t = el('div', 'lb', l, f); t.style.left = x + '%'; dots.push(d); lbs.push(t); });
    var fl = q(f, '.fl');
    return { el: f, dots: dots, lbs: lbs, draw: function (k) { set(fl, 'width', (k * 100) + '%'); dots.forEach(function (d, i) { var on = k >= i / (n - 1) - .001; set(d, 'cls', 'dot' + (on ? ' lit' : '')); set(lbs[i], 'cls', 'lb' + (on ? ' lit' : '')); }); } };
  }

  /* 여는 장면 (짧게): 작은 제목 → 큰 문장 → 흐름선 */
  function intro(kick, l1, l2, labels) {
    return function (root) {
      var h = el('div', 'head', '<div class="kick">' + kick + '</div><div>' + l1 + '</div><div>' + l2 + '</div>', root); h.style.top = '150px'; h.style.height = '520px';
      var r = h.children, f = flow(root, labels, 700);
      return function (lt, d) {
        var out = 1 - seg(lt, d - .7, d);
        show(r[0], lt, .2, 10, out); show(r[1], lt, .5, 14, out); show(r[2], lt, 1.1, 14, out);
        set(f.el, 'opacity', fade(lt, 1.6, 2.1, d - .7, d)); f.draw(seg(lt, 1.8, d - 1.2));
      };
    };
  }
  /* 닫는 장면 */
  function outro(labels, l1, l2, sub) {
    return function (root) {
      var f = flow(root, labels, 300);
      var glow = el('div', 'flare', null, root); glow.style.top = '332px'; glow.style.left = '1580px';
      var h = el('div', 'head', '<div>' + l1 + '</div><div>' + l2 + '</div>', root); h.style.top = '470px'; h.style.height = '260px';
      var sb = el('div', 'head', sub, root); sb.style.top = '780px'; sb.style.height = '80px'; sb.style.fontSize = '24px'; sb.style.color = '#9c8a7d'; sb.style.fontWeight = '600'; sb.style.letterSpacing = '.02em';
      var r1 = h.children[0], r2 = h.children[1];
      return function (lt, d) {
        var all = 1 - seg(lt, d - 1.4, d - .1);
        f.draw(seg(lt, .3, 2.6)); set(f.el, 'opacity', fade(lt, 0, .5, d - 1.4, d - .1));
        var last = f.dots[f.dots.length - 1], g = seg(lt, 2.4, 3.6);
        set(glow, 'opacity', g * (.8 + .2 * Math.sin(lt * 1.5)) * all); set(last, 'transform', 'scale(' + (1 + g * .6) + ')');
        show(r1, lt, 3.0, 14, all); show(r2, lt, 3.8, 14, all); show(sb, lt, 5.0, 8, all);
      };
    };
  }
  function add(a, b, o) { var root = el('div', 'scene', null, layer); root.style.display = 'none'; var s = { a: a, b: b, root: root, capOp: 0, label: o.label, cat: o.cat }; s.draw = o.custom(root, s); scenes.push(s); }

  function render(T) {
    var best = null;
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i], vis = T >= s.a && T < s.b;
      set(s.root, 'display', vis ? '' : 'none');
      if (!vis) continue;
      s.draw(T - s.a, s.b - s.a);
      if (s.cap && s.capOp > 0 && (!best || s.capOp > best.capOp)) best = s;
    }
    if (best) { set(capEl, 'html', '<span class="path">' + best.cap[0] + '</span><span>' + best.cap[1] + '</span>'); set(capEl, 'opacity', best.capOp); }
    else set(capEl, 'opacity', 0);
  }
  function fit() { var k = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = 'translate(' + ((innerWidth - 1920 * k) / 2) + 'px,' + ((innerHeight - 1080 * k) / 2) + 'px) scale(' + k + ')'; }

  function start() {
    var DURATION = scenes.reduce(function (m, s) { return Math.max(m, s.b); }, 0);
    window.DURATION = DURATION;
    var rec = /[?&]render/.test(location.search);
    window.__ready = document.fonts.load('600 20px SUIT').then(function () { return document.fonts.ready; }).then(function () { render(0); return true; });
    if (rec) return;
    var navEl = el('div', 'chn', '<div class="cats"></div><div class="subs"></div>', stage), cats = [], jump = function (x) { seek(x); if (!playing) toggle(); };
    scenes.forEach(function (s) {
      if (!s.cat) return;
      var g = s.cat.split(' · ')[0], C = cats[cats.length - 1];
      if (!C || C.name !== g) { C = { name: g, list: [] }; cats.push(C); }
      C.list.push(s);
    });
    var catsEl = navEl.firstChild, subsEl = navEl.lastChild;
    cats.forEach(function (C, i) {
      C.a = C.list[0].a; C.b = C.list[C.list.length - 1].b;
      C.el = el('div', 'cat', '<span class="cn">' + (i + 1) + '</span><span class="ct">' + C.name + '</span><i class="cb"><b></b></i>', catsEl);
      C.bar = C.el.querySelector('b'); C.el.onclick = function () { jump(C.a); };
      C.sub = el('div', 'sub', null, subsEl);
      C.chips = C.list.map(function (s, j) { var c = el('span', 'chip', '<em>' + (j + 1) + '</em>' + s.label, C.sub); c.onclick = function () { jump(s.a); }; return [c, s]; });
    });
    fit(); addEventListener('resize', fit);
    var ui = el('div', null, null, document.body); ui.id = 'ui';
    ui.innerHTML = '<button id="pp">재생</button><select id="ch"></select><input id="sk" type="range" min="0" step="0.01"><span id="tc"></span>' + (window.TRACKS ? '<select id="vo">' + window.TRACKS.map(function (k) { return '<option value="' + k[1] + '">' + k[0] + '</option>'; }).join('') + '</select>' : '');
    var pp = q(ui, '#pp'), sk = q(ui, '#sk'), tc = q(ui, '#tc'), ch = q(ui, '#ch');
    sk.max = DURATION;
    function mm(x) { x = Math.max(0, x); return Math.floor(x / 60) + ':' + ('0' + Math.floor(x % 60)).slice(-2); }
    scenes.forEach(function (s, i) { var o = el('option', null, mm(s.a) + '  ' + (s.label || ''), ch); o.value = s.a; });
    var t = 0, playing = false, last = 0, au = window.MUSIC ? new Audio(window.MUSIC) : null;
    function seek(x) { t = Math.max(0, Math.min(DURATION, x)); if (au) au.currentTime = t; }
    function toggle() { playing = !playing; pp.textContent = playing ? '정지' : '재생'; last = performance.now(); if (t >= DURATION - .05) seek(0); if (au) { if (playing) { au.currentTime = t; au.play(); } else au.pause(); } }
    pp.onclick = toggle; var vo = q(ui, '#vo'); if (vo && au) vo.onchange = function () { au.pause(); au.src = vo.value; au.currentTime = t; if (playing) au.play(); vo.blur(); }; sk.oninput = function () { seek(+sk.value); }; ch.onchange = function () { seek(+ch.value); ch.blur(); };
    addEventListener('keydown', function (e) {
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.code === 'ArrowRight') seek(t + 5);
      if (e.code === 'ArrowLeft') seek(t - 5);
      if (e.code === 'KeyF') fs();
    });
    function fs() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }
    stage.ondblclick = fs;
    (function loop(now) {
      if (playing) { if (au && !au.paused) t = au.currentTime; else t += (now - last) / 1000; if (t >= DURATION) { t = DURATION - .01; toggle(); } }
      last = now; render(t); var curC = null; cats.forEach(function (C) { var on = t >= C.a && t < C.b; if (on) curC = C; set(C.el, 'cls', 'cat' + (on ? ' on' : t >= C.b ? ' done' : '')); set(C.bar, 'width', (Math.max(0, Math.min(1, (t - C.a) / (C.b - C.a))) * 100) + '%'); C.chips.forEach(function (x) { set(x[0], 'cls', 'chip' + (t >= x[1].a && t < x[1].b ? ' on' : t >= x[1].b ? ' done' : '')); }); }); if (!curC) curC = t < cats[0].a ? cats[0] : cats[cats.length - 1]; cats.forEach(function (C) { set(C.sub, 'display', C === curC ? 'flex' : 'none'); }); sk.value = t; tc.textContent = mm(t) + ' / ' + mm(DURATION);
      requestAnimationFrame(loop);
    })(performance.now());
  }

  window.render = render;
  window.V = { add: add, chapter: chapter, intro: intro, outro: outro, flow: flow, start: start, el: el, q: q, qa: qa, set: set, show: show, count: count, type: type, cursor: cursor, focus: focus, screens: screens, toast: toast, modal: modal, pos: pos, rect: rect, clamp: clamp, ease: ease, eo: eo, seg: seg, lerp: lerp, fade: fade, scenes: scenes };
})();
