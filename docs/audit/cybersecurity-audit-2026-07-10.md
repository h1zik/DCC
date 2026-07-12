# Audit Cybersecurity DCC — 10 Juli 2026

## Ringkasan eksekutif

Audit statis kode, konfigurasi, dependency produksi, serta jalur data sensitif menemukan **31 gap**: **2 kritis, 15 tinggi, 10 sedang, dan 4 rendah**. Angka ini tidak berarti seluruh gap sudah dieksploitasi. Temuan bertanda **Kondisional** menjadi kritis/tinggi hanya bila konfigurasi terkait benar-benar dipakai atau terekspos di production.

Prioritas darurat:

1. Pastikan MCP tidak dapat diakses tanpa token, batasi ke jaringan internal, dan rotasi token bila pernah terekspos.
2. Upgrade Next.js dari 16.2.4 ke minimal 16.2.10.
3. Tutup akses publik `/uploads/**`, pindahkan file privat dari web root, dan blokir konten aktif seperti SVG.
4. Tambahkan revokasi sesi saat password/role/akun berubah.
5. Tutup SSRF pada URL visual dan endpoint Web Push.

## Ruang lingkup dan metode

- Review kode `src`, `mcp-server`, `prisma`, `scripts`, konfigurasi Next.js, Docker, dan contoh environment.
- Inventaris endpoint API, server action, upload/download, autentikasi, role, cron, scraper, AI API, data wajah, dan integrasi eksternal.
- `npm audit --omit=dev` pada aplikasi utama dan MCP server, dilakukan 10 Juli 2026.
- Tidak membaca nilai rahasia dari `.env`; hanya memastikan `.env` tidak dilacak Git.
- Belum melakukan pentest aktif terhadap deployment, firewall, DNS, database production, atau cloud account. Temuan deployment yang belum dapat dibuktikan dari repository diberi label **Kondisional**.

## Temuan kritis

### C-01 — MCP HTTP fail-open tanpa autentikasi (Kondisional)

**Bukti:** `mcp-server/src/index.ts:1030-1036`, `1108-1116`, `1220-1300`.

Server bind ke `0.0.0.0`, sementara `MCP_HTTP_AUTH_TOKEN` opsional. Saat kosong, `isAuthorized()` selalu mengizinkan request. MCP tetap diwajibkan memiliki `DCC_AI_READ_API_TOKEN`, sehingga MCP publik tanpa token depan dapat menjadi proxy ke data internal DCC dengan role efektif yang luas.

**Dampak:** pembacaan data organisasi, tugas, dokumen, research, dan berpotensi keuangan sesuai role token API; penyalahgunaan layanan berbayar.

**Perbaikan:** fail-closed di non-development; wajibkan token kuat atau mTLS/OAuth; bind default ke `127.0.0.1`; firewall/allowlist; rotasi `MCP_HTTP_AUTH_TOKEN` dan `DCC_AI_READ_API_TOKEN` bila endpoint pernah publik; gunakan per-client identity dan scope.

### C-02 — Dependency produksi memiliki 1 advisory kritis dan 4 tinggi

**Bukti:** hasil `npm audit --omit=dev`: total 14 vulnerability (1 critical, 4 high, 8 moderate, 1 low). Paket utama yang terdampak antara lain `jspdf@2.5.2`, `next@16.2.4`, `echarts@5.6.0`, `undici@7.27.2`, `hono@4.12.14`, dan `fast-uri@3.1.0`.

`jspdf` memiliki advisory critical/high termasuk HTML/PDF injection, path traversal/LFI, dan DoS. Pemakaian saat ini terutama merasterisasi konten ke canvas, sehingga tidak semua advisory pasti reachable, tetapi versi tetap berada dalam rentang rentan.

**Perbaikan:** upgrade teruji: Next.js minimal 16.2.10; jsPDF minimal versi perbaikan audit (4.2.1 saat audit); ECharts minimal 6.1.0; perbarui rantai Cheerio/Undici dan MCP SDK/Hono/AJV. Uji regresi ekspor PDF dan chart karena sebagian upgrade major.

