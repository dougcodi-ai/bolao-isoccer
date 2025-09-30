import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: NextRequest) {
  try {

    // Buscar todos os campeonatos únicos dos bolões
    const { data: championshipsData, error } = await supabase
      .from("pools")
      .select("championship")
      .not("championship", "is", null)
      .not("championship", "eq", "");

    if (error) {
      console.error("Erro ao buscar campeonatos:", error);
      return NextResponse.json(
        { error: "Erro ao buscar campeonatos" },
        { status: 500 }
      );
    }

    // Agrupar e contar bolões por campeonato
    const championshipCounts = (championshipsData || []).reduce((acc, item) => {
      const championship = item.championship;
      if (championship) {
        acc[championship] = (acc[championship] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Converter para array de objetos
    const championships = Object.entries(championshipCounts).map(([name, count]) => ({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      poolCount: count
    }));

    // Ordenar por nome
    championships.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      championships,
      total: championships.length
    });

  } catch (error) {
    console.error("Erro interno:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}