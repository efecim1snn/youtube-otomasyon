/*
 * shorts-kes.cjs — bitmis uzun videodan dikey (9:16) Shorts keser.
 * Teknik: bulanik arka plan + ortada tam 16:9 kare (gomulu altyazilar korunur).
 *
 * Kullanim: node shorts-kes.cjs <is-slug> <kesitler.json>
 * kesitler.json: [{ "ad": "giyotin", "bas": 12.5, "sure": 52 }, ...]   (saniye)
 * Cikti: uretim/<is>/Shorts/01-<ad>.mp4 ...
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const FF = require('./ff-yol').ffmpeg;

const [, , JOB, KESIT_DOSYA] = process.argv;
if (!JOB || !KESIT_DOSYA) { console.error('kullanim: node shorts-kes.cjs <is> <kesitler.json>'); process.exit(1); }

const BASE = path.join(__dirname, 'uretim', JOB);
const KAYNAK = path.join(BASE, 'Videos', JOB + '.mp4');
const CIKTI = path.join(BASE, 'Shorts');
if (!fs.existsSync(KAYNAK)) { console.error('kaynak video yok: ' + KAYNAK); process.exit(1); }
fs.mkdirSync(CIKTI, { recursive: true });

const kesitler = JSON.parse(fs.readFileSync(KESIT_DOSYA, 'utf8'));
const FILTRE =
  '[0:v]split=2[bg][fg];' +
  '[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:12,eq=brightness=-0.18:saturation=0.85[bgb];' +
  '[fg]scale=1080:-2[fgs];' +
  '[bgb][fgs]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]';

kesitler.forEach((k, i) => {
  const ad = String(i + 1).padStart(2, '0') + '-' + k.ad.replace(/[^a-z0-9-]/gi, '-').toLowerCase() + '.mp4';
  const hedef = path.join(CIKTI, ad);
  const sure = Number(k.sure);
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', String(k.bas), '-t', String(sure), '-i', KAYNAK,
    '-filter_complex', FILTRE +
      `;[v]fade=t=in:st=0:d=0.3,fade=t=out:st=${(sure - 0.4).toFixed(2)}:d=0.4[vo]`,
    '-map', '[vo]', '-map', '0:a',
    '-af', `afade=t=in:st=0:d=0.3,afade=t=out:st=${(sure - 0.4).toFixed(2)}:d=0.4`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
    hedef,
  ];
  process.stdout.write(`[${i + 1}/${kesitler.length}] ${ad} (${k.bas}s + ${sure}s) ... `);
  execFileSync(FF, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  const mb = (fs.statSync(hedef).size / 1048576).toFixed(1);
  console.log(`tamam, ${mb} MB`);
});
console.log('\nShorts klasoru: ' + CIKTI);
