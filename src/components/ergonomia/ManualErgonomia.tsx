/**
 * Manual do Usuário — Módulo de Ergonomia Inteligente
 * Gerado em PDF via jsPDF.
 * Todos os caracteres especiais substituídos por ASCII puro para compatibilidade
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

const VERDE: RGB       = [5, 150, 105];
const VERDE_LIGHT: RGB = [209, 250, 229];
const AZUL: RGB        = [37, 99, 235];
const ROXO: RGB        = [88, 28, 135];
const AMBER: RGB       = [180, 120, 0];
const LARANJA: RGB     = [234, 88, 12];
const VERMELHO: RGB    = [220, 38, 38];
const CINZA: RGB       = [50, 50, 50];
const MUTED: RGB       = [120, 120, 120];
const WHITE: RGB       = [255, 255, 255];

function fill(doc: jsPDF, c: RGB)   { doc.setFillColor(c[0], c[1], c[2]); }
function stroke(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function text(doc: jsPDF, c: RGB)   { doc.setTextColor(c[0], c[1], c[2]); }

// ── Conteúdo — SOMENTE ASCII para compatibilidade com Helvetica do jsPDF ──────
const PASSOS = [
  {
    num: "01",
    titulo: "Visao Geral do Modulo de Ergonomia",
    subtitulo: "O que e e para que serve",
    cor: VERDE,
    paragrafos: [
      'O modulo de Ergonomia Inteligente do Seguramente centraliza toda a gestao de riscos ergonomicos da sua empresa. Ele foi desenvolvido para apoiar o atendimento as exigencias da NR-17 (Ergonomia), NR-01 (Gestao de Riscos Ocupacionais) e as diretrizes da ISO 45001/45003, reunindo em um so lugar tudo que voce precisa: identificacao de riscos, analise tecnica, planos de acao e documentos de conformidade.',
      'Voce nao precisa ser especialista em ergonomia para usar este modulo. O sistema orienta cada etapa com linguagem simples, automatiza os calculos de criticidade e gera a documentacao tecnica com um clique. O objetivo e que o RH, o gestor ou o tecnico de SST consiga gerenciar os riscos ergonomicos de forma organizada e documentada. A norma orienta; o sistema operacionaliza.',
      'A estrutura do modulo aplica o ciclo GRO (Gerenciamento de Riscos Ocupacionais) em 5 etapas: Avaliar Riscos (AEP), Inventario GRO, Riscos Prioritarios, Plano de Acao e Monitoramento. Cada etapa tem uma funcao clara e se integra com as demais.',
    ],
    dica: "Dica: Comece sempre pela AEP (Analise Ergonomica Preliminar). Ela e a porta de entrada recomendada que alimenta todo o sistema com as informacoes necessarias para as etapas seguintes.",
  },
  {
    num: "02",
    titulo: "Passo 1 — Analise Ergonomica Preliminar (AEP)",
    subtitulo: "A abordagem inicial recomendada para avaliacao das condicoes de trabalho",
    cor: VERDE,
    paragrafos: [
      'A AEP (Analise Ergonomica Preliminar) e a abordagem inicial recomendada para avaliacao das condicoes ergonomicas antes de estudos mais aprofundados. Ela mapeia as condicoes de trabalho por "Situacao de Trabalho" — normalmente representada por setor, funcao ou atividade. No sistema, o modelo padrao utiliza o par Setor + Funcao, que atende a maioria dos cenarios organizacionais.',
      'Para gerar uma AEP, acesse a aba "Avaliar Riscos (AEP)" e clique em "Nova AEP". Selecione o Setor e a Funcao. O sistema preenchera automaticamente o CNPJ e a Razao Social da empresa. Voce pode optar pela AEP simples (uma funcao) ou multi-setor (varias funcoes de uma vez).',
      'O sistema aplica 6 dominios baseados em boas praticas ergonomicas e psicossociais, alinhados a NR-17 e a ISO 45003: (1) Ritmo e Carga de Trabalho, (2) Demandas Cognitivas e Emocionais, (3) Autonomia e Controle, (4) Relacoes e Suporte, (5) Suporte Organizacional e (6) Clareza de Papel. Se a empresa ja realizou campanhas psicossociais, esses dados sao preenchidos automaticamente como evidencia objetiva.',
    ],
    dica: "Atencao: A NR-17 determina que as condicoes ergonomicas dos postos de trabalho devem ser avaliadas. O sistema aplica a AEP como ponto de partida documental para atender essa exigencia de forma organizada e rastreavel.",
  },
  {
    num: "03",
    titulo: "Passo 2 — Inventario GRO",
    subtitulo: "O registro central de todos os riscos identificados",
    cor: AZUL,
    paragrafos: [
      'O Inventario GRO e onde ficam registrados todos os riscos ergonomicos da empresa. Cada risco cadastrado recebe automaticamente um nivel de criticidade calculado pela formula Probabilidade x Severidade (P x S), resultando em um score de 1 a 25.',
      'Para cadastrar um risco, acesse a aba "Inventario GRO" e clique em "Novo Risco". Preencha: o posto de trabalho, o tipo de risco (fisico, cognitivo, organizacional), a probabilidade de ocorrencia (1=Remota a 5=Quase certa) e a severidade do dano (1=Insignificante a 5=Catastrofico). O nivel de risco sera calculado automaticamente.',
      'O sistema aplica a seguinte classificacao: Baixo (1-4) - apenas monitorar; Moderado (5-9) - acoes preventivas recomendadas; Alto (10-15) - intervencao prioritaria com prazo sugerido de 60 dias; Critico (16-25) - intervencao imediata com prazo sugerido de 30 dias e bloqueio de encerramento sem acao vinculada.',
    ],
    dica: "Importante: O sistema aplica uma regra de controle interna que impede o encerramento de riscos classificados como Alto ou Critico sem que haja um Plano de Acao 5W2H formalmente vinculado. Isso garante rastreabilidade e evita que riscos graves fiquem sem tratamento documentado.",
  },
  {
    num: "04",
    titulo: "Passo 3 — Motor AET (Analise Ergonomica do Trabalho)",
    subtitulo: "Recomendacoes tecnicas automatizadas pela IA",
    cor: AMBER,
    paragrafos: [
      'O Motor AET e o cerebro analitico do sistema. Com base nos riscos registrados no Inventario GRO e nos dados psicossociais das campanhas, ele gera automaticamente uma lista de analises tecnicas recomendadas com base em criterios tecnicos e legais, classificadas em tres niveis: Prioritarias (risco alto/critico), Recomendadas (risco moderado com indicios adicionais) e Sugeridas (boas praticas preventivas).',
      'Acesse a aba "Motor AET" para visualizar as recomendacoes. Analises classificadas como Prioritarias devem ser atendidas com urgencia — o sistema as destaca com base na criticidade do risco e no prazo estabelecido. Cada recomendacao apresenta o fundamento tecnico ou normativo que a justifica e orienta o que deve ser feito.',
      'O Motor AET tambem monitora os indicadores psicossociais do modulo de Avaliacao. Quando esses indicadores atingem niveis criticos, o sistema recomenda o aprofundamento da analise ergonomica por meio de uma Analise Ergopsicossocial — que combina dados ergonomicos com fatores de saude mental e organizacao do trabalho, em linha com as diretrizes da ISO 45003.',
    ],
    dica: "Dica: Marque as analises como Concluidas apos executa-las. Isso atualiza o Score de Maturidade GRO — um indicador que mostra o nivel de maturidade do programa ergonomico da empresa em relacao as boas praticas e exigencias normativas.",
  },
  {
    num: "05",
    titulo: "Passo 4 — Analise por Inteligencia Artificial",
    subtitulo: "Diagnostico ergonomico rapido por descricao ou foto",
    cor: ROXO,
    paragrafos: [
      'O modulo de Analise por IA permite obter um diagnostico ergonomico rapido sem precisar preencher formularios extensos. Voce descreve o posto de trabalho em linguagem natural (ex: "operador de computador que fica 8 horas sentado, com monitor alto demais e sem suporte para os pes") ou envia uma foto do posto, e a IA gera uma analise completa.',
      'A analise inclui: identificacao dos principais riscos ergonomicos, classificacao por tipo (fisico, cognitivo, organizacional), recomendacoes de adequacao com base nas normas vigentes e sugestao de prioridades de intervencao. A analise e salva automaticamente na Base Ergonomica para consulta futura.',
      'Esta funcionalidade e especialmente util para analises rapidas de novos postos de trabalho, avaliacao de situacoes especificas relatadas por colaboradores ou para fundamentar laudos tecnicos com mais agilidade. Nao substitui a AEP formal, mas e um excelente ponto de partida e complemento documental.',
    ],
    dica: "Dica: Seja especifico na descricao. Inclua informacoes como: tipo de mobiliario, equipamentos utilizados, postura predominante, duracao das atividades, peso manuseado e se ha repeticao de movimentos. Quanto mais detalhes, mais precisa sera a analise.",
  },
  {
    num: "06",
    titulo: "Passo 5 — Plano de Acao Ergonomico",
    subtitulo: "Como tratar os riscos identificados",
    cor: LARANJA,
    paragrafos: [
      'O Plano de Acao e onde as melhorias ganham vida. Para cada risco identificado no Inventario GRO, voce deve criar uma ou mais acoes de controle. O sistema usa o modelo 5W2H: O que sera feito (What), Por que e necessario (Why), Onde sera feito (Where), Quando sera concluido (When), Quem e responsavel (Who), Como sera feito (How) e Quanto custara (How Much).',
      'Para riscos criticos, o sistema gera automaticamente uma proposta de acao com prazo sugerido de 30 dias. Para riscos altos, o prazo sugerido e de 60 dias. Voce pode aceitar a proposta automatica ou editar conforme a realidade da empresa. Defina um responsavel nominal para cada acao — isso cria responsabilidade clara e facilita o acompanhamento.',
      'O progresso de cada acao pode ser atualizado em tempo real (0% a 100%). Acoes concluidas devem ter evidencias anexadas (fotos, laudos, notas fiscais de compra de equipamentos). O sistema monitora os prazos e gera alertas para acoes proximas do vencimento ou atrasadas.',
    ],
    dica: "Boa pratica: Acoes que exigem investimento financeiro (compra de equipamentos, reformas) devem ser formalmente aprovadas pela lideranca antes de serem registradas. Use o campo 'Custo Estimado' para facilitar a aprovacao interna.",
  },
  {
    num: "07",
    titulo: "Ciclo PDCA e Score de Maturidade GRO",
    subtitulo: "Como o sistema mede a evolucao do programa ergonomico",
    cor: AZUL,
    paragrafos: [
      'O Ciclo PDCA (Planejar, Fazer, Checar, Agir) e o modelo de gestao que organiza todo o programa ergonomico. O sistema divide os riscos em 4 fases: (P) Identificados/Planejados, (D) Em execucao, (C) Aguardando verificacao, (A) Concluidos e encerrados. Um funil visual mostra a distribuicao atual dos riscos entre as fases.',
      'O Score de Maturidade GRO e um indicador de 0 a 100% que auxilia na preparacao para auditorias e avalia o nivel de organizacao do programa ergonomico. Ele considera: se a empresa tem inventario atualizado, se riscos altos/criticos tem acoes vinculadas, se as acoes estao dentro do prazo, se ha reavaliacao periodica e se os documentos de comunicacao aos trabalhadores foram gerados.',
      'Para aumentar o Score de Maturidade, siga a ordem: 1) Cadastre todos os riscos no GRO; 2) Vincule acoes a todos os riscos altos/criticos; 3) Mantenha as acoes dentro do prazo; 4) Gere os documentos de comunicacao; 5) Realize reavaliacao anual dos riscos. Um score acima de 70% indica boa maturidade do programa em relacao as praticas esperadas pela NR-01.',
    ],
    dica: "Para auditorias: O Score de Maturidade GRO auxilia na preparacao para processos de auditoria e fiscalizacao. Mantenha-o acima de 70% como referencia de boa gestao continua. Acoes com prazo vencido impactam diretamente o score e devem ser atualizadas regularmente.",
  },
  {
    num: "08",
    titulo: "Documentos de Conformidade — Metodologia e Comunicacao",
    subtitulo: "Registros tecnicos que documentam o programa ergonomico da empresa",
    cor: VERDE,
    paragrafos: [
      'O modulo gera dois documentos tecnicos importantes para o programa ergonomico: (1) Documento de Metodologia (RQ-26) — documenta os criterios de avaliacao de risco utilizados (Probabilidade x Severidade), a fundamentacao tecnica do programa ergonomico e o uso de inteligencia artificial na analise. O sistema aplica esse documento para atender a exigencia da NR-01 de que a empresa mantenha criterios documentados de gestao de riscos.',
      '(2) Relatorio de Comunicacao aos Trabalhadores (RQ-19/20) — informa aos colaboradores sobre os riscos identificados em seus postos de trabalho e as medidas de controle adotadas. O sistema aplica esse documento para atender a obrigacao da NR-01 de que os resultados da gestao de riscos sejam comunicados aos trabalhadores. Recomenda-se distribui-lo ou fixa-lo em murais como evidencia de cumprimento.',
      'Para gerar esses documentos, acesse a aba correspondente no modulo. O sistema preenche automaticamente as informacoes com base no inventario de riscos existente. Voce pode exportar em PDF e o documento e automaticamente arquivado no modulo de Documentos da plataforma para fins de governanca.',
    ],
    dica: "Conformidade: Guarde os documentos gerados por pelo menos 5 anos. Em caso de acidente de trabalho ou acao trabalhista, esses registros demonstram que a empresa adotou medidas preventivas e cumpriu suas obrigacoes de gestao de riscos. O sistema arquiva automaticamente, mas recomenda-se manter copias de seguranca.",
  },
  {
    num: "09",
    titulo: "Integracao com Outros Modulos",
    subtitulo: "Como a ergonomia se conecta com a saude e o psicossocial",
    cor: ROXO,
    paragrafos: [
      'O modulo de Ergonomia nao funciona de forma isolada. Ele se integra nativamente com outros modulos da plataforma para fornecer uma visao completa da saude ocupacional: (1) Psicossocial — os dados das campanhas psicossociais (indicadores e fatores de risco) alimentam automaticamente a AEP e o Motor AET. Quando indicadores psicossociais sinalizam nivel critico, o sistema cruza essas informacoes com os riscos ergonomicos para identificar sobrecargas combinadas.',
      '(2) Saude / Atestados — afastamentos por LER/DORT (lesoes por esforco repetitivo) sao cruzados com os postos de trabalho registrados no GRO. Quando a taxa de afastamentos por doenca ergonomica supera o esperado, o sistema gera um alerta de "Contraprova Organizacional" que corrobora os riscos identificados na avaliacao. (3) Plano de Acao Global — todas as acoes criadas no modulo de ergonomia aparecem no Plano de Acao Global da empresa, onde qualquer gestor pode acompanhar o progresso.',
      '(4) Compliance SST — o Score de Maturidade GRO e o inventario de riscos sao exportaveis para o PGR (Programa de Gerenciamento de Riscos), documento central exigido pela NR-01. O sistema permite gerar o PGR consolidado com dados de ergonomia, psicossocial e saude em um unico relatorio auditavel.',
    ],
    dica: "Visao integrada: Uma empresa que usa o modulo de Ergonomia em conjunto com Psicossocial e Saude tem uma gestao muito mais robusta. Os tres modulos se complementam: o psicossocial identifica o estresse percebido, a ergonomia identifica os fatores fisicos/organizacionais que causam esse estresse, e o modulo de saude confirma os impactos por meio dos indicadores de absenteismo e doencas.",
  },
];

// Fluxo resumido
const FLUXO_LINHAS: { etapa: string; sistema: string; cor: RGB }[] = [
  { etapa: "Criar AEP",                sistema: "Setor + Funcao ou atividade | 6 dominios baseados em NR-17 e ISO 45003 | Metadados da empresa",   cor: VERDE },
  { etapa: "Cadastrar Riscos no GRO",  sistema: "Probabilidade x Severidade = Nivel de Risco (1-25) | Classificacao automatica pelo sistema",        cor: AZUL },
  { etapa: "Motor AET analisa",        sistema: "Recomendacoes tecnicas Prioritarias, Recomendadas e Sugeridas | Integra dados psicossociais",       cor: AMBER },
  { etapa: "Risco Alto ou Critico",    sistema: "Plano de Acao 5W2H vinculado | Prazo sugerido: 30d (Critico) | 60d (Alto) | Bloqueio sem acao",    cor: VERMELHO },
  { etapa: "Analise por IA",           sistema: "Descricao ou foto do posto > Diagnostico + Riscos + Recomendacoes > Salvo na Base Ergonomica",     cor: ROXO },
  { etapa: "Executar Acoes",           sistema: "Atualizar progresso 0-100% | Anexar evidencias | Monitorar prazos",                                cor: LARANJA },
  { etapa: "Gerar Documentos",         sistema: "Metodologia (RQ-26) + Comunicacao Trabalhadores (RQ-19/20) exportados em PDF",                     cor: VERDE },
  { etapa: "Monitorar Score GRO",      sistema: "Score 0-100% de maturidade do programa | Auxilia na preparacao para auditorias NR-01",             cor: AZUL },
  { etapa: "Reavaliar anualmente",     sistema: "Atualizar inventario | Revisar acoes concluidas | Manter PGR atualizado",                          cor: VERDE },
];

// Glossário
const GLOSSARIO: [string, string][] = [
  ["GRO",           "Gerenciamento de Riscos Ocupacionais. Inventario sistematizado de todos os riscos identificados na empresa, exigido pela NR-01."],
  ["PGR",           "Programa de Gerenciamento de Riscos. Documento central exigido pela NR-01 que inclui o inventario GRO e os planos de acao."],
  ["AEP",           "Analise Ergonomica Preliminar. Abordagem inicial recomendada para mapear condicoes de trabalho por funcao ou atividade, antes de estudos mais aprofundados."],
  ["AET",           "Analise Ergonomica do Trabalho. Estudo tecnico detalhado de uma situacao de trabalho especifica, recomendado pela NR-17 em situacoes de maior complexidade ou criticidade."],
  ["NR-01",         "Norma Regulamentadora 1 — estabelece a obrigacao das empresas de identificar, avaliar e controlar riscos ocupacionais e manter o PGR atualizado."],
  ["NR-17",         "Norma Regulamentadora 17 — estabelece os parametros para adaptacao das condicoes de trabalho as caracteristicas psicofisiologicas dos trabalhadores, incluindo mobiliario, equipamentos, condicoes ambientais e organizacao do trabalho."],
  ["ISO 45001",     "Norma internacional de sistema de gestao de saude e seguranca ocupacional."],
  ["ISO 45003",     "Norma internacional com diretrizes para gestao de riscos psicossociais no trabalho, utilizada como referencia pelo sistema."],
  ["P x S",         "Probabilidade x Severidade. Metodo de calculo adotado pelo sistema para determinar o nivel de risco: probabilidade de ocorrencia (1-5) multiplicada pela severidade do dano (1-5)."],
  ["Score GRO",     "Indicador de 0-100% calculado pelo sistema para medir o nivel de maturidade do programa ergonomico em relacao as boas praticas e exigencias normativas."],
  ["LER/DORT",      "Lesoes por Esforco Repetitivo / Doencas Osteomusculares Relacionadas ao Trabalho. Doencas causadas por movimentos repetitivos, postura inadequada ou sobrecarga fisica."],
  ["5W2H",          "Modelo de plano de acao estruturado: O que, Por que, Onde, Quando, Quem, Como e Quanto custa."],
  ["Sit. Trabalho", "Unidade de analise ergonomica — normalmente representada por setor, funcao ou atividade, agrupando trabalhadores com condicoes de trabalho semelhantes."],
  ["RQ-26",         "Documento de Metodologia Ergonomica — registra os criterios tecnicos utilizados no programa ergonomico da empresa."],
  ["RQ-19/20",      "Relatorio de Comunicacao aos Trabalhadores — informa colaboradores sobre riscos identificados e medidas de controle adotadas."],
];

export function ManualErgonomia() {
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
        stroke(doc, VERDE);
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
          `Seguramente - Manual do Usuario | Ergonomia Inteligente | Pagina ${cur}/${total}`,
          pageW / 2, pageH - 8, { align: "center" }
        );
      };

      // ── CAPA ─────────────────────────────────────────────────────────────
      fill(doc, VERDE);
      doc.rect(0, 0, pageW, pageH, "F");

      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.text("MANUAL DO USUARIO", margin, 62);
      doc.setFontSize(20);
      doc.text("Ergonomia Inteligente", margin, 76);
      doc.setFontSize(14);
      doc.text("GRO / AEP / AET - NR-17", margin, 88);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(209, 250, 229);
      doc.text("Guia completo para RH, gestores e tecnicos de SST", margin, 106);
      doc.text("sem linguagem tecnica complicada.", margin, 114);

      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(margin, 124, pageW - margin, 124);

      doc.setFontSize(8.5);
      doc.setTextColor(167, 243, 208);
      doc.text("NR-01  |  NR-17  |  ISO 45001  |  ISO 45003  |  GRO / PGR", pageW / 2, 133, { align: "center" });

      // Fluxo visual na capa
      const etapasCapa = ["AEP", "GRO", "Motor AET", "Plano Acao", "Documentos", "Monitoramento"];
      const boxW = (pageW - 2 * margin - (etapasCapa.length - 1) * 2) / etapasCapa.length;
      const boxY = 148;
      etapasCapa.forEach((etapa, i) => {
        const bx = margin + i * (boxW + 2);
        doc.setFillColor(4, 120, 87);
        doc.roundedRect(bx, boxY, boxW, 14, 1, 1, "F");
        doc.setFontSize(6);
        doc.setTextColor(255, 255, 255);
        doc.text(etapa, bx + boxW / 2, boxY + 9, { align: "center" });
      });

      doc.setFontSize(8);
      doc.setTextColor(167, 243, 208);
      doc.text(
        `Emitido em ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
        margin, pageH - 20
      );
      doc.text("seguramente.app", pageW - margin, pageH - 20, { align: "right" });

      rodape();

      // ── SUMARIO ──────────────────────────────────────────────────────────
      doc.addPage();
      y = margin + 4;

      fill(doc, VERDE);
      doc.rect(0, 0, pageW, 28, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("SUMARIO", margin, 18);

      y = 40;
      const itens = [
        ["Cap. 01", "Visao Geral do Modulo de Ergonomia",                           "3"],
        ["Cap. 02", "Passo 1 — Analise Ergonomica Preliminar (AEP)",                 "4"],
        ["Cap. 03", "Passo 2 — Inventario GRO",                                      "5"],
        ["Cap. 04", "Passo 3 — Motor AET (Recomendacoes Tecnicas)",                  "6"],
        ["Cap. 05", "Passo 4 — Analise por Inteligencia Artificial",                 "7"],
        ["Cap. 06", "Passo 5 — Plano de Acao Ergonomico",                            "8"],
        ["Cap. 07", "Ciclo PDCA e Score de Maturidade GRO",                          "9"],
        ["Cap. 08", "Documentos Obrigatorios — Metodologia e Comunicacao",           "10"],
        ["Cap. 09", "Integracao com Outros Modulos",                                 "11"],
        ["---",     "Fluxo Resumido do GRO",                                         "12"],
        ["---",     "Glossario de Termos",                                            "13"],
      ];

      doc.setFontSize(9);
      itens.forEach(([num, titulo, pag], i) => {
        const bgYi = y - 4;
        if (i % 2 === 0) {
          doc.setFillColor(236, 253, 245);
          doc.rect(margin, bgYi, pageW - 2 * margin, 8, "F");
        }
        doc.setFont("helvetica", "bold");
        text(doc, VERDE);
        doc.text(num, margin + 2, y + 1);
        doc.setFont("helvetica", "normal");
        text(doc, CINZA);
        doc.text(titulo, margin + 28, y + 1);
        text(doc, MUTED);
        doc.text(`pag. ${pag}`, pageW - margin - 2, y + 1, { align: "right" });
        y += 10;
      });

      y += 6;
      fill(doc, VERDE_LIGHT);
      doc.roundedRect(margin, y, pageW - 2 * margin, 36, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      text(doc, VERDE);
      doc.text("Para quem e este manual?", margin + 4, y + 7);
      doc.setFont("helvetica", "normal");
      text(doc, CINZA);
      const introLinhas = doc.splitTextToSize(
        "Este manual foi escrito para gestores de RH, responsaveis por Saude e Seguranca do Trabalho (SST), engenheiros de seguranca e qualquer lider que precise gerenciar riscos ergonomicos sem ser especialista na area. Voce nao precisa conhecer normas tecnicas - o sistema aplica a legislacao automaticamente. Seu papel e tomar as decisoes; o Seguramente cuida da conformidade.",
        pageW - 2 * margin - 8
      );
      doc.setFontSize(8.5);
      introLinhas.forEach((line: string, i: number) => {
        doc.text(line, margin + 4, y + 16 + i * 5);
      });

      rodape();

      // ── PASSOS ───────────────────────────────────────────────────────────
      PASSOS.forEach((passo) => {
        addPage();
        y = margin + 4;

        fill(doc, passo.cor);
        doc.roundedRect(margin, y, pageW - 2 * margin, 22, 2, 2, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        text(doc, WHITE);
        const tituloLinhas = doc.splitTextToSize(
          `${passo.num}. ${passo.titulo}`,
          pageW - 2 * margin - 8
        );
        tituloLinhas.forEach((linha: string, i: number) => {
          doc.text(linha, margin + 4, y + 8 + i * 6);
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(209, 250, 229);
        doc.text(passo.subtitulo, margin + 4, y + 18);

        y += 28;

        passo.paragrafos.forEach((par) => {
          const linhas = doc.splitTextToSize(par, pageW - 2 * margin);
          const alturaBloco = linhas.length * 5 + 6;
          checkY(alturaBloco);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          text(doc, CINZA);
          linhas.forEach((linha: string) => {
            doc.text(linha, margin, y);
            y += 5;
          });
          y += 4;
        });

        // Caixa de dica
        const dicaLinhas = doc.splitTextToSize(passo.dica, pageW - 2 * margin - 10);
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
        doc.text("Atencao / Dica:", margin + 4, y + 5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 53, 15);
        dicaLinhas.forEach((linha: string, i: number) => {
          doc.text(linha, margin + 4, y + 10 + i * 4.8);
        });
        y += dicaAltura + 8;

        rodape();
      });

      // ── FLUXO RESUMIDO ────────────────────────────────────────────────────
      addPage();
      y = margin + 4;

      fill(doc, VERDE);
      doc.rect(0, 0, pageW, 28, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("FLUXO RESUMIDO DO GRO ERGONOMICO", margin, 18);

      y = 36;

      FLUXO_LINHAS.forEach(({ etapa, sistema, cor }, i) => {
        checkY(14);

        const rowY = y;
        // Numero da etapa
        fill(doc, cor);
        doc.roundedRect(margin, rowY, 8, 10, 1, 1, "F");
        text(doc, WHITE);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text(String(i + 1), margin + 4, rowY + 7, { align: "center" });

        // Coluna etapa
        text(doc, cor);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        const cw1 = 48;
        const etapaLinhas = doc.splitTextToSize(etapa, cw1);
        etapaLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 11, rowY + 4 + li * 4.5);
        });

        // Coluna sistema
        text(doc, CINZA);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.8);
        const cw2 = pageW - 2 * margin - 62;
        const sistLinhas = doc.splitTextToSize(sistema, cw2);
        sistLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 62, rowY + 4 + li * 4.5);
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

      fill(doc, VERDE);
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
          doc.setFillColor(236, 253, 245);
          doc.rect(margin, y - 3, pageW - 2 * margin, rowH, "F");
        }

        text(doc, VERDE);
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
      fill(doc, VERDE);
      doc.rect(0, 0, pageW, pageH, "F");

      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Obrigado por usar o Seguramente!", pageW / 2, pageH / 2 - 20, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(209, 250, 229);
      const finalLinhas = doc.splitTextToSize(
        "Este manual foi gerado automaticamente pela plataforma. Para suporte, acesse o modulo de Suporte no menu lateral ou entre em contato com nossa equipe.",
        pageW - 2 * margin
      );
      finalLinhas.forEach((l: string, i: number) => {
        doc.text(l, pageW / 2, pageH / 2 - 6 + i * 6, { align: "center" });
      });

      doc.setFontSize(9);
      doc.setTextColor(167, 243, 208);
      doc.text("seguramente.app", pageW / 2, pageH / 2 + 20, { align: "center" });
      doc.text(
        `Gerado em ${format(new Date(), "dd/MM/yyyy 'as' HH:mm")}`,
        pageW / 2, pageH / 2 + 28, { align: "center" }
      );

      rodape();

      doc.save(`Manual_Ergonomia_Seguramente_${format(new Date(), "yyyy-MM-dd")}.pdf`);
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
      className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
    >
      {gerando ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Gerando Manual...</>
      ) : (
        <><BookOpen className="h-4 w-4" /> Baixar Manual PDF</>
      )}
    </Button>
  );
}
