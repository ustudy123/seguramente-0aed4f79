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
  LayoutList, Columns, ChevronLeft, Send, ExternalLink, Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  | 'contrato_piloto'
  | 'dpa_lgpd'
  | 'anexo_operacional'
  | 'faq_seguranca'
  | 'resumo_beta'
  | 'politica_privacidade'
  | 'termos_uso'
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

const FASES: { value: Fase; label: string; color: string; border: string }[] = [
  { value: 'prospeccao',  label: 'Prospecção',  color: 'bg-muted text-muted-foreground',          border: 'border-t-2 border-muted-foreground/30' },
  { value: 'qualificacao',label: 'Qualificação', color: 'bg-accent text-accent-foreground',         border: 'border-t-2 border-accent' },
  { value: 'kickoff',     label: 'Kickoff',      color: 'bg-secondary text-secondary-foreground',   border: 'border-t-2 border-secondary' },
  { value: 'ativo',       label: 'Ativo',        color: 'bg-primary/15 text-primary',               border: 'border-t-2 border-primary' },
  { value: 'suspenso',    label: 'Suspenso',     color: 'bg-muted text-muted-foreground border border-border', border: 'border-t-2 border-muted-foreground/50' },
  { value: 'encerrado',   label: 'Encerrado',    color: 'bg-destructive/10 text-destructive',       border: 'border-t-2 border-destructive/50' },
];

const DOCS_CONFIG: { tipo: TipoDoc; label: string }[] = [
  { tipo: 'contrato_piloto',    label: 'Contrato Piloto' },
  { tipo: 'dpa_lgpd',           label: 'DPA / Anexo LGPD' },
  { tipo: 'anexo_operacional',  label: 'Anexo Operacional' },
  { tipo: 'faq_seguranca',      label: 'FAQ Segurança' },
  { tipo: 'resumo_beta',        label: 'Resumo Beta' },
  { tipo: 'politica_privacidade',label: 'Política de Privacidade' },
  { tipo: 'termos_uso',         label: 'Termos de Uso' },
  { tipo: 'ata_kickoff',        label: 'Ata de Kickoff' },
];

// ─── Geradores de HTML dos documentos ────────────────────────────────────────