## Temuan tinggi

### H-01 — Seluruh file `/uploads/**` dapat dibaca tanpa login

**Bukti:** `src/proxy.ts:117-119` mengecualikan `uploads/`; `src/app/uploads/[...path]/route.ts:93-190` tidak memanggil `auth()` atau authorization.

Route melayani task attachment, room document, direct chat, room chat, avatar, wiki, branding, dan visual asset hanya berdasarkan path. UUID bukan kontrol akses. URL yang pernah dibagikan tetap valid setelah user keluar ruangan atau kehilangan role.

**Dampak:** kebocoran dokumen internal, percakapan, data proyek, dan file personal; tidak ada revocation per objek.

**Perbaikan:** storage privat di luar `public`; download hanya lewat endpoint berbasis ID yang memeriksa membership/role; signed URL pendek bila perlu; `Cache-Control: private, no-store` untuk data privat; audit dan rotasi URL lama.

### H-02 — Stored XSS melalui upload SVG/konten aktif

**Bukti:** task/chat/document menerima `image/*`, `text/*`, atau `application/octet-stream` berdasarkan `File.type` yang dikirim client (`src/actions/task-attachments.ts:24-45,126-163`; `src/lib/direct-chat-attachments-shared.ts:1-23`; `src/lib/room-document-upload.ts:14-35`). Nama asli dan ekstensi dipertahankan. Route upload menyajikan `.svg` sebagai `image/svg+xml` dan `Content-Disposition: inline` (`src/app/uploads/[...path]/route.ts:10-39,52-55`).

**Dampak:** user biasa dapat menyimpan SVG ber-script lalu mengarahkan korban ke URL same-origin. Script dapat melakukan request dengan sesi korban meskipun cookie HttpOnly.

**Perbaikan:** tolak SVG/HTML/XML aktif pada jalur umum; sniff magic bytes; re-encode image dengan Sharp; sajikan file tidak tepercaya sebagai `attachment` pada origin aset terpisah tanpa cookie; tambahkan CSP sandbox pada respons preview.

### H-03 — Next.js 16.2.4 rentan Proxy/Middleware bypass dan DoS

**Bukti:** `package.json:77`; audit npm menandai beberapa advisory Next.js, termasuk bypass Proxy App Router, dynamic-route parameter injection, RSC/image DoS, cache poisoning, dan SSRF WebSocket. Fix tersedia di 16.2.10 pada saat audit.

Layout dashboard memberi backstop autentikasi, dan beberapa sub-layout memberi role guard. Namun sejumlah pembatasan navigasi/role masih mengandalkan `src/proxy.ts`, sehingga bypass tetap berpotensi memberi user terautentikasi akses lintas modul.

**Perbaikan:** upgrade segera; pertahankan guard role di setiap layout/page/data loader sensitif dan jangan menjadikan Proxy satu-satunya authorization boundary.

### H-04 — SSRF langsung dari URL visual manual

**Bukti:** `createBrandVisualAssetFromUrl` menerima URL http/https arbitrer (`src/actions/brand-visual-research.ts:263-283`). `loadFromUrl` lalu melakukan `fetch(url)` langsung (`src/lib/brand-research/strategy/visual-vision.ts:36-59`) tanpa `safeFetch`/blok IP privat.

**Dampak:** Brand Manager dapat membuat server mengakses localhost, service internal, metadata cloud, atau host hasil DNS rebinding; response hingga 3 MB dibaca ke memori dan diteruskan ke LLM.

**Perbaikan:** gunakan fetch SSRF-safe yang memvalidasi setiap redirect dan mem-pin hasil DNS/koneksi; blok semua IP non-global; batasi port, content length, timeout, dan tipe berdasarkan signature.

### H-05 — Helper SSRF dapat dibypass oleh IPv6 dan DNS rebinding

