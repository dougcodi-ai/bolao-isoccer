import { NextRequest, NextResponse } from "next/server";
import { COMPETITION_CODE, SEASON_YEAR, TEAMS, MATCHES, STANDINGS } from "./data/br-2025";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/api\/mock\/football\/?/, "");

  // Simple router for mock endpoints
  // /competitions/BRA-1/seasons/2025/teams
  // /competitions/BRA-1/seasons/2025/matches?matchdayFrom=1&matchdayTo=2
  // /competitions/BRA-1/seasons/2025/standings

  const parts = path.split("/").filter(Boolean);
  if (parts.length < 5 || parts[0] !== "competitions" || parts[2] !== "seasons") {
    return NextResponse.json({ error: "Invalid mock path" }, { status: 404 });
  }
  const competitionId = decodeURIComponent(parts[1]);
  const seasonId = decodeURIComponent(parts[3]);
  const resource = parts[4];

  if (competitionId !== COMPETITION_CODE || seasonId !== String(SEASON_YEAR)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  switch (resource) {
    case "teams": {
      return NextResponse.json({ teams: TEAMS });
    }
    case "matches": {
      const from = Number(url.searchParams.get("matchdayFrom")) || undefined;
      const to = Number(url.searchParams.get("matchdayTo")) || undefined;
      let result = MATCHES;
      if (from !== undefined) result = result.filter((m) => (m.matchday ?? 0) >= from);
      if (to !== undefined) result = result.filter((m) => (m.matchday ?? 0) <= to);
      return NextResponse.json({ matches: result });
    }
    case "standings": {
      return NextResponse.json({ standings: STANDINGS });
    }
    default:
      return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  }
}