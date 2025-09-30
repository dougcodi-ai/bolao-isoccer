/*
 Pipeline de upload de logos de times para Supabase Storage (bucket: team-logos)
 - Busca times em football_teams
 - (Opcional) Lê um mapa local de URLs em src/data/teamLogoMap.json
 - Faz download da logo (se houver) ou usa um SVG genérico
 - Envia para o caminho clubs/{slug}.{ext}
 - Atualiza football_teams.logo_path com o caminho final
*/

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

// Carrega .env raiz
dotenv.config({ path: path.resolve(__dirname, "../.env") });
// Carrega apps/web/.env.local (se existir)
const webEnvLocal = path.resolve(__dirname, "../apps/web/.env.local");
if (fs.existsSync(webEnvLocal)) {
  try {
    const parsed = dotenv.parse(fs.readFileSync(webEnvLocal));
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch { /* ignore */ }
}

function slugify(input) {
  return String(input || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function detectContentType(url, fallback) {
  const ext = (url.split("?")[0].split("#")[0].split(".").pop() || "").toLowerCase();
  if (ext === "svg") return "image/svg+xml";
  if (["png"].includes(ext)) return "image/png";
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (["webp"].includes(ext)) return "image/webp";
  return fallback || "application/octet-stream";
}

const fallbackSvg = Buffer.from(
  "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 120 120'><rect width='120' height='120' rx='16' fill='#E5E7EB'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='28' fill='#4B5563'>FC</text></svg>",
  "utf8"
);

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;
  if (!supabaseUrl || !serviceKey) {
    console.error("[logos] ERRO: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (em apps/web/.env.local)");
    process.exit(1);
  }
  const sb = createClient(supabaseUrl, serviceKey);

  // Confirma bucket
  const bucketName = "team-logos";
  const bucket = await sb.storage.getBucket(bucketName);
  if (!bucket.data) {
    const created = await sb.storage.createBucket(bucketName, { public: true });
    if (created.error) {
      console.error("[logos] Não foi possível criar bucket:", created.error.message);
      process.exit(1);
    }
  }

  // Carrega teams
  const { data: teams, error: teamErr } = await sb
    .from("football_teams")
    .select("id, name, short_name, acronym, logo_path, ext_provider, ext_id")
    .order("name");
  if (teamErr) throw teamErr;

  // Carrega mapping opcional
  let logoMap = {};
  const mapPath = path.resolve(__dirname, "./data/teamLogoMap.json");
  if (fs.existsSync(mapPath)) {
    try { logoMap = JSON.parse(fs.readFileSync(mapPath, "utf8")); } catch { logoMap = {}; }
  }

  let uploaded = 0, updated = 0, failed = 0, fallbackCount = 0;

  for (const t of teams || []) {
    const keyAcr = (t.acronym || "").toUpperCase();
    const keyName = (t.name || "").toUpperCase();
    const mapEntry = logoMap[keyAcr] || logoMap[keyName] || null;

    const slug = keyAcr ? keyAcr.toLowerCase() : slugify(t.name || t.short_name || t.ext_id || t.id);

    let fileBuffer = null;
    let contentType = "image/svg+xml";
    let ext = "svg";

    if (mapEntry && typeof mapEntry === "string") {
      try {
        const resp = await axios.get(mapEntry, { responseType: "arraybuffer", timeout: 15000 });
        fileBuffer = Buffer.from(resp.data);
        contentType = resp.headers["content-type"] || detectContentType(mapEntry, "application/octet-stream");
        // Ajusta extensão pela contentType
        if (contentType.includes("svg")) ext = "svg";
        else if (contentType.includes("png")) ext = "png";
        else if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
        else if (contentType.includes("webp")) ext = "webp";
      } catch (e) {
        console.warn(`[logos] Falha ao baixar logo para ${t.name} (${mapEntry}):`, e?.message || e);
        fileBuffer = null;
      }
    }

    if (!fileBuffer) {
      // usa fallback
      fileBuffer = fallbackSvg;
      contentType = "image/svg+xml";
      ext = "svg";
      fallbackCount++;
    }

    const objectPath = `clubs/${slug}.${ext}`;
    const uploadRes = await sb.storage.from(bucketName).upload(objectPath, fileBuffer, {
      upsert: true,
      contentType,
      cacheControl: "604800", // 7 dias
    });
    if (uploadRes.error) {
      console.error(`[logos] Upload falhou para ${t.name}:`, uploadRes.error.message);
      failed++;
      continue;
    }
    uploaded++;

    // Atualiza logo_path
    const { error: updErr } = await sb
      .from("football_teams")
      .update({ logo_path: objectPath })
      .eq("id", t.id);
    if (updErr) {
      console.warn(`[logos] Atualização de logo_path falhou para ${t.name}:`, updErr.message);
    } else {
      updated++;
    }
  }

  console.log(JSON.stringify({ ok: true, uploaded, updated, failed, used_fallback: fallbackCount }, null, 2));
}

main().catch((e) => {
  console.error("[logos] Erro inesperado:", e?.message || e);
  process.exit(1);
});