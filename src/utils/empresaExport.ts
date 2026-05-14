import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EmpresaCadastro, EmpresaObrigacao } from '@/types/empresa';

type Empresa = EmpresaCadastro & { ativo: boolean };

const fmt = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    return v.map(item => {
      if (typeof item === 'object') {
        try {
          // If it's a known structure, format it
          if ('nome' in item && 'funcao' in item) return `${item.nome} (${item.funcao})`;
          if ('codigo' in item && 'descricao' in item) return `${item.codigo}: ${item.descricao}`;
          return JSON.stringify(item);
        } catch {
          return JSON.stringify(item);
        }
      }
      return String(item);
    }).join(' | ');
  }
  if (typeof v === 'object') {
    return Object.entries(v)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');
  }
  return String(v);
};

const fmtCnpj = (cnpj: string | null | undefined) => {
  if (!cnpj) return '—';
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
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
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
};

const getMatrizName = (matrizId: string | null, empresas: Empresa[]) => {
  if (!matrizId) return '—';
  const m = empresas.find(e => e.id === matrizId);
  return m ? m.razao_social || m.nome_fantasia || matrizId : matrizId;
};

const getGrupoName = (grupoId: string | null, grupos: any[]) => {
  if (!grupoId) return '—';
  const g = grupos.find(gr => gr.id === grupoId);
  return g ? g.nome || grupoId : grupoId;
};

// ===== Section schema (every step of the cadastro) =====
const sections = (e: Empresa, empresas: Empresa[], grupos: any[], obligacoes: EmpresaObrigacao[]): { title: string; rows: [string, string][] }[] => {
  // In many places, the company ID itself is used as the tenant_id for its own obligations
  // or they share the tenant_id. We'll show obligations associated with either.
  const myObligations = obligacoes.filter(ob => ob.tenant_id === e.id || ob.tenant_id === e.tenant_id);

  return [
    {
      title: '1. Dados Básicos',
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
        ['Telefone', fmt(e.telefone)],
        ['E-mail', fmt(e.email)],
        ['Website', fmt(e.website)],
        ['Status', e.ativo ? 'Ativa' : 'Inativa'],
        ['Total de Colaboradores', fmt(e.total_colaboradores)],
      ],
    },
    {
      title: '2. Localização',
      rows: [
        ['CEP', fmtCep(e.cep)],
        ['Endereço', fmt(e.endereco)],
        ['Número', fmt(e.numero)],
        ['Complemento', fmt(e.complemento)],
        ['Bairro', fmt(e.bairro)],
        ['Cidade', fmt(e.cidade)],
        ['Estado', fmt(e.estado)],
      ],
    },
    {
      title: '3. Enquadramento Legal (CNAE / Risco)',
      rows: [
        ['CNAE Principal', fmt(e.cnae_principal)],
        ['Descrição CNAE', fmt(e.cnae_descricao)],
        ['CNAEs Secundários', (e.cnaes_secundarios || []).map(c => `${c.codigo} - ${c.descricao}`).join(' | ') || '—'],
        ['Grau de Risco', fmt(e.grau_risco)],
        ['Grau de Risco Ajustado', fmt(e.grau_risco_ajustado)],
        ['Justificativa do Ajuste', fmt(e.grau_risco_justificativa)],
      ],
    },
    {
      title: '4. SESMT e CIPA',
      rows: [
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
      title: '5. Inclusão (PCD / Jovem Aprendiz)',
      rows: [
        ['PCD Obrigatória', fmt(e.pcd_obrigatoria)],
        ['PCD Quantidade Exigida', fmt(e.pcd_quantidade_exigida)],
        ['PCD Quantidade Atual', fmt(e.pcd_quantidade_atual)],
        ['PCD Percentual Exigido', e.pcd_percentual_exigido ? `${e.pcd_percentual_exigido}%` : '—'],
        ['Aprendiz Quantidade Mínima', fmt(e.aprendiz_quantidade_minima)],
        ['Aprendiz Quantidade Máxima', fmt(e.aprendiz_quantidade_maxima)],
        ['Aprendiz Quantidade Atual', fmt(e.aprendiz_quantidade_atual)],
      ],
    },
    {
      title: '6. Indicadores Previdenciários (FAP / TAC)',
      rows: [
        ['FAP Atual', fmt(e.fap_atual)],
        ['FAP Classificação', fmt(e.fap_classificacao)],
        ['FAP Histórico', (e.fap_historico || []).map(h => `${h.ano}: ${h.valor}`).join(' | ') || '—'],
        ['Possui TAC', fmt(e.tac_possui)],
        ['TAC Detalhes', (e.tac_detalhes || []).map(t => `${t.numero} (${t.orgao_emissor}) - ${t.status}`).join(' | ') || '—'],
      ],
    },
    {
      title: '7. Jornada e Condições de Trabalho',
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
        ['Condições Especiais Detalhes', fmt(e.condicoes_especiais_detalhes)],
      ],
    },
    {
      title: '8. Hierarquia e Contexto',
      rows: [
        ['Tipo de Unidade', e.tipo_unidade === 'matriz' ? 'Matriz' : 'Filial'],
        ['Grupo Econômico', getGrupoName(e.grupo_economico_id, grupos)],
        ['Matriz de Referência', getMatrizName(e.matriz_id, empresas)],
        ['Contexto para IA', fmt(e.ai_context)],
      ],
    },
    {
      title: '9. Obrigações Detectadas',
      rows: myObligations.length > 0 ? myObligations.map(ob => [
        ob.titulo, 
        `${ob.status.toUpperCase()} | ${ob.criticidade.toUpperCase()} | ${ob.base_legal || 'Sem base legal'}`
      ]) as [string, string][] : [['Sem obrigações', 'Nenhuma obrigação registrada para esta empresa']],
    },
    {
      title: '10. Auditoria',
      rows: [
        ['Atualizado por', fmt(e.atualizado_por)],
        ['Criado em', fmtDate(e.created_at)],
        ['Atualizado em', fmtDate(e.updated_at)],
        ['Logo URL', fmt(e.logo_url)],
      ],
    },
  ];
};

