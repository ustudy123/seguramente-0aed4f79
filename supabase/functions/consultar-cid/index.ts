import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { codigo } = await req.json()
    
    if (!codigo) {
      return new Response(JSON.stringify({ error: 'Código CID é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cleanCodigo = codigo.toUpperCase().replace('.', '')
    
    // Mapeamento de grupos CID-10 comuns para grupos clínicos do sistema
    // Isso é uma simplificação baseada nos capítulos do CID-10
    const chapterMap: Record<string, string> = {
      'A': 'infeccioso', 'B': 'infeccioso',
      'C': 'oncologico', 'D': 'oncologico', // D00-D48 são neoplasias, D50-D89 são sangue (usamos oncologico/outro)
      'E': 'endocrino',
      'F': 'mental',
      'G': 'neurologico',
      'H': 'outro', // Olho e ouvido
      'I': 'cardiovascular',
      'J': 'respiratorio',
      'K': 'digestivo',
      'L': 'dermatologico',
      'M': 'osteomuscular',
      'N': 'outro', // Sistema geniturinário
      'O': 'outro', // Gravidez
      'P': 'outro', // Período perinatal
      'Q': 'outro', // Malformações
      'R': 'outro', // Sintomas não classificados
      'S': 'outro', // Lesões
      'T': 'outro', // Envenenamento
      'V': 'outro', 'W': 'outro', 'X': 'outro', 'Y': 'outro', // Causas externas
      'Z': 'outro', // Fatores que influenciam o estado de saúde
    }

    const firstChar = cleanCodigo[0]
    const grupo_clinico = chapterMap[firstChar] || 'outro'

    // Em um cenário real, poderíamos consultar uma API externa ou banco de dados CID-10
    // Aqui retornamos o grupo clínico mapeado
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { 
          descricao: `CID ${codigo}`, 
          grupo_clinico 
        } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
