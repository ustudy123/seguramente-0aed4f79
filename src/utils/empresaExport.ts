import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EmpresaCadastro } from '@/types/empresa';

type Empresa = EmpresaCadastro & { ativo: boolean };

const fmt = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (Array.isArray(v)) return v.length ? `${v.length} item(ns)` : '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const fmtCnpj = (cnpj: string | null | undefined) => {
  if (!cnpj) return '—';
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3.$4-$5');
};

const fmtCpf = (cpf: string | null | undefined) => {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const fmtCep = (cep: string | null | undefined) => {
  if (!cep) return '—';
  const d = cep.replace(/\D/g, '');
  if (d.length !== 8) return cep;
  return d.replace(/(\d{5})(\d{3})/, '$1-$2');
};

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
};

// ===== Section schema (every step of the cadastro) =====
const sections = (e: Empresa): { title: string; rows: [string, string][] }[] => [
  {
    title: 'Dados Básicos',
    rows: [
      ['Razão Social', fmt(e.razao_social)],
      ['Nome Fantasia', fmt(e.nome_fantasia)],
      ['Tipo de Pessoa', e.tipo_pessoa === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'],
      ['CNPJ', fmtCnpj(e.cnpj)],
      ['CPF', fmtCpf(e.cpf)],
      ['CEI', fmt(e.cei)],
      ['CAEPF', fmt(e.caepf)],
      ['Inscrição Estadual', fmt(e.inscricao_estadual)],
      ['Inscrição Municipal', fmt(e.inscricao_municipal)],
      ['CEP', fmtCep(e.cep)],
      ['Endereço', fmt(e.endereco)],
      ['Número', fmt(e.numero)],
      ['Complemento', fmt(e.complemento)],
      ['Bairro', fmt(e.bairro)],
      ['Cidade', fmt(e.cidade)],
      ['Estado', fmt(e.estado)],
      ['Telefone', fmt(e.telefone)],
      ['E-mail', fmt(e.email)],
      ['Website', fmt(e.website)],
      ['Status', e.ativo ? 'Ativa' : 'Inativa'],
      ['Total de Colaboradores', fmt(e.total_colaboradores)],
    ],
  },
  {
    title: 'Enquadramento Legal (CNAE / Risco / SESMT / CIPA)',
    rows: [
      ['CNAE Principal', fmt(e.cnae_principal)],
      ['Descrição CNAE', fmt(e.cnae_descricao)],
      ['CNAEs Secundários', (e.cnaes_secundarios || []).map(c => `${c.codigo} - ${c.descricao}`).join(' | ') || '—'],
      ['Grau de Risco', fmt(e.grau_risco)],
      ['Grau de Risco Ajustado', fmt(e.grau_risco_ajustado)],
      ['Justificativa do Ajuste', fmt(e.grau_risco_justificativa)],
      ['SESMT Obrigatório', fmt(e.sesmt_obrigatorio)],
      ['SESMT Situação', fmt(e.sesmt_situacao)],
      ['SESMT Profissionais', (e.sesmt_profissionais || []).map(p => `${p.tipo}: ${p.nome} (${p.registro})`).join(' | ') || '—'],
      ['CIPA Obrigatória', fmt(e.cipa_obrigatoria)],
      ['CIPA Situação', fmt(e.cipa_situacao)],
      ['CIPA Mandato Início', fmtDate(e.cipa_data_mandato_inicio)],
      ['CIPA Mandato Fim', fmtDate(e.cipa_data_mandato_fim)],
      ['CIPA Membros', (e.cipa_membros || []).map(m => `${m.nome} (${m.funcao} - ${m.tipo})`).join(' | ') || '—'],
    ],
  },
  {
    title: 'Inclusão (PCD / Jovem Aprendiz)',
    rows: [
      ['PCD Obrigatória', fmt(e.pcd_obrigatoria)],
      ['PCD Quantidade Exigida', fmt(e.pcd_quantidade_exigida)],
      ['PCD Quantidade Atual', fmt(e.pcd_quantidade_atual)],
      ['PCD Percentual Exigido', fmt(e.pcd_percentual_exigido)],
      ['Aprendiz Quantidade Mínima', fmt(e.aprendiz_quantidade_minima)],
      ['Aprendiz Quantidade Máxima', fmt(e.aprendiz_quantidade_maxima)],
      ['Aprendiz Quantidade Atual', fmt(e.aprendiz_quantidade_atual)],
    ],
  },
  {
    title: 'Indicadores (FAP / TAC)',
    rows: [
      ['FAP Atual', fmt(e.fap_atual)],
      ['FAP Classificação', fmt(e.fap_classificacao)],
      ['FAP Histórico', (e.fap_historico || []).map(h => `${h.ano}: ${h.valor}`).join(' | ') || '—'],
      ['Possui TAC', fmt(e.tac_possui)],
      ['TAC Detalhes', (e.tac_detalhes || []).map(t => `${t.numero} (${t.orgao_emissor}) - ${t.status}`).join(' | ') || '—'],
    ],
  },
  {
    title: 'Jornada e Turnos',
    rows: [
      ['Jornada Padrão', fmt(e.jornada_padrao)],
      ['Possui 3º Turno', fmt(e.possui_terceiro_turno)],
      ['Escalas Especiais', fmt(e.possui_escalas_especiais)],
      ['Turnos', (e.turnos || []).map(t => `${t.nome}: ${t.horario_inicio}-${t.horario_fim}`).join(' | ') || '—'],
      ['Trabalho em Altura (NR-35)', fmt(e.trabalho_altura)],
      ['Espaço Confinado (NR-33)', fmt(e.espaco_confinado)],
      ['Insalubridade (NR-15)', fmt(e.insalubridade)],
      ['Periculosidade (NR-16)', fmt(e.periculosidade)],
      ['Aposentadoria Especial', fmt(e.aposentadoria_especial)],
    ],
  },
  {
    title: 'Hierarquia / Grupo Econômico',
    rows: [
      ['Tipo de Unidade', fmt(e.tipo_unidade)],
      ['Grupo Econômico (ID)', fmt(e.grupo_economico_id)],
      ['Matriz (ID)', fmt(e.matriz_id)],
    ],
  },
  {
    title: 'Contexto IA',
    rows: [
      ['Contexto para IA', fmt(e.ai_context)],
    ],
  },
  {
    title: 'Auditoria',
    rows: [
      ['Atualizado por', fmt(e.atualizado_por)],
      ['Criado em', fmtDate(e.created_at)],
      ['Atualizado em', fmtDate(e.updated_at)],
    ],
  },
];

// ===== Excel export =====
export function exportEmpresasToXlsx(empresas: Empresa[]) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumo (uma linha por empresa, todos os campos planos)
  const resumoRows = empresas.map(e => {
    const obj: Record<string, string> = {};
    sections(e).forEach(sec => {
      sec.rows.forEach(([k, v]) => {
        obj[`${sec.title} | ${k}`] = v;
      });
    });
    return obj;
  });
  const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // Sheet 2..N: Uma sheet por seção (linhas = empresas, colunas = campos da seção)
  if (empresas.length > 0) {
    const baseSections = sections(empresas[0]);
    baseSections.forEach((sec, idx) => {
      const rows = empresas.map(e => {
        const secData = sections(e)[idx];
        const obj: Record<string, string> = {
          'Razão Social': e.razao_social || '—',
          'CNPJ/CPF': e.tipo_pessoa === 'pf' ? fmtCpf(e.cpf) : fmtCnpj(e.cnpj),
        };
        secData.rows.forEach(([k, v]) => {
          obj[k] = v;
        });
        return obj;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      // Sheet names limited to 31 chars
      const sheetName = sec.title.slice(0, 31).replace(/[\\/?*[\]:]/g, '-');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  }

  const ts = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `empresas_completo_${ts}.xlsx`);
}

// ===== PDF export =====
export function exportEmpresasToPdf(empresas: Empresa[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Capa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Cadastro de Empresas — Relatório Completo', pageWidth / 2, 25, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Total de empresas: ${empresas.length}`, pageWidth / 2, 35, { align: 'center' });
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, 42, { align: 'center' });

  empresas.forEach((empresa, idx) => {
    doc.addPage();
    let y = 18;

    // Cabeçalho da empresa
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Empresa ${idx + 1} de ${empresas.length}`, 10, 8);
    doc.text(empresa.ativo ? 'ATIVA' : 'INATIVA', pageWidth - 10, 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const titleLines = doc.splitTextToSize(empresa.razao_social || 'Sem razão social', pageWidth - 20);
    doc.text(titleLines, 10, y);
    y += titleLines.length * 6 + 2;

    if (empresa.nome_fantasia) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.text(empresa.nome_fantasia, 10, y);
      y += 6;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const docNumber = empresa.tipo_pessoa === 'pf' ? `CPF: ${fmtCpf(empresa.cpf)}` : `CNPJ: ${fmtCnpj(empresa.cnpj)}`;
    doc.text(docNumber, 10, y);
    y += 6;

    // Sections
    sections(empresa).forEach(sec => {
      autoTable(doc, {
        startY: y,
        head: [[sec.title]],
        body: sec.rows.map(([k, v]) => [k, v]),
        theme: 'striped',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'left',
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 60, fontStyle: 'bold', fillColor: [243, 244, 246] },
          1: { cellWidth: 'auto' },
        },
        margin: { left: 10, right: 10 },
        didDrawCell: () => {},
      });
      // @ts-expect-error lastAutoTable injected by autoTable
      y = (doc.lastAutoTable?.finalY || y) + 4;
    });
  });

  // Rodapé com paginação
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 10, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
  }

  const ts = new Date().toISOString().slice(0, 10);
  doc.save(`empresas_completo_${ts}.pdf`);
}
