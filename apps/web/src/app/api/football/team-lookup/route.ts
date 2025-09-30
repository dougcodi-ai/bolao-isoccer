import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ ok: false, error: "Missing q" }, { status: 400 });

    const key = q.toUpperCase();

    // 1) Tenta buscar no banco (provider/BD) primeiro
    let foundUrl: string | null = null;
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
      if (supabaseUrl && anonKey) {
        const sb = createClient(supabaseUrl, anonKey);
        const { data: rows } = await sb
          .from("football_teams")
          .select("acronym, name, short_name, logo_path")
          .or(`acronym.ilike.%${q}%,name.ilike.%${q}%,short_name.ilike.%${q}%`)
          .limit(1);
        const r = rows?.[0];
        if (r?.logo_path) {
          const pub = sb.storage.from("team-logos").getPublicUrl(r.logo_path);
          foundUrl = pub.data?.publicUrl || null;
        }
      }
    } catch {
      // Ignora e tenta fallback
    }

    // 2) Se não achou no BD, tenta mapa local (fallback)
    if (!foundUrl) {
      let map: Record<string, string> = {};
      try {
        const mapPaths = [
          path.resolve(process.cwd(), "src/data/teamLogoMap.json"),
          path.resolve(process.cwd(), "../../src/data/teamLogoMap.json"),
        ];
        for (const p of mapPaths) {
          if (fs.existsSync(p)) {
            try {
              const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
              map = { ...map, ...parsed };
            } catch {
              // ignora arquivo malformado
            }
          }
        }
      } catch {
        // ignora leitura do mapa
      }
      const mapped = map[key] || "";
      if (mapped) {
        foundUrl = mapped;
      }
    }

    return NextResponse.json({ ok: true, logoUrl: foundUrl || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}