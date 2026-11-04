# Ceklist Pendampingan Guru — SMP ABBS Surakarta

Aplikasi ceklist kehadiran guru pendamping untuk 4 kegiatan: **Upacara, Duha,
Duhur, Ashar**. Diisi petugas OSIS, rekap total hanya untuk admin.

Halaman aplikasi statis (dipasang di GitHub Pages / hosting statis).
Data disimpan di **Google Sheets** lewat Google Apps Script.

## Alamat

| Keperluan | Alamat |
|---|---|
| Aplikasi petugas | https://smpabbs.github.io/ceklist-pendampingan/ |
| Rekap admin | alamat di atas + `#/rekap-…` (lihat di bawah) |
| Data (Google Sheets) | privat, hanya admin |

Kunci admin dan `ADMIN_PATH` tidak ditulis di repo ini. Keduanya ada di
`PANDUAN.md` versi lokal dan di `apps-script/Code.gs` (server).

## Tiga status kehadiran

Petugas cukup **mengetuk nama** untuk berputar:

| Ketukan | Status | Tampilan |
|---|---|---|
| 1 | **On time** | hijau + centang |
| 2 | **Terlambat** | kuning kecoklatan + ikon jam |
| 3 | **Tidak hadir** | netral |

Ketiga nilai dihitung terpisah di rekap.

## Arsitektur

```
GitHub Pages  ──JSONP──>  Apps Script Web App  ──>  Google Sheets
(index.html,              (Code.gs: validasi,         (Entri, Petugas, Log)
 app.js, api.js)           token, rekap)
```

- `api.js` memakai JSONP karena Apps Script tidak mengirim header CORS.
- Kalau file yang sama dibuka dari dalam Apps Script, `api.js` otomatis
  memakai `google.script.run` (tanpa URL, tanpa CORS).
- Batas "hanya hari ini" ditegakkan **di server**, bukan hanya tampilan.

## Isi folder

```
index.html            aplikasi
config.js             API_URL, ADMIN_PATH, daftar kegiatan
app.js                logika aplikasi
api.js                jembatan ke backend
style.css             tampilan
data/guru.js          36 guru (14 putra, 22 putri)
apps-script/Code.gs   backend Google Sheets
tools/gsetup/         skrip penyiapan otomatis
PANDUAN.md            panduan lengkap
```

## Aturan akses

| | Petugas OSIS | Admin |
|---|---|---|
| Lihat data | hanya hari ini | semua tanggal |
| Ubah data | hanya hari ini | — |
| Rekap total | tidak | ya |
| Kelola petugas & PIN | tidak | ya |

## Uji

```bash
node _uji.js          # alur UI (login → siklus 3 status → simpan → rekap)
node _uji_backend.js  # logika Code.gs + migrasi kolom
```