**Bukti:** `src/lib/security/ssrf.ts:43-53` hanya mengenali IPv4-mapped IPv6 berbentuk dotted decimal. Bentuk seperti `::ffff:7f00:1`, multicast IPv6, dan beberapa special-use range tidak diblok. `assertPublicHost()` melakukan DNS lookup, tetapi `fetch()` melakukan resolusi baru sehingga masih ada TOCTOU/DNS rebinding (`60-85`, `108-127`). Tidak ada test SSRF.

**Perbaikan:** normalisasi IP dengan library teruji; klasifikasikan seluruh special-use range IPv4/IPv6; pin socket ke alamat yang sudah divalidasi sambil mempertahankan TLS SNI/Host; tambah test corpus bypass.

### H-06 — Web Push menjadi blind SSRF dan resource-exhaustion primitive

**Bukti:** endpoint subscription menerima string `endpoint`, key, dan user-agent tanpa validasi URL/panjang (`src/app/api/push/subscription/route.ts:14-19,32-63`). Nilai dikirim ke `webpush.sendNotification()` tanpa allowlist atau timeout (`src/lib/web-push.ts:32-52`). Library melakukan `https.request` ke hostname/port dari endpoint.

**Dampak:** user dapat mendaftarkan endpoint HTTPS internal/arbitrer, memindai layanan melalui timing/status, atau membuat koneksi menggantung. Subscription per user juga tidak dibatasi dan dikirim paralel.

**Perbaikan:** validasi endpoint HTTPS ke provider push yang dikenal atau verifikasi host publik; beri timeout; batasi subscription per user; validasi ukuran/base64 key; concurrency limit dan circuit breaker.

### H-07 — Sesi JWT tidak dicabut saat password/role/akun berubah

**Bukti:** sesi JWT berlaku 7 hari (`src/lib/auth.ts:21-24`). Role hanya dibaca ulang bila token lama belum memiliki role (`121-148`). Perubahan password, reset admin, perubahan role, dan delete user tidak menaikkan `sessionVersion` atau mencabut sesi (`src/actions/profile.ts:221-247`; `src/actions/users.ts:134-188`; `src/actions/user-roles.ts:20-53`). Model `User` tidak memiliki `isActive/sessionVersion`.

**Dampak:** sesi curian tetap aktif setelah password diganti; user yang diturunkan rolenya dapat mempertahankan hak lama hingga 7 hari; user terhapus bisa tetap lolos guard yang hanya mempercayai JWT.

**Perbaikan:** tambah `sessionVersion`/`credentialsChangedAt` dan cek DB pada request sensitif; increment saat password/role/status berubah; status akun aktif; umur sesi istimewa lebih pendek; re-auth untuk aksi admin/finance.

### H-08 — Rate-limit login/API dapat dibypass dan tidak shared

**Bukti:** IP diambil dari elemen pertama `x-forwarded-for` (`src/lib/auth.ts:37-40`; `src/lib/ai-api/guard.ts:14-16`), yang dapat dipalsukan bila reverse proxy tidak membersihkan header. Bucket hanya Map in-memory (`src/lib/auth-rate-limit.ts`; `src/lib/ai-api/rate-limit.ts`), hilang saat restart dan tidak konsisten pada multi-instance. AI API baru melakukan rate-limit setelah token benar.

**Perbaikan:** gunakan header platform yang dipercaya atau parser trusted-proxy; Redis/DB rate-limit; bucket per akun + per IP + global; throttle request token salah di edge; exponential backoff dan alert.

### H-09 — Upload 300–500 MB dan buffering penuh memungkinkan DoS

**Bukti:** Next menerima body 300 MB (`next.config.ts:37-46`), tetapi constant aplikasi mengklaim 500 MB (`src/lib/upload-limits.ts:1-3`). Banyak jalur memanggil `file.arrayBuffer()` lalu menggandakan ke Buffer sebelum menulis, misalnya task/chat/room/content planning. Tidak ada quota storage/user/room atau rate-limit upload.

