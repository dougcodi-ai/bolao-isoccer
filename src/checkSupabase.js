import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const url = process.env.SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY

if (!url || !anon) {
  console.error('Erro: defina SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env')
  process.exit(1)
}

const supabase = createClient(url, anon)

async function checkHttpReachability() {
  const restUrl = `${url.replace(/\/$/, '')}/rest/v1/`
  try {
    const res = await axios.head(restUrl, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      timeout: 8000,
      validateStatus: () => true, // consider any HTTP response as reachable
    })
    return { ok: true, status: res.status }
  } catch (e) {
    return { ok: false, error: e?.code || e?.message || String(e) }
  }
}

async function main() {
  try {
    const http = await checkHttpReachability()
    if (!http.ok) {
      console.error('Falha de conectividade HTTP com Supabase:', http.error)
      process.exit(1)
    }

    // Opcional: toca o cliente para confirmar import/configuração válida (não garante tabelas/políticas)
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.warn('Aviso: erro ao obter sessão anônima (pode ser esperado):', error.message)
    }

    console.log(`Conectividade HTTP OK (status ${http.status}). Supabase acessível.`)
    console.log('Projeto ISoccer pronto para prosseguir.')
  } catch (e) {
    console.error('Erro inesperado na verificação:', e?.message || e)
    process.exit(1)
  }
}

main()