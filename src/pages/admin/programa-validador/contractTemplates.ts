import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Cliente, TipoDoc } from './types';

const LOGO_URL = 'https://seguramente.lovable.app/lovable-uploads/logo-seguramente.png';
const SUDOCLIN_CNPJ = '00.000.000/0001-00';

const ABNT_CSS = `
  @page { margin: 2.5cm 2.5cm 2cm 2.5cm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #1a1a1a;
    max-width: 800px;
    margin: 0 auto;
    padding: 0 40px 48px 40px;
    text-align: justify;
  }
  .contract-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 0;
    margin-bottom: 16px;
    border-bottom: 3px solid #7c3aed;
  }
  .contract-header img { height: 56px; }
  .contract-header-info {
    text-align: right;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    color: #666;
    line-height: 1.4;
  }
  .contract-header-info strong { color: #7c3aed; font-size: 10pt; }
  h1 {
    font-size: 14pt;
    text-align: center;
    text-transform: uppercase;
    font-weight: bold;
    margin: 0 0 4px 0;
    color: #1a1a1a;
  }
  h2 {
    font-size: 12pt;
    text-align: center;
    text-transform: uppercase;
    font-weight: normal;
    margin: 0 0 32px 0;
  }
  h3 {
    font-size: 12pt;
    text-align: center;
    text-transform: uppercase;
    font-weight: bold;
    margin: 40px 0 8px 0;
    border-top: 2px solid #7c3aed;
    padding-top: 12px;
    color: #7c3aed;
  }
  .partes {
    border: 1px solid #d4d4d8;
    border-left: 4px solid #7c3aed;
    padding: 16px 20px;
    margin: 24px 0;
    background: #faf5ff;
    border-radius: 4px;
  }
  .clausula { margin-top: 24px; }
  .clausula-titulo {
    font-weight: bold;
    text-transform: uppercase;
    display: block;
    margin-bottom: 6px;
    color: #4c1d95;
  }
  ul, ol { margin: 8px 0 8px 24px; }
  li { margin-bottom: 4px; }
  .page-break { page-break-before: always; border-top: none; margin-top: 40px; padding-top: 24px; }
  .assinaturas {
    display: flex;
    gap: 60px;
    margin-top: 60px;
  }
  .assinatura-bloco {
    flex: 1;
    border-top: 2px solid #7c3aed;
    padding-top: 8px;
    text-align: center;
  }
  .contract-footer {
    margin-top: 40px;
    padding-top: 12px;
    border-top: 1px solid #e4e4e7;
    text-align: center;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8pt;
    color: #999;
  }
  @media print {
    .no-print { display: none !important; }
    body { padding: 0; }
    .contract-header { padding: 12px 0; }
  }
  .print-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-bottom: 1px solid #e4e4e7;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    font-family: Arial, Helvetica, sans-serif;
  }
  .print-bar button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid #d4d4d8;
    background: #fff;
    color: #333;
    transition: all 0.15s;
  }
  .print-bar button:hover { background: #f4f4f5; }
  .print-bar .btn-primary {
    background: #7c3aed;
    color: #fff;
    border-color: #7c3aed;
  }
  .print-bar .btn-primary:hover { background: #6d28d9; }
  .has-print-bar { padding-top: 72px; }
`;

function gerarHeaderHtml(): string {
  return `
  <div class="print-bar no-print">
    <button onclick="window.print()">🖨️ Imprimir</button>
    <button class="btn-primary" onclick="(function(){var a=document.createElement('a');a.href='data:text/html;charset=utf-8,'+encodeURIComponent(document.documentElement.outerHTML);a.download='contrato.html';a.click();})()">⬇ Baixar</button>
  </div>
  <div class="contract-header">
    <img src="${LOGO_URL}" alt="Seguramente" onerror="this.style.display='none'" />
    <div class="contract-header-info">
      <strong>SEGURAMENTE TECNOLOGIA LTDA</strong><br>
      CNPJ: ${SUDOCLIN_CNPJ}<br>
      seguramente.app.br
    </div>
  </div>`;
}

function gerarFooterHtml(): string {
  return `
  <div class="contract-footer">
    Documento gerado eletronicamente pela plataforma Seguramente · seguramente.app.br<br>
    SEGURAMENTE TECNOLOGIA LTDA — CNPJ: ${SUDOCLIN_CNPJ}
  </div>`;
}

export function gerarHtmlContrato(cliente: Cliente): string {
  if (cliente.tipo_cliente === 'pagante') return gerarHtmlContratoPagante(cliente);
  return gerarHtmlContratoTester(cliente);
}