**Dampak:** satu atau beberapa user dapat menghabiskan heap, CPU, bandwidth, disk, dan biaya storage.

**Perbaikan:** limit per use-case (avatar 2 MB, dokumen mis. 25–50 MB, video terpisah); streaming; quota per user/room; concurrency/rate limit; cek free disk; cleanup orphan; samakan label dan limit.

### H-10 — Absensi dan reward dapat dipalsukan dari client

**Bukti:** `POST /api/attendance` mempercayai `confidence` dari body dan membuat record langsung (`src/app/api/attendance/route.ts:80-100,163-188`). Nilai `confidence > 0` dapat memicu XP. Server tidak menerima proof/challenge dari verifikasi wajah. User juga dapat mengganti descriptor wajahnya sendiri melalui `POST /api/face-data`.

**Dampak:** user terautentikasi dapat check-in tanpa kamera/wajah dan memperoleh reward; integritas payroll/attendance terganggu.

**Perbaikan:** verifikasi server-side atau gunakan signed one-time challenge/attestation; jangan percaya confidence client; enrollment ulang butuh re-auth/approval; pisahkan status “self-reported” dan “verified”.

### H-11 — Input biometrik/absensi tidak punya batas koleksi dan panjang

**Bukti:** descriptor wajah hanya dicek array non-kosong dan setiap descriptor 128 angka, tanpa maksimum jumlah/label (`src/app/api/face-data/route.ts:43-81`). Attendance menerima `reason`, `todoList`, dan `completedTasks` tanpa batas panjang/elemen (`src/app/api/attendance/route.ts:93-108,163-177`). Body global dapat mencapai ratusan MB.

**Dampak:** DB bloat, transaksi besar, memori tinggi, dan abuse oleh user biasa.

**Perbaikan:** schema Zod ketat; maksimal pose, panjang label/reason, jumlah dan panjang item; body limit endpoint jauh lebih kecil; rate limit.

### H-12 — Zip/decompression bomb pada ekstraksi DOCX

**Bukti:** file terkompresi hingga 10 MB dibaca lalu seluruh ZIP di-`unzipSync`, padahal hanya `word/document.xml` dibutuhkan (`src/lib/room-document-text.ts:6-7,55-62,194-215`). Tidak ada limit ukuran hasil dekompresi, jumlah entry, atau ratio.

**Dampak:** file DOCX kecil dapat mengalokasikan memori sangat besar saat diminta lewat fitur AI/dokumen.

**Perbaikan:** parser streaming/targeted entry; limit expanded bytes, entries, ratio, waktu, dan worker isolation; batasi PDF parser serupa.

### H-13 — Skrip SSH membocorkan password dan tidak memverifikasi host

**Bukti:** `scripts/ssh-exec.mjs`, `ssh-upload.mjs`, dan `odysseus-deploy-research-mcp.mjs` menerima password root lewat command-line argument; command line dapat terlihat di process list/shell history. Koneksi memakai `username: "root"` dan tidak menetapkan `hostVerifier`. `vps-ssh-fetch-samples.mjs` juga hard-code IP dan root.

**Dampak:** pencurian kredensial root dan MITM deployment; kompromi VPS/MCP.

**Perbaikan:** SSH key ber-passphrase/agent, user deploy non-root, known-host fingerprint wajib, sudo terbatas, secrets manager; hapus password dari argv.

### H-14 — PostgreSQL Docker memakai default password dan bind publik (Kondisional)

**Bukti:** `docker-compose.yml:5-10` menetapkan `postgres/postgres` dan memetakan `5432:5432`, yang secara default bind ke semua interface host.

**Dampak:** bila Compose dijalankan di host yang dapat dijangkau, database dapat diambil alih dengan kredensial trivial.

**Perbaikan:** bind `127.0.0.1:5432`, gunakan secret acak dari environment/secrets file, firewall, TLS, dan jangan gunakan compose dev di production.

### H-15 — Tidak ada MFA untuk akun CEO/Admin/Finance

