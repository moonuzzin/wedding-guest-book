// 사진 업로드 + 방명록. 서버 = Google Apps Script (apps-script/Code.gs)
(() => {
  const C = window.WEDDING, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const DEMO = !C.api;
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  $$('[data-groom]').forEach(e => e.textContent = C.groom);
  $$('[data-bride]').forEach(e => e.textContent = C.bride);
  $$('[data-date]').forEach(e => e.textContent = C.date);
  $('#demo').hidden = !DEMO;

  // ── 배경음악 ──
  // 폰 브라우저는 '터치'가 한 번 있어야 소리를 낼 수 있음 → '입장하기' 화면으로 첫 터치를 받음.
  // 그 전에 다른 곳(사진 올리기 등)을 먼저 터치해도 음악이 켜짐. 끄는 버튼은 없음.
  const bgm = new Audio('assets/bgm.mp3');
  bgm.loop = true; bgm.volume = 0.5; bgm.preload = 'auto';
  let started = false, entered = false;
  const play = () => { if (!started) bgm.play().then(() => { started = true; }).catch(() => {}); };
  const enter = () => {
    play();
    if (entered) return;
    entered = true; $('#enter').remove(); document.body.classList.add('go'); // 맵 이름 배너는 입장할 때
  };
  // 페이지 열자마자 자동재생 X, 스크롤(touchend) X → '탭'했을 때만 시작
  // (pointerup은 스크롤하면 취소돼서 안 옴)
  ['pointerup', 'keydown'].forEach(t => addEventListener(t, enter));
  document.addEventListener('visibilitychange', () => { // 다른 앱으로 가면 멈추고, 돌아오면 다시
    if (document.hidden) bgm.pause(); else if (started) bgm.play().catch(() => {});
  });

  // ── 화면 확대 막기 (아이폰은 viewport 설정을 무시해서 직접 막음) ──
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  // ── 알림 ──
  let toastT;
  function toast(...parts) { // parts: 문자열, 또는 [강조문자열]
    const el = $('#toast'); el.replaceChildren(...parts.map(p => {
      if (!Array.isArray(p)) return p; const b = document.createElement('b'); b.textContent = p[0]; return b; }));
    el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ── 이름 (두 입력칸 공유 + 내 캐릭터 이름표) ──
  let nick = store.get('nick') || '';
  const nicks = $$('.nick');
  nicks.forEach(i => {
    i.value = nick;
    i.addEventListener('input', () => {
      nick = i.value.trim(); nicks.forEach(o => o !== i && (o.value = i.value));
      store.set('nick', nick); Game.setName(nick);
    });
  });
  Game.ready.then(() => { Game.setName(nick); Game.say(store.get('myMsg')); }); // 다시 들어와도 내 한마디 유지

  async function post(body) {
    if (DEMO) { await new Promise(r => setTimeout(r, 500)); return; }
    const r = await fetch(C.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'upload failed');
  }

  // ── 방명록 ──
  const list = $('#gbList');
  const fmt = t => { const d = new Date(t); return isNaN(d) ? '' : `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function entry(e, isNew) {
    const li = document.createElement('li'), b = document.createElement('b'), tm = document.createElement('time'), p = document.createElement('p');
    b.textContent = e.name || '익명의 하객'; tm.textContent = fmt(e.t); p.textContent = e.msg;
    li.append(tm, b, p); if (isNew) li.className = 'new';
    return li;
  }
  async function loadGuestbook() {
    let rows = [];
    try {
      rows = DEMO ? JSON.parse(store.get('gb') || '[]')
                  : await (await fetch(C.api + '?type=guestbook')).json();
    } catch { /* 방명록 못 불러와도 페이지는 동작 */ }
    list.replaceChildren(...rows.map(e => entry(e)));
    await Game.ready;
    rows.slice(0, 8).reverse().forEach(e => Game.spawnGuest(e.name || '익명의 하객', e.msg));
  }
  loadGuestbook();

  $('#gbForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target, btn = f.querySelector('button'), msg = f.msg.value.trim();
    if (!msg) return;
    const e = { t: new Date().toISOString(), name: nick || '익명의 하객', msg };
    btn.disabled = true;
    try {
      await post({ type: 'guestbook', name: e.name, msg });
      if (DEMO) store.set('gb', JSON.stringify([e, ...JSON.parse(store.get('gb') || '[]')].slice(0, 100)));
      list.prepend(entry(e, true)); f.msg.value = '';
      toast('방명록을 남겼습니다. ', ['맵에서 내 캐릭터를 확인해보세요!']);
      Game.say(msg); store.set('myMsg', msg);
      scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast('전송 실패 😢 ', ['잠시 후 다시 눌러주세요']);
    }
    btn.disabled = false;
  });

  // ── 사진 ──
  let sent = +(store.get('sent') || 0), busy = false, failed = [];
  const cnt = $('#cnt'), inv = $('#inv'), exp = $('#exp');
  cnt.textContent = sent;
  for (let i = 0; i < 10; i++) { const d = document.createElement('div'); d.className = 'e'; inv.append(d); } // 빈 인벤토리 칸

  const toBase64 = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result.split(',')[1]); r.onerror = no; r.readAsDataURL(blob); });
  async function prepare(file) {
    const raw = async () => ({ data: await toBase64(file), mime: file.type || 'image/jpeg', name: file.name });
    if (!C.maxSide) return raw();
    try {
      const bmp = await createImageBitmap(file);
      const k = C.maxSide / Math.max(bmp.width, bmp.height);
      if (k >= 1 && file.type === 'image/jpeg') { bmp.close(); return raw(); }
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * Math.min(1, k)); c.height = Math.round(bmp.height * Math.min(1, k));
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      return { data: await toBase64(blob), mime: 'image/jpeg', name: file.name.replace(/\.\w+$/, '') + '.jpg' };
    } catch { return raw(); } // HEIC 등 디코딩 못하면 원본 그대로
  }

  async function upload(items) {
    busy = true; failed = []; $('#retry').hidden = true;
    let done = 0, ok = 0;
    exp.hidden = false;
    const bar = () => { exp.querySelector('i').style.width = `calc(${done / items.length * 100}% - 2px)`; $('#expText').textContent = `${done} / ${items.length}`; };
    bar();
    for (const it of items) {
      it.slot.className = 'up';
      try {
        const p = await prepare(it.file);
        await post({ type: 'photo', uploader: nick, filename: p.name, mime: p.mime, data: p.data });
        it.slot.className = ''; ok++; sent++; cnt.textContent = sent; store.set('sent', sent);
      } catch { it.slot.className = 'bad'; failed.push(it); }
      done++; bar();
    }
    busy = false;
    if (ok) toast('사진 ', [`${ok}장`], '을 획득했습니다 ', ['(+' + ok + ')']);
    if (failed.length) { $('#retry').hidden = false; toast('', [`${failed.length}장`], ' 업로드 실패. 아래 버튼으로 다시 올려주세요'); }
    setTimeout(() => { if (!busy) exp.hidden = true; }, 2500);
  }

  $('#file').addEventListener('change', e => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length || busy) return;
    const items = files.map(file => {
      const slot = document.createElement('div'), img = document.createElement('img');
      img.src = URL.createObjectURL(file); img.alt = ''; slot.append(img); inv.prepend(slot); inv.querySelector('.e:last-child')?.remove();
      return { file, slot };
    });
    upload(items);
  });
  $('#retry').addEventListener('click', () => !busy && failed.length && upload(failed));
  addEventListener('beforeunload', e => { if (busy) e.preventDefault(); });
})();
