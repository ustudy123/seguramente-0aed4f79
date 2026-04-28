import sipro from '/dev-server/src/data/instrumentos/sipro.ts';
import copsoq from '/dev-server/src/data/instrumentos/copsoq.ts';
import hse from '/dev-server/src/data/instrumentos/hse.ts';
import proart from '/dev-server/src/data/instrumentos/proart.ts';

// Heurística: palavras positivas indicam pergunta protetora (Sempre = bom)
const POS = /\b(autonomia|consigo|posso|tenho|orgulho|reconhe|justa|justi|claro|clareza|sei exatamente|expectativ|sentido|significado|apoio|ajuda|colabora|respeit|valoriz|recompens|coopera|confian|seguran[çc]a (psicol|do)|bem.estar|equilíbrio|satisfa|aprender|crescer|desenvolv|opinar|participar|liberdade|flexib|reconhecid|valorizad|escutad|ouvido|acolh|trat[ao] de forma justa|justa no trabalho|coerência|treinamento|capacita|recurs|equipament|conforto|gostaria de continuar|orgulho|sinto.que|me.sinto.bem)\b/i;
const NEG = /\b(sobrecarrega|exced|cansa|esgot|estress|press[aã]o|conflito|contradit|rude|grosseir|inadequad|insuficien|falta|sem ter|n[aã]o (tenho|posso|consigo|sei)|excessiv|preocupa|medo|ansied|dor|injusta|injusti|assédi|discrim|hostil|abus|humilha|sobre.tempo|fora do hor[aá]rio|interrup|exposto|risco|perig|constrangedora?|desgastant|sofr|ameaç|monóton|repetit|tédi|insatisf|cobran[çc]a excessiv)\b/i;

function audit(name, mod) {
  const inst = mod.default || mod[Object.keys(mod)[0]] || mod;
  const dims = inst.dimensoes || inst.fatores || (Array.isArray(inst)?inst:[]);
  let issues = [];
  for (const d of dims) {
    const perguntas = d.perguntas || d.itens || [];
    for (const p of perguntas) {
      const t = p.texto || p.pergunta || '';
      const inv = !!p.invertida;
      const pos = POS.test(t);
      const neg = NEG.test(t);
      // suspeito se positiva mas não invertida, ou negativa mas invertida
      if (pos && !neg && !inv) issues.push({d:d.nome||d.dimensao||d.id, t, expected:'invertida=true (positiva)', atual:inv});
      if (neg && !pos && inv) issues.push({d:d.nome||d.dimensao||d.id, t, expected:'invertida=false (negativa)', atual:inv});
    }
  }
  console.log('\n===',name,'=== Total suspeitos:', issues.length);
  issues.slice(0,30).forEach(i=>console.log(' [', i.d, ']', i.t.slice(0,90), '| esperado:', i.expected));
}

audit('SIPRO', await import('/dev-server/src/data/instrumentos/sipro.ts'));
audit('COPSOQ', await import('/dev-server/src/data/instrumentos/copsoq.ts'));
audit('HSE', await import('/dev-server/src/data/instrumentos/hse.ts'));
audit('PROART', await import('/dev-server/src/data/instrumentos/proart.ts'));
