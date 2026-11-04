/**
 * api.js — jembatan ke Google Apps Script.
 *
 * Dua mode, dipilih otomatis:
 *  1. Di dalam Apps Script (HtmlService) -> google.script.run.
 *     Tidak ada URL, tidak ada CORS, PIN/token tidak pernah muncul di alamat.
 *  2. Dibuka sebagai file statis (file:// atau hosting) -> JSONP,
 *     karena Apps Script tidak mengirim header CORS.
 */
(function () {
  var seq = 0;

  function dalamAppsScript() {
    return !!(window.google && window.google.script && window.google.script.run);
  }

  function lewatAppsScript(action, params) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error('Server terlalu lama menjawab. Periksa internet lalu coba lagi.'));
      }, 30000);

      function selesai(fn, arg) {
        clearTimeout(timer);
        fn(arg);
      }

      window.google.script.run
        .withSuccessHandler(function (res) {
          if (!res || res.ok === false) {
            selesai(reject, new Error((res && res.error) || 'Permintaan gagal.'));
          } else {
            selesai(resolve, res);
          }
        })
        .withFailureHandler(function (err) {
          selesai(reject, new Error((err && err.message) || String(err)));
        })
        .api(action, params || {});
    });
  }

  function endpoint() {
    if (!CONFIG.API_URL) {
      throw new Error('API_URL belum diisi di config.js');
    }
    return CONFIG.API_URL;
  }

  function lewatJsonp(action, params) {
    return new Promise(function (resolve, reject) {
      var name = '__ceklist_' + (++seq) + '_' + Math.floor(Math.random() * 1e6);
      var script = document.createElement('script');

      var timer = setTimeout(function () {
        cleanup();
        reject(new Error('Koneksi ke server terlalu lama. Periksa internet lalu coba lagi.'));
      }, 20000);

      function cleanup() {
        clearTimeout(timer);
        delete window[name];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[name] = function (res) {
        cleanup();
        if (!res || res.ok === false) {
          reject(new Error((res && res.error) || 'Permintaan gagal.'));
        } else {
          resolve(res);
        }
      };

      script.onerror = function () {
        cleanup();
        reject(new Error('Tidak bisa menghubungi server. Periksa URL API di config.js.'));
      };

      script.src = endpoint()
        + '?action=' + encodeURIComponent(action)
        + '&callback=' + name
        + '&params=' + encodeURIComponent(JSON.stringify(params || {}))
        + '&_=' + Date.now();

      document.body.appendChild(script);
    });
  }

  function request(action, params) {
    if (dalamAppsScript()) return lewatAppsScript(action, params);
    return lewatJsonp(action, params);
  }

  window.API = {
    mode: function () { return dalamAppsScript() ? 'appsscript' : 'jsonp'; },
    petugas: function () { return request('petugas', {}); },
    login: function (pin) { return request('login', { pin: pin }); },
    day: function (token, tanggal) { return request('day', { token: token, tanggal: tanggal }); },
    save: function (token, payload) {
      payload.token = token;
      return request('save', payload);
    },
    rekap: function (key, dari, sampai) {
      return request('rekap', { key: key, dari: dari, sampai: sampai });
    },
    adminPetugas: function (key) { return request('adminPetugas', { key: key }); },
    adminSavePetugas: function (key, data) {
      data.key = key;
      return request('adminSavePetugas', data);
    },
    adminDeletePetugas: function (key, id) {
      return request('adminDeletePetugas', { key: key, id: id });
    }
  };
})();
