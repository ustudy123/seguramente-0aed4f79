import { forwardRef } from "react";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Calendar, 
  User, 
  AlertTriangle, 
  CheckCircle2,
  FileText
} from "lucide-react";
import { 
  AEPEmpresaInfo, 
  AEPAvaliacaoFuncao, 
  AEPSinteseAvaliacao, 
  AEPAcaoRecomendada,
  AEPAssinatura,
  ClassificacaoRisco
} from "@/types/aep-multi";
import { 
  CLASSIFICACAO_RISCO_LABELS, 
  TIPO_ACAO_LABELS, 
  PRIORIDADE_ACAO_LABELS,
  FATORES_FISICOS_LABELS,
  FATORES_COGNITIVOS_LABELS
} from "@/types/aep";

interface AEPDocumentoPreviewMultiProps {
  empresa: AEPEmpresaInfo;
  avaliacoes: AEPAvaliacaoFuncao[];
  sinteseGeral?: AEPSinteseAvaliacao;
  acoesConsolidadas: AEPAcaoRecomendada[];
  assinaturas: AEPAssinatura;
}

export const AEPDocumentoPreviewMulti = forwardRef<HTMLDivElement, AEPDocumentoPreviewMultiProps>(
  ({ empresa, avaliacoes, sinteseGeral, acoesConsolidadas, assinaturas }, ref) => {
    
    const getClassificacaoColor = (classificacao: ClassificacaoRisco) => {
      switch (classificacao) {
        case 'baixo': return 'text-success bg-success/10';
        case 'medio': return 'text-warning bg-warning/10';
        case 'alto': return 'text-destructive bg-destructive/10';
      }
    };

    return (
      <div ref={ref} className="bg-white text-black p-8 min-h-[297mm] w-full max-w-[210mm] mx-auto">
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-wide">
            Análise Ergonômica Preliminar - AEP
          </h1>
          <p className="text-sm text-gray-600 mt-1">Multi-Setor / Multi-Função</p>
          <p className="text-xs text-gray-500 mt-1">
            Conforme Norma Regulamentadora NR-17 (Ergonomia)
          </p>
        </div>

        {/* Identificação da Empresa */}
        <section className="mb-6">
          <h2 className="text-lg font-bold bg-gray-100 px-3 py-2 mb-3 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            1. IDENTIFICAÇÃO DA EMPRESA
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold">Razão Social:</span> {empresa.nome}
            </div>
            <div>
              <span className="font-semibold">CNPJ:</span> {empresa.cnpj}
            </div>
            <div>
              <span className="font-semibold">Unidade:</span> {empresa.unidade}
            </div>
            <div>
              <span className="font-semibold">Data da Avaliação:</span> {empresa.dataAvaliacao}
            </div>
            <div>
              <span className="font-semibold">Responsável:</span> {empresa.responsavelLevantamento}
            </div>
            {empresa.profissionalValidador && (
              <div>
                <span className="font-semibold">Validador:</span> {empresa.profissionalValidador}
              </div>
            )}
          </div>
        </section>

        {/* Resumo das Avaliações */}
        <section className="mb-6">
          <h2 className="text-lg font-bold bg-gray-100 px-3 py-2 mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            2. RESUMO DAS AVALIAÇÕES
          </h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-2 text-left">Setor</th>
                <th className="border p-2 text-left">Cargo</th>
                <th className="border p-2 text-center">Evidências</th>
                <th className="border p-2 text-center">Classificação</th>
                <th className="border p-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {avaliacoes.map(av => (
                <tr key={av.id}>
                  <td className="border p-2">{av.setorNome}</td>
                  <td className="border p-2">{av.funcaoNome}</td>
                  <td className="border p-2 text-center">{av.evidencias.length}</td>
                  <td className="border p-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getClassificacaoColor(av.classificacaoRisco)}`}>
                      {CLASSIFICACAO_RISCO_LABELS[av.classificacaoRisco]}
                    </span>
                  </td>
                  <td className="border p-2 text-center">{av.acoesRecomendadas.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Avaliações Detalhadas */}
        {avaliacoes.map((av, index) => (
          <section key={av.id} className="mb-6 page-break-inside-avoid">
            <h2 className="text-lg font-bold bg-gray-100 px-3 py-2 mb-3">
              {3 + index}. AVALIAÇÃO: {av.setorNome} - {av.funcaoNome}
            </h2>

            {/* Descrição */}
            <div className="mb-4">
              <h3 className="font-semibold text-sm mb-2">Descrição da Atividade</h3>
              <p className="text-sm text-gray-700">{av.descricaoAtividade.descricaoGeral || "Não informado"}</p>
            </div>

            {/* Riscos identificados */}
            <div className="mb-4">
              <h3 className="font-semibold text-sm mb-2">Riscos Físicos Identificados</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(av.riscosFisicos).map(([key, value]) => {
                  if (key === 'usoAuxilioMecanico') return null;
                  const fator = value as { observacao: string; nivelRisco: string };
                  if (!fator.observacao) return null;
                  return (
                    <div key={key} className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>{FATORES_FISICOS_LABELS[key as keyof typeof FATORES_FISICOS_LABELS] || key}</span>
                      <span className={`font-medium ${
                        fator.nivelRisco === 'critico' ? 'text-red-600' :
                        fator.nivelRisco === 'alto' ? 'text-orange-600' :
                        fator.nivelRisco === 'medio' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {fator.nivelRisco}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ações */}
            {av.acoesRecomendadas.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-sm mb-2">Ações Recomendadas</h3>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {av.acoesRecomendadas.map((acao, i) => (
                    <li key={acao.id || i}>
                      <span className="font-medium">[{PRIORIDADE_ACAO_LABELS[acao.prioridade]}]</span> {acao.acao}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}

        {/* Síntese Geral */}
        {sinteseGeral && (
          <section className="mb-6">
            <h2 className="text-lg font-bold bg-gray-100 px-3 py-2 mb-3">
              {3 + avaliacoes.length}. SÍNTESE GERAL DA AVALIAÇÃO
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold">Classificação Geral:</span>{' '}
                <span className={`px-2 py-1 rounded ${getClassificacaoColor(sinteseGeral.classificacaoGeral)}`}>
                  {CLASSIFICACAO_RISCO_LABELS[sinteseGeral.classificacaoGeral]}
                </span>
              </div>
              
              {sinteseGeral.pontosCriticos.length > 0 && (
                <div>
                  <span className="font-semibold">Pontos Críticos:</span>
                  <ul className="list-disc list-inside mt-1">
                    {sinteseGeral.pontosCriticos.map((ponto, i) => (
                      <li key={i}>{ponto}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div>
                <span className="font-semibold">Necessidade de AET:</span>{' '}
                {sinteseGeral.necessidadeAET === 'indicado' ? (
                  <span className="text-orange-600">Indicado</span>
                ) : (
                  <span className="text-green-600">Não indicado</span>
                )}
              </div>
              
              {sinteseGeral.justificativaAET && (
                <div>
                  <span className="font-semibold">Justificativa:</span> {sinteseGeral.justificativaAET}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Assinaturas */}
        <section className="mt-12 pt-8 border-t-2 border-black">
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <div className="border-b border-black mb-2 h-16"></div>
              <p className="font-semibold">{assinaturas.responsavelAvaliacao || "Responsável pela Avaliação"}</p>
              <p className="text-xs text-gray-600">Data: {assinaturas.dataAssinatura}</p>
            </div>
            {assinaturas.profissionalValidador && (
              <div className="text-center">
                <div className="border-b border-black mb-2 h-16"></div>
                <p className="font-semibold">{assinaturas.profissionalValidador}</p>
                {assinaturas.registroProfissional && (
                  <p className="text-xs text-gray-600">Registro: {assinaturas.registroProfissional}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
          <p>Documento gerado automaticamente pelo Sistema YourEyes</p>
          <p>Versão {empresa.versao} • {new Date().toLocaleDateString('pt-BR')}</p>
        </footer>
      </div>
    );
  }
);

AEPDocumentoPreviewMulti.displayName = "AEPDocumentoPreviewMulti";
