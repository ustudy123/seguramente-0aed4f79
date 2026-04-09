import type { Fase, TipoDoc } from './types';

export const FASES: { value: Fase; label: string; color: string; border: string; bgKanban: string }[] = [
  { value: 'prospeccao',  label: 'Prospecção',  color: 'bg-muted text-muted-foreground',          border: 'border-t-2 border-muted-foreground/30', bgKanban: 'bg-slate-50 dark:bg-slate-900/40' },
  { value: 'qualificacao',label: 'Qualificação', color: 'bg-accent text-accent-foreground',         border: 'border-t-2 border-accent', bgKanban: 'bg-amber-50/60 dark:bg-amber-950/20' },
  { value: 'kickoff',     label: 'Kickoff',      color: 'bg-secondary text-secondary-foreground',   border: 'border-t-2 border-secondary', bgKanban: 'bg-blue-50/60 dark:bg-blue-950/20' },
  { value: 'ativo',       label: 'Ativo',        color: 'bg-primary/15 text-primary',               border: 'border-t-2 border-primary', bgKanban: 'bg-emerald-50/60 dark:bg-emerald-950/20' },
  { value: 'suspenso',    label: 'Suspenso',     color: 'bg-muted text-muted-foreground border border-border', border: 'border-t-2 border-muted-foreground/50', bgKanban: 'bg-orange-50/50 dark:bg-orange-950/20' },
  { value: 'encerrado',   label: 'Encerrado',    color: 'bg-destructive/10 text-destructive',       border: 'border-t-2 border-destructive/50', bgKanban: 'bg-red-50/40 dark:bg-red-950/20' },
];

export const DOCS_CONFIG_TESTER: { tipo: TipoDoc; label: string; descricao: string; itens?: string[] }[] = [
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

export const DOCS_CONFIG_PAGANTE: { tipo: TipoDoc; label: string; descricao: string; itens?: string[] }[] = [
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
