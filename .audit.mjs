const s = await import('/dev-server/src/data/instrumentos/sipro.ts');
const c = await import('/dev-server/src/data/instrumentos/copsoq.ts');
const h = await import('/dev-server/src/data/instrumentos/hse.ts');
const p = await import('/dev-server/src/data/instrumentos/proart.ts');
const all = { SIPRO: s.SIPRO_DIMENSOES, COPSOQ: c.COPSOQ_DIMENSOES, HSE: h.HSE_DIMENSOES, PROART: p.PROART_DIMENSOES };

const POS = /\b(autonomia|consigo|posso|tenho|orgulho|reconhe|justa|justi|claro|clareza|sei exatamente|expectativ|sentido|significado|apoio|ajuda|colabora|respeit|valoriz|recompens|coopera|confian|bem.estar|equilíbrio|satisfa|aprender|crescer|desenvolv|opinar|participar|liberdade|flexib|reconhecid|valorizad|escutad|ouvido|acolh|coerência|treinamento|capacita|recurs|equipament|conforto|gostaria de continuar|me sinto bem|sinto.me bem|gosto|prazer|orgulhoso)\b/i;
const NEG = /\b(sobrecarrega|exced|cansa|esgot|estress|press[aã]o|conflito|contradit|rude|grosseir|inadequad|insuficien|excessiv|preocupa|medo|ansied|injusta|injusti|assédi|discrim|hostil|abus|humilha|interrup|risco|perig|constrangedora?|desgastant|sofr|ameaç|monóton|repetit|tédi|insatisf|n[aã]o (tenho|posso|consigo|sei|recebo))\b/i;

for (const [name, dims] of Object.entries(all)) {
  const issues = [];
  for (const d of dims) {
    for (const p of (d.perguntas||[])) {
      const t = p.texto || '';
      const inv = !!p.invertida;
      const pos = POS.test(t), neg = NEG.test(t);
      if (pos && !neg && !inv) issues.push(['POS sem inv', d.nome, t]);
      if (neg && !pos && inv)  issues.push(['NEG com inv', d.nome, t]);
    }
  }
  console.log('\n===', name, 'tipo dim, total suspeitos:', issues.length, '===');
  issues.forEach(i=>console.log('  ['+i[0]+']', '['+i[1]+']', i[2].slice(0,110)));
}
