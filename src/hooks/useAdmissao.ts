import { useState, useCallback } from 'react';
import { 
  Admissao, 
  AdmissaoStatus, 
  DocumentoAdmissao, 
  DOCUMENTOS_OBRIGATORIOS,
  DadosPessoais,
  DadosContato,
  DadosProfissionais,
  DadosBancarios,
  HistoricoAprovacao
} from '@/types/admissao';

// Mock data for demonstration
const mockAdmissoes: Admissao[] = [
  {
    id: '1',
    dadosPessoais: {
      nomeCompleto: 'Maria Silva Santos',
      cpf: '123.456.789-00',
      rg: '12.345.678-9',
      dataNascimento: '1995-03-15',
      estadoCivil: 'solteiro',
      genero: 'feminino',
      nacionalidade: 'Brasileira',
      naturalidade: 'São Paulo - SP',
      nomeMae: 'Ana Silva Santos',
      nomePai: 'João Santos',
    },
    dadosContato: {
      email: 'maria.silva@email.com',
      telefone: '(11) 3456-7890',
      celular: '(11) 99876-5432',
      endereco: 'Rua das Flores',
      numero: '123',
      complemento: 'Apto 45',
      bairro: 'Jardim Primavera',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01234-567',
    },
    dadosProfissionais: {
      cargo: 'Analista de RH',
      departamento: 'Recursos Humanos',
      filial: 'Matriz',
      dataAdmissao: '2024-02-01',
      tipoContrato: 'CLT',
      jornadaTrabalho: '44h semanais',
      salario: 'R$ 5.500,00',
      gestorImediato: 'Carlos Oliveira',
      centroCusto: 'RH-001',
    },
    dadosBancarios: {
      banco: 'Banco do Brasil',
      agencia: '1234-5',
      conta: '12345-6',
      tipoConta: 'corrente',
      chavePix: 'maria.silva@email.com',
    },
    documentos: DOCUMENTOS_OBRIGATORIOS.map((doc, index) => ({
      ...doc,
      id: `doc-1-${index}`,
      status: index < 8 ? 'aprovado' : 'pendente',
    })),
    status: 'em_analise',
    historicoAprovacao: [
      { id: '1', etapa: 'Cadastro Inicial', status: 'aprovado', responsavel: 'Sistema', dataAcao: new Date('2024-01-20') },
      { id: '2', etapa: 'Análise Documental', status: 'aprovado', responsavel: 'Ana Costa', dataAcao: new Date('2024-01-22') },
      { id: '3', etapa: 'Aprovação RH', status: 'pendente', responsavel: 'Carlos Oliveira' },
      { id: '4', etapa: 'Aprovação Final', status: 'pendente', responsavel: 'Diretoria' },
    ],
    dataCriacao: new Date('2024-01-20'),
    dataAtualizacao: new Date('2024-01-22'),
    criadoPor: 'admin@empresa.com',
  },
  {
    id: '2',
    dadosPessoais: {
      nomeCompleto: 'João Pedro Almeida',
      cpf: '987.654.321-00',
      rg: '98.765.432-1',
      dataNascimento: '1990-07-22',
      estadoCivil: 'casado',
      genero: 'masculino',
      nacionalidade: 'Brasileira',
      naturalidade: 'Rio de Janeiro - RJ',
      nomeMae: 'Teresa Almeida',
      nomePai: 'Pedro Almeida',
    },
    dadosContato: {
      email: 'joao.almeida@email.com',
      telefone: '(21) 3456-7890',
      celular: '(21) 99876-5432',
      endereco: 'Av. Brasil',
      numero: '500',
      complemento: '',
      bairro: 'Centro',
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
      cep: '20040-020',
    },
    dadosProfissionais: {
      cargo: 'Desenvolvedor Full Stack',
      departamento: 'Tecnologia',
      filial: 'Matriz',
      dataAdmissao: '2024-02-15',
      tipoContrato: 'CLT',
      jornadaTrabalho: '40h semanais',
      salario: 'R$ 12.000,00',
      gestorImediato: 'Ricardo Tech',
      centroCusto: 'TI-002',
    },
    dadosBancarios: {
      banco: 'Itaú',
      agencia: '5678',
      conta: '98765-4',
      tipoConta: 'corrente',
      chavePix: '98765432100',
    },
    documentos: DOCUMENTOS_OBRIGATORIOS.map((doc, index) => ({
      ...doc,
      id: `doc-2-${index}`,
      status: 'pendente',
    })),
    status: 'aguardando_documentos',
    historicoAprovacao: [
      { id: '1', etapa: 'Cadastro Inicial', status: 'aprovado', responsavel: 'Sistema', dataAcao: new Date('2024-01-25') },
      { id: '2', etapa: 'Análise Documental', status: 'pendente', responsavel: 'Ana Costa' },
      { id: '3', etapa: 'Aprovação RH', status: 'pendente', responsavel: 'Carlos Oliveira' },
      { id: '4', etapa: 'Aprovação Final', status: 'pendente', responsavel: 'Diretoria' },
    ],
    dataCriacao: new Date('2024-01-25'),
    dataAtualizacao: new Date('2024-01-25'),
    criadoPor: 'admin@empresa.com',
  },
  {
    id: '3',
    dadosPessoais: {
      nomeCompleto: 'Fernanda Costa Lima',
      cpf: '456.789.123-00',
      rg: '45.678.912-3',
      dataNascimento: '1988-11-10',
      estadoCivil: 'divorciado',
      genero: 'feminino',
      nacionalidade: 'Brasileira',
      naturalidade: 'Belo Horizonte - MG',
      nomeMae: 'Lucia Costa',
      nomePai: 'Roberto Lima',
    },
    dadosContato: {
      email: 'fernanda.lima@email.com',
      telefone: '(31) 3456-7890',
      celular: '(31) 99876-5432',
      endereco: 'Rua da Bahia',
      numero: '1000',
      complemento: 'Sala 501',
      bairro: 'Funcionários',
      cidade: 'Belo Horizonte',
      estado: 'MG',
      cep: '30130-000',
    },
    dadosProfissionais: {
      cargo: 'Gerente Comercial',
      departamento: 'Comercial',
      filial: 'Filial BH',
      dataAdmissao: '2024-03-01',
      tipoContrato: 'CLT',
      jornadaTrabalho: '44h semanais',
      salario: 'R$ 15.000,00',
      gestorImediato: 'Diretor Comercial',
      centroCusto: 'COM-003',
    },
    dadosBancarios: {
      banco: 'Bradesco',
      agencia: '1111',
      conta: '22222-3',
      tipoConta: 'corrente',
      chavePix: 'fernanda.lima@email.com',
    },
    documentos: DOCUMENTOS_OBRIGATORIOS.map((doc, index) => ({
      ...doc,
      id: `doc-3-${index}`,
      status: 'aprovado',
    })),
    status: 'aprovado',
    historicoAprovacao: [
      { id: '1', etapa: 'Cadastro Inicial', status: 'aprovado', responsavel: 'Sistema', dataAcao: new Date('2024-01-10') },
      { id: '2', etapa: 'Análise Documental', status: 'aprovado', responsavel: 'Ana Costa', dataAcao: new Date('2024-01-12') },
      { id: '3', etapa: 'Aprovação RH', status: 'aprovado', responsavel: 'Carlos Oliveira', dataAcao: new Date('2024-01-15') },
      { id: '4', etapa: 'Aprovação Final', status: 'aprovado', responsavel: 'Diretoria', dataAcao: new Date('2024-01-18') },
    ],
    dataCriacao: new Date('2024-01-10'),
    dataAtualizacao: new Date('2024-01-18'),
    criadoPor: 'admin@empresa.com',
  },
];