**Bukti:** autentikasi hanya Credentials email/password (`src/lib/auth.ts:16-93`). Password minimum saat perubahan/reset hanya 8 karakter.

**Dampak:** phishing/credential stuffing langsung menjadi kompromi penuh akun istimewa dan data keuangan.

**Perbaikan:** WebAuthn/TOTP wajib untuk privileged role; recovery codes; step-up auth; opsi SSO/OIDC organisasi; cek password bocor.

## Temuan sedang

### M-01 — Tidak ada Content-Security-Policy

`next.config.ts:48-67` sudah memiliki beberapa header, tetapi tidak CSP. Dampak setiap XSS menjadi lebih besar. Tambahkan CSP bertahap dengan nonce/hash, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors`, dan reporting. Hindari `unsafe-inline` sebisa mungkin.

### M-02 — Validasi upload bergantung pada MIME/nama dari client

Hanya lampiran finance memakai magic-byte sniffing. Jalur lain menerima `File.type`, ekstensi, bahkan `application/octet-stream`; tidak ada antivirus/CDR. Terapkan signature validation terpusat, re-encode gambar, scan malware, dan quarantine sebelum publish.

### M-03 — API AI memakai satu bearer token global tanpa identity/scope/expiry

`AI_READ_API_TOKEN` memberi satu identitas bersama. Tidak ada key ID, expiry, rotasi overlap, per-client audit, atau scope endpoint. `AI_READ_API_ALLOW_ROLE_HEADER=true` memungkinkan bearer holder memilih role sampai `ALL`; ini footgun bila salah set di production.

### M-04 — API “read” dapat menimbulkan biaya dan tidak selalu memeriksa capability role

Endpoint SEO GET memanggil DataForSEO live (`src/app/api/ai/seo/*`) dan research evaluation dapat menjalankan analisis mahal. Guard hanya memastikan role terkonfigurasi; route SEO tidak memanggil capability seperti `canViewResearch`. Tambahkan scope `seo:execute`, budget/rate per token, cache, dan role check.

### M-05 — MCP tidak membatasi body, sesi, timeout, atau concurrency

`readBody()` menampung seluruh request ke array Buffer (`mcp-server/src/index.ts:1074-1102`). Map `transports` tidak punya TTL/jumlah maksimum (`1040-1042`, `1154-1173`). `dccFetch` juga tanpa timeout. Bahkan dengan auth, client valid/kompromi dapat menghabiskan memori dan koneksi.

### M-06 — Data wajah disimpan mentah dan dikirim kembali ke browser

Descriptor disimpan sebagai JSON string tanpa application-level encryption (`prisma/schema.prisma:2121-2134`) dan GET mengembalikannya ke client. Terapkan klasifikasi biometrik, encryption at rest dengan key terpisah, minimisasi/retensi, akses/audit, consent, dan prosedur penghapusan.

### M-07 — Tidak ada security audit trail terpusat

Perubahan role/password, login gagal/sukses, penghapusan user, download sensitif, pembuatan token/subscription, dan akses MCP tidak menghasilkan event keamanan terstruktur dengan actor, target, IP, request ID, dan outcome. Log saat ini tersebar dan sebagian hanya `console`.

### M-08 — Backup database lokal tidak terenkripsi

`prisma/scripts/backup-db.ts` menulis dump production ke `./backups` tanpa encryption atau permission hardening. `.gitignore` mencegah commit, tetapi tidak melindungi disk, malware, atau backup workstation. Enkripsi, batasi ACL, retensi, dan uji restore.

### M-09 — 3.627 file `mcp-server/node_modules` dilacak Git

Root `.gitignore` hanya mengabaikan `/node_modules`, bukan nested node_modules. Vendoring tidak disengaja meningkatkan supply-chain drift, ukuran repo, noise review, dan peluang file dependency termodifikasi lolos. Abaikan `**/node_modules/`, hapus dari index, dan gunakan lockfile + `npm ci`.

### M-10 — Coverage test keamanan sangat minim

Ada test auth AI, tetapi tidak ada test untuk SSRF helper, route upload authorization, stored-XSS/MIME, revokasi sesi, rate-limit proxy header, MCP body/session limit, atau attendance forgery. Tambahkan unit/integration adversarial tests dan dependency audit di CI.

## Temuan rendah

### L-01 — `trustHost: true` aktif tanpa syarat

`src/lib/auth.ts:23` mempercayai Host header. Dengan Credentials-only dampaknya lebih rendah, tetapi proxy yang salah konfigurasi dapat memicu host-header poisoning pada URL/redirect auth. Validasi trusted host di edge atau aktifkan hanya saat deployment membutuhkannya.

### L-02 — Cron memakai GET untuk side effect dan perbandingan secret biasa

Endpoint cron mengubah state melalui GET dan membandingkan `Authorization` dengan equality biasa. Gunakan POST, constant-time comparison, secret khusus per job/rotation, idempotency/lock, dan audit run.

### L-03 — Error internal sering diteruskan ke client

Beberapa route mengembalikan `err.message` sebagai response 500. Ini dapat membocorkan detail provider, path, atau state internal. Log detail dengan request ID; kirim pesan generik ke client.

### L-04 — File sanitizer berisi byte NUL literal dan sanitasi URL ad-hoc

`src/lib/security/sanitize-html.ts` mengandung byte NUL literal dalam regex, sehingga dianggap binary oleh tooling. Sanitasi URL berbasis prefix juga lebih rapuh dibanding allowlist protokol/atribut yang teruji. Ganti byte dengan escape, tambahkan test bypass/entity, dan pertimbangkan sanitizer terawat setelah dependency dipatch.

## Hal yang sudah baik

- `.env` di-ignore dan tidak dilacak Git; `.env.example` tidak berisi secret nyata yang terdeteksi.
- API route utama umumnya memiliki autentikasi eksplisit; inventory scan hanya menemukan `app-branding` tanpa auth, yang tampak memang public-read.
- Banyak server action memiliki role check dan room membership/phase scoping.
- AI bearer dibandingkan constant-time dan role default API utama sekarang fail-closed.
- Finance attachment memakai signature sniffing dan storage privat.
- Route download berbasis ID untuk task/room/finance umumnya memeriksa membership/role.
- HTML laporan yang memakai `dangerouslySetInnerHTML` melakukan escape sebelum formatting.
- Helper SSRF sudah memeriksa protokol dan redirect; implementasinya perlu diperkeras, bukan dibuat dari nol.

## Urutan perbaikan yang disarankan

### P0 — segera

1. MCP fail-closed + network restriction + rotasi token bila perlu.
2. Upgrade Next.js 16.2.10 dan dependency security patch yang non-major.
3. Private upload gateway; blok SVG/konten aktif; hentikan akses publik langsung.
4. Session revocation/versioning untuk password, role, delete/disable.

### P1 — setelah P0 stabil

5. SSRF-safe fetch untuk visual + Web Push endpoint hardening.
6. Upload limits/quota/streaming/signature/malware scan.
7. Attendance verification server-side dan input bounds.
8. MCP body/session/concurrency/timeout limit.
9. Shared rate-limit trusted-proxy.
10. MFA/step-up auth untuk privileged role.

### P2 — hardening

11. CSP dan security headers lanjutan.
12. Encryption/retention/audit untuk biometrik dan backup.
13. Security event logging, alerting, dan per-token scopes.
14. Bersihkan nested node_modules dari Git.
15. Security regression suite + audit dependency di CI.

## Patch pertama yang direkomendasikan

Mulai dari patch kecil dan berisiko rendah: **upgrade Next.js 16.2.4 → 16.2.10, selaraskan `eslint-config-next`, jalankan test/build, lalu verifikasi semua layout role**. Setelah itu lanjutkan patch terbesar: private upload delivery + blok konten aktif.
