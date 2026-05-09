// Catálogo padrão de Grupos Homogêneos de Exposição (GHE)
// Baseado em estrutura ocupacional + camada psicossocial (NR-1).
// Cada categoria abre uma lista de "templates" pré-configurados
// que pré-preenchem nome e descrição ao criar um novo GHE.

export interface GHETemplate {
  ref: string; // código de referência padrão (ex.: GHE-ADM-001)
  nome: string;
  descricao: string;
}

export interface GHECategoria {
  id: string;
  label: string;
  emoji: string;
  cor: string; // tailwind classes para o cartão de seleção
  templates: GHETemplate[];
}

export const GHE_CATEGORIAS: GHECategoria[] = [
  {
    id: "adm",
    label: "Administrativo / escritório",
    emoji: "🏢",
    cor: "from-blue-500/10 to-blue-500/5 border-blue-500/30",
    templates: [
      { ref: "GHE-ADM-001", nome: "Administrativo geral", descricao: "Escritório, rotinas administrativas, arquivos, atendimento interno." },
      { ref: "GHE-ADM-002", nome: "Financeiro / contábil / fiscal", descricao: "Atividades administrativas financeiras e documentais." },
      { ref: "GHE-ADM-003", nome: "Recursos humanos / departamento pessoal", descricao: "RH, folha, admissão, desligamento, atendimento a colaboradores." },
      { ref: "GHE-ADM-004", nome: "Compras / suprimentos", descricao: "Cotação, compras, contato com fornecedores, controle de pedidos." },
      { ref: "GHE-ADM-005", nome: "Diretoria / gestão estratégica", descricao: "Sócios, diretores, gestores administrativos." },
      { ref: "GHE-ADM-006", nome: "Liderança operacional", descricao: "Supervisores, encarregados, coordenadores de operação." },
      { ref: "GHE-ADM-011", nome: "Tecnologia da informação", descricao: "Suporte técnico, desenvolvimento, infraestrutura de TI." },
      { ref: "GHE-ADM-012", nome: "Marketing / comunicação / criação", descricao: "Social media, design, conteúdo, tráfego, comunicação." },
    ],
  },
  {
    id: "atendimento",
    label: "Atendimento ao público",
    emoji: "🎧",
    cor: "from-cyan-500/10 to-cyan-500/5 border-cyan-500/30",
    templates: [
      { ref: "GHE-ADM-007", nome: "Recepção / atendimento presencial", descricao: "Recepcionistas, portaria administrativa, atendimento ao público." },
      { ref: "GHE-ADM-008", nome: "Call center / atendimento remoto", descricao: "Teleatendimento, SAC, suporte por telefone/WhatsApp/chat." },
      { ref: "GHE-PSI-002", nome: "Atendimento ao público conflituoso", descricao: "SAC, recepção, cobrança, fiscalização, reclamações." },
    ],
  },
  {
    id: "comercial-int",
    label: "Comercial interno",
    emoji: "💼",
    cor: "from-indigo-500/10 to-indigo-500/5 border-indigo-500/30",
    templates: [
      { ref: "GHE-ADM-009", nome: "Comercial interno", descricao: "Vendedores internos, SDR, pré-vendas, televendas." },
    ],
  },
  {
    id: "comercial-ext",
    label: "Comercial externo",
    emoji: "🚗",
    cor: "from-violet-500/10 to-violet-500/5 border-violet-500/30",
    templates: [
      { ref: "GHE-ADM-010", nome: "Comercial externo", descricao: "Vendedores em campo, representantes, visitas a clientes." },
    ],
  },
  {
    id: "producao",
    label: "Produção industrial",
    emoji: "🏭",
    cor: "from-orange-500/10 to-orange-500/5 border-orange-500/30",
    templates: [
      { ref: "GHE-IND-001", nome: "Produção geral", descricao: "Operadores de linha, produção seriada, atividades repetitivas." },
      { ref: "GHE-IND-003", nome: "Preparação de matéria-prima", descricao: "Separação, mistura, pesagem, abastecimento de insumos." },
      { ref: "GHE-IND-004", nome: "Mistura / formulação / batelada", descricao: "Manipulação de produtos químicos, tintas, alimentos, massas." },
      { ref: "GHE-IND-005", nome: "Envase / embalagem", descricao: "Envase, fechamento, rotulagem, embalagem final." },
      { ref: "GHE-IND-006", nome: "Montagem manual", descricao: "Montagem de peças, componentes, kits ou produtos." },
      { ref: "GHE-IND-007", nome: "Acabamento / revisão final", descricao: "Lixamento, polimento, limpeza final, inspeção visual." },
      { ref: "GHE-IND-008", nome: "Controle de qualidade", descricao: "Inspeção, testes, amostragens, laboratório simples." },
      { ref: "GHE-IND-017", nome: "Produção alimentícia", descricao: "Manipulação, preparo, cocção e embalagem de alimentos." },
      { ref: "GHE-IND-018", nome: "Produção química", descricao: "Manipulação, mistura e fracionamento de químicos." },
      { ref: "GHE-IND-019", nome: "Produção plástica", descricao: "Injeção, extrusão, sopro, termoformagem." },
      { ref: "GHE-IND-020", nome: "Produção metalúrgica", descricao: "Usinagem, fundição, solda, corte, conformação." },
    ],
  },
  {
    id: "maquinas",
    label: "Operação de máquinas",
    emoji: "⚙️",
    cor: "from-zinc-500/10 to-zinc-500/5 border-zinc-500/30",
    templates: [
      { ref: "GHE-IND-002", nome: "Operador de máquina", descricao: "Máquinas industriais, prensas, injetoras, tornos, extrusoras." },
      { ref: "GHE-IND-011", nome: "Corte / dobra / conformação", descricao: "Corte de metal, madeira, tecido, papel, plástico." },
      { ref: "GHE-IND-012", nome: "Soldagem / caldeiraria", descricao: "Soldadores, caldeireiros, serralheiros industriais." },
      { ref: "GHE-IND-013", nome: "Pintura / aplicação química", descricao: "Pintura industrial, cabine, verniz, solventes." },
      { ref: "GHE-IND-014", nome: "Marcenaria / carpintaria", descricao: "Corte, lixamento, montagem de móveis, MDF, madeira." },
      { ref: "GHE-IND-015", nome: "Costura / confecção", descricao: "Costureiras, operadores têxteis, acabamento de peças." },
      { ref: "GHE-IND-016", nome: "Gráfica / impressão", descricao: "Impressão, acabamento gráfico, tintas, solventes." },
    ],
  },
  {
    id: "manutencao",
    label: "Manutenção",
    emoji: "🔧",
    cor: "from-amber-500/10 to-amber-500/5 border-amber-500/30",
    templates: [
      { ref: "GHE-MAN-001", nome: "Manutenção geral", descricao: "Reparos prediais, pequenos consertos, apoio técnico." },
      { ref: "GHE-MAN-002", nome: "Manutenção elétrica", descricao: "Eletricistas, painéis, instalações, comandos." },
      { ref: "GHE-MAN-003", nome: "Manutenção mecânica", descricao: "Mecânicos industriais, equipamentos, motores." },
      { ref: "GHE-MAN-004", nome: "Manutenção hidráulica", descricao: "Bombas, tubulações, redes hidráulicas." },
      { ref: "GHE-MAN-005", nome: "Manutenção predial", descricao: "Pintura, alvenaria, reparos estruturais." },
      { ref: "GHE-MAN-006", nome: "Refrigeração / climatização", descricao: "Ar-condicionado, câmaras frias, sistemas de refrigeração." },
      { ref: "GHE-MAN-007", nome: "Jardinagem / áreas externas", descricao: "Roçada, poda, jardinagem, manutenção externa." },
    ],
  },
  {
    id: "limpeza",
    label: "Limpeza e conservação",
    emoji: "🧹",
    cor: "from-teal-500/10 to-teal-500/5 border-teal-500/30",
    templates: [
      { ref: "GHE-MAN-008", nome: "Limpeza e conservação", descricao: "Higienização de ambientes, banheiros, áreas comuns." },
      { ref: "GHE-MAN-009", nome: "Limpeza hospitalar / contaminada", descricao: "Limpeza com risco biológico ou material contaminado." },
      { ref: "GHE-MAN-010", nome: "Lavanderia", descricao: "Lavagem, secagem, dobra, separação de roupas." },
    ],
  },
  {
    id: "logistica",
    label: "Logística / estoque",
    emoji: "📦",
    cor: "from-yellow-500/10 to-yellow-500/5 border-yellow-500/30",
    templates: [
      { ref: "GHE-LOG-001", nome: "Almoxarifado / estoque", descricao: "Recebimento, armazenagem, separação de materiais." },
      { ref: "GHE-LOG-002", nome: "Expedição", descricao: "Conferência, embalagem, carregamento, despacho." },
      { ref: "GHE-LOG-003", nome: "Carga e descarga manual", descricao: "Movimentação manual intensa de cargas." },
      { ref: "GHE-LOG-004", nome: "Operador de empilhadeira", descricao: "Empilhadeiras, paleteiras elétricas, movimentação mecanizada." },
      { ref: "GHE-LOG-009", nome: "Estoquista de loja", descricao: "Estoque interno de comércio varejista." },
      { ref: "GHE-LOG-010", nome: "Operação em doca / pátio", descricao: "Pátios, docas, conferência externa, movimentação de veículos." },
    ],
  },
  {
    id: "motoristas",
    label: "Motoristas / transporte",
    emoji: "🚚",
    cor: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/30",
    templates: [
      { ref: "GHE-LOG-005", nome: "Motorista urbano", descricao: "Entregas locais, condução urbana." },
      { ref: "GHE-LOG-006", nome: "Motorista rodoviário", descricao: "Viagens, transporte intermunicipal/interestadual." },
      { ref: "GHE-LOG-007", nome: "Motoboy / entregador", descricao: "Motocicleta, entregas rápidas, trânsito urbano." },
      { ref: "GHE-LOG-008", nome: "Ajudante de motorista", descricao: "Apoio em entrega, carga, descarga e conferência." },
      { ref: "GHE-LOG-011", nome: "Transporte de passageiros", descricao: "Motoristas de van, ônibus, transporte corporativo." },
      { ref: "GHE-LOG-012", nome: "Transporte de produtos perigosos", descricao: "Químicos, inflamáveis, gases, produtos controlados." },
    ],
  },
  {
    id: "obras",
    label: "Construção civil / obras",
    emoji: "🏗️",
    cor: "from-stone-500/10 to-stone-500/5 border-stone-500/30",
    templates: [
      { ref: "GHE-OBR-001", nome: "Administração de obra", descricao: "Engenharia, mestre, técnico, apontador." },
      { ref: "GHE-OBR-002", nome: "Pedreiro / alvenaria", descricao: "Alvenaria, reboco, concreto, acabamento." },
      { ref: "GHE-OBR-003", nome: "Servente / ajudante de obra", descricao: "Apoio geral, transporte manual, limpeza de obra." },
      { ref: "GHE-OBR-009", nome: "Operação de máquinas pesadas", descricao: "Retroescavadeira, pá carregadeira, escavadeira." },
      { ref: "GHE-OBR-010", nome: "Trabalho em altura (obra)", descricao: "Telhado, andaime, fachada, plataforma." },
      { ref: "GHE-OBR-011", nome: "Pavimentação / asfalto", descricao: "Asfalto, calor, máquinas, via pública." },
      { ref: "GHE-OBR-012", nome: "Saneamento / redes", descricao: "Água, esgoto, drenagem, valas." },
    ],
  },
  {
    id: "saude",
    label: "Saúde / cuidado / assistência",
    emoji: "🩺",
    cor: "from-rose-500/10 to-rose-500/5 border-rose-500/30",
    templates: [
      { ref: "GHE-SAU-001", nome: "Atendimento clínico geral", descricao: "Clínicas, consultórios, atendimento assistencial." },
      { ref: "GHE-SAU-002", nome: "Enfermagem", descricao: "Técnicos, auxiliares e enfermeiros." },
      { ref: "GHE-SAU-003", nome: "Cuidadores / home care", descricao: "Cuidado domiciliar, idosos, pacientes assistidos." },
      { ref: "GHE-SAU-004", nome: "Médicos / profissionais assistenciais", descricao: "Atendimento médico e multiprofissional." },
      { ref: "GHE-SAU-005", nome: "Odontologia", descricao: "Dentistas, ASB, TSB, clínicas odontológicas." },
      { ref: "GHE-SAU-006", nome: "Fisioterapia / reabilitação", descricao: "Atendimento físico, manipulação de pacientes." },
      { ref: "GHE-SAU-007", nome: "Laboratório de análises clínicas", descricao: "Coleta, análise, manipulação de amostras." },
      { ref: "GHE-SAU-008", nome: "Farmácia hospitalar", descricao: "Medicamentos, dispensação, controle hospitalar." },
      { ref: "GHE-SAU-009", nome: "CME / esterilização", descricao: "Limpeza, preparo e esterilização de materiais." },
      { ref: "GHE-SAU-010", nome: "Radiologia / imagem", descricao: "Raio-X, tomografia, imagem diagnóstica." },
      { ref: "GHE-SAU-011", nome: "Casa de repouso", descricao: "Cuidado de idosos em instituição." },
      { ref: "GHE-SAU-012", nome: "Ambulância / remoção", descricao: "Socorristas, motoristas, remoção de pacientes." },
      { ref: "GHE-PSI-010", nome: "Trabalho com sofrimento humano", descricao: "Saúde, assistência social, cuidado de idosos, luto." },
    ],
  },
  {
    id: "educacao",
    label: "Educação / treinamento",
    emoji: "🎓",
    cor: "from-sky-500/10 to-sky-500/5 border-sky-500/30",
    templates: [
      { ref: "GHE-EDU-001", nome: "Professores / instrutores", descricao: "Sala de aula, treinamentos, cursos." },
      { ref: "GHE-EDU-002", nome: "Coordenação pedagógica", descricao: "Gestão pedagógica, orientação, reuniões." },
      { ref: "GHE-EDU-003", nome: "Monitoria / apoio escolar", descricao: "Apoio a alunos, recreação, acompanhamento." },
      { ref: "GHE-EDU-004", nome: "Berçário / educação infantil", descricao: "Cuidado infantil, troca, alimentação, recreação." },
      { ref: "GHE-EDU-005", nome: "Secretaria escolar", descricao: "Atendimento, matrícula, registros." },
      { ref: "GHE-EDU-006", nome: "Laboratório escolar", descricao: "Laboratórios de ciência, informática, práticas." },
      { ref: "GHE-EDU-007", nome: "Educação física / esportes", descricao: "Atividades físicas, quadra, academia, campo." },
    ],
  },
  {
    id: "alimentacao",
    label: "Alimentação / cozinha",
    emoji: "🍳",
    cor: "from-red-500/10 to-red-500/5 border-red-500/30",
    templates: [
      { ref: "GHE-ALI-001", nome: "Cozinha industrial / restaurante", descricao: "Preparo, cocção, fornos, alta temperatura, vapor." },
      { ref: "GHE-ALI-002", nome: "Atendimento em salão / garçom", descricao: "Atendimento direto a clientes em bares e restaurantes." },
      { ref: "GHE-ALI-003", nome: "Padaria / confeitaria", descricao: "Fornos, preparo, manipulação de alimentos." },
      { ref: "GHE-ALI-004", nome: "Hotelaria / camareira", descricao: "Limpeza de quartos, troca de roupa, atendimento hoteleiro." },
    ],
  },
  {
    id: "comercio",
    label: "Comércio / varejo",
    emoji: "🛍️",
    cor: "from-pink-500/10 to-pink-500/5 border-pink-500/30",
    templates: [
      { ref: "GHE-COM-001", nome: "Vendedor de loja", descricao: "Atendimento em loja, exposição de produtos, vendas presenciais." },
      { ref: "GHE-COM-002", nome: "Caixa / operador de checkout", descricao: "Registro de compras, recebimento, caixa." },
      { ref: "GHE-COM-003", nome: "Repositor", descricao: "Reposição de mercadorias, prateleiras, estoque de loja." },
      { ref: "GHE-COM-005", nome: "Balconista", descricao: "Atendimento em balcão, pedidos, separação simples." },
      { ref: "GHE-COM-006", nome: "Promotor / demonstrador", descricao: "Demonstração de produtos, ações promocionais." },
      { ref: "GHE-COM-007", nome: "Açougue / frios", descricao: "Corte, manipulação de carnes, frios e câmaras frias." },
      { ref: "GHE-COM-009", nome: "Farmácia / drogaria", descricao: "Atendimento, dispensação, estoque de medicamentos." },
      { ref: "GHE-COM-010", nome: "Posto de combustível", descricao: "Frentistas, pista, combustíveis, lubrificantes." },
      { ref: "GHE-COM-011", nome: "Loja de materiais de construção", descricao: "Venda, movimentação de cargas, tintas, ferramentas." },
      { ref: "GHE-COM-012", nome: "E-commerce / separação de pedidos", descricao: "Picking, packing, embalagem e despacho." },
    ],
  },
  {
    id: "agro",
    label: "Agro / campo",
    emoji: "🌾",
    cor: "from-lime-500/10 to-lime-500/5 border-lime-500/30",
    templates: [
      { ref: "GHE-AGR-001", nome: "Trabalhador rural geral", descricao: "Atividades de campo variadas." },
      { ref: "GHE-AGR-002", nome: "Plantio / colheita manual", descricao: "Agricultura manual, exposição solar, esforço físico." },
      { ref: "GHE-AGR-003", nome: "Operador de máquinas agrícolas", descricao: "Trator, colheitadeira, pulverizador." },
      { ref: "GHE-AGR-004", nome: "Aplicação de defensivos", descricao: "Agrotóxicos, pulverização, mistura e preparo." },
      { ref: "GHE-AGR-005", nome: "Pecuária / manejo animal", descricao: "Bovinos, suínos, aves, equinos." },
      { ref: "GHE-AGR-006", nome: "Ordenha / leite", descricao: "Ordenha, higienização, manejo leiteiro." },
      { ref: "GHE-AGR-007", nome: "Silvicultura / reflorestamento", descricao: "Corte, plantio, manejo florestal." },
      { ref: "GHE-AGR-008", nome: "Jardinagem pesada / roçagem", descricao: "Roçadeira, motosserra, áreas externas." },
      { ref: "GHE-AGR-009", nome: "Veterinária / cuidado animal", descricao: "Clínicas, banho e tosa, manejo de animais." },
      { ref: "GHE-AGR-010", nome: "Frigorífico / abate", descricao: "Abate, cortes, câmaras frias." },
    ],
  },
  {
    id: "seguranca",
    label: "Segurança / vigilância",
    emoji: "🛡️",
    cor: "from-slate-500/10 to-slate-500/5 border-slate-500/30",
    templates: [
      { ref: "GHE-MAN-011", nome: "Segurança patrimonial / vigilância", descricao: "Vigilantes, controle de acesso, rondas." },
      { ref: "GHE-MAN-012", nome: "Portaria / controle de acesso", descricao: "Porteiros, recepção operacional, guarita." },
      { ref: "GHE-RIS-001", nome: "Brigada / emergência interna", descricao: "Resposta a emergências, simulações, apoio." },
      { ref: "GHE-RIS-002", nome: "Bombeiro civil", descricao: "Prevenção e combate a incêndio." },
      { ref: "GHE-RIS-009", nome: "Segurança armada", descricao: "Vigilância armada, transporte de valores." },
      { ref: "GHE-PSI-009", nome: "Exposição a violência externa", descricao: "Segurança, atendimento público, transporte, fiscalização." },
    ],
  },
  {
    id: "beleza",
    label: "Beleza / estética / bem-estar",
    emoji: "💇",
    cor: "from-fuchsia-500/10 to-fuchsia-500/5 border-fuchsia-500/30",
    templates: [
      { ref: "GHE-BEA-001", nome: "Cabeleireiro / barbeiro", descricao: "Corte, química, secador, atendimento." },
      { ref: "GHE-BEA-002", nome: "Manicure / pedicure", descricao: "Instrumentos, esmaltes, contato com pele." },
      { ref: "GHE-BEA-003", nome: "Esteticista", descricao: "Procedimentos estéticos, cosméticos, equipamentos." },
      { ref: "GHE-BEA-004", nome: "Massoterapia / terapia corporal", descricao: "Atendimento corporal, esforço físico, postura." },
      { ref: "GHE-BEA-005", nome: "Personal trainer / instrutor", descricao: "Orientação física, equipamentos, academia." },
    ],
  },
  {
    id: "tecnologia",
    label: "Tecnologia / alta carga cognitiva",
    emoji: "🧠",
    cor: "from-purple-500/10 to-purple-500/5 border-purple-500/30",
    templates: [
      { ref: "GHE-PSI-007", nome: "Alta carga cognitiva", descricao: "TI, engenharia, controle, análise técnica." },
      { ref: "GHE-PSI-011", nome: "Trabalho remoto / híbrido", descricao: "Teletrabalho, home office, isolamento digital." },
    ],
  },
  {
    id: "ext-cliente",
    label: "Trabalho externo / cliente",
    emoji: "🧳",
    cor: "from-blue-400/10 to-blue-400/5 border-blue-400/30",
    templates: [
      { ref: "GHE-EXT-001", nome: "Trabalho externo / em cliente", descricao: "Atividades em campo ou na operação do cliente, longe da base." },
    ],
  },
  {
    id: "altura",
    label: "Trabalho em altura",
    emoji: "🪜",
    cor: "from-orange-400/10 to-orange-400/5 border-orange-400/30",
    templates: [
      { ref: "GHE-RIS-004", nome: "Trabalho em altura específico", descricao: "Atividades com NR-35." },
    ],
  },
  {
    id: "confinado",
    label: "Espaço confinado",
    emoji: "🕳️",
    cor: "from-zinc-600/10 to-zinc-600/5 border-zinc-600/30",
    templates: [
      { ref: "GHE-RIS-003", nome: "Espaço confinado", descricao: "Atividades com NR-33." },
    ],
  },
  {
    id: "quimicos",
    label: "Produtos químicos",
    emoji: "🧪",
    cor: "from-green-500/10 to-green-500/5 border-green-500/30",
    templates: [
      { ref: "GHE-RIS-006", nome: "Produtos inflamáveis", descricao: "Combustíveis, solventes, armazenamento inflamável." },
      { ref: "GHE-RIS-007", nome: "Produtos químicos perigosos", descricao: "Manipulação, transporte ou armazenamento químico." },
      { ref: "GHE-RIS-008", nome: "Radiação ionizante", descricao: "Radiologia, medicina nuclear, fontes radioativas." },
    ],
  },
  {
    id: "frio",
    label: "Frio / câmara fria",
    emoji: "❄️",
    cor: "from-cyan-400/10 to-cyan-400/5 border-cyan-400/30",
    templates: [
      { ref: "GHE-IND-010", nome: "Operação com frio", descricao: "Câmaras frias, frigoríficos, congelados, resfriados." },
    ],
  },
  {
    id: "calor",
    label: "Calor / fornos / fundição",
    emoji: "🔥",
    cor: "from-red-500/10 to-red-500/5 border-red-500/30",
    templates: [
      { ref: "GHE-IND-009", nome: "Operação com calor", descricao: "Fornos, caldeiras, estufas, cocção, fundição." },
    ],
  },
  {
    id: "emocional",
    label: "Alta demanda emocional",
    emoji: "💗",
    cor: "from-rose-400/10 to-rose-400/5 border-rose-400/30",
    templates: [
      { ref: "GHE-PSI-001", nome: "Alta demanda emocional", descricao: "Saúde, atendimento difícil, cuidado, reclamações, suporte." },
    ],
  },
  {
    id: "pressao-metas",
    label: "Alta pressão por metas",
    emoji: "🎯",
    cor: "from-amber-400/10 to-amber-400/5 border-amber-400/30",
    templates: [
      { ref: "GHE-PSI-003", nome: "Alta pressão por metas", descricao: "Comercial, call center, produção por meta." },
      { ref: "GHE-PSI-004", nome: "Liderança com responsabilidade crítica", descricao: "Gestores, supervisores, líderes de equipe." },
    ],
  },
  {
    id: "noturno",
    label: "Trabalho noturno / turnos",
    emoji: "🌙",
    cor: "from-indigo-400/10 to-indigo-400/5 border-indigo-400/30",
    templates: [
      { ref: "GHE-PSI-006", nome: "Trabalho em turno / noturno", descricao: "Escalas, plantões, madrugada." },
      { ref: "GHE-PSI-005", nome: "Trabalho isolado", descricao: "Vigilância, portaria noturna, campo remoto." },
      { ref: "GHE-RIS-010", nome: "Operação noturna isolada", descricao: "Trabalho noturno, isolamento, risco psicossocial/segurança." },
    ],
  },
  {
    id: "remoto",
    label: "Trabalho remoto / híbrido",
    emoji: "🏠",
    cor: "from-teal-400/10 to-teal-400/5 border-teal-400/30",
    templates: [
      { ref: "GHE-PSI-011", nome: "Trabalho remoto / híbrido", descricao: "Teletrabalho, home office, isolamento digital." },
      { ref: "GHE-PSI-008", nome: "Baixa autonomia / trabalho repetitivo", descricao: "Produção repetitiva, teleatendimento, linha." },
      { ref: "GHE-PSI-012", nome: "Mudança organizacional intensa", descricao: "Reestruturação, fusão, redução de equipe, troca de gestão." },
    ],
  },
  {
    id: "outro",
    label: "Outro / personalizado",
    emoji: "✏️",
    cor: "from-gray-500/10 to-gray-500/5 border-gray-500/30",
    templates: [
      { ref: "GHE-CUS-000", nome: "GHE personalizado", descricao: "Defina manualmente o nome e a descrição do grupo." },
    ],
  },
];
