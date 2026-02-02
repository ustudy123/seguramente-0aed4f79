import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  AEPMultiState, 
  EvidenciaAEP, 
  AEPAvaliacaoFuncao,
  AEPEmpresaInfo,
  AEPAssinatura,
  AEPSinteseAvaliacao,
  AEPAcaoRecomendada,
  getDefaultAEPMultiState,
  AnaliseResultadoIA
} from '@/types/aep-multi';
import { getDefaultAEPDocumento } from '@/types/aep';

export function useAEPMulti() {
  const [state, setState] = useState<AEPMultiState>(getDefaultAEPMultiState());

  // Step navigation
  const goToStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => ({ ...prev, step: Math.min(prev.step + 1, 6) }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({ ...prev, step: Math.max(prev.step - 1, 1) }));
  }, []);

  // Empresa info
  const updateEmpresa = useCallback((updates: Partial<AEPEmpresaInfo>) => {
    setState(prev => ({
      ...prev,
      empresa: { ...prev.empresa, ...updates }
    }));
  }, []);

  // Setores selection
  const setAvaliarTodosSetores = useCallback((value: boolean) => {
    setState(prev => ({
      ...prev,
      avaliarTodosSetores: value,
      setoresSelecionados: value ? [] : prev.setoresSelecionados
    }));
  }, []);

  const setSetoresSelecionados = useCallback((setores: { id: string; nome: string }[]) => {
    setState(prev => ({
      ...prev,
      setoresSelecionados: setores
    }));
  }, []);

  // Evidências management
  const addEvidencia = useCallback((evidencia: Omit<EvidenciaAEP, 'id' | 'createdAt' | 'analisadaPorIA'>) => {
    const newEvidencia: EvidenciaAEP = {
      ...evidencia,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      analisadaPorIA: false
    };
    setState(prev => ({
      ...prev,
      evidencias: [...prev.evidencias, newEvidencia]
    }));
    return newEvidencia.id;
  }, []);

  const removeEvidencia = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      evidencias: prev.evidencias.filter(e => e.id !== id)
    }));
  }, []);

  const updateEvidencia = useCallback((id: string, updates: Partial<EvidenciaAEP>) => {
    setState(prev => ({
      ...prev,
      evidencias: prev.evidencias.map(e => 
        e.id === id ? { ...e, ...updates } : e
      )
    }));
  }, []);

  // Group evidências by setor/função
  const evidenciasPorFuncao = useMemo(() => {
    const grouped = new Map<string, EvidenciaAEP[]>();
    state.evidencias.forEach(ev => {
      const key = `${ev.setorId}|${ev.funcaoId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(ev);
    });
    return grouped;
  }, [state.evidencias]);

  // Analyze single evidência
  const analyzeEvidencia = useCallback(async (evidenciaId: string) => {
    const evidencia = state.evidencias.find(e => e.id === evidenciaId);
    if (!evidencia) return;

    try {
      let requestBody: Record<string, unknown>;
      
      if (evidencia.tipo === 'video' && evidencia.videoFrames?.length) {
        requestBody = {
          tipo: 'video',
          conteudo: evidencia.videoFrames,
          contexto: evidencia.contextoTexto,
          audioBase64: evidencia.audioBase64
        };
      } else if (evidencia.tipo === 'foto') {
        requestBody = {
          tipo: 'imagem',
          conteudo: evidencia.arquivoBase64,
          contexto: evidencia.contextoTexto,
          audioBase64: evidencia.audioBase64
        };
      } else {
        requestBody = {
          tipo: 'texto',
          conteudo: evidencia.contextoTexto || '',
          audioBase64: evidencia.audioBase64
        };
      }

      const { data, error } = await supabase.functions.invoke('analyze-ergonomia', {
        body: requestBody
      });

      if (error) throw error;

      const resultado = data as AnaliseResultadoIA;
      
      updateEvidencia(evidenciaId, { 
        analisadaPorIA: true, 
        resultadoIA: resultado,
        transcricaoAudio: resultado.transcricaoAudio
      });

      return resultado;
    } catch (error) {
      console.error('Erro na análise:', error);
      throw error;
    }
  }, [state.evidencias, updateEvidencia]);

  // Analyze all evidências
  const analyzeAllEvidencias = useCallback(async () => {
    setState(prev => ({ ...prev, isAnalyzing: true }));
    
    try {
      const pendentes = state.evidencias.filter(e => !e.analisadaPorIA);
      
      for (const evidencia of pendentes) {
        await analyzeEvidencia(evidencia.id);
      }

      toast.success(`${pendentes.length} evidência(s) analisada(s) com sucesso!`);
    } catch (error) {
      toast.error('Erro ao analisar evidências');
      console.error(error);
    } finally {
      setState(prev => ({ ...prev, isAnalyzing: false }));
    }
  }, [state.evidencias, analyzeEvidencia]);

  // Generate avaliacoes from analyzed evidencias
  const generateAvaliacoes = useCallback(() => {
    const avaliacoes: AEPAvaliacaoFuncao[] = [];
    const defaultDoc = getDefaultAEPDocumento();

    evidenciasPorFuncao.forEach((evidencias, key) => {
      const [setorId, funcaoId] = key.split('|');
      const firstEv = evidencias[0];
      
      // Collect all riscos and recomendacoes from analyzed evidencias
      const allRiscos = evidencias
        .filter(e => e.resultadoIA)
        .flatMap(e => e.resultadoIA!.riscosIdentificados);
      
      const allRecomendacoes = evidencias
        .filter(e => e.resultadoIA)
        .flatMap(e => e.resultadoIA!.recomendacoes);

      const colaboradores = [...new Set(
        evidencias
          .filter(e => e.colaboradorNome)
          .map(e => e.colaboradorNome!)
      )];

      // Calculate classification based on risks
      const hasCritico = allRiscos.some(r => r.severidade === 'critico');
      const hasAlto = allRiscos.some(r => r.severidade === 'alto');
      const classificacaoRisco: 'baixo' | 'medio' | 'alto' = 
        hasCritico ? 'alto' : hasAlto ? 'medio' : 'baixo';

      // Generate acoes from recommendations
      const acoes: AEPAcaoRecomendada[] = [...new Set(allRecomendacoes)].map((rec, idx) => ({
        id: crypto.randomUUID(),
        acao: rec,
        tipo: 'organizacional' as const,
        prioridade: hasCritico ? 'urgente' as const : hasAlto ? 'alta' as const : 'media' as const
      }));

      avaliacoes.push({
        id: crypto.randomUUID(),
        setorId,
        setorNome: firstEv.setorNome,
        funcaoId,
        funcaoNome: firstEv.funcaoNome,
        colaboradoresAvaliados: colaboradores,
        evidencias,
        descricaoAtividade: defaultDoc.descricaoAtividade,
        riscosFisicos: defaultDoc.riscosFisicos,
        riscosCognitivos: defaultDoc.riscosCognitivos,
        classificacaoRisco,
        acoesRecomendadas: acoes
      });
    });

    setState(prev => ({ ...prev, avaliacoes }));
    return avaliacoes;
  }, [evidenciasPorFuncao]);

  // Update avaliação
  const updateAvaliacao = useCallback((id: string, updates: Partial<AEPAvaliacaoFuncao>) => {
    setState(prev => ({
      ...prev,
      avaliacoes: prev.avaliacoes.map(a => 
        a.id === id ? { ...a, ...updates } : a
      )
    }));
  }, []);

  // Síntese and consolidation
  const updateSinteseGeral = useCallback((sintese: AEPSinteseAvaliacao) => {
    setState(prev => ({ ...prev, sinteseGeral: sintese }));
  }, []);

  const setAcoesConsolidadas = useCallback((acoes: AEPAcaoRecomendada[]) => {
    setState(prev => ({ ...prev, acoesConsolidadas: acoes }));
  }, []);

  // Assinaturas
  const updateAssinaturas = useCallback((updates: Partial<AEPAssinatura>) => {
    setState(prev => ({
      ...prev,
      assinaturas: { ...prev.assinaturas, ...updates }
    }));
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState(getDefaultAEPMultiState());
  }, []);

  // Computed stats
  const stats = useMemo(() => ({
    totalEvidencias: state.evidencias.length,
    evidenciasAnalisadas: state.evidencias.filter(e => e.analisadaPorIA).length,
    totalFuncoes: evidenciasPorFuncao.size,
    totalSetores: new Set(state.evidencias.map(e => e.setorId)).size
  }), [state.evidencias, evidenciasPorFuncao]);

  return {
    state,
    stats,
    evidenciasPorFuncao,
    
    // Navigation
    goToStep,
    nextStep,
    prevStep,
    
    // Empresa
    updateEmpresa,
    
    // Setores
    setAvaliarTodosSetores,
    setSetoresSelecionados,
    
    // Evidências
    addEvidencia,
    removeEvidencia,
    updateEvidencia,
    
    // Analysis
    analyzeEvidencia,
    analyzeAllEvidencias,
    generateAvaliacoes,
    
    // Avaliacoes
    updateAvaliacao,
    
    // Synthesis
    updateSinteseGeral,
    setAcoesConsolidadas,
    
    // Signatures
    updateAssinaturas,
    
    // Reset
    reset
  };
}
