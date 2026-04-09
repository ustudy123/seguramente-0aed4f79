import type { BlocoRespostas } from "./types";

export function calcularNivelMaturidade(qtd: number | null): { nivel: number; label: string; cor: string; descricao: string; modulo: string } {
  const n = qtd || 0;
  if (n < 20) return {
    nivel: 1, label: 'Inicial', cor: 'text-amber-600',
    descricao: 'Implantação simplificada, foco em estrutura básica.',
    modulo: 'Diagnóstico Organizacional Simplificado'
  };
  if (n <= 100) return {
    nivel: 2, label: 'Estruturado', cor: 'text-blue-600',
    descricao: 'Implantação intermediária, incluindo diagnósticos.',
    modulo: 'Diagnóstico Psicossocial Organizacional'
  };
  return {
    nivel: 3, label: 'Avançado', cor: 'text-primary',
    descricao: 'Implantação completa com ativação rápida de módulos estratégicos.',
    modulo: 'Diagnóstico Completo de Gestão Organizacional'
  };
}

export function calcularIndice(respostas: BlocoRespostas): number {
  const total = Object.keys(respostas).length;
  if (total === 0) return 0;
  const positivas = Object.values(respostas).filter(Boolean).length;
  return Math.round((positivas / total) * 100);
}

export function calcularNivelIndice(indice: number): { label: string; cor: string; bg: string } {
  if (indice <= 25) return { label: 'Inicial', cor: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' };
  if (indice <= 50) return { label: 'Básico', cor: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20' };
  if (indice <= 75) return { label: 'Estruturado', cor: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20' };
  return { label: 'Avançado', cor: 'text-primary', bg: 'bg-primary/10 border-primary/20' };
}

export function gerarPrioridades(indice: number): { ordem: number; texto: string; rota?: string }[] {
  if (indice <= 25) return [
    { ordem: 1, texto: 'Cadastro de funções', rota: '/estrutura/cargos' },
    { ordem: 2, texto: 'Organização de departamentos', rota: '/estrutura/departamentos' },
    { ordem: 3, texto: 'Cadastro de colaboradores', rota: '/colaboradores' },
    { ordem: 4, texto: 'Estrutura organizacional', rota: '/estrutura' },
  ];
  if (indice <= 50) return [
    { ordem: 1, texto: 'Organograma organizacional', rota: '/estrutura/organograma' },
    { ordem: 2, texto: 'Responsáveis por setor', rota: '/estrutura/departamentos' },
    { ordem: 3, texto: 'Indicadores de gestão', rota: '/dashboard' },
  ];
  return [
    { ordem: 1, texto: 'Diagnóstico psicossocial organizacional', rota: '/psicossocial' },
    { ordem: 2, texto: 'Indicadores organizacionais', rota: '/dashboard' },
    { ordem: 3, texto: 'Monitoramento contínuo', rota: '/dashboard' },
  ];
}

export function downloadDoc(html: string, nomeArq: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArq;
  a.click();
  URL.revokeObjectURL(url);
}
