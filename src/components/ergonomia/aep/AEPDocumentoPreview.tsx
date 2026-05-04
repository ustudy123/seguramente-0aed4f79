import { forwardRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AEPDocumento } from "@/types/aep";
import { 
  NIVEL_RISCO_LABELS, 
  CLASSIFICACAO_RISCO_LABELS, 
  TIPO_ACAO_LABELS, 
  PRIORIDADE_ACAO_LABELS,
  FATORES_FISICOS_LABELS,
  FATORES_COGNITIVOS_LABELS
} from "@/types/aep";

interface AEPDocumentoPreviewProps {
  documento: AEPDocumento;
}

export const AEPDocumentoPreview = forwardRef<HTMLDivElement, AEPDocumentoPreviewProps>(
  ({ documento }, ref) => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    };

    const nivelRiscoColor = (nivel: string) => {
      switch (nivel) {
        case 'baixo': return '#22c55e';
        case 'medio': return '#eab308';
        case 'alto': return '#f97316';
        case 'critico': return '#ef4444';
        default: return '#6b7280';
      }
    };

    return (
      <div 
        ref={ref}
        className="bg-white text-black p-8 max-w-4xl mx-auto"
        style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', lineHeight: '1.4' }}
      >
        {/* Header */}
        <div className="text-center mb-6 border-b-2 border-black pb-4">
          <h1 className="text-xl font-bold mb-1">MODELO DE DOCUMENTO</h1>
          <h2 className="text-lg font-bold">AEP – ANÁLISE ERGONÔMICA PRELIMINAR</h2>
          <p className="text-sm">(Gerada pelo Sistema YourEyes)</p>
        </div>

        {/* 1. Identificação */}
        <section className="mb-6">
          <h3 className="text-sm font-bold bg-gray-200 p-1 mb-2">1. IDENTIFICAÇÃO</h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              <tr className="border-b">
                <td className="py-1 font-medium w-48">Empresa:</td>
                <td className="py-1">{documento.identificacao.empresa}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1 font-medium">CNPJ:</td>
                <td className="py-1">{documento.identificacao.cnpj}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1 font-medium">Unidade / Local:</td>
                <td className="py-1">{documento.identificacao.unidade}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1 font-medium">Setor Avaliado:</td>
                <td className="py-1">{documento.identificacao.setor}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1 font-medium">Função Avaliada:</td>
                <td className="py-1">{documento.identificacao.funcao}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1 font-medium">Data da Avaliação:</td>
                <td className="py-1">{formatDate(documento.identificacao.dataAvaliacao)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1 font-medium">Responsável pelo Levantamento:</td>
                <td className="py-1">{documento.identificacao.responsavelLevantamento}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1 font-medium">Profissional Validador:</td>
                <td className="py-1">{documento.identificacao.profissionalValidador || '(não informado)'}</td>
              </tr>
              <tr>
                <td className="py-1 font-medium">Versão do Documento:</td>
                <td className="py-1">{documento.identificacao.versao}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs bg-yellow-100 p-2 border border-yellow-300">
            ⚠️ Este documento constitui uma Análise Ergonômica Preliminar, conforme previsto na NR-17, 
            não substituindo a Análise Ergonômica do Trabalho (AET) quando esta for tecnicamente indicada.
          </p>
        </section>

        {/* 2. Objetivo */}
        <section className="mb-6">
          <h3 className="text-sm font-bold bg-gray-200 p-1 mb-2">2. OBJETIVO DA ANÁLISE</h3>
          <p className="text-xs">
            Avaliar preliminarmente os riscos ergonômicos físicos, cognitivos e organizacionais associados à função avaliada, com base em:
          </p>
          <ul className="text-xs list-disc ml-4 mt-1">
            <li>Observação do trabalho real</li>
            <li>Informações organizacionais</li>
            <li>Evidências documentais, visuais e audiovisuais</li>
            <li>Indicadores gerados pelo sistema YourEyes</li>
          </ul>
          <p className="text-xs mt-2">Visando:</p>
          <ul className="text-xs list-disc ml-4">
            <li>Identificação de riscos</li>
            <li>Priorização de ações preventivas e corretivas</li>
            <li>Subsídio ao Inventário de Riscos</li>
            <li>Apoio à gestão de SST e redução de afastamentos</li>
          </ul>
        </section>

        {/* 3. Metodologia */}
        <section className="mb-6">
          <h3 className="text-sm font-bold bg-gray-200 p-1 mb-2">3. METODOLOGIA UTILIZADA</h3>
          <p className="text-xs">A Análise Ergonômica Preliminar foi realizada por meio de:</p>
          <ul className="text-xs list-disc ml-4 mt-1">
            <li>☑ Observação direta / indireta da atividade</li>
            <li>☑ Análise de fotos, vídeos e/ou áudios enviados</li>
            <li>☑ Questionários e indicadores organizacionais</li>
            <li>☑ Dados de jornada, pausas e ritmo de trabalho</li>
            <li>☑ Histórico de ocorrências, afastamentos e CAT</li>
            <li>☑ Cruzamento com normas regulamentadoras aplicáveis</li>
          </ul>
          <p className="text-xs mt-2 italic">
            A análise foi apoiada por inteligência artificial especializada, atuando como ferramenta de organização, 
            correlação e sinalização de riscos, com validação humana recomendada.
          </p>
        </section>

        {/* 4. Descrição da Atividade */}
        <section className="mb-6">
          <h3 className="text-sm font-bold bg-gray-200 p-1 mb-2">4. DESCRIÇÃO DA ATIVIDADE (TRABALHO REAL)</h3>
          
          <h4 className="text-xs font-bold mt-2 mb-1">4.1 Descrição Geral</h4>
          <p className="text-xs">{documento.descricaoAtividade.descricaoGeral || '(não informado)'}</p>
          
          <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
            <div><strong>Sequência de tarefas:</strong> {documento.descricaoAtividade.sequenciaTarefas || '-'}</div>
            <div><strong>Posturas adotadas:</strong> {documento.descricaoAtividade.posturasAdotadas || '-'}</div>
            <div><strong>Ferramentas utilizadas:</strong> {documento.descricaoAtividade.ferramentasUtilizadas || '-'}</div>
            <div><strong>Ritmo e repetitividade:</strong> {documento.descricaoAtividade.ritmoRepetitividade || '-'}</div>
            <div><strong>Variabilidade da tarefa:</strong> {documento.descricaoAtividade.variabilidadeTarefa || '-'}</div>
          </div>

          <h4 className="text-xs font-bold mt-3 mb-1">4.2 Condições do Ambiente de Trabalho</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><strong>Espaço físico:</strong> {documento.descricaoAtividade.espacoFisico || '-'}</div>
            <div><strong>Iluminação:</strong> {documento.descricaoAtividade.iluminacao || '-'}</div>
            <div><strong>Temperatura:</strong> {documento.descricaoAtividade.temperatura || '-'}</div>
            <div><strong>Ruído:</strong> {documento.descricaoAtividade.ruido || '-'}</div>
            <div className="col-span-2"><strong>Organização do posto:</strong> {documento.descricaoAtividade.organizacaoPosto || '-'}</div>
          </div>
        </section>

        {/* 5. Identificação dos Riscos */}
        <section className="mb-6">
          <h3 className="text-sm font-bold bg-gray-200 p-1 mb-2">5. IDENTIFICAÇÃO DOS RISCOS ERGONÔMICOS</h3>
          
          <h4 className="text-xs font-bold mt-2 mb-1 text-blue-600">5.1 EIXO FÍSICO</h4>
          <table className="w-full border-collapse text-xs border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-1 text-left">Fator Avaliado</th>
                <th className="border p-1 text-left">Observação</th>
                <th className="border p-1 text-center w-24">Nível de Risco</th>
              </tr>
            </thead>
            <tbody>
              {(['postura', 'movimentosRepetitivos', 'forcaFisica', 'levantamentoCargas', 'empurrarPuxar', 'esforcoMuscularLocalizado', 'frequenciaEsforco'] as const).map((key) => (
                <tr key={key}>
                  <td className="border p-1">{FATORES_FISICOS_LABELS[key]}</td>
                  <td className="border p-1">{documento.riscosFisicos[key].observacao || '-'}</td>
                  <td className="border p-1 text-center" style={{ color: nivelRiscoColor(documento.riscosFisicos[key].nivelRisco) }}>
                    {NIVEL_RISCO_LABELS[documento.riscosFisicos[key].nivelRisco]}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="border p-1">Uso de auxílio mecânico</td>
                <td className="border p-1">{documento.riscosFisicos.usoAuxilioMecanico.observacao || '-'}</td>
                <td className="border p-1 text-center">{documento.riscosFisicos.usoAuxilioMecanico.usado ? 'Sim' : 'Não'}</td>
              </tr>
            </tbody>
          </table>

          <h4 className="text-xs font-bold mt-3 mb-1 text-purple-600">5.2 EIXO COGNITIVO E ORGANIZACIONAL</h4>
          <table className="w-full border-collapse text-xs border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-1 text-left">Fator Avaliado</th>
                <th className="border p-1 text-left">Observação</th>
                <th className="border p-1 text-center w-24">Nível de Risco</th>
              </tr>
            </thead>
            <tbody>
              {(['ritmoImposto', 'pressaoTempoMetas', 'atencaoContinua', 'sobrecargaMental', 'subcargaBoreout', 'autonomia', 'pausas', 'jornada', 'climaRelacional', 'sentidoTrabalho'] as const).map((key) => (
                <tr key={key}>
                  <td className="border p-1">{FATORES_COGNITIVOS_LABELS[key]}</td>
                  <td className="border p-1">{documento.riscosCognitivos[key].observacao || '-'}</td>
                  <td className="border p-1 text-center" style={{ color: nivelRiscoColor(documento.riscosCognitivos[key].nivelRisco) }}>
                    {NIVEL_RISCO_LABELS[documento.riscosCognitivos[key].nivelRisco]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs mt-1 italic">
            📌 Indicadores utilizados: registros de humor, observações organizacionais, questionários (ex.: COPSOQ), registros de ocorrência e dados de jornada.
          </p>
        </section>

        {/* 6. Síntese */}
        <section className="mb-6">
          <h3 className="text-sm font-bold bg-gray-200 p-1 mb-2">6. SÍNTESE DA AVALIAÇÃO DE RISCO</h3>
          
          <h4 className="text-xs font-bold mt-2 mb-1">6.1 Classificação Geral</h4>
          <p className="text-xs">
            <span 
              className="inline-block w-3 h-3 rounded-full mr-1" 
              style={{ backgroundColor: nivelRiscoColor(documento.sinteseAvaliacao.classificacaoGeral) }}
            />
            <strong>{CLASSIFICACAO_RISCO_LABELS[documento.sinteseAvaliacao.classificacaoGeral]}</strong>
          </p>

          <h4 className="text-xs font-bold mt-2 mb-1">6.2 Pontos Críticos Identificados</h4>
          {documento.sinteseAvaliacao.pontosCriticos.length > 0 ? (
            <ul className="text-xs list-disc ml-4">
              {documento.sinteseAvaliacao.pontosCriticos.map((ponto, idx) => (
                <li key={idx}>{ponto}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs">(nenhum ponto crítico identificado)</p>
          )}
        </section>

        {/* 7. Necessidade de AET */}
        <section className="mb-6">
          <h3 className="text-sm font-bold bg-gray-200 p-1 mb-2">7. NECESSIDADE DE AET</h3>
          <p className="text-xs">Com base na análise preliminar:</p>
          <p className="text-xs mt-1">
            {documento.sinteseAvaliacao.necessidadeAET === 'nao_indicado' 
              ? '☐ Não há indicativo de necessidade de AET no momento'
              : '☑ Há indicativo de necessidade de AET para aprofundamento'
            }
          </p>
          <p className="text-xs mt-2"><strong>Justificativa:</strong> {documento.sinteseAvaliacao.justificativaAET || '(não informada)'}</p>
        </section>

        {/* 8. Recomendações */}
        <section className="mb-6">
          <h3 className="text-sm font-bold bg-gray-200 p-1 mb-2">8. RECOMENDAÇÕES E AÇÕES SUGERIDAS</h3>
          {documento.acoesRecomendadas.length > 0 ? (
            <table className="w-full border-collapse text-xs border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-1 text-left">Ação Recomendada</th>
                  <th className="border p-1 text-center w-28">Tipo</th>
                  <th className="border p-1 text-center w-20">Prioridade</th>
                </tr>
              </thead>
              <tbody>
                {documento.acoesRecomendadas.map((acao) => (
                  <tr key={acao.id}>
                    <td className="border p-1">{acao.acao}</td>
                    <td className="border p-1 text-center">{TIPO_ACAO_LABELS[acao.tipo]}</td>
                    <td className="border p-1 text-center">{PRIORIDADE_ACAO_LABELS[acao.prioridade]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs">(nenhuma ação recomendada)</p>
          )}
          <p className="text-xs mt-2 italic">
            📌 As ações devem ser registradas e acompanhadas no Módulo de Ações do YourEyes.
          </p>
        </section>

        {/* 9. Relação com Documentos Legais */}
        <section className="mb-6">
          <h3 className="text-sm font-bold bg-gray-200 p-1 mb-2">9. RELAÇÃO COM DOCUMENTOS LEGAIS</h3>
          <p className="text-xs">Esta AEP deve ser considerada em conjunto com:</p>
          <ul className="text-xs list-disc ml-4">
            <li>PGR vigente</li>
            <li>PCMSO vigente</li>
            <li>LTCAT (quando aplicável)</li>
          </ul>
          <p className="text-xs mt-1">Eventuais inconsistências devem ser tratadas no Módulo Compliance SST.</p>
        </section>

        {/* 10. Conclusão */}
        <section className="mb-6">
          <h3 className="text-sm font-bold bg-gray-200 p-1 mb-2">10. CONCLUSÃO</h3>
          <p className="text-xs">
            A presente Análise Ergonômica Preliminar atende aos requisitos da NR-17 e do Manual de Aplicação, 
            constituindo instrumento válido de identificação inicial de riscos ergonômicos e apoio à gestão preventiva.
          </p>
        </section>

        {/* 11. Responsabilidades */}
        <section className="mb-6">
          <h3 className="text-sm font-bold bg-gray-200 p-1 mb-2">11. RESPONSABILIDADES E OBSERVAÇÕES FINAIS</h3>
          <ul className="text-xs list-disc ml-4">
            <li>Este documento não substitui laudos técnicos específicos quando exigidos, nem a atuação de profissional legalmente habilitado.</li>
            <li>A empresa é responsável por implementar e monitorar as ações recomendadas.</li>
          </ul>
        </section>

        {/* 12. Assinaturas */}
        <section>
          <h3 className="text-sm font-bold bg-gray-200 p-1 mb-2">12. ASSINATURAS</h3>
          <div className="grid grid-cols-2 gap-8 mt-4">
            <div className="text-xs">
              <p><strong>Responsável pela Avaliação:</strong></p>
              <p className="mt-4 border-t border-black pt-1">{documento.assinaturas.responsavelAvaliacao || '(nome)'}</p>
              <p className="mt-2"><strong>Data:</strong> {formatDate(documento.assinaturas.dataAssinatura)}</p>
            </div>
            <div className="text-xs">
              <p><strong>Profissional Validador:</strong></p>
              <p className="mt-4 border-t border-black pt-1">{documento.assinaturas.profissionalValidador || '(nome)'}</p>
              <p className="mt-2"><strong>Registro Profissional:</strong> {documento.assinaturas.registroProfissional || '-'}</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
          <p>Documento gerado pelo Sistema YourEyes</p>
          <p>Data de geração: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
      </div>
    );
  }
);

AEPDocumentoPreview.displayName = 'AEPDocumentoPreview';
