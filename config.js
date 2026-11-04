/**
 * Konfigurasi aplikasi.
 *
 * Mode pasang:
 *   A. GitHub Pages / hosting statis  -> isi API_URL (JSONP), seperti di bawah
 *   B. Disajikan dari Apps Script     -> API_URL boleh kosong, otomatis
 *                                        memakai google.script.run
 *
 * API_URL  : URL Web App Google Apps Script (akhiran /exec). Hanya dipakai
 *            kalau aplikasi dibuka sebagai halaman statis.
 * ADMIN_PATH: potongan URL rahasia halaman rekap admin.
 *            Halaman rekap hanya terbuka bila hash URL = #/<ADMIN_PATH>
 *            Ganti dengan kata acak milik Anda sendiri, jangan dibagikan
 *            ke petugas OSIS.
 *
 * Kunci admin TIDAK disimpan di file ini. Kunci hanya ada di server
 * (apps-script/Code.gs) supaya tidak bisa dibaca dari browser.
 */
var CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyDFyiYxsDw8yLgrAISE94Eucu84Uq1VL3si3aVCqjKM2FTbpEC_fYlJ9Q_CBAwx_VPcw/exec',
  ADMIN_PATH: 'rekap-x37wrwb0',
  NAMA_SEKOLAH: 'SMP ABBS Surakarta',
  KEGIATAN: [
    { id: 'upacara', label: 'Upacara', jam: '07.00' },
    { id: 'duha',    label: 'Duha',    jam: '09.15' },
    { id: 'duhur',   label: 'Duhur',   jam: '12.00' },
    { id: 'ashar',   label: 'Ashar',   jam: '15.00' }
  ]
};
