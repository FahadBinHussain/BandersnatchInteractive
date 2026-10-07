#!/usr/bin/env node
// save-dump.js — read the real Bandersnatch save straight out of Edge/Chrome's
// localStorage leveldb, no devtools paste. writes the same flat {key: value} JSON
// that route-planner.js consumes.
//
//   node tools/save-dump.js <out.json> [leveldb-dir]
//
// leveldb-dir defaults to Edge's Default profile:
//   %LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Local Storage\leveldb
//
// gotchas baked in here (they cost an hour once, do not re-learn them):
// - .ldb blocks are snappy-compressed and end with a restart trailer:
//   u32 offsets[] + u32 count — parse entries only before it, the trailer reads
//   as zero-length "entries" otherwise ("varint eof").
// - chromium keys are  `_origin\x00\x01<name>\x01<meta>`, values are `\x01<payload>`.
// - the live profile is locked: copy the dir to a temp dir first.
// - newer records win: process files in ascending number order (log interleaves
//   correctly by number), fragment-assemble multi-part WAL records.

const fs = require('fs'), path = require('path'), os = require('os');

const outArg = process.argv[2];
const levelDir = process.argv[3] ||
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data', 'Default', 'Local Storage', 'leveldb');
if (!outArg) { console.error('usage: node tools/save-dump.js <out.json> [leveldb-dir]'); process.exit(1); }
if (!fs.existsSync(levelDir)) { console.error('leveldb dir not found: ' + levelDir + '\n(start Edge with this profile, or pass the dir explicitly)'); process.exit(1); }

// ---------- snappy ----------
function unvarint(b, pos) {
  let x = 0, s = 0;
  while (pos < b.length) { const c = b[pos++]; x |= (c & 0x7f) << s; if (!(c & 0x80)) return [x, pos]; s += 7; if (s > 35) throw new Error('varint too long'); }
  throw new Error('varint eof');
}
function snappy(src) {
  const [ulen, p0] = unvarint(src, 0);
  const out = Buffer.alloc(ulen);
  let ip = p0, op = 0;
  while (ip < src.length && op < ulen) {
    const t = src[ip++], type = t & 3;
    if (type === 0) {
      let n = t >> 2;
      if (n < 60) n++;
      else { const extra = n - 59; let len = 0; for (let i = 0; i < extra; i++) len |= src[ip++] << (8 * i); n = len + 1; }
      if (ip + n > src.length) throw new Error('literal overrun');
      src.copy(out, op, ip, ip + n); ip += n; op += n;
    } else {
      let len, off;
      if (type === 1) { len = 4 + ((t >> 2) & 7); off = ((t >> 5) << 8) | src[ip++]; }
      else if (type === 2) { len = (t >> 2) + 1; off = src[ip] | (src[ip + 1] << 8); ip += 2; }
      else { len = (t >> 2) + 1; off = src[ip] | (src[ip + 1] << 8) | (src[ip + 2] << 16) | (src[ip + 3] << 24); ip += 4; }
      if (off > op) throw new Error('copy offset before start');
      for (let i = 0; i < len; i++) out[op + i] = out[op - off + i];
      op += len;
    }
  }
  if (op !== ulen) throw new Error('snappy length mismatch');
  return out;
}
const MAGIC = 0xdb4775248b80fb57n;

