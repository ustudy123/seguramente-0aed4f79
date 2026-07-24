/**
 * Ações de referência do Plano de Ação PGR — Psicossocial, por porte da empresa.
 *
 * Transcrição dos modelos da SudoMed (Engenharia e Medicina do Trabalho) para
 * os 13 fatores do catálogo `catalogoRiscosPsicossociais`. Os três documentos
 * cobrem os mesmos fatores; o que muda é a profundidade da intervenção, os
 * responsáveis e os recursos pressupostos.
 *
 * Uso duplo:
 *  1. Base (few-shot) para a IA gerar opções no registro certo para o porte.
 *  2. Fallback determinístico quando a IA falha ou não está disponível — assim
 *     o plano nunca fica vazio, que é o que importa num documento probatório.
 *
 * Os campos "Data Inicial", "Até quando" e "Quanto" vêm em branco nos modelos
 * originais: os dois primeiros são calculados (encerramento da campanha + prazo
 * do nível de GRO) e o terceiro é decidido pela empresa.
 */
import type { PorteEmpresa } from "@/lib/porteEmpresa";

export interface AcaoReferencia {
  oQue: string;
  quem: string;
  onde: string;
  porQue: string;
  como: string;
}

/** fatorId -> ação de referência daquele porte. */
export type ReferenciasPorFator = Record<string, AcaoReferencia>;

