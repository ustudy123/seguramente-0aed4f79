export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admissao_documentos: {
        Row: {
          admissao_id: string
          aprovado_por: string | null
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          created_at: string
          data_aprovacao: string | null
          data_envio: string | null
          id: string
          nome: string
          obrigatorio: boolean
          observacao: string | null
          status: Database["public"]["Enums"]["documento_status"]
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          admissao_id: string
          aprovado_por?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_envio?: string | null
          id?: string
          nome: string
          obrigatorio?: boolean
          observacao?: string | null
          status?: Database["public"]["Enums"]["documento_status"]
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          admissao_id?: string
          aprovado_por?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_envio?: string | null
          id?: string
          nome?: string
          obrigatorio?: boolean
          observacao?: string | null
          status?: Database["public"]["Enums"]["documento_status"]
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admissao_documentos_admissao_id_fkey"
            columns: ["admissao_id"]
            isOneToOne: false
            referencedRelation: "admissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissao_documentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      admissao_historico: {
        Row: {
          acao: string
          admissao_id: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          id: string
          tenant_id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          admissao_id: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          tenant_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          admissao_id?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          tenant_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissao_historico_admissao_id_fkey"
            columns: ["admissao_id"]
            isOneToOne: false
            referencedRelation: "admissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissao_historico_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      admissao_workflow: {
        Row: {
          admissao_id: string
          created_at: string
          data_acao: string | null
          etapa: string
          id: string
          observacao: string | null
          ordem: number
          responsavel_id: string | null
          responsavel_nome: string | null
          status: Database["public"]["Enums"]["workflow_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          admissao_id: string
          created_at?: string
          data_acao?: string | null
          etapa: string
          id?: string
          observacao?: string | null
          ordem: number
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          admissao_id?: string
          created_at?: string
          data_acao?: string | null
          etapa?: string
          id?: string
          observacao?: string | null
          ordem?: number
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admissao_workflow_admissao_id_fkey"
            columns: ["admissao_id"]
            isOneToOne: false
            referencedRelation: "admissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissao_workflow_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      admissoes: {
        Row: {
          agencia: string | null
          bairro: string | null
          banco: string | null
          cargo: string
          celular: string | null
          centro_custo: string | null
          cep: string | null
          chave_pix: string | null
          cidade: string | null
          complemento: string | null
          conta: string | null
          cpf: string
          created_at: string
          criado_por: string | null
          data_admissao: string | null
          data_nascimento: string | null
          departamento: string | null
          email: string
          endereco: string | null
          estado: string | null
          estado_civil: string | null
          exame_admissional_clinica: string | null
          exame_admissional_crm: string | null
          exame_admissional_data: string | null
          exame_admissional_medico: string | null
          exame_admissional_observacoes: string | null
          exame_admissional_resultado: string | null
          exame_admissional_validade: string | null
          filial: string | null
          genero: string | null
          gestor_imediato: string | null
          id: string
          jornada_trabalho: string | null
          nacionalidade: string | null
          naturalidade: string | null
          nome_completo: string
          nome_mae: string | null
          nome_pai: string | null
          numero: string | null
          rg: string | null
          salario: number | null
          status: Database["public"]["Enums"]["admissao_status"]
          telefone: string | null
          tenant_id: string
          tipo_conta: string | null
          tipo_contrato: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cargo: string
          celular?: string | null
          centro_custo?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          complemento?: string | null
          conta?: string | null
          cpf: string
          created_at?: string
          criado_por?: string | null
          data_admissao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          email: string
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          exame_admissional_clinica?: string | null
          exame_admissional_crm?: string | null
          exame_admissional_data?: string | null
          exame_admissional_medico?: string | null
          exame_admissional_observacoes?: string | null
          exame_admissional_resultado?: string | null
          exame_admissional_validade?: string | null
          filial?: string | null
          genero?: string | null
          gestor_imediato?: string | null
          id?: string
          jornada_trabalho?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_completo: string
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          rg?: string | null
          salario?: number | null
          status?: Database["public"]["Enums"]["admissao_status"]
          telefone?: string | null
          tenant_id: string
          tipo_conta?: string | null
          tipo_contrato?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cargo?: string
          celular?: string | null
          centro_custo?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          complemento?: string | null
          conta?: string | null
          cpf?: string
          created_at?: string
          criado_por?: string | null
          data_admissao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          email?: string
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          exame_admissional_clinica?: string | null
          exame_admissional_crm?: string | null
          exame_admissional_data?: string | null
          exame_admissional_medico?: string | null
          exame_admissional_observacoes?: string | null
          exame_admissional_resultado?: string | null
          exame_admissional_validade?: string | null
          filial?: string | null
          genero?: string | null
          gestor_imediato?: string | null
          id?: string
          jornada_trabalho?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_completo?: string
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          rg?: string | null
          salario?: number | null
          status?: Database["public"]["Enums"]["admissao_status"]
          telefone?: string | null
          tenant_id?: string
          tipo_conta?: string | null
          tipo_contrato?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admissoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      afastamentos: {
        Row: {
          alerta_15_dias: boolean | null
          alerta_30_dias: boolean | null
          aso_retorno_id: string | null
          aso_retorno_pendente: boolean | null
          beneficio_inss_id: string | null
          colaborador_cpf: string | null
          colaborador_id: string | null
          colaborador_nome: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          dias_totais: number | null
          evento_saude_id: string | null
          id: string
          motivo_principal: Database["public"]["Enums"]["grupo_clinico"] | null
          nexo_trabalho: Database["public"]["Enums"]["nexo_trabalho"] | null
          observacoes: string | null
          status: Database["public"]["Enums"]["afastamento_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          alerta_15_dias?: boolean | null
          alerta_30_dias?: boolean | null
          aso_retorno_id?: string | null
          aso_retorno_pendente?: boolean | null
          beneficio_inss_id?: string | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome: string
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          dias_totais?: number | null
          evento_saude_id?: string | null
          id?: string
          motivo_principal?: Database["public"]["Enums"]["grupo_clinico"] | null
          nexo_trabalho?: Database["public"]["Enums"]["nexo_trabalho"] | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["afastamento_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          alerta_15_dias?: boolean | null
          alerta_30_dias?: boolean | null
          aso_retorno_id?: string | null
          aso_retorno_pendente?: boolean | null
          beneficio_inss_id?: string | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          dias_totais?: number | null
          evento_saude_id?: string | null
          id?: string
          motivo_principal?: Database["public"]["Enums"]["grupo_clinico"] | null
          nexo_trabalho?: Database["public"]["Enums"]["nexo_trabalho"] | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["afastamento_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_aso_retorno_fkey"
            columns: ["aso_retorno_id"]
            isOneToOne: false
            referencedRelation: "atestados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_beneficio_inss_fkey"
            columns: ["beneficio_inss_id"]
            isOneToOne: false
            referencedRelation: "beneficios_inss"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "afastamentos_evento_saude_fkey"
            columns: ["evento_saude_id"]
            isOneToOne: false
            referencedRelation: "eventos_saude"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_saude: {
        Row: {
          acao_gerada_id: string | null
          colaborador_id: string | null
          colaborador_nome: string
          created_at: string
          descricao: string | null
          id: string
          lido: boolean | null
          prioridade: string | null
          referencia_id: string
          referencia_tipo: string
          resolvido: boolean | null
          resolvido_em: string | null
          resolvido_por: string | null
          tenant_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          acao_gerada_id?: string | null
          colaborador_id?: string | null
          colaborador_nome: string
          created_at?: string
          descricao?: string | null
          id?: string
          lido?: boolean | null
          prioridade?: string | null
          referencia_id: string
          referencia_tipo: string
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          tenant_id: string
          tipo: string
          titulo: string
        }
        Update: {
          acao_gerada_id?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string
          created_at?: string
          descricao?: string | null
          id?: string
          lido?: boolean | null
          prioridade?: string | null
          referencia_id?: string
          referencia_tipo?: string
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          tenant_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_saude_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      atestados: {
        Row: {
          afastamento_id: string | null
          aptidao: Database["public"]["Enums"]["aptidao_ocupacional"] | null
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          cid_autorizado: boolean | null
          cid_codigo: string | null
          colaborador_cargo: string | null
          colaborador_cpf: string | null
          colaborador_departamento: string | null
          colaborador_id: string | null
          colaborador_nome: string
          contem_cid: boolean | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_emissao: string
          data_fim_afastamento: string | null
          data_inicio_afastamento: string | null
          dias_afastamento: number | null
          evento_saude_id: string | null
          grupo_clinico: Database["public"]["Enums"]["grupo_clinico"] | null
          horas_afastamento: number | null
          id: string
          nexo_trabalho: Database["public"]["Enums"]["nexo_trabalho"] | null
          observacoes: string | null
          observacoes_ocupacionais: string | null
          profissional_email: string | null
          profissional_endereco: string | null
          profissional_nome: string
          profissional_registro: string
          profissional_rqe: string | null
          profissional_telefone: string | null
          profissional_tipo: string | null
          profissional_uf: string | null
          restricoes: string | null
          subtipo_assistencial:
            | Database["public"]["Enums"]["atestado_subtipo_assistencial"]
            | null
          subtipo_ocupacional:
            | Database["public"]["Enums"]["atestado_subtipo_ocupacional"]
            | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["atestado_tipo"]
          unidade_afastamento: string | null
          updated_at: string
        }
        Insert: {
          afastamento_id?: string | null
          aptidao?: Database["public"]["Enums"]["aptidao_ocupacional"] | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          cid_autorizado?: boolean | null
          cid_codigo?: string | null
          colaborador_cargo?: string | null
          colaborador_cpf?: string | null
          colaborador_departamento?: string | null
          colaborador_id?: string | null
          colaborador_nome: string
          contem_cid?: boolean | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_emissao: string
          data_fim_afastamento?: string | null
          data_inicio_afastamento?: string | null
          dias_afastamento?: number | null
          evento_saude_id?: string | null
          grupo_clinico?: Database["public"]["Enums"]["grupo_clinico"] | null
          horas_afastamento?: number | null
          id?: string
          nexo_trabalho?: Database["public"]["Enums"]["nexo_trabalho"] | null
          observacoes?: string | null
          observacoes_ocupacionais?: string | null
          profissional_email?: string | null
          profissional_endereco?: string | null
          profissional_nome: string
          profissional_registro: string
          profissional_rqe?: string | null
          profissional_telefone?: string | null
          profissional_tipo?: string | null
          profissional_uf?: string | null
          restricoes?: string | null
          subtipo_assistencial?:
            | Database["public"]["Enums"]["atestado_subtipo_assistencial"]
            | null
          subtipo_ocupacional?:
            | Database["public"]["Enums"]["atestado_subtipo_ocupacional"]
            | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["atestado_tipo"]
          unidade_afastamento?: string | null
          updated_at?: string
        }
        Update: {
          afastamento_id?: string | null
          aptidao?: Database["public"]["Enums"]["aptidao_ocupacional"] | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          cid_autorizado?: boolean | null
          cid_codigo?: string | null
          colaborador_cargo?: string | null
          colaborador_cpf?: string | null
          colaborador_departamento?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string
          contem_cid?: boolean | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_emissao?: string
          data_fim_afastamento?: string | null
          data_inicio_afastamento?: string | null
          dias_afastamento?: number | null
          evento_saude_id?: string | null
          grupo_clinico?: Database["public"]["Enums"]["grupo_clinico"] | null
          horas_afastamento?: number | null
          id?: string
          nexo_trabalho?: Database["public"]["Enums"]["nexo_trabalho"] | null
          observacoes?: string | null
          observacoes_ocupacionais?: string | null
          profissional_email?: string | null
          profissional_endereco?: string | null
          profissional_nome?: string
          profissional_registro?: string
          profissional_rqe?: string | null
          profissional_telefone?: string | null
          profissional_tipo?: string | null
          profissional_uf?: string | null
          restricoes?: string | null
          subtipo_assistencial?:
            | Database["public"]["Enums"]["atestado_subtipo_assistencial"]
            | null
          subtipo_ocupacional?:
            | Database["public"]["Enums"]["atestado_subtipo_ocupacional"]
            | null
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["atestado_tipo"]
          unidade_afastamento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atestados_afastamento_fkey"
            columns: ["afastamento_id"]
            isOneToOne: false
            referencedRelation: "afastamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atestados_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "atestados_evento_saude_fkey"
            columns: ["evento_saude_id"]
            isOneToOne: false
            referencedRelation: "eventos_saude"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atestados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_9box: {
        Row: {
          avaliador_id: string | null
          avaliador_nome: string | null
          ciclo_id: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          data_avaliacao: string
          desempenho: number
          id: string
          justificativa: string | null
          potencial: number
          quadrante: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avaliador_id?: string | null
          avaliador_nome?: string | null
          ciclo_id?: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          data_avaliacao?: string
          desempenho: number
          id?: string
          justificativa?: string | null
          potencial: number
          quadrante: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          avaliador_id?: string | null
          avaliador_nome?: string | null
          ciclo_id?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          data_avaliacao?: string
          desempenho?: number
          id?: string
          justificativa?: string | null
          potencial?: number
          quadrante?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_9box_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "avaliacao_ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_9box_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_ciclos: {
        Row: {
          config_360: Json | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_fim: string
          data_inicio: string
          departamentos_ids: string[] | null
          descricao: string | null
          id: string
          nome: string
          notificacoes_enviadas: boolean | null
          status: Database["public"]["Enums"]["avaliacao_ciclo_status"]
          template_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config_360?: Json | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_fim: string
          data_inicio: string
          departamentos_ids?: string[] | null
          descricao?: string | null
          id?: string
          nome: string
          notificacoes_enviadas?: boolean | null
          status?: Database["public"]["Enums"]["avaliacao_ciclo_status"]
          template_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config_360?: Json | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_fim?: string
          data_inicio?: string
          departamentos_ids?: string[] | null
          descricao?: string | null
          id?: string
          nome?: string
          notificacoes_enviadas?: boolean | null
          status?: Database["public"]["Enums"]["avaliacao_ciclo_status"]
          template_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_ciclos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "avaliacao_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_ciclos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_feedbacks: {
        Row: {
          categoria: string
          created_at: string
          criterio: string
          feedback: string | null
          id: string
          resposta_id: string
          tenant_id: string
        }
        Insert: {
          categoria: string
          created_at?: string
          criterio: string
          feedback?: string | null
          id?: string
          resposta_id: string
          tenant_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          criterio?: string
          feedback?: string | null
          id?: string
          resposta_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_feedbacks_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "avaliacao_respostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_feedbacks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_respostas: {
        Row: {
          areas_desenvolvimento: string | null
          avaliado_id: string
          avaliado_nome: string
          avaliador_id: string | null
          avaliador_nome: string | null
          ciclo_id: string
          comentario_geral: string | null
          created_at: string
          data_conclusao: string | null
          data_inicio: string | null
          id: string
          nota_geral: number | null
          notas_criterios: Json | null
          pontos_fortes: string | null
          status: Database["public"]["Enums"]["resposta_status"]
          tenant_id: string
          tipo_avaliador: Database["public"]["Enums"]["tipo_avaliador"]
          updated_at: string
        }
        Insert: {
          areas_desenvolvimento?: string | null
          avaliado_id: string
          avaliado_nome: string
          avaliador_id?: string | null
          avaliador_nome?: string | null
          ciclo_id: string
          comentario_geral?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          nota_geral?: number | null
          notas_criterios?: Json | null
          pontos_fortes?: string | null
          status?: Database["public"]["Enums"]["resposta_status"]
          tenant_id: string
          tipo_avaliador: Database["public"]["Enums"]["tipo_avaliador"]
          updated_at?: string
        }
        Update: {
          areas_desenvolvimento?: string | null
          avaliado_id?: string
          avaliado_nome?: string
          avaliador_id?: string | null
          avaliador_nome?: string | null
          ciclo_id?: string
          comentario_geral?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          nota_geral?: number | null
          notas_criterios?: Json | null
          pontos_fortes?: string | null
          status?: Database["public"]["Enums"]["resposta_status"]
          tenant_id?: string
          tipo_avaliador?: Database["public"]["Enums"]["tipo_avaliador"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_respostas_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "avaliacao_ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_respostas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_templates: {
        Row: {
          ativo: boolean
          categorias: Json
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          criterios: Json
          descricao: string | null
          escala_labels: Json | null
          escala_max: number
          escala_min: number
          id: string
          nome: string
          permite_comentarios: boolean
          tenant_id: string
          tipo: Database["public"]["Enums"]["avaliacao_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categorias?: Json
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          criterios?: Json
          descricao?: string | null
          escala_labels?: Json | null
          escala_max?: number
          escala_min?: number
          id?: string
          nome: string
          permite_comentarios?: boolean
          tenant_id: string
          tipo?: Database["public"]["Enums"]["avaliacao_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categorias?: Json
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          criterios?: Json
          descricao?: string | null
          escala_labels?: Json | null
          escala_max?: number
          escala_min?: number
          id?: string
          nome?: string
          permite_comentarios?: boolean
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["avaliacao_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficios_colaboradores: {
        Row: {
          beneficio_tipo_id: string
          colaborador_cpf: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          motivo_cancelamento: string | null
          observacoes: string | null
          status: string
          tenant_id: string
          updated_at: string
          valor: number
          valor_desconto: number | null
        }
        Insert: {
          beneficio_tipo_id: string
          colaborador_cpf?: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          motivo_cancelamento?: string | null
          observacoes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          valor?: number
          valor_desconto?: number | null
        }
        Update: {
          beneficio_tipo_id?: string
          colaborador_cpf?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          motivo_cancelamento?: string | null
          observacoes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          valor?: number
          valor_desconto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "beneficios_colaboradores_beneficio_tipo_id_fkey"
            columns: ["beneficio_tipo_id"]
            isOneToOne: false
            referencedRelation: "beneficios_tipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficios_colaboradores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficios_inss: {
        Row: {
          afastamento_id: string | null
          arquivo_nome: string | null
          arquivo_url: string | null
          colaborador_cpf: string | null
          colaborador_id: string | null
          colaborador_nome: string
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_alta: string | null
          data_fim: string | null
          data_fim_estabilidade: string | null
          data_inicio: string
          especie: Database["public"]["Enums"]["beneficio_inss_especie"]
          evento_saude_id: string | null
          gera_estabilidade: boolean | null
          id: string
          numero_beneficio: string | null
          observacoes: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          afastamento_id?: string | null
          arquivo_nome?: string | null
          arquivo_url?: string | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_alta?: string | null
          data_fim?: string | null
          data_fim_estabilidade?: string | null
          data_inicio: string
          especie: Database["public"]["Enums"]["beneficio_inss_especie"]
          evento_saude_id?: string | null
          gera_estabilidade?: boolean | null
          id?: string
          numero_beneficio?: string | null
          observacoes?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          afastamento_id?: string | null
          arquivo_nome?: string | null
          arquivo_url?: string | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_alta?: string | null
          data_fim?: string | null
          data_fim_estabilidade?: string | null
          data_inicio?: string
          especie?: Database["public"]["Enums"]["beneficio_inss_especie"]
          evento_saude_id?: string | null
          gera_estabilidade?: boolean | null
          id?: string
          numero_beneficio?: string | null
          observacoes?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficios_inss_afastamento_fkey"
            columns: ["afastamento_id"]
            isOneToOne: false
            referencedRelation: "afastamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficios_inss_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "beneficios_inss_evento_saude_fkey"
            columns: ["evento_saude_id"]
            isOneToOne: false
            referencedRelation: "eventos_saude"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficios_inss_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficios_tipos: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          percentual_desconto: number | null
          regras_cargo: string[] | null
          regras_unidade: string[] | null
          regras_vinculo: string[] | null
          tenant_id: string
          tipo_desconto: string | null
          updated_at: string
          valor_desconto_fixo: number | null
          valor_padrao: number | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          percentual_desconto?: number | null
          regras_cargo?: string[] | null
          regras_unidade?: string[] | null
          regras_vinculo?: string[] | null
          tenant_id: string
          tipo_desconto?: string | null
          updated_at?: string
          valor_desconto_fixo?: number | null
          valor_padrao?: number | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          percentual_desconto?: number | null
          regras_cargo?: string[] | null
          regras_unidade?: string[] | null
          regras_vinculo?: string[] | null
          tenant_id?: string
          tipo_desconto?: string | null
          updated_at?: string
          valor_desconto_fixo?: number | null
          valor_padrao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "beneficios_tipos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          ativo: boolean
          created_at: string
          departamento_id: string | null
          descricao: string | null
          exames_obrigatorios: string[] | null
          faixa_salarial_max: number | null
          faixa_salarial_min: number | null
          id: string
          nivel: string | null
          nome: string
          periodicidade_exame_meses: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          departamento_id?: string | null
          descricao?: string | null
          exames_obrigatorios?: string[] | null
          faixa_salarial_max?: number | null
          faixa_salarial_min?: number | null
          id?: string
          nivel?: string | null
          nome: string
          periodicidade_exame_meses?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          departamento_id?: string | null
          descricao?: string | null
          exames_obrigatorios?: string[] | null
          faixa_salarial_max?: number | null
          faixa_salarial_min?: number | null
          id?: string
          nivel?: string | null
          nome?: string
          periodicidade_exame_meses?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargos_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      condicoes_especiais_trabalho: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          norma_regulamentadora: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          norma_regulamentadora?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          norma_regulamentadora?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condicoes_especiais_trabalho_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      departamentos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          responsavel_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_audit_log: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          documento_id: string
          documento_nome: string
          id: string
          ip_address: string | null
          pasta_destino_id: string | null
          pasta_destino_nome: string | null
          pasta_origem_id: string | null
          pasta_origem_nome: string | null
          tenant_id: string
          user_agent: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          documento_id: string
          documento_nome: string
          id?: string
          ip_address?: string | null
          pasta_destino_id?: string | null
          pasta_destino_nome?: string | null
          pasta_origem_id?: string | null
          pasta_origem_nome?: string | null
          tenant_id: string
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          documento_id?: string
          documento_nome?: string
          id?: string
          ip_address?: string | null
          pasta_destino_id?: string | null
          pasta_destino_nome?: string | null
          pasta_origem_id?: string | null
          pasta_origem_nome?: string | null
          tenant_id?: string
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_categorias_padrao: {
        Row: {
          ativo: boolean | null
          created_at: string
          descricao: string | null
          grupo: string
          icone: string | null
          id: string
          nome: string
          obrigatorio: boolean | null
          ordem: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          grupo: string
          icone?: string | null
          id?: string
          nome: string
          obrigatorio?: boolean | null
          ordem?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          grupo?: string
          icone?: string | null
          id?: string
          nome?: string
          obrigatorio?: boolean | null
          ordem?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_categorias_padrao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_pastas: {
        Row: {
          ano: number | null
          colaborador_cpf: string | null
          colaborador_id: string | null
          colaborador_nome: string | null
          cor: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          filial_id: string | null
          icone: string | null
          id: string
          mes: number | null
          nome: string
          ordem: number | null
          pasta_pai_id: string | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ano?: number | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          cor?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          filial_id?: string | null
          icone?: string | null
          id?: string
          mes?: number | null
          nome: string
          ordem?: number | null
          pasta_pai_id?: string | null
          tenant_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ano?: number | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          cor?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          filial_id?: string | null
          icone?: string | null
          id?: string
          mes?: number | null
          nome?: string
          ordem?: number | null
          pasta_pai_id?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_pastas_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_pastas_pasta_pai_id_fkey"
            columns: ["pasta_pai_id"]
            isOneToOne: false
            referencedRelation: "documento_pastas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_pastas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          colaborador_cpf: string | null
          colaborador_id: string | null
          colaborador_nome: string
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_validade: string | null
          id: string
          mime_type: string
          nome_arquivo: string
          nome_original: string
          observacoes: string | null
          pasta_id: string | null
          status: string
          storage_path: string
          tamanho: number
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_validade?: string | null
          id?: string
          mime_type: string
          nome_arquivo: string
          nome_original: string
          observacoes?: string | null
          pasta_id?: string | null
          status?: string
          storage_path: string
          tamanho: number
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_validade?: string | null
          id?: string
          mime_type?: string
          nome_arquivo?: string
          nome_original?: string
          observacoes?: string | null
          pasta_id?: string | null
          status?: string
          storage_path?: string
          tamanho?: number
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "documento_pastas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_cets: {
        Row: {
          cet_id: string
          created_at: string
          epi_tipo_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          cet_id: string
          created_at?: string
          epi_tipo_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          cet_id?: string
          created_at?: string
          epi_tipo_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_cets_cet_id_fkey"
            columns: ["cet_id"]
            isOneToOne: false
            referencedRelation: "condicoes_especiais_trabalho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_cets_epi_tipo_id_fkey"
            columns: ["epi_tipo_id"]
            isOneToOne: false
            referencedRelation: "epi_tipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_cets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_entregas: {
        Row: {
          assinatura_url: string | null
          colaborador_cargo: string | null
          colaborador_cpf: string | null
          colaborador_departamento: string | null
          colaborador_nome: string
          created_at: string
          data_devolucao_efetiva: string | null
          data_devolucao_prevista: string | null
          data_entrega: string
          data_validade: string | null
          employee_id: string | null
          entregue_por: string | null
          entregue_por_nome: string | null
          epi_id: string
          foto_entrega_url: string | null
          id: string
          ip_address: string | null
          liveness_data: Json | null
          liveness_detected: boolean | null
          motivo_entrega: string | null
          observacoes: string | null
          quantidade: number
          recebido_por_assinatura: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["entrega_status"]
          tenant_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          assinatura_url?: string | null
          colaborador_cargo?: string | null
          colaborador_cpf?: string | null
          colaborador_departamento?: string | null
          colaborador_nome: string
          created_at?: string
          data_devolucao_efetiva?: string | null
          data_devolucao_prevista?: string | null
          data_entrega?: string
          data_validade?: string | null
          employee_id?: string | null
          entregue_por?: string | null
          entregue_por_nome?: string | null
          epi_id: string
          foto_entrega_url?: string | null
          id?: string
          ip_address?: string | null
          liveness_data?: Json | null
          liveness_detected?: boolean | null
          motivo_entrega?: string | null
          observacoes?: string | null
          quantidade?: number
          recebido_por_assinatura?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["entrega_status"]
          tenant_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          assinatura_url?: string | null
          colaborador_cargo?: string | null
          colaborador_cpf?: string | null
          colaborador_departamento?: string | null
          colaborador_nome?: string
          created_at?: string
          data_devolucao_efetiva?: string | null
          data_devolucao_prevista?: string | null
          data_entrega?: string
          data_validade?: string | null
          employee_id?: string | null
          entregue_por?: string | null
          entregue_por_nome?: string | null
          epi_id?: string
          foto_entrega_url?: string | null
          id?: string
          ip_address?: string | null
          liveness_data?: Json | null
          liveness_detected?: boolean | null
          motivo_entrega?: string | null
          observacoes?: string | null
          quantidade?: number
          recebido_por_assinatura?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["entrega_status"]
          tenant_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_entregas_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_entregas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_movimentacoes: {
        Row: {
          created_at: string
          documento_referencia: string | null
          epi_id: string
          id: string
          motivo: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_atual: number
          realizado_por: string | null
          realizado_por_nome: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          documento_referencia?: string | null
          epi_id: string
          id?: string
          motivo?: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_atual: number
          realizado_por?: string | null
          realizado_por_nome?: string | null
          tenant_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          documento_referencia?: string | null
          epi_id?: string
          id?: string
          motivo?: string | null
          quantidade?: number
          quantidade_anterior?: number
          quantidade_atual?: number
          realizado_por?: string | null
          realizado_por_nome?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_movimentacoes_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_movimentacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_tipos: {
        Row: {
          ca_numero: string | null
          ca_validade: string | null
          categoria: string | null
          created_at: string
          descricao: string | null
          estoque_minimo: number | null
          fabricante: string | null
          id: string
          is_active: boolean | null
          marca: string | null
          nome: string
          obrigatorio_para_funcoes: string[] | null
          quantidade_estoque: number | null
          tenant_id: string
          updated_at: string
          validade_meses: number | null
        }
        Insert: {
          ca_numero?: string | null
          ca_validade?: string | null
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          estoque_minimo?: number | null
          fabricante?: string | null
          id?: string
          is_active?: boolean | null
          marca?: string | null
          nome: string
          obrigatorio_para_funcoes?: string[] | null
          quantidade_estoque?: number | null
          tenant_id: string
          updated_at?: string
          validade_meses?: number | null
        }
        Update: {
          ca_numero?: string | null
          ca_validade?: string | null
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          estoque_minimo?: number | null
          fabricante?: string | null
          id?: string
          is_active?: boolean | null
          marca?: string | null
          nome?: string
          obrigatorio_para_funcoes?: string[] | null
          quantidade_estoque?: number | null
          tenant_id?: string
          updated_at?: string
          validade_meses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_tipos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epis: {
        Row: {
          ca: string | null
          codigo: string | null
          created_at: string
          custo_unitario: number | null
          data_fabricacao: string | null
          data_validade: string | null
          id: string
          localizacao: string | null
          marca: string | null
          modelo: string | null
          observacoes: string | null
          quantidade_estoque: number
          quantidade_minima: number
          status: Database["public"]["Enums"]["epi_status"]
          tamanho: string | null
          tenant_id: string
          tipo_id: string
          updated_at: string
        }
        Insert: {
          ca?: string | null
          codigo?: string | null
          created_at?: string
          custo_unitario?: number | null
          data_fabricacao?: string | null
          data_validade?: string | null
          id?: string
          localizacao?: string | null
          marca?: string | null
          modelo?: string | null
          observacoes?: string | null
          quantidade_estoque?: number
          quantidade_minima?: number
          status?: Database["public"]["Enums"]["epi_status"]
          tamanho?: string | null
          tenant_id: string
          tipo_id: string
          updated_at?: string
        }
        Update: {
          ca?: string | null
          codigo?: string | null
          created_at?: string
          custo_unitario?: number | null
          data_fabricacao?: string | null
          data_validade?: string | null
          id?: string
          localizacao?: string | null
          marca?: string | null
          modelo?: string | null
          observacoes?: string | null
          quantidade_estoque?: number
          quantidade_minima?: number
          status?: Database["public"]["Enums"]["epi_status"]
          tamanho?: string | null
          tenant_id?: string
          tipo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epis_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "epi_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      ergonomia_acoes: {
        Row: {
          created_at: string
          custo_estimado: number | null
          custo_real: number | null
          data_conclusao: string | null
          data_inicio: string | null
          descricao: string | null
          evidencia_conclusao: string | null
          id: string
          item_nr17_id: string | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["acao_prioridade"]
          responsavel_id: string | null
          responsavel_nome: string | null
          risco_id: string | null
          status: Database["public"]["Enums"]["acao_status"]
          tenant_id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_estimado?: number | null
          custo_real?: number | null
          data_conclusao?: string | null
          data_inicio?: string | null
          descricao?: string | null
          evidencia_conclusao?: string | null
          id?: string
          item_nr17_id?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["acao_prioridade"]
          responsavel_id?: string | null
          responsavel_nome?: string | null
          risco_id?: string | null
          status?: Database["public"]["Enums"]["acao_status"]
          tenant_id: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_estimado?: number | null
          custo_real?: number | null
          data_conclusao?: string | null
          data_inicio?: string | null
          descricao?: string | null
          evidencia_conclusao?: string | null
          id?: string
          item_nr17_id?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["acao_prioridade"]
          responsavel_id?: string | null
          responsavel_nome?: string | null
          risco_id?: string | null
          status?: Database["public"]["Enums"]["acao_status"]
          tenant_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ergonomia_acoes_item_nr17_id_fkey"
            columns: ["item_nr17_id"]
            isOneToOne: false
            referencedRelation: "ergonomia_itens_nr17"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ergonomia_acoes_risco_id_fkey"
            columns: ["risco_id"]
            isOneToOne: false
            referencedRelation: "ergonomia_riscos"
            referencedColumns: ["id"]
          },
        ]
      }
      ergonomia_evidencias: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          created_at: string
          descricao: string | null
          enviado_por: string | null
          enviado_por_nome: string | null
          id: string
          item_nr17_id: string
          tenant_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string
          descricao?: string | null
          enviado_por?: string | null
          enviado_por_nome?: string | null
          id?: string
          item_nr17_id: string
          tenant_id: string
          tipo: string
          titulo: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string
          descricao?: string | null
          enviado_por?: string | null
          enviado_por_nome?: string | null
          id?: string
          item_nr17_id?: string
          tenant_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ergonomia_evidencias_item_nr17_id_fkey"
            columns: ["item_nr17_id"]
            isOneToOne: false
            referencedRelation: "ergonomia_itens_nr17"
            referencedColumns: ["id"]
          },
        ]
      }
      ergonomia_itens_nr17: {
        Row: {
          categoria: Database["public"]["Enums"]["ergonomia_categoria"]
          codigo: string
          created_at: string
          data_avaliacao: string | null
          descricao: string | null
          id: string
          observacoes: string | null
          proxima_reavaliacao: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status: Database["public"]["Enums"]["ergonomia_status"]
          tenant_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          categoria: Database["public"]["Enums"]["ergonomia_categoria"]
          codigo: string
          created_at?: string
          data_avaliacao?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          proxima_reavaliacao?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["ergonomia_status"]
          tenant_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["ergonomia_categoria"]
          codigo?: string
          created_at?: string
          data_avaliacao?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          proxima_reavaliacao?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["ergonomia_status"]
          tenant_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      ergonomia_maturidade: {
        Row: {
          acoes_concluidas: number
          acoes_pendentes: number
          created_at: string
          data_avaliacao: string
          id: string
          itens_atendidos: number
          itens_nao_atendidos: number
          itens_parciais: number
          nivel: string
          observacoes: string | null
          pontuacao: number
          riscos_criticos: number
          tenant_id: string
        }
        Insert: {
          acoes_concluidas?: number
          acoes_pendentes?: number
          created_at?: string
          data_avaliacao?: string
          id?: string
          itens_atendidos?: number
          itens_nao_atendidos?: number
          itens_parciais?: number
          nivel: string
          observacoes?: string | null
          pontuacao?: number
          riscos_criticos?: number
          tenant_id: string
        }
        Update: {
          acoes_concluidas?: number
          acoes_pendentes?: number
          created_at?: string
          data_avaliacao?: string
          id?: string
          itens_atendidos?: number
          itens_nao_atendidos?: number
          itens_parciais?: number
          nivel?: string
          observacoes?: string | null
          pontuacao?: number
          riscos_criticos?: number
          tenant_id?: string
        }
        Relationships: []
      }
      ergonomia_riscos: {
        Row: {
          ativo: boolean
          created_at: string
          departamento: string | null
          descricao: string | null
          eixo: Database["public"]["Enums"]["ergonomia_eixo"]
          fonte: string | null
          id: string
          impactos_potenciais: string[] | null
          item_nr17_id: string | null
          medidas_existentes: string[] | null
          medidas_recomendadas: string[] | null
          probabilidade: Database["public"]["Enums"]["risco_severidade"]
          setor: string | null
          severidade: Database["public"]["Enums"]["risco_severidade"]
          tenant_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          departamento?: string | null
          descricao?: string | null
          eixo: Database["public"]["Enums"]["ergonomia_eixo"]
          fonte?: string | null
          id?: string
          impactos_potenciais?: string[] | null
          item_nr17_id?: string | null
          medidas_existentes?: string[] | null
          medidas_recomendadas?: string[] | null
          probabilidade?: Database["public"]["Enums"]["risco_severidade"]
          setor?: string | null
          severidade?: Database["public"]["Enums"]["risco_severidade"]
          tenant_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          departamento?: string | null
          descricao?: string | null
          eixo?: Database["public"]["Enums"]["ergonomia_eixo"]
          fonte?: string | null
          id?: string
          impactos_potenciais?: string[] | null
          item_nr17_id?: string | null
          medidas_existentes?: string[] | null
          medidas_recomendadas?: string[] | null
          probabilidade?: Database["public"]["Enums"]["risco_severidade"]
          setor?: string | null
          severidade?: Database["public"]["Enums"]["risco_severidade"]
          tenant_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ergonomia_riscos_item_nr17_id_fkey"
            columns: ["item_nr17_id"]
            isOneToOne: false
            referencedRelation: "ergonomia_itens_nr17"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_saude: {
        Row: {
          codigo: string
          colaborador_cpf: string | null
          colaborador_id: string | null
          colaborador_nome: string
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          grupo_clinico_principal:
            | Database["public"]["Enums"]["grupo_clinico"]
            | null
          id: string
          nexo_trabalho: Database["public"]["Enums"]["nexo_trabalho"] | null
          observacoes: string | null
          status: Database["public"]["Enums"]["evento_saude_status"]
          tenant_id: string
          titulo: string
          total_atestados: number | null
          total_dias_afastamento: number | null
          updated_at: string
        }
        Insert: {
          codigo: string
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          grupo_clinico_principal?:
            | Database["public"]["Enums"]["grupo_clinico"]
            | null
          id?: string
          nexo_trabalho?: Database["public"]["Enums"]["nexo_trabalho"] | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["evento_saude_status"]
          tenant_id: string
          titulo: string
          total_atestados?: number | null
          total_dias_afastamento?: number | null
          updated_at?: string
        }
        Update: {
          codigo?: string
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          grupo_clinico_principal?:
            | Database["public"]["Enums"]["grupo_clinico"]
            | null
          id?: string
          nexo_trabalho?: Database["public"]["Enums"]["nexo_trabalho"] | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["evento_saude_status"]
          tenant_id?: string
          titulo?: string
          total_atestados?: number | null
          total_dias_afastamento?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_saude_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "eventos_saude_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comentarios: {
        Row: {
          autor_avatar: string | null
          autor_id: string
          autor_nome: string
          conteudo: string
          created_at: string
          id: string
          post_id: string
          tenant_id: string
        }
        Insert: {
          autor_avatar?: string | null
          autor_id: string
          autor_nome: string
          conteudo: string
          created_at?: string
          id?: string
          post_id: string
          tenant_id: string
        }
        Update: {
          autor_avatar?: string | null
          autor_id?: string
          autor_nome?: string
          conteudo?: string
          created_at?: string
          id?: string
          post_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comentarios_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          autor_avatar: string | null
          autor_id: string
          autor_nome: string
          conteudo: string
          created_at: string
          fixado: boolean
          id: string
          imagem_url: string | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          autor_avatar?: string | null
          autor_id: string
          autor_nome: string
          conteudo: string
          created_at?: string
          fixado?: boolean
          id?: string
          imagem_url?: string | null
          tenant_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          autor_avatar?: string | null
          autor_id?: string
          autor_nome?: string
          conteudo?: string
          created_at?: string
          fixado?: boolean
          id?: string
          imagem_url?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      feed_reacoes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          tenant_id: string
          tipo: string
          user_id: string
          user_nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          tenant_id: string
          tipo: string
          user_id: string
          user_nome: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          tenant_id?: string
          tipo?: string
          user_id?: string
          user_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reacoes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      filiais: {
        Row: {
          ativo: boolean
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          responsavel_id: string | null
          telefone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
          telefone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          telefone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "filiais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_eventos: {
        Row: {
          codigo: string | null
          created_at: string
          descricao: string
          folha_item_id: string
          id: string
          origem: string | null
          origem_id: string | null
          referencia: string | null
          tenant_id: string
          tipo: string
          valor: number
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          descricao: string
          folha_item_id: string
          id?: string
          origem?: string | null
          origem_id?: string | null
          referencia?: string | null
          tenant_id: string
          tipo: string
          valor?: number
        }
        Update: {
          codigo?: string | null
          created_at?: string
          descricao?: string
          folha_item_id?: string
          id?: string
          origem?: string | null
          origem_id?: string | null
          referencia?: string | null
          tenant_id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "folha_eventos_folha_item_id_fkey"
            columns: ["folha_item_id"]
            isOneToOne: false
            referencedRelation: "folha_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_eventos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_itens: {
        Row: {
          cargo: string | null
          colaborador_cpf: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          departamento: string | null
          id: string
          observacoes: string | null
          periodo_id: string
          salario_base: number
          status: string
          tenant_id: string
          total_descontos: number | null
          total_liquido: number | null
          total_proventos: number | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          colaborador_cpf?: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          departamento?: string | null
          id?: string
          observacoes?: string | null
          periodo_id: string
          salario_base?: number
          status?: string
          tenant_id: string
          total_descontos?: number | null
          total_liquido?: number | null
          total_proventos?: number | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          colaborador_cpf?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          departamento?: string | null
          id?: string
          observacoes?: string | null
          periodo_id?: string
          salario_base?: number
          status?: string
          tenant_id?: string
          total_descontos?: number | null
          total_liquido?: number | null
          total_proventos?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folha_itens_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "folha_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_itens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_periodos: {
        Row: {
          competencia: string
          created_at: string
          data_abertura: string | null
          data_fechamento: string | null
          fechado_por: string | null
          fechado_por_nome: string | null
          id: string
          observacoes: string | null
          status: string
          tenant_id: string
          total_bruto: number | null
          total_colaboradores: number | null
          total_descontos: number | null
          total_liquido: number | null
          updated_at: string
        }
        Insert: {
          competencia: string
          created_at?: string
          data_abertura?: string | null
          data_fechamento?: string | null
          fechado_por?: string | null
          fechado_por_nome?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id: string
          total_bruto?: number | null
          total_colaboradores?: number | null
          total_descontos?: number | null
          total_liquido?: number | null
          updated_at?: string
        }
        Update: {
          competencia?: string
          created_at?: string
          data_abertura?: string | null
          data_fechamento?: string | null
          fechado_por?: string | null
          fechado_por_nome?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id?: string
          total_bruto?: number | null
          total_colaboradores?: number | null
          total_descontos?: number | null
          total_liquido?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folha_periodos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_cets: {
        Row: {
          cargo_id: string
          cet_id: string
          created_at: string
          id: string
          observacao: string | null
          tenant_id: string
        }
        Insert: {
          cargo_id: string
          cet_id: string
          created_at?: string
          id?: string
          observacao?: string | null
          tenant_id: string
        }
        Update: {
          cargo_id?: string
          cet_id?: string
          created_at?: string
          id?: string
          observacao?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcao_cets_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_cets_cet_id_fkey"
            columns: ["cet_id"]
            isOneToOne: false
            referencedRelation: "condicoes_especiais_trabalho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_cets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_epis: {
        Row: {
          cargo_id: string
          created_at: string
          epi_tipo_id: string
          id: string
          justificativa: string | null
          obrigatorio: boolean
          tenant_id: string
        }
        Insert: {
          cargo_id: string
          created_at?: string
          epi_tipo_id: string
          id?: string
          justificativa?: string | null
          obrigatorio?: boolean
          tenant_id: string
        }
        Update: {
          cargo_id?: string
          created_at?: string
          epi_tipo_id?: string
          id?: string
          justificativa?: string | null
          obrigatorio?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcao_epis_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_epis_epi_tipo_id_fkey"
            columns: ["epi_tipo_id"]
            isOneToOne: false
            referencedRelation: "epi_tipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_epis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      holerite_assinaturas: {
        Row: {
          assinado_em: string | null
          colaborador_id: string
          colaborador_nome: string
          competencia: string
          created_at: string
          documento_id: string | null
          enviado_em: string
          enviado_por: string | null
          enviado_por_nome: string | null
          folha_item_id: string
          id: string
          ip_assinatura: string | null
          observacoes: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assinado_em?: string | null
          colaborador_id: string
          colaborador_nome: string
          competencia: string
          created_at?: string
          documento_id?: string | null
          enviado_em?: string
          enviado_por?: string | null
          enviado_por_nome?: string | null
          folha_item_id: string
          id?: string
          ip_assinatura?: string | null
          observacoes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assinado_em?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          competencia?: string
          created_at?: string
          documento_id?: string | null
          enviado_em?: string
          enviado_por?: string | null
          enviado_por_nome?: string | null
          folha_item_id?: string
          id?: string
          ip_assinatura?: string | null
          observacoes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holerite_assinaturas_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holerite_assinaturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      humor_diario: {
        Row: {
          created_at: string
          data: string
          emoji: string
          humor: string
          id: string
          micropergunta_resposta: string | null
          micropergunta_tipo: string | null
          tenant_id: string
          updated_at: string
          user_id: string
          user_nome: string
        }
        Insert: {
          created_at?: string
          data?: string
          emoji: string
          humor: string
          id?: string
          micropergunta_resposta?: string | null
          micropergunta_tipo?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
          user_nome: string
        }
        Update: {
          created_at?: string
          data?: string
          emoji?: string
          humor?: string
          id?: string
          micropergunta_resposta?: string | null
          micropergunta_tipo?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
          user_nome?: string
        }
        Relationships: []
      }
      humor_historico: {
        Row: {
          created_at: string
          emoji_anterior: string | null
          emoji_novo: string
          humor_anterior: string | null
          humor_diario_id: string
          humor_novo: string
          id: string
          motivo_mudanca: string | null
          tenant_id: string
          user_id: string
          user_nome: string
        }
        Insert: {
          created_at?: string
          emoji_anterior?: string | null
          emoji_novo: string
          humor_anterior?: string | null
          humor_diario_id: string
          humor_novo: string
          id?: string
          motivo_mudanca?: string | null
          tenant_id: string
          user_id: string
          user_nome: string
        }
        Update: {
          created_at?: string
          emoji_anterior?: string | null
          emoji_novo?: string
          humor_anterior?: string | null
          humor_diario_id?: string
          humor_novo?: string
          id?: string
          motivo_mudanca?: string | null
          tenant_id?: string
          user_id?: string
          user_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "humor_historico_humor_diario_id_fkey"
            columns: ["humor_diario_id"]
            isOneToOne: false
            referencedRelation: "humor_diario"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_okrs: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          key_result: string
          meta_id: string
          progresso: number
          responsavel_id: string | null
          responsavel_nome: string | null
          status: Database["public"]["Enums"]["meta_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["okr_tipo"]
          unidade: string | null
          updated_at: string
          valor_alvo: number
          valor_atual: number | null
          valor_inicial: number | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          key_result: string
          meta_id: string
          progresso?: number
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["meta_status"]
          tenant_id: string
          tipo?: Database["public"]["Enums"]["okr_tipo"]
          unidade?: string | null
          updated_at?: string
          valor_alvo: number
          valor_atual?: number | null
          valor_inicial?: number | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          key_result?: string
          meta_id?: string
          progresso?: number
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["meta_status"]
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["okr_tipo"]
          unidade?: string | null
          updated_at?: string
          valor_alvo?: number
          valor_atual?: number | null
          valor_inicial?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_okrs_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_okrs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          ano: number
          colaborador_id: string | null
          colaborador_nome: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_fim: string | null
          data_inicio: string | null
          departamento_id: string | null
          departamento_nome: string | null
          descricao: string | null
          id: string
          periodo: Database["public"]["Enums"]["meta_periodo"]
          peso: number | null
          progresso: number
          status: Database["public"]["Enums"]["meta_status"]
          tenant_id: string
          tipo: string
          titulo: string
          trimestre: number | null
          updated_at: string
          vinculo_ciclo_id: string | null
        }
        Insert: {
          ano: number
          colaborador_id?: string | null
          colaborador_nome?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          departamento_id?: string | null
          departamento_nome?: string | null
          descricao?: string | null
          id?: string
          periodo?: Database["public"]["Enums"]["meta_periodo"]
          peso?: number | null
          progresso?: number
          status?: Database["public"]["Enums"]["meta_status"]
          tenant_id: string
          tipo?: string
          titulo: string
          trimestre?: number | null
          updated_at?: string
          vinculo_ciclo_id?: string | null
        }
        Update: {
          ano?: number
          colaborador_id?: string | null
          colaborador_nome?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          departamento_id?: string | null
          departamento_nome?: string | null
          descricao?: string | null
          id?: string
          periodo?: Database["public"]["Enums"]["meta_periodo"]
          peso?: number | null
          progresso?: number
          status?: Database["public"]["Enums"]["meta_status"]
          tenant_id?: string
          tipo?: string
          titulo?: string
          trimestre?: number | null
          updated_at?: string
          vinculo_ciclo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_vinculo_ciclo_id_fkey"
            columns: ["vinculo_ciclo_id"]
            isOneToOne: false
            referencedRelation: "avaliacao_ciclos"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_checkins: {
        Row: {
          created_at: string
          id: string
          observacao: string | null
          okr_id: string
          realizado_por: string | null
          realizado_por_nome: string | null
          tenant_id: string
          valor_anterior: number | null
          valor_novo: number
        }
        Insert: {
          created_at?: string
          id?: string
          observacao?: string | null
          okr_id: string
          realizado_por?: string | null
          realizado_por_nome?: string | null
          tenant_id: string
          valor_anterior?: number | null
          valor_novo: number
        }
        Update: {
          created_at?: string
          id?: string
          observacao?: string | null
          okr_id?: string
          realizado_por?: string | null
          realizado_por_nome?: string | null
          tenant_id?: string
          valor_anterior?: number | null
          valor_novo?: number
        }
        Relationships: [
          {
            foreignKeyName: "okr_checkins_okr_id_fkey"
            columns: ["okr_id"]
            isOneToOne: false
            referencedRelation: "meta_okrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_checkins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ouvidoria: {
        Row: {
          anexos: Json | null
          anonimo: boolean
          assunto: string
          autor_departamento: string | null
          autor_email: string | null
          autor_id: string | null
          autor_nome: string | null
          created_at: string
          id: string
          mensagem: string
          prioridade: string | null
          respondido_em: string | null
          respondido_por: string | null
          respondido_por_nome: string | null
          resposta: string | null
          status: string
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          anexos?: Json | null
          anonimo?: boolean
          assunto: string
          autor_departamento?: string | null
          autor_email?: string | null
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          id?: string
          mensagem: string
          prioridade?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          respondido_por_nome?: string | null
          resposta?: string | null
          status?: string
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          anexos?: Json | null
          anonimo?: boolean
          assunto?: string
          autor_departamento?: string | null
          autor_email?: string | null
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          id?: string
          mensagem?: string
          prioridade?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          respondido_por_nome?: string | null
          resposta?: string | null
          status?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ouvidoria_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_acoes: {
        Row: {
          codigo: string
          como: string | null
          created_at: string | null
          criado_por: string | null
          criado_por_nome: string | null
          custo_estimado: number | null
          custo_real: number | null
          data_conclusao: string | null
          data_inicio: string | null
          descricao: string | null
          exige_evidencia: boolean | null
          gravidade: number | null
          id: string
          onde: string | null
          origem_descricao: string | null
          origem_id: string | null
          origem_modulo: string
          pontuacao_gut: number | null
          porque: string | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["acao_gut_prioridade"] | null
          progresso: number | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status: Database["public"]["Enums"]["acao_status"] | null
          tempo_estimado_minutos: number | null
          tempo_gasto_minutos: number | null
          tenant_id: string
          tendencia: number | null
          tipo: string | null
          titulo: string
          updated_at: string | null
          urgencia: number | null
        }
        Insert: {
          codigo: string
          como?: string | null
          created_at?: string | null
          criado_por?: string | null
          criado_por_nome?: string | null
          custo_estimado?: number | null
          custo_real?: number | null
          data_conclusao?: string | null
          data_inicio?: string | null
          descricao?: string | null
          exige_evidencia?: boolean | null
          gravidade?: number | null
          id?: string
          onde?: string | null
          origem_descricao?: string | null
          origem_id?: string | null
          origem_modulo?: string
          pontuacao_gut?: number | null
          porque?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["acao_gut_prioridade"] | null
          progresso?: number | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["acao_status"] | null
          tempo_estimado_minutos?: number | null
          tempo_gasto_minutos?: number | null
          tenant_id: string
          tendencia?: number | null
          tipo?: string | null
          titulo: string
          updated_at?: string | null
          urgencia?: number | null
        }
        Update: {
          codigo?: string
          como?: string | null
          created_at?: string | null
          criado_por?: string | null
          criado_por_nome?: string | null
          custo_estimado?: number | null
          custo_real?: number | null
          data_conclusao?: string | null
          data_inicio?: string | null
          descricao?: string | null
          exige_evidencia?: boolean | null
          gravidade?: number | null
          id?: string
          onde?: string | null
          origem_descricao?: string | null
          origem_id?: string | null
          origem_modulo?: string
          pontuacao_gut?: number | null
          porque?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["acao_gut_prioridade"] | null
          progresso?: number | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["acao_status"] | null
          tempo_estimado_minutos?: number | null
          tempo_gasto_minutos?: number | null
          tenant_id?: string
          tendencia?: number | null
          tipo?: string | null
          titulo?: string
          updated_at?: string | null
          urgencia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_acoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_comentarios: {
        Row: {
          acao_id: string
          autor_id: string
          autor_nome: string
          conteudo: string
          created_at: string | null
          id: string
          mencoes: string[] | null
          tarefa_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          acao_id: string
          autor_id: string
          autor_nome: string
          conteudo: string
          created_at?: string | null
          id?: string
          mencoes?: string[] | null
          tarefa_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          acao_id?: string
          autor_id?: string
          autor_nome?: string
          conteudo?: string
          created_at?: string | null
          id?: string
          mencoes?: string[] | null
          tarefa_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_comentarios_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "plano_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_comentarios_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "plano_tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_comentarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_evidencias: {
        Row: {
          acao_id: string
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          created_at: string | null
          descricao: string | null
          enviado_por: string | null
          enviado_por_nome: string | null
          id: string
          tarefa_id: string | null
          tenant_id: string
          tipo: string | null
          titulo: string
        }
        Insert: {
          acao_id: string
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          created_at?: string | null
          descricao?: string | null
          enviado_por?: string | null
          enviado_por_nome?: string | null
          id?: string
          tarefa_id?: string | null
          tenant_id: string
          tipo?: string | null
          titulo: string
        }
        Update: {
          acao_id?: string
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          created_at?: string | null
          descricao?: string | null
          enviado_por?: string | null
          enviado_por_nome?: string | null
          id?: string
          tarefa_id?: string | null
          tenant_id?: string
          tipo?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_evidencias_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "plano_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_evidencias_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "plano_tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_evidencias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_historico: {
        Row: {
          acao_id: string | null
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string
          id: string
          tarefa_id: string | null
          tenant_id: string
          tipo_evento: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao_id?: string | null
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao: string
          id?: string
          tarefa_id?: string | null
          tenant_id: string
          tipo_evento: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao_id?: string | null
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string
          id?: string
          tarefa_id?: string | null
          tenant_id?: string
          tipo_evento?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_historico_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "plano_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_historico_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "plano_tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_historico_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_participantes: {
        Row: {
          acao_id: string
          aceito: boolean | null
          created_at: string | null
          data_aceite: string | null
          id: string
          tenant_id: string
          tipo: string
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          acao_id: string
          aceito?: boolean | null
          created_at?: string | null
          data_aceite?: string | null
          id?: string
          tenant_id: string
          tipo?: string
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          acao_id?: string
          aceito?: boolean | null
          created_at?: string | null
          data_aceite?: string | null
          id?: string
          tenant_id?: string
          tipo?: string
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_participantes_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "plano_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_participantes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_tarefas: {
        Row: {
          acao_id: string
          concluida_por: string | null
          concluida_por_nome: string | null
          created_at: string | null
          data_conclusao: string | null
          depende_de: string | null
          descricao: string | null
          id: string
          observacoes: string | null
          ordem: number | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["acao_gut_prioridade"] | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status: Database["public"]["Enums"]["tarefa_status"] | null
          tempo_estimado_minutos: number | null
          tempo_gasto_minutos: number | null
          tenant_id: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          acao_id: string
          concluida_por?: string | null
          concluida_por_nome?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          depende_de?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          ordem?: number | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["acao_gut_prioridade"] | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["tarefa_status"] | null
          tempo_estimado_minutos?: number | null
          tempo_gasto_minutos?: number | null
          tenant_id: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          acao_id?: string
          concluida_por?: string | null
          concluida_por_nome?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          depende_de?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          ordem?: number | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["acao_gut_prioridade"] | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["tarefa_status"] | null
          tempo_estimado_minutos?: number | null
          tempo_gasto_minutos?: number | null
          tenant_id?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_tarefas_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "plano_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_tarefas_depende_de_fkey"
            columns: ["depende_de"]
            isOneToOne: false
            referencedRelation: "plano_tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_tarefas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_templates: {
        Row: {
          acao_template: Json
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          criado_por: string | null
          criado_por_nome: string | null
          descricao: string | null
          id: string
          nome: string
          tarefas_template: Json | null
          tenant_id: string
          updated_at: string | null
          uso_count: number | null
        }
        Insert: {
          acao_template: Json
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tarefas_template?: Json | null
          tenant_id: string
          updated_at?: string | null
          uso_count?: number | null
        }
        Update: {
          acao_template?: Json
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tarefas_template?: Json | null
          tenant_id?: string
          updated_at?: string | null
          uso_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_tempo: {
        Row: {
          acao_id: string | null
          created_at: string | null
          descricao: string | null
          duracao_minutos: number | null
          fim: string | null
          id: string
          inicio: string
          tarefa_id: string | null
          tenant_id: string
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          acao_id?: string | null
          created_at?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          fim?: string | null
          id?: string
          inicio?: string
          tarefa_id?: string | null
          tenant_id: string
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          acao_id?: string | null
          created_at?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          fim?: string | null
          id?: string
          inicio?: string
          tarefa_id?: string | null
          tenant_id?: string
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_tempo_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "plano_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_tempo_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "plano_tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_tempo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_ajustes: {
        Row: {
          aprovado_por: string | null
          aprovado_por_nome: string | null
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          created_by: string | null
          created_by_nome: string | null
          data_aprovacao: string | null
          data_referencia: string
          hora_original: string | null
          hora_solicitada: string | null
          id: string
          motivo: string
          observacao_aprovador: string | null
          ponto_diario_id: string | null
          status: string
          tenant_id: string
          tipo_ajuste: string
          tipo_marcacao: string | null
        }
        Insert: {
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          created_by?: string | null
          created_by_nome?: string | null
          data_aprovacao?: string | null
          data_referencia: string
          hora_original?: string | null
          hora_solicitada?: string | null
          id?: string
          motivo: string
          observacao_aprovador?: string | null
          ponto_diario_id?: string | null
          status?: string
          tenant_id: string
          tipo_ajuste: string
          tipo_marcacao?: string | null
        }
        Update: {
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
          colaborador_cpf?: string
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          created_by?: string | null
          created_by_nome?: string | null
          data_aprovacao?: string | null
          data_referencia?: string
          hora_original?: string | null
          hora_solicitada?: string | null
          id?: string
          motivo?: string
          observacao_aprovador?: string | null
          ponto_diario_id?: string | null
          status?: string
          tenant_id?: string
          tipo_ajuste?: string
          tipo_marcacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_ajustes_ponto_diario_id_fkey"
            columns: ["ponto_diario_id"]
            isOneToOne: false
            referencedRelation: "ponto_diario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_ajustes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_audit_log: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          ip_origem: string | null
          registro_id: string
          tabela_origem: string
          tenant_id: string
          user_agent: string | null
          usuario_email: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_origem?: string | null
          registro_id: string
          tabela_origem: string
          tenant_id: string
          user_agent?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_origem?: string | null
          registro_id?: string
          tabela_origem?: string
          tenant_id?: string
          user_agent?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_configuracao: {
        Row: {
          bloquear_dispositivo_nao_autorizado: boolean
          created_at: string
          exigir_localizacao: boolean
          hora_entrada_padrao: string
          hora_retorno_almoco_padrao: string
          hora_saida_almoco_padrao: string
          hora_saida_padrao: string
          id: string
          permitir_registro_fora_horario: boolean
          tenant_id: string
          tolerancia_atraso: number
          tolerancia_hora_extra: number
          updated_at: string
        }
        Insert: {
          bloquear_dispositivo_nao_autorizado?: boolean
          created_at?: string
          exigir_localizacao?: boolean
          hora_entrada_padrao?: string
          hora_retorno_almoco_padrao?: string
          hora_saida_almoco_padrao?: string
          hora_saida_padrao?: string
          id?: string
          permitir_registro_fora_horario?: boolean
          tenant_id: string
          tolerancia_atraso?: number
          tolerancia_hora_extra?: number
          updated_at?: string
        }
        Update: {
          bloquear_dispositivo_nao_autorizado?: boolean
          created_at?: string
          exigir_localizacao?: boolean
          hora_entrada_padrao?: string
          hora_retorno_almoco_padrao?: string
          hora_saida_almoco_padrao?: string
          hora_saida_padrao?: string
          id?: string
          permitir_registro_fora_horario?: boolean
          tenant_id?: string
          tolerancia_atraso?: number
          tolerancia_hora_extra?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_configuracao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_diario: {
        Row: {
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          data: string
          entrada: string | null
          horas_extras: unknown
          horas_faltantes: unknown
          horas_trabalhadas: unknown
          id: string
          observacao: string | null
          retorno_almoco: string | null
          saida: string | null
          saida_almoco: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          data: string
          entrada?: string | null
          horas_extras?: unknown
          horas_faltantes?: unknown
          horas_trabalhadas?: unknown
          id?: string
          observacao?: string | null
          retorno_almoco?: string | null
          saida?: string | null
          saida_almoco?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          colaborador_cpf?: string
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          data?: string
          entrada?: string | null
          horas_extras?: unknown
          horas_faltantes?: unknown
          horas_trabalhadas?: unknown
          id?: string
          observacao?: string | null
          retorno_almoco?: string | null
          saida?: string | null
          saida_almoco?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_diario_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_marcacoes: {
        Row: {
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          created_by: string | null
          data_marcacao: string
          dispositivo: string | null
          hash_marcacao: string
          hora_marcacao: string
          id: string
          ip_origem: string | null
          latitude: number | null
          longitude: number | null
          marcacao_original: boolean
          tenant_id: string
          tipo_marcacao: string
          user_agent: string | null
        }
        Insert: {
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          created_by?: string | null
          data_marcacao?: string
          dispositivo?: string | null
          hash_marcacao: string
          hora_marcacao?: string
          id?: string
          ip_origem?: string | null
          latitude?: number | null
          longitude?: number | null
          marcacao_original?: boolean
          tenant_id: string
          tipo_marcacao: string
          user_agent?: string | null
        }
        Update: {
          colaborador_cpf?: string
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          created_by?: string | null
          data_marcacao?: string
          dispositivo?: string | null
          hash_marcacao?: string
          hora_marcacao?: string
          id?: string
          ip_origem?: string | null
          latitude?: number | null
          longitude?: number | null
          marcacao_original?: boolean
          tenant_id?: string
          tipo_marcacao?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_marcacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          created_at: string
          id: string
          nome_completo: string
          telefone: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          id?: string
          nome_completo: string
          telefone?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          id?: string
          nome_completo?: string
          telefone?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      questionario_psicossocial_campanhas: {
        Row: {
          anonimo: boolean
          blocos_dinamicos: Json | null
          campanha_anterior_id: string | null
          cargos_ids: string[] | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_fim: string
          data_inicio: string
          departamentos_ids: string[] | null
          descricao: string | null
          evento_gatilho_id: string | null
          evento_gatilho_tipo: string | null
          id: string
          mensagem_institucional: string | null
          motivo_extraordinaria: string | null
          nome: string
          periodicidade: string | null
          permite_identificacao_voluntaria: boolean
          politica_uso_dados: string | null
          status: Database["public"]["Enums"]["campanha_psicossocial_status"]
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          anonimo?: boolean
          blocos_dinamicos?: Json | null
          campanha_anterior_id?: string | null
          cargos_ids?: string[] | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_fim: string
          data_inicio: string
          departamentos_ids?: string[] | null
          descricao?: string | null
          evento_gatilho_id?: string | null
          evento_gatilho_tipo?: string | null
          id?: string
          mensagem_institucional?: string | null
          motivo_extraordinaria?: string | null
          nome: string
          periodicidade?: string | null
          permite_identificacao_voluntaria?: boolean
          politica_uso_dados?: string | null
          status?: Database["public"]["Enums"]["campanha_psicossocial_status"]
          tenant_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          anonimo?: boolean
          blocos_dinamicos?: Json | null
          campanha_anterior_id?: string | null
          cargos_ids?: string[] | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_fim?: string
          data_inicio?: string
          departamentos_ids?: string[] | null
          descricao?: string | null
          evento_gatilho_id?: string | null
          evento_gatilho_tipo?: string | null
          id?: string
          mensagem_institucional?: string | null
          motivo_extraordinaria?: string | null
          nome?: string
          periodicidade?: string | null
          permite_identificacao_voluntaria?: boolean
          politica_uso_dados?: string | null
          status?: Database["public"]["Enums"]["campanha_psicossocial_status"]
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionario_psicossocial_campanhas_campanha_anterior_id_fkey"
            columns: ["campanha_anterior_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionario_psicossocial_campanhas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      questionario_psicossocial_convites: {
        Row: {
          campanha_id: string
          colaborador_cargo: string | null
          colaborador_cpf: string | null
          colaborador_departamento: string | null
          colaborador_id: string | null
          colaborador_nome: string
          concluido_em: string | null
          created_at: string
          enviado_em: string | null
          enviado_via: Database["public"]["Enums"]["convite_enviado_via"] | null
          id: string
          iniciado_em: string | null
          lembrete_enviado: boolean | null
          status: Database["public"]["Enums"]["convite_psicossocial_status"]
          tenant_id: string
          token: string
          updated_at: string
        }
        Insert: {
          campanha_id: string
          colaborador_cargo?: string | null
          colaborador_cpf?: string | null
          colaborador_departamento?: string | null
          colaborador_id?: string | null
          colaborador_nome: string
          concluido_em?: string | null
          created_at?: string
          enviado_em?: string | null
          enviado_via?:
            | Database["public"]["Enums"]["convite_enviado_via"]
            | null
          id?: string
          iniciado_em?: string | null
          lembrete_enviado?: boolean | null
          status?: Database["public"]["Enums"]["convite_psicossocial_status"]
          tenant_id: string
          token: string
          updated_at?: string
        }
        Update: {
          campanha_id?: string
          colaborador_cargo?: string | null
          colaborador_cpf?: string | null
          colaborador_departamento?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string
          concluido_em?: string | null
          created_at?: string
          enviado_em?: string | null
          enviado_via?:
            | Database["public"]["Enums"]["convite_enviado_via"]
            | null
          id?: string
          iniciado_em?: string | null
          lembrete_enviado?: boolean | null
          status?: Database["public"]["Enums"]["convite_psicossocial_status"]
          tenant_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionario_psicossocial_convites_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionario_psicossocial_convites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      questionario_psicossocial_respostas: {
        Row: {
          campanha_id: string
          colaborador_id: string | null
          concluido_em: string | null
          convite_id: string
          created_at: string
          id: string
          identificacao_voluntaria: boolean
          indicadores: Json | null
          ip_address: string | null
          respostas: Json
          tempo_resposta_segundos: number | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          campanha_id: string
          colaborador_id?: string | null
          concluido_em?: string | null
          convite_id: string
          created_at?: string
          id?: string
          identificacao_voluntaria?: boolean
          indicadores?: Json | null
          ip_address?: string | null
          respostas?: Json
          tempo_resposta_segundos?: number | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          campanha_id?: string
          colaborador_id?: string | null
          concluido_em?: string | null
          convite_id?: string
          created_at?: string
          id?: string
          identificacao_voluntaria?: boolean
          indicadores?: Json | null
          ip_address?: string | null
          respostas?: Json
          tempo_resposta_segundos?: number | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questionario_psicossocial_respostas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionario_psicossocial_respostas_convite_id_fkey"
            columns: ["convite_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_convites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionario_psicossocial_respostas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      superadmins: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id?: string
          nome?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          ativo: boolean
          configuracoes: Json | null
          created_at: string
          id: string
          logo_url: string | null
          nome: string
          plano: Database["public"]["Enums"]["tenant_plan"]
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          configuracoes?: Json | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nome: string
          plano?: Database["public"]["Enums"]["tenant_plan"]
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          configuracoes?: Json | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nome?: string
          plano?: Database["public"]["Enums"]["tenant_plan"]
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_tenant_id: { Args: never; Returns: string }
      has_minimum_role: {
        Args: {
          _minimum_role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      acao_gut_prioridade: "baixo" | "medio" | "urgente" | "imediato"
      acao_prioridade: "baixa" | "media" | "alta" | "urgente"
      acao_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      admissao_status:
        | "rascunho"
        | "aguardando_documentos"
        | "em_analise"
        | "aprovado"
        | "reprovado"
        | "concluido"
      afastamento_status: "ativo" | "encerrado" | "beneficio_inss"
      app_role: "owner" | "admin" | "manager" | "user" | "superadmin"
      aptidao_ocupacional:
        | "apto"
        | "apto_com_restricoes"
        | "inapto_temporario"
        | "inapto"
      atestado_subtipo_assistencial:
        | "medico"
        | "odontologico"
        | "psicologico"
        | "comparecimento"
        | "acompanhante"
        | "acidente"
      atestado_subtipo_ocupacional:
        | "admissional"
        | "periodico"
        | "retorno_trabalho"
        | "mudanca_funcao"
        | "demissional"
      atestado_tipo: "assistencial" | "ocupacional"
      avaliacao_ciclo_status: "rascunho" | "ativo" | "encerrado" | "analisando"
      avaliacao_tipo: "simples" | "360"
      beneficio_inss_especie: "b31" | "b91"
      campanha_psicossocial_status: "rascunho" | "ativa" | "encerrada"
      convite_enviado_via: "link" | "qrcode" | "whatsapp" | "email"
      convite_psicossocial_status:
        | "pendente"
        | "iniciado"
        | "concluido"
        | "expirado"
      documento_status: "pendente" | "enviado" | "aprovado" | "rejeitado"
      entrega_status: "ativa" | "devolvido" | "extraviado" | "vencido"
      epi_status:
        | "disponivel"
        | "em_uso"
        | "danificado"
        | "vencido"
        | "descartado"
      ergonomia_categoria:
        | "organizacao_trabalho"
        | "mobiliario"
        | "equipamentos"
        | "condicoes_ambientais"
        | "levantamento_cargas"
        | "aet"
      ergonomia_eixo: "fisico" | "cognitivo" | "organizacional"
      ergonomia_status:
        | "atendido"
        | "parcial"
        | "nao_atendido"
        | "nao_aplicavel"
      evento_saude_status: "aberto" | "em_acompanhamento" | "encerrado"
      grupo_clinico:
        | "mental"
        | "osteomuscular"
        | "respiratorio"
        | "cardiovascular"
        | "digestivo"
        | "dermatologico"
        | "neurologico"
        | "infeccioso"
        | "oncologico"
        | "endocrino"
        | "outro"
      meta_periodo: "mensal" | "trimestral" | "semestral" | "anual"
      meta_status:
        | "nao_iniciada"
        | "em_andamento"
        | "concluida"
        | "cancelada"
        | "atrasada"
      nexo_trabalho: "nao" | "em_analise" | "sim"
      okr_tipo: "percentual" | "quantidade" | "binario" | "monetario"
      resposta_status: "pendente" | "em_andamento" | "concluida"
      risco_severidade: "baixo" | "medio" | "alto" | "critico"
      tarefa_status: "nao_iniciada" | "em_andamento" | "bloqueada" | "concluida"
      tenant_plan: "free" | "starter" | "professional" | "enterprise"
      tipo_avaliador: "auto" | "gestor" | "par" | "subordinado"
      workflow_status: "pendente" | "aprovado" | "rejeitado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acao_gut_prioridade: ["baixo", "medio", "urgente", "imediato"],
      acao_prioridade: ["baixa", "media", "alta", "urgente"],
      acao_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      admissao_status: [
        "rascunho",
        "aguardando_documentos",
        "em_analise",
        "aprovado",
        "reprovado",
        "concluido",
      ],
      afastamento_status: ["ativo", "encerrado", "beneficio_inss"],
      app_role: ["owner", "admin", "manager", "user", "superadmin"],
      aptidao_ocupacional: [
        "apto",
        "apto_com_restricoes",
        "inapto_temporario",
        "inapto",
      ],
      atestado_subtipo_assistencial: [
        "medico",
        "odontologico",
        "psicologico",
        "comparecimento",
        "acompanhante",
        "acidente",
      ],
      atestado_subtipo_ocupacional: [
        "admissional",
        "periodico",
        "retorno_trabalho",
        "mudanca_funcao",
        "demissional",
      ],
      atestado_tipo: ["assistencial", "ocupacional"],
      avaliacao_ciclo_status: ["rascunho", "ativo", "encerrado", "analisando"],
      avaliacao_tipo: ["simples", "360"],
      beneficio_inss_especie: ["b31", "b91"],
      campanha_psicossocial_status: ["rascunho", "ativa", "encerrada"],
      convite_enviado_via: ["link", "qrcode", "whatsapp", "email"],
      convite_psicossocial_status: [
        "pendente",
        "iniciado",
        "concluido",
        "expirado",
      ],
      documento_status: ["pendente", "enviado", "aprovado", "rejeitado"],
      entrega_status: ["ativa", "devolvido", "extraviado", "vencido"],
      epi_status: [
        "disponivel",
        "em_uso",
        "danificado",
        "vencido",
        "descartado",
      ],
      ergonomia_categoria: [
        "organizacao_trabalho",
        "mobiliario",
        "equipamentos",
        "condicoes_ambientais",
        "levantamento_cargas",
        "aet",
      ],
      ergonomia_eixo: ["fisico", "cognitivo", "organizacional"],
      ergonomia_status: [
        "atendido",
        "parcial",
        "nao_atendido",
        "nao_aplicavel",
      ],
      evento_saude_status: ["aberto", "em_acompanhamento", "encerrado"],
      grupo_clinico: [
        "mental",
        "osteomuscular",
        "respiratorio",
        "cardiovascular",
        "digestivo",
        "dermatologico",
        "neurologico",
        "infeccioso",
        "oncologico",
        "endocrino",
        "outro",
      ],
      meta_periodo: ["mensal", "trimestral", "semestral", "anual"],
      meta_status: [
        "nao_iniciada",
        "em_andamento",
        "concluida",
        "cancelada",
        "atrasada",
      ],
      nexo_trabalho: ["nao", "em_analise", "sim"],
      okr_tipo: ["percentual", "quantidade", "binario", "monetario"],
      resposta_status: ["pendente", "em_andamento", "concluida"],
      risco_severidade: ["baixo", "medio", "alto", "critico"],
      tarefa_status: ["nao_iniciada", "em_andamento", "bloqueada", "concluida"],
      tenant_plan: ["free", "starter", "professional", "enterprise"],
      tipo_avaliador: ["auto", "gestor", "par", "subordinado"],
      workflow_status: ["pendente", "aprovado", "rejeitado"],
    },
  },
} as const
