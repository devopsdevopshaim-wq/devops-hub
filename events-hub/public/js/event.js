/* global $, $$, api, esc, toast, store, myEvents, PhotoEditor, icon, asset, PHOTOS, offerInstall */
(function () {
  // הקוד מה-QR: event.html?c=XXXX
  const code = (new URLSearchParams(location.search).get('c') || '').replace(/[^a-f0-9]/g, '');
  let ev = null;
  let me = null; // { guestId, guestToken }
  let selectedOption = null;
  let pendingBlob = null;
  let pendingEdits = '';
  let editor = null;

  const views = ['register', 'main', 'editor', 'confirm', 'error'];
  function show(v) {
    views.forEach((x) => $(`#view-${x}`).classList.toggle('hidden', x !== v));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function headers() {
    return { 'x-guest-id': me.guestId, 'x-guest-token': me.guestToken };
  }

  function fail(msg) {
    $('#ev-name').textContent = '';
    $('#error-msg').textContent = msg;
    show('error');
  }

  function renderEvent() {
    $('#ev-name').textContent = ev.name;
    $('#ev-welcome').textContent = ev.welcomeText || (ev.date ? new Date(ev.date).toLocaleDateString('he-IL') : '');
    document.title = `${ev.name} - שליחת תמונות`;
    $('#print-options').innerHTML = ev.printOptions.map((o) => `
      <div class="option-card" data-opt="${esc(o.id)}" role="radio" tabindex="0">
        <span class="opt-art">${PHOTOS.img(PHOTOS.forPrint(o.type), o.label, 240, 180)}</span><div><b>${esc(o.label)}</b><div class="muted small">גודל ${esc(o.size)} ס"מ</div></div>
      </div>`).join('');
    if (ev.printOptions.length === 1) selectOption(ev.printOptions[0].id);
  }

  function selectOption(id) {
    selectedOption = ev.printOptions.find((o) => o.id === id);
    $$('#print-options .option-card').forEach((c) => c.classList.toggle('selected', c.dataset.opt === id));
  }

  function renderMain(data) {
    ev = data.event;
    renderEvent();
    $('#remaining').textContent = data.remaining;
    const ended = ev.ended;
    $('#ended-card').classList.toggle('hidden', !ended);
    $('#quota-card').classList.toggle('hidden', ended);
    $('#choose-card').classList.toggle('hidden', ended || data.remaining <= 0);
    if (!ended && data.remaining <= 0) toast('ניצלתם את כל התמונות להדפסה 🙏 אפשר להזמין עוד מהחנות');
    const statusName = { pending: 'ממתין להדפסה', printing: 'בהדפסה', printed: 'הודפס ✓', delivered: 'נמסר ✓', rejected: 'נדחה' };
    $('#gallery').innerHTML = data.photos.map((p) => `
      <div class="photo-tile">${p.kind === 'animation'
        ? `<video src="${esc(asset(p.url))}" muted loop playsinline autoplay></video><span class="badge primary">🎬 אנימציה</span>`
        : `<img src="${esc(asset(p.url))}" alt="" loading="lazy"><span class="badge ${p.printStatus === 'printed' || p.printStatus === 'delivered' ? 'ok' : ''}">${statusName[p.printStatus] || ''}</span>
          <a class="order-photo top" href="./?photo=${encodeURIComponent(p.url)}#store" aria-label="להזמין מוצר מהתמונה">${icon('cart')}עוד עותק</a>`}
      </div>`).join('');
    $('#gallery-empty').classList.toggle('hidden', data.photos.length > 0);
    myEvents.save({ code: ev.code, name: ev.name, date: ev.date, guestId: me.guestId, guestToken: me.guestToken, guestName: data.guest?.name });
    show('main');
  }

  async function refresh() {
    try {
      renderMain(await api(`/api/event/${code}/me`, { headers: headers() }));
    } catch (e) {
      if (e.status === 401) { store.set(`guest:${code}`, null); me = null; show('register'); } else fail(e.message);
    }
  }

  function openEditor(file) {
    if (!selectedOption) { toast('בחרו קודם סוג הדפסה'); return; }
    const root = $('#view-editor');
    show('editor');
    editor = new PhotoEditor(root, {
      file,
      aspect: PhotoEditor.aspectFromSize(selectedOption.size),
      allowAnimations: ev.allowAnimations,
      onCancel: () => show('main'),
      onPrint: (blob, edits) => {
        pendingBlob = blob;
        pendingEdits = edits;
        const img = $('#confirm-img');
        if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
        img.dataset.url = URL.createObjectURL(blob);
        img.src = img.dataset.url;
        $('#confirm-opt').textContent = selectedOption.label;
        show('confirm');
      },
      onAnimation: async (blob) => {
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        // הורדה למכשיר
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${ev.name}-אנימציה.${ext}`;
        a.click();
        // שמירה גם בגלריה האישית
        const fd = new FormData();
        fd.append('kind', 'animation');
        fd.append('file', blob, `anim.${ext}`);
        try {
          await api(`/api/event/${code}/photos`, { method: 'POST', body: fd, headers: headers() });
          toast('הסרטון נשמר בגלריה שלכם 🎬');
        } catch (e) { toast(e.message); }
      },
    });
  }

  async function send() {
    const btn = $('#confirm-send');
    btn.disabled = true;
    btn.textContent = 'שולח…';
    const fd = new FormData();
    fd.append('kind', 'print');
    fd.append('printOptionId', selectedOption.id);
    fd.append('edits', pendingEdits);
    fd.append('file', pendingBlob, 'photo.jpg');
    try {
      await api(`/api/event/${code}/photos`, { method: 'POST', body: fd, headers: headers() });
      toast('התמונה נשלחה להדפסה! 🎉');
      await refresh();
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'שליחה להדפסה 🖨️';
    }
  }

  // ---------- אירועים ----------
  $('#print-options').addEventListener('click', (e) => {
    const c = e.target.closest('[data-opt]');
    if (c) selectOption(c.dataset.opt);
  });
  $('#print-options').addEventListener('keydown', (e) => {
    const c = e.target.closest('[data-opt]');
    if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectOption(c.dataset.opt); }
  });
  ['#file-camera', '#file-gallery'].forEach((sel) => $(sel).addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) openEditor(f);
  }));
  $('#confirm-back').onclick = () => show('editor');
  $('#confirm-send').onclick = send;

  $('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await api(`/api/event/${code}/guest`, {
        method: 'POST',
        body: { name: $('#g-name').value, phone: $('#g-phone').value, marketingConsent: $('#g-consent').checked },
      });
      me = { guestId: r.guestId, guestToken: r.guestToken };
      store.set(`guest:${code}`, me);
      await refresh();
      offerInstall({ auto: true }); // מיד אחרי הסריקה וההרשמה: חלון התקנת האפליקציה נפתח לבד (פעם אחת)
    } catch (err) { toast(err.message); }
  });

  // ---------- התחלה ----------
  (async () => {
    try {
      ev = await api(`/api/event/${code}`);
    } catch (e) {
      fail(e.status === 404 ? 'האירוע לא נמצא. בדקו שסרקתם את ה-QR הנכון.' : e.message);
      return;
    }
    renderEvent();
    me = store.get(`guest:${code}`, null);
    if (me) await refresh();
    else if (ev.ended) { $('#error-msg').textContent = 'האירוע הסתיים. מוזמנים לחנות שלנו!'; show('error'); } else show('register');
    setTimeout(() => offerInstall(), 2500);
  })();
}());
