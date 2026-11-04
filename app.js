/* ============================================================
   CEKLIST PENDAMPINGAN GURU — SMP ABBS Surakarta
   Aplikasi petugas OSIS + rekap admin.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- state ---------------- */

  var S = {
    token: null,
    petugas: null,
    tanggal: todayISO(),
    entries: {},
    kelompok: null,
    kegiatan: null,
    hadir: [],             // guru yang datang tepat waktu (on time)
    terlambat: [],         // guru yang datang terlambat
    siswa: [],             // siswa tidak tertib: {nama, kelas, jenis:[label]}
    sheet: null,           // state pemilih siswa (overlay)
    catatan: '',
    cari: '',
    cariRaw: '',
    dirty: false,
    loading: false,
    mode: 'login'          // login | home | kegiatan | checklist | admin
  };

  var LS_TOKEN = 'ceklist.token';
  var LS_PETUGAS = 'ceklist.petugas';
  var LS_ADMINKEY = 'ceklist.adminKey';

  /* ---------------- util ---------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
               'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  function tglPanjang(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
  }

  function tglPendek(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3) + ' ' + p[0];
  }

  function toast(msg, isErr) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = ''; }, 3200);
  }

  function kegiatanMeta(id) {
    for (var i = 0; i < CONFIG.KEGIATAN.length; i++) {
      if (CONFIG.KEGIATAN[i].id === id) return CONFIG.KEGIATAN[i];
    }
    return { id: id, label: id, ikon: 'dot', jam: '' };
  }

  /* Ikon SVG inline — tampil sama di semua perangkat (emoji tidak konsisten). */
  var IKON = {
    upacara: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V4"/><path d="M6 5h11l-2.5 3.5L17 12H6"/>' +
      '<path d="M3 21h8"/></svg>',
    duha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/>' +
      '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    duhur: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V11a8 8 0 0 1 16 0v10"/>' +
      '<path d="M2 21h20"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/><path d="M12 3v2"/></svg>',
    ashar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18"/><path d="M6 18a6 6 0 0 1 12 0"/>' +
      '<path d="M12 4v3M4.5 8.5l2 2M19.5 8.5l-2 2M2 14h2M20 14h2"/></svg>',
    putra: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="14" r="5"/>' +
      '<path d="M14 10l6-6"/><path d="M15 4h5v5"/></svg>',
    putri: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/>' +
      '<path d="M12 14v7"/><path d="M9 18h6"/></svg>',
    dot: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>',
    power: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9"/><path d="M7.5 6.3a7.5 7.5 0 1 0 9 0"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/>' +
      '<path d="M20 4v5h-5"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/>' +
      '<path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/>' +
      '<path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5.5 5.5L20 6"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/>' +
      '<path d="M12 7.5V12l3.2 2"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/>' +
      '<path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 5.2a3.2 3.2 0 0 1 0 6"/>' +
      '<path d="M18.5 20a6.4 6.4 0 0 0-2.2-4.8"/></svg>'
  };

  function ikonSvg(name) {
    return '<span class="svg">' + (IKON[name] || IKON.dot) + '</span>';
  }

  function guruByGender(g) {
    return GURU.filter(function (x) { return x.g === g; });
  }

  /* ---------------- status kehadiran ----------------
   * Satu ketukan berputar: tidak hadir -> on time -> terlambat -> tidak hadir.
   *   'hadir'     datang tepat waktu
   *   'terlambat' datang setelah kegiatan dimulai
   *   ''          tidak hadir (default, tidak perlu dicatat)
   */
  var SIKLUS = ['', 'hadir', 'terlambat'];

  function statusOf(nick) {
    if (S.hadir.indexOf(nick) !== -1) return 'hadir';
    if (S.terlambat.indexOf(nick) !== -1) return 'terlambat';
    return '';
  }

  function setStatus(nick, st) {
    var i = S.hadir.indexOf(nick);
    if (i !== -1) S.hadir.splice(i, 1);
    var j = S.terlambat.indexOf(nick);
    if (j !== -1) S.terlambat.splice(j, 1);
    if (st === 'hadir') S.hadir.push(nick);
    if (st === 'terlambat') S.terlambat.push(nick);
  }

  function nextStatus(cur) {
    return SIKLUS[(SIKLUS.indexOf(cur) + 1) % SIKLUS.length];
  }

  /** Pecah satu entri server menjadi tiga daftar nama. */
  function pecahEntri(e) {
    var hadir = ((e && e.hadir) || '').split('|').filter(Boolean);
    var late = ((e && e.terlambat) || '').split('|').filter(Boolean);
    return { hadir: hadir, terlambat: late };
  }

  /* ---------------- auth ---------------- */

  function saveSession(token, petugas) {
    S.token = token;
    S.petugas = petugas;
    try {
      localStorage.setItem(LS_TOKEN, token);
      localStorage.setItem(LS_PETUGAS, JSON.stringify(petugas));
    } catch (e) {}
  }

  function clearSession() {
    S.token = null;
    S.petugas = null;
    try {
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_PETUGAS);
    } catch (e) {}
  }

  function restoreSession() {
    try {
      var t = localStorage.getItem(LS_TOKEN);
      var p = localStorage.getItem(LS_PETUGAS);
      if (t && p) {
        S.token = t;
        S.petugas = JSON.parse(p);
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ---------------- boot ---------------- */

  var booted = false;

  function boot() {
    if (booted) return;
    booted = true;

    window.addEventListener('hashchange', route);

    if (!CONFIG.API_URL) {
      renderSetup();
      return;
    }

    if (isAdminHash()) {
      S.mode = 'admin';
      initAdmin();
      return;
    }

    if (restoreSession()) {
      masukKelompok();
      render();
      loadDay(true);
    } else {
      S.mode = 'login';
      render();
    }
  }

  /**
   * PIN menentukan kelompok: petugas putra mengisi data putra, petugas putri
   * mengisi data putri. Jadi tidak ada langkah "pilih kelompok" lagi.
   */
  function masukKelompok() {
    var g = S.petugas && S.petugas.gender;
    if (g === 'putra' || g === 'putri') {
      S.kelompok = g;
      S.mode = 'kegiatan';
      return true;
    }
    S.mode = 'home';
    return false;
  }

  function isAdminHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    return CONFIG.ADMIN_PATH && h === CONFIG.ADMIN_PATH;
  }

  function route() {
    if (isAdminHash()) {
      if (S.mode !== 'admin') {
        S.mode = 'admin';
        initAdmin();
      }
      return;
    }
    if (S.mode === 'admin') {
      S.mode = S.token ? (S.kelompok ? 'kegiatan' : 'home') : 'login';
      render();
    }
  }

  /* ---------------- render dispatcher ---------------- */

  function render() {
    var app = $('#app');
    if (S.mode === 'login') app.innerHTML = viewLogin();
    else if (S.mode === 'home') app.innerHTML = viewHome();
    else if (S.mode === 'kegiatan') app.innerHTML = viewKegiatan();
    else if (S.mode === 'checklist') app.innerHTML = viewChecklist();
    else if (S.mode === 'admin') app.innerHTML = viewAdmin();
    bind();
    if (S.mode === 'checklist') {
      if (S.cari) filterRows();
      tandaiDirty();
    }
  }

  /* ---------------- view: setup ---------------- */

  function renderSetup() {
    $('#app').innerHTML =
      '<div class="login-wrap">' +
        '<div class="brandmark">' +
          '<div class="logo">' + ikonSvg('check') + '</div>' +
          '<h1>Ceklist Pendampingan Guru</h1>' +
          '<p>' + esc(CONFIG.NAMA_SEKOLAH) + '</p>' +
        '</div>' +
        '<div class="setup">' +
          '<strong>Aplikasi belum tersambung.</strong><br>' +
          'Isi <code>API_URL</code> di <code>config.js</code> dengan URL Web App ' +
          'Google Apps Script (akhiran <code>/exec</code>). Panduan lengkap ada di ' +
          '<code>README.md</code>.' +
        '</div>' +
      '</div>';
  }

  /* ---------------- view: login ---------------- */

  function viewLogin() {
    return '' +
      '<div class="login-wrap">' +
        '<div class="brandmark">' +
          '<div class="logo">' + ikonSvg('check') + '</div>' +
          '<h1>Ceklist Pendampingan</h1>' +
          '<p>' + esc(CONFIG.NAMA_SEKOLAH) + '</p>' +
        '</div>' +
        '<form id="formLogin" autocomplete="off">' +
          '<div class="alert err hidden" id="loginErr"></div>' +
          '<div class="field">' +
            '<label for="pin">PIN Petugas</label>' +
            '<input class="input pin-input" id="pin" type="tel" inputmode="numeric" ' +
              'maxlength="8" placeholder="••••••" autocomplete="off">' +
          '</div>' +
          '<button class="btn" type="submit" id="btnLogin">Masuk</button>' +
        '</form>' +
        '<p class="small-note" style="text-align:center;padding:16px 0 0">' +
          'Masukkan PIN yang diberikan admin. Hubungi admin bila lupa PIN.' +
        '</p>' +
      '</div>';
  }

  /* ---------------- view: home ---------------- */

  function viewHome() {
    var p = S.petugas || {};
    var terisi = Object.keys(S.entries).length;
    var total = CONFIG.KEGIATAN.length * 2;

    return '' +
      '<div class="topbar">' +
        '<div class="titles">' +
          '<h1>' + esc(p.nama || 'Petugas') + '</h1>' +
          '<div class="sub">' + esc(tglPanjang(S.tanggal)) + '</div>' +
        '</div>' +
        '<button class="icon-btn" id="btnKeluar" title="Keluar">' + ikonSvg('power') + '</button>' +
      '</div>' +
      '<div class="hero">' +
        '<div class="eyebrow">Pendampingan hari ini</div>' +
        '<h2>Pilih kelompok pendampingan</h2>' +
        '<p>' + terisi + ' dari ' + total + ' sesi sudah dicatat. ' +
          'Data hanya bisa diubah pada hari ini.</p>' +
      '</div>' +
      '<div class="choice-grid">' +
        choiceCard('putra', 'putra', 'Putra', 'Siswa putra — ' + guruByGender('putra').length + ' guru') +
        choiceCard('putri', 'putri', 'Putri', 'Siswa putri — ' + guruByGender('putri').length + ' guru') +
      '</div>' +
      '<p class="small-note">' +
        'Pilih kelompok, lalu pilih kegiatan (Upacara, Duha, Duhur, Ashar), ' +
        'centang guru yang hadir mendampingi, dan beri catatan bila perlu.' +
      '</p>';
  }

  function choiceCard(id, ikon, title, sub) {
    return '' +
      '<button class="choice ' + id + '" data-kelompok="' + id + '">' +
        '<span class="glyph">' + ikonSvg(ikon) + '</span>' +
        '<span class="txt"><strong>' + esc(title) + '</strong><span>' + esc(sub) + '</span></span>' +
        '<span class="chev">›</span>' +
      '</button>';
  }

  /* ---------------- view: kegiatan ---------------- */

  function viewKegiatan() {
    var p = S.petugas || {};
    var kelompok = S.kelompok;
    var isPutra = kelompok === 'putra';

    var list = CONFIG.KEGIATAN.map(function (k) {
      var e = S.entries[kelompok + '|' + k.id];
      var status;
      if (!e) {
        status = '<span class="status empty">Belum</span>';
      } else {
        var h = (e.hadir || []).length;
        var l = (e.terlambat || []).length;
        var ket = h + ' on time' + (l ? ', ' + l + ' telat' : '');
        status = (h + l) === 0
          ? '<span class="status partial">0 hadir</span>'
          : '<span class="status done">' + ket + '</span>';
      }
      return '' +
        '<button class="keg" data-kegiatan="' + k.id + '">' +
          '<span class="glyph">' + ikonSvg(k.id) + '</span>' +
          '<span class="txt"><strong>' + esc(k.label) + '</strong>' +
            '<span>' + esc(k.jam) + (e && e.petugas ? ' • diisi ' + esc(e.petugas) : '') + '</span>' +
          '</span>' +
          status +
        '</button>';
    }).join('');

    return '' +
      '<div class="topbar">' +
        '<div class="titles">' +
          '<h1>Pendampingan ' + (isPutra ? 'Putra' : 'Putri') + '</h1>' +
          '<div class="sub">' + esc((p.nama || 'Petugas') + ' • ' + tglPanjang(S.tanggal)) + '</div>' +
        '</div>' +
        '<button class="icon-btn" id="btnKeluar" title="Keluar">' + ikonSvg('power') + '</button>' +
      '</div>' +
      '<div class="hero">' +
        '<div class="eyebrow">Pilih kegiatan</div>' +
        '<h2>Kelompok ' + (isPutra ? 'Putra' : 'Putri') + '</h2>' +
        '<p>PIN Anda untuk kelompok ini. Ketuk kegiatan untuk mengisi kehadiran guru ' +
          'dan mencatat siswa yang tidak tertib.</p>' +
      '</div>' +
      '<div class="keg-list">' + list + '</div>';
  }

  /* ---------------- view: checklist ---------------- */

  function viewChecklist() {
    var k = kegiatanMeta(S.kegiatan);
    var set = {};
    S.hadir.forEach(function (n) { set[n] = 'hadir'; });
    S.terlambat.forEach(function (n) { set[n] = 'terlambat'; });

    var totalHadir = S.hadir.length;
    var totalLate = S.terlambat.length;
    var totalGuru = guruByGender(S.kelompok).length;
    var totalAbsen = totalGuru - totalHadir - totalLate;

    return '' +
      '<div class="topbar">' +
        '<button class="icon-btn" id="btnBack">' + ikonSvg('back') + '</button>' +
        '<div class="titles">' +
          '<h1>' + esc(k.label) + ' — ' + (S.kelompok === 'putra' ? 'Putra' : 'Putri') + '</h1>' +
          '<div class="sub">' + esc(tglPanjang(S.tanggal)) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="sticky-summary">' +
        '<span class="counter on"><b id="cntHadir">' + totalHadir + '</b> on time</span>' +
        '<span class="counter late"><b id="cntLate">' + totalLate + '</b> terlambat</span>' +
        '<span class="counter off"><b id="cntAbsen">' + totalAbsen + '</b> tidak hadir</span>' +
      '</div>' +

      '<div class="toolbar">' +
        '<button class="btn ghost small" id="btnSemua">' + ikonSvg('check') + ' On time semua</button>' +
        '<button class="btn ghost small" id="btnKosong">Kosongkan</button>' +
      '</div>' +

      '<p class="cycle-hint">Ketuk nama guru: sekali <b class="on">on time</b>, ' +
        'dua kali <b class="late">terlambat</b>, tiga kali <b>tidak hadir</b>.</p>' +

      '<div class="search-wrap">' +
        '<span class="ic">' + ikonSvg('search') + '</span>' +
        '<input id="cariGuru" type="search" placeholder="Cari nama guru…" autocomplete="off" value="' + esc(S.cariRaw) + '">' +
      '</div>' +

      groupBlock(S.kelompok, '1 · Kehadiran guru ' + (S.kelompok === 'putra' ? 'putra' : 'putri'),
        guruByGender(S.kelompok), set) +

      '<div class="empty-state hidden" id="noMatch"><div class="big">' + ikonSvg('calendar') + '</div>' +
        'Tidak ada guru yang cocok dengan pencarian.</div>' +

      siswaBlock() +

      '<div class="note-block">' +
        '<label for="catatan">Catatan pendampingan</label>' +
        '<textarea id="catatan" maxlength="1000" placeholder="Mis. Ust Fahmi izin, digantikan Mr Amar. Kegiatan berjalan tertib.">' +
          esc(S.catatan) + '</textarea>' +
        '<div class="note-meta"><span id="noteLen">' + S.catatan.length + '</span> / 1000 karakter</div>' +
      '</div>' +

      '<div class="actionbar"><div class="inner">' +
        '<span class="dirty hidden" id="dirty">● Belum disimpan</span>' +
        '<button class="btn" id="btnSimpan">Simpan Ceklist</button>' +
      '</div></div>';
  }

  function groupBlock(gender, title, list, set) {
    var rows = list.map(function (g) {
      var st = set[g.n] || '';
      var cls = st === 'hadir' ? ' on' : st === 'terlambat' ? ' late' : '';
      var ic = st === 'terlambat' ? ikonSvg('clock') : ikonSvg('check');
      var tag = st === 'hadir' ? '<span class="tag on">On time</span>'
              : st === 'terlambat' ? '<span class="tag late">Terlambat</span>' : '';
      return '' +
        '<div class="row' + cls + '" data-guru="' + esc(g.n) + '" data-status="' + st + '" ' +
             'data-cari="' + esc((g.n + ' ' + g.nama).toLowerCase()) + '">' +
          '<span class="check">' + ic + '</span>' +
          '<span class="who">' +
            '<strong>' + esc(g.n) + '</strong>' +
            '<span>' + esc(g.nama) + '</span>' +
          '</span>' +
          tag +
        '</div>';
    }).join('');

    return '' +
      '<div class="group-head ' + gender + '" id="head-' + gender + '">' +
        '<span class="dot"></span>' + esc(title) +
        '<span class="n">' + list.length + ' guru</span>' +
      '</div>' +
      '<div class="guru-list" id="list-' + gender + '">' + rows + '</div>';
  }

  /**
   * Filter baris guru tanpa render ulang, supaya fokus & posisi kursor
   * di kolom pencarian tidak hilang saat mengetik.
   */
  function filterRows() {
    var q = (S.cari || '').trim();
    var tampil = 0;

    ['putra', 'putri'].forEach(function (gender) {
      var list = $('#list-' + gender);
      var head = $('#head-' + gender);
      if (!list || !head) return;

      var n = 0;
      $$('.row', list).forEach(function (row) {
        var cocok = !q || row.getAttribute('data-cari').indexOf(q) !== -1;
        row.classList.toggle('hidden', !cocok);
        if (cocok) n++;
      });

      list.classList.toggle('hidden', n === 0);
      head.classList.toggle('hidden', n === 0);
      var badge = head.querySelector('.n');
      if (badge) badge.textContent = n + ' guru';
      tampil += n;
    });

    var empty = $('#noMatch');
    if (empty) empty.classList.toggle('hidden', tampil > 0);
  }

  /* ---------------- siswa tidak tertib ---------------- */

  var JENIS_TIDAK_TERTIB = [
    { id: 'dzikir',  label: 'Tidak berdzikir' },
    { id: 'ngobrol', label: 'Mengobrol / ramai' },
    { id: 'hp',      label: 'Bermain HP' },
    { id: 'telat',   label: 'Datang terlambat' },
    { id: 'wudhu',   label: 'Tidak wudhu' },
    { id: 'shaf',    label: 'Tidak merapatkan shaf' },
    { id: 'lain',    label: 'Lainnya' }
  ];

  /** Kelas putra = A/B/C, kelas putri = D/E/F. */
  function genderKelas(k) { return /[ABC]$/.test(k) ? 'putra' : 'putri'; }

  function kelasUntuk(g) {
    return KELAS.filter(function (k) { return genderKelas(k) === g; });
  }

  function jenisLabel(id) {
    for (var i = 0; i < JENIS_TIDAK_TERTIB.length; i++) {
      if (JENIS_TIDAK_TERTIB[i].id === id) return JENIS_TIDAK_TERTIB[i].label;
    }
    return id;
  }

  function initials(nm) {
    var w = String(nm || '').trim().split(/\s+/);
    return ((w[0] || '')[0] + (w[1] || '')[0] || '').toUpperCase();
  }

  function siswaBlock() {
    var isi = S.siswa.length
      ? '<div class="temuan-list">' + S.siswa.map(function (t, i) {
          return '<div class="temuan">' +
            '<span class="temuan-av">' + esc(initials(t.nama)) + '</span>' +
            '<span class="temuan-txt">' +
              '<span class="temuan-nama">' + esc(t.nama) +
                ' <span class="temuan-kelas">· ' + esc(t.kelas) + '</span></span>' +
              '<span class="temuan-jenis">' + t.jenis.map(function (j) {
                return '<span class="jenis-pil">' + esc(j) + '</span>';
              }).join('') + '</span>' +
            '</span>' +
            '<button class="temuan-hapus" data-hapus-siswa="' + i + '" title="Hapus">' +
              ikonSvg('x') + '</button>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="kosong-kotak">Belum ada siswa yang dicatat.<br>' +
        'Tekan <b>+ Catat siswa</b> bila ada yang tidak tertib. Bila semua tertib, biarkan kosong.</div>';

    return '' +
      '<div class="siswa-sec">' +
        '<div class="siswa-head">' +
          '<h3>2 · Siswa tidak tertib</h3>' +
          '<span class="hitung"><b id="cntSiswa">' + S.siswa.length + '</b> siswa</span>' +
        '</div>' +
        '<p class="sec-desc">Catat siswa yang tidak tertib selama kegiatan. Tidak perlu mencatat semua siswa.</p>' +
        isi +
        '<button class="btn tambah-siswa" id="btnCatatSiswa">' + ikonSvg('plus') + ' Catat siswa</button>' +
      '</div>';
  }

  /* ---------------- sheet: pilih siswa ---------------- */

  function bukaSheetSiswa() {
    S.sheet = { kelas: '', cari: '', sid: null, jenis: [], lainTeks: '' };
    renderSheetSiswa();
  }

  function tutupSheetSiswa() {
    S.sheet = null;
    var bg = $('#sheetBg'); if (bg) bg.parentNode.removeChild(bg);
    var ly = $('#sheetLayer'); if (ly) ly.parentNode.removeChild(ly);
  }

  function renderSheetSiswa() {
    tutupLayerSaja();

    var bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.id = 'sheetBg';
    bg.addEventListener('click', tutupSheetSiswa);
    document.body.appendChild(bg);

    var ly = document.createElement('div');
    ly.className = 'sheet';
    ly.id = 'sheetLayer';
    ly.innerHTML = sheetIsi();
    document.body.appendChild(ly);
    wireSheetSiswa();
  }

  function tutupLayerSaja() {
    var bg = $('#sheetBg'); if (bg) bg.parentNode.removeChild(bg);
    var ly = $('#sheetLayer'); if (ly) ly.parentNode.removeChild(ly);
  }

  function sheetIsi() {
    var sh = S.sheet;

    // tahap 2: pilih jenis
    if (sh.sid) {
      var siswa = SISWA.filter(function (x) { return x.i === sh.sid; })[0];
      var daftar = JENIS_TIDAK_TERTIB.map(function (j) {
        var on = sh.jenis.indexOf(j.id) !== -1;
        return '<button class="jenis-item' + (on ? ' on' : '') + '" data-jenis="' + j.id + '">' +
          '<span class="jenis-kotak">' + ikonSvg('check') + '</span>' + esc(j.label) +
        '</button>';
      }).join('');

      var inputLain = sh.jenis.indexOf('lain') !== -1
        ? '<input class="jenis-lain-input" id="lainTeks" placeholder="Tulis bentuk tidak tertibnya…" ' +
          'value="' + esc(sh.lainTeks) + '">'
        : '';

      return '' +
        '<div class="sheet-dalam">' +
          '<div class="sheet-grip"></div>' +
          '<div class="sheet-head">' +
            '<div><h3>Apa yang terjadi?</h3><div class="sub">Boleh pilih lebih dari satu</div></div>' +
            '<button class="sheet-tutup" data-sheet-aksi="tutup">' + ikonSvg('x') + '</button>' +
          '</div>' +
          '<div class="sheet-body">' +
            '<div class="siswa-terpilih">' +
              '<span class="hasil-av">' + esc(initials(siswa.n)) + '</span>' +
              '<span><b>' + esc(siswa.n) + '</b><span>Kelas ' + esc(siswa.k) + '</span></span>' +
            '</div>' +
            '<div class="jenis-list">' + daftar + '</div>' +
            inputLain +
            '<div style="height:12px"></div>' +
          '</div>' +
          '<div class="sheet-foot">' +
            '<button class="tombol" data-sheet-aksi="tambahkan">Tambahkan ke catatan</button>' +
          '</div>' +
        '</div>';
    }

    // tahap 1: cari siswa
    var q = sh.cari.trim().toLowerCase();
    var semua = SISWA.filter(function (x) {
      if (genderKelas(x.k) !== S.kelompok) return false;
      if (sh.kelas && x.k !== sh.kelas) return false;
      if (q && x.n.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var list = semua.slice(0, 60);

    var sudah = {};
    S.siswa.forEach(function (t) { sudah[t.nama] = true; });

    var hasil = list.length
      ? '<div class="hasil-list">' + list.map(function (x) {
          return '<button class="hasil" data-pilih="' + x.i + '">' +
            '<span class="hasil-av">' + esc(initials(x.n)) + '</span>' +
            '<span class="hasil-txt">' +
              '<span class="hasil-nama">' + esc(x.n) + '</span>' +
              '<span class="hasil-meta">Kelas ' + esc(x.k) + '</span>' +
            '</span>' +
            (sudah[x.n] ? '<span class="badge-riwayat">sudah</span>' : '') +
          '</button>';
        }).join('') + '</div>' +
        (semua.length > list.length
          ? '<div class="kosong-teks" style="padding:10px 0 14px">Menampilkan ' + list.length +
            ' dari ' + semua.length + ' siswa — ketik nama untuk mempersempit.</div>'
          : '')
      : '<div class="kosong-teks">Tidak ada siswa yang cocok.</div>';

    var filterKelas = '<div class="kelas-filter">' +
      '<button class="kf' + (!sh.kelas ? ' on' : '') + '" data-kelas="">Semua</button>' +
      kelasUntuk(S.kelompok).map(function (k) {
        return '<button class="kf' + (sh.kelas === k ? ' on' : '') + '" data-kelas="' + k + '">' + k + '</button>';
      }).join('') + '</div>';

    return '' +
      '<div class="sheet-dalam">' +
        '<div class="sheet-grip"></div>' +
        '<div class="sheet-head">' +
          '<div><h3>Pilih siswa</h3><div class="sub">Cari nama, atau pilih kelas dulu</div></div>' +
          '<button class="sheet-tutup" data-sheet-aksi="tutup">' + ikonSvg('x') + '</button>' +
        '</div>' +
        '<div class="sheet-body">' +
          '<div class="search-wrap" style="margin:0 0 10px">' +
            '<span class="ic">' + ikonSvg('search') + '</span>' +
            '<input id="cariSiswa" type="search" placeholder="Ketik nama siswa…" autocomplete="off" value="' + esc(sh.cari) + '">' +
          '</div>' +
          filterKelas +
          hasil +
        '</div>' +
      '</div>';
  }

  function wireSheetSiswa() {
    var ly = $('#sheetLayer');
    if (!ly) return;

    $$('[data-sheet-aksi="tutup"]', ly).forEach(function (b) {
      b.addEventListener('click', tutupSheetSiswa);
    });

    $$('[data-kelas]', ly).forEach(function (b) {
      b.addEventListener('click', function () {
        S.sheet.kelas = b.getAttribute('data-kelas');
        renderSheetSiswa();
      });
    });

    $$('[data-pilih]', ly).forEach(function (b) {
      b.addEventListener('click', function () {
        S.sheet.sid = b.getAttribute('data-pilih');
        S.sheet.jenis = [];
        S.sheet.lainTeks = '';
        renderSheetSiswa();
      });
    });

    $$('[data-jenis]', ly).forEach(function (b) {
      b.addEventListener('click', function () {
        var j = b.getAttribute('data-jenis');
        var i = S.sheet.jenis.indexOf(j);
        if (i === -1) S.sheet.jenis.push(j);
        else S.sheet.jenis.splice(i, 1);
        renderSheetSiswa();
      });
    });

    var lain = $('#lainTeks', ly);
    if (lain) lain.addEventListener('input', function () { S.sheet.lainTeks = lain.value; });

    var tambah = $('[data-sheet-aksi="tambahkan"]', ly);
    if (tambah) tambah.addEventListener('click', tambahSiswa);

    var cari = $('#cariSiswa', ly);
    if (cari) {
      cari.addEventListener('input', function () {
        S.sheet.cari = cari.value;
        var pos = cari.selectionStart;
        renderSheetSiswa();
        var lagi = $('#cariSiswa');
        if (lagi) { lagi.focus(); lagi.setSelectionRange(pos, pos); }
      });
    }
  }

  function tambahSiswa() {
    var sh = S.sheet;
    if (!sh.jenis.length) { toast('Pilih dulu jenis tidak tertibnya.', true); return; }

    if (sh.jenis.indexOf('lain') !== -1 && !sh.lainTeks.trim()) {
      toast('Tulis bentuk tidak tertibnya dulu.', true);
      return;
    }

    var siswa = SISWA.filter(function (x) { return x.i === sh.sid; })[0];
    if (!siswa) return;

    var jenis = sh.jenis.map(function (id) {
      return id === 'lain' ? sh.lainTeks.trim() : jenisLabel(id);
    });

    var ada = null;
    for (var i = 0; i < S.siswa.length; i++) {
      if (S.siswa[i].nama === siswa.n) { ada = S.siswa[i]; break; }
    }

    if (ada) {
      jenis.forEach(function (j) {
        if (ada.jenis.indexOf(j) === -1) ada.jenis.push(j);
      });
      toast(siswa.n.split(' ')[0] + ' diperbarui.');
    } else {
      S.siswa.push({ nama: siswa.n, kelas: siswa.k, jenis: jenis });
      toast(siswa.n.split(' ')[0] + ' ditambahkan.');
    }

    S.dirty = true;
    tutupSheetSiswa();
    render();
  }

  /* ---------------- data load / save ---------------- */

  function loadDay(silent) {
    if (!S.token) return;
    API.day(S.token, S.tanggal).then(function (res) {
      S.entries = res.entries || {};
      S.tanggal = res.tanggal || todayISO();
      S.loading = false;
      if (S.mode === 'home' || S.mode === 'kegiatan') render();
    }).catch(function (err) {
      if (/sesi|login|petugas tidak/i.test(err.message)) {
        clearSession();
        S.mode = 'login';
        render();
        toast(err.message, true);
      } else if (!silent) {
        toast(err.message, true);
      }
    });
  }

  function openChecklist(kegiatan) {
    var key = S.kelompok + '|' + kegiatan;
    var e = S.entries[key];
    S.kegiatan = kegiatan;
    S.hadir = e && e.hadir ? e.hadir.slice() : [];
    S.terlambat = e && e.terlambat ? e.terlambat.slice() : [];
    S.siswa = e && e.siswa ? e.siswa.map(function (t) {
      return { nama: t.nama, kelas: t.kelas, jenis: String(t.jenis || '').split(' · ').filter(Boolean) };
    }) : [];
    S.catatan = e ? (e.catatan || '') : '';
    S.cari = '';
    S.cariRaw = '';
    S.dirty = false;
    S.mode = 'checklist';
    render();
    window.scrollTo(0, 0);
  }

  function simpan() {
    var btn = $('#btnSimpan');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan…'; }

    var payload = {
      tanggal: S.tanggal,
      kelompok: S.kelompok,
      kegiatan: S.kegiatan,
      hadir: S.hadir,
      terlambat: S.terlambat,
      siswa: S.siswa.map(function (t) {
        return { nama: t.nama, kelas: t.kelas, jenis: t.jenis.join(' · ') };
      }),
      catatan: S.catatan
    };

    API.save(S.token, payload).then(function () {
      var key = S.kelompok + '|' + S.kegiatan;
      S.entries[key] = {
        hadir: S.hadir.slice(),
        terlambat: S.terlambat.slice(),
        siswa: S.siswa.map(function (t) {
          return { nama: t.nama, kelas: t.kelas, jenis: t.jenis.join(' · ') };
        }),
        catatan: S.catatan,
        petugas: (S.petugas && S.petugas.nama) || '',
        updatedAt: ''
      };
      S.dirty = false;
      toast('Ceklist ' + kegiatanMeta(S.kegiatan).label + ' tersimpan.');
      S.mode = 'kegiatan';
      render();
      window.scrollTo(0, 0);
    }).catch(function (err) {
      toast(err.message, true);
      if (btn) { btn.disabled = false; btn.textContent = 'Simpan Ceklist'; }
      if (/sesi|login/i.test(err.message)) {
        clearSession();
        S.mode = 'login';
        render();
      }
    });
  }

  /* ---------------- events ---------------- */

  function bind() {
    var app = $('#app');

    // login
    var formLogin = $('#formLogin');
    if (formLogin) {
      var pin = $('#pin');
      if (pin) setTimeout(function () { pin.focus(); }, 120);
      formLogin.addEventListener('submit', function (ev) {
        ev.preventDefault();
        doLogin(pin.value);
      });
    }

    // keluar
    var keluar = $('#btnKeluar');
    if (keluar) {
      keluar.addEventListener('click', function () {
        if (!confirm('Keluar dari aplikasi?')) return;
        clearSession();
        S.entries = {};
        S.mode = 'login';
        render();
      });
    }

    // back
    var back = $('#btnBack');
    if (back) {
      back.addEventListener('click', function () {
        if (S.mode === 'checklist' && S.dirty) {
          if (!confirm('Perubahan belum disimpan. Tinggalkan halaman ini?')) return;
          S.dirty = false;
        }
        window.scrollTo(0, 0);
        if (S.mode === 'checklist') { S.mode = 'kegiatan'; render(); }
        else { S.mode = 'home'; render(); }
      });
    }

    // pilih kelompok
    $$('[data-kelompok]', app).forEach(function (b) {
      b.addEventListener('click', function () {
        S.kelompok = b.getAttribute('data-kelompok');
        S.mode = 'kegiatan';
        render();
        window.scrollTo(0, 0);
      });
    });

    // pilih kegiatan
    $$('[data-kegiatan]', app).forEach(function (b) {
      b.addEventListener('click', function () {
        openChecklist(b.getAttribute('data-kegiatan'));
      });
    });

    // checklist rows
    $$('.row[data-guru]', app).forEach(function (row) {
      row.addEventListener('click', function () {
        toggleGuru(row.getAttribute('data-guru'));
      });
    });

    // siswa tidak tertib
    var catat = $('#btnCatatSiswa');
    if (catat) catat.addEventListener('click', bukaSheetSiswa);

    $$('[data-hapus-siswa]', app).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-hapus-siswa'));
        S.siswa.splice(i, 1);
        S.dirty = true;
        render();
      });
    });

    // hadir semua / kosongkan
    var semua = $('#btnSemua');
    if (semua) {
      semua.addEventListener('click', function () {
        S.hadir = guruByGender(S.kelompok).map(function (g) { return g.n; });
        S.terlambat = [];
        S.dirty = true;
        render();
        toast('Semua guru ditandai on time. Tekan Simpan.');
      });
    }

    var kosong = $('#btnKosong');
    if (kosong) {
      kosong.addEventListener('click', function () {
        if (!S.hadir.length && !S.terlambat.length) return;
        if (!confirm('Kosongkan semua tanda kehadiran?')) return;
        S.hadir = [];
        S.terlambat = [];
        S.dirty = true;
        render();
      });
    }

    // cari guru — filter langsung di DOM supaya fokus input tidak hilang
    var cari = $('#cariGuru');
    if (cari) {
      cari.addEventListener('input', function () {
        S.cariRaw = cari.value;
        S.cari = cari.value.toLowerCase();
        filterRows();
      });
    }

    // catatan
    var cat = $('#catatan');
    if (cat) {
      cat.addEventListener('input', function () {
        S.catatan = cat.value;
        S.dirty = true;
        var len = $('#noteLen');
        if (len) len.textContent = cat.value.length;
        tandaiDirty();
      });
    }

    var simpanBtn = $('#btnSimpan');
    if (simpanBtn) simpanBtn.addEventListener('click', simpan);

    // admin
    bindAdmin();
  }

  function toggleGuru(nick) {
    var st = nextStatus(statusOf(nick));
    setStatus(nick, st);
    S.dirty = true;

    var row = $('.row[data-guru="' + cssEscape(nick) + '"]');
    if (row) {
      row.classList.toggle('on', st === 'hadir');
      row.classList.toggle('late', st === 'terlambat');
      row.setAttribute('data-status', st);

      var box = $('.check', row);
      if (box) box.innerHTML = st === 'terlambat' ? ikonSvg('clock') : ikonSvg('check');

      var tag = $('.tag', row);
      if (tag) tag.parentNode.removeChild(tag);
      if (st) {
        var el = document.createElement('span');
        el.className = 'tag ' + (st === 'hadir' ? 'on' : 'late');
        el.textContent = st === 'hadir' ? 'On time' : 'Terlambat';
        row.appendChild(el);
      }
    }

    perbaruiCounter();
    tandaiDirty();
  }

  function perbaruiCounter() {
    var a = $('#cntHadir');
    if (a) a.textContent = S.hadir.length;
    var b = $('#cntLate');
    if (b) b.textContent = S.terlambat.length;
    var c = $('#cntAbsen');
    if (c) c.textContent = guruByGender(S.kelompok).length - S.hadir.length - S.terlambat.length;
  }

  function tandaiDirty() {
    var d = $('#dirty');
    if (d) d.classList.toggle('hidden', !S.dirty);
  }

  function cssEscape(s) {
    return String(s).replace(/["\\]/g, '\\$&');
  }

  function doLogin(pin) {
    var errBox = $('#loginErr');
    var btn = $('#btnLogin');
    pin = String(pin || '').trim();

    function fail(msg) {
      if (errBox) { errBox.textContent = msg; errBox.classList.remove('hidden'); }
      if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }
      toast(msg, true);
    }

    if (!/^\d{4,8}$/.test(pin)) { fail('PIN harus 4–8 angka.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Memeriksa…'; }
    if (errBox) errBox.classList.add('hidden');

    API.login(pin).then(function (res) {
      saveSession(res.token, res.petugas);
      S.tanggal = todayISO();
      S.entries = {};
      masukKelompok();
      render();
      loadDay(true);
      toast('Selamat datang, ' + res.petugas.nama + '.');
    }).catch(function (err) {
      fail(err.message);
    });
  }

  /* ============================================================
     ADMIN
     ============================================================ */

  var A = {
    key: '',
    tab: 'guru',
    dari: '',
    sampai: '',
    entri: [],
    siswa: [],
    petugas: [],
    loaded: false,
    err: '',
    needKey: false
  };

  function viewAdmin() {
    if (A.needKey) return viewAdminKey();

    var head = '' +
      '<div class="topbar">' +
        '<div class="titles">' +
          '<h1>Rekap Pendampingan</h1>' +
          '<div class="sub">' + esc(CONFIG.NAMA_SEKOLAH) + ' • halaman admin</div>' +
        '</div>' +
        '<button class="icon-btn" id="btnAdminRefresh" title="Muat ulang">' + ikonSvg('refresh') + '</button>' +
      '</div>';
    if (A.err) {
      return head + '<div class="pad"><div class="alert err">' + esc(A.err) + '</div>' +
        '<button class="btn ghost" id="btnAdminKeyReset">Ganti kunci admin</button></div>';
    }

    if (!A.loaded) {
      return head + '<div class="loader"><span class="spin"></span> Memuat rekap…</div>';
    }

    return head +
      '<div class="admin-head">' +
        '<h2>Rekap Total</h2>' +
        '<p>Data semua hari dan semua petugas.</p>' +
      '</div>' +
      filterBar() +
      tabs() +
      (A.tab === 'guru' ? tabGuru() : A.tab === 'hari' ? tabHari()
        : A.tab === 'siswa' ? tabSiswa() : tabPetugas());
  }

  function viewAdminKey() {
    return '' +
      '<div class="login-wrap">' +
        '<div class="brandmark">' +
          '<div class="logo">' + ikonSvg('lock') + '</div>' +
          '<h1>Halaman Admin</h1>' +
          '<p>Masukkan kunci admin untuk membuka rekap.</p>' +
        '</div>' +
        '<form id="formAdminKey" autocomplete="off">' +
          '<div class="alert err hidden" id="adminKeyErr"></div>' +
          '<div class="field">' +
            '<label for="adminKey">Kunci Admin</label>' +
            '<input class="input" id="adminKey" type="password" placeholder="kunci admin">' +
          '</div>' +
          '<button class="btn" type="submit">Buka Rekap</button>' +
        '</form>' +
      '</div>';
  }

  function filterBar() {
    return '' +
      '<div class="card"><div class="card-body">' +
        '<div class="filters">' +
          '<div class="field"><label>Dari</label>' +
            '<input class="input" type="date" id="fDari" value="' + esc(A.dari) + '"></div>' +
          '<div class="field"><label>Sampai</label>' +
            '<input class="input" type="date" id="fSampai" value="' + esc(A.sampai) + '"></div>' +
        '</div>' +
        '<div class="toolbar" style="padding:10px 0 0">' +
          '<button class="btn ghost small" data-range="7">7 hari</button>' +
          '<button class="btn ghost small" data-range="30">30 hari</button>' +
          '<button class="btn ghost small" data-range="bulan">Bulan ini</button>' +
          '<button class="btn ghost small" data-range="semua">Semua</button>' +
        '</div>' +
      '</div></div>';
  }

  function tabs() {
    function t(id, label) {
      return '<button class="btn ' + (A.tab === id ? '' : 'ghost') + ' small" data-tab="' + id + '" ' +
        'style="flex:1">' + label + '</button>';
    }
    return '<div class="toolbar" style="padding-bottom:12px">' +
      t('guru', 'Per Guru') + t('siswa', 'Siswa') + t('hari', 'Per Hari') + t('petugas', 'Petugas') +
    '</div>';
  }

  function filteredEntri() {
    return A.entri.filter(function (e) {
      return e.tanggal >= A.dari && e.tanggal <= A.sampai;
    });
  }

  function tabGuru() {
    var list = filteredEntri();
    var totalSesi = list.length;
    var perGuru = {};

    GURU.forEach(function (g) {
      perGuru[g.n] = { g: g, hadir: 0, terlambat: 0, absen: 0, sesi: 0 };
    });

    list.forEach(function (e) {
      var p = pecahEntri(e);
      GURU.forEach(function (g) {
        if (g.g !== e.kelompok) return;      // guru putra hanya dinilai di sesi putra
        perGuru[g.n].sesi++;
        if (p.hadir.indexOf(g.n) !== -1) perGuru[g.n].hadir++;
        else if (p.terlambat.indexOf(g.n) !== -1) perGuru[g.n].terlambat++;
        else perGuru[g.n].absen++;
      });
    });

    var hariUnik = {};
    list.forEach(function (e) { hariUnik[e.tanggal] = true; });
    var jmlHari = Object.keys(hariUnik).length;

    var rowsAll = GURU.map(function (g) { return perGuru[g.n]; });
    var urut = rowsAll.slice().sort(function (a, b) {
      var ta = a.sesi || 1, tb = b.sesi || 1;
      if (b.sesi !== a.sesi) return b.sesi - a.sesi;
      var pa = a.hadir / ta, pb = b.hadir / tb;
      if (pb !== pa) return pb - pa;
      return (b.terlambat / tb) - (a.terlambat / ta);
    });

    var totalHadir = rowsAll.reduce(function (s, r) { return s + r.hadir; }, 0);
    var totalLate = rowsAll.reduce(function (s, r) { return s + r.terlambat; }, 0);
    var totalAbsen = rowsAll.reduce(function (s, r) { return s + r.absen; }, 0);

    var stats = '' +
      '<div class="stat-grid">' +
        stat('Sesi tercatat', totalSesi) +
        stat('Hari tercatat', jmlHari) +
        stat('On time', totalHadir) +
        stat('Terlambat', totalLate) +
        stat('Tidak hadir', totalAbsen) +
        stat('Guru terdata', GURU.length) +
      '</div>';

    if (!totalSesi) {
      return stats + '<div class="empty-state"><div class="big">' + ikonSvg('calendar') + '</div>' +
        'Belum ada data pada rentang tanggal ini.</div>';
    }

    var body = urut.map(function (r) {
      var tot = r.sesi;
      var pOn = tot ? Math.round((r.hadir / tot) * 100) : 0;
      var pLate = tot ? Math.round((r.terlambat / tot) * 100) : 0;
      var pOff = tot ? Math.round((r.absen / tot) * 100) : 0;
      var bar = tot
        ? '<span class="bar"><i class="on" style="width:' + (r.hadir / tot * 100) + '%"></i>' +
          '<i class="late" style="width:' + (r.terlambat / tot * 100) + '%"></i>' +
          '<i class="off" style="width:' + (r.absen / tot * 100) + '%"></i></span>'
        : '<span class="dim">tidak ada sesi</span>';
      return '<tr>' +
        '<td>' + esc(r.g.n) + '<br><span style="color:#9aa8a3;font-size:11px">' +
          esc(r.g.nama) + '</span>' + bar + '</td>' +
        '<td><span class="pill ' + r.g.g + '">' + r.g.g + '</span></td>' +
        '<td class="num">' + r.hadir + '<span class="pct">' + pOn + '%</span></td>' +
        '<td class="num late">' + r.terlambat + '<span class="pct">' + pLate + '%</span></td>' +
        '<td class="num off">' + r.absen + '<span class="pct">' + pOff + '%</span></td>' +
      '</tr>';
    }).join('');

    return stats +
      '<div class="card"><div class="card-head">' +
        'Rekap per guru <span class="spacer"></span>' +
        '<button class="btn ghost small" id="btnCsvGuru">' + ikonSvg('calendar') + ' CSV</button>' +
      '</div>' +
      '<div class="table-scroll"><table class="data">' +
        '<thead><tr><th>Guru</th><th>Kel.</th><th>On time</th><th>Telat</th><th>Tidak</th></tr></thead>' +
        '<tbody>' + body + '</tbody>' +
      '</table></div></div>' +
      '<p class="small-note">Tiap guru hanya dinilai pada sesi kelompoknya sendiri. ' +
        'Persentase dihitung dari sesi yang sudah dicatat pada rentang tanggal, bukan seluruh hari kalender.</p>';
  }

  function stat(k, v) {
    return '<div class="stat"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div></div>';
  }

  function tabHari() {
    var list = filteredEntri();
    if (!list.length) {
      return '<div class="empty-state"><div class="big">' + ikonSvg('calendar') + '</div>' +
        'Belum ada data pada rentang tanggal ini.</div>';
    }

    var perTanggal = {};
    list.forEach(function (e) {
      if (!perTanggal[e.tanggal]) perTanggal[e.tanggal] = [];
      perTanggal[e.tanggal].push(e);
    });

    var tanggalUrut = Object.keys(perTanggal).sort().reverse();

    var blocks = tanggalUrut.map(function (tgl) {
      var rows = perTanggal[tgl].slice().sort(function (a, b) {
        var ka = CONFIG.KEGIATAN.findIndex(function (k) { return k.id === a.kegiatan; });
        var kb = CONFIG.KEGIATAN.findIndex(function (k) { return k.id === b.kegiatan; });
        if (ka !== kb) return ka - kb;
        return a.kelompok < b.kelompok ? -1 : 1;
      });

      var tr = rows.map(function (e) {
        var p = pecahEntri(e);
        var k = kegiatanMeta(e.kegiatan);
        return '<tr>' +
          '<td>' + esc(k.label) + '</td>' +
          '<td><span class="pill ' + esc(e.kelompok) + '">' + esc(e.kelompok) + '</span></td>' +
          '<td class="num">' + p.hadir.length + '</td>' +
          '<td class="num late">' + p.terlambat.length + '</td>' +
          '<td>' + (e.catatan ? esc(e.catatan) : '<span class="dim">-</span>') + '</td>' +
          '<td><span class="dim">' + esc(e.petugas || '') + '</span></td>' +
        '</tr>';
      }).join('');

      return '<div class="card">' +
        '<div class="card-head">' + ikonSvg('calendar') + ' ' + esc(tglPanjang(tgl)) + '</div>' +
        '<div class="table-scroll"><table class="data">' +
          '<thead><tr><th>Kegiatan</th><th>Kel.</th><th>On time</th><th>Telat</th><th>Catatan</th><th>Petugas</th></tr></thead>' +
          '<tbody>' + tr + '</tbody>' +
        '</table></div></div>';
    }).join('');

    return blocks +
      '<div class="toolbar" style="padding-bottom:18px">' +
        '<button class="btn ghost small" id="btnCsvHari">' + ikonSvg('calendar') + ' Unduh CSV harian</button>' +
      '</div>';
  }

  function tabSiswa() {
    var list = filteredSiswa();
    if (!list.length) {
      return '<div class="empty-state"><div class="big">' + ikonSvg('users') + '</div>' +
        'Belum ada catatan siswa tidak tertib pada rentang tanggal ini.</div>';
    }

    var perSiswa = {};
    var sebaran = {};
    var sesiUnik = {};

    list.forEach(function (r) {
      var kunci = r.nama + '|' + r.kelas;
      if (!perSiswa[kunci]) perSiswa[kunci] = { nama: r.nama, kelas: r.kelas, n: 0, jenis: {}, sesi: {} };
      perSiswa[kunci].n++;
      perSiswa[kunci].sesi[r.tanggal + '|' + r.kegiatan] = true;

      String(r.jenis || '').split(' · ').filter(Boolean).forEach(function (j) {
        perSiswa[kunci].jenis[j] = (perSiswa[kunci].jenis[j] || 0) + 1;
        sebaran[j] = (sebaran[j] || 0) + 1;
      });

      sesiUnik[r.tanggal + '|' + r.kegiatan] = true;
    });

    var urut = Object.keys(perSiswa).map(function (k) { return perSiswa[k]; })
      .sort(function (a, b) { return b.n - a.n || a.nama.localeCompare(b.nama, 'id'); });

    var sebaranUrut = Object.keys(sebaran).sort(function (a, b) { return sebaran[b] - sebaran[a]; });
    var sebaranMaks = sebaranUrut.length ? sebaran[sebaranUrut[0]] : 1;

    var kartuSebaran = sebaranUrut.map(function (j) {
      var pct = Math.round(sebaran[j] / sebaranMaks * 100);
      return '<div class="jenis-baris">' +
        '<span class="jenis-nama">' + esc(j) + '</span>' +
        '<span class="jenis-bar"><i style="width:' + pct + '%"></i></span>' +
        '<span class="jenis-angka">' + sebaran[j] + '</span>' +
      '</div>';
    }).join('');

    var stats = '' +
      '<div class="stat-grid">' +
        stat('Catatan siswa', list.length) +
        stat('Siswa berbeda', urut.length) +
        stat('Sesi bermasalah', Object.keys(sesiUnik).length) +
        stat('Jenis terbanyak', sebaranUrut.length ? sebaranUrut[0] : '-') +
      '</div>';

    var body = urut.map(function (x) {
      var jenisTeks = Object.keys(x.jenis)
        .sort(function (a, b) { return x.jenis[b] - x.jenis[a]; })
        .slice(0, 3)
        .map(function (j) { return esc(j); })
        .join(', ');
      return '<tr>' +
        '<td>' + esc(x.nama) + '<br><span style="color:#9aa8a3;font-size:11px">Kelas ' +
          esc(x.kelas) + '</span></td>' +
        '<td class="num">' + x.n + '</td>' +
        '<td class="num off">' + Object.keys(x.sesi).length + '</td>' +
        '<td style="font-size:11.5px;color:#6c7d77">' + (jenisTeks || '-') + '</td>' +
      '</tr>';
    }).join('');

    return stats +
      '<div class="card"><div class="card-head">Sebaran jenis tidak tertib</div>' +
        '<div class="card-body">' + kartuSebaran + '</div></div>' +
      '<div class="card"><div class="card-head">' +
        'Siswa paling sering tercatat <span class="spacer"></span>' +
        '<button class="btn ghost small" id="btnCsvSiswa">' + ikonSvg('calendar') + ' CSV</button>' +
      '</div>' +
      '<div class="table-scroll"><table class="data">' +
        '<thead><tr><th>Siswa</th><th>Catatan</th><th>Sesi</th><th>Jenis</th></tr></thead>' +
        '<tbody>' + body + '</tbody>' +
      '</table></div></div>' +
      '<p class="small-note">Satu baris = satu siswa dalam satu sesi. Siswa yang tercatat ' +
        'di beberapa sesi dihitung beberapa kali pada kolom Catatan.</p>';
  }

  function filteredSiswa() {
    return (A.siswa || []).filter(function (r) {
      return r.tanggal >= A.dari && r.tanggal <= A.sampai;
    });
  }

  function tabPetugas() {
    var list = A.petugas || [];
    var rows = list.map(function (p) {
      return '<tr>' +
        '<td>' + esc(p.nama) + '<br><span class="dim" style="font-size:11px">' + esc(p.id) + '</span></td>' +
        '<td><span class="pill ' + esc(p.gender) + '">' + esc(p.gender) + '</span></td>' +
        '<td class="num">' + (p.pin ? '••' + esc(String(p.pin).slice(-2)) : '—') + '</td>' +
        '<td>' + (p.aktif ? '<span class="pill">aktif</span>' : '<span class="pill">nonaktif</span>') + '</td>' +
        '<td style="text-align:right;white-space:nowrap">' +
          '<button class="btn ghost small" data-edit="' + esc(p.id) + '">Edit</button> ' +
          '<button class="btn ghost small" data-hapus="' + esc(p.id) + '">Hapus</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    return '' +
      '<div class="card"><div class="card-head">Kelola petugas OSIS</div>' +
        '<div class="card-body">' +
          '<div class="field"><label for="pNama">Nama petugas</label>' +
            '<input class="input" id="pNama" placeholder="Nama lengkap" autocomplete="off"></div>' +
          '<div class="filters">' +
            '<div class="field"><label>Kelompok</label>' +
              '<select class="input" id="pGender">' +
                '<option value="putra">Putra</option><option value="putri">Putri</option>' +
              '</select></div>' +
            '<div class="field"><label>PIN (4–8 angka)</label>' +
              '<input class="input" id="pPin" type="tel" inputmode="numeric" maxlength="8" placeholder="123456"></div>' +
          '</div>' +
          '<button class="btn" id="btnSimpanPetugas" style="margin-top:6px">Tambah Petugas</button>' +
          '<button class="btn ghost hidden" id="btnBatalEdit" style="margin-top:8px">Batal edit</button>' +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="card-head">Daftar petugas (' + list.length + ')</div>' +
        '<div class="table-scroll"><table class="data">' +
          '<thead><tr><th>Nama</th><th>Kel.</th><th>PIN</th><th>Status</th><th></th></tr></thead>' +
          '<tbody>' + (rows || '<tr><td colspan="5" class="dim">Belum ada petugas.</td></tr>') + '</tbody>' +
        '</table></div></div>' +
      '<p class="small-note">PIN harus unik. Nonaktifkan petugas yang sudah tidak bertugas ' +
        'daripada menghapus, supaya riwayat pengisian tetap utuh.</p>';
  }

  /* ---------------- admin logic ---------------- */

  var A_EDIT = null;

  function bindAdmin() {
    if (S.mode !== 'admin') return;

    var fk = $('#formAdminKey');
    if (fk) {
      var ki = $('#adminKey');
      if (ki) setTimeout(function () { ki.focus(); }, 120);
      fk.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var v = ki.value.trim();
        if (!v) return;
        try { localStorage.setItem(LS_ADMINKEY, v); } catch (e) {}
        A.key = v;
        A.needKey = false;
        A.loaded = false;
        A.err = '';
        render();
        loadAdmin();
      });
      return;
    }

    var refresh = $('#btnAdminRefresh');
    if (refresh) refresh.addEventListener('click', function () {
      A.loaded = false; A.err = '';
      render();
      loadAdmin();
    });

    var reset = $('#btnAdminKeyReset');
    if (reset) reset.addEventListener('click', function () {
      try { localStorage.removeItem(LS_ADMINKEY); } catch (e) {}
      A.key = ''; A.needKey = true; A.err = ''; A.loaded = false;
      render();
    });

    var fd = $('#fDari'), fs = $('#fSampai');
    if (fd) fd.addEventListener('change', function () { A.dari = fd.value; render(); });
    if (fs) fs.addEventListener('change', function () { A.sampai = fs.value; render(); });

    $$('[data-range]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = b.getAttribute('data-range');
        var now = new Date();
        if (r === 'semua') { A.dari = '2000-01-01'; A.sampai = '2999-12-31'; }
        else if (r === 'bulan') {
          A.dari = todayISO().slice(0, 7) + '-01';
          A.sampai = todayISO();
        } else {
          var n = Number(r);
          var d = new Date(now.getTime() - (n - 1) * 86400000);
          A.dari = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
          A.sampai = todayISO();
        }
        render();
      });
    });

    $$('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        A.tab = b.getAttribute('data-tab');
        render();
      });
    });

    var csvG = $('#btnCsvGuru');
    if (csvG) csvG.addEventListener('click', exportCsvGuru);
    var csvH = $('#btnCsvHari');
    if (csvH) csvH.addEventListener('click', exportCsvHari);
    var csvS = $('#btnCsvSiswa');
    if (csvS) csvS.addEventListener('click', exportCsvSiswa);

    // petugas form
    var btnSP = $('#btnSimpanPetugas');
    if (btnSP) btnSP.addEventListener('click', function () {
      var nama = $('#pNama').value.trim();
      var gender = $('#pGender').value;
      var pin = $('#pPin').value.trim();
      if (!nama) { toast('Nama wajib diisi.', true); return; }
      if (!/^\d{4,8}$/.test(pin)) { toast('PIN harus 4–8 angka.', true); return; }

      btnSP.disabled = true;
      btnSP.textContent = 'Menyimpan…';
      var data = { nama: nama, gender: gender, pin: pin, aktif: true };
      if (A_EDIT) data.id = A_EDIT;

      API.adminSavePetugas(A.key, data).then(function () {
        A_EDIT = null;
        toast('Petugas disimpan.');
        return loadAdminPromise();
      }).then(function () {
        render();
      }).catch(function (err) {
        toast(err.message, true);
        btnSP.disabled = false;
        btnSP.textContent = 'Tambah Petugas';
      });
    });

    var btnBatal = $('#btnBatalEdit');
    if (btnBatal) btnBatal.addEventListener('click', function () {
      A_EDIT = null;
      render();
    });

    $$('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-edit');
        var p = A.petugas.filter(function (x) { return x.id === id; })[0];
        if (!p) return;
        A_EDIT = id;
        render();
        $('#pNama').value = p.nama;
        $('#pGender').value = p.gender;
        $('#pPin').value = p.pin;
        var sp = $('#btnSimpanPetugas');
        if (sp) sp.textContent = 'Simpan Perubahan';
        var batal = $('#btnBatalEdit');
        if (batal) batal.classList.remove('hidden');
        window.scrollTo(0, 0);
      });
    });

    $$('[data-hapus]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-hapus');
        var p = A.petugas.filter(function (x) { return x.id === id; })[0];
        if (!p) return;
        if (!confirm('Hapus petugas "' + p.nama + '"?')) return;
        API.adminDeletePetugas(A.key, id).then(function () {
          toast('Petugas dihapus.');
          return loadAdminPromise();
        }).then(function () {
          render();
        }).catch(function (err) { toast(err.message, true); });
      });
    });
  }

  function loadAdminPromise() {
    return API.rekap(A.key, A.dari, A.sampai).then(function (res) {
      A.entri = res.entri || [];
      A.siswa = res.siswa || [];
      A.petugas = res.petugas || [];
      A.loaded = true;
      A.err = '';
      return res;
    });
  }

  function loadAdmin() {
    API.rekap(A.key, A.dari, A.sampai).then(function (res) {
      A.entri = res.entri || [];
      A.siswa = res.siswa || [];
      A.petugas = res.petugas || [];
      A.loaded = true;
      A.err = '';
      render();
    }).catch(function (err) {
      if (/kunci/i.test(err.message)) {
        try { localStorage.removeItem(LS_ADMINKEY); } catch (e) {}
        A.key = '';
        A.needKey = true;
        A.loaded = false;
      } else {
        A.err = err.message;
      }
      render();
    });
  }

  /* ---------------- CSV ---------------- */

  function download(name, text) {
    var blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      document.body.removeChild(a);
    }, 500);
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportCsvGuru() {
    var list = filteredEntri();
    var perGuru = {};
    GURU.forEach(function (g) { perGuru[g.n] = { g: g, hadir: 0, terlambat: 0, absen: 0, sesi: 0 }; });
    list.forEach(function (e) {
      var p = pecahEntri(e);
      GURU.forEach(function (g) {
        if (g.g !== e.kelompok) return;
        perGuru[g.n].sesi++;
        if (p.hadir.indexOf(g.n) !== -1) perGuru[g.n].hadir++;
        else if (p.terlambat.indexOf(g.n) !== -1) perGuru[g.n].terlambat++;
        else perGuru[g.n].absen++;
      });
    });

    var lines = [['Guru', 'Nama Lengkap', 'Kelompok', 'Sesi', 'On Time', 'Terlambat', 'Tidak Hadir',
      'Persen On Time', 'Persen Terlambat', 'Persen Tidak Hadir'].map(csvCell).join(',')];
    GURU.forEach(function (g) {
      var r = perGuru[g.n];
      var tot = r.sesi || 0;
      function pct(n) { return tot ? Math.round(n / tot * 100) + '%' : '0%'; }
      lines.push([
        g.n, g.nama, g.g, tot, r.hadir, r.terlambat, r.absen,
        pct(r.hadir), pct(r.terlambat), pct(r.absen)
      ].map(csvCell).join(','));
    });

    download('rekap-guru-' + A.dari + '_' + A.sampai + '.csv', lines.join('\r\n'));
    toast('CSV rekap guru diunduh.');
  }

  function exportCsvHari() {
    var list = filteredEntri().slice().sort(function (a, b) {
      if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? -1 : 1;
      return a.kegiatan < b.kegiatan ? -1 : 1;
    });

    var head = ['Tanggal', 'Kelompok', 'Kegiatan', 'On Time', 'Hadir', 'Terlambat', 'Daftar Terlambat',
      'Tidak Hadir', 'Catatan', 'Petugas', 'Diubah']
      .map(csvCell).join(',');

    var rows = list.map(function (e) {
      var p = pecahEntri(e);
      return [
        e.tanggal, e.kelompok, kegiatanMeta(e.kegiatan).label,
        p.hadir.length, p.hadir.join('; '), p.terlambat.length, p.terlambat.join('; '),
        e.tidakHadir || '', e.catatan || '', e.petugas || '', e.updatedAt || ''
      ].map(csvCell).join(',');
    });

    download('rekap-harian-' + A.dari + '_' + A.sampai + '.csv', [head].concat(rows).join('\r\n'));
    toast('CSV rekap harian diunduh.');
  }

  function exportCsvSiswa() {
    var list = filteredSiswa().slice().sort(function (a, b) {
      if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? -1 : 1;
      if (a.kegiatan !== b.kegiatan) return a.kegiatan < b.kegiatan ? -1 : 1;
      return a.nama < b.nama ? -1 : 1;
    });

    var head = ['Tanggal', 'Kelompok', 'Kegiatan', 'Kelas', 'Nama', 'Jenis', 'Catatan', 'Petugas']
      .map(csvCell).join(',');

    var rows = list.map(function (r) {
      return [r.tanggal, r.kelompok, kegiatanMeta(r.kegiatan).label, r.kelas, r.nama,
        r.jenis || '', r.catatan || '', r.petugas || ''].map(csvCell).join(',');
    });

    download('rekap-siswa-' + A.dari + '_' + A.sampai + '.csv', [head].concat(rows).join('\r\n'));
    toast('CSV rekap siswa diunduh.');
  }

  /* ---------------- start ---------------- */

  function initAdmin() {
    A.dari = (function () {
      var d = new Date(Date.now() - 6 * 86400000);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    })();
    A.sampai = todayISO();

    try { A.key = localStorage.getItem(LS_ADMINKEY) || ''; } catch (e) {}

    if (CONFIG.ADMIN_KEY) A.key = CONFIG.ADMIN_KEY;
    if (!A.key) {
      A.needKey = true;
      render();
      return;
    }
    render();
    loadAdmin();
  }

  document.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
})();
