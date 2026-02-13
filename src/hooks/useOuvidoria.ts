import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { Manifestacao, TipoManifestacao, StatusManifestacao, PrioridadeManifestacao } from "@/types/ouvidoria";

interface AnexoData {
  nome: string;
  url: string;
  tamanho: number;
  tipo: string;
  [key: string]: string | number; // Index signature for JSON compatibility
}

interface CriarManifestacaoData {
  tipo: TipoManifestacao;
  assunto: string;
  mensagem: string;
  anonimo: boolean;
  anexos?: File[];
}

interface ResponderManifestacaoData {
  id: string;
  resposta: string;
  status?: StatusManifestacao;
}

interface AtualizarStatusData {
  id: string;
  status: StatusManifestacao;
  prioridade?: PrioridadeManifestacao;
}

export function useOuvidoria() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user, profile } = useAuth();

  // Buscar manifestações (usuários veem apenas as suas, managers veem todas)
  const manifestacoesQuery = useQuery({
    queryKey: ["ouvidoria", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("ouvidoria")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as Manifestacao[];
    },
    enabled: !!tenantId,
  });

  // Upload de anexos
  const uploadAnexos = async (files: File[], manifestacaoId: string): Promise<AnexoData[]> => {
    const anexosUploadados: AnexoData[] = [];
    const userId = user?.id || "anonimo";

    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${manifestacaoId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("ouvidoria-anexos")
        .upload(fileName, file);

      if (uploadError) {
        console.error("Erro ao fazer upload:", uploadError);
        continue;
      }

      anexosUploadados.push({
        nome: file.name,
        url: fileName,
        tamanho: file.size,
        tipo: file.type,
      });
    }

    return anexosUploadados;
  };

  // Criar nova manifestação (com roteamento automático)
  const criarManifestacaoMutation = useMutation({
    mutationFn: async (data: CriarManifestacaoData) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      if (!user && !data.anonimo) throw new Error("Usuário não autenticado");

      // Buscar roteamento configurado para o tipo
      let responsavelId: string | null = null;
      let responsavelNome: string | null = null;
      let departamentoDestino: string | null = null;

      const { data: roteamento } = await supabase
        .from("ouvidoria_roteamento")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("tipo_manifestacao", data.tipo)
        .eq("ativo", true)
        .maybeSingle();

      if (roteamento) {
        responsavelId = roteamento.responsavel_id;
        responsavelNome = roteamento.responsavel_nome;
        departamentoDestino = roteamento.departamento_responsavel;
      }

      const manifestacao = {
        tenant_id: tenantId,
        tipo: data.tipo,
        assunto: data.assunto,
        mensagem: data.mensagem,
        anonimo: data.anonimo,
        autor_id: data.anonimo ? null : user?.id,
        autor_nome: data.anonimo ? null : profile?.nome_completo,
        autor_email: data.anonimo ? null : user?.email,
        autor_departamento: data.anonimo ? null : profile?.cargo,
        status: "pendente" as StatusManifestacao,
        prioridade: "normal" as PrioridadeManifestacao,
        anexos: [] as AnexoData[],
        responsavel_id: responsavelId,
        responsavel_nome: responsavelNome,
        departamento_destino: departamentoDestino,
      };

      const { data: result, error } = await supabase
        .from("ouvidoria")
        .insert(manifestacao)
        .select()
        .single();

      if (error) throw error;

      // Se há anexos, fazer upload e atualizar a manifestação
      if (data.anexos && data.anexos.length > 0) {
        const anexosUploadados = await uploadAnexos(data.anexos, result.id);

        if (anexosUploadados.length > 0) {
          const { error: updateError } = await supabase
            .from("ouvidoria")
            .update({ anexos: anexosUploadados })
            .eq("id", result.id);

          if (updateError) {
            console.error("Erro ao atualizar anexos:", updateError);
          }
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ouvidoria"] });
      toast.success("Manifestação enviada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao criar manifestação:", error);
      toast.error("Erro ao enviar manifestação");
    },
  });

  // Responder manifestação
  const responderManifestacaoMutation = useMutation({
    mutationFn: async (data: ResponderManifestacaoData) => {
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("ouvidoria")
        .update({
          resposta: data.resposta,
          status: data.status || "respondido",
          respondido_por: user.id,
          respondido_por_nome: profile?.nome_completo,
          respondido_em: new Date().toISOString(),
        })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ouvidoria"] });
      toast.success("Resposta enviada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao responder manifestação:", error);
      toast.error("Erro ao enviar resposta");
    },
  });

  // Atualizar status/prioridade
  const atualizarStatusMutation = useMutation({
    mutationFn: async (data: AtualizarStatusData) => {
      const updateData: { status: StatusManifestacao; prioridade?: PrioridadeManifestacao } = {
        status: data.status,
      };

      if (data.prioridade) {
        updateData.prioridade = data.prioridade;
      }

      const { error } = await supabase
        .from("ouvidoria")
        .update(updateData)
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ouvidoria"] });
      toast.success("Status atualizado!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    },
  });

  // Deletar manifestação
  const deletarManifestacaoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ouvidoria")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ouvidoria"] });
      toast.success("Manifestação removida!");
    },
    onError: (error) => {
      console.error("Erro ao deletar manifestação:", error);
      toast.error("Erro ao remover manifestação");
    },
  });

  // Dados fictícios de demonstração
  const demoManifestacoes: Manifestacao[] = [
    {
      id: "demo-1", tenant_id: "", tipo: "sugestao", assunto: "Implementar horário flexível",
      mensagem: "Sugiro que a empresa avalie a possibilidade de implementar horários flexíveis para os colaboradores, permitindo entrada entre 7h e 10h. Isso pode melhorar a qualidade de vida e reduzir atrasos.",
      anonimo: false, autor_id: null, autor_nome: "Mariana Silva", autor_email: "mariana@empresa.com",
      autor_departamento: "Operações", status: "pendente", prioridade: "normal",
      resposta: null, respondido_por: null, respondido_por_nome: null, respondido_em: null,
      anexos: null, created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
    },
    {
      id: "demo-2", tenant_id: "", tipo: "reclamacao", assunto: "Ar-condicionado do 3º andar com defeito",
      mensagem: "Há mais de uma semana o ar-condicionado do 3º andar está com problemas. A temperatura fica acima de 30°C durante a tarde, tornando o trabalho muito desconfortável. Já relatamos ao facilities, mas nada foi feito.",
      anonimo: false, autor_id: null, autor_nome: "Roberto Lima", autor_email: "roberto@empresa.com",
      autor_departamento: "TI", status: "em_analise", prioridade: "alta",
      resposta: null, respondido_por: null, respondido_por_nome: null, respondido_em: null,
      anexos: null, created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
    },
    {
      id: "demo-3", tenant_id: "", tipo: "denuncia", assunto: "Assédio moral no setor de vendas",
      mensagem: "Venho relatar situações recorrentes de assédio moral no setor de vendas, onde um gestor constantemente humilha e diminui membros da equipe na frente de outros colaboradores. Peço providências urgentes.",
      anonimo: true, autor_id: null, autor_nome: null, autor_email: null,
      autor_departamento: null, status: "em_analise", prioridade: "urgente",
      resposta: null, respondido_por: null, respondido_por_nome: null, respondido_em: null,
      anexos: null, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
    },
    {
      id: "demo-4", tenant_id: "", tipo: "elogio", assunto: "Excelente treinamento de segurança",
      mensagem: "Gostaria de parabenizar a equipe de SST pelo treinamento de segurança realizado na última semana. O conteúdo foi muito relevante, os facilitadores demonstraram domínio e o material estava muito bem preparado.",
      anonimo: false, autor_id: null, autor_nome: "Fernanda Costa", autor_email: "fernanda@empresa.com",
      autor_departamento: "Produção", status: "respondido", prioridade: "baixa",
      resposta: "Obrigado pelo feedback, Fernanda! Ficamos felizes que o treinamento foi bem aproveitado. Continuaremos investindo em capacitação de qualidade para todos.",
      respondido_por: null, respondido_por_nome: "Carlos Administrador", respondido_em: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      anexos: null, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
    },
    {
      id: "demo-5", tenant_id: "", tipo: "duvida", assunto: "Como solicitar adiantamento salarial?",
      mensagem: "Gostaria de saber qual o procedimento para solicitar adiantamento salarial. Existe formulário específico? Qual o prazo para aprovação? Há algum limite de valor?",
      anonimo: false, autor_id: null, autor_nome: "Paulo Nascimento", autor_email: "paulo@empresa.com",
      autor_departamento: "Logística", status: "respondido", prioridade: "normal",
      resposta: "Olá Paulo! O adiantamento pode ser solicitado pelo portal do colaborador, na seção 'Financeiro > Adiantamentos'. O limite é de 40% do salário e a aprovação leva até 2 dias úteis.",
      respondido_por: null, respondido_por_nome: "Ana RH", respondido_em: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      anexos: null, created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
    },
    {
      id: "demo-6", tenant_id: "", tipo: "reclamacao", assunto: "Falta de EPIs adequados no almoxarifado",
      mensagem: "Os EPIs disponíveis no almoxarifado estão com tamanhos inadequados e alguns estão vencidos. Precisamos urgentemente de reposição de luvas tamanho M e óculos de proteção.",
      anonimo: false, autor_id: null, autor_nome: "Ricardo Mendes", autor_email: "ricardo@empresa.com",
      autor_departamento: "Manutenção", status: "pendente", prioridade: "alta",
      resposta: null, respondido_por: null, respondido_por_nome: null, respondido_em: null,
      anexos: null, created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
    },
  ];

  const realData = manifestacoesQuery.data || [];
  const isDemo = realData.length === 0;
  const manifestacoesFinais = isDemo ? demoManifestacoes : realData;

  // Estatísticas
  const stats = {
    total: manifestacoesFinais.length,
    pendentes: manifestacoesFinais.filter((m) => m.status === "pendente").length,
    emAnalise: manifestacoesFinais.filter((m) => m.status === "em_analise").length,
    respondidas: manifestacoesFinais.filter((m) => m.status === "respondido").length,
    anonimas: manifestacoesFinais.filter((m) => m.anonimo).length,
  };

  return {
    manifestacoes: manifestacoesFinais,
    manifestacoesLoading: manifestacoesQuery.isLoading,
    isDemo,
    
    criarManifestacao: criarManifestacaoMutation.mutateAsync,
    criandoManifestacao: criarManifestacaoMutation.isPending,
    
    responderManifestacao: responderManifestacaoMutation.mutateAsync,
    respondendoManifestacao: responderManifestacaoMutation.isPending,
    
    atualizarStatus: atualizarStatusMutation.mutateAsync,
    atualizandoStatus: atualizarStatusMutation.isPending,
    
    deletarManifestacao: deletarManifestacaoMutation.mutateAsync,
    deletandoManifestacao: deletarManifestacaoMutation.isPending,
    
    stats,
  };
}