function gerarHtmlContratoTester(cliente: Cliente): string {
  const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const empresa = cliente.nome_empresa;
  const cnpj = cliente.cnpj || '___________________';
  const rep = cliente.representante || cliente.poc_nome || '___________________';
  const foro = cliente.cidade_foro || 'São Paulo';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Contrato — ${empresa}</title>
<style>${ABNT_CSS}</style>
</head>
<body class="has-print-bar">

${gerarHeaderHtml()}

<h1>CONTRATO DE PARTICIPAÇÃO NO PROGRAMA VALIDADOR</h1>
<h1>E USO DA PLATAFORMA SEGURAMENTE</h1>
<p style="text-align:center;margin-top:0;font-size:11pt;color:#555;">Instrumento Particular de Adesão ao Programa Validador</p>

<p>Pelo presente instrumento particular, celebrado entre as partes abaixo qualificadas:</p>

<div class="partes">
  <p><strong>CONTRATANTE (EMPRESA VALIDADORA):</strong><br>
  <strong>${empresa}</strong>, inscrita no CNPJ nº ${cnpj}${cliente.endereco ? `, com sede em ${cliente.endereco}` : ''}, neste ato representada por <strong>${rep}</strong>, doravante denominada simplesmente <strong>EMPRESA VALIDADORA</strong>.</p>
  <p style="margin-top:12px;margin-bottom:0;"><strong>CONTRATADA:</strong><br>
  <strong>SEGURAMENTE TECNOLOGIA LTDA</strong>, pessoa jurídica de direito privado, doravante denominada simplesmente <strong>SEGURAMENTE</strong>.</p>
</div>

<p>As partes acima identificadas têm, entre si, justo e contratado o presente instrumento, que se regerá pelas cláusulas e condições a seguir estipuladas.</p>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 1 – OBJETO</span>
  <p>O presente contrato tem por objeto a participação da EMPRESA VALIDADORA no Programa Validador da Plataforma Seguramente, permitindo o acesso e utilização da plataforma em fase de validação (Beta), nos termos e condições estabelecidos neste instrumento e em seus anexos.</p>
  <p>A plataforma Seguramente é um sistema digital destinado ao apoio à gestão organizacional, incluindo funcionalidades relacionadas a:</p>
  <ol type="I">
    <li>gestão de saúde e segurança do trabalho;</li>
    <li>organização de dados empresariais;</li>
    <li>indicadores organizacionais;</li>
    <li>avaliações organizacionais;</li>
    <li>gestão de processos internos.</li>
  </ol>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 2 – NATUREZA DO PROGRAMA</span>
  <p>A EMPRESA VALIDADORA declara ter pleno conhecimento e reconhece expressamente que:</p>
  <ol type="I">
    <li>o Seguramente encontra-se em fase de desenvolvimento e validação (Beta), sujeito a alterações e aprimoramentos;</li>
    <li>o sistema poderá sofrer atualizações, ajustes e melhorias ao longo do período contratual;</li>
    <li>eventuais falhas ou instabilidades técnicas podem ocorrer durante o período de validação, sem que isso configure inadimplemento por parte da SEGURAMENTE.</li>
  </ol>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 3 – PRAZO</span>
  <p>O Programa Validador terá duração de <strong>6 (seis) meses</strong>, contados a partir da data de liberação do acesso ao sistema para a EMPRESA VALIDADORA, podendo ser prorrogado por acordo entre as partes.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 4 – CONDIÇÕES COMERCIAIS</span>
  <p>Durante o período do Programa Validador, o acesso à plataforma será concedido à EMPRESA VALIDADORA de forma <strong>gratuita</strong>.</p>
  <p>Ao término do programa, a EMPRESA VALIDADORA terá direito a <strong>50% (cinquenta por cento) de desconto</strong> sobre o valor da assinatura mensal da plataforma, conforme plano a ser contratado, pelo período mínimo de 12 (doze) meses.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 5 – CONTRAPARTIDAS DA EMPRESA VALIDADORA</span>
  <p>Em contrapartida ao acesso gratuito à plataforma, a EMPRESA VALIDADORA se compromete expressamente a:</p>
  <ol type="I">
    <li>utilizar efetivamente a plataforma durante o período do programa;</li>
    <li>fornecer feedbacks estruturados sobre funcionalidades, usabilidade e desempenho;</li>
    <li>participar de reuniões periódicas de acompanhamento agendadas pela SEGURAMENTE;</li>
    <li>responder pesquisas de satisfação e avaliação;</li>
    <li>colaborar com a evolução e melhoria contínua do sistema.</li>
  </ol>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 6 – LIMITAÇÃO DE RESPONSABILIDADE</span>
  <p>A plataforma Seguramente constitui ferramenta de apoio à gestão organizacional e não substitui consultorias técnicas, jurídicas, contábeis ou de saúde especializadas.</p>
  <p>A SEGURAMENTE não se responsabiliza por quaisquer decisões tomadas pela EMPRESA VALIDADORA com base nas informações apresentadas pelo sistema, cabendo ao usuário a devida diligência na análise e interpretação dos dados.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 7 – SEGURANÇA DA INFORMAÇÃO</span>
  <p>A SEGURAMENTE adota medidas técnicas e organizacionais adequadas para proteção das informações armazenadas no sistema, incluindo criptografia de dados em repouso e em trânsito (TLS 1.2+), controle de acesso por autenticação, backups automáticos diários e monitoramento de segurança.</p>
  <p>Os dados são armazenados em infraestrutura de computação em nuvem segura (Supabase/AWS), localizada em servidores certificados.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 8 – PROTEÇÃO DE DADOS PESSOAIS (LGPD)</span>
  <p>As partes reconhecem e declaram que o tratamento de dados pessoais realizado no âmbito deste contrato observará rigorosamente as disposições da <strong>Lei n.º 13.709/2018 (Lei Geral de Proteção de Dados — LGPD)</strong>.</p>
  <p>A EMPRESA VALIDADORA atua como <strong>controladora</strong> dos dados inseridos na plataforma, sendo responsável pelas decisões sobre o tratamento desses dados, incluindo os de seus colaboradores.</p>
  <p>A SEGURAMENTE atua como <strong>operadora</strong>, processando os dados exclusivamente conforme as instruções da EMPRESA VALIDADORA e nos limites estabelecidos neste contrato e no Acordo de Tratamento de Dados (DPA), constante do Anexo III.</p>
  <p>Os dados inseridos no sistema são e permanecerão de propriedade exclusiva da EMPRESA VALIDADORA.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 9 – CONFIDENCIALIDADE</span>
  <p>As partes comprometem-se reciprocamente a manter sigilo absoluto sobre todas as informações, dados, documentos e know-how compartilhados no âmbito deste contrato, durante sua vigência e por 5 (cinco) anos após seu término, salvo nas hipóteses legalmente exigidas de divulgação.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 10 – PROPRIEDADE INTELECTUAL</span>
  <p>A plataforma Seguramente, incluindo seu código-fonte, design, interfaces, funcionalidades, marca e demais elementos, constitui propriedade intelectual exclusiva da SEGURAMENTE, protegida pela legislação brasileira de propriedade intelectual.</p>
  <p>O presente contrato não transfere à EMPRESA VALIDADORA qualquer direito de propriedade sobre a plataforma, sendo-lhe concedida apenas licença de uso não exclusiva e intransferível pelo período contratual.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 11 – DOCUMENTOS INTEGRANTES</span>
  <p>Fazem parte integrante deste contrato, para todos os fins legais, os seguintes anexos incorporados ao presente instrumento:</p>
  <ul>
    <li><strong>Anexo I</strong> — Termos de Uso da Plataforma Seguramente;</li>
    <li><strong>Anexo II</strong> — Política de Privacidade e Proteção de Dados;</li>
    <li><strong>Anexo III</strong> — Acordo de Tratamento de Dados (DPA) — LGPD;</li>
    <li><strong>Anexo IV</strong> — Anexo Operacional da Plataforma;</li>
    <li><strong>Anexo V</strong> — Regras do Programa Validador;</li>
    <li><strong>Anexo VI</strong> — FAQ de Segurança e Boas Práticas.</li>
  </ul>
  <p>A assinatura do presente contrato implica concordância integral com todos os anexos acima listados.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 12 – RESCISÃO E ENCERRAMENTO</span>
  <p>O presente contrato poderá ser rescindido por qualquer das partes, mediante notificação por escrito com antecedência mínima de 15 (quinze) dias, sem ônus para nenhuma das partes.</p>
  <p>Em caso de rescisão, a EMPRESA VALIDADORA terá o prazo de 30 (trinta) dias para exportar seus dados da plataforma, após o qual poderão ser eliminados pela SEGURAMENTE.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 13 – FORO</span>
  <p>Fica eleito o foro da comarca de <strong>${foro}</strong>, Estado de São Paulo, para dirimir eventuais dúvidas, litígios ou controvérsias decorrentes do presente contrato, com renúncia expressa de qualquer outro, por mais privilegiado que seja.</p>
</div>

<p style="margin-top:40px;">E, por estarem assim justas e contratadas, as partes assinam o presente instrumento, em via eletrônica, na data de sua assinatura digital.</p>
<p style="margin-top:8px;">Data de geração do contrato: <strong>${dataGeracao}</strong></p>

<div class="assinaturas">
  <div class="assinatura-bloco">
    <p><strong>EMPRESA VALIDADORA</strong></p>
    <p>${rep}</p>
    <p style="font-size:10pt;color:#555;">${empresa}<br>CNPJ: ${cnpj}</p>
  </div>
  <div class="assinatura-bloco">
    <p><strong>SEGURAMENTE TECNOLOGIA LTDA</strong></p>
    <p>Representante Legal</p>
  </div>
</div>

<!-- ═══════════════════ ANEXO I ═══════════════════ -->
<div class="page-break">
  <h3>ANEXO I — TERMOS DE USO DA PLATAFORMA SEGURAMENTE</h3>
  <p style="text-align:center;font-size:11pt;color:#555;">Integrante do Contrato de Participação no Programa Validador</p>

  <div class="clausula">
    <span class="clausula-titulo">1. ACEITAÇÃO DOS TERMOS</span>
    <p>Ao utilizar a plataforma Seguramente, o usuário e a EMPRESA VALIDADORA declaram ter lido, compreendido e concordado com os presentes Termos de Uso em sua integralidade. O uso da plataforma implica aceitação automática e irretratável destes termos.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">2. USO PERMITIDO</span>
    <p>A plataforma deve ser utilizada exclusivamente para fins legítimos de gestão empresarial, conforme seu objeto. É expressamente vedado o uso para fins ilícitos, difamatórios, fraudulentos ou que violem direitos de terceiros, a legislação brasileira ou normas regulatórias aplicáveis.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">3. RESPONSABILIDADES DO USUÁRIO</span>
    <p>O usuário é integralmente responsável pela veracidade, exatidão e integridade das informações inseridas na plataforma, bem como pela guarda e sigilo de suas credenciais de acesso. Qualquer atividade realizada mediante as credenciais do usuário será de sua exclusiva responsabilidade.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">4. PROPRIEDADE INTELECTUAL</span>
    <p>Todo o conteúdo, código-fonte, design, interfaces, logotipos e funcionalidades da plataforma são protegidos pelas leis de propriedade intelectual e são de titularidade exclusiva da SEGURAMENTE. É proibida qualquer reprodução, cópia ou redistribuição sem autorização prévia e expressa por escrito.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">5. DISPONIBILIDADE DO SERVIÇO</span>
    <p>A SEGURAMENTE envidará seus melhores esforços para manter a plataforma disponível em regime 24 (vinte e quatro) horas por dia, 7 (sete) dias por semana, mas não garante disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência mínima de 48 horas.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">6. MODIFICAÇÕES DOS TERMOS</span>
    <p>Os presentes termos poderão ser atualizados a qualquer tempo. Alterações significativas serão comunicadas com antecedência mínima de 30 (trinta) dias. O uso continuado da plataforma após comunicação de alterações implicará aceitação dos novos termos.</p>
  </div>
</div>

<!-- ═══════════════════ ANEXO II ═══════════════════ -->
<div class="page-break">
  <h3>ANEXO II — POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS</h3>
  <p style="text-align:center;font-size:11pt;color:#555;">Integrante do Contrato de Participação no Programa Validador</p>

  <div class="clausula">
    <span class="clausula-titulo">1. COLETA E TIPOS DE DADOS</span>
    <p>A SEGURAMENTE coleta e processa dados inseridos pelos usuários na plataforma, incluindo: dados de colaboradores (nome, CPF, data de nascimento, cargo, dados trabalhistas), dados de saúde ocupacional, documentos empresariais e dados de uso da plataforma (logs de acesso, ações realizadas, endereço IP).</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">2. FINALIDADE DO TRATAMENTO</span>
    <p>Os dados são tratados exclusivamente para viabilizar a prestação dos serviços contratados, incluindo gestão de saúde e segurança do trabalho, administração de pessoal e demais funcionalidades da plataforma. Não comercializamos dados pessoais nem os compartilhamos com terceiros para fins publicitários ou comerciais.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">3. PRAZO DE RETENÇÃO</span>
    <p>Os dados são mantidos pelo período de vigência contratual e por até 5 (cinco) anos após o encerramento do contrato, em atendimento às obrigações legais trabalhistas e tributárias brasileiras. Após esse prazo, serão eliminados de forma segura.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">4. DIREITOS DOS TITULARES</span>
    <p>Os titulares de dados pessoais têm direito a: acesso aos seus dados, correção de dados inexatos, portabilidade, eliminação, informação sobre compartilhamentos e revogação do consentimento. Solicitações devem ser encaminhadas para <strong>privacidade@seguramente.app.br</strong>.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">5. COOKIES E RASTREAMENTO</span>
    <p>Utilizamos cookies essenciais para o funcionamento da plataforma e cookies analíticos para melhoria do produto. O uso de ferramentas analíticas é realizado com anonimização de IP, em conformidade com a LGPD.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">6. SEGURANÇA E INCIDENTES</span>
    <p>Em caso de incidente de segurança que possa afetar dados pessoais, a SEGURAMENTE notificará a EMPRESA VALIDADORA e, quando exigido por lei, a Autoridade Nacional de Proteção de Dados (ANPD), no prazo de 72 (setenta e duas) horas após ciência do evento.</p>
  </div>
</div>

<!-- ═══════════════════ ANEXO III ═══════════════════ -->
<div class="page-break">
  <h3>ANEXO III — ACORDO DE TRATAMENTO DE DADOS (DPA)</h3>
  <p style="text-align:center;font-size:11pt;color:#555;">Data Processing Agreement — Integrante do Contrato de Participação no Programa Validador</p>

  <div class="partes" style="margin-top:20px;">
    <p><strong>CONTROLADOR:</strong> ${empresa}, CNPJ ${cnpj}, representada por ${rep}.</p>
    <p><strong>OPERADOR:</strong> SEGURAMENTE TECNOLOGIA LTDA.</p>
  </div>

  <div class="clausula">
    <span class="clausula-titulo">1. OBJETO DO ACORDO</span>
    <p>O presente Acordo de Tratamento de Dados regula o tratamento de dados pessoais realizado pela SEGURAMENTE na qualidade de operadora, conforme instruções do CONTROLADOR, no âmbito da Lei Geral de Proteção de Dados (Lei n.º 13.709/2018 — LGPD) e do Regulamento Geral de Proteção de Dados da União Europeia (GDPR), quando aplicável.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">2. CATEGORIAS DE DADOS TRATADOS</span>
    <p>O OPERADOR tratará, em nome do CONTROLADOR, as seguintes categorias de dados pessoais: dados identificadores de colaboradores (nome, CPF, RG, data de nascimento), dados profissionais (cargo, departamento, remuneração), dados de saúde ocupacional (atestados, laudos, ASOs) e dados trabalhistas em geral inseridos no sistema.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">3. FINALIDADES AUTORIZADAS</span>
    <p>O OPERADOR está autorizado a tratar os dados exclusivamente para: prestação dos serviços de gestão de saúde e segurança do trabalho, administração de pessoal, geração de relatórios e demais funcionalidades contratadas. É vedado qualquer tratamento para finalidades diversas sem autorização escrita prévia do CONTROLADOR.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">4. MEDIDAS DE SEGURANÇA</span>
    <p>O OPERADOR implementa e mantém as seguintes medidas técnicas e organizacionais: criptografia AES-256 em repouso e TLS 1.2+ em trânsito; autenticação multifator para acessos administrativos; controle de acesso baseado em funções (RBAC); backups automáticos diários com retenção de 30 dias; monitoramento contínuo de segurança; e política de resposta a incidentes documentada.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">5. SUBOPERADORES</span>
    <p>O OPERADOR utiliza os seguintes suboperadores, comprometendo-se a exigir deles padrões equivalentes de proteção de dados: <strong>Supabase Inc.</strong> (armazenamento e banco de dados, servidores AWS) e <strong>Amazon Web Services Inc.</strong> (infraestrutura de nuvem), ambos com sede nos EUA e certificações SOC 2 Type II.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">6. DIREITOS DOS TITULARES</span>
    <p>Quando o CONTROLADOR receber solicitação de titular de dados relacionada a dados tratados pelo OPERADOR, este último cooperará prontamente, fornecendo as informações e realizando as operações necessárias para atendimento da solicitação no prazo legal.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">7. VIGÊNCIA E ELIMINAÇÃO</span>
    <p>Este acordo vigorará enquanto o OPERADOR tratar dados em nome do CONTROLADOR. Ao término do contrato principal, o OPERADOR eliminará ou devolverá todos os dados pessoais, a critério do CONTROLADOR, no prazo de 30 (trinta) dias, salvo obrigação legal de retenção.</p>
  </div>
</div>

<!-- ═══════════════════ ANEXO IV ═══════════════════ -->
<div class="page-break">
  <h3>ANEXO IV — ANEXO OPERACIONAL DA PLATAFORMA</h3>
  <p style="text-align:center;font-size:11pt;color:#555;">Integrante do Contrato de Participação no Programa Validador</p>

  <div class="clausula">
    <span class="clausula-titulo">1. ACESSO E CREDENCIAIS</span>
    <p>O acesso à plataforma será concedido mediante credenciais individuais e intransferíveis, geradas após a conclusão da assinatura deste contrato. O número de usuários simultâneos permitidos durante o período beta será definido conjuntamente pelas partes na reunião de Kickoff.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">2. SUPORTE TÉCNICO</span>
    <p>O suporte técnico será prestado por meio de e-mail (suporte@seguramente.app.br) e WhatsApp, em horário comercial (segunda a sexta-feira, das 9h às 18h, horário de Brasília). O SLA de primeira resposta é de até 24 horas úteis para chamados de baixa prioridade e 4 horas úteis para chamados críticos.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">3. COMPROMISSOS DE FEEDBACK</span>
    <p>A EMPRESA VALIDADORA se compromete a participar de reuniões mensais de acompanhamento, com duração aproximada de 60 minutos, agendadas pela SEGURAMENTE, e a responder pesquisas de satisfação enviadas periodicamente, com prazo de resposta de até 5 (cinco) dias úteis.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">4. MÓDULOS DISPONIBILIZADOS</span>
    <p>Serão disponibilizados progressivamente os seguintes módulos: Saúde &amp; SST, Gestão de Colaboradores, Controle de Ponto, Férias e Afastamentos, Gestão Documental, Treinamentos e Trilhas de Aprendizagem, e demais funcionalidades em versão beta conforme cronograma de releases.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">5. LIMITAÇÕES DO PERÍODO BETA</span>
    <p>Durante o Programa Validador, algumas funcionalidades podem estar em desenvolvimento ou sujeitas a alterações. A SEGURAMENTE comunicará quaisquer indisponibilidades programadas com antecedência mínima de 48 (quarenta e oito) horas. Alterações estruturais no sistema serão comunicadas com antecedência mínima de 7 (sete) dias.</p>
  </div>
</div>

<!-- ═══════════════════ ANEXO V ═══════════════════ -->
<div class="page-break">
  <h3>ANEXO V — REGRAS DO PROGRAMA VALIDADOR</h3>
  <p style="text-align:center;font-size:11pt;color:#555;">Integrante do Contrato de Participação no Programa Validador</p>

  <div class="clausula">
    <span class="clausula-titulo">1. ELEGIBILIDADE</span>
    <p>Podem participar do Programa Validador empresas de qualquer porte e segmento que tenham interesse genuíno na utilização da plataforma Seguramente e disponibilidade para contribuir com o processo de validação e melhoria do produto.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">2. BENEFÍCIOS GARANTIDOS</span>
    <p>As empresas participantes têm garantidos os seguintes benefícios: acesso gratuito à plataforma pelo período de 6 meses; desconto de 50% na assinatura após o beta pelo período mínimo de 12 meses; atendimento prioritário da equipe Seguramente; participação direta no roadmap do produto; acesso antecipado a novas funcionalidades.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">3. OBRIGAÇÕES DO VALIDADOR</span>
    <p>Para manutenção dos benefícios, a EMPRESA VALIDADORA deve: utilizar a plataforma com regularidade mínima mensal; fornecer feedbacks honestos e construtivos; participar das reuniões de acompanhamento agendadas; notificar a SEGURAMENTE sobre eventuais inconsistências ou bugs identificados.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">4. ENCERRAMENTO ANTECIPADO</span>
    <p>A SEGURAMENTE reserva-se o direito de encerrar a participação de empresa que não cumprir as obrigações previstas neste Anexo, mediante notificação prévia de 15 (quinze) dias, sem prejuízo dos dados já inseridos na plataforma, que permanecerão acessíveis por 30 (trinta) dias adicionais para exportação.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">5. TRANSIÇÃO PARA PLANO COMERCIAL</span>
    <p>Ao término do período beta, a SEGURAMENTE apresentará à EMPRESA VALIDADORA proposta comercial para continuidade do uso da plataforma, com o desconto previsto neste contrato. A empresa terá 30 (trinta) dias para aceitar ou declinar a proposta.</p>
  </div>
</div>

<!-- ═══════════════════ ANEXO VI ═══════════════════ -->
<div class="page-break">
  <h3>ANEXO VI — FAQ DE SEGURANÇA E BOAS PRÁTICAS</h3>
  <p style="text-align:center;font-size:11pt;color:#555;">Integrante do Contrato de Participação no Programa Validador</p>

  <div class="clausula">
    <span class="clausula-titulo">1. COMO OS DADOS SÃO ARMAZENADOS?</span>
    <p>Todos os dados inseridos na plataforma são armazenados em servidores de nuvem certificados (AWS), com criptografia AES-256 em repouso e protocolo TLS 1.2 ou superior para dados em trânsito. Os servidores operam com disponibilidade mínima garantida de 99,5% ao mês.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">2. QUEM TEM ACESSO AOS DADOS?</span>
    <p>O acesso aos dados da EMPRESA VALIDADORA é restrito aos usuários por ela cadastrados e a colaboradores da SEGURAMENTE com função técnica específica, mediante autenticação multifator. Nenhum dado é compartilhado, vendido ou cedido a terceiros sem autorização expressa do CONTROLADOR.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">3. COMO SÃO GERENCIADAS AS SENHAS?</span>
    <p>As senhas de acesso são armazenadas exclusivamente em formato de hash criptográfico (bcrypt), nunca em texto simples. Recomendamos fortemente o uso de senhas com no mínimo 12 caracteres, combinando letras maiúsculas, minúsculas, números e símbolos, bem como a habilitação da autenticação de dois fatores (2FA).</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">4. O QUE ACONTECE EM CASO DE INCIDENTE DE SEGURANÇA?</span>
    <p>Em caso de identificação de incidente que possa comprometer dados pessoais, a SEGURAMENTE adotará imediatamente medidas de contenção e notificará a EMPRESA VALIDADORA em até 72 (setenta e duas) horas, conforme exigido pelo art. 48 da LGPD, descrevendo a natureza do incidente, as categorias e quantidade de dados afetados e as medidas adotadas.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">5. COMO SÃO REALIZADOS OS BACKUPS?</span>
    <p>Backups automáticos são realizados diariamente, com retenção mínima de 30 (trinta) dias. A restauração pontual de dados pode ser solicitada mediante abertura de chamado técnico, com prazo de atendimento de até 48 horas úteis.</p>
  </div>
  <div class="clausula">
    <span class="clausula-titulo">6. BOAS PRÁTICAS RECOMENDADAS AO USUÁRIO</span>
    <p>Para garantir a segurança do ambiente, recomendamos: não compartilhar credenciais de acesso; realizar logout ao encerrar o uso em dispositivos compartilhados; notificar imediatamente a SEGURAMENTE em caso de suspeita de acesso indevido; manter atualizado o e-mail de recuperação de conta; e utilizar dispositivos com software de segurança atualizado.</p>
  </div>

  <p style="margin-top:40px;"><strong>Ao assinar o Contrato principal, a EMPRESA VALIDADORA declara ter lido, compreendido e concordado integralmente com este FAQ e com todos os demais Anexos do contrato.</strong></p>
</div>

${gerarFooterHtml()}

</body>
</html>`;
}

export function gerarHtmlDocumento(tipo: TipoDoc, cliente: Cliente): string {
  if (tipo === 'contrato_programa_validador') {
    return gerarHtmlContrato(cliente);
  }

  const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const empresa = cliente.nome_empresa;
  const cnpj = cliente.cnpj || '___________________';
  const rep = cliente.representante || cliente.poc_nome || '___________________';

  // ata_kickoff
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ata de Kickoff — ${empresa}</title>
<style>${ABNT_CSS}</style>
</head>
<body class="has-print-bar">

${gerarHeaderHtml()}

<h1>ATA DE REUNIÃO DE KICKOFF</h1>
<h2>PROGRAMA VALIDADOR SEGURAMENTE</h2>

<div class="partes">
  <p><strong>DATA DA REUNIÃO:</strong> ${dataGeracao}</p>
  <p><strong>EMPRESA VALIDADORA:</strong> ${empresa} — CNPJ ${cnpj}</p>
  <p><strong>REPRESENTANTE DA EMPRESA:</strong> ${rep}</p>
  <p><strong>RESPONSÁVEL SEGURAMENTE:</strong> ___________________</p>
  <p><strong>MODALIDADE:</strong> ☐ Presencial &nbsp; ☐ Videoconferência &nbsp; ☐ Híbrida</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">1. OBJETIVO DA REUNIÃO</span>
  <p>A presente reunião teve por objetivo formalizar o início do Programa Validador, apresentar a plataforma Seguramente, alinhar expectativas entre as partes, definir cronograma de uso e estabelecer os responsáveis pelo projeto em ambas as organizações.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">2. MÓDULOS APRESENTADOS</span>
  <p>Durante a reunião, foram apresentados os seguintes módulos da plataforma:</p>
  <p>
    ☐ Saúde &amp; Segurança do Trabalho (SST) &nbsp;&nbsp;
    ☐ Gestão de Colaboradores &nbsp;&nbsp;
    ☐ Controle de Ponto &nbsp;&nbsp;
    ☐ Férias e Afastamentos<br>
    ☐ Gestão Documental &nbsp;&nbsp;
    ☐ Treinamentos e Trilhas &nbsp;&nbsp;
    ☐ Avaliações de Desempenho &nbsp;&nbsp;
    ☐ Relatórios e Indicadores
  </p>
</div>

<div class="clausula">
  <span class="clausula-titulo">3. CRONOGRAMA ACORDADO</span>
  <p><strong>Data de início do acesso:</strong> _______________</p>
  <p><strong>Término previsto do programa beta:</strong> _______________</p>
  <p><strong>Próxima reunião de acompanhamento:</strong> _______________</p>
  <p><strong>Frequência das reuniões de feedback:</strong> ☐ Quinzenal &nbsp; ☐ Mensal</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">4. PRÓXIMOS PASSOS DEFINIDOS</span>
  <p>
    ☐ Envio das credenciais de acesso à EMPRESA VALIDADORA<br>
    ☐ Cadastro inicial de dados da empresa na plataforma<br>
    ☐ Treinamento inicial da equipe usuária<br>
    ☐ Primeiro acompanhamento (semana 2)<br>
    ☐ Configuração dos módulos prioritários<br>
    ☐ Definição dos indicadores de sucesso do programa
  </p>
</div>

<div class="clausula">
  <span class="clausula-titulo">5. MÓDULOS PRIORITÁRIOS PARA IMPLANTAÇÃO INICIAL</span>
  <p>Com base no perfil da EMPRESA VALIDADORA, foi definida a seguinte ordem de implantação:</p>
  <p>1.º _______________  &nbsp;&nbsp;&nbsp;  2.º _______________  &nbsp;&nbsp;&nbsp;  3.º _______________</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">6. OBSERVAÇÕES E ENCAMINHAMENTOS</span>
  <p style="min-height:80px;border-bottom:1px solid #ccc;">_______________________________________________________________________________________
_______________________________________________________________________________________
_______________________________________________________________________________________</p>
</div>

<p style="margin-top:40px;">Os participantes, ao assinarem a presente ata, declaram estar cientes e de acordo com o conteúdo aqui registrado, comprometendo-se a cumprir os encaminhamentos definidos.</p>
<p>Data: <strong>${dataGeracao}</strong></p>

<div class="assinaturas">
  <div class="assinatura-bloco">
    <p><strong>EMPRESA VALIDADORA</strong></p>
    <p>${rep}</p>
    <p style="font-size:10pt;color:#555;">${empresa}</p>
  </div>
  <div class="assinatura-bloco">
    <p><strong>SEGURAMENTE TECNOLOGIA LTDA</strong></p>
    <p>Responsável pelo Programa</p>
  </div>
</div>

${gerarFooterHtml()}

</body>
</html>`;
}