// ===== Excel export =====
export function exportEmpresasToXlsx(empresas: Empresa[], grupos: any[] = [], obligacoes: EmpresaObrigacao[] = []) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumo Detalhado (todos os campos em colunas)
  const resumoRows = empresas.map(e => {
    const obj: Record<string, string> = {};
    sections(e, empresas, grupos, obligacoes).forEach(sec => {
      sec.rows.forEach(([k, v]) => {
        // Create unique column names by prefixing with section title
        const colName = `${sec.title.split('.')[1].trim()} - ${k}`;
        obj[colName] = v;
      });
    });
    return obj;
  });
  const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Geral');

  // Sheet 2..N: Uma sheet por seção principal
  if (empresas.length > 0) {
    const baseSections = sections(empresas[0], empresas, grupos, obligacoes);
    baseSections.forEach((sec, idx) => {
      const rows = empresas.map(e => {
        const secData = sections(e, empresas, grupos, obligacoes)[idx];
        const obj: Record<string, string> = {
          'Razão Social': e.razao_social || '—',
          'Documento': e.tipo_pessoa === 'pf' ? fmtCpf(e.cpf) : fmtCnpj(e.cnpj),
        };
        secData.rows.forEach(([k, v]) => {
          obj[k] = v;
        });
        return obj;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const sheetName = sec.title.split('.')[1].trim().slice(0, 31).replace(/[\\/?*[\]:]/g, '-');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  }

  const ts = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `empresas_completo_${ts}.xlsx`);
}

// ===== PDF export =====
export function exportEmpresasToPdf(empresas: Empresa[], grupos: any[] = [], obligacoes: EmpresaObrigacao[] = []) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Capa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(37, 99, 235);
  doc.text('Relatório de Cadastro de Empresas', pageWidth / 2, 50, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text('YourEyes — Segurança Jurídica do Empregador', pageWidth / 2, 60, { align: 'center' });

  doc.setDrawColor(226, 232, 240);
  doc.line(40, 70, pageWidth - 40, 70);

  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(`Total de registros exportados: ${empresas.length}`, pageWidth / 2, 85, { align: 'center' });
  doc.text(`Data de geração: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, 92, { align: 'center' });

  empresas.forEach((empresa, idx) => {
    doc.addPage();
    let y = 15;

    // Cabeçalho azul da página
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`REGISTRO ${idx + 1} DE ${empresas.length}`, 10, 10);
    doc.text(empresa.ativo ? 'EMPRESA ATIVA' : 'EMPRESA INATIVA', pageWidth - 10, 10, { align: 'right' });

    // Título da Empresa
    y = 25;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    const titleLines = doc.splitTextToSize(empresa.razao_social || 'SEM RAZÃO SOCIAL', pageWidth - 20);
    doc.text(titleLines, 10, y);
    y += titleLines.length * 7;

    if (empresa.nome_fantasia) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text(empresa.nome_fantasia, 10, y);
      y += 6;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const docNumber = empresa.tipo_pessoa === 'pf' ? `CPF: ${fmtCpf(empresa.cpf)}` : `CNPJ: ${fmtCnpj(empresa.cnpj)}`;
    doc.text(docNumber, 10, y);
    y += 8;

    // Renderizar Seções com tabelas
    sections(empresa, empresas, grupos, obligacoes).forEach(sec => {
      autoTable(doc, {
        startY: y,
        head: [[sec.title.toUpperCase()]],
        body: sec.rows.map(([k, v]) => [k, v]),
        theme: 'striped',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: 'bold', fillColor: [248, 250, 252] },
          1: { cellWidth: 'auto' },
        },
        margin: { left: 10, right: 10 },
        pageBreak: 'auto',
        rowPageBreak: 'auto',
      });
      // @ts-expect-error lastAutoTable is added by the plugin
      y = (doc.lastAutoTable?.finalY || y) + 6;
      
      // Se y estiver muito próximo do fim da página, força quebra para a próxima seção
      if (y > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        y = 20;
      }
    });
  });

  // Numeração de páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Relatório Gerado por YourEyes — Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }

  const ts = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio_empresas_completo_${ts}.pdf`);
}
