const mods = {
  SIPRO: await import('/dev-server/src/data/instrumentos/sipro.ts'),
  COPSOQ: await import('/dev-server/src/data/instrumentos/copsoq.ts'),
  HSE: await import('/dev-server/src/data/instrumentos/hse.ts'),
  PROART: await import('/dev-server/src/data/instrumentos/proart.ts'),
};

const POS = /\b(autonomia|consigo|posso|tenho|orgulho|reconhe|justa|justi|claro|clareza|sei exatamente|expectativ|sentido|significado|apoio|ajuda|colabora|respeit|valoriz|recompens|coopera|confian|bem.estar|equilíbrio|satisfa|aprender|crescer|desenvolv|opinar|participar|liberdade|flexib|reconhecid|valorizad|escutad|ouvido|acolh|coerência|treinamento|capacita|recurs|equipament|conforto|gostaria de continuar)\b/i;
const NEG = /\b(sobrecarrega|exced|cansa|esgot|estress|press[aã]o|conflito|contradit|rude|grosseir|inadequad|insuficien|falta|excessiv|preocupa|medo|ansied|injusta|injusti|assédi|discrim|hostil|abus|humilha|interrup|risco|perig|constrangedora?|desgastant|sofr|ameaç|monóton|repetit|tédi|insatisf)\b/i;

function walk(name, mod) {
  const inst = mod.default || Object.values(mod).find(v=>v && (v.dimensoes||v.fatores));
  if (!inst) { console.log(name,'sem default'); return; }
  const dims = inst.dimensoes || inst.fatores || [];
  const issues = [];
  for (const d of dims) {
    const perguntas = d.perguntas || d.itens || [];
    for (const p of perguntas) {
      const t = p.texto || p.pergunta || '';
      const inv = !!p.invertida;
      const pos = POS.test(t), neg = NEG.test(t);
      if (pos && !neg && !inv) issues.push({type:'POSITIVA sem invertida', d:d.nome||d.id, t});
      if (neg && !pos && inv) issues.push({type:'NEGATIVA marcada invertida', d:d.nome||d.id, t});
    }
  }
  console.log('\n===',name,'=== suspeitos:', issues.length);
  issues.slice(0,40).forEach(i=>console.log(' ['+i.type+']', '['+i.d+']', i.t.slice(0,100)));
}
for (const [n,m] of Object.entries(mods)) walk(n,m);