export function useAdmissao() {
  const [admissoes, setAdmissoes] = useState<Admissao[]>(mockAdmissoes);
  const [loading, setLoading] = useState(false);

  const criarAdmissao = useCallback((dados: {
    dadosPessoais: DadosPessoais;
    dadosContato: DadosContato;
    dadosProfissionais: DadosProfissionais;
    dadosBancarios: DadosBancarios;
  }) => {
    const novaAdmissao: Admissao = {
      id: Date.now().toString(),
      ...dados,
      documentos: DOCUMENTOS_OBRIGATORIOS.map((doc, index) => ({
        ...doc,
        id: `doc-new-${index}`,
        status: 'pendente',
      })),
      status: 'rascunho',
      historicoAprovacao: [
        { id: '1', etapa: 'Cadastro Inicial', status: 'aprovado', responsavel: 'Sistema', dataAcao: new Date() },
        { id: '2', etapa: 'Análise Documental', status: 'pendente', responsavel: 'Pendente' },
        { id: '3', etapa: 'Aprovação RH', status: 'pendente', responsavel: 'Pendente' },
        { id: '4', etapa: 'Aprovação Final', status: 'pendente', responsavel: 'Pendente' },
      ],
      dataCriacao: new Date(),
      dataAtualizacao: new Date(),
      criadoPor: 'usuario@empresa.com',
    };

    setAdmissoes(prev => [...prev, novaAdmissao]);
    return novaAdmissao;
  }, []);

  const atualizarAdmissao = useCallback((id: string, dados: Partial<Admissao>) => {
    setAdmissoes(prev => prev.map(adm => 
      adm.id === id 
        ? { ...adm, ...dados, dataAtualizacao: new Date() }
        : adm
    ));
  }, []);

  const atualizarStatus = useCallback((id: string, status: AdmissaoStatus) => {
    setAdmissoes(prev => prev.map(adm => 
      adm.id === id 
        ? { ...adm, status, dataAtualizacao: new Date() }
        : adm
    ));
  }, []);

  const atualizarDocumento = useCallback((admissaoId: string, documentoId: string, dados: Partial<DocumentoAdmissao>) => {
    setAdmissoes(prev => prev.map(adm => 
      adm.id === admissaoId 
        ? {
            ...adm,
            documentos: adm.documentos.map(doc =>
              doc.id === documentoId ? { ...doc, ...dados } : doc
            ),
            dataAtualizacao: new Date(),
          }
        : adm
    ));
  }, []);

  const aprovarEtapa = useCallback((admissaoId: string, etapaId: string, aprovado: boolean, observacao?: string) => {
    setAdmissoes(prev => prev.map(adm => {
      if (adm.id !== admissaoId) return adm;

      const novoHistorico = adm.historicoAprovacao.map(etapa =>
        etapa.id === etapaId
          ? { ...etapa, status: aprovado ? 'aprovado' : 'rejeitado', dataAcao: new Date(), observacao } as HistoricoAprovacao
          : etapa
      );

      // Check if all steps are approved
      const todasAprovadas = novoHistorico.every(e => e.status === 'aprovado');
      const algumaRejeitada = novoHistorico.some(e => e.status === 'rejeitado');

      let novoStatus: AdmissaoStatus = adm.status;
      if (todasAprovadas) novoStatus = 'concluido';
      else if (algumaRejeitada) novoStatus = 'reprovado';
      else novoStatus = 'em_analise';

      return {
        ...adm,
        historicoAprovacao: novoHistorico,
        status: novoStatus,
        dataAtualizacao: new Date(),
      };
    }));
  }, []);

  const excluirAdmissao = useCallback((id: string) => {
    setAdmissoes(prev => prev.filter(adm => adm.id !== id));
  }, []);

  const buscarAdmissao = useCallback((id: string) => {
    return admissoes.find(adm => adm.id === id);
  }, [admissoes]);

  return {
    admissoes,
    loading,
    criarAdmissao,
    atualizarAdmissao,
    atualizarStatus,
    atualizarDocumento,
    aprovarEtapa,
    excluirAdmissao,
    buscarAdmissao,
  };
}
