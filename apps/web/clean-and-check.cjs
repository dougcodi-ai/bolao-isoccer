const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function cleanAndCheck() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;
  
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    console.log('=== LIMPANDO DADOS ANTIGOS ===');
    
    // Deletar todas as partidas primeiro (devido às foreign keys)
    const { error: matchesDeleteError } = await supabase
      .from('football_matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (matchesDeleteError) {
      console.error('Error deleting matches:', matchesDeleteError);
      return;
    }
    console.log('✓ Partidas deletadas');

    // Deletar todos os times
    const { error: teamsDeleteError } = await supabase
      .from('football_teams')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (teamsDeleteError) {
      console.error('Error deleting teams:', teamsDeleteError);
      return;
    }
    console.log('✓ Times deletados');

    // Deletar todas as temporadas
    const { error: seasonsDeleteError } = await supabase
      .from('football_seasons')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (seasonsDeleteError) {
      console.error('Error deleting seasons:', seasonsDeleteError);
      return;
    }
    console.log('✓ Temporadas deletadas');

    // Deletar todas as competições
    const { error: competitionsDeleteError } = await supabase
      .from('football_competitions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (competitionsDeleteError) {
      console.error('Error deleting competitions:', competitionsDeleteError);
      return;
    }
    console.log('✓ Competições deletadas');

    console.log('\n=== DADOS LIMPOS COM SUCESSO ===');
    console.log('Agora execute o seed novamente para inserir apenas os dados corretos.');

  } catch (error) {
    console.error('Error:', error);
  }
}

cleanAndCheck();