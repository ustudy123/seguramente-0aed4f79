import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { SuperAdminRoute } from '@/components/admin/SuperAdminRoute';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Plus, Search, Users, Building2, Clock, CheckCircle2,
  XCircle, AlertCircle, ChevronRight, ArrowLeft, FileText,
  MessageSquare, Phone, Mail, Calendar, Shield,
  LayoutList, Columns, ChevronLeft, Send, ExternalLink, Download, Loader2, Printer,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatCnpj, cleanCnpj, buscarCnpj } from '@/lib/brasilapi';
import { ptBR } from 'date-fns/locale';
import { AtaKickoffDialog } from '@/components/admin/AtaKickoffDialog';
import { Link } from 'react-router-dom';

// ─── Types ───────────────────────────────────────────────────────────────────

type Fase =
  | 'prospeccao'
  | 'qualificacao'
  | 'kickoff'
  | 'ativo'
  | 'suspenso'
  | 'encerrado';

type TipoDoc =
  | 'contrato_programa_validador'
  | 'ata_kickoff';

interface Cliente {
  id: string;
  nome_empresa: string;
  cnpj: string | null;
  poc_nome: string | null;
  poc_email: string | null;
  poc_telefone: string | null;
  poc_cargo: string | null;
  fase: Fase;
  data_inicio_piloto: string | null;
  data_fim_piloto: string | null;
  segmento: string | null;
  tamanho_empresa: string | null;
  quantidade_colaboradores: number | null;
  aceita_beta: boolean;
  observacoes: string | null;
  responsavel_seguramente: string | null;
  endereco: string | null;
  representante: string | null;
  cidade_foro: string | null;
  tipo_cliente: 'tester' | 'pagante';
  valor_mensal: number | null;
  dia_vencimento: number | null;
  plano: string | null;
  modulos_contratados: string[] | null;
  data_contrato: string | null;
  data_vigencia_fim: string | null;
  created_at: string;
}

interface Contrato {
  id: string;
  cliente_id: string;
  token: string;
  status: 'pendente' | 'enviado' | 'assinado' | 'recusado';
  html_contrato: string;
  html_assinado: string | null;
  assinatura_img: string | null;
  assinado_em: string | null;
  assinado_por: string | null;
  expira_em: string;
  created_at: string;
}

interface Documento {
  id: string;
  cliente_id: string;
  tipo: TipoDoc;
  status: 'pendente' | 'enviado' | 'aceito' | 'recusado';
  enviado_em: string | null;
  aceito_em: string | null;
  versao: string | null;
  observacao: string | null;
}

interface Historico {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  autor: string | null;
  created_at: string;
}

interface DocumentoLink {
  id: string;
  cliente_id: string;
  documento_id: string | null;
  tipo: TipoDoc;
  token: string;
  status: 'pendente' | 'visualizado' | 'aceito' | 'recusado';
  aceito_em: string | null;
  aceito_por: string | null;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FASES: { value: Fase; label: string; color: string; border: string; bgKanban: string }[] = [
  { value: 'prospeccao',  label: 'Prospecção',  color: 'bg-muted text-muted-foreground',          border: 'border-t-2 border-muted-foreground/30', bgKanban: 'bg-slate-50 dark:bg-slate-900/40' },
  { value: 'qualificacao',label: 'Qualificação', color: 'bg-accent text-accent-foreground',         border: 'border-t-2 border-accent', bgKanban: 'bg-amber-50/60 dark:bg-amber-950/20' },
  { value: 'kickoff',     label: 'Kickoff',      color: 'bg-secondary text-secondary-foreground',   border: 'border-t-2 border-secondary', bgKanban: 'bg-blue-50/60 dark:bg-blue-950/20' },
  { value: 'ativo',       label: 'Ativo',        color: 'bg-primary/15 text-primary',               border: 'border-t-2 border-primary', bgKanban: 'bg-emerald-50/60 dark:bg-emerald-950/20' },
  { value: 'suspenso',    label: 'Suspenso',     color: 'bg-muted text-muted-foreground border border-border', border: 'border-t-2 border-muted-foreground/50', bgKanban: 'bg-orange-50/50 dark:bg-orange-950/20' },
  { value: 'encerrado',   label: 'Encerrado',    color: 'bg-destructive/10 text-destructive',       border: 'border-t-2 border-destructive/50', bgKanban: 'bg-red-50/40 dark:bg-red-950/20' },
];

const DOCS_CONFIG_TESTER: { tipo: TipoDoc; label: string; descricao: string; itens?: string[] }[] = [
  {
    tipo: 'contrato_programa_validador',
    label: 'Contrato Programa Validador',
    descricao: 'Contrato principal com todos os anexos jurídicos incorporados. Uma única assinatura.',
    itens: [
      'Anexo I — Termos de Uso da Plataforma',
      'Anexo II — Política de Privacidade e LGPD',
      'Anexo III — DPA / Acordo de Tratamento de Dados',
      'Anexo IV — Anexo Operacional',
      'Anexo V — Regras do Programa Validador',
      'Anexo VI — FAQ de Segurança e Boas Práticas',
    ],
  },
  {
    tipo: 'ata_kickoff',
    label: 'Ata de Kickoff',
    descricao: 'Registro operacional do início do projeto: responsáveis, escopo e cronograma.',
  },
];

const DOCS_CONFIG_PAGANTE: { tipo: TipoDoc; label: string; descricao: string; itens?: string[] }[] = [
  {
    tipo: 'contrato_programa_validador',
    label: 'Contrato de Licença de Uso',
    descricao: 'Contrato de licença SaaS com todos os anexos jurídicos incorporados. Uma única assinatura.',
    itens: [
      'Anexo I — Termos de Uso da Plataforma',
      'Anexo II — Política de Privacidade e LGPD',
      'Anexo III — SLA e Suporte Técnico',
    ],
  },
  {
    tipo: 'ata_kickoff',
    label: 'Ata de Kickoff',
    descricao: 'Registro operacional do início do projeto: responsáveis, escopo e cronograma.',
  },
];

// ─── CSS base ABNT ────────────────────────────────────────────────────────────

const LOGO_URL = 'https://seguramente.lovable.app/lovable-uploads/logo-seguramente.png';

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

const SUDOCLIN_CNPJ = '00.000.000/0001-00'; // Placeholder — será substituído pelo CNPJ real

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

// ─── Dispatcher: escolhe o template correto conforme tipo_cliente ─────────────

function gerarHtmlContrato(cliente: Cliente): string {
  if (cliente.tipo_cliente === 'pagante') return gerarHtmlContratoPagante(cliente);
  return gerarHtmlContratoTester(cliente);
}

// ─── Contrato Tester (Programa Validador) ─────────────────────────────────────

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

// ─── Gerador de HTML para Ata de Kickoff ─────────────────────────────────────

function gerarHtmlDocumento(tipo: TipoDoc, cliente: Cliente): string {
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

// ─── Contrato Pagante (Licença de Uso de Software) ────────────────────────────

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

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 2 — NATUREZA DA LICENÇA</span>
  <p>A licença concedida ao CLIENTE é não exclusiva, intransferível e limitada ao período de vigência do contrato. O CLIENTE não adquire qualquer direito de propriedade sobre o software, limitando-se ao direito de uso conforme as condições estabelecidas neste contrato.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 3 — CONDIÇÕES DE ACESSO</span>
  <p>O acesso ao sistema será realizado mediante credenciais de usuário e autenticação digital. O CLIENTE é responsável por controlar os usuários cadastrados, manter a confidencialidade das credenciais e garantir o uso adequado da plataforma. A SEGURAMENTE não se responsabiliza por acessos indevidos decorrentes de negligência do CLIENTE no controle de usuários.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 4 — SERVIÇOS INCLUÍDOS</span>
  <p>O contrato inclui: disponibilização da plataforma Seguramente, acesso às funcionalidades contratadas, atualizações e melhorias do sistema, manutenção técnica da plataforma e suporte técnico dentro das condições estabelecidas no Anexo III (SLA).</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 5 — DISPONIBILIDADE DO SISTEMA</span>
  <p>A SEGURAMENTE adotará esforços razoáveis para manter a plataforma disponível. Eventuais indisponibilidades podem ocorrer em razão de manutenções programadas, atualizações do sistema, falhas de infraestrutura ou eventos fora do controle da SEGURAMENTE. Tais situações não configuram descumprimento contratual.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 6 — PLANOS E REMUNERAÇÃO</span>
  <p>Pela utilização da plataforma, o CLIENTE pagará à SEGURAMENTE o valor de <strong>${valorMensal}</strong>, com vencimento no ${diaVenc}, conforme plano${cliente.plano ? ` <strong>${cliente.plano}</strong>` : ''} contratado. Os valores poderão ser cobrados em periodicidade mensal ou anual, conforme plano contratado.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 7 — INADIMPLÊNCIA</span>
  <p>Em caso de atraso no pagamento, poderão ser aplicados encargos de multa, juros e correção monetária, e a SEGURAMENTE poderá suspender o acesso à plataforma até a regularização do pagamento. Persistindo a inadimplência por período superior a 30 dias, a SEGURAMENTE poderá rescindir o contrato.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 8 — SUPORTE TÉCNICO</span>
  <p>A SEGURAMENTE disponibilizará suporte técnico para dúvidas de uso do sistema, orientação operacional e identificação de falhas técnicas. O suporte não inclui consultoria especializada, análise jurídica ou assessoria técnica personalizada. As condições detalhadas de suporte e SLA constam do Anexo III.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 9 — LIMITAÇÃO DE RESPONSABILIDADE</span>
  <p>A plataforma Seguramente constitui ferramenta de apoio à gestão empresarial. A SEGURAMENTE não se responsabiliza por decisões tomadas pelo CLIENTE com base nos dados do sistema, interpretações equivocadas de relatórios ou informações incorretas inseridas pelos usuários. A responsabilidade pela análise e utilização das informações é exclusivamente do CLIENTE.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 10 — SEGURANÇA DA INFORMAÇÃO</span>
  <p>A SEGURAMENTE adota medidas técnicas e organizacionais de segurança da informação, incluindo controle de acesso, monitoramento de infraestrutura, segregação de dados entre empresas e práticas de proteção digital. Os dados são armazenados em infraestrutura de computação em nuvem operada por provedores especializados.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 11 — PROTEÇÃO DE DADOS (LGPD)</span>
  <p>O tratamento de dados pessoais observará as disposições da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Para fins legais, o CLIENTE atua como CONTROLADOR dos dados e a SEGURAMENTE atua como OPERADORA dos dados. A SEGURAMENTE compromete-se a tratar os dados exclusivamente conforme as instruções do CLIENTE.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 12 — CONFIDENCIALIDADE</span>
  <p>As partes comprometem-se a manter confidenciais todas as informações obtidas em razão deste contrato, incluindo dados empresariais, informações organizacionais, dados de colaboradores e informações técnicas da plataforma. Essa obrigação permanecerá válida mesmo após o encerramento do contrato.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 13 — PROPRIEDADE INTELECTUAL</span>
  <p>Todos os direitos relacionados à plataforma Seguramente pertencem exclusivamente à SEGURAMENTE, incluindo software, algoritmos, estrutura do sistema, design e metodologias. É proibida qualquer forma de reprodução, modificação, engenharia reversa ou distribuição sem autorização.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 14 — USO INDEVIDO DA PLATAFORMA</span>
  <p>É proibido utilizar a plataforma para práticas ilegais, violação de direitos de terceiros, uso fraudulento ou inserção de informações falsas. A SEGURAMENTE poderá suspender o acesso em caso de uso indevido.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 15 — ENCERRAMENTO DO CONTRATO</span>
  <p>O contrato poderá ser encerrado: (I) por qualquer das partes, mediante aviso prévio de 30 dias; (II) por inadimplência; (III) por descumprimento contratual.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 16 — EXPORTAÇÃO DE DADOS</span>
  <p>Em caso de encerramento do contrato, o CLIENTE poderá solicitar a exportação dos dados armazenados na plataforma, dentro de prazo razoável definido pela SEGURAMENTE.</p>
</div>

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 17 — ALTERAÇÕES NA PLATAFORMA</span>
  <p>A SEGURAMENTE poderá realizar melhorias, atualizações ou modificações na plataforma visando evolução tecnológica do sistema.</p>
</div>

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

<div class="clausula">
  <span class="clausula-titulo">CLÁUSULA 19 — FORO</span>
  <p>Fica eleito o foro da comarca de <strong>${foro}</strong>, com renúncia de qualquer outro, para dirimir eventuais controvérsias.</p>
</div>

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
<div class="page-break">
  <h3>ANEXO I — TERMOS DE USO DA PLATAFORMA</h3>
</div>

<div class="clausula">
  <span class="clausula-titulo">1. ACEITAÇÃO DOS TERMOS</span>
  <p>Ao acessar e utilizar a plataforma Seguramente, o CLIENTE declara ter lido, compreendido e concordado com todos os Termos de Uso aqui estabelecidos.</p>
</div>
<div class="clausula">
  <span class="clausula-titulo">2. DESCRIÇÃO DA PLATAFORMA</span>
  <p>A plataforma Seguramente é um sistema SaaS destinado ao apoio à gestão organizacional, oferecendo funcionalidades de gestão de saúde e segurança do trabalho, recursos humanos, indicadores e relatórios gerenciais.</p>
</div>
<div class="clausula">
  <span class="clausula-titulo">3. CADASTRO E RESPONSABILIDADES</span>
  <p>O CLIENTE é responsável por manter suas credenciais em sigilo, comunicar imediatamente qualquer uso não autorizado e garantir que todos os usuários cadastrados cumpram estes Termos.</p>
</div>
<div class="clausula">
  <span class="clausula-titulo">4. USOS PERMITIDOS E PROIBIDOS</span>
  <p>É vedado utilizar a plataforma para fins ilícitos, praticar engenharia reversa do software, comercializar acesso a terceiros, inserir conteúdo falso ou prejudicial, ou violar direitos de terceiros.</p>
</div>
<div class="clausula">
  <span class="clausula-titulo">5. ATUALIZAÇÕES</span>
  <p>A SEGURAMENTE pode atualizar estes Termos periodicamente. O CLIENTE será notificado de alterações relevantes.</p>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<div class="page-break">
  <h3>ANEXO II — POLÍTICA DE PRIVACIDADE E LGPD</h3>
</div>

<div class="clausula">
  <span class="clausula-titulo">1. COMPROMISSO COM A PRIVACIDADE</span>
  <p>A SEGURAMENTE está comprometida com a proteção dos dados pessoais dos usuários da plataforma, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>
</div>
<div class="clausula">
  <span class="clausula-titulo">2. PAPÉIS NO TRATAMENTO DE DADOS</span>
  <p>Para os fins desta política: o CLIENTE atua como Controlador dos dados pessoais inseridos na plataforma; a SEGURAMENTE atua como Operadora, processando os dados conforme instruções do CLIENTE.</p>
</div>
<div class="clausula">
  <span class="clausula-titulo">3. DADOS COLETADOS E FINALIDADES</span>
  <p>A plataforma coleta e processa: dados de cadastro e acesso, dados de colaboradores inseridos pelo CLIENTE, registros de utilização do sistema e dados para geração de relatórios e indicadores. Esses dados são utilizados exclusivamente para as finalidades contratadas.</p>
</div>
<div class="clausula">
  <span class="clausula-titulo">4. SEGURANÇA E ARMAZENAMENTO</span>
  <p>Os dados são armazenados em infraestrutura certificada, com criptografia em repouso e em trânsito, controle de acesso por perfil e backups automáticos. Os dados são mantidos pelo período contratual e conforme exigências legais aplicáveis.</p>
</div>
<div class="clausula">
  <span class="clausula-titulo">5. DIREITOS DO TITULAR</span>
  <p>Os titulares dos dados pessoais podem exercer seus direitos de acesso, correção, exclusão e portabilidade por meio do CLIENTE (Controlador), que deverá encaminhar as solicitações à SEGURAMENTE quando aplicável.</p>
</div>
<div class="clausula">
  <span class="clausula-titulo">6. COMPARTILHAMENTO DE DADOS</span>
  <p>A SEGURAMENTE não vende, aluga ou compartilha dados pessoais com terceiros, exceto quando necessário para a prestação dos serviços contratados ou por exigência legal.</p>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<div class="page-break">
  <h3>ANEXO III — SLA E SUPORTE TÉCNICO</h3>
</div>

<div class="clausula">
  <span class="clausula-titulo">1. DISPONIBILIDADE</span>
  <p>A SEGURAMENTE compromete-se a manter a plataforma disponível com uptime mínimo de <strong>99% ao mês</strong>, excluindo janelas de manutenção programadas previamente comunicadas.</p>
</div>
<div class="clausula">
  <span class="clausula-titulo">2. JANELAS DE MANUTENÇÃO</span>
  <p>Manutenções programadas serão comunicadas com antecedência mínima de 48 horas e realizadas preferencialmente em horários de menor utilização (0h–6h).</p>
</div>
<div class="clausula">
  <span class="clausula-titulo">3. CANAIS E HORÁRIOS DE SUPORTE</span>
  <p>O suporte técnico está disponível por e-mail e sistema de chamados, em dias úteis, das 08h às 18h (horário de Brasília).</p>
</div>
<div class="clausula">
  <span class="clausula-titulo">4. CLASSIFICAÇÃO E PRAZOS DE ATENDIMENTO</span>
  <ul>
    <li><strong>Crítico</strong> (sistema indisponível): resposta em até 2 horas úteis, resolução em até 4 horas úteis;</li>
    <li><strong>Alto</strong> (funcionalidade principal comprometida): resposta em até 4 horas úteis, resolução em até 1 dia útil;</li>
    <li><strong>Médio</strong> (funcionalidade secundária afetada): resposta em até 1 dia útil, resolução em até 3 dias úteis;</li>
    <li><strong>Baixo</strong> (dúvidas e solicitações): resposta em até 2 dias úteis.</li>
  </ul>
</div>
<div class="clausula">
  <span class="clausula-titulo">5. CRÉDITOS POR INDISPONIBILIDADE</span>
  <p>Caso a disponibilidade mensal seja inferior ao SLA contratado, o CLIENTE poderá solicitar crédito proporcional, conforme análise da SEGURAMENTE mediante solicitação formal.</p>
</div>
<div class="clausula">
  <span class="clausula-titulo">6. EXCLUSÕES DO SLA</span>
  <p>Não são cobertos por este SLA: indisponibilidades causadas por falhas de conectividade do CLIENTE, ataques DDoS de grande escala, casos fortuitos ou de força maior, uso indevido da plataforma pelo CLIENTE ou terceiros autorizados por ele.</p>
</div>

${gerarFooterHtml()}

</body>
</html>`;
}



function FaseBadge({ fase }: { fase: Fase }) {
  const cfg = FASES.find(f => f.value === fase)!;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}

function DocStatusIcon({ status }: { status: Documento['status'] }) {
  if (status === 'aceito')   return <CheckCircle2 className="w-4 h-4 text-primary" />;
  if (status === 'recusado') return <XCircle className="w-4 h-4 text-destructive" />;
  if (status === 'enviado')  return <Clock className="w-4 h-4 text-accent-foreground" />;
  return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
}

// ─── Kanban card ─────────────────────────────────────────────────────────────

function KanbanCard({
  cliente,
  onOpen,
  faseAtual,
}: {
  cliente: Cliente;
  onOpen: () => void;
  faseAtual: Fase;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/cliente-id', cliente.id);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).style.opacity = '0.5';
      }}
      onDragEnd={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = '1';
      }}
      className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-all space-y-2 cursor-grab active:cursor-grabbing"
    >
      <div className="cursor-pointer" onClick={onOpen}>
        <div className="flex items-center justify-between gap-1">
          <p className="font-semibold text-sm leading-tight truncate">{cliente.nome_empresa}</p>
          <span className={`text-xs shrink-0 ${cliente.tipo_cliente === 'pagante' ? 'text-primary' : 'text-muted-foreground'}`}>
            {cliente.tipo_cliente === 'pagante' ? '💼' : '🧪'}
          </span>
        </div>
        {cliente.poc_nome && (
          <p className="text-xs text-muted-foreground mt-0.5">{cliente.poc_nome}</p>
        )}
        {cliente.segmento && (
          <p className="text-xs text-muted-foreground">{cliente.segmento}</p>
        )}
        {cliente.data_inicio_piloto && (
          <p className="text-xs text-muted-foreground mt-1">
            Início: {format(new Date(cliente.data_inicio_piloto), 'dd/MM/yyyy')}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProgramaValidador() {
  const { profile } = useAuthContext();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [faseFilter, setFaseFilter] = useState<Fase | 'todas'>('todas');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('kanban');

  // ── Queries ──
  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['validador', 'clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programa_validador_clientes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Cliente[];
    },
  });

  const { data: documentos = [] } = useQuery({
    queryKey: ['validador', 'docs', clienteSelecionado?.id],
    enabled: !!clienteSelecionado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programa_validador_documentos')
        .select('*')
        .eq('cliente_id', clienteSelecionado!.id);
      if (error) throw error;
      return data as Documento[];
    },
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['validador', 'historico', clienteSelecionado?.id],
    enabled: !!clienteSelecionado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programa_validador_historico')
        .select('*')
        .eq('cliente_id', clienteSelecionado!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Historico[];
    },
  });

  const { data: contratos = [] } = useQuery({
    queryKey: ['validador', 'contratos', clienteSelecionado?.id],
    enabled: !!clienteSelecionado,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programa_validador_contratos' as never)
        .select('*')
        .eq('cliente_id', clienteSelecionado!.id)
        .order('created_at', { ascending: false }) as any;
      if (error) throw error;
      return (data || []) as Contrato[];
    },
  });

  // ── Mover fase (kanban) ──
  const moverFaseMutation = useMutation({
    mutationFn: async ({ id, fase }: { id: string; fase: Fase }) => {
      const clienteAtual = clientes.find(c => c.id === id);
      const { error } = await supabase
        .from('programa_validador_clientes')
        .update({ fase })
        .eq('id', id);
      if (error) throw error;
      await supabase.from('programa_validador_historico').insert({
        cliente_id: id,
        tipo: 'fase_alterada',
        titulo: `Fase alterada para "${FASES.find(f => f.value === fase)?.label}"`,
        autor: profile?.nome_completo || 'SuperAdmin',
      });
      // Gerar contrato ao avançar de qualificação → kickoff
      if (clienteAtual?.fase === 'qualificacao' && fase === 'kickoff') {
        const html = gerarHtmlContrato(clienteAtual);
        await supabase.from('programa_validador_contratos' as never).insert({
          cliente_id: id,
          html_contrato: html,
          status: 'pendente',
        } as never);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['validador'] });
      toast.success('Fase atualizada!');
    },
    onError: () => toast.error('Erro ao mover cliente'),
  });

  // ── Stats por fase ──
  const porFase = FASES.reduce((acc, f) => {
    acc[f.value] = clientes.filter(c => c.fase === f.value).length;
    return acc;
  }, {} as Record<Fase, number>);

  const clientesFiltrados = clientes.filter(c => {
    const matchBusca = c.nome_empresa.toLowerCase().includes(busca.toLowerCase())
      || (c.poc_nome || '').toLowerCase().includes(busca.toLowerCase());
    const matchFase = faseFilter === 'todas' || c.fase === faseFilter;
    return matchBusca && matchFase;
  });

  if (clienteSelecionado) {
    return (
      <SuperAdminRoute>
        <DetalheCliente
          cliente={clienteSelecionado}
          documentos={documentos}
          historico={historico}
          contratos={contratos}
          onBack={() => setClienteSelecionado(null)}
          onClienteUpdated={(c) => {
            setClienteSelecionado(c);
            qc.invalidateQueries({ queryKey: ['validador'] });
          }}
        />
      </SuperAdminRoute>
    );
  }

  return (
    <SuperAdminRoute>
      <div className="min-h-screen bg-muted/40 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Programa Validador</h1>
              <p className="text-sm text-muted-foreground">Pipeline de clientes na fase beta</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle de view */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('lista')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${viewMode === 'lista' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <LayoutList className="w-4 h-4" />
                Lista
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <Columns className="w-4 h-4" />
                Kanban
              </button>
            </div>
            <Dialog open={showNovoCliente} onOpenChange={setShowNovoCliente}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Novo Cliente</Button>
              </DialogTrigger>
              <NovoClienteDialog
                onSuccess={() => {
                  setShowNovoCliente(false);
                  qc.invalidateQueries({ queryKey: ['validador'] });
                }}
              />
            </Dialog>
          </div>
        </div>

        {/* KPI cards por fase */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {FASES.map(f => (
            <Card
              key={f.value}
              className={`cursor-pointer transition-all hover:shadow-md ${faseFilter === f.value ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setFaseFilter(faseFilter === f.value ? 'todas' : f.value)}
            >
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{porFase[f.value] || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{f.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Busca */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa ou responsável..."
              className="pl-9"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : viewMode === 'kanban' ? (
          /* ── KANBAN ── */
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {FASES.filter(f => faseFilter === 'todas' || f.value === faseFilter).map(fase => {
                const cards = clientesFiltrados.filter(c => c.fase === fase.value);
                return (
                  <div
                    key={fase.value}
                    className={`w-60 rounded-xl ${fase.border} ${fase.bgKanban} flex flex-col transition-all`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      (e.currentTarget as HTMLElement).classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                    }}
                    onDragLeave={(e) => {
                      (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                      const clienteId = e.dataTransfer.getData('application/cliente-id');
                      if (clienteId) {
                        const cliente = clientes.find(c => c.id === clienteId);
                        if (cliente && cliente.fase !== fase.value) {
                          moverFaseMutation.mutate({ id: clienteId, fase: fase.value });
                        }
                      }
                    }}
                  >
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">{fase.label}</span>
                      <span className="text-xs text-muted-foreground bg-background/60 rounded-full px-2 py-0.5">{cards.length}</span>
                    </div>
                    <div className="flex-1 p-2 space-y-2 min-h-[120px]">
                      {cards.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center pt-4 opacity-60">Vazio</p>
                      ) : (
                        cards.map(c => (
                          <KanbanCard
                            key={c.id}
                            cliente={c}
                            faseAtual={c.fase}
                            onOpen={() => setClienteSelecionado(c)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── LISTA ── */
          <div className="grid gap-3">
            {clientesFiltrados.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum cliente encontrado</p>
              </div>
            ) : (
              clientesFiltrados.map(c => (
                <Card
                  key={c.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => setClienteSelecionado(c)}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{c.nome_empresa}</p>
                        <p className="text-sm text-muted-foreground">
                          {c.poc_nome && `Contato: ${c.poc_nome}`}
                          {c.poc_nome && c.segmento && ' · '}
                          {c.segmento}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {c.data_inicio_piloto && (
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          Início: {format(new Date(c.data_inicio_piloto), 'dd/MM/yyyy')}
                        </span>
                      )}
                      <FaseBadge fase={c.fase} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </SuperAdminRoute>
  );
}

// ─── Detalhe do cliente ───────────────────────────────────────────────────────

function DetalheCliente({
  cliente, documentos, historico, contratos, onBack, onClienteUpdated,
}: {
  cliente: Cliente;
  documentos: Documento[];
  historico: Historico[];
  contratos: Contrato[];
  onBack: () => void;
  onClienteUpdated: (c: Cliente) => void;
}) {
  const qc = useQueryClient();
  const { profile } = useAuthContext();
  const [nota, setNota] = useState('');
  const [editandoFase, setEditandoFase] = useState(false);
  const [showGerarContrato, setShowGerarContrato] = useState(false);
  const [gerandoDoc, setGerandoDoc] = useState<TipoDoc | null>(null);
  const [showAtaDialog, setShowAtaDialog] = useState(false);

  const { data: docLinks = [] } = useQuery({
    queryKey: ['validador', 'doc-links', cliente.id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programa_validador_documento_links' as never)
        .select('*')
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false }) as any;
      if (error) throw error;
      return (data || []) as DocumentoLink[];
    },
  });

  const atualizarFaseMutation = useMutation({
    mutationFn: async (fase: Fase) => {
      const { data, error } = await supabase
        .from('programa_validador_clientes')
        .update({ fase })
        .eq('id', cliente.id)
        .select()
        .single();
      if (error) throw error;

      await supabase.from('programa_validador_historico').insert({
        cliente_id: cliente.id,
        tipo: 'fase_alterada',
        titulo: `Fase alterada para "${FASES.find(f => f.value === fase)?.label}"`,
        autor: profile?.nome_completo || 'SuperAdmin',
      });

      // Gerar contrato automaticamente ao avançar qualificação → kickoff
      if (cliente.fase === 'qualificacao' && fase === 'kickoff') {
        const html = gerarHtmlContrato({ ...cliente, fase });
        await supabase.from('programa_validador_contratos' as never).insert({
          cliente_id: cliente.id,
          html_contrato: html,
          status: 'pendente',
        } as never);
      }
      return data;
    },
    onSuccess: (data) => {
      onClienteUpdated(data as Cliente);
      setEditandoFase(false);
      toast.success('Fase atualizada');
      qc.invalidateQueries({ queryKey: ['validador'] });
    },
  });

  const gerarContratoMutation = useMutation({
    mutationFn: async () => {
      const html = gerarHtmlContrato(cliente);
      const { data, error } = await supabase
        .from('programa_validador_contratos' as never)
        .insert({ cliente_id: cliente.id, html_contrato: html, status: 'pendente' } as never)
        .select()
        .single() as any;
      if (error) throw error;
      await supabase.from('programa_validador_historico' as never).insert({
        cliente_id: cliente.id,
        tipo: 'contrato_gerado',
        titulo: 'Contrato gerado para assinatura eletrônica',
        autor: profile?.nome_completo || 'SuperAdmin',
      } as never);
      return data;
    },
    onSuccess: () => {
      toast.success('Contrato gerado! Copie o link e envie para o cliente.');
      setShowGerarContrato(false);
      qc.invalidateQueries({ queryKey: ['validador', 'contratos', cliente.id] });
      qc.invalidateQueries({ queryKey: ['validador', 'historico', cliente.id] });
    },
    onError: (err: Error) => toast.error('Erro ao gerar contrato: ' + err.message),
  });

  const gerarDocLinkMutation = useMutation({
    mutationFn: async ({ tipo, htmlOverride }: { tipo: TipoDoc; htmlOverride?: string }) => {
      const html = htmlOverride ?? gerarHtmlDocumento(tipo, cliente);
      const docExistente = documentos.find(d => d.tipo === tipo);
      const { data, error } = await supabase
        .from('programa_validador_documento_links' as never)
        .insert({
          cliente_id: cliente.id,
          documento_id: docExistente?.id || null,
          tipo,
          html_documento: html,
          status: 'pendente',
        } as never)
        .select()
        .single() as any;
      if (error) throw error;
      // Atualizar status do doc para 'enviado'
      await atualizarDocMutation.mutateAsync({ tipo, status: 'enviado' });
      await supabase.from('programa_validador_historico' as never).insert({
        cliente_id: cliente.id,
        tipo: 'documento_gerado',
        titulo: `Link de aceite gerado: ${(cliente.tipo_cliente === 'pagante' ? DOCS_CONFIG_PAGANTE : DOCS_CONFIG_TESTER).find(d => d.tipo === tipo)?.label}`,
        autor: profile?.nome_completo || 'SuperAdmin',
      } as never);
      return data;
    },
    onSuccess: (data) => {
      const url = `${window.location.origin}/aceite-documento/${data.token}`;
      navigator.clipboard.writeText(url).then(() => {
        toast.success('Link de aceite copiado para a área de transferência!');
      });
      setGerandoDoc(null);
      qc.invalidateQueries({ queryKey: ['validador', 'doc-links', cliente.id] });
      qc.invalidateQueries({ queryKey: ['validador', 'docs', cliente.id] });
      qc.invalidateQueries({ queryKey: ['validador', 'historico', cliente.id] });
    },
    onError: (err: Error) => toast.error('Erro ao gerar link: ' + err.message),
  });

  const copiarLink = (token: string) => {
    const url = `${window.location.origin}/contrato-assinatura/${token}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copiado!'));
  };

  const abrirContrato = (token: string) => {
    window.open(`${window.location.origin}/contrato-assinatura/${token}`, '_blank');
  };

  const adicionarNotaMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('programa_validador_historico').insert({
        cliente_id: cliente.id,
        tipo: 'nota',
        titulo: nota,
        autor: profile?.nome_completo || 'SuperAdmin',
      });
    },
    onSuccess: () => {
      setNota('');
      toast.success('Nota adicionada');
      qc.invalidateQueries({ queryKey: ['validador', 'historico', cliente.id] });
    },
  });

  const atualizarDocMutation = useMutation({
    mutationFn: async ({ tipo, status }: { tipo: TipoDoc; status: Documento['status'] }) => {
      const existente = documentos.find(d => d.tipo === tipo);
      if (existente) {
        await supabase
          .from('programa_validador_documentos')
          .update({
            status,
            enviado_em: status === 'enviado' ? new Date().toISOString() : existente.enviado_em,
            aceito_em: status === 'aceito' ? new Date().toISOString() : existente.aceito_em,
          })
          .eq('id', existente.id);
      } else {
        await supabase.from('programa_validador_documentos').insert({
          cliente_id: cliente.id,
          tipo,
          status,
          enviado_em: status === 'enviado' ? new Date().toISOString() : null,
          aceito_em: status === 'aceito' ? new Date().toISOString() : null,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['validador', 'docs', cliente.id] });
    },
  });

  const contratoAssinado = contratos[0]?.status === 'assinado';
  const docAceitos = documentos.filter(d => d.status === 'aceito' && d.tipo !== 'contrato_programa_validador').length
    + (contratoAssinado ? 1 : 0);
  const docsConfig = cliente.tipo_cliente === 'pagante' ? DOCS_CONFIG_PAGANTE : DOCS_CONFIG_TESTER;
  const totalDocs = docsConfig.length;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{cliente.nome_empresa}</h1>
            <FaseBadge fase={cliente.fase} />
            <Badge variant="outline" className={`text-xs ${cliente.tipo_cliente === 'pagante' ? 'border-primary text-primary' : 'border-accent text-accent-foreground'}`}>
              {cliente.tipo_cliente === 'pagante' ? '💼 Pagante' : '🧪 Tester'}
            </Badge>
            {cliente.aceita_beta && (
              <Badge variant="outline" className="text-xs">
                <Shield className="w-3 h-3 mr-1" />Beta aceito
              </Badge>
            )}
          </div>
          {cliente.segmento && <p className="text-sm text-muted-foreground">{cliente.segmento}</p>}
        </div>
        {/* Botão Portal do Cliente */}
        {(cliente as any).onboarding_token && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => {
              const url = `${window.location.origin}/onboarding-cliente/${(cliente as any).onboarding_token}`;
              navigator.clipboard.writeText(url);
              toast.success("Link do portal copiado!");
            }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Portal do Cliente
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="md:col-span-2 space-y-6">

          {/* Alterar fase */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                Fase do Pipeline
                <Button variant="ghost" size="sm" onClick={() => setEditandoFase(!editandoFase)}>
                  {editandoFase ? 'Cancelar' : 'Alterar'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editandoFase ? (
                <div className="flex flex-wrap gap-2">
                  {FASES.map(f => (
                    <button
                      key={f.value}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        cliente.fase === f.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted'
                      }`}
                      onClick={() => atualizarFaseMutation.mutate(f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <FaseBadge fase={cliente.fase} />
                  {cliente.data_inicio_piloto && (
                    <span className="text-sm text-muted-foreground">
                      Piloto: {format(new Date(cliente.data_inicio_piloto), 'dd/MM/yyyy')}
                      {cliente.data_fim_piloto && ` → ${format(new Date(cliente.data_fim_piloto), 'dd/MM/yyyy')}`}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contrato de Participação */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Contrato de Participação
                </span>
                <Button variant="outline" size="sm" onClick={() => setShowGerarContrato(true)}>
                  <Plus className="w-3 h-3 mr-1" />
                  Gerar novo
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contratos.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum contrato gerado</p>
                  <p className="text-xs mt-1">O contrato é gerado automaticamente ao mover de Qualificação → Kickoff</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contratos.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          {c.status === 'assinado' ? (
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          ) : c.status === 'enviado' ? (
                            <Clock className="w-4 h-4 text-accent-foreground" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium capitalize">{c.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Gerado em {format(new Date(c.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          {c.assinado_em && ` · Assinado em ${format(new Date(c.assinado_em), 'dd/MM/yyyy', { locale: ptBR })}`}
                          {c.assinado_por && ` por ${c.assinado_por}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {c.status !== 'assinado' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => copiarLink(c.token)}
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Copiar link
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          title="Baixar contrato"
                          onClick={() => {
                            const html = c.html_assinado || c.html_contrato;
                            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `contrato-${cliente.nome_empresa.replace(/\s+/g, '-').toLowerCase()}.html`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          title="Imprimir contrato"
                          onClick={() => {
                            const html = c.html_assinado || c.html_contrato;
                            const win = window.open('', '_blank');
                            if (win) {
                              win.document.write(html);
                              win.document.close();
                              setTimeout(() => win.print(), 500);
                            }
                          }}
                        >
                          <Printer className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          title="Abrir contrato"
                          onClick={() => abrirContrato(c.token)}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Modal confirmação gerar contrato */}
              {showGerarContrato && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-3">
                  <p className="text-sm font-medium">Gerar contrato para <strong>{cliente.nome_empresa}</strong>?</p>
                  <p className="text-xs text-muted-foreground">
                    Será gerado um link único para assinatura eletrônica.
                    {!cliente.representante && ' Você pode adicionar o nome do representante no cadastro da empresa para incluir no contrato.'}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowGerarContrato(false)}>Cancelar</Button>
                    <Button size="sm" disabled={gerarContratoMutation.isPending} onClick={() => gerarContratoMutation.mutate()}>
                      {gerarContratoMutation.isPending ? 'Gerando...' : 'Confirmar'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documentos e Aceites */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documentos e Aceites
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {docAceitos}/{totalDocs} concluídos
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {docsConfig.map(({ tipo, label, descricao, itens }) => {
                const isContrato = tipo === 'contrato_programa_validador';
                const contratoAtivo = isContrato ? contratos[0] : null;
                const doc = documentos.find(d => d.tipo === tipo);
                // Para contrato, derivar status diretamente da tabela de contratos
                const status = isContrato
                  ? (contratoAtivo?.status === 'assinado' ? 'aceito' : contratoAtivo ? 'enviado' : 'pendente')
                  : (doc?.status || 'pendente');
                const linkAtivo = docLinks.find(l => l.tipo === tipo && l.status !== 'recusado');
                const isGerando = gerandoDoc === tipo && gerarDocLinkMutation.isPending;

                return (
                  <div key={tipo} className={`rounded-lg border p-4 space-y-3 ${
                    status === 'aceito' || status === 'enviado' ? 'border-primary/30 bg-primary/5' : 'border-border'
                  }`}>
                    {/* Cabeçalho do documento */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          status === 'aceito' ? 'bg-primary/15' :
                          status === 'enviado' ? 'bg-accent/20' :
                          'bg-muted'
                        }`}>
                          <DocStatusIcon status={status} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>
                          {(isContrato ? contratoAtivo?.assinado_em : doc?.aceito_em) && (
                            <p className="text-xs text-primary mt-1">
                              ✓ Assinado em {format(new Date((isContrato ? contratoAtivo?.assinado_em : doc?.aceito_em)!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              {isContrato && contratoAtivo?.assinado_por ? ` por ${contratoAtivo.assinado_por}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {status !== 'aceito' && (
                          isContrato ? (
                            // Contrato usa a seção própria acima
                            null
                          ) : linkAtivo ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                const url = `${window.location.origin}/aceite-documento/${linkAtivo.token}`;
                                navigator.clipboard.writeText(url).then(() => toast.success('Link copiado!'));
                              }}
                            >
                              <Send className="w-3 h-3 mr-1" />
                              Copiar link
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={isGerando}
                              onClick={() => {
                                setGerandoDoc(tipo);
                                if (tipo === 'ata_kickoff') {
                                  setShowAtaDialog(true);
                                } else {
                                  gerarDocLinkMutation.mutate({ tipo });
                                }
                              }}
                            >
                              {isGerando ? (
                                <span className="flex items-center gap-1">
                                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                  Gerando...
                                </span>
                              ) : (
                                <><FileText className="w-3 h-3 mr-1" />Gerar link</>
                              )}
                            </Button>
                          )
                        )}
                        <Select
                          value={status}
                          onValueChange={(v) => atualizarDocMutation.mutate({ tipo, status: v as Documento['status'] })}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="enviado">Enviado</SelectItem>
                            <SelectItem value="aceito">Aceito</SelectItem>
                            <SelectItem value="recusado">Recusado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Conteúdo incluído (apenas para contrato) */}
                    {itens && (
                      <div className="ml-11 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Conteúdo incluído:</p>
                        {itens.map(item => (
                          <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          Uma única assinatura digital cobre todos os itens acima.
                        </p>
                      </div>
                    )}

                    {/* Status do link */}
                    {linkAtivo && status !== 'aceito' && !isContrato && (
                      <div className="ml-11 flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          linkAtivo.status === 'aceito' ? 'bg-primary/10 text-primary' :
                          linkAtivo.status === 'visualizado' ? 'bg-accent/50 text-accent-foreground' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {linkAtivo.status === 'aceito' ? '✓ Aceito' :
                           linkAtivo.status === 'visualizado' ? '👁 Visualizado' :
                           '⏳ Aguardando aceite'}
                        </span>
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                          onClick={() => window.open(`${window.location.origin}/aceite-documento/${linkAtivo.token}`, '_blank')}
                        >
                          Ver documento
                        </button>
                      </div>
                    )}

                    {/* Contrato: link da seção acima */}
                    {isContrato && contratos.length > 0 && (
                      <div className="ml-11">
                        {contratos.slice(0, 1).map(c => (
                          <div key={c.id} className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              c.status === 'assinado' ? 'bg-primary/10 text-primary' :
                              c.status === 'enviado' ? 'bg-accent/50 text-accent-foreground' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {c.status === 'assinado' ? '✓ Assinado' :
                               c.status === 'enviado' ? '⏳ Aguardando assinatura' :
                               '⏳ Pendente'}
                            </span>
                            {c.status !== 'assinado' && (
                              <button
                                className="text-xs text-muted-foreground hover:text-foreground underline"
                                onClick={() => copiarLink(c.token)}
                              >
                                Copiar link
                              </button>
                            )}
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground underline"
                              onClick={() => abrirContrato(c.token)}
                            >
                              Ver contrato
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Linha do tempo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Nova nota */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Adicionar nota..."
                  className="min-h-[60px] resize-none text-sm"
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!nota.trim() || adicionarNotaMutation.isPending}
                  onClick={() => adicionarNotaMutation.mutate()}
                  className="self-end"
                >
                  Salvar
                </Button>
              </div>
              <Separator />
              {historico.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro ainda</p>
              ) : (
                historico.map(h => (
                  <div key={h.id} className="flex gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <div>
                      <p className="font-medium">{h.titulo}</p>
                      {h.descricao && <p className="text-muted-foreground">{h.descricao}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {h.autor && `${h.autor} · `}
                        {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Responsável / Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {cliente.poc_nome && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{cliente.poc_nome}</span>
                  {cliente.poc_cargo && <span className="text-muted-foreground">· {cliente.poc_cargo}</span>}
                </div>
              )}
              {cliente.poc_email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${cliente.poc_email}`} className="text-primary hover:underline">{cliente.poc_email}</a>
                </div>
              )}
              {cliente.poc_telefone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a
                    href={`https://wa.me/55${cliente.poc_telefone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    {cliente.poc_telefone}
                    <span className="text-xs text-muted-foreground">(WhatsApp)</span>
                  </a>
                </div>
              )}
              {(cliente as any).activation_token && (
                <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1.5">
                  <p className="text-xs font-semibold text-primary flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Link de Ativação do Cliente
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                      {window.location.origin}/ativar-conta?token={(cliente as any).activation_token}
                    </code>
                    <button
                      className="text-xs text-primary hover:underline whitespace-nowrap"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/ativar-conta?token=${(cliente as any).activation_token}`);
                        toast.success('Link copiado!');
                      }}
                    >
                      Copiar
                    </button>
                  </div>
                  {(cliente as any).conta_ativada && (
                    <p className="text-xs text-primary font-medium">✓ Conta ativada</p>
                  )}
                </div>
              )}
              {!cliente.poc_nome && !cliente.poc_email && (
                <p className="text-muted-foreground">Nenhum contato cadastrado</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Empresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {cliente.cnpj && <p><span className="text-muted-foreground">CNPJ:</span> {cliente.cnpj}</p>}
              {cliente.tamanho_empresa && (
                <p><span className="text-muted-foreground">Porte:</span> {cliente.tamanho_empresa}</p>
              )}
              {cliente.quantidade_colaboradores && (
                <p><span className="text-muted-foreground">Colaboradores:</span> {cliente.quantidade_colaboradores}</p>
              )}
              {cliente.responsavel_seguramente && (
                <p><span className="text-muted-foreground">Resp. Seguramente:</span> {cliente.responsavel_seguramente}</p>
              )}
              {cliente.endereco && (
                <p><span className="text-muted-foreground">Endereço:</span> {cliente.endereco}</p>
              )}
              {cliente.representante && (
                <p><span className="text-muted-foreground">Representante:</span> {cliente.representante}</p>
              )}
            </CardContent>
          </Card>

          {/* Dados Comerciais (apenas pagante) */}
          {cliente.tipo_cliente === 'pagante' && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-primary uppercase tracking-wide">💼 Dados Comerciais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {cliente.plano && <p><span className="text-muted-foreground">Plano:</span> <strong>{cliente.plano}</strong></p>}
                {cliente.valor_mensal && (
                  <p><span className="text-muted-foreground">Mensalidade:</span> <strong>{cliente.valor_mensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
                )}
                {cliente.dia_vencimento && (
                  <p><span className="text-muted-foreground">Vencimento:</span> dia {cliente.dia_vencimento}</p>
                )}
                {cliente.data_contrato && (
                  <p><span className="text-muted-foreground">Contrato:</span> {format(new Date(cliente.data_contrato), 'dd/MM/yyyy')}</p>
                )}
                {cliente.data_vigencia_fim && (
                  <p><span className="text-muted-foreground">Vigência até:</span> {format(new Date(cliente.data_vigencia_fim), 'dd/MM/yyyy')}</p>
                )}
              </CardContent>
            </Card>
          )}

          {cliente.observacoes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Observações do Cadastro</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {cliente.observacoes.split(' | ').map((item, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      {item.includes(':') ? (
                        <>
                          <span className="font-medium text-foreground">{item.split(':')[0]}:</span>
                          {item.split(':').slice(1).join(':')}
                        </>
                      ) : item}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-3 text-xs text-muted-foreground">
              <p>Criado em {format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <AtaKickoffDialog
        open={showAtaDialog}
        onClose={() => { setShowAtaDialog(false); setGerandoDoc(null); }}
        onEnviar={(html) => {
          gerarDocLinkMutation.mutate({ tipo: 'ata_kickoff', htmlOverride: html });
          setShowAtaDialog(false);
        }}
        isLoading={gerarDocLinkMutation.isPending}
        nomeEmpresa={cliente.nome_empresa}
        pocNome={cliente.poc_nome}
        responsavelSeguramente={cliente.responsavel_seguramente}
      />
    </div>
  );
}

// ─── Dialog novo cliente ──────────────────────────────────────────────────────

function NovoClienteDialog({ onSuccess }: { onSuccess: () => void }) {
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [form, setForm] = useState({
    nome_empresa: '',
    cnpj: '',
    poc_nome: '',
    poc_email: '',
    poc_telefone: '',
    poc_cargo: '',
    fase: 'prospeccao' as Fase,
    segmento: '',
    tamanho_empresa: '',
    quantidade_colaboradores: '',
    responsavel_seguramente: '',
    data_inicio_piloto: '',
    data_fim_piloto: '',
    observacoes: '',
    tipo_cliente: 'tester' as 'tester' | 'pagante',
    endereco: '',
    representante: '',
    cidade_foro: '',
    valor_mensal: '',
    dia_vencimento: '',
    plano: '',
    data_contrato: '',
    data_vigencia_fim: '',
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      // 1. Criar tenant para essa empresa
      const slugBase = form.nome_empresa
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
      const slugUnique = `${slugBase}-${Date.now().toString(36)}`;

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          nome: form.nome_empresa,
          slug: slugUnique,
          plano: form.tipo_cliente === 'pagante' ? 'professional' : 'free',
          ativo: true,
        })
        .select('id')
        .single();
      if (tenantError) throw tenantError;

      const tenantId = tenant.id;

      // 2. Criar empresa_cadastro vinculada ao tenant
      const { data: empresa, error: empresaError } = await supabase
        .from('empresa_cadastro')
        .insert({
          tenant_id: tenantId,
          razao_social: form.nome_empresa,
          cnpj: form.cnpj || null,
          endereco: form.endereco || null,
          email: form.poc_email || null,
          telefone: form.poc_telefone || null,
          total_colaboradores: form.quantidade_colaboradores ? parseInt(form.quantidade_colaboradores) : 0,
          tipo_pessoa: 'pj',
          ativo: true,
        } as any)
        .select('id')
        .single();
      if (empresaError) throw empresaError;

      // 3. Criar registro no programa_validador_clientes com links para tenant e empresa
      const { error } = await supabase.from('programa_validador_clientes').insert({
        nome_empresa: form.nome_empresa,
        cnpj: form.cnpj || null,
        poc_nome: form.poc_nome || null,
        poc_email: form.poc_email || null,
        poc_telefone: form.poc_telefone || null,
        poc_cargo: form.poc_cargo || null,
        fase: form.fase,
        segmento: form.segmento || null,
        tamanho_empresa: (form.tamanho_empresa as any) || null,
        quantidade_colaboradores: form.quantidade_colaboradores ? parseInt(form.quantidade_colaboradores) : null,
        responsavel_seguramente: form.responsavel_seguramente || null,
        data_inicio_piloto: form.data_inicio_piloto || null,
        data_fim_piloto: form.data_fim_piloto || null,
        observacoes: form.observacoes || null,
        tipo_cliente: form.tipo_cliente,
        endereco: form.endereco || null,
        representante: form.representante || null,
        cidade_foro: form.cidade_foro || null,
        valor_mensal: form.tipo_cliente === 'pagante' && form.valor_mensal ? parseFloat(form.valor_mensal) : null,
        activation_token: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
        activation_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        dia_vencimento: form.tipo_cliente === 'pagante' && form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
        plano: form.tipo_cliente === 'pagante' ? form.plano || null : null,
        data_contrato: form.tipo_cliente === 'pagante' ? form.data_contrato || null : null,
        data_vigencia_fim: form.tipo_cliente === 'pagante' ? form.data_vigencia_fim || null : null,
        tenant_id: tenantId,
        empresa_cadastro_id: empresa.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cliente adicionado! Empresa criada automaticamente no módulo de Estrutura Organizacional.');
      onSuccess();
    },
    onError: (err: any) => toast.error('Erro ao salvar cliente: ' + err.message),
  });

  const isPagante = form.tipo_cliente === 'pagante';

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Novo Cliente</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">

        {/* Identificador de Tipo */}
        <div className="col-span-2">
          <Label>Tipo de Cliente *</Label>
          <div className="flex gap-3 mt-1">
            {(['tester', 'pagante'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm(p => ({ ...p, tipo_cliente: t }))}
                className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                  form.tipo_cliente === t
                    ? t === 'pagante'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-accent bg-accent/20 text-accent-foreground'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {t === 'tester' ? '🧪 Tester (Programa Validador)' : '💼 Pagante (Cliente Ativo)'}
              </button>
            ))}
          </div>
          {isPagante && (
            <p className="text-xs text-muted-foreground mt-1">
              Clientes pagantes recebem o <strong>Contrato de Licença de Uso</strong> com Termos, Privacidade e SLA.
            </p>
          )}
        </div>

        {/* CNPJ com busca automática */}
        <div className="col-span-2">
          <Label>CNPJ</Label>
          <div className="flex gap-2 mt-1">
            <Input
              placeholder="00.000.000/0000-00"
              value={form.cnpj}
              onChange={e => {
                const cleaned = e.target.value.replace(/\D/g, '');
                if (cleaned.length <= 14) {
                  const formatted = formatCnpj(cleaned);
                  setForm(p => ({ ...p, cnpj: formatted }));
                }
              }}
              maxLength={18}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={cnpjLoading || cleanCnpj(form.cnpj).length !== 14}
              title="Buscar dados na Receita Federal"
              onClick={async () => {
                setCnpjLoading(true);
                try {
                  const result = await buscarCnpj(form.cnpj);
                  if (!result) { toast.error('CNPJ não encontrado.'); return; }
                  setForm(p => ({
                    ...p,
                    nome_empresa: result.razao_social || p.nome_empresa,
                    endereco: [result.logradouro, result.numero, result.bairro, result.municipio, result.uf].filter(Boolean).join(', '),
                    cidade_foro: result.municipio || p.cidade_foro,
                    poc_email: result.email || p.poc_email,
                  }));
                  toast.success('Dados preenchidos automaticamente!');
                } finally {
                  setCnpjLoading(false);
                }
              }}
            >
              {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Clique na lupa para preencher automaticamente pela Receita Federal</p>
        </div>

        <div className="col-span-2">
          <Label>Nome da Empresa *</Label>
          <Input value={form.nome_empresa} onChange={e => setForm(p => ({ ...p, nome_empresa: e.target.value }))} />
        </div>
        <div>
          <Label>Fase</Label>
          <Select value={form.fase} onValueChange={v => setForm(p => ({ ...p, fase: v as Fase }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FASES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Separator className="col-span-2" />
        <div>
          <Label>Responsável - Nome</Label>
          <Input value={form.poc_nome} onChange={e => setForm(p => ({ ...p, poc_nome: e.target.value }))} />
        </div>
        <div>
          <Label>Responsável - Cargo</Label>
          <Input value={form.poc_cargo} onChange={e => setForm(p => ({ ...p, poc_cargo: e.target.value }))} />
        </div>
        <div>
          <Label>Responsável - E-mail</Label>
          <Input type="email" value={form.poc_email} onChange={e => setForm(p => ({ ...p, poc_email: e.target.value }))} />
        </div>
        <div>
          <Label>Responsável - Telefone</Label>
          <Input value={form.poc_telefone} onChange={e => setForm(p => ({ ...p, poc_telefone: e.target.value }))} />
        </div>

        <Separator className="col-span-2" />
        <div>
          <Label>Segmento</Label>
          <Input value={form.segmento} onChange={e => setForm(p => ({ ...p, segmento: e.target.value }))} />
        </div>
        <div>
          <Label>Porte</Label>
          <Select value={form.tamanho_empresa} onValueChange={v => setForm(p => ({ ...p, tamanho_empresa: v }))}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="micro">Micro</SelectItem>
              <SelectItem value="pequena">Pequena</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="grande">Grande</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Qtd. Colaboradores</Label>
          <Input type="number" value={form.quantidade_colaboradores} onChange={e => setForm(p => ({ ...p, quantidade_colaboradores: e.target.value }))} />
        </div>
        <div>
          <Label>Responsável Seguramente</Label>
          <Input value={form.responsavel_seguramente} onChange={e => setForm(p => ({ ...p, responsavel_seguramente: e.target.value }))} />
        </div>

        {/* Dados para contrato */}
        <div className="col-span-2">
          <Label>Endereço (para contrato)</Label>
          <Input value={form.endereco} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))} placeholder="Rua, nº, Cidade — Estado" />
        </div>
        <div>
          <Label>Representante Legal</Label>
          <Input value={form.representante} onChange={e => setForm(p => ({ ...p, representante: e.target.value }))} placeholder="Nome completo" />
        </div>
        <div>
          <Label>Cidade para Foro</Label>
          <Input value={form.cidade_foro} onChange={e => setForm(p => ({ ...p, cidade_foro: e.target.value }))} placeholder="Ex: São Paulo" />
        </div>

        <div>
          <Label>{isPagante ? 'Início do Contrato' : 'Início do Piloto'}</Label>
          <Input type="date" value={form.data_inicio_piloto} onChange={e => setForm(p => ({ ...p, data_inicio_piloto: e.target.value }))} />
        </div>
        <div>
          <Label>{isPagante ? 'Fim da Vigência' : 'Fim do Piloto'}</Label>
          <Input type="date" value={form.data_fim_piloto} onChange={e => setForm(p => ({ ...p, data_fim_piloto: e.target.value }))} />
        </div>

        {/* Campos exclusivos para Pagante */}
        {isPagante && (
          <>
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">💼 Dados Comerciais</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
            <div>
              <Label>Plano</Label>
              <Input value={form.plano} onChange={e => setForm(p => ({ ...p, plano: e.target.value }))} placeholder="Ex: Profissional, Enterprise..." />
            </div>
            <div>
              <Label>Valor Mensal (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_mensal} onChange={e => setForm(p => ({ ...p, valor_mensal: e.target.value }))} placeholder="Ex: 299.90" />
            </div>
            <div>
              <Label>Dia de Vencimento</Label>
              <Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm(p => ({ ...p, dia_vencimento: e.target.value }))} placeholder="Ex: 10" />
            </div>
            <div>
              <Label>Data de Assinatura do Contrato</Label>
              <Input type="date" value={form.data_contrato} onChange={e => setForm(p => ({ ...p, data_contrato: e.target.value }))} />
            </div>
          </>
        )}

        <div className="col-span-2">
          <Label>Observações</Label>
          <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={3} />
        </div>
        <div className="col-span-2 flex justify-end">
          <Button
            disabled={!form.nome_empresa || criarMutation.isPending}
            onClick={() => criarMutation.mutate()}
          >
            {criarMutation.isPending ? 'Salvando...' : 'Criar Cliente'}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
