# Por que vinham 10 fatores — e o que ainda precisa ser corrigido

## A explicação

O catálogo tem 13 fatores (NR-01 / ISO 45003), mas o inventário nunca partia do catálogo: ele era montado **a partir das dimensões do questionário aplicado** e depois cada dimensão era traduzida para um fator do catálogo. Isso reduz a contagem por dois caminhos:

1. **Agrupamento (várias dimensões → 1 fator).** No COPSOQ II-Br, "Reconhecimento" e "Satisfação no Trabalho" caem ambas em "Baixas recompensas e reconhecimento"; "Sinais Precoces de Saúde" e "Burnout" caem ambas em "Eventos violentos ou traumáticos". 13 dimensões viram 11 fatores distintos.
2. **Ausência (fator sem nenhuma dimensão).** Nenhum instrumento cobre todos os 13. Verificado nos instrumentos do projeto:
   - COPSOQ II-Br (13 dimensões): 11 fatores distintos; faltam "Más relações no ambiente de trabalho" e "Trabalho em condições de difícil comunicação".
   - COPSOQ III (15 dimensões): 9 fatores distintos; faltam "Más relações", "Baixa justiça organizacional", "Trabalho remoto e isolado" e "Difícil comunicação".
   - SIPRO (10 dimensões): 8 fatores distintos.

Combinando os dois efeitos, a campanha da CRT chegou a 10 linhas. O ajuste já feito resolve o item 2: o inventário agora sempre lista os 13 e marca como "Não avaliado" os sem cobertura no instrumento.

## O problema que sobrou

O `resolverFatorPorSubject` faz match por alias com busca "contains", e isso está produzindo associações erradas (confirmado ao rodar o mapeamento):

```text
Burnout                        => Eventos violentos ou traumáticos   (errado)
Sinais Precoces de Saúde       => Eventos violentos ou traumáticos   (errado)
Recuperação e Equilíbrio       => Trabalho remoto e isolado          (errado)
Equilíbrio Trabalho-Vida       => Trabalho remoto e isolado          (errado)
Sentido do Trabalho            => Baixa demanda (subcarga)           (discutível)
Equilíbrio Trabalho–Vida (III) => SEM MATCH
```

Efeito prático: o score de "Eventos violentos" hoje carrega respostas de burnout/saúde, e "Trabalho remoto e isolado" carrega respostas de equilíbrio trabalho-vida. Os números saem no fator errado.

## O que fazer

1. Ajustar os aliases do catálogo em `src/data/catalogoRiscosPsicossociais.ts` para que as dimensões de burnout/saúde e de equilíbrio trabalho-vida caiam nos fatores corretos (sobrecarga / falta de recuperação), e não em violência ou trabalho remoto.
2. Endurecer o `resolverFatorPorSubject`: match exato e por alias exato primeiro; o "contains" só como último recurso e exigindo alias com tamanho mínimo, evitando casamentos por fragmento.
3. Criar um teste em `src/test/` que percorre SIPRO, COPSOQ II-Br, COPSOQ III, HSE e PROART e asserta o fator resolvido de cada dimensão — trava o mapeamento contra regressões.
4. Sem mudanças de banco. O PDF já lida com "Não avaliado"; apenas os fatores destino de cada dimensão mudam.