function gerarHtmlDocumento(tipo: TipoDoc, cliente: Cliente): string {
  const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const empresa = cliente.nome_empresa;
  const cnpj = cliente.cnpj || '___________________';
  const representante = cliente.representante || cliente.poc_nome || '___________________';

  const cabecalho = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>
    body{font-family:Arial,sans-serif;font-size:13px;line-height:1.7;color:#222;max-width:800px;margin:0 auto;padding:40px 30px;}
    h1{font-size:15px;text-align:center;text-transform:uppercase;font-weight:bold;margin-bottom:4px;}
    h2{font-size:13px;text-align:center;text-transform:uppercase;margin-top:0;margin-bottom:30px;}
    .clausula{margin-top:20px;} .clausula-titulo{font-weight:bold;text-transform:uppercase;}
    .destaque{background:#f9f9f9;border:1px solid #ddd;padding:16px;border-radius:4px;margin:20px 0;}
  </style></head><body>`;
  const rodape = `<p style="margin-top:30px;">Data: ${dataGeracao}</p>
    <div style="display:flex;gap:60px;margin-top:40px;">
      <div style="flex:1;border-top:1px solid #333;padding-top:8px;text-align:center;"><p><strong>${empresa}</strong></p><p>${representante}</p></div>
      <div style="flex:1;border-top:1px solid #333;padding-top:8px;text-align:center;"><p><strong>SEGURAMENTE TECNOLOGIA LTDA</strong></p></div>
    </div></body></html>`;

  const conteudos: Record<TipoDoc, string> = {
    contrato_piloto: ``,  // usa gerarHtmlContrato
    dpa_lgpd: `<h1>DATA PROCESSING AGREEMENT — ANEXO LGPD</h1>
      <h2>PROGRAMA VALIDADOR SEGURAMENTE</h2>
      <div class="destaque"><p><strong>CONTROLADOR:</strong> ${empresa}, CNPJ ${cnpj}, representada por ${representante}.</p>
      <p><strong>OPERADOR:</strong> SEGURAMENTE TECNOLOGIA LTDA.</p></div>
      <div class="clausula"><p class="clausula-titulo">1. OBJETO</p>
      <p>Este Acordo regula o tratamento de dados pessoais realizado pela SEGURAMENTE na qualidade de operadora, conforme instruções do CONTROLADOR, no âmbito da Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).</p></div>
      <div class="clausula"><p class="clausula-titulo">2. DADOS TRATADOS</p>
      <p>Dados de colaboradores, como nome, CPF, dados de saúde ocupacional e documentos trabalhistas inseridos pelo CONTROLADOR na plataforma Seguramente.</p></div>
      <div class="clausula"><p class="clausula-titulo">3. FINALIDADE</p>
      <p>Gestão de saúde e segurança do trabalho, organização de dados empresariais e processos internos de RH.</p></div>
      <div class="clausula"><p class="clausula-titulo">4. SEGURANÇA</p>
      <p>A SEGURAMENTE adota medidas técnicas adequadas de segurança, incluindo criptografia, controle de acesso e backups regulares.</p></div>
      <div class="clausula"><p class="clausula-titulo">5. SUBOPERADORES</p>
      <p>A SEGURAMENTE utiliza a infraestrutura Supabase/AWS para armazenamento, com cláusulas contratuais de proteção de dados.</p></div>
      <div class="clausula"><p class="clausula-titulo">6. DIREITOS DO TITULAR</p>
      <p>O CONTROLADOR é responsável por atender às solicitações dos titulares de dados. A SEGURAMENTE cooperará conforme necessário.</p></div>`,

    anexo_operacional: `<h1>ANEXO OPERACIONAL</h1>
      <h2>PROGRAMA VALIDADOR SEGURAMENTE</h2>
      <div class="destaque"><p><strong>EMPRESA:</strong> ${empresa} — CNPJ ${cnpj}</p><p><strong>RESPONSÁVEL:</strong> ${representante}</p></div>
      <div class="clausula"><p class="clausula-titulo">1. ACESSO AO SISTEMA</p>
      <p>O acesso será concedido mediante credenciais individuais. O número máximo de usuários ativos durante o período beta será definido conjuntamente.</p></div>
      <div class="clausula"><p class="clausula-titulo">2. SUPORTE TÉCNICO</p>
      <p>O suporte será prestado por e-mail e WhatsApp em horário comercial (seg–sex, 9h–18h). SLA de resposta: até 24h úteis.</p></div>
      <div class="clausula"><p class="clausula-titulo">3. FEEDBACKS</p>
      <p>A EMPRESA VALIDADORA se compromete a participar de reuniões mensais de feedback e responder pesquisas enviadas pela SEGURAMENTE.</p></div>
      <div class="clausula"><p class="clausula-titulo">4. MÓDULOS DISPONÍVEIS</p>
      <p>Saúde & SST, Colaboradores, Ponto, Férias, Documentos, Treinamentos e funcionalidades em versão beta, conforme disponibilizadas progressivamente.</p></div>
      <div class="clausula"><p class="clausula-titulo">5. LIMITAÇÕES DO PERÍODO BETA</p>
      <p>Durante o programa validador, algumas funcionalidades podem estar em desenvolvimento. A SEGURAMENTE comunicará mudanças relevantes com antecedência mínima de 48h.</p></div>`,

    faq_seguranca: `<h1>FAQ DE SEGURANÇA DA INFORMAÇÃO</h1>
      <h2>PROGRAMA VALIDADOR SEGURAMENTE</h2>
      <p style="text-align:center;margin-bottom:30px;">Ciência e aceite — ${empresa}</p>
      <div class="clausula"><p class="clausula-titulo">1. Como os dados são armazenados?</p>
      <p>Todos os dados são armazenados em servidores em nuvem com criptografia em repouso e em trânsito (TLS 1.2+). Utilizamos infraestrutura da Supabase/AWS.</p></div>
      <div class="clausula"><p class="clausula-titulo">2. Quem tem acesso aos dados?</p>
      <p>Apenas colaboradores da SEGURAMENTE com função técnica específica, mediante autenticação. Nenhum dado é compartilhado com terceiros sem consentimento.</p></div>
      <div class="clausula"><p class="clausula-titulo">3. Como são gerenciadas as senhas?</p>
      <p>Senhas são armazenadas com hash criptográfico (bcrypt). Nunca são armazenadas em texto simples. Recomendamos autenticação de dois fatores.</p></div>
      <div class="clausula"><p class="clausula-titulo">4. O que acontece em caso de incidente?</p>
      <p>A SEGURAMENTE notificará o cliente em até 72h após identificação de qualquer incidente que possa afetar dados pessoais, conforme exigido pela LGPD.</p></div>
      <div class="clausula"><p class="clausula-titulo">5. Como são feitos os backups?</p>
      <p>Backups automáticos diários com retenção de 30 dias. Possibilidade de restauração pontual mediante solicitação.</p></div>
      <p style="margin-top:30px;"><strong>Ao aceitar este documento, ${representante} declara ter lido e compreendido as práticas de segurança da SEGURAMENTE.</strong></p>`,

    resumo_beta: `<h1>RESUMO DO PROGRAMA BETA VALIDADOR</h1>
      <h2>SEGURAMENTE PLATAFORMA DE GESTÃO</h2>
      <div class="destaque"><p><strong>EMPRESA:</strong> ${empresa}</p><p><strong>RESPONSÁVEL:</strong> ${representante}</p><p><strong>DATA:</strong> ${dataGeracao}</p></div>
      <div class="clausula"><p class="clausula-titulo">O QUE É O PROGRAMA VALIDADOR?</p>
      <p>O Programa Validador é uma iniciativa da SEGURAMENTE para validar a plataforma com empresas parceiras antes do lançamento oficial. As empresas participantes testam funcionalidades reais e fornecem feedback estratégico.</p></div>
      <div class="clausula"><p class="clausula-titulo">BENEFÍCIOS PARA A EMPRESA VALIDADORA</p>
      <ul><li>Acesso gratuito por 6 meses</li><li>50% de desconto na assinatura após o beta</li><li>Atendimento prioritário</li><li>Influência direta no roadmap do produto</li></ul></div>
      <div class="clausula"><p class="clausula-titulo">COMPROMETIMENTOS</p>
      <ul><li>Utilizar a plataforma ativamente</li><li>Participar de reuniões mensais de feedback</li><li>Responder pesquisas de satisfação</li></ul></div>
      <div class="clausula"><p class="clausula-titulo">PRÓXIMOS PASSOS</p>
      <p>Após este aceite, você receberá as credenciais de acesso e será contatado pelo seu responsável na SEGURAMENTE para o kickoff.</p></div>`,

    politica_privacidade: `<h1>POLÍTICA DE PRIVACIDADE</h1>
      <h2>PLATAFORMA SEGURAMENTE — CIÊNCIA DO CLIENTE</h2>
      <div class="destaque"><p><strong>EMPRESA:</strong> ${empresa} — CNPJ ${cnpj}</p></div>
      <div class="clausula"><p class="clausula-titulo">1. COLETA DE DADOS</p>
      <p>A SEGURAMENTE coleta dados inseridos pelos usuários da plataforma, como dados de colaboradores, documentos e informações de saúde ocupacional. Também coletamos dados de uso (logs de acesso, ações realizadas).</p></div>
      <div class="clausula"><p class="clausula-titulo">2. USO DOS DADOS</p>
      <p>Os dados são utilizados exclusivamente para prestação dos serviços contratados. Não realizamos venda ou compartilhamento de dados com terceiros para fins comerciais.</p></div>
      <div class="clausula"><p class="clausula-titulo">3. RETENÇÃO</p>
      <p>Os dados são mantidos pelo período contratual e por até 5 anos após o encerramento, conforme exigências legais trabalhistas brasileiras.</p></div>
      <div class="clausula"><p class="clausula-titulo">4. DIREITOS</p>
      <p>Você tem direito de acesso, correção, portabilidade e exclusão dos dados. Solicitações podem ser enviadas para privacidade@seguramente.app.</p></div>
      <div class="clausula"><p class="clausula-titulo">5. COOKIES</p>
      <p>Utilizamos cookies essenciais para funcionamento da plataforma e cookies analíticos para melhoria do produto (Google Analytics com anonimização de IP).</p></div>`,

    termos_uso: `<h1>TERMOS DE USO DA PLATAFORMA</h1>
      <h2>SEGURAMENTE — ACEITE DO CLIENTE</h2>
      <div class="destaque"><p><strong>EMPRESA:</strong> ${empresa} — CNPJ ${cnpj}</p><p><strong>RESPONSÁVEL:</strong> ${representante}</p></div>
      <div class="clausula"><p class="clausula-titulo">1. ACEITAÇÃO</p>
      <p>Ao utilizar a plataforma SEGURAMENTE, você concorda com estes Termos de Uso. Caso não concorde, não utilize a plataforma.</p></div>
      <div class="clausula"><p class="clausula-titulo">2. USO PERMITIDO</p>
      <p>A plataforma deve ser utilizada exclusivamente para fins legítimos de gestão empresarial. É proibido o uso para fins ilícitos, difamação ou violação de direitos de terceiros.</p></div>
      <div class="clausula"><p class="clausula-titulo">3. RESPONSABILIDADES DO USUÁRIO</p>
      <p>O usuário é responsável pela veracidade dos dados inseridos e pela segurança das suas credenciais de acesso.</p></div>
      <div class="clausula"><p class="clausula-titulo">4. PROPRIEDADE INTELECTUAL</p>
      <p>Todo o conteúdo, código e design da plataforma são propriedade da SEGURAMENTE. É proibida a reprodução sem autorização.</p></div>
      <div class="clausula"><p class="clausula-titulo">5. DISPONIBILIDADE</p>
      <p>A SEGURAMENTE se esforça para manter a plataforma disponível 24/7, mas não garante disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência.</p></div>
      <div class="clausula"><p class="clausula-titulo">6. MODIFICAÇÕES</p>
      <p>Estes termos podem ser atualizados. Alterações significativas serão comunicadas com 30 dias de antecedência.</p></div>`,

    ata_kickoff: `<h1>ATA DE REUNIÃO DE KICKOFF</h1>
      <h2>PROGRAMA VALIDADOR SEGURAMENTE</h2>
      <div class="destaque">
        <p><strong>DATA:</strong> ${dataGeracao}</p>
        <p><strong>EMPRESA:</strong> ${empresa} — CNPJ ${cnpj}</p>
        <p><strong>PARTICIPANTE DA EMPRESA:</strong> ${representante}</p>
        <p><strong>RESPONSÁVEL SEGURAMENTE:</strong> ___________________</p>
      </div>
      <div class="clausula"><p class="clausula-titulo">1. OBJETIVO DA REUNIÃO</p>
      <p>Apresentação da plataforma, alinhamento de expectativas, definição de cronograma e início formal do Programa Validador.</p></div>
      <div class="clausula"><p class="clausula-titulo">2. MÓDULOS APRESENTADOS</p>
      <p>☐ Saúde & SST &nbsp; ☐ Colaboradores &nbsp; ☐ Ponto &nbsp; ☐ Férias &nbsp; ☐ Documentos &nbsp; ☐ Treinamentos</p></div>
      <div class="clausula"><p class="clausula-titulo">3. CRONOGRAMA ACORDADO</p>
      <p>Início: _______________ &nbsp; Fim previsto: _______________ &nbsp; Reunião de acompanhamento: _______________</p></div>
      <div class="clausula"><p class="clausula-titulo">4. PRÓXIMOS PASSOS</p>
      <p>☐ Envio de credenciais &nbsp; ☐ Cadastro inicial de dados &nbsp; ☐ Treinamento da equipe &nbsp; ☐ Acompanhamento semana 2</p></div>
      <div class="clausula"><p class="clausula-titulo">5. OBSERVAÇÕES</p>
      <p style="min-height:60px;">___________________________________________________________________________________</p></div>`,
  };

  // contrato_piloto usa o gerador principal
  if (tipo === 'contrato_piloto') {
    return gerarHtmlContrato(cliente);
  }

  return cabecalho + conteudos[tipo] + rodape;
}

// ─── Gerador de HTML do contrato ─────────────────────────────────────────────

function gerarHtmlContrato(cliente: Cliente): string {
  const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.7; color: #222; max-width: 800px; margin: 0 auto; padding: 40px 30px; }
  h1 { font-size: 15px; text-align: center; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
  h2 { font-size: 13px; text-align: center; text-transform: uppercase; margin-top: 0; margin-bottom: 30px; }
  .clausula { margin-top: 20px; }
  .clausula-titulo { font-weight: bold; text-transform: uppercase; }
  .partes { background: #f9f9f9; border: 1px solid #ddd; padding: 16px; border-radius: 4px; margin: 20px 0; }
</style></head>
<body>
<h1>CONTRATO DE PARTICIPAÇÃO NO PROGRAMA VALIDADOR</h1>
<h2>E USO DA PLATAFORMA SEGURAMENTE</h2>
<p>Pelo presente instrumento particular, de um lado:</p>
<div class="partes">
  <p><strong>SEGURAMENTE TECNOLOGIA LTDA</strong>, pessoa jurídica de direito privado, doravante denominada <strong>SEGURAMENTE</strong>.</p>
  <p>E de outro lado:</p>
  <p><strong>${cliente.nome_empresa}</strong>${cliente.cnpj ? `, inscrita no CNPJ nº ${cliente.cnpj}` : ''}${cliente.endereco ? `, com sede em ${cliente.endereco}` : ''}${cliente.representante ? `, neste ato representada por <strong>${cliente.representante}</strong>` : ''}, doravante denominada <strong>EMPRESA VALIDADORA</strong>.</p>
</div>
<p>As partes resolvem firmar o presente contrato, que se regerá pelas cláusulas abaixo.</p>

<div class="clausula"><p class="clausula-titulo">CLÁUSULA 1 — OBJETO</p>
<p>O presente contrato tem por objeto a participação da EMPRESA VALIDADORA no Programa Validador da Plataforma Seguramente, permitindo o acesso e utilização da plataforma em fase de validação (Beta).</p>
<p>A plataforma Seguramente é um sistema digital destinado ao apoio à gestão organizacional, incluindo funcionalidades relacionadas à:</p>
<ul><li>gestão de saúde e segurança do trabalho</li><li>organização de dados empresariais</li><li>indicadores organizacionais</li><li>avaliações organizacionais</li><li>gestão de processos internos.</li></ul></div>

<div class="clausula"><p class="clausula-titulo">CLÁUSULA 2 — NATUREZA DO PROGRAMA</p>
<p>A EMPRESA VALIDADORA reconhece que:</p>
<ul><li>o Seguramente encontra-se em fase de desenvolvimento e validação (Beta)</li><li>o sistema poderá sofrer atualizações, ajustes e melhorias</li><li>eventuais falhas ou instabilidades podem ocorrer durante o período de validação.</li></ul></div>

<div class="clausula"><p class="clausula-titulo">CLÁUSULA 3 — PRAZO</p>
<p>O Programa Validador terá duração de 6 meses, contados a partir da liberação do acesso ao sistema.</p></div>

<div class="clausula"><p class="clausula-titulo">CLÁUSULA 4 — CONDIÇÕES COMERCIAIS</p>
<p>Durante o período do Programa Validador: o acesso ao sistema será gratuito. Após o período de validação, a EMPRESA VALIDADORA terá direito a 50% de desconto no valor da assinatura da plataforma, conforme plano contratado.</p></div>

<div class="clausula"><p class="clausula-titulo">CLÁUSULA 5 — CONTRAPARTIDA DA EMPRESA</p>
<p>A EMPRESA VALIDADORA compromete-se a: utilizar efetivamente a plataforma; fornecer feedbacks; colaborar com a evolução do sistema.</p></div>

<div class="clausula"><p class="clausula-titulo">CLÁUSULA 6 — LIMITAÇÃO DE RESPONSABILIDADE</p>
<p>A plataforma Seguramente constitui ferramenta de apoio à gestão e não substitui consultorias técnicas, jurídicas ou contábeis. A SEGURAMENTE não se responsabiliza por decisões tomadas com base nas informações apresentadas pelo sistema.</p></div>

<div class="clausula"><p class="clausula-titulo">CLÁUSULA 7 — SEGURANÇA DA INFORMAÇÃO</p>
<p>A SEGURAMENTE adota medidas técnicas e organizacionais para proteção das informações armazenadas no sistema. Os dados são armazenados em infraestrutura de computação em nuvem segura.</p></div>

<div class="clausula"><p class="clausula-titulo">CLÁUSULA 8 — PROTEÇÃO DE DADOS (LGPD)</p>
<p>A EMPRESA VALIDADORA atua como controladora dos dados, enquanto a SEGURAMENTE atua como operadora, conforme a Lei Geral de Proteção de Dados. Os dados inseridos no sistema pertencem à EMPRESA VALIDADORA.</p></div>

<div class="clausula"><p class="clausula-titulo">CLÁUSULA 9 — CONFIDENCIALIDADE</p>
<p>As partes comprometem-se a manter sigilo sobre todas as informações compartilhadas no âmbito deste contrato.</p></div>

<div class="clausula"><p class="clausula-titulo">CLÁUSULA 10 — PROPRIEDADE INTELECTUAL</p>
<p>A plataforma Seguramente constitui propriedade intelectual da SEGURAMENTE.</p></div>

<div class="clausula"><p class="clausula-titulo">CLÁUSULA 11 — ENCERRAMENTO</p>
<p>A EMPRESA VALIDADORA poderá solicitar o encerramento do uso do sistema a qualquer momento.</p></div>

<div class="clausula"><p class="clausula-titulo">CLÁUSULA 12 — FORO</p>
<p>Fica eleito o foro da comarca de ${cliente.cidade_foro || 'São Paulo'}, para dirimir eventuais controvérsias.</p></div>

<p style="margin-top:30px;">Data de geração do contrato: ${dataGeracao}</p>

<div style="display:flex;gap:60px;margin-top:40px;">
  <div style="flex:1;border-top:1px solid #333;padding-top:8px;text-align:center;">
    <p><strong>EMPRESA VALIDADORA</strong></p>
    <p>${cliente.representante || cliente.poc_nome || '___________________'}</p>
  </div>
  <div style="flex:1;border-top:1px solid #333;padding-top:8px;text-align:center;">
    <p><strong>SEGURAMENTE TECNOLOGIA LTDA</strong></p>
  </div>
</div>
</body></html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  onMover,
  faseAtual,
}: {
  cliente: Cliente;
  onOpen: () => void;
  onMover: (id: string, fase: Fase) => void;
  faseAtual: Fase;
}) {
  const idx = FASES.findIndex(f => f.value === faseAtual);
  const proxima = FASES[idx + 1]?.value;
  const anterior = FASES[idx - 1]?.value;

  return (
    <div className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-all space-y-2">
      <div className="cursor-pointer" onClick={onOpen}>
        <p className="font-semibold text-sm leading-tight">{cliente.nome_empresa}</p>
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
      {/* Setas de mover */}
      <div className="flex gap-1 pt-1 border-t border-border">
        <button
          disabled={!anterior}
          onClick={() => anterior && onMover(cliente.id, anterior)}
          className="flex-1 flex items-center justify-center h-6 rounded text-xs text-muted-foreground hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title={anterior ? `Mover para ${FASES.find(f=>f.value===anterior)?.label}` : ''}
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <button
          disabled={!proxima}
          onClick={() => proxima && onMover(cliente.id, proxima)}
          className="flex-1 flex items-center justify-center h-6 rounded text-xs text-muted-foreground hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title={proxima ? `Mover para ${FASES.find(f=>f.value===proxima)?.label}` : ''}
        >
          <ChevronRight className="w-3 h-3" />
        </button>
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
      <div className="min-h-screen bg-background p-6 space-y-6">
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
                  <div key={fase.value} className={`w-60 bg-muted/30 rounded-xl ${fase.border} flex flex-col`}>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">{fase.label}</span>
                      <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{cards.length}</span>
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
                            onMover={(id, novaFase) => moverFaseMutation.mutate({ id, fase: novaFase })}
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

  const { data: docLinks = [] } = useQuery({
    queryKey: ['validador', 'doc-links', cliente.id],
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
    mutationFn: async (tipo: TipoDoc) => {
      const html = gerarHtmlDocumento(tipo, cliente);
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
        titulo: `Link de aceite gerado: ${DOCS_CONFIG.find(d => d.tipo === tipo)?.label}`,
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

  const docAceitos = documentos.filter(d => d.status === 'aceito').length;
  const totalDocs = DOCS_CONFIG.length;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{cliente.nome_empresa}</h1>
            <FaseBadge fase={cliente.fase} />
            {cliente.aceita_beta && (
              <Badge variant="outline" className="text-xs">
                <Shield className="w-3 h-3 mr-1" />Beta aceito
              </Badge>
            )}
          </div>
          {cliente.segmento && <p className="text-sm text-muted-foreground">{cliente.segmento}</p>}
        </div>
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

          {/* Checklist de documentos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documentos e Aceites
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {docAceitos}/{totalDocs} aceitos
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {DOCS_CONFIG.map(({ tipo, label }) => {
                const doc = documentos.find(d => d.tipo === tipo);
                const status = doc?.status || 'pendente';
                const linkAtivo = docLinks.find(l => l.tipo === tipo && l.status !== 'recusado');
                const isGerando = gerandoDoc === tipo && gerarDocLinkMutation.isPending;

                return (
                  <div key={tipo} className="py-2 border-b border-border last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <DocStatusIcon status={status} />
                        <span className="text-sm truncate">{label}</span>
                        {doc?.aceito_em && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(doc.aceito_em), 'dd/MM/yy', { locale: ptBR })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Botão gerar/copiar link */}
                        {status !== 'aceito' && (
                          linkAtivo ? (
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
                                gerarDocLinkMutation.mutate(tipo);
                              }}
                            >
                              {isGerando ? (
                                <span className="flex items-center gap-1"><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />Gerando...</span>
                              ) : (
                                <><FileText className="w-3 h-3 mr-1" />Gerar</>
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
                    {/* Link ativo exibido abaixo */}
                    {linkAtivo && status !== 'aceito' && (
                      <div className="mt-1 ml-6 flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
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
                  <span>{cliente.poc_telefone}</span>
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
            </CardContent>
          </Card>

          {cliente.observacoes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{cliente.observacoes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-3 text-xs text-muted-foreground">
              Criado em {format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Dialog novo cliente ──────────────────────────────────────────────────────

function NovoClienteDialog({ onSuccess }: { onSuccess: () => void }) {
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
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cliente adicionado ao programa validador!');
      onSuccess();
    },
    onError: () => toast.error('Erro ao salvar cliente'),
  });

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Novo Cliente Validador</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Nome da Empresa *</Label>
          <Input value={form.nome_empresa} onChange={e => setForm(p => ({ ...p, nome_empresa: e.target.value }))} />
        </div>
        <div>
          <Label>CNPJ</Label>
          <Input value={form.cnpj} onChange={e => setForm(p => ({ ...p, cnpj: e.target.value }))} />
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
        <div>
          <Label>Início do Piloto</Label>
          <Input type="date" value={form.data_inicio_piloto} onChange={e => setForm(p => ({ ...p, data_inicio_piloto: e.target.value }))} />
        </div>
        <div>
          <Label>Fim do Piloto</Label>
          <Input type="date" value={form.data_fim_piloto} onChange={e => setForm(p => ({ ...p, data_fim_piloto: e.target.value }))} />
        </div>
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
