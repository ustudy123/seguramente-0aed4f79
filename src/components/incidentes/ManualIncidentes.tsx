/**
 * Manual do Usuario — Modulo de Incidentes & Acidentes
 * Gerado em PDF via jsPDF.
 * Todos os caracteres especiais substituidos por ASCII puro para compatibilidade
 * com a fonte Helvetica nativa do jsPDF.
 */
import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type RGB = [number, number, number];

const VERMELHO: RGB      = [220, 38,  38];
const VERMELHO_LIGHT: RGB = [254, 226, 226];
const LARANJA: RGB       = [234, 88,  12];
const AMBER: RGB         = [180, 120,  0];
const AZUL: RGB          = [37,  99, 235];
const VERDE: RGB         = [5,  150, 105];
const ROXO: RGB          = [88,  28, 135];
const CINZA: RGB         = [50,  50,  50];
const MUTED: RGB         = [120, 120, 120];
const WHITE: RGB         = [255, 255, 255];

function fill(doc: jsPDF, c: RGB)   { doc.setFillColor(c[0], c[1], c[2]); }
function stroke(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function text(doc: jsPDF, c: RGB)   { doc.setTextColor(c[0], c[1], c[2]); }

// ── Conteudo — SOMENTE ASCII para compatibilidade com Helvetica do jsPDF ──────
const PASSOS = [
  {
    num: "01",
    titulo: "Visao Geral do Modulo de Incidentes & Acidentes",
    subtitulo: "O que e e para que serve",
    cor: VERMELHO,
    paragrafos: [
      'O modulo de Incidentes & Acidentes do Seguramente centraliza o registro, investigacao e gestao de todos os eventos de seguranca da empresa — desde quase-acidentes ate acidentes com afastamento ou obito. Ele foi desenvolvido para apoiar o atendimento a Lei 8.213/91 (CAT), ao e-Social (S-2210/S-2220), a NR-01 (GRO/PGR) e as diretrizes da ISO 45001, reunindo em um so lugar tudo que voce precisa: registro do evento, investigacao de causas, plano de acao e documentacao legal.',
      'O modulo aplica a logica da Piramide de Bird: para cada acidente grave, existem dezenas de incidentes nao registrados que poderiam ter evitado aquele acidente. Ao registrar todos os eventos — inclusive os quase-acidentes — a empresa constroi um banco de dados de aprendizado organizacional que alimenta o PGR e o GRO de SST.',
      'A estrutura do modulo guia voce em um fluxo completo: registro do evento, caracterizacao do ocorrido, investigacao de causas, emissao da CAT (quando aplicavel), vinculacao de plano de acao e acompanhamento da resolucao. Tudo integrado com os modulos de Documentos, Plano de Acao e Ergonomia.',
    ],
    dica: "Principio fundamental: todo incidente registrado e uma oportunidade de evitar o proximo acidente. Culturas de seguranca maduras registram, investigam e aprendem com quase-acidentes antes que eles se tornem acidentes com vitimas.",
  },
  {
    num: "02",
    titulo: "Registro do Evento — Incidente vs Acidente",
    subtitulo: "Como classificar corretamente o evento",
    cor: VERMELHO,
    paragrafos: [
      'O sistema distingue dois tipos de evento: (1) Incidente — evento que ocorreu no trabalho mas nao resultou em lesao, doenca ou morte; inclui quase-acidentes (near miss) e situacoes de risco iminente. (2) Acidente — evento que resultou em lesao, doenca ou morte. A classificacao define quais campos adicionais serao exibidos e quais obrigacoes legais sao ativadas (CAT, e-Social).',
      'Para registrar um evento, clique em "Registrar Evento" no cabecalho. Preencha: (a) Tipo (Incidente ou Acidente); (b) Data e hora do evento; (c) Unidade, setor e local especifico; (d) Turno (1o, 2o, 3o ou Outro); (e) Nome e funcao do colaborador envolvido; (f) Outros envolvidos (se houver); (g) Categoria principal do evento (ex: queda, corte, exposicao quimica); (h) Origem predominante (comportamental, organizacional, tecnica ou ambiental); (i) Descricao detalhada do ocorrido e percepcao inicial de causa.',
      'O sistema gera automaticamente um codigo unico para cada evento (ex: INC-2024-001 ou ACD-2024-001) que serve como referencia em todos os documentos subsequentes. Tambem registra automaticamente o usuario que criou o evento e a data/hora de criacao para fins de auditoria.',
    ],
    dica: "Boas praticas de descricao: seja especifico. Em vez de 'colaborador caiu', escreva 'colaborador escorregou em piso molhado proxximo a maquina X, caindo sobre o joelho direito'. Detalhes sao fundamentais para a investigacao de causa raiz e para a defesa em possiveis acoes trabalhistas.",
  },
  {
    num: "03",
    titulo: "Campos Especificos de Acidente",
    subtitulo: "Gravidade, afastamento, atendimento e CAT",
    cor: LARANJA,
    paragrafos: [
      'Quando o tipo selecionado for Acidente, o sistema exibe campos adicionais obrigatorios: (1) Gravidade da lesao — sem lesao, leve, moderada ou grave; (2) Afastamento — sem afastamento, ate 15 dias ou mais de 15 dias; (3) Tipo de atendimento — nao necessario, ambulatorial (Pronto Socorro) ou hospitalar (internacao); (4) Obito — campo booleano para registro de acidente fatal.',
      'CAT (Comunicacao de Acidente do Trabalho): O sistema exibe os campos de CAT quando o evento e classificado como acidente. Preencha: se a CAT foi emitida (sim/nao), numero da CAT, data de emissao, tipo de CAT (inicial, reabertura ou comunicacao de obito) e observacoes. Voce pode tambem anexar o arquivo PDF da CAT diretamente no registro.',
      'Prazo legal da CAT: conforme o Art. 22 da Lei 8.213/91, a CAT deve ser emitida no primeiro dia util apos o acidente. Em caso de obito, deve ser emitida imediatamente. O nao cumprimento sujeita a empresa a multa. O sistema alerta quando ha acidentes sem CAT emitida no painel de estatisticas (card "CAT Pendentes").',
    ],
    dica: "e-Social: acidentes do trabalho devem ser comunicados ao e-Social pelo evento S-2210 (acidente) ou S-2220 (monitoramento de saude). O Seguramente registra os dados necessarios para que o DP ou o gestor de SST preencha esses eventos no portal do governo. Mantenha os dados atualizados no registro para facilitar esse processo.",
  },
  {
    num: "04",
    titulo: "Fatores Ergonomicos e Contribuicoes Psicossociais",
    subtitulo: "Como o evento alimenta o GRO e o modulo de Ergonomia",
    cor: AMBER,
    paragrafos: [
      'Um recurso diferencial do sistema e o campo "Fatores Ergonomicos" no registro de evento. O usuario pode selecionar um ou mais fatores que podem ter contribuido para o evento: ritmo acelerado/pressa, pressao por meta/producao, jornada longa/plantao prolongado, falta de pausas, falta de treinamento, falha ou ausencia de POP, layout inadequado do posto, iluminacao inadequada, ruido intenso, exposicao a calor/frio, sinais de estresse/exaustao emocional e turno noturno/3o turno.',
      'Esses dados sao cruzados automaticamente com o modulo de Ergonomia (AEP e Inventario GRO) e com os indicadores psicossociais. Quando um fator ergonomico aparece com frequencia em multiplos eventos, o sistema gera um alerta de "Padrao Recorrente" que recomenda a revisao da AEP daquele posto especifico.',
      'Esta integracao permite que o gestor de SST use os incidentes como evidencia concreta para justificar intervencoes ergonomicas. Em vez de basear uma acao de melhoria apenas em percepcao, voce tem dados: "3 incidentes nos ultimos 6 meses neste posto, todos com fator de pressao por meta — isso justifica a revisao da organizacao do trabalho (NR-17 sec.17.6)".',
    ],
    dica: "Dica para auditorias: ao relacionar sistematicamente os eventos com fatores ergonomicos e psicossociais, a empresa demonstra maturidade de gestao e capacidade de aprendizado organizacional — dois criterios avaliados em auditorias ISO 45001 e em processos de certificacao de maturidade em SST.",
  },
  {
    num: "05",
    titulo: "Investigacao e Pasta de Documentos Automatica",
    subtitulo: "Como o sistema apoia a investigacao de causa raiz",
    cor: AZUL,
    paragrafos: [
      'Ao registrar um acidente grave (tipo acidente com gravidade diferente de sem_lesao, afastamento ou obito), o sistema cria automaticamente uma pasta de investigacao no modulo de Documentos. A pasta e nomeada com o codigo do evento e a data (ex: "Acidente ACD-2024-001 — 15/01/2024") e criada dentro da estrutura de pastas de Investigacao de Incidentes.',
      'A pasta criada automaticamente contem 5 subpastas padrao: (1) Relato do Ocorrido — para o relato formal do acidente; (2) Analise de Causa Raiz — para metodologias como Arvore de Causas, 5 Porques ou Diagrama de Ishikawa; (3) Plano de Acao — para o plano corretivo documentado; (4) Evidencias e Fotos — para imagens do local, equipamentos envolvidos e danos; (5) CAT — para o arquivo da Comunicacao de Acidente do Trabalho.',
      'Alem da pasta automatica, o sistema permite anexar arquivos diretamente no registro do evento (aba de anexos no detalhe do evento). Os anexos ficam armazenados no banco de dados do Seguramente, vinculados ao evento, e podem ser acessados por qualquer usuario com permissao. Use esta funcionalidade para centralizar toda a documentacao da investigacao em um unico lugar.',
    ],
    dica: "Boa pratica de investigacao: o relato do ocorrido deve ser feito pelo supervisor direto nas primeiras 24 horas. A analise de causa raiz deve envolver o trabalhador, o supervisor e o tecnico de SST. O plano de acao deve ter responsavel, prazo e evidencia de conclusao. Esses tres documentos sao a base de qualquer defesa em acao trabalhista ou fiscalizacao.",
  },
  {
    num: "06",
    titulo: "Plano de Acao Vinculado",
    subtitulo: "Como criar e acompanhar acoes corretivas e preventivas",
    cor: VERDE,
    paragrafos: [
      'O sistema permite criar um Plano de Acao diretamente a partir do registro do evento. Acesse o detalhe do evento e clique em "Criar Acao Vinculada". O sistema preenche automaticamente: titulo da acao ("Acao corretiva — ACD-001" ou "Acao preventiva — INC-001"), descricao do evento, modulo de origem (SST), tipo de acao (corretiva para acidente, preventiva para incidente), responsavel (o usuario logado) e prazo sugerido de 30 dias.',
      'A acao criada aparece tanto no modulo de Plano de Acao (aba Plano de Acoes) quanto vinculada ao evento na tela de detalhes. O status do evento e atualizado automaticamente para "Acoes em Andamento". Quando a acao e concluida no modulo de Plano de Acao, o evento pode ser marcado como "Concluido".',
      'O sistema gerencia 4 status de evento: (1) Em Aberto — registrado, aguardando investigacao; (2) Em Analise — investigacao em andamento; (3) Acoes em Andamento — causa identificada e plano de acao criado; (4) Concluido — todas as acoes foram concluidas e o evento esta encerrado. A transicao entre status pode ser feita manualmente pelo usuario com permissao de edicao.',
    ],
    dica: "Gestao pelo status: filtre os eventos por status 'Em Aberto' regularmente para garantir que nenhum incidente fique sem investigacao. O objetivo e que todos os eventos estejam em 'Acoes em Andamento' em ate 5 dias uteis apos o registro. Eventos 'Em Aberto' por mais de 15 dias indicam falha no processo de investigacao.",
  },
  {
    num: "07",
    titulo: "Dashboard e Analise de Dados",
    subtitulo: "Como usar os indicadores para gestao proativa de seguranca",
    cor: ROXO,
    paragrafos: [
      'A aba "Analise" (Dashboard) apresenta graficos e indicadores calculados automaticamente com base nos eventos registrados: (1) Distribuicao por tipo — proporcao de incidentes vs acidentes; (2) Distribuicao por status — quantos eventos estao em cada fase do ciclo de gestao; (3) Gravidade das lesoes — de sem lesao ate grave/obito; (4) Evolucao temporal — eventos por mes para identificar tendencias; (5) Distribuicao por turno — qual turno concentra mais eventos; (6) Top categorias — as categorias de evento mais frequentes.',
      'Esses indicadores sao atualizados em tempo real conforme novos eventos sao registrados. Use-os para: identificar padroes (ex: maioria dos eventos no 3o turno — possivel relacao com fadiga); priorizar areas de intervencao (ex: setor X concentra 60% dos eventos); justificar investimentos em seguranca com dados concretos; demonstrar evolucao do programa em reunioes de diretoria.',
      'O painel de estatisticas (topo da tela) exibe os indicadores mais criticos em tempo real: total de eventos, incidentes, acidentes, eventos em aberto, com acoes em andamento, concluidos, acidentes com afastamento e CATs pendentes. Esses numeros devem ser revisados na Reuniao de CIPA, no SIPAT e em qualquer auditoria de SST.',
    ],
    dica: "Indicadores para relatorios: para relatorio mensal de SST, use: (a) Total de incidentes e acidentes no periodo; (b) Taxa de frequencia de acidentes com afastamento (TFA = num. acidentes x 1.000.000 / horas trabalhadas); (c) Percentual de eventos com acao vinculada; (d) Percentual de acoes concluidas no prazo. O sistema fornece todos os dados necessarios para calcular esses indicadores.",
  },
  {
    num: "08",
    titulo: "Piramide de Bird — Logica Preventiva",
    subtitulo: "Por que registrar incidentes e tao importante quanto registrar acidentes",
    cor: LARANJA,
    paragrafos: [
      'A aba "Piramide" visualiza os dados do modulo com base na Piramide de Bird (teoria do iceberg de acidentes). A piramide mostra a proporcao entre: Acidentes Fatais (topo) → Acidentes Graves → Acidentes Leves → Incidentes com Dano Material → Quase-Acidentes (base). A logica e: para cada acidente grave, existem aproximadamente 10 acidentes leves, 30 incidentes com dano material e 600 quase-acidentes.',
      'O sistema calcula automaticamente as proporcoes com base nos eventos registrados e exibe a piramide de forma visual. Quando a base da piramide (quase-acidentes e incidentes) for muito pequena em relacao ao topo (acidentes), isso indica sub-registro — a empresa esta registrando apenas os eventos mais graves e perdendo a oportunidade de aprendizado preventivo.',
      'Para uma gestao madura de seguranca, a piramide deve ter uma base larga (muitos quase-acidentes registrados) e um topo pequeno (poucos acidentes graves). Isso indica que a empresa esta aprendendo com os eventos menores antes que eles evoluam para acidentes graves. Use a piramide em apresentacoes de cultura de seguranca para motivar o registro de quase-acidentes.',
    ],
    dica: "Cultura de reporte: o maior obstaculo ao registro de quase-acidentes nao e a falta de sistema — e o medo de punicao. Lideres que respondem ao reporte de um quase-acidente com 'boa observacao, vamos investigar' em vez de 'quem e o culpado?' criam culturas de seguranca muito mais efetivas. O sistema registra o evento; a lideranca cria o ambiente psicologicamente seguro para que ele seja reportado.",
  },
  {
    num: "09",
    titulo: "Filtros e Busca Avancada",
    subtitulo: "Como encontrar e filtrar eventos rapidamente",
    cor: AZUL,
    paragrafos: [
      'A lista de eventos (aba "Ocorrencias") inclui um sistema de filtros avancados: (1) Busca textual — pesquisa por codigo do evento, nome do colaborador ou setor; (2) Tipo — todos, desvios, incidentes ou acidentes; (3) Status — todos, em aberto, em analise, acoes em andamento ou concluido; (4) Estabelecimento/Obra — filtra por unidade/filial da empresa (nome alinhado ao cadastro); (5) Turno — filtra por turno de trabalho; (6) Periodo — filtro por data de inicio e data fim do evento.',
      'Os filtros podem ser combinados. Por exemplo: "acidentes em aberto do 3o turno no ultimo trimestre" ou "desvios criticos da obra X em 2024". Use os filtros para preparar relatorios especificos para a CIPA, para o SESMT ou para auditorias externas.',
      'Cada evento na lista exibe: codigo, tipo (badge colorido), data, colaborador, setor, status e a ultima atualizacao. Clique em qualquer evento para abrir a tela de detalhe completo, onde voce pode ver toda a investigacao, os anexos, as acoes vinculadas e o historico de alteracoes.',
    ],
    dica: "Exportacao e relatorios: para o relatorio anual da CIPA, filtre tipo=acidente e periodo=01/01/ano a 31/12/ano. Para o PGR/GRO, inclua os desvios como evidencia do programa de identificacao continua de riscos exigido pela NR-01. Para auditorias ISO 45001, exporte desvios e incidentes como evidencia das clausulas 6.1 e 10.2.",
  },
  {
    num: "10",
    titulo: "Cartoes de Desvio — Base Preventiva da Piramide",
    subtitulo: "Registro proativo de condicoes inseguras antes do acidente",
    cor: AZUL,
    paragrafos: [
      'Cartoes de Desvio sao micro-registros estruturados de condicoes inseguras, atos inseguros ou desvios de processo — captados ANTES de um incidente ou acidente ocorrer. A hierarquia tecnica do sistema e: [DESVIO] → [INCIDENTE] → [ACIDENTE]. Cada desvio registrado e uma oportunidade de prevencao que alimenta diretamente a base da Piramide de Bird.',
      'Campos do Cartao de Desvio: (a) Tipo — Condicao Insegura, Ato Inseguro ou Desvio de Processo; (b) Local/Setor — onde o desvio foi identificado; (c) Data e hora; (d) Reportante — com opcao anonima; (e) Categoria tecnica — Ergonomia, EPI, Maquina, Organizacao do Trabalho ou Outro; (f) Potencial de risco — Baixo, Medio, Alto ou Critico; (g) Descricao e evidencia (foto/audio); (h) Vinculacao com o Inventario de Riscos (GRO).',
      'Fluxo operacional dos desvios: (1) Colaborador ou supervisor registra o desvio; (2) Sistema classifica automaticamente o potencial de risco; (3) Desvios com risco Alto ou Critico geram alerta e podem ser escalados para Incidente; (4) Gestor atribui responsavel e prazo para tratamento; (5) Desvio tratado alimenta o score preditivo e reduz o risco do setor; (6) Dados cruzados com Ergonomia e Psicossocial geram alertas de padrao.',
    ],
    dica: "Impacto no FAP: desvios tratados antes de virarem acidentes evitam a geracao de CAT, de beneficios B91 e de NTEP — os tres fatores que mais impactam negativamente o FAP. Um programa estruturado de registro e tratamento de desvios e a intervencao mais custo-efetiva em SST: previne o acidente e protege o caixa da empresa.",
  },
  {
    num: "11",
    titulo: "Simulador FAP / RAT",
    subtitulo: "Projete o impacto financeiro dos acidentes e planeje a prevencao",
    cor: VERDE,
    paragrafos: [
      'O FAP (Fator Acidentario de Prevencao) e um multiplicador calculado pelo INSS que pode aumentar ou reduzir em ate 100% a aliquota do RAT (Risco Ambiental do Trabalho) da empresa. O RAT varia de 1% a 3% sobre a folha de pagamento conforme o grau de risco da atividade (CNAE). Com o FAP, o custo efetivo pode variar de 0,5% a 6% — uma diferenca significativa na folha.',
      'O simulador do Seguramente exibe: (a) RAT atual da empresa com base no CNAE; (b) Score de risco estimado com base nos eventos registrados; (c) Projecao de B91 e NTEP — se os acidentes registrados possuem nexo tecnico que pode ser usado pelo INSS; (d) Simulacao de cenarios — "se eu reduzir X acidentes, qual seria meu FAP estimado?"; (e) Alertas de risco de enquadramento em NTEP por categoria de acidente.',
      'Para usar o simulador: acesse a aba "Analise" → secao "Simulador FAP/RAT". Informe o numero de funcionarios e as horas trabalhadas no periodo. O sistema calcula automaticamente a Taxa de Frequencia e projeta o impacto no FAP com base nos dados registrados. Exporte o relatorio para apresentar ao Financeiro ou a Diretoria como argumento para investimento em prevencao.',
    ],
    dica: "Cada acidente com afastamento > 15 dias pode contribuir para um beneficio B91 no INSS por ate 3 anos. Nesse periodo, a empresa e computada na estatistica que define o FAP do proximo bienio. Registrar e tratar desvios, investigar causas raiz e implementar acoes corretivas efetivas e a estrategia mais eficaz para manter o FAP abaixo de 1,0.",
  },
  {
    num: "12",
    titulo: "Analise Preditiva e Score de Risco",
    subtitulo: "Inteligencia para antecipar riscos antes que ocorram",
    cor: ROXO,
    paragrafos: [
      'O sistema analisa padroes historicos de desvios, incidentes e fatores ergonomicos para calcular um score de risco por setor e turno. Quando o padrao indica alto potencial de acidente — por exemplo, multiplos desvios de EPI no mesmo setor em curto periodo — alertas proativos sao gerados antes que o acidente ocorra.',
      'Indicadores preditivos disponiveis: (a) Score de risco por setor (0 a 100) — calculado com base na frequencia, gravidade e categorias dos eventos; (b) Taxa de conversao Desvio → Incidente → Acidente — mostra que percentual de desvios evolui para eventos mais graves; (c) Alertas de padrao recorrente — ativados quando o mesmo tipo de desvio ou fator ergonomico aparece 3 ou mais vezes; (d) Score de risco por turno — identifica se o 3o turno ou turnos noturnos concentram mais ocorrencias.',
      'KPIs adicionais do modulo apos implementacao dos Cartoes de Desvio: (1) % de desvios tratados no prazo; (2) Tempo medio de resposta ao desvio (dias); (3) Numero de desvios por colaborador/setor; (4) Taxa de conversao Desvio → Incidente; (5) Taxa de conversao Incidente → Acidente. Essas metricas sao consideradas ouro para o calculo e acompanhamento do FAP.',
    ],
    dica: "Visao integrada: o ciclo completo de prevencao e: Desvio registrado → risco identificado → acao preventiva → verificacao de efetividade → historico alimenta GRO e PGR. Empresas que completam esse ciclo de forma sistematica demonstram maturidade de gestao em auditorias ISO 45001 e em processos de certificacao de SST.",
  },
  {
    num: "13",
    titulo: "Integracao com Outros Modulos",
    subtitulo: "Como Incidentes & Acidentes se conecta com o ecossistema Seguramente",
    cor: VERDE,
    paragrafos: [
      'O modulo de Incidentes & Acidentes se integra nativamente com outros modulos da plataforma: (1) Documentos — a pasta de investigacao e criada automaticamente para acidentes graves, centralizando toda a documentacao; (2) Plano de Acao — acoes corretivas e preventivas criadas a partir de eventos e desvios aparecem no Plano de Acao Global; (3) Terceiros & SST — desvios e incidentes envolvendo prestadores de servico podem ser vinculados ao cadastro de terceiros.',
      '(4) Ergonomia — os fatores ergonomicos marcados nos eventos alimentam o Inventario GRO e a AEP. Quando um fator aparece repetidamente, o sistema recomenda a revisao ergonomica do posto. (5) Psicossocial — indicadores de estresse/exaustao registrados nos eventos sao cruzados com os dados das campanhas psicossociais para identificar grupos de risco.',
      '(6) Saude / Afastamentos — acidentes com afastamento podem ser vinculados diretamente a um registro de afastamento no modulo de Saude. (7) e-Social — os dados de acidente preenchidos no Seguramente sao os mesmos exigidos pelo evento S-2210 do e-Social. (8) Compliance SST — os desvios e incidentes alimentam o painel de conformidade legal da empresa.',
    ],
    dica: "Visao integrada: o ciclo e: o desvio revela o risco → o incidente confirma o perigo → a ergonomia identifica a causa organizacional → o psicossocial confirma os fatores humanos → a saude monitora o impacto → o plano de acao fecha o ciclo → o FAP reflete o resultado. Cada modulo alimenta o outro com dados concretos para uma gestao preventiva e compliant.",
  },
];

// Fluxo resumido
const FLUXO_LINHAS: { etapa: string; sistema: string; cor: RGB }[] = [
  { etapa: "Registrar Desvio (Novo)",   sistema: "Tipo (Condicao/Ato/Processo) | Potencial de risco | Categoria tecnica | Foto",              cor: AZUL },
  { etapa: "Registrar Evento",          sistema: "Tipo (Incidente/Acidente) | Codigo automatico | Data, hora, setor, funcao | Origem",        cor: VERMELHO },
  { etapa: "Descricao e Causas",        sistema: "Fatos objetivos | Categoria | Origem predominante | Fatores Ergonomicos -> GRO",             cor: LARANJA },
  { etapa: "Campos de Acidente",        sistema: "Gravidade | Afastamento | Atendimento | Obito | CAT (numero, data, arquivo PDF)",            cor: LARANJA },
  { etapa: "Pasta Investigacao",        sistema: "Criada automaticamente em Documentos | 5 subpastas padrao para acidente grave",              cor: AZUL },
  { etapa: "Mudar Status",              sistema: "Em Aberto -> Em Analise -> Acoes em Andamento -> Concluido",                                 cor: AMBER },
  { etapa: "Investigar Causa Raiz",     sistema: "Arvore de Causas / 5 Porques / Ishikawa | Documentar em pasta de Investigacao",             cor: AZUL },
  { etapa: "Criar Acao Vinculada",      sistema: "Acao corretiva (acidente) ou preventiva (incidente) | Responsavel + Prazo automaticos",     cor: VERDE },
  { etapa: "Simulador FAP/RAT (Novo)",  sistema: "Score de risco | Projecao B91/NTEP | Impacto financeiro na folha de pagamento",             cor: VERDE },
  { etapa: "Acompanhar no Dashboard",   sistema: "Desvios+Incidentes+Acidentes | Score preditivo | Taxa de conversao | Piramide ampliada",   cor: ROXO },
  { etapa: "Emitir CAT (se obrigatorio)", sistema: "Lei 8.213/91 — 1o dia util apos acidente | e-Social S-2210 | Multa por atraso",           cor: VERMELHO },
  { etapa: "Concluir Evento",           sistema: "Todas as acoes concluidas | Evidencias anexadas | Pasta de investigacao completa",          cor: VERDE },
];

// Glossario
const GLOSSARIO: [string, string][] = [
  ["Desvio",          "Registro proativo de condicao insegura, ato inseguro ou desvio de processo, captado ANTES de um incidente ou acidente ocorrer. Base da Piramide de Bird ampliada."],
  ["Incidente",       "Evento que ocorreu no trabalho mas nao resultou em lesao, doenca ou morte. Inclui quase-acidentes (near miss) e situacoes de risco iminente."],
  ["Acidente",        "Evento que resultou em lesao, doenca ou morte decorrente do trabalho, conforme definicao legal da Lei 8.213/91."],
  ["CAT",             "Comunicacao de Acidente do Trabalho. Documento obrigatorio emitido pelo empregador no 1o dia util apos o acidente (Art. 22 da Lei 8.213/91). Em caso de obito, deve ser emitida imediatamente."],
  ["Near Miss",       "Quase-acidente. Evento que poderia ter causado lesao ou dano mas nao causou, por acaso ou por intervencao. Sao os eventos mais importantes para a prevencao."],
  ["Piramide de Bird","Teoria que estabelece a proporcao entre acidentes graves e eventos menores. O sistema amplia a piramide com 5 niveis: Desvios (base) -> Quase-Acidentes -> Incidentes -> Acidentes Leves -> Graves/Fatais."],
  ["FAP",             "Fator Acidentario de Prevencao. Multiplicador do RAT calculado pelo INSS com base na sinistralidade da empresa. Pode variar de 0,5 a 2,0, impactando diretamente a folha de pagamento."],
  ["RAT",             "Risco Ambiental do Trabalho. Aliquota de contribuicao previdenciaria (1%, 2% ou 3%) ajustada pelo FAP. Cada acidente com afastamento pode elevar o FAP por ate 3 anos."],
  ["B91",             "Beneficio de auxilio por acidente do trabalho (NTEP/FAP). Acidentes com afastamento > 15 dias podem gerar B91, impactando negativamente o FAP da empresa."],
  ["NTEP",            "Nexo Tecnico Epidemiologico Previdenciario. Quando a doenca ou lesao tem correlacao estatistica com a atividade da empresa (CNAE), o INSS pode presumir que e acidente de trabalho."],
  ["GRO",             "Gerenciamento de Riscos Ocupacionais. Inventario de riscos exigido pela NR-01. Os eventos e desvios do modulo alimentam o inventario GRO com evidencias concretas."],
  ["PGR",             "Programa de Gerenciamento de Riscos. Documento central da NR-01 que inclui o inventario GRO, planos de acao e historico de eventos, incluindo desvios."],
  ["e-Social S-2210", "Evento do e-Social para comunicacao de acidentes do trabalho ao governo federal, incluindo acidentes tipicos, de trajeto e doencas do trabalho."],
  ["e-Social S-2220", "Evento do e-Social para monitoramento da saude do trabalhador, incluindo dados de afastamento e retorno ao trabalho."],
  ["TFA",             "Taxa de Frequencia de Acidentes com Afastamento. Calculada como: (num. acidentes x 1.000.000) / horas trabalhadas. Indicador KPI de SST."],
  ["ACD",             "Prefixo do codigo automatico de Acidentes gerado pelo sistema (ex: ACD-2024-001)."],
  ["INC",             "Prefixo do codigo automatico de Incidentes gerado pelo sistema (ex: INC-2024-001)."],
  ["DEV",             "Prefixo do codigo automatico de Desvios gerado pelo sistema (ex: DEV-2024-001)."],
  ["NR-01",           "Norma Regulamentadora 1 — obriga as empresas a manter o PGR com inventario de riscos e historico de eventos, incluindo incidentes, acidentes e desvios identificados."],
  ["NR-17",           "Norma Regulamentadora 17 — ergonomia. Os fatores ergonomicos marcados nos eventos alimentam a AEP e o Inventario GRO do modulo de Ergonomia."],
  ["ISO 45001",       "Norma internacional de sistema de gestao de saude e seguranca ocupacional. Exige registro, investigacao e aprendizado com todos os incidentes, incluindo desvios (clausulas 6.1 e 10.2)."],
  ["5W2H",            "Modelo de plano de acao: O que, Por que, Onde, Quando, Quem, Como e Quanto custa. Utilizado nas acoes corretivas/preventivas vinculadas ao evento."],
];

export function ManualIncidentes() {
  const [gerando, setGerando] = useState(false);

  const gerarPDF = async () => {
    setGerando(true);
    try {
      const doc = new jsPDF({ format: "a4", unit: "mm" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      let y = 0;

      // ── Helpers ──────────────────────────────────────────────────────────
      const addPage = () => {
        doc.addPage();
        y = margin;
        stroke(doc, VERMELHO);
        doc.setLineWidth(0.3);
        doc.line(margin, 10, pageW - margin, 10);
      };

      const checkY = (needed: number) => {
        if (y + needed > pageH - 16) addPage();
      };

      const rodape = () => {
        const total = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
        const cur = total;
        doc.setFontSize(7);
        text(doc, MUTED);
        doc.text(
          `Seguramente - Manual do Usuario | Incidentes & Acidentes | Pagina ${cur}/${total}`,
          pageW / 2, pageH - 8, { align: "center" }
        );
      };

      // ── CAPA ─────────────────────────────────────────────────────────────
      fill(doc, VERMELHO);
      doc.rect(0, 0, pageW, pageH, "F");

      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.text("MANUAL DO USUARIO", margin, 62);
      doc.setFontSize(20);
      doc.text("Incidentes & Acidentes", margin, 76);
      doc.setFontSize(13);
      doc.text("Cartoes de Desvio / CAT / e-Social / FAP / GRO / Piramide de Bird", margin, 88);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(254, 226, 226);
      doc.text("Guia completo para RH, gestores e tecnicos de SST", margin, 106);
      doc.text("desde o registro ate o encerramento do evento.", margin, 114);

      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(margin, 124, pageW - margin, 124);

      doc.setFontSize(8.5);
      doc.setTextColor(252, 165, 165);
      doc.text("NR-01  |  Lei 8.213/91  |  e-Social S-2210/S-2220  |  ISO 45001  |  GRO / PGR", pageW / 2, 133, { align: "center" });

      // Fluxo visual na capa
      const etapasCapa = ["Registrar", "Investigar", "Emitir CAT", "Plano Acao", "Monitorar", "Concluir"];
      const boxW = (pageW - 2 * margin - (etapasCapa.length - 1) * 2) / etapasCapa.length;
      const boxY = 148;
      etapasCapa.forEach((etapa, i) => {
        const bx = margin + i * (boxW + 2);
        doc.setFillColor(185, 28, 28);
        doc.roundedRect(bx, boxY, boxW, 14, 1, 1, "F");
        doc.setFontSize(6);
        doc.setTextColor(255, 255, 255);
        doc.text(etapa, bx + boxW / 2, boxY + 9, { align: "center" });
      });

      doc.setFontSize(8);
      doc.setTextColor(252, 165, 165);
      doc.text(
        `Emitido em ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
        margin, pageH - 20
      );
      doc.text("seguramente.app", pageW - margin, pageH - 20, { align: "right" });

      rodape();

      // ── SUMARIO ──────────────────────────────────────────────────────────
      doc.addPage();
      y = margin + 4;

      fill(doc, VERMELHO);
      doc.rect(0, 0, pageW, 28, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("SUMARIO", margin, 18);

      y = 40;
      const itens = [
        ["Cap. 01", "Visao Geral do Modulo de Incidentes & Acidentes",                "3"],
        ["Cap. 02", "Registro do Evento — Incidente vs Acidente",                      "4"],
        ["Cap. 03", "Campos Especificos de Acidente e CAT",                            "5"],
        ["Cap. 04", "Fatores Ergonomicos e Contribuicoes Psicossociais",               "6"],
        ["Cap. 05", "Investigacao e Pasta de Documentos Automatica",                   "7"],
        ["Cap. 06", "Plano de Acao Vinculado e Ciclo de Status",                       "8"],
        ["Cap. 07", "Dashboard e Analise de Dados (KPIs de SST)",                      "9"],
        ["Cap. 08", "Piramide de Bird — Logica Preventiva",                            "10"],
        ["Cap. 09", "Filtros e Busca Avancada",                                        "11"],
        ["Cap. 10", "Integracao com Outros Modulos",                                   "12"],
        ["---",     "Fluxo Resumido do Modulo",                                        "13"],
        ["---",     "Glossario de Termos",                                             "14"],
      ];

      doc.setFontSize(9);
      itens.forEach(([num, titulo, pag], i) => {
        const bgYi = y - 4;
        if (i % 2 === 0) {
          doc.setFillColor(254, 242, 242);
          doc.rect(margin, bgYi, pageW - 2 * margin, 8, "F");
        }
        doc.setFont("helvetica", "bold");
        text(doc, VERMELHO);
        doc.text(num, margin + 2, y + 1);
        doc.setFont("helvetica", "normal");
        text(doc, CINZA);
        doc.text(titulo, margin + 28, y + 1);
        text(doc, MUTED);
        doc.text(`pag. ${pag}`, pageW - margin - 2, y + 1, { align: "right" });
        y += 10;
      });

      y += 6;
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(margin, y, pageW - 2 * margin, 36, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      text(doc, VERMELHO);
      doc.text("Para quem e este manual?", margin + 4, y + 7);
      doc.setFont("helvetica", "normal");
      text(doc, CINZA);
      const introMaxW = pageW - 2 * margin - 8;
      const introLinhas = doc.splitTextToSize(
        "Este manual foi escrito para gestores de RH, responsaveis por Saude e Seguranca do Trabalho (SST), membros da CIPA, tecnicos de seguranca e qualquer lider que precise gerenciar eventos de seguranca de forma estruturada e em conformidade legal. O sistema orienta cada etapa, alertas automaticos para prazos legais e integra os dados com ergonomia, saude e planos de acao.",
        introMaxW
      );
      doc.setFontSize(8.5);
      introLinhas.forEach((line: string, i: number) => {
        doc.text(line, margin + 4, y + 16 + i * 5, { align: "left", maxWidth: introMaxW });
      });

      rodape();

      // ── PASSOS ───────────────────────────────────────────────────────────
      PASSOS.forEach((passo) => {
        addPage();
        y = margin + 4;

        fill(doc, passo.cor);
        doc.roundedRect(margin, y, pageW - 2 * margin, 22, 2, 2, "F");

        const tituloMaxW = pageW - 2 * margin - 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        text(doc, WHITE);
        const tituloLinhas = doc.splitTextToSize(
          `${passo.num}. ${passo.titulo}`,
          tituloMaxW
        );
        tituloLinhas.forEach((linha: string, i: number) => {
          doc.text(linha, margin + 4, y + 8 + i * 6, { align: "left", maxWidth: tituloMaxW });
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(254, 226, 226);
        doc.text(passo.subtitulo, margin + 4, y + 18, { align: "left" });

        y += 28;

        passo.paragrafos.forEach((par) => {
          const maxW = pageW - 2 * margin;
          const linhas = doc.splitTextToSize(par, maxW);
          const alturaBloco = linhas.length * 5 + 6;
          checkY(alturaBloco);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          text(doc, CINZA);
          linhas.forEach((linha: string) => {
            doc.text(linha, margin, y, { align: "left", maxWidth: maxW });
            y += 5;
          });
          y += 4;
        });

        // Caixa de dica
        const dicaMaxW = pageW - 2 * margin - 10;
        const dicaLinhas = doc.splitTextToSize(passo.dica, dicaMaxW);
        const dicaAltura = dicaLinhas.length * 4.8 + 8;
        checkY(dicaAltura + 6);

        y += 2;
        doc.setFillColor(255, 251, 235);
        doc.setDrawColor(217, 119, 6);
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, y, pageW - 2 * margin, dicaAltura, 2, 2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(146, 64, 14);
        doc.text("Atencao / Dica:", margin + 4, y + 5, { align: "left" });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 53, 15);
        dicaLinhas.forEach((linha: string, i: number) => {
          doc.text(linha, margin + 4, y + 10 + i * 4.8, { align: "left", maxWidth: dicaMaxW });
        });
        y += dicaAltura + 8;

        rodape();
      });

      // ── FLUXO RESUMIDO ────────────────────────────────────────────────────
      addPage();
      y = margin + 4;

      fill(doc, VERMELHO);
      doc.rect(0, 0, pageW, 28, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("FLUXO RESUMIDO DO MODULO", margin, 18);

      y = 36;

      FLUXO_LINHAS.forEach(({ etapa, sistema, cor }, i) => {
        checkY(14);

        const rowY = y;
        fill(doc, cor);
        doc.roundedRect(margin, rowY, 8, 10, 1, 1, "F");
        text(doc, WHITE);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text(String(i + 1), margin + 4, rowY + 7, { align: "center" });

        text(doc, cor);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        const cw1 = 52;
        const etapaLinhas = doc.splitTextToSize(etapa, cw1);
        etapaLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 11, rowY + 4 + li * 4.5, { align: "left", maxWidth: cw1 });
        });

        text(doc, CINZA);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.8);
        const cw2 = pageW - 2 * margin - 66;
        const sistLinhas = doc.splitTextToSize(sistema, cw2);
        sistLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 66, rowY + 4 + li * 4.5, { align: "left", maxWidth: cw2 });
        });

        const rowH = Math.max(etapaLinhas.length, sistLinhas.length) * 4.5 + 4;
        y += rowH + 2;

        if (i < FLUXO_LINHAS.length - 1) {
          text(doc, MUTED);
          doc.setFontSize(9);
          doc.text("|", margin + 3.5, y - 1);
        }
      });

      rodape();

      // ── GLOSSARIO ────────────────────────────────────────────────────────
      addPage();
      y = margin + 4;

      fill(doc, VERMELHO);
      doc.rect(0, 0, pageW, 28, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("GLOSSARIO DE TERMOS", margin, 18);

      y = 36;

      GLOSSARIO.forEach(([termo, def], i) => {
        const defLinhas = doc.splitTextToSize(def, pageW - 2 * margin - 38);
        const rowH = defLinhas.length * 4.5 + 7;
        checkY(rowH);

        if (i % 2 === 0) {
          doc.setFillColor(254, 242, 242);
          doc.rect(margin, y - 3, pageW - 2 * margin, rowH, "F");
        }

        text(doc, VERMELHO);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(termo, margin + 2, y + 4);

        text(doc, CINZA);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        defLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 38, y + 4 + li * 4.5);
        });

        y += rowH;
      });

      rodape();

      // ── CONTRACAPA ───────────────────────────────────────────────────────
      doc.addPage();
      fill(doc, VERMELHO);
      doc.rect(0, 0, pageW, pageH, "F");

      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Obrigado por usar o Seguramente!", pageW / 2, pageH / 2 - 20, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(254, 226, 226);
      const finalLinhas = doc.splitTextToSize(
        "Este manual foi gerado automaticamente pela plataforma. Para suporte, acesse o modulo de Suporte no menu lateral ou entre em contato com nossa equipe.",
        pageW - 2 * margin
      );
      finalLinhas.forEach((l: string, i: number) => {
        doc.text(l, pageW / 2, pageH / 2 - 6 + i * 6, { align: "center" });
      });

      doc.setFontSize(9);
      doc.setTextColor(252, 165, 165);
      doc.text("seguramente.app", pageW / 2, pageH / 2 + 20, { align: "center" });
      doc.text(
        `Gerado em ${format(new Date(), "dd/MM/yyyy 'as' HH:mm")}`,
        pageW / 2, pageH / 2 + 28, { align: "center" }
      );

      rodape();

      doc.save(`Manual_Incidentes_Acidentes_Seguramente_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("Manual gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar o manual. Tente novamente.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={gerarPDF}
      disabled={gerando}
      className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
    >
      {gerando ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Gerando Manual...</>
      ) : (
        <><BookOpen className="h-4 w-4" /> Baixar Manual PDF</>
      )}
    </Button>
  );
}