function gerarHtmlContratoPagante(cliente: Cliente): string {
  const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const empresa = cliente.nome_empresa;
  const cnpj = cliente.cnpj || '___________________';
  const rep = cliente.representante || cliente.poc_nome || '___________________';
  const foro = cliente.cidade_foro || 'São Paulo';
  const endereco = cliente.endereco || '___________________';
  const valorMensal = cliente.valor_mensal
    ? cliente.valor_mensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '___________________';
  const diaVenc = cliente.dia_vencimento ? `dia ${cliente.dia_vencimento} de cada mês` : '___________________';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Contrato — ${empresa}</title>
<style>${ABNT_CSS}</style>
</head>
<body class="has-print-bar">

${gerarHeaderHtml()}

<h1>CONTRATO DE LICENÇA DE USO DE SOFTWARE</h1>
<h1>E PRESTAÇÃO DE SERVIÇOS – PLATAFORMA SEGURAMENTE</h1>
<p style="text-align:center;margin-top:4px;font-size:10pt;color:#666;">Gerado em ${dataGeracao}</p>

<p>Pelo presente instrumento particular, de um lado:</p>

<div class="partes">
  <p><strong>SEGURAMENTE TECNOLOGIA LTDA</strong>, pessoa jurídica de direito privado, inscrita no CNPJ nº ${SUDOCLIN_CNPJ}, doravante denominada <strong>SEGURAMENTE</strong>.</p>
  <p style="margin-top:12px;margin-bottom:0;">E de outro lado:</p>
  <p style="margin-bottom:0;"><strong>${empresa}</strong>, inscrita no CNPJ nº ${cnpj}, com sede em ${endereco}, neste ato representada por <strong>${rep}</strong>, doravante denominada <strong>CLIENTE</strong>.</p>
</div>

<p>As partes resolvem celebrar o presente Contrato de Licença de Uso de Software e Prestação de Serviços, que será regido pelas cláusulas e condições abaixo.</p>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 1 — OBJETO</span>
  <p>O presente contrato tem por objeto a concessão ao CLIENTE de licença de uso não exclusiva e intransferível da plataforma digital Seguramente, disponibilizada no modelo Software as a Service (SaaS). A plataforma Seguramente consiste em sistema digital destinado ao apoio à gestão organizacional das empresas, incluindo funcionalidades relacionadas a:</p>
  <ol type="I">
    <li>gestão de saúde e segurança do trabalho;</li>
    <li>organização de informações empresariais;</li>
    <li>indicadores organizacionais;</li>
    <li>gestão de processos internos;</li>
    <li>avaliações organizacionais e psicossociais;</li>
    <li>relatórios gerenciais e operacionais.</li>
  </ol>
  <p>O acesso à plataforma ocorre por meio da internet, mediante autenticação de usuários autorizados.</p>
</div>

<div class="clausula"><span class="clausula-titulo">CLÁUSULA 2 — NATUREZA DA LICENÇA</span><p>A licença concedida ao CLIENTE é não exclusiva, intransferível e limitada ao período de vigência do contrato. O CLIENTE não adquire qualquer direito de propriedade sobre o software, limitando-se ao direito de uso conforme as condições estabelecidas neste contrato.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 3 — CONDIÇÕES DE ACESSO</span><p>O acesso ao sistema será realizado mediante credenciais de usuário e autenticação digital. O CLIENTE é responsável por controlar os usuários cadastrados, manter a confidencialidade das credenciais e garantir o uso adequado da plataforma. A SEGURAMENTE não se responsabiliza por acessos indevidos decorrentes de negligência do CLIENTE no controle de usuários.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 4 — SERVIÇOS INCLUÍDOS</span><p>O contrato inclui: disponibilização da plataforma Seguramente, acesso às funcionalidades contratadas, atualizações e melhorias do sistema, manutenção técnica da plataforma e suporte técnico dentro das condições estabelecidas no Anexo III (SLA).</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 5 — DISPONIBILIDADE DO SISTEMA</span><p>A SEGURAMENTE adotará esforços razoáveis para manter a plataforma disponível. Eventuais indisponibilidades podem ocorrer em razão de manutenções programadas, atualizações do sistema, falhas de infraestrutura ou eventos fora do controle da SEGURAMENTE. Tais situações não configuram descumprimento contratual.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 6 — PLANOS E REMUNERAÇÃO</span><p>Pela utilização da plataforma, o CLIENTE pagará à SEGURAMENTE o valor de <strong>${valorMensal}</strong>, com vencimento no ${diaVenc}, conforme plano${cliente.plano ? ` <strong>${cliente.plano}</strong>` : ''} contratado. Os valores poderão ser cobrados em periodicidade mensal ou anual, conforme plano contratado.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 7 — INADIMPLÊNCIA</span><p>Em caso de atraso no pagamento, poderão ser aplicados encargos de multa, juros e correção monetária, e a SEGURAMENTE poderá suspender o acesso à plataforma até a regularização do pagamento. Persistindo a inadimplência por período superior a 30 dias, a SEGURAMENTE poderá rescindir o contrato.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 8 — SUPORTE TÉCNICO</span><p>A SEGURAMENTE disponibilizará suporte técnico para dúvidas de uso do sistema, orientação operacional e identificação de falhas técnicas. O suporte não inclui consultoria especializada, análise jurídica ou assessoria técnica personalizada. As condições detalhadas de suporte e SLA constam do Anexo III.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 9 — LIMITAÇÃO DE RESPONSABILIDADE</span><p>A plataforma Seguramente constitui ferramenta de apoio à gestão empresarial. A SEGURAMENTE não se responsabiliza por decisões tomadas pelo CLIENTE com base nos dados do sistema, interpretações equivocadas de relatórios ou informações incorretas inseridas pelos usuários. A responsabilidade pela análise e utilização das informações é exclusivamente do CLIENTE.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 10 — SEGURANÇA DA INFORMAÇÃO</span><p>A SEGURAMENTE adota medidas técnicas e organizacionais de segurança da informação, incluindo controle de acesso, monitoramento de infraestrutura, segregação de dados entre empresas e práticas de proteção digital. Os dados são armazenados em infraestrutura de computação em nuvem operada por provedores especializados.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 11 — PROTEÇÃO DE DADOS (LGPD)</span><p>O tratamento de dados pessoais observará as disposições da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Para fins legais, o CLIENTE atua como CONTROLADOR dos dados e a SEGURAMENTE atua como OPERADORA dos dados. A SEGURAMENTE compromete-se a tratar os dados exclusivamente conforme as instruções do CLIENTE.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 12 — CONFIDENCIALIDADE</span><p>As partes comprometem-se a manter confidenciais todas as informações obtidas em razão deste contrato, incluindo dados empresariais, informações organizacionais, dados de colaboradores e informações técnicas da plataforma. Essa obrigação permanecerá válida mesmo após o encerramento do contrato.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 13 — PROPRIEDADE INTELECTUAL</span><p>Todos os direitos relacionados à plataforma Seguramente pertencem exclusivamente à SEGURAMENTE, incluindo software, algoritmos, estrutura do sistema, design e metodologias. É proibida qualquer forma de reprodução, modificação, engenharia reversa ou distribuição sem autorização.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 14 — USO INDEVIDO DA PLATAFORMA</span><p>É proibido utilizar a plataforma para práticas ilegais, violação de direitos de terceiros, uso fraudulento ou inserção de informações falsas. A SEGURAMENTE poderá suspender o acesso em caso de uso indevido.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 15 — ENCERRAMENTO DO CONTRATO</span><p>O contrato poderá ser encerrado: (I) por qualquer das partes, mediante aviso prévio de 30 dias; (II) por inadimplência; (III) por descumprimento contratual.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 16 — EXPORTAÇÃO DE DADOS</span><p>Em caso de encerramento do contrato, o CLIENTE poderá solicitar a exportação dos dados armazenados na plataforma, dentro de prazo razoável definido pela SEGURAMENTE.</p></div>
<div class="clausula"><span class="clausula-titulo">CLÁUSULA 17 — ALTERAÇÕES NA PLATAFORMA</span><p>A SEGURAMENTE poderá realizar melhorias, atualizações ou modificações na plataforma visando evolução tecnológica do sistema.</p></div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 18 — DOCUMENTOS INTEGRANTES</span>
  <p>Fazem parte integrante deste contrato, para todos os fins legais, os seguintes anexos:</p>
  <ol type="I">
    <li>Anexo I — Termos de Uso da Plataforma;</li>
    <li>Anexo II — Política de Privacidade e Proteção de Dados (LGPD);</li>
    <li>Anexo III — SLA e Suporte Técnico.</li>
  </ol>
  <p>A assinatura deste contrato implica concordância integral com todos os anexos.</p>
</div>

<div class="clausula"><span class="clausula-titulo">CLÁUSULA 19 — FORO</span><p>Fica eleito o foro da comarca de <strong>${foro}</strong>, com renúncia de qualquer outro, para dirimir eventuais controvérsias.</p></div>

<div style="margin-top:40px;padding:20px;border:1px solid #ccc;background:#fafafa;">
  <p style="text-align:center;font-weight:bold;text-transform:uppercase;font-size:11pt;">E POR ESTAREM DE ACORDO</p>
  <p style="text-align:center;">As partes firmam o presente contrato.</p>
</div>

<div class="assinaturas">
  <div class="assinatura-bloco">
    <p><strong>SEGURAMENTE TECNOLOGIA LTDA</strong></p>
    <p>Representante: ______________________</p>
    <p style="font-size:10pt;color:#666;">${dataGeracao}</p>
  </div>
  <div class="assinatura-bloco">
    <p><strong>${empresa}</strong></p>
    <p>Representante: ${rep}</p>
    <p>Assinatura: ______________________</p>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<div class="page-break"><h3>ANEXO I — TERMOS DE USO DA PLATAFORMA</h3></div>
<div class="clausula"><span class="clausula-titulo">1. ACEITAÇÃO DOS TERMOS</span><p>Ao acessar e utilizar a plataforma Seguramente, o CLIENTE declara ter lido, compreendido e concordado com todos os Termos de Uso aqui estabelecidos.</p></div>
<div class="clausula"><span class="clausula-titulo">2. DESCRIÇÃO DA PLATAFORMA</span><p>A plataforma Seguramente é um sistema SaaS destinado ao apoio à gestão organizacional, oferecendo funcionalidades de gestão de saúde e segurança do trabalho, recursos humanos, indicadores e relatórios gerenciais.</p></div>
<div class="clausula"><span class="clausula-titulo">3. CADASTRO E RESPONSABILIDADES</span><p>O CLIENTE é responsável por manter suas credenciais em sigilo, comunicar imediatamente qualquer uso não autorizado e garantir que todos os usuários cadastrados cumpram estes Termos.</p></div>
<div class="clausula"><span class="clausula-titulo">4. USOS PERMITIDOS E PROIBIDOS</span><p>É vedado utilizar a plataforma para fins ilícitos, praticar engenharia reversa do software, comercializar acesso a terceiros, inserir conteúdo falso ou prejudicial, ou violar direitos de terceiros.</p></div>
<div class="clausula"><span class="clausula-titulo">5. ATUALIZAÇÕES</span><p>A SEGURAMENTE pode atualizar estes Termos periodicamente. O CLIENTE será notificado de alterações relevantes.</p></div>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<div class="page-break"><h3>ANEXO II — POLÍTICA DE PRIVACIDADE E LGPD</h3></div>
<div class="clausula"><span class="clausula-titulo">1. COMPROMISSO COM A PRIVACIDADE</span><p>A SEGURAMENTE está comprometida com a proteção dos dados pessoais dos usuários da plataforma, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p></div>
<div class="clausula"><span class="clausula-titulo">2. PAPÉIS NO TRATAMENTO DE DADOS</span><p>Para os fins desta política: o CLIENTE atua como Controlador dos dados pessoais inseridos na plataforma; a SEGURAMENTE atua como Operadora, processando os dados conforme instruções do CLIENTE.</p></div>
<div class="clausula"><span class="clausula-titulo">3. DADOS COLETADOS E FINALIDADES</span><p>A plataforma coleta e processa: dados de cadastro e acesso, dados de colaboradores inseridos pelo CLIENTE, registros de utilização do sistema e dados para geração de relatórios e indicadores. Esses dados são utilizados exclusivamente para as finalidades contratadas.</p></div>
<div class="clausula"><span class="clausula-titulo">4. SEGURANÇA E ARMAZENAMENTO</span><p>Os dados são armazenados em infraestrutura certificada, com criptografia em repouso e em trânsito, controle de acesso por perfil e backups automáticos. Os dados são mantidos pelo período contratual e conforme exigências legais aplicáveis.</p></div>
<div class="clausula"><span class="clausula-titulo">5. DIREITOS DO TITULAR</span><p>Os titulares dos dados pessoais podem exercer seus direitos de acesso, correção, exclusão e portabilidade por meio do CLIENTE (Controlador), que deverá encaminhar as solicitações à SEGURAMENTE quando aplicável.</p></div>
<div class="clausula"><span class="clausula-titulo">6. COMPARTILHAMENTO DE DADOS</span><p>A SEGURAMENTE não vende, aluga ou compartilha dados pessoais com terceiros, exceto quando necessário para a prestação dos serviços contratados ou por exigência legal.</p></div>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<div class="page-break"><h3>ANEXO III — SLA E SUPORTE TÉCNICO</h3></div>
<div class="clausula"><span class="clausula-titulo">1. DISPONIBILIDADE</span><p>A SEGURAMENTE compromete-se a manter a plataforma disponível com uptime mínimo de <strong>99% ao mês</strong>, excluindo janelas de manutenção programadas previamente comunicadas.</p></div>
<div class="clausula"><span class="clausula-titulo">2. JANELAS DE MANUTENÇÃO</span><p>Manutenções programadas serão comunicadas com antecedência mínima de 48 horas e realizadas preferencialmente em horários de menor utilização (0h–6h).</p></div>
<div class="clausula"><span class="clausula-titulo">3. CANAIS E HORÁRIOS DE SUPORTE</span><p>O suporte técnico está disponível por e-mail e sistema de chamados, em dias úteis, das 08h às 18h (horário de Brasília).</p></div>
<div class="clausula">
  <span class="clausula-titulo">4. CLASSIFICAÇÃO E PRAZOS DE ATENDIMENTO</span>
  <ul>
    <li><strong>Crítico</strong> (sistema indisponível): resposta em até 2 horas úteis, resolução em até 4 horas úteis;</li>
    <li><strong>Alto</strong> (funcionalidade principal comprometida): resposta em até 4 horas úteis, resolução em até 1 dia útil;</li>
    <li><strong>Médio</strong> (funcionalidade secundária afetada): resposta em até 1 dia útil, resolução em até 3 dias úteis;</li>
    <li><strong>Baixo</strong> (dúvidas e solicitações): resposta em até 2 dias úteis.</li>
  </ul>
</div>
<div class="clausula"><span class="clausula-titulo">5. CRÉDITOS POR INDISPONIBILIDADE</span><p>Caso a disponibilidade mensal seja inferior ao SLA contratado, o CLIENTE poderá solicitar crédito proporcional, conforme análise da SEGURAMENTE mediante solicitação formal.</p></div>
<div class="clausula"><span class="clausula-titulo">6. EXCLUSÕES DO SLA</span><p>Não são cobertos por este SLA: indisponibilidades causadas por falhas de conectividade do CLIENTE, ataques DDoS de grande escala, casos fortuitos ou de força maior, uso indevido da plataforma pelo CLIENTE ou terceiros autorizados por ele.</p></div>

${gerarFooterHtml()}

</body>
</html>`;
}