export const ACOES_REFERENCIA: Record<PorteEmpresa, ReferenciasPorFator> = {
  mei: {
    "eventos-violentos": {
      oQue: "Estruturar Protocolo de Primeiros Socorros em Saúde Mental (PSSM) e Fluxo de Emergência Pós-Incidente",
      quem: "Responsável por SST / Consultoria SudoMed",
      onde: "Todas as áreas operacionais e administrativas",
      porQue: "Prevenir quadros de estresse pós-traumático e acolher trabalhadores em situações extremas",
      como: "Elaborar e afixar o fluxograma de acolhimento imediato e orientar a liderança sobre encaminhamento rápido à rede de saúde",
    },
    "assedio": {
      oQue: "Implementar Código de Conduta e realizar DSS sobre respeito no ambiente de trabalho",
      quem: "Proprietário / Gestor Direto + Consultoria SudoMed",
      onde: "Quadro de avisos e reuniões presenciais",
      porQue: "Erradicar condutas abusivas e atender aos requisitos da Lei 14.457/22 e NR-01",
      como: "Apresentar a política de tolerância zero em reunião de equipe e disponibilizar canal direto de escuta",
    },
    "excesso-demandas": {
      oQue: "Organizar fluxo de prioridades semanais e definir pausas curtas regulares",
      quem: "Liderança Operacional",
      onde: "Setor operacional/atendimento",
      porQue: "Mitigar a exaustão física e mental provocada pela alta intensidade do ritmo de trabalho",
      como: "Criar quadro visual de tarefas (Kanban simples) e fixar intervalo obrigatório de 10-15 minutos no meio do turno",
    },
    "baixa-clareza-papel": {
      oQue: "Elaborar e validar a Descrição Funcional Simplificada de cada trabalhador",
      quem: "Proprietário com apoio da SudoMed",
      onde: "Todos os postos de trabalho",
      porQue: "Eliminar ambiguidades, sobreposição de tarefas e conflitos de expectativas interpessoais",
      como: "Mapear as atividades reais do dia a dia e formalizar documento assinado por gestor e colaborador",
    },
    "baixo-controle": {
      oQue: "Estabelecer Procedimentos Operacionais Padrão (POP) com margens de autonomia explícitas",
      quem: "Responsável do setor / Proprietário",
      onde: "Rotinas operacionais diárias",
      porQue: "Reduzir a dependência de aprovação constante do proprietário e aumentar o sentimento de controle do trabalhador",
      como: "Mapear decisões simples do cotidiano e autorizar a equipe a executá-las de acordo com o POP",
    },
    "falta-suporte": {
      oQue: "Instituir Reunião de Alinhamento Semanal e Escuta Ativa",
      quem: "Gestor Direto / Proprietário",
      onde: "Sala de reuniões ou espaço comum",
      porQue: "Prover suporte prático e emocional na resolução de gargalos das atividades",
      como: "Realizar encontros rápidos de 15 minutos para analisar impedimentos e orientar as demandas da semana",
    },
    "mas-relacoes": {
      oQue: "Realizar Workshop Prático sobre Comunicação Não Violenta (CNV) e Respeito Mútuo",
      quem: "Psicólogo / Treinador SudoMed",
      onde: "Local de trabalho",
      porQue: "Melhorar o clima organizacional e diminuir atritos interpessoais no ambiente de trabalho",
      como: "Ministrar palestra interativa de 1 hora abordando escuta empática e mediação de divergências",
    },
    "baixa-justica": {
      oQue: "Redigir e divulgar o Regulamento Interno Simplificado",
      quem: "Proprietário / Gestão",
      onde: "Mural interno e cópia individual",
      porQue: "Garantir transparência e critérios iguais na divisão de escalas, folgas e benefícios",
      como: "Detalhar regras claras sobre horários, trocas de turno e critérios de reconhecimento, entregando cópia para a equipe",
    },
    "baixas-recompensas": {
      oQue: "Implementar Rituais de Feedback Positivo e Agradecimento Verbal",
      quem: "Liderança Direta / Proprietário",
      onde: "Reuniões semanais e no dia a dia operacional",
      porQue: "Aumentar o engajamento e a percepção de valorização do esforço individual",
      como: "Criar o hábito de elogiar metas alcançadas durante as reuniões semanais e feedbacks individuais",
    },
    "ma-gestao-mudancas": {
      oQue: "Criar protocolo de Comunicação Prévia de Mudanças de Processos/Horários",
      quem: "Gestão / Proprietário",
      onde: "Reunião geral ou canal oficial de mensagens",
      porQue: "Diminuir a ansiedade e a resistência geradas por alterações repentinas na rotina laboral",
      como: "Informar com no mínimo 5 dias de antecedência qualquer mudança operacional, explicando os motivos e o impacto",
    },
    "trabalho-remoto-isolado": {
      oQue: "Implantar o Termo de Boas Práticas e Rituais de Check-in Virtual",
      quem: "Liderança Direta",
      onde: "Modalidade Home Office / Trabalho Externo",
      porQue: "Evitar a sensação de isolamento e assegurar o direito à desconexão fora do horário contratual",
      como: "Estabelecer chamada diária rápida de 5 minutos de início do dia e restringir mensagens após a jornada regular",
    },
    "baixa-demanda": {
      oQue: "Criar Plano de Polivalência e Capacitação Cruzada",
      quem: "Liderança Operacional",
      onde: "Setor operacional",
      porQue: "Evitar o desinteresse, a apatia e o sentimento de inutilidade profissional",
      como: "Treinar colaboradores para apoiar setores correlatos em períodos de baixa movimentação no seu posto de origem",
    },
    "dificil-comunicacao": {
      oQue: "Fornecer canais/equipamentos eficientes de comunicação instantânea",
      quem: "Suporte Operacional / Compras",
      onde: "Atividades de campo / Áreas isoladas",
      porQue: "Garantir alinhamento em tempo real e segurança operacional nas tarefas",
      como: "Padronizar a utilização de aplicativos de comunicação imediata ou rádio comunicador durante atendimentos externos",
    },
  },
  pequeno_medio: {
    "eventos-violentos": {
      oQue: "Estruturar o Protocolo Institucional de PSSM (Primeiros Socorros em Saúde Mental) e o Fluxo de Contingência Pós-Incidente",
      quem: "Equipe de SST / RH + Consultoria SudoMed",
      onde: "Todas as unidades e setores operacionais/administrativos",
      porQue: "Oferecer contenção imediata, prevenir estresse pós-traumático e orientar gestores sobre o acolhimento institucional",
      como: "Elaborar guia técnico de PSSM, capacitar os facilitadores internos/RH e divulgar o fluxo formal de atendimento pós-crise",
    },
    "assedio": {
      oQue: "Implementar Canal de Denúncias Resguardado, Comissão de Ética e Treinamento Antiassédio para Líderes",
      quem: "RH / Jurídico / Consultoria SudoMed",
      onde: "Corporativo / Todas as filiais e setores",
      porQue: "Atender integralmente à Lei 14.457/22, NR-01 e assegurar ambiente isento de abusos morais e sexuais",
      como: "Divulgar a Política de Tolerância Zero, estruturar fluxo anônimo de apuração de denúncias e ministrar workshop obrigatório para a gestão",
    },
    "excesso-demandas": {
      oQue: "Mapear a carga de trabalho, reorganizar processos críticos e instituir a Gestão de Pausas Ativas",
      quem: "Gestores de Departamento / RH Operacional",
      onde: "Setores com alto volume produtivo ou atendimento ao cliente",
      porQue: "Prevenir o esgotamento profissional (Burnout) e a redução da eficiência operacional decorrente do cansaço",
      como: "Aplicar matriz de dimensionamento de equipe, redistribuir fluxos operacionais e formalizar intervalos de descompressão diários",
    },
    "baixa-clareza-papel": {
      oQue: "Reestruturar a Descrição de Cargos e implementar o Mapeamento de Competências e Responsabilidades",
      quem: "RH / Gestores de Área",
      onde: "Todos os quadros funcionais da empresa",
      porQue: "Eliminar o conflito de papéis, evitar a ambiguidade funcional e alinhar entregas esperadas",
      como: "Revisar o organograma, atualizar a descrição das funções e realizar reuniões de alinhamento individual com a equipe",
    },
    "baixo-controle": {
      oQue: "Implantar a Metodologia de Delegação Progressiva e padronizar Procedimentos Operacionais (POPs)",
      quem: "Gerência / Lideranças Intermediárias",
      onde: "Setores operacionais e administrativos",
      porQue: "Reduzir a rigidez e o microgerenciamento, elevando a autonomia e o engajamento dos colaboradores",
      como: "Definir faixas de alçada de decisão por nível funcional e capacitar os gestores na delegação responsável de tarefas",
    },
    "falta-suporte": {
      oQue: "Implementar Programa de Desenvolvimento de Lideranças Facilitadoras e Rituais de Feedback Contínuo",
      quem: "RH / Consultoria SudoMed",
      onde: "Todos os níveis de liderança da organização",
      porQue: "Treinar gestores para atuarem como elementos de suporte técnico, relacional e emocional da equipe",
      como: "Realizar encontros mensais de desenvolvimento de líderes focados em comunicação assertiva, escuta ativa e suporte operacional",
    },
    "mas-relacoes": {
      oQue: "Realizar Ciclo de Rodas de Conversa e Workshops de Comunicação Não Violenta (CNV)",
      quem: "Psicólogo Ocupacional / Treinadores SudoMed",
      onde: "Auditório / Salas de Treinamento da empresa",
      porQue: "Desenvolver a inteligência emocional coletiva e solucionar atritos interpessoais no ambiente de trabalho",
      como: "Promover dinâmicas de grupo mediadas por especialista para abordar mediação de conflitos e empatia corporativa",
    },
    "baixa-justica": {
      oQue: "Atualizar o Regimento Interno e estruturar critérios transparentes para Promoção e Escalas",
      quem: "RH / Diretoria",
      onde: "Todos os setores da organização",
      porQue: "Garantir imparcialidade, equidade de tratamento e transparência nas decisões de gestão de pessoas",
      como: "Formalizar regras transparentes para banco de horas, folgas, substituições e critérios objetivos para avanço na carreira",
    },
    "baixas-recompensas": {
      oQue: "Estruturar Programa Institucional de Reconhecimento e Valorização Profissional",
      quem: "RH / Marketing Interno / Gestão",
      onde: "Toda a empresa",
      porQue: "Aumentar o sentimento de pertencimento, motivação e valorização do capital humano",
      como: "Criar rituais mensais de reconhecimento (ex: metas batidas, destaques de segurança/inovação) e feedbacks estruturados",
    },
    "ma-gestao-mudancas": {
      oQue: "Elaborar o Plano Integrado de Gestão de Mudanças e Comunicação Interna",
      quem: "Diretoria / Comunicação / RH",
      onde: "Toda a estrutura organizacional",
      porQue: "Reduzir a insegurança, o estresse e os boatos durante reestruturações ou trocas de sistemas/processos",
      como: "Instituir reuniões gerais (Town Halls) prévias e canais para tirar dúvidas sobre grandes transformações da empresa",
    },
    "trabalho-remoto-isolado": {
      oQue: "Elaborar a Política de Teletrabalho / Trabalho Híbrido e Garantia do Direito à Desconexão",
      quem: "RH / Gestores diretos",
      onde: "Colaboradores em Home Office ou campo isolado",
      porQue: "Prevenir o isolamento social/profissional e evitar a invasão do trabalho na vida privada",
      como: "Implantar chamadas diárias de alinhamento, eventos de integração presenciais periódicos e proibir mensagens fora do horário formal",
    },
    "baixa-demanda": {
      oQue: "Implementar o Programa de Enriquecimento de Cargos e Job Rotation (Rotação de Funções)",
      quem: "Gestores de Área / RH",
      onde: "Setores operacionais ou administrativos com oscilação de demanda",
      porQue: "Eliminar o desinteresse, o tédio profissional e promover o desenvolvimento contínuo de competências",
      como: "Mapear oportunidades de aprendizado em outras áreas e incluir o profissional em projetos transversais nos períodos ociosos",
    },
    "dificil-comunicacao": {
      oQue: "Padronizar Canais Oficiais de Comunicação e Fornecer Infraestrutura Tecnológica de Campo",
      quem: "TI / Infraestrutura / SST",
      onde: "Equipes externas, unidades remotas ou frentes de campo",
      porQue: "Assegurar o fluxo de dados em tempo real, suporte rápido em contingências e alinhamento constante",
      como: "Fornecer smartphones/rádios empresariais com planos de dados adequados e criar protocolos claros de contato para emergências",
    },
  },
  grande: {
    "eventos-violentos": {
      oQue: "Instituir o Protocolo Corporativo de Crise, PSSM (Primeiros Socorros em Saúde Mental) e Rede de Acolhimento Terciário",
      quem: "Comitê Multidisciplinar de Saúde Mental / RH / EHS + Consultoria SudoMed",
      onde: "Todas as plantas operacionais, filiais e unidades corporativas",
      porQue: "Garantir resposta imediata padronizada a eventos críticos, mitigar estresse pós-traumático e cumprir a ISO 45003",
      como: "Formar brigada de facilitadores de PSSM, contratar programa de assistência ao empregado (PAE 24/7) e criar protocolo de contenção de graves incidentes",
    },
    "assedio": {
      oQue: "Estruturar Ouvidoria Independente, Comitê de Ética e Compliance Antiassédio Corporativo",
      quem: "Diretoria de Compliance / RH / Consultoria SudoMed",
      onde: "Toda a organização e cadeia de fornecedores diretos",
      porQue: "Atender rigorosamente à Lei 14.457/22, NR-01, mitigando riscos passivos e preservando a reputação institucional",
      como: "Contratar canal de denúncias terceirizado e auditável, instituir rito de apuração neutro com sanções claras e realizar treinamento mandatório para 100% dos líderes",
    },
    "excesso-demandas": {
      oQue: "Implementar Gestão de Carga de Trabalho por Metodologia Agil/Workload Assessment e Política de Pausas Sistêmicas",
      quem: "Diretoria de Operações / PMO / Medicina do Trabalho",
      onde: "Setores operacionais, de engenharia e corporativos",
      porQue: "Eliminar o esgotamento cronificado (Burnout), reduzindo o absenteísmo e o turnover crítico",
      como: "Auditar o dimensionamento de horas x entregas com softwares de gestão de recursos, redistribuir capacidades e estabelecer metas factíveis com pausas de descompressão",
    },
    "baixa-clareza-papel": {
      oQue: "Implementar Matriz RACI Corporativa e Atualização do Plano de Cargos, Carreiras e Salários (PCCS)",
      quem: "Gerência Executiva de RH / Consultoria Organizacional",
      onde: "Todos os departamentos e níveis hierárquicos",
      porQue: "Eliminar a ambiguidade funcional, a sobreposição de responsabilidades entre áreas e o estresse por indefinição de escopo",
      como: "Mapear fluxos de trabalho transversais, validar as matrizes RACI por diretoria e formalizar os perfis de cargo nos sistemas de RH",
    },
    "baixo-controle": {
      oQue: "Implementar Gestão por Objetivos e Resultados Chave (OKRs) e Programas de Autonomia Guiada",
      quem: "Gestores de Unidade / Comitê de Transformação Organizacional",
      onde: "Equipes operacionais, técnicas e administrativas",
      porQue: "Reduzir o microgerenciamento e elevar a percepção de autoeficácia e engajamento das equipes",
      como: "Migrar do controle rígido de processos para a gestão por indicadores de resultado, capacitando líderes em liderança delegativa e confiável",
    },
    "falta-suporte": {
      oQue: "Criar a Academia de Liderança Humana e o Programa de Mentoria Interna para Gestores",
      quem: "Desenvolvimento Humano Organizacional (DHO) / SudoMed",
      onde: "Todas as gerências, coordenações e supervisões",
      porQue: "Transformar a liderança em um fator de proteção psicossocial e suporte contínuo para as equipes",
      como: "Treinar 100% da liderança em gestão inclusiva, escuta ativa, inteligência emocional e identificação precoce de sofrimento mental",
    },
    "mas-relacoes": {
      oQue: "Implantar o Programa Permanente de Segurança Psicológica, Diversidade e Resolução Integrada de Conflitos",
      quem: "DHO / Psicologia Organizacional / SudoMed",
      onde: "Todas as unidades fabris e administrativas",
      porQue: "Cultivar um clima organizacional seguro, colaborativo e livre de discriminações ou comportamentos tóxicos",
      como: "Aplicar pesquisas periódicas de clima, realizar workshops interativos de CNV e instituir mediação especializada para conflitos interdepartamentais",
    },
    "baixa-justica": {
      oQue: "Estruturar a Governança Transparente de Movimentações Pessoais e Avaliações de Desempenho 360°",
      quem: "Comitê de Pessoas e Remuneração / RH",
      onde: "Toda a empresa",
      porQue: "Garantir equidade, imparcialidade e transparência nos processos de promoção, mérito e distribuição de metas",
      como: "Publicar a política corporativa de meritocracia, disponibilizar o painel de oportunidades internas e auditar os critérios de avaliação anual",
    },
    "baixas-recompensas": {
      oQue: "Reformular o Programa Corporativo de Reconhecimento do Capital Humano e Recompensas Não Financeiras",
      quem: "RH / Comunicação Interna",
      onde: "Todas as diretorias",
      porQue: "Aumentar a retenção de talentos e valorizar o esforço individual e coletivo alinhado aos valores organizacionais",
      como: "Implantar plataforma gamificada de reconhecimento entre pares, premiações anuais por inovação/segurança e rituais formais de elogio público",
    },
    "ma-gestao-mudancas": {
      oQue: "Implementar o Protocolo Corporativo de Gestão do Impacto de Mudanças (Projetos de M&A, Sistemas ou Estrutura)",
      quem: "Escritório de Gestão de Mudanças (CMO) / Comunicação Corporativa",
      onde: "Áreas impactadas por transformações estratégicas",
      porQue: "Minimizar o estresse coletivo, a queda de produtividade e a ansiedade decorrentes de transições organizacionais",
      como: "Elaborar plano de comunicação transparente em fases, criar comitês de escuta e monitorar o nível de estresse da equipe durante a transição",
    },
    "trabalho-remoto-isolado": {
      oQue: "Consolidar a Política Corporativa de Trabalho Híbrido, Nômade e Proteção do Direito à Desconexão",
      quem: "RH / TI / Jurídico / EHS",
      onde: "Trabalhadores administrativos em regime híbrido/remoto e equipes de campo isoladas",
      porQue: "Garantir o equilíbrio entre vida pessoal e profissional e evitar o isolamento social/operacional",
      como: "Bloquear disparo de e-mails/mensagens fora do expediente comercial via software e criar rituais virtuais de integração e encontros presenciais quinzenais",
    },
    "baixa-demanda": {
      oQue: "Estruturar o Programa de Mobilidade Interna e Desenvolvimento Transversal de Talentos",
      quem: "Gestores de Área / DHO",
      onde: "Setores operacionais ou técnicos com demanda sazonal/baixa",
      porQue: "Evitar o desengajamento, o subaproveitamento do potencial humano e a obsolescência profissional",
      como: "Mapear competências ociosas e direcionar colaboradores para squad projects, treinamentos cruzados e inovação aberta nos períodos de subcarga",
    },
    "dificil-comunicacao": {
      oQue: "Implementar Sistema Integrado de Comunicação Crítica de Campo e Monitoramento de Conectividade",
      quem: "TI / Gerência de Operações / EHS",
      onde: "Unidades remotas, plataformas externas, logística e campo",
      porQue: "Garantir a segurança operacional dos trabalhadores em locais isolados e a prontidão de socorro em emergências",
      como: "Equipar equipes externas com comunicação via satélite/rádio digital, redundância de redes e aplicativo de checagem periódica de segurança",
    },
  },
};

/** Ação de referência de um fator no porte informado. */
export function referenciaDoFator(
  porte: PorteEmpresa,
  fatorId: string,
): AcaoReferencia | undefined {
  return ACOES_REFERENCIA[porte]?.[fatorId];
}
