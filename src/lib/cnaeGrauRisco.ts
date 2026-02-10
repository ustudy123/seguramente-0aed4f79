/**
 * Mapeamento CNAE → Grau de Risco conforme Anexo I da NR-04
 * Baseado na Classificação Nacional de Atividades Econômicas (CNAE 2.0)
 * 
 * Chave: código CNAE subclasse (7 dígitos, sem formatação) ou divisão (2 dígitos)
 * Valor: Grau de Risco (1 a 4)
 * 
 * Busca hierárquica: subclasse → classe → grupo → divisão
 */

// Mapeamento por divisão CNAE (2 dígitos) - fallback geral
const DIVISAO_GR: Record<string, number> = {
  // A - Agricultura, Pecuária, Produção Florestal, Pesca e Aquicultura
  '01': 3, '02': 3, '03': 3,
  // B - Indústrias Extrativas
  '05': 4, '06': 2, '07': 4, '08': 4, '09': 3,
  // C - Indústrias de Transformação
  '10': 3, '11': 3, '12': 3, '13': 3, '14': 2, '15': 3,
  '16': 3, '17': 3, '18': 3, '19': 3, '20': 3, '21': 3,
  '22': 3, '23': 3, '24': 4, '25': 3, '26': 2, '27': 3,
  '28': 3, '29': 3, '30': 3, '31': 3, '32': 2, '33': 2,
  // D - Eletricidade e Gás
  '35': 3,
  // E - Água, Esgoto, Atividades de Gestão de Resíduos
  '36': 3, '37': 3, '38': 3, '39': 3,
  // F - Construção
  '41': 3, '42': 4, '43': 3,
  // G - Comércio; Reparação de Veículos
  '45': 2, '46': 2, '47': 2,
  // H - Transporte, Armazenagem e Correio
  '49': 3, '50': 3, '51': 2, '52': 2, '53': 2,
  // I - Alojamento e Alimentação
  '55': 2, '56': 2,
  // J - Informação e Comunicação
  '58': 1, '59': 2, '60': 1, '61': 2, '62': 2, '63': 1,
  // K - Atividades Financeiras
  '64': 1, '65': 1, '66': 1,
  // L - Atividades Imobiliárias
  '68': 1,
  // M - Atividades Profissionais, Científicas e Técnicas
  '69': 1, '70': 1, '71': 1, '72': 1, '73': 1, '74': 1, '75': 2,
  // N - Atividades Administrativas
  '77': 1, '78': 2, '79': 1, '80': 2, '81': 3, '82': 1,
  // O - Administração Pública
  '84': 2,
  // P - Educação
  '85': 2,
  // Q - Saúde Humana e Serviços Sociais
  '86': 3, '87': 2, '88': 2,
  // R - Artes, Cultura, Esporte e Recreação
  '90': 2, '91': 2, '92': 2, '93': 2,
  // S - Outras Atividades de Serviços
  '94': 1, '95': 2, '96': 2,
  // T - Serviços Domésticos
  '97': 2,
  // U - Organismos Internacionais
  '99': 1,
};

