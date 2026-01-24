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
      humor_diario: {
        Row: {
          created_at: string
          data: string
          emoji: string
          humor: string
          id: string
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
      ouvidoria: {
        Row: {
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
    }
    Enums: {
      admissao_status:
        | "rascunho"
        | "aguardando_documentos"
        | "em_analise"
        | "aprovado"
        | "reprovado"
        | "concluido"
      app_role: "owner" | "admin" | "manager" | "user"
      documento_status: "pendente" | "enviado" | "aprovado" | "rejeitado"
      entrega_status: "ativa" | "devolvido" | "extraviado" | "vencido"
      epi_status:
        | "disponivel"
        | "em_uso"
        | "danificado"
        | "vencido"
        | "descartado"
      tenant_plan: "free" | "starter" | "professional" | "enterprise"
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
      admissao_status: [
        "rascunho",
        "aguardando_documentos",
        "em_analise",
        "aprovado",
        "reprovado",
        "concluido",
      ],
      app_role: ["owner", "admin", "manager", "user"],
      documento_status: ["pendente", "enviado", "aprovado", "rejeitado"],
      entrega_status: ["ativa", "devolvido", "extraviado", "vencido"],
      epi_status: [
        "disponivel",
        "em_uso",
        "danificado",
        "vencido",
        "descartado",
      ],
      tenant_plan: ["free", "starter", "professional", "enterprise"],
      workflow_status: ["pendente", "aprovado", "rejeitado"],
    },
  },
} as const
