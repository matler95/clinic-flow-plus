#!/usr/bin/env node
// Recreates the POC pilot environment: org "Gabinet Pilotażowy (POC)", 3 accounts
// (admin doctor, second doctor, reception), a drop link and a SYNTHETIC panoramic image
// (generated here — contains no patient data).
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//   SEED_PASSWORD='<min 12 chars>' APP_URL=https://app.example.pl node scripts/seed-pilot.mjs
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_PASSWORD, APP_URL = "http://localhost:3000" } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SEED_PASSWORD || SEED_PASSWORD.length < 12) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_PASSWORD (>= 12 chars).");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Synthetic 1200x600 grayscale "pantomogram": arch gradient + tooth-like blobs. No real data. */
function syntheticPano() {
  const W = 1200, H = 600;
  const raw = Buffer.alloc((W + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const nx = (x - W / 2) / (W / 2), ny = (y - H / 2) / (H / 2);
      let v = 40 + 90 * Math.exp(-((ny - 0.1) ** 2) / 0.35) * Math.exp(-(nx ** 2) / 1.2);
      const tooth = Math.abs(Math.sin(x / 22)) > 0.55 && Math.abs(ny + 0.05) < 0.28;
      if (tooth) v += 90;
      v += (Math.random() - 0.5) * 12;
      raw[y * (W + 1) + 1 + x] = Math.max(0, Math.min(255, v | 0));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function ensureUser(email, name) {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = list?.users.find((u) => u.email === email);
  if (found) return found.id;
  const { data, error } = await db.auth.admin.createUser({
    email, password: SEED_PASSWORD, email_confirm: true, user_metadata: { display_name: name },
  });
  if (error) throw error;
  return data.user.id;
}

const admin = await ensureUser("admin.poc@dentalhub.test", "Dr Anna Admin (POC)");
const doc2 = await ensureUser("lekarz.poc@dentalhub.test", "Dr Piotr Współpracownik (POC)");
const recep = await ensureUser("recepcja.poc@dentalhub.test", "Recepcja (POC)");
for (const [id, n] of [[admin, "Dr Anna Admin (POC)"], [doc2, "Dr Piotr Współpracownik (POC)"], [recep, "Recepcja (POC)"]])
  await db.from("profiles").update({ display_name: n }).eq("id", id);

let { data: org } = await db.from("organizations").select("id").eq("name", "Gabinet Pilotażowy (POC)").maybeSingle();
if (!org) {
  const r = await db.from("organizations").insert({ name: "Gabinet Pilotażowy (POC)", kind: "clinic" }).select("id").single();
  if (r.error) throw r.error;
  org = r.data;
}
for (const [uid, role] of [[admin, "admin"], [doc2, "doctor"], [recep, "staff"]])
  await db.from("memberships").upsert({ org_id: org.id, user_id: uid, role, is_active: true }, { onConflict: "org_id,user_id" });

// Drop link addressed to the second doctor (the token is shown once; only its hash is stored)
const token = randomBytes(32).toString("base64url");
await db.from("drop_links").insert({
  org_id: org.id, recipient_user_id: doc2, label: "Pracownia RTG (POC)",
  token_hash: createHash("sha256").update(token).digest("hex"), created_by: admin,
});

// Synthetic pantomogram in the admin doctor's inbox
const path = `${org.id}/${randomUUID()}/${randomUUID()}`;
const bytes = syntheticPano();
const up = await db.storage.from("files").upload(path, bytes, { contentType: "image/png", cacheControl: "no-store" });
if (up.error) throw up.error;
await db.from("items").insert({
  org_id: org.id, recipient_user_id: admin, file_name: "pantomogram-testowy.png", storage_path: path,
  size_bytes: bytes.length, mime_type: "image/png", sender_name: "Generator testowy", note: "Plik syntetyczny, bez danych pacjentów.",
});

console.log("\nPilot environment ready.");
console.log(" admin:      admin.poc@dentalhub.test");
console.log(" lekarz:     lekarz.poc@dentalhub.test");
console.log(" recepcja:   recepcja.poc@dentalhub.test");
console.log(` drop link:  ${APP_URL}/d/${token}   (save it now — it is not stored)`);
