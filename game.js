// 웨딩홀 맵: 신랑·신부는 공중 제단 위, 하객은 아래(바닥·케이크)에서 돌아다님.
(() => {
  const C = window.WEDDING;
  const S = 2;                       // 맵 확대 배율 (도트 감성 유지용 정수배)
  const W = 686 * S, H = 291 * S;    // 월드 크기
  const G = 2000, JV = 760, SPD = 150;
  const CW = 96, CH = 100, FX = 48, FY = 90; // guests.png 셀 규격 (발 위치 FX,FY)
  // 하객이 밟을 수 있는 발판 (원본 맵 좌표 ×S). 제단 섬은 일부러 없음 → 하객은 못 올라감.
  const PLAT = [
    { x1: 0, x2: W, y: 261 * S, ground: true },
    { x1: 50 * S, x2: 200 * S, y: 200 * S },   // 케이크 1단
    { x1: 63 * S, x2: 192 * S, y: 175 * S },   // 금색 받침
    { x1: 70 * S, x2: 185 * S, y: 145 * S },   // 케이크 꼭대기
  ];
  const ISLAND_Y = 137 * S;
  const COUPLE = [
    { img: 'assets/groom.png', x: 318 * S, h: 92, name: C.groom, tag: '#2b4a7a', flip: true, // 신부 쪽을 보도록 좌우반전
      lines: ['와주셔서 진짜 감사합니다!', '사진 많이 찍어주세요 📸', '맛있게 드시고 가세요!'] },
    { img: 'assets/bride.png', x: 384 * S, h: 88, name: C.bride, tag: '#a8436a',
      lines: ['오늘 와줘서 고마워요 ♥', '찍은 사진 꼭 올려주세요!', '방명록도 한마디 남겨줘요~'] },
  ];

  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  let map, atlas, rows = 1, vw = 0, vh = 0, dpr = 1, camX = 0, camY = 0, time = 0;
  const actors = [], hearts = [], keys = {};
  let player;

  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    vw = r.width; vh = r.height;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  }

  const actor = (o) => Object.assign({ x: 0, y: PLAT[0].y, vx: 0, vy: 0, face: -1, on: null, row: 0,
    t: Math.random() * 3, prone: false, bubble: null, ai: null, name: '', lines: [] }, o);

  let deck = []; // 같은 캐릭터가 겹치지 않게 섞어서 한 명씩
  const nextRow = () => { if (!deck.length) deck = [...Array(rows).keys()].sort(() => Math.random() - .5); return deck.pop(); };

  function spawn(o) {
    const a = actor({ x: 80 + Math.random() * (W - 160), row: nextRow(), ai: { next: 0 }, ...o });
    actors.push(a);
    // ponytail: 화면에 최대 14명, 오래된 하객부터 퇴장
    const npcs = actors.filter(x => x !== player);
    if (npcs.length > 14) actors.splice(actors.indexOf(npcs[0]), 1);
    return a;
  }

  function say(a, text, sec = 4) {
    if (!text) return;
    text = String(text);
    a.bubble = { text: text.length > 60 ? text.slice(0, 59) + '…' : text, until: time + sec };
  }

  function jump(a) {
    if (!a.on) return;
    if (a.prone && !a.on.ground) { a.drop = a.on; a.dropT = time + 0.35; a.on = null; a.y += 2; return; }
    a.vy = -JV; a.on = null;
  }

  function step(a, dt) {
    a.t += dt;
    a.vy += G * dt;
    const py = a.y;
    a.x = Math.max(20, Math.min(W - 20, a.x + a.vx * dt));
    a.y += a.vy * dt;
    if (a.drop && time > a.dropT) a.drop = null;
    a.on = null;
    if (a.vy >= 0) for (const p of PLAT) {
      if (p !== a.drop && a.x >= p.x1 && a.x <= p.x2 && py <= p.y + 1 && a.y >= p.y) { a.y = p.y; a.vy = 0; a.on = p; break; }
    }
  }

  function think(a) {
    if (time < a.ai.next) return;
    const r = Math.random();
    a.ai.next = time + 1 + Math.random() * 3;
    a.vx = r < 0.4 ? 0 : (r < 0.7 ? -1 : 1) * SPD * 0.7;
    if (a.vx) a.face = Math.sign(a.vx);
    if (Math.random() < 0.15) jump(a);
    if (a.lines.length && Math.random() < 0.25) say(a, a.lines[Math.random() * a.lines.length | 0]);
  }

  function frame(a) {
    if (!a.on) return 7;
    if (a.prone) return 8;
    if (a.vx) return 3 + (a.t / 0.15 | 0) % 4;
    return [0, 1, 2, 1][(a.t / 0.5 | 0) % 4];
  }

  // ── 그리기 ────────────────────────────────────────
  function tag(text, x, y, bg = 'rgba(0,0,0,.62)', fg = '#fff') {
    ctx.font = '11px Galmuri11, sans-serif';
    const w = Math.ceil(ctx.measureText(text).width) + 8;
    ctx.fillStyle = bg; ctx.fillRect(Math.round(x - w / 2), y, w, 15);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, Math.round(x), y + 8);
  }

  function balloon(text, x, bottom) {
    ctx.font = '11px Galmuri11, sans-serif';
    const lines = [], maxW = 132;
    let cur = '';
    for (const ch of text) { if (ctx.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; } else cur += ch; }
    lines.push(cur);
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 14, h = lines.length * 14 + 8;
    const bx = Math.round(x - w / 2), by = Math.round(bottom - h - 6); // 말풍선은 항상 말하는 캐릭터 머리 위에 고정
    ctx.fillStyle = '#2c2c2c';
    ctx.fillRect(bx + 2, by, w - 4, h); ctx.fillRect(bx, by + 2, w, h - 4); ctx.fillRect(bx + 1, by + 1, w - 2, h - 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx + 2, by + 1, w - 4, h - 2); ctx.fillRect(bx + 1, by + 2, w - 2, h - 4);
    // 꼬리
    const tx = Math.round(x);
    ctx.fillStyle = '#2c2c2c'; ctx.fillRect(tx - 4, by + h - 1, 9, 2); ctx.fillRect(tx - 3, by + h + 1, 7, 2); ctx.fillRect(tx - 2, by + h + 3, 5, 2); ctx.fillRect(tx - 1, by + h + 5, 3, 1);
    ctx.fillStyle = '#fff'; ctx.fillRect(tx - 3, by + h - 1, 7, 2); ctx.fillRect(tx - 2, by + h + 1, 5, 2); ctx.fillRect(tx - 1, by + h + 3, 3, 1);
    ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + w / 2, by + 5 + i * 14));
  }

  const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  function heart(x, y, a) {
    ctx.globalAlpha = a;
    HEART.forEach((row, j) => [...row].forEach((c, i) => {
      if (c !== '#') return;
      ctx.fillStyle = (i === 1 && j === 1) ? '#fff' : '#ff6f9f';
      ctx.fillRect(Math.round(x) + i * 2, Math.round(y) + j * 2, 2, 2);
    }));
    ctx.globalAlpha = 1;
  }

  function drawActor(a) {
    const sx = frame(a) * CW, sy = a.row * CH, x = Math.round(a.x - camX), y = Math.round(a.y - camY);
    ctx.save(); ctx.translate(x, 0);
    if (a.face > 0) ctx.scale(-1, 1);
    ctx.drawImage(atlas, sx, sy, CW, CH, -FX, y - FY, CW, CH);
    ctx.restore();
    if (a.name) tag(a.name, x, y + 3, 'rgba(0,0,0,.62)', a === player ? '#fff6a8' : '#fff');
    if (a === player && time < 6) { // 처음 몇 초 '나' 표시
      const b = Math.round(Math.sin(time * 6) * 2);
      ctx.fillStyle = '#ffd400'; ctx.strokeStyle = '#4a3200';
      ctx.beginPath(); ctx.moveTo(x - 6, y - 92 + b); ctx.lineTo(x + 6, y - 92 + b); ctx.lineTo(x, y - 84 + b); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (a.bubble && time < a.bubble.until) balloon(a.bubble.text, x, y - 70);
  }

  function drawCouple() {
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    for (const c of COUPLE) {
      const w = c.im.width * c.h / c.im.height, x = Math.round(c.x - camX), y = Math.round(ISLAND_Y + 2 - camY);
      const breathe = (Math.sin(time * 2.2 + c.x) > 0.6) ? 1 : 0;
      ctx.save(); ctx.translate(x, 0); if (c.flip) ctx.scale(-1, 1);
      ctx.drawImage(c.im, Math.round(-w / 2), y - c.h + breathe, Math.round(w), c.h - breathe);
      ctx.restore();
      c.box = { x1: c.x - w / 2, x2: c.x + w / 2, y1: ISLAND_Y - c.h, y2: ISLAND_Y };
    }
    ctx.imageSmoothingEnabled = false;
    for (const c of COUPLE) {
      const x = c.x - camX, y = ISLAND_Y - camY;
      tag(c.name, x, y + 4, c.tag);
      if (c.bubble && time < c.bubble.until) balloon(c.bubble.text, x, y - c.h - 4);
    }
  }

  function minimap() {
    const mw = 112, mh = Math.round(mw * H / W), x0 = 8, y0 = 8;
    ctx.fillStyle = 'rgba(20,24,40,.72)'; ctx.fillRect(x0 - 3, y0 - 3, mw + 6, mh + 20);
    ctx.font = '10px Galmuri11, sans-serif'; ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('웨딩빌리지 : 결혼식장', x0, y0 - 1);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(map, x0, y0 + 13, mw, mh); ctx.imageSmoothingEnabled = false;
    const dot = (wx, wy, col) => { ctx.fillStyle = '#000'; ctx.fillRect(x0 + wx / W * mw - 2, y0 + 13 + wy / H * mh - 4, 5, 5); ctx.fillStyle = col; ctx.fillRect(x0 + wx / W * mw - 1, y0 + 13 + wy / H * mh - 3, 3, 3); };
    COUPLE.forEach(c => dot(c.x, ISLAND_Y, '#ff7eb6'));
    actors.forEach(a => a !== player && dot(a.x, a.y, '#ff4b4b'));
    dot(player.x, player.y, '#ffe600');
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.strokeRect(x0 + camX / W * mw + .5, y0 + 13 + camY / H * mh + .5, vw / W * mw, Math.min(vh, H) / H * mh);
  }

  // ── 루프 ──────────────────────────────────────────
  let last = 0, coupleTalk = 3, talkTurn = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; time += dt;

    player.prone = !!keys.down && !!player.on;
    player.vx = player.prone ? 0 : (keys.right ? SPD : 0) - (keys.left ? SPD : 0);
    if (player.vx) player.face = Math.sign(player.vx);
    if (keys.jump) jump(player);
    for (const a of actors) { if (a.ai) think(a); step(a, dt); }

    if (time > coupleTalk) { const c = COUPLE[talkTurn++ % 2]; c.bubble = { text: c.lines[Math.random() * c.lines.length | 0], until: time + 3.5 }; coupleTalk = time + 7; }
    if (Math.random() < dt * 1.6) hearts.push({ x: (COUPLE[0].x + COUPLE[1].x) / 2 + (Math.random() - .5) * 60, y: ISLAND_Y - 70, vx: (Math.random() - .5) * 18, t: 0 });
    for (const h of hearts) { h.t += dt; h.x += h.vx * dt + Math.sin(h.t * 3) * .3; h.y -= 26 * dt; }
    while (hearts.length && hearts[0].t > 3.2) hearts.shift();

    camX = Math.max(0, Math.min(W - vw, player.x - vw / 2));
    camY = Math.max(0, H - vh);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#7fc8f8'; ctx.fillRect(0, 0, vw, vh);
    ctx.drawImage(map, Math.round(-camX), Math.round(-camY), W, H);
    drawCouple();
    for (const h of hearts) heart(h.x - camX, h.y - camY, Math.min(1, 3.2 - h.t));
    actors.filter(a => a !== player).forEach(drawActor);
    drawActor(player);
    minimap();
    requestAnimationFrame(loop);
  }

  // ── 입력 ──────────────────────────────────────────
  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ' ': 'jump', Alt: 'jump', x: 'jump', c: 'jump' };
  addEventListener('keydown', e => {
    if (e.target.closest?.('input,textarea')) return;
    if (KEYMAP[e.key]) { keys[KEYMAP[e.key]] = true; e.preventDefault(); }
  });
  addEventListener('keyup', e => { if (KEYMAP[e.key]) keys[KEYMAP[e.key]] = false; });
  document.querySelectorAll('[data-key]').forEach(b => {
    const k = b.dataset.key, on = e => { e.preventDefault(); keys[k] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch {} },
      off = () => { keys[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, off));
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
  // 캐릭터 탭하면 한마디
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect(), wx = e.clientX - r.left + camX, wy = e.clientY - r.top + camY;
    for (const c of COUPLE) if (c.box && wx > c.box.x1 && wx < c.box.x2 && wy > c.box.y1 && wy < c.box.y2) { c.bubble = { text: c.lines[Math.random() * c.lines.length | 0], until: time + 3.5 }; return; }
    for (const a of actors) if (a !== player && Math.abs(wx - a.x) < 20 && wy > a.y - 70 && wy < a.y + 18) { say(a, a.lines[0] || ['안녕하세요!', '축하해요~!', '♥'][Math.random() * 3 | 0]); return; }
  });

  // ── 시작 ──────────────────────────────────────────
  window.Game = {
    ready: Promise.all([load('assets/map.png'), load('assets/guests.png'), ...COUPLE.map(c => load(c.img)),
      document.fonts?.load('11px Galmuri11').catch(() => {})]).then(([m, a, g, b]) => {
      map = m; atlas = a; rows = a.height / CH | 0; COUPLE[0].im = g; COUPLE[1].im = b;
      resize(); addEventListener('resize', resize);
      player = actor({ x: 351 * S + (Math.random() - .5) * 120, row: nextRow(), name: '나' });
      actors.push(player);
      for (let i = 0; i < 5; i++) spawn({});
      document.body.classList.add('go');
      requestAnimationFrame(loop);
    }),
    spawnGuest: (name, msg) => { const a = spawn({ name, lines: msg ? [msg] : [] }); if (msg) say(a, msg, 5); return a; },
    setName: n => { if (player) player.name = n || '나'; },
    say: t => player && say(player, t, Infinity), // 내 방명록 말풍선은 새 글을 쓸 때까지 계속
  };
})();