// ---------- block / table / log ----------
function parseBlock(block, out) {
  if (block.length < 8) return;
  const nRestart = block.readUInt32LE(block.length - 4);
  const bodyEnd = nRestart > 0 && 4 + 4 * nRestart <= block.length ? block.length - (4 + 4 * nRestart) : block.length;
  let pos = 0, key = Buffer.alloc(0);
  while (pos < bodyEnd) {
    let sh, ns, vl;
    [sh, pos] = unvarint(block, pos); [ns, pos] = unvarint(block, pos); [vl, pos] = unvarint(block, pos);
    key = Buffer.concat([key.slice(0, sh), block.slice(pos, pos + ns)]); pos += ns;
    out.push({ key, val: block.slice(pos, pos + vl) }); pos += vl;
  }
}
function readTable(file, recs) {
  const b = fs.readFileSync(file);
  if (b.length < 48 || b.readBigUInt64LE(b.length - 8) !== MAGIC) return;
  let p = b.length - 48, off, size, io, isz;
  [off, p] = unvarint(b, p); [size, p] = unvarint(b, p); [io, p] = unvarint(b, p); [isz, p] = unvarint(b, p);
  const idx = snappy(b.slice(io, io + isz));
  const entries = []; parseBlock(idx, entries);
  for (const e of entries) {
    if (!e.val.length) continue;
    let hp = 0, bo, bs;
    [bo, hp] = unvarint(e.val, hp); [bs, hp] = unvarint(e.val, hp);
    const block = snappy(b.slice(bo, bo + bs));
    const rows = []; parseBlock(block, rows);
    for (const r of rows) recs.set(r.key.toString('utf8'), r.val.length ? r.val.toString('utf8') : null);
  }
}
function readLog(file, recs) {
  const b = fs.readFileSync(file);
  let pos = 0, frag = null;
  while (pos + 7 <= b.length) {
    const len = b.readUInt16LE(pos + 4), type = b[pos + 6];
    if (type < 1 || type > 4 || pos + 7 + len > b.length) break;
    const rec = b.slice(pos + 7, pos + 7 + len);
    pos += 7 + len;
    if (type === 2 || type === 3) { if (frag) frag.push(rec); continue; }      // FIRST/MIDDLE
    const parts = type === 4 && frag ? frag.concat([rec]) : [rec];             // LAST / FULL
    frag = null;
    const full = Buffer.concat(parts);
    try {
      let p = 0, klen, vlen;
      [klen, p] = unvarint(full, p);
      const k = full.slice(p, p + klen); p += klen;
      [vlen, p] = unvarint(full, p);
      const v = full.slice(p, p + vlen);
      recs.set(k.toString('utf8'), v.length ? v.toString('utf8') : null);
    } catch { /* torn tail record — ignore */ }
  }
}

// ---------- run ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lsdump-'));
try {
  for (const f of fs.readdirSync(levelDir)) {
    try { fs.copyFileSync(path.join(levelDir, f), path.join(tmp, f)); } catch { /* lock-protected sidecars */ }
  }
  const recs = new Map();
  const files = fs.readdirSync(tmp).filter(f => /\.(ldb|log)$/.test(f)).sort();
  for (const f of files) {
    const fp = path.join(tmp, f);
    try { f.endsWith('.ldb') ? readTable(fp, recs) : readLog(fp, recs); }
    catch (e) { console.error('warn: ' + f + ': ' + e.message); }
  }
  // flatten chromium's `_origin\x00\x01<name>\x01<meta>` keys, drop deleted
  const PREFIX = '_http://127.0.0.1:8000\x00\x01';
  const out = {};
  let n = 0;
  for (const [k, v] of recs) {
    if (v === null) continue;
    if (!k.startsWith(PREFIX)) continue;
    const m = k.slice(PREFIX.length).match(/^([^\x01]+)\x01/);
    if (!m) continue;
    out[m[1]] = v.startsWith('\x01') ? v.slice(1) : v;
    n++;
  }
  if (!n) { console.error('no records for http://127.0.0.1:8000 found in ' + levelDir + ' — is this the profile with the save?'); process.exit(1); }
  fs.mkdirSync(path.dirname(path.resolve(outArg)), { recursive: true });
  fs.writeFileSync(outArg, JSON.stringify(out, null, 1));
  const bc = Object.keys(out).filter(k => k.startsWith('breadcrumb_')).length;
  console.log('wrote ' + outArg + ': ' + Object.keys(out).length + ' keys, ' + bc + ' breadcrumbs');
} finally {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}