// Mapeamento mais detalhado por grupo CNAE (3-4 dígitos) quando difere da divisão
const GRUPO_GR: Record<string, number> = {
  // Agricultura - variações
  '011': 3, '012': 3, '013': 3, '014': 3, '015': 3, '016': 3,
  '017': 3, '021': 2, '022': 3, '023': 3, '031': 3, '032': 3,
  // Indústrias extrativas
  '050': 4, '060': 2, '071': 4, '072': 4, '081': 4, '089': 4,
  '091': 3, '099': 3,
  // Alimentos
  '101': 3, '102': 3, '103': 3, '104': 3, '105': 3,
  '106': 4, '107': 4, '108': 3, '109': 3,
  // Bebidas e Fumo
  '111': 3, '112': 3, '121': 3, '122': 3,
  // Têxteis
  '131': 3, '132': 3, '133': 3, '134': 3, '135': 3,
  // Confecções
  '141': 2, '142': 2,
  // Couro e Calçados
  '151': 3, '152': 3, '153': 3,
  // Madeira
  '161': 3, '162': 3,
  // Celulose e Papel
  '170': 3, '171': 3, '172': 3,
  // Impressão
  '181': 3, '182': 3,
  // Petróleo e Combustíveis
  '191': 3, '192': 3,
  // Químicos
  '201': 3, '202': 3, '203': 3, '204': 3, '205': 3, '206': 3, '207': 3, '209': 3,
  // Farmacêuticos
  '211': 3, '212': 3,
  // Borracha e Plástico
  '221': 3, '222': 3,
  // Minerais não metálicos
  '231': 4, '232': 3, '233': 3, '234': 3, '239': 3,
  // Metalurgia
  '241': 4, '242': 4, '243': 4, '244': 4,
  // Produtos de metal
  '251': 3, '252': 3, '253': 3, '254': 3, '255': 3, '259': 3,
  // Informática e eletrônicos
  '261': 2, '262': 2, '263': 2, '264': 2, '265': 2, '266': 2, '267': 2, '268': 2,
  // Máquinas e equipamentos elétricos
  '271': 3, '272': 3, '273': 3, '274': 3, '275': 3, '279': 3,
  // Máquinas e equipamentos
  '281': 3, '282': 3, '283': 3, '284': 3,
  // Veículos
  '291': 3, '292': 3, '293': 3,
  // Outros equipamentos de transporte
  '301': 3, '302': 3, '303': 3, '304': 3, '309': 3,
  // Móveis
  '310': 3,
  // Diversos
  '321': 2, '322': 2, '323': 2, '324': 2, '325': 2, '329': 2,
  // Manutenção e instalação
  '331': 3, '332': 3,
  // Eletricidade e gás
  '351': 3, '352': 3, '353': 3,
  // Construção
  '411': 3, '412': 3, '421': 4, '422': 4, '429': 4,
  '431': 3, '432': 3, '433': 3, '439': 3,
  // Comércio de veículos
  '451': 2, '452': 2, '453': 2, '454': 2,
  // Transporte terrestre
  '491': 3, '492': 3, '493': 3,
  // Transporte aquaviário
  '501': 3, '502': 3,
  // Transporte aéreo
  '511': 2, '512': 3,
  // Armazenagem
  '521': 2, '522': 2,
  // Saúde
  '861': 3, '862': 3, '863': 3, '864': 3, '865': 3, '866': 3, '869': 3,
};

/**
 * Limpa o código CNAE removendo caracteres não numéricos
 */
function cleanCnaeCode(cnae: string): string {
  return cnae.replace(/\D/g, '');
}

/**
 * Busca o Grau de Risco para um código CNAE.
 * Faz busca hierárquica: grupo (3 dígitos) → divisão (2 dígitos)
 * 
 * @param cnae Código CNAE (qualquer formato: "4120-4/00", "41204", "4120400", etc.)
 * @returns Grau de Risco (1-4) ou null se não encontrado
 */
export function getGrauRiscoByCnae(cnae: string): number | null {
  const cleaned = cleanCnaeCode(cnae);
  if (cleaned.length < 2) return null;

  // Tentar por grupo (3 primeiros dígitos)
  const grupo = cleaned.substring(0, 3);
  if (GRUPO_GR[grupo] !== undefined) {
    return GRUPO_GR[grupo];
  }

  // Fallback por divisão (2 primeiros dígitos)
  const divisao = cleaned.substring(0, 2);
  if (DIVISAO_GR[divisao] !== undefined) {
    return DIVISAO_GR[divisao];
  }

  return null;
}

/**
 * Retorna a descrição do grau de risco
 */
export function getGrauRiscoLabel(grau: number): string {
  switch (grau) {
    case 1: return '1 - Risco Mínimo';
    case 2: return '2 - Risco Menor';
    case 3: return '3 - Risco Médio';
    case 4: return '4 - Risco Grave';
    default: return '';
  }
}
