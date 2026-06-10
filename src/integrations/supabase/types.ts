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
      academia_aulas: {
        Row: {
          conteudo_texto: string | null
          created_at: string | null
          descricao: string | null
          duracao: string | null
          id: string
          link_externo: string | null
          material_complementar: Json | null
          modulo_id: string
          obrigatoria: boolean | null
          ordem: number | null
          tenant_id: string
          thumbnail: string | null
          tipo: string | null
          titulo: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          conteudo_texto?: string | null
          created_at?: string | null
          descricao?: string | null
          duracao?: string | null
          id?: string
          link_externo?: string | null
          material_complementar?: Json | null
          modulo_id: string
          obrigatoria?: boolean | null
          ordem?: number | null
          tenant_id: string
          thumbnail?: string | null
          tipo?: string | null
          titulo: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          conteudo_texto?: string | null
          created_at?: string | null
          descricao?: string | null
          duracao?: string | null
          id?: string
          link_externo?: string | null
          material_complementar?: Json | null
          modulo_id?: string
          obrigatoria?: boolean | null
          ordem?: number | null
          tenant_id?: string
          thumbnail?: string | null
          tipo?: string | null
          titulo?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academia_aulas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "academia_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academia_aulas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_badges: {
        Row: {
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          tenant_id: string
          treinamento_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          tenant_id: string
          treinamento_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          tenant_id?: string
          treinamento_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_badges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academia_badges_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "academia_treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_categorias: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
          slug: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
          slug: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          slug?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academia_categorias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_favoritos: {
        Row: {
          created_at: string | null
          id: string
          tenant_id: string
          treinamento_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          tenant_id: string
          treinamento_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          tenant_id?: string
          treinamento_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_favoritos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academia_favoritos_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "academia_treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_modulos: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
          tenant_id: string
          treinamento_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
          tenant_id: string
          treinamento_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          tenant_id?: string
          treinamento_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academia_modulos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academia_modulos_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "academia_treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_progresso: {
        Row: {
          aula_id: string
          concluida: boolean | null
          concluida_em: string | null
          created_at: string | null
          id: string
          tenant_id: string
          treinamento_id: string
          user_id: string
        }
        Insert: {
          aula_id: string
          concluida?: boolean | null
          concluida_em?: string | null
          created_at?: string | null
          id?: string
          tenant_id: string
          treinamento_id: string
          user_id: string
        }
        Update: {
          aula_id?: string
          concluida?: boolean | null
          concluida_em?: string | null
          created_at?: string | null
          id?: string
          tenant_id?: string
          treinamento_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_progresso_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "academia_aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academia_progresso_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academia_progresso_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "academia_treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_treinamentos: {
        Row: {
          banner: string | null
          categoria_id: string | null
          created_at: string | null
          descricao_completa: string | null
          descricao_curta: string | null
          destaque: boolean | null
          duracao_estimada: string | null
          id: string
          imagem_capa: string | null
          instrutor: string | null
          nivel: string | null
          ordem: number | null
          slug: string
          status: string | null
          subtitulo: string | null
          tags: string[] | null
          tenant_id: string
          titulo: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          banner?: string | null
          categoria_id?: string | null
          created_at?: string | null
          descricao_completa?: string | null
          descricao_curta?: string | null
          destaque?: boolean | null
          duracao_estimada?: string | null
          id?: string
          imagem_capa?: string | null
          instrutor?: string | null
          nivel?: string | null
          ordem?: number | null
          slug: string
          status?: string | null
          subtitulo?: string | null
          tags?: string[] | null
          tenant_id: string
          titulo: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          banner?: string | null
          categoria_id?: string | null
          created_at?: string | null
          descricao_completa?: string | null
          descricao_curta?: string | null
          destaque?: boolean | null
          duracao_estimada?: string | null
          id?: string
          imagem_capa?: string | null
          instrutor?: string | null
          nivel?: string | null
          ordem?: number | null
          slug?: string
          status?: string | null
          subtitulo?: string | null
          tags?: string[] | null
          tenant_id?: string
          titulo?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academia_treinamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "academia_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academia_treinamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_xp: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          pontos: number | null
          referencia_id: string | null
          tenant_id: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          pontos?: number | null
          referencia_id?: string | null
          tenant_id: string
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          pontos?: number | null
          referencia_id?: string | null
          tenant_id?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_xp_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
          aviso_previo_cumprido: boolean | null
          bairro: string | null
          banco: string | null
          bate_ponto: boolean
          cargo: string
          cbo: string | null
          celular: string | null
          centro_custo: string | null
          cep: string | null
          chave_conectividade: string | null
          chave_pix: string | null
          cidade: string | null
          classificacao_interna: string | null
          complemento: string | null
          conta: string | null
          cpf: string
          created_at: string
          criado_por: string | null
          crm_exame_demissional: string | null
          data_admissao: string | null
          data_aviso_previo: string | null
          data_desligamento: string | null
          data_exame_demissional: string | null
          data_homologacao: string | null
          data_nascimento: string | null
          departamento: string | null
          dependentes_irrf: number | null
          desligado_por: string | null
          desligado_por_nome: string | null
          dias_aviso_previo: number | null
          email: string | null
          empresa_id: string | null
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
          foto_url: string | null
          genero: string | null
          gestor_imediato: string | null
          id: string
          inativado_em: string | null
          inativado_por: string | null
          inativo: boolean
          jornada_trabalho: string | null
          matricula_esocial: string | null
          medico_exame_demissional: string | null
          motivo_desligamento: string | null
          motivo_inativacao: string | null
          multa_fgts: boolean | null
          nacionalidade: string | null
          naturalidade: string | null
          nome_completo: string
          nome_mae: string | null
          nome_pai: string | null
          numero: string | null
          observacoes_desligamento: string | null
          onboarding_status: string | null
          onboarding_token: string | null
          resultado_exame_demissional: string | null
          rg: string | null
          salario: number | null
          seguro_desemprego_elegivel: boolean | null
          sindicato_homologacao: string | null
          status: Database["public"]["Enums"]["admissao_status"]
          telefone: string | null
          tenant_id: string
          tipo_aviso_previo: string | null
          tipo_conta: string | null
          tipo_contrato: string | null
          tipo_vinculo: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          aviso_previo_cumprido?: boolean | null
          bairro?: string | null
          banco?: string | null
          bate_ponto?: boolean
          cargo: string
          cbo?: string | null
          celular?: string | null
          centro_custo?: string | null
          cep?: string | null
          chave_conectividade?: string | null
          chave_pix?: string | null
          cidade?: string | null
          classificacao_interna?: string | null
          complemento?: string | null
          conta?: string | null
          cpf: string
          created_at?: string
          criado_por?: string | null
          crm_exame_demissional?: string | null
          data_admissao?: string | null
          data_aviso_previo?: string | null
          data_desligamento?: string | null
          data_exame_demissional?: string | null
          data_homologacao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          dependentes_irrf?: number | null
          desligado_por?: string | null
          desligado_por_nome?: string | null
          dias_aviso_previo?: number | null
          email?: string | null
          empresa_id?: string | null
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
          foto_url?: string | null
          genero?: string | null
          gestor_imediato?: string | null
          id?: string
          inativado_em?: string | null
          inativado_por?: string | null
          inativo?: boolean
          jornada_trabalho?: string | null
          matricula_esocial?: string | null
          medico_exame_demissional?: string | null
          motivo_desligamento?: string | null
          motivo_inativacao?: string | null
          multa_fgts?: boolean | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_completo: string
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          observacoes_desligamento?: string | null
          onboarding_status?: string | null
          onboarding_token?: string | null
          resultado_exame_demissional?: string | null
          rg?: string | null
          salario?: number | null
          seguro_desemprego_elegivel?: boolean | null
          sindicato_homologacao?: string | null
          status?: Database["public"]["Enums"]["admissao_status"]
          telefone?: string | null
          tenant_id: string
          tipo_aviso_previo?: string | null
          tipo_conta?: string | null
          tipo_contrato?: string | null
          tipo_vinculo?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          aviso_previo_cumprido?: boolean | null
          bairro?: string | null
          banco?: string | null
          bate_ponto?: boolean
          cargo?: string
          cbo?: string | null
          celular?: string | null
          centro_custo?: string | null
          cep?: string | null
          chave_conectividade?: string | null
          chave_pix?: string | null
          cidade?: string | null
          classificacao_interna?: string | null
          complemento?: string | null
          conta?: string | null
          cpf?: string
          created_at?: string
          criado_por?: string | null
          crm_exame_demissional?: string | null
          data_admissao?: string | null
          data_aviso_previo?: string | null
          data_desligamento?: string | null
          data_exame_demissional?: string | null
          data_homologacao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          dependentes_irrf?: number | null
          desligado_por?: string | null
          desligado_por_nome?: string | null
          dias_aviso_previo?: number | null
          email?: string | null
          empresa_id?: string | null
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
          foto_url?: string | null
          genero?: string | null
          gestor_imediato?: string | null
          id?: string
          inativado_em?: string | null
          inativado_por?: string | null
          inativo?: boolean
          jornada_trabalho?: string | null
          matricula_esocial?: string | null
          medico_exame_demissional?: string | null
          motivo_desligamento?: string | null
          motivo_inativacao?: string | null
          multa_fgts?: boolean | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_completo?: string
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          observacoes_desligamento?: string | null
          onboarding_status?: string | null
          onboarding_token?: string | null
          resultado_exame_demissional?: string | null
          rg?: string | null
          salario?: number | null
          seguro_desemprego_elegivel?: boolean | null
          sindicato_homologacao?: string | null
          status?: Database["public"]["Enums"]["admissao_status"]
          telefone?: string | null
          tenant_id?: string
          tipo_aviso_previo?: string | null
          tipo_conta?: string | null
          tipo_contrato?: string | null
          tipo_vinculo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admissoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      advertencia_links: {
        Row: {
          created_at: string
          destinatario_email: string
          destinatario_nome: string | null
          documento_nome: string | null
          documento_url: string | null
          enviado_em: string | null
          expira_em: string
          formalizado_em: string | null
          id: string
          ocorrencia_id: string
          status: Database["public"]["Enums"]["advertencia_status"]
          tenant_id: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destinatario_email: string
          destinatario_nome?: string | null
          documento_nome?: string | null
          documento_url?: string | null
          enviado_em?: string | null
          expira_em?: string
          formalizado_em?: string | null
          id?: string
          ocorrencia_id: string
          status?: Database["public"]["Enums"]["advertencia_status"]
          tenant_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destinatario_email?: string
          destinatario_nome?: string | null
          documento_nome?: string | null
          documento_url?: string | null
          enviado_em?: string | null
          expira_em?: string
          formalizado_em?: string | null
          id?: string
          ocorrencia_id?: string
          status?: Database["public"]["Enums"]["advertencia_status"]
          tenant_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertencia_links_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advertencia_links_tenant_id_fkey"
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
          atualizado_por: string | null
          beneficio_inss_id: string | null
          cargo_id: string | null
          colaborador_cpf: string | null
          colaborador_id: string | null
          colaborador_nome: string
          created_at: string
          criado_por: string | null
          data_atestado: string | null
          data_fim: string | null
          data_inicio: string
          dias_totais: number | null
          empresa_id: string | null
          evento_saude_id: string | null
          gestor_id: string | null
          id: string
          motivo_principal: Database["public"]["Enums"]["grupo_clinico"] | null
          nexo_trabalho: Database["public"]["Enums"]["nexo_trabalho"] | null
          observacoes: string | null
          prazo_indeterminado: boolean | null
          setor_id: string | null
          status: Database["public"]["Enums"]["afastamento_status"]
          status_geral_new:
            | Database["public"]["Enums"]["afastamento_status_geral"]
            | null
          tenant_id: string
          tipo_principal_new:
            | Database["public"]["Enums"]["afastamento_tipo_principal"]
            | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          alerta_15_dias?: boolean | null
          alerta_30_dias?: boolean | null
          aso_retorno_id?: string | null
          aso_retorno_pendente?: boolean | null
          atualizado_por?: string | null
          beneficio_inss_id?: string | null
          cargo_id?: string | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome: string
          created_at?: string
          criado_por?: string | null
          data_atestado?: string | null
          data_fim?: string | null
          data_inicio: string
          dias_totais?: number | null
          empresa_id?: string | null
          evento_saude_id?: string | null
          gestor_id?: string | null
          id?: string
          motivo_principal?: Database["public"]["Enums"]["grupo_clinico"] | null
          nexo_trabalho?: Database["public"]["Enums"]["nexo_trabalho"] | null
          observacoes?: string | null
          prazo_indeterminado?: boolean | null
          setor_id?: string | null
          status?: Database["public"]["Enums"]["afastamento_status"]
          status_geral_new?:
            | Database["public"]["Enums"]["afastamento_status_geral"]
            | null
          tenant_id: string
          tipo_principal_new?:
            | Database["public"]["Enums"]["afastamento_tipo_principal"]
            | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          alerta_15_dias?: boolean | null
          alerta_30_dias?: boolean | null
          aso_retorno_id?: string | null
          aso_retorno_pendente?: boolean | null
          atualizado_por?: string | null
          beneficio_inss_id?: string | null
          cargo_id?: string | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string
          created_at?: string
          criado_por?: string | null
          data_atestado?: string | null
          data_fim?: string | null
          data_inicio?: string
          dias_totais?: number | null
          empresa_id?: string | null
          evento_saude_id?: string | null
          gestor_id?: string | null
          id?: string
          motivo_principal?: Database["public"]["Enums"]["grupo_clinico"] | null
          nexo_trabalho?: Database["public"]["Enums"]["nexo_trabalho"] | null
          observacoes?: string | null
          prazo_indeterminado?: boolean | null
          setor_id?: string | null
          status?: Database["public"]["Enums"]["afastamento_status"]
          status_geral_new?:
            | Database["public"]["Enums"]["afastamento_status_geral"]
            | null
          tenant_id?: string
          tipo_principal_new?:
            | Database["public"]["Enums"]["afastamento_tipo_principal"]
            | null
          unidade_id?: string | null
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
            foreignKeyName: "afastamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
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
      afastamentos_cat: {
        Row: {
          afastamento_id: string
          agente_causador: string | null
          cat_aplicavel: boolean | null
          created_at: string | null
          data_acidente: string | null
          descricao_acidente: string | null
          hora_acidente: string | null
          id: string
          justificativa_nao_aplicavel: string | null
          local_acidente: string | null
          parte_corpo: string | null
          protocolo_esocial: string | null
          status_cat: string | null
          tenant_id: string
          testemunhas: Json | null
          tipo_cat: string | null
          updated_at: string | null
        }
        Insert: {
          afastamento_id: string
          agente_causador?: string | null
          cat_aplicavel?: boolean | null
          created_at?: string | null
          data_acidente?: string | null
          descricao_acidente?: string | null
          hora_acidente?: string | null
          id?: string
          justificativa_nao_aplicavel?: string | null
          local_acidente?: string | null
          parte_corpo?: string | null
          protocolo_esocial?: string | null
          status_cat?: string | null
          tenant_id: string
          testemunhas?: Json | null
          tipo_cat?: string | null
          updated_at?: string | null
        }
        Update: {
          afastamento_id?: string
          agente_causador?: string | null
          cat_aplicavel?: boolean | null
          created_at?: string | null
          data_acidente?: string | null
          descricao_acidente?: string | null
          hora_acidente?: string | null
          id?: string
          justificativa_nao_aplicavel?: string | null
          local_acidente?: string | null
          parte_corpo?: string | null
          protocolo_esocial?: string | null
          status_cat?: string | null
          tenant_id?: string
          testemunhas?: Json | null
          tipo_cat?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_cat_afastamento_id_fkey"
            columns: ["afastamento_id"]
            isOneToOne: false
            referencedRelation: "afastamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      afastamentos_esocial: {
        Row: {
          afastamento_id: string
          aplicavel: boolean | null
          created_at: string | null
          data_envio: string | null
          evento: string
          id: string
          motivo_rejeicao: string | null
          prazo: string | null
          protocolo: string | null
          responsavel_id: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          afastamento_id: string
          aplicavel?: boolean | null
          created_at?: string | null
          data_envio?: string | null
          evento: string
          id?: string
          motivo_rejeicao?: string | null
          prazo?: string | null
          protocolo?: string | null
          responsavel_id?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          afastamento_id?: string
          aplicavel?: boolean | null
          created_at?: string | null
          data_envio?: string | null
          evento?: string
          id?: string
          motivo_rejeicao?: string | null
          prazo?: string | null
          protocolo?: string | null
          responsavel_id?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_esocial_afastamento_id_fkey"
            columns: ["afastamento_id"]
            isOneToOne: false
            referencedRelation: "afastamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      afastamentos_fap: {
        Row: {
          afastamento_id: string
          created_at: string | null
          id: string
          impacta_fap: boolean | null
          motivo_impacto: string | null
          nivel_risco: string | null
          observacao_previdenciaria: string | null
          status_analise: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          afastamento_id: string
          created_at?: string | null
          id?: string
          impacta_fap?: boolean | null
          motivo_impacto?: string | null
          nivel_risco?: string | null
          observacao_previdenciaria?: string | null
          status_analise?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          afastamento_id?: string
          created_at?: string | null
          id?: string
          impacta_fap?: boolean | null
          motivo_impacto?: string | null
          nivel_risco?: string | null
          observacao_previdenciaria?: string | null
          status_analise?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_fap_afastamento_id_fkey"
            columns: ["afastamento_id"]
            isOneToOne: false
            referencedRelation: "afastamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      afastamentos_marcadores: {
        Row: {
          afastamento_id: string
          created_at: string | null
          criado_automaticamente: boolean | null
          id: string
          marcador: string
          origem: string | null
          tenant_id: string
        }
        Insert: {
          afastamento_id: string
          created_at?: string | null
          criado_automaticamente?: boolean | null
          id?: string
          marcador: string
          origem?: string | null
          tenant_id: string
        }
        Update: {
          afastamento_id?: string
          created_at?: string | null
          criado_automaticamente?: boolean | null
          id?: string
          marcador?: string
          origem?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_marcadores_afastamento_id_fkey"
            columns: ["afastamento_id"]
            isOneToOne: false
            referencedRelation: "afastamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      afastamentos_ntep: {
        Row: {
          afastamento_id: string
          cid: string | null
          cnae: string | null
          created_at: string | null
          data_decisao: string | null
          decisao: string | null
          fundamento: string | null
          id: string
          justificativa: string | null
          responsavel_id: string | null
          status_ntep: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          afastamento_id: string
          cid?: string | null
          cnae?: string | null
          created_at?: string | null
          data_decisao?: string | null
          decisao?: string | null
          fundamento?: string | null
          id?: string
          justificativa?: string | null
          responsavel_id?: string | null
          status_ntep?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          afastamento_id?: string
          cid?: string | null
          cnae?: string | null
          created_at?: string | null
          data_decisao?: string | null
          decisao?: string | null
          fundamento?: string | null
          id?: string
          justificativa?: string | null
          responsavel_id?: string | null
          status_ntep?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_ntep_afastamento_id_fkey"
            columns: ["afastamento_id"]
            isOneToOne: false
            referencedRelation: "afastamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      afastamentos_pendencias: {
        Row: {
          afastamento_id: string
          created_at: string | null
          descricao: string | null
          id: string
          prazo: string | null
          prioridade: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          responsavel_id: string | null
          status: string | null
          tenant_id: string
          tipo_pendencia: string
          updated_at: string | null
        }
        Insert: {
          afastamento_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          prazo?: string | null
          prioridade?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          responsavel_id?: string | null
          status?: string | null
          tenant_id: string
          tipo_pendencia: string
          updated_at?: string | null
        }
        Update: {
          afastamento_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          prazo?: string | null
          prioridade?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          responsavel_id?: string | null
          status?: string | null
          tenant_id?: string
          tipo_pendencia?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_pendencias_afastamento_id_fkey"
            columns: ["afastamento_id"]
            isOneToOne: false
            referencedRelation: "afastamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      afastamentos_previdenciario: {
        Row: {
          afastamento_id: string
          created_at: string | null
          data_alta: string | null
          data_cessacao_prevista: string | null
          data_inicio_beneficio: string | null
          encaminhado_inss: boolean | null
          especie_beneficio: string | null
          houve_prorrogacao: boolean | null
          id: string
          numero_beneficio: string | null
          status_previdenciario: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          afastamento_id: string
          created_at?: string | null
          data_alta?: string | null
          data_cessacao_prevista?: string | null
          data_inicio_beneficio?: string | null
          encaminhado_inss?: boolean | null
          especie_beneficio?: string | null
          houve_prorrogacao?: boolean | null
          id?: string
          numero_beneficio?: string | null
          status_previdenciario?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          afastamento_id?: string
          created_at?: string | null
          data_alta?: string | null
          data_cessacao_prevista?: string | null
          data_inicio_beneficio?: string | null
          encaminhado_inss?: boolean | null
          especie_beneficio?: string | null
          houve_prorrogacao?: boolean | null
          id?: string
          numero_beneficio?: string | null
          status_previdenciario?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_previdenciario_afastamento_id_fkey"
            columns: ["afastamento_id"]
            isOneToOne: false
            referencedRelation: "afastamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      afastamentos_retorno: {
        Row: {
          afastamento_id: string
          alta_registrada: boolean | null
          created_at: string | null
          data_alta: string | null
          data_prevista_retorno: string | null
          entrevista_obrigatoria: boolean | null
          exame_retorno_obrigatorio: boolean | null
          id: string
          resultado_retorno: string | null
          status_aso_retorno: string | null
          status_entrevista: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          afastamento_id: string
          alta_registrada?: boolean | null
          created_at?: string | null
          data_alta?: string | null
          data_prevista_retorno?: string | null
          entrevista_obrigatoria?: boolean | null
          exame_retorno_obrigatorio?: boolean | null
          id?: string
          resultado_retorno?: string | null
          status_aso_retorno?: string | null
          status_entrevista?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          afastamento_id?: string
          alta_registrada?: boolean | null
          created_at?: string | null
          data_alta?: string | null
          data_prevista_retorno?: string | null
          entrevista_obrigatoria?: boolean | null
          exame_retorno_obrigatorio?: boolean | null
          id?: string
          resultado_retorno?: string | null
          status_aso_retorno?: string | null
          status_entrevista?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_retorno_afastamento_id_fkey"
            columns: ["afastamento_id"]
            isOneToOne: false
            referencedRelation: "afastamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      afastamentos_saude: {
        Row: {
          afastamento_id: string
          arquivo_atestado_url: string | null
          cid_capitulo: string | null
          cid_complementar: string | null
          cid_descricao: string | null
          cid_grupo: string | null
          cid_principal: string | null
          created_at: string | null
          especialidade: string | null
          id: string
          profissional_conselho: string | null
          profissional_nome: string | null
          profissional_numero: string | null
          profissional_uf: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          afastamento_id: string
          arquivo_atestado_url?: string | null
          cid_capitulo?: string | null
          cid_complementar?: string | null
          cid_descricao?: string | null
          cid_grupo?: string | null
          cid_principal?: string | null
          created_at?: string | null
          especialidade?: string | null
          id?: string
          profissional_conselho?: string | null
          profissional_nome?: string | null
          profissional_numero?: string | null
          profissional_uf?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          afastamento_id?: string
          arquivo_atestado_url?: string | null
          cid_capitulo?: string | null
          cid_complementar?: string | null
          cid_descricao?: string | null
          cid_grupo?: string | null
          cid_principal?: string | null
          created_at?: string | null
          especialidade?: string | null
          id?: string
          profissional_conselho?: string | null
          profissional_nome?: string | null
          profissional_numero?: string | null
          profissional_uf?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_saude_afastamento_id_fkey"
            columns: ["afastamento_id"]
            isOneToOne: false
            referencedRelation: "afastamentos"
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
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
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
            foreignKeyName: "atestados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          module: string
          target_id: string | null
          target_name: string | null
          target_type: string | null
          tenant_id: string
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module: string
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
          tenant_id: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module?: string
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
          tenant_id?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
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
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
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
            foreignKeyName: "avaliacao_ciclos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
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
      bem_estar_config: {
        Row: {
          ativo: boolean | null
          created_at: string
          eixo: string
          frequencia_pergunta: string | null
          id: string
          pergunta_ativa: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          eixo: string
          frequencia_pergunta?: string | null
          id?: string
          pergunta_ativa?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          eixo?: string
          frequencia_pergunta?: string | null
          id?: string
          pergunta_ativa?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bem_estar_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bem_estar_gratidao: {
        Row: {
          anonimo: boolean | null
          conteudo: string | null
          created_at: string
          id: string
          tenant_id: string
          tipo: string | null
          user_id: string
        }
        Insert: {
          anonimo?: boolean | null
          conteudo?: string | null
          created_at?: string
          id?: string
          tenant_id: string
          tipo?: string | null
          user_id: string
        }
        Update: {
          anonimo?: boolean | null
          conteudo?: string | null
          created_at?: string
          id?: string
          tenant_id?: string
          tipo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bem_estar_gratidao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bem_estar_respostas: {
        Row: {
          anonimo: boolean | null
          created_at: string
          eixo: string
          id: string
          opcao_selecionada: string | null
          tenant_id: string
          tipo: string
          user_id: string
          valor_numerico: number | null
          valor_texto: string | null
        }
        Insert: {
          anonimo?: boolean | null
          created_at?: string
          eixo: string
          id?: string
          opcao_selecionada?: string | null
          tenant_id: string
          tipo: string
          user_id: string
          valor_numerico?: number | null
          valor_texto?: string | null
        }
        Update: {
          anonimo?: boolean | null
          created_at?: string
          eixo?: string
          id?: string
          opcao_selecionada?: string | null
          tenant_id?: string
          tipo?: string
          user_id?: string
          valor_numerico?: number | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bem_estar_respostas_tenant_id_fkey"
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
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
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
            foreignKeyName: "beneficios_colaboradores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
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
      blog_posts: {
        Row: {
          author_id: string | null
          category: string | null
          content: string
          created_at: string | null
          excerpt: string | null
          featured_image: string | null
          id: string
          published_at: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content: string
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          published_at?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content?: string
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          published_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cargo_departamentos: {
        Row: {
          cargo_id: string
          created_at: string
          departamento_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          cargo_id: string
          created_at?: string
          departamento_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          cargo_id?: string
          created_at?: string
          departamento_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargo_departamentos_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_departamentos_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          aposentadoria_especial: boolean
          aposentadoria_especial_anos: number | null
          ativo: boolean
          created_at: string
          criterios_sucesso: string | null
          cultura_esperada: string | null
          departamento_id: string | null
          descricao: string | null
          empresa_id: string | null
          erros_riscos: string | null
          escopo_geral: string | null
          exames_obrigatorios: string[] | null
          faixa_salarial_max: number | null
          faixa_salarial_min: number | null
          ferramentas_cargo: string | null
          id: string
          insalubridade: boolean
          insalubridade_agente_nocivo: string | null
          insalubridade_grau: string | null
          interfaces_cargo: string | null
          nivel: string | null
          nome: string
          objetivo_funcao: string | null
          padroes_execucao: string | null
          periculosidade: boolean
          periculosidade_tipo: string | null
          periodicidade_exame_meses: number | null
          requisitos_experiencia: string | null
          requisitos_formacao: string | null
          responsabilidade: string | null
          subordinacao: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          aposentadoria_especial?: boolean
          aposentadoria_especial_anos?: number | null
          ativo?: boolean
          created_at?: string
          criterios_sucesso?: string | null
          cultura_esperada?: string | null
          departamento_id?: string | null
          descricao?: string | null
          empresa_id?: string | null
          erros_riscos?: string | null
          escopo_geral?: string | null
          exames_obrigatorios?: string[] | null
          faixa_salarial_max?: number | null
          faixa_salarial_min?: number | null
          ferramentas_cargo?: string | null
          id?: string
          insalubridade?: boolean
          insalubridade_agente_nocivo?: string | null
          insalubridade_grau?: string | null
          interfaces_cargo?: string | null
          nivel?: string | null
          nome: string
          objetivo_funcao?: string | null
          padroes_execucao?: string | null
          periculosidade?: boolean
          periculosidade_tipo?: string | null
          periodicidade_exame_meses?: number | null
          requisitos_experiencia?: string | null
          requisitos_formacao?: string | null
          responsabilidade?: string | null
          subordinacao?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          aposentadoria_especial?: boolean
          aposentadoria_especial_anos?: number | null
          ativo?: boolean
          created_at?: string
          criterios_sucesso?: string | null
          cultura_esperada?: string | null
          departamento_id?: string | null
          descricao?: string | null
          empresa_id?: string | null
          erros_riscos?: string | null
          escopo_geral?: string | null
          exames_obrigatorios?: string[] | null
          faixa_salarial_max?: number | null
          faixa_salarial_min?: number | null
          ferramentas_cargo?: string | null
          id?: string
          insalubridade?: boolean
          insalubridade_agente_nocivo?: string | null
          insalubridade_grau?: string | null
          interfaces_cargo?: string | null
          nivel?: string | null
          nome?: string
          objetivo_funcao?: string | null
          padroes_execucao?: string | null
          periculosidade?: boolean
          periculosidade_tipo?: string | null
          periodicidade_exame_meses?: number | null
          requisitos_experiencia?: string | null
          requisitos_formacao?: string | null
          responsabilidade?: string | null
          subordinacao?: string | null
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
            foreignKeyName: "cargos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
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
      cbo_ocupacoes: {
        Row: {
          codigo: string
          created_at: string
          titulo: string
        }
        Insert: {
          codigo: string
          created_at?: string
          titulo: string
        }
        Update: {
          codigo?: string
          created_at?: string
          titulo?: string
        }
        Relationships: []
      }
      colaborador_condicoes_especiais: {
        Row: {
          adicional_aplicado: string | null
          adicional_valor_aplicado: number | null
          alterado_por: string | null
          alterado_por_nome: string | null
          aposentadoria_especial: boolean
          aposentadoria_especial_anos: number | null
          ativo: boolean
          cargo_id: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          data_inicio_exposicao: string | null
          documento_referencia: string | null
          fundamentacao_legal: string | null
          id: string
          insalubridade: boolean
          insalubridade_agente_nocivo: string | null
          insalubridade_base_calculo: string | null
          insalubridade_grau: string | null
          insalubridade_valor_calculado: number | null
          justificativa_alteracao: string | null
          origem: string | null
          periculosidade: boolean
          periculosidade_tipo: string | null
          periculosidade_valor_calculado: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          adicional_aplicado?: string | null
          adicional_valor_aplicado?: number | null
          alterado_por?: string | null
          alterado_por_nome?: string | null
          aposentadoria_especial?: boolean
          aposentadoria_especial_anos?: number | null
          ativo?: boolean
          cargo_id?: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          data_inicio_exposicao?: string | null
          documento_referencia?: string | null
          fundamentacao_legal?: string | null
          id?: string
          insalubridade?: boolean
          insalubridade_agente_nocivo?: string | null
          insalubridade_base_calculo?: string | null
          insalubridade_grau?: string | null
          insalubridade_valor_calculado?: number | null
          justificativa_alteracao?: string | null
          origem?: string | null
          periculosidade?: boolean
          periculosidade_tipo?: string | null
          periculosidade_valor_calculado?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          adicional_aplicado?: string | null
          adicional_valor_aplicado?: number | null
          alterado_por?: string | null
          alterado_por_nome?: string | null
          aposentadoria_especial?: boolean
          aposentadoria_especial_anos?: number | null
          ativo?: boolean
          cargo_id?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          data_inicio_exposicao?: string | null
          documento_referencia?: string | null
          fundamentacao_legal?: string | null
          id?: string
          insalubridade?: boolean
          insalubridade_agente_nocivo?: string | null
          insalubridade_base_calculo?: string | null
          insalubridade_grau?: string | null
          insalubridade_valor_calculado?: number | null
          justificativa_alteracao?: string | null
          origem?: string | null
          periculosidade?: boolean
          periculosidade_tipo?: string | null
          periculosidade_valor_calculado?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_condicoes_especiais_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_condicoes_especiais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      condicoes_especiais_historico: {
        Row: {
          acao: string
          colaborador_id: string
          colaborador_nome: string
          condicao_id: string | null
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          justificativa: string | null
          tenant_id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          colaborador_id: string
          colaborador_nome: string
          condicao_id?: string | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          justificativa?: string | null
          tenant_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          colaborador_id?: string
          colaborador_nome?: string
          condicao_id?: string | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          justificativa?: string | null
          tenant_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "condicoes_especiais_historico_condicao_id_fkey"
            columns: ["condicao_id"]
            isOneToOne: false
            referencedRelation: "colaborador_condicoes_especiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condicoes_especiais_historico_tenant_id_fkey"
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
      contratos_aceite: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["contrato_categoria"]
          corpo_html: string
          created_at: string
          created_by: string | null
          descricao_publica: string | null
          id: string
          limite_assinaturas: number | null
          requer_cnpj: boolean
          requer_cpf: boolean
          requer_endereco: boolean
          requer_geolocalizacao: boolean
          requer_razao_social: boolean
          requer_representante: boolean
          requer_rg: boolean
          requer_selfie: boolean
          requer_telefone: boolean
          titulo: string
          updated_at: string
          validade_dias: number | null
          versao: number
        }
        Insert: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["contrato_categoria"]
          corpo_html: string
          created_at?: string
          created_by?: string | null
          descricao_publica?: string | null
          id?: string
          limite_assinaturas?: number | null
          requer_cnpj?: boolean
          requer_cpf?: boolean
          requer_endereco?: boolean
          requer_geolocalizacao?: boolean
          requer_razao_social?: boolean
          requer_representante?: boolean
          requer_rg?: boolean
          requer_selfie?: boolean
          requer_telefone?: boolean
          titulo: string
          updated_at?: string
          validade_dias?: number | null
          versao?: number
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["contrato_categoria"]
          corpo_html?: string
          created_at?: string
          created_by?: string | null
          descricao_publica?: string | null
          id?: string
          limite_assinaturas?: number | null
          requer_cnpj?: boolean
          requer_cpf?: boolean
          requer_endereco?: boolean
          requer_geolocalizacao?: boolean
          requer_razao_social?: boolean
          requer_representante?: boolean
          requer_rg?: boolean
          requer_selfie?: boolean
          requer_telefone?: boolean
          titulo?: string
          updated_at?: string
          validade_dias?: number | null
          versao?: number
        }
        Relationships: []
      }
      contratos_assinaturas: {
        Row: {
          assinado_em: string | null
          assinatura_imagem: string | null
          contrato_id: string
          created_at: string
          expira_em: string | null
          geo_lat: number | null
          geo_lng: number | null
          hash_documento: string | null
          id: string
          ip_address: string | null
          link_enviado_em: string | null
          link_enviado_para: string | null
          observacoes: string | null
          selfie_imagem: string | null
          signatario_cnpj: string | null
          signatario_cpf: string | null
          signatario_email: string | null
          signatario_endereco: string | null
          signatario_nome: string | null
          signatario_razao_social: string | null
          signatario_representante: string | null
          signatario_rg: string | null
          signatario_telefone: string | null
          status: Database["public"]["Enums"]["contrato_assinatura_status"]
          token: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          assinado_em?: string | null
          assinatura_imagem?: string | null
          contrato_id: string
          created_at?: string
          expira_em?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          hash_documento?: string | null
          id?: string
          ip_address?: string | null
          link_enviado_em?: string | null
          link_enviado_para?: string | null
          observacoes?: string | null
          selfie_imagem?: string | null
          signatario_cnpj?: string | null
          signatario_cpf?: string | null
          signatario_email?: string | null
          signatario_endereco?: string | null
          signatario_nome?: string | null
          signatario_razao_social?: string | null
          signatario_representante?: string | null
          signatario_rg?: string | null
          signatario_telefone?: string | null
          status?: Database["public"]["Enums"]["contrato_assinatura_status"]
          token?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          assinado_em?: string | null
          assinatura_imagem?: string | null
          contrato_id?: string
          created_at?: string
          expira_em?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          hash_documento?: string | null
          id?: string
          ip_address?: string | null
          link_enviado_em?: string | null
          link_enviado_para?: string | null
          observacoes?: string | null
          selfie_imagem?: string | null
          signatario_cnpj?: string | null
          signatario_cpf?: string | null
          signatario_email?: string | null
          signatario_endereco?: string | null
          signatario_nome?: string | null
          signatario_razao_social?: string | null
          signatario_representante?: string | null
          signatario_rg?: string | null
          signatario_telefone?: string | null
          status?: Database["public"]["Enums"]["contrato_assinatura_status"]
          token?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_assinaturas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_aceite"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_experiencia: {
        Row: {
          admissao_id: string | null
          alerta_15_dias_enviado: boolean
          alerta_2_dias_enviado: boolean
          alerta_7_dias_enviado: boolean
          cargo: string | null
          clausula_assecuratoria: boolean
          colaborador_cpf: string
          colaborador_nome: string
          contrato_documento_id: string | null
          created_at: string
          data_admissao: string
          data_efetivacao: string | null
          data_encerramento: string | null
          data_fim_primeiro_periodo: string
          data_fim_prorrogacao: string | null
          data_inicio_prorrogacao: string | null
          data_prorrogacao_registro: string | null
          departamento: string | null
          duracao_primeiro_periodo: number
          duracao_prorrogacao: number | null
          efetivado_por: string | null
          efetivado_por_nome: string | null
          empresa_id: string | null
          encerrado_por: string | null
          encerrado_por_nome: string | null
          filial: string | null
          gestor_imediato: string | null
          id: string
          jornada_trabalho: string | null
          motivo_encerramento: string | null
          observacoes: string | null
          prorrogado: boolean
          prorrogado_por: string | null
          prorrogado_por_nome: string | null
          salario: number | null
          status: string
          tenant_id: string
          termo_efetivacao_documento_id: string | null
          termo_prorrogacao_documento_id: string | null
          termo_rescisao_documento_id: string | null
          tipo_encerramento: string | null
          updated_at: string
        }
        Insert: {
          admissao_id?: string | null
          alerta_15_dias_enviado?: boolean
          alerta_2_dias_enviado?: boolean
          alerta_7_dias_enviado?: boolean
          cargo?: string | null
          clausula_assecuratoria?: boolean
          colaborador_cpf: string
          colaborador_nome: string
          contrato_documento_id?: string | null
          created_at?: string
          data_admissao: string
          data_efetivacao?: string | null
          data_encerramento?: string | null
          data_fim_primeiro_periodo: string
          data_fim_prorrogacao?: string | null
          data_inicio_prorrogacao?: string | null
          data_prorrogacao_registro?: string | null
          departamento?: string | null
          duracao_primeiro_periodo?: number
          duracao_prorrogacao?: number | null
          efetivado_por?: string | null
          efetivado_por_nome?: string | null
          empresa_id?: string | null
          encerrado_por?: string | null
          encerrado_por_nome?: string | null
          filial?: string | null
          gestor_imediato?: string | null
          id?: string
          jornada_trabalho?: string | null
          motivo_encerramento?: string | null
          observacoes?: string | null
          prorrogado?: boolean
          prorrogado_por?: string | null
          prorrogado_por_nome?: string | null
          salario?: number | null
          status?: string
          tenant_id: string
          termo_efetivacao_documento_id?: string | null
          termo_prorrogacao_documento_id?: string | null
          termo_rescisao_documento_id?: string | null
          tipo_encerramento?: string | null
          updated_at?: string
        }
        Update: {
          admissao_id?: string | null
          alerta_15_dias_enviado?: boolean
          alerta_2_dias_enviado?: boolean
          alerta_7_dias_enviado?: boolean
          cargo?: string | null
          clausula_assecuratoria?: boolean
          colaborador_cpf?: string
          colaborador_nome?: string
          contrato_documento_id?: string | null
          created_at?: string
          data_admissao?: string
          data_efetivacao?: string | null
          data_encerramento?: string | null
          data_fim_primeiro_periodo?: string
          data_fim_prorrogacao?: string | null
          data_inicio_prorrogacao?: string | null
          data_prorrogacao_registro?: string | null
          departamento?: string | null
          duracao_primeiro_periodo?: number
          duracao_prorrogacao?: number | null
          efetivado_por?: string | null
          efetivado_por_nome?: string | null
          empresa_id?: string | null
          encerrado_por?: string | null
          encerrado_por_nome?: string | null
          filial?: string | null
          gestor_imediato?: string | null
          id?: string
          jornada_trabalho?: string | null
          motivo_encerramento?: string | null
          observacoes?: string | null
          prorrogado?: boolean
          prorrogado_por?: string | null
          prorrogado_por_nome?: string | null
          salario?: number | null
          status?: string
          tenant_id?: string
          termo_efetivacao_documento_id?: string | null
          termo_prorrogacao_documento_id?: string | null
          termo_rescisao_documento_id?: string | null
          tipo_encerramento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_experiencia_admissao_id_fkey"
            columns: ["admissao_id"]
            isOneToOne: false
            referencedRelation: "admissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_experiencia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_experiencia_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_experiencia_historico: {
        Row: {
          acao: string
          contrato_id: string
          created_at: string
          dados: Json | null
          descricao: string | null
          id: string
          tenant_id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          contrato_id: string
          created_at?: string
          dados?: Json | null
          descricao?: string | null
          id?: string
          tenant_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          contrato_id?: string
          created_at?: string
          dados?: Json | null
          descricao?: string | null
          id?: string
          tenant_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_experiencia_historico_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_experiencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_experiencia_historico_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cultura_acoes: {
        Row: {
          colaborador_id: string | null
          colaborador_nome: string | null
          created_at: string
          cultura_data_id: string | null
          data_execucao: string | null
          data_referencia: string
          descricao: string | null
          empresa_id: string | null
          id: string
          observacoes: string | null
          responsavel: string | null
          responsavel_nome: string | null
          status: string
          tenant_id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          colaborador_id?: string | null
          colaborador_nome?: string | null
          created_at?: string
          cultura_data_id?: string | null
          data_execucao?: string | null
          data_referencia: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          responsavel?: string | null
          responsavel_nome?: string | null
          status?: string
          tenant_id: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          colaborador_id?: string | null
          colaborador_nome?: string | null
          created_at?: string
          cultura_data_id?: string | null
          data_execucao?: string | null
          data_referencia?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          responsavel?: string | null
          responsavel_nome?: string | null
          status?: string
          tenant_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cultura_acoes_cultura_data_id_fkey"
            columns: ["cultura_data_id"]
            isOneToOne: false
            referencedRelation: "cultura_datas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cultura_acoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cultura_acoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cultura_config: {
        Row: {
          aniversario_ativo: boolean
          created_at: string
          dia_profissao_ativo: boolean
          dias_antecedencia_acao: number
          empresa_id: string | null
          folga_permitida: boolean
          id: string
          limite_valor_presente: number | null
          presente_padrao: boolean
          responsavel_padrao: string | null
          tempo_casa_ativo: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          aniversario_ativo?: boolean
          created_at?: string
          dia_profissao_ativo?: boolean
          dias_antecedencia_acao?: number
          empresa_id?: string | null
          folga_permitida?: boolean
          id?: string
          limite_valor_presente?: number | null
          presente_padrao?: boolean
          responsavel_padrao?: string | null
          tempo_casa_ativo?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          aniversario_ativo?: boolean
          created_at?: string
          dia_profissao_ativo?: boolean
          dias_antecedencia_acao?: number
          empresa_id?: string | null
          folga_permitida?: boolean
          id?: string
          limite_valor_presente?: number | null
          presente_padrao?: boolean
          responsavel_padrao?: string | null
          tempo_casa_ativo?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cultura_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cultura_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cultura_datas: {
        Row: {
          ativo: boolean
          created_at: string
          data_especifica: string | null
          descricao: string | null
          dia: number | null
          empresa_id: string | null
          filtro_setor: string | null
          filtro_unidade: string | null
          id: string
          mes: number | null
          recorrencia: string
          tenant_id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_especifica?: string | null
          descricao?: string | null
          dia?: number | null
          empresa_id?: string | null
          filtro_setor?: string | null
          filtro_unidade?: string | null
          id?: string
          mes?: number | null
          recorrencia?: string
          tenant_id: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_especifica?: string | null
          descricao?: string | null
          dia?: number | null
          empresa_id?: string | null
          filtro_setor?: string | null
          filtro_unidade?: string | null
          id?: string
          mes?: number | null
          recorrencia?: string
          tenant_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cultura_datas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cultura_datas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cultura_marcos: {
        Row: {
          anos: number
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          tenant_id: string
          tipo_celebracao: string
          updated_at: string
        }
        Insert: {
          anos: number
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          tenant_id: string
          tipo_celebracao?: string
          updated_at?: string
        }
        Update: {
          anos?: number
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          tenant_id?: string
          tipo_celebracao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cultura_marcos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cultura_marcos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cultura_preferencias: {
        Row: {
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          id: string
          observacoes: string | null
          preferencia_aniversario: string | null
          tenant_id: string
          tipo_reconhecimento: string | null
          updated_at: string
        }
        Insert: {
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          id?: string
          observacoes?: string | null
          preferencia_aniversario?: string | null
          tenant_id: string
          tipo_reconhecimento?: string | null
          updated_at?: string
        }
        Update: {
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          id?: string
          observacoes?: string | null
          preferencia_aniversario?: string | null
          tenant_id?: string
          tipo_reconhecimento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cultura_preferencias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cultura_rituais: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          dia_mes: number | null
          dia_semana: number | null
          empresa_id: string | null
          frequencia: string
          id: string
          nome: string
          proxima_execucao: string | null
          responsavel: string | null
          responsavel_nome: string | null
          tenant_id: string
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          dia_mes?: number | null
          dia_semana?: number | null
          empresa_id?: string | null
          frequencia?: string
          id?: string
          nome: string
          proxima_execucao?: string | null
          responsavel?: string | null
          responsavel_nome?: string | null
          tenant_id: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          dia_mes?: number | null
          dia_semana?: number | null
          empresa_id?: string | null
          frequencia?: string
          id?: string
          nome?: string
          proxima_execucao?: string | null
          responsavel?: string | null
          responsavel_nome?: string | null
          tenant_id?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cultura_rituais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cultura_rituais_tenant_id_fkey"
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
          empresa_id: string | null
          filial_id: string | null
          gestor_admissao_id: string | null
          gestor_substituto_admissao_id: string | null
          id: string
          nome: string
          responsavel_id: string | null
          substituto_ativo: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          filial_id?: string | null
          gestor_admissao_id?: string | null
          gestor_substituto_admissao_id?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
          substituto_ativo?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          filial_id?: string | null
          gestor_admissao_id?: string | null
          gestor_substituto_admissao_id?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          substituto_ativo?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departamentos_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departamentos_gestor_admissao_id_fkey"
            columns: ["gestor_admissao_id"]
            isOneToOne: false
            referencedRelation: "admissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departamentos_gestor_substituto_admissao_id_fkey"
            columns: ["gestor_substituto_admissao_id"]
            isOneToOne: false
            referencedRelation: "admissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      desvios_seguranca: {
        Row: {
          acao_imediata: string | null
          acao_imediata_prazo: string | null
          acao_imediata_responsavel: string | null
          categoria: string | null
          causa_provavel: string | null
          codigo: string | null
          convertido_em: string | null
          convertido_em_incidente_id: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_desvio: string
          descricao: string
          empresa_id: string | null
          foto_nome: string | null
          foto_url: string | null
          gro_risco_id: string | null
          hora_desvio: string | null
          id: string
          local_especifico: string | null
          plano_acao_id: string | null
          potencial_risco: string
          reportante_anonimo: boolean | null
          reportante_id: string | null
          reportante_nome: string | null
          setor: string | null
          status: string
          tenant_id: string
          tipo_desvio: string
          turno: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          acao_imediata?: string | null
          acao_imediata_prazo?: string | null
          acao_imediata_responsavel?: string | null
          categoria?: string | null
          causa_provavel?: string | null
          codigo?: string | null
          convertido_em?: string | null
          convertido_em_incidente_id?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_desvio: string
          descricao: string
          empresa_id?: string | null
          foto_nome?: string | null
          foto_url?: string | null
          gro_risco_id?: string | null
          hora_desvio?: string | null
          id?: string
          local_especifico?: string | null
          plano_acao_id?: string | null
          potencial_risco?: string
          reportante_anonimo?: boolean | null
          reportante_id?: string | null
          reportante_nome?: string | null
          setor?: string | null
          status?: string
          tenant_id: string
          tipo_desvio: string
          turno?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          acao_imediata?: string | null
          acao_imediata_prazo?: string | null
          acao_imediata_responsavel?: string | null
          categoria?: string | null
          causa_provavel?: string | null
          codigo?: string | null
          convertido_em?: string | null
          convertido_em_incidente_id?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_desvio?: string
          descricao?: string
          empresa_id?: string | null
          foto_nome?: string | null
          foto_url?: string | null
          gro_risco_id?: string | null
          hora_desvio?: string | null
          id?: string
          local_especifico?: string | null
          plano_acao_id?: string | null
          potencial_risco?: string
          reportante_anonimo?: boolean | null
          reportante_id?: string | null
          reportante_nome?: string | null
          setor?: string | null
          status?: string
          tenant_id?: string
          tipo_desvio?: string
          turno?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "desvios_seguranca_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
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
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
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
            foreignKeyName: "documento_pastas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
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
      documento_versoes: {
        Row: {
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_validade: string | null
          documento_id: string
          id: string
          mime_type: string
          motivo_revisao: string | null
          nome_original: string
          observacoes: string | null
          storage_path: string
          tamanho: number
          tenant_id: string
          versao: number
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_validade?: string | null
          documento_id: string
          id?: string
          mime_type?: string
          motivo_revisao?: string | null
          nome_original: string
          observacoes?: string | null
          storage_path: string
          tamanho?: number
          tenant_id: string
          versao?: number
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_validade?: string | null
          documento_id?: string
          id?: string
          mime_type?: string
          motivo_revisao?: string | null
          nome_original?: string
          observacoes?: string | null
          storage_path?: string
          tamanho?: number
          tenant_id?: string
          versao?: number
        }
        Relationships: []
      }
      documentos: {
        Row: {
          atividade_vinculada: string | null
          colaborador_cpf: string | null
          colaborador_id: string | null
          colaborador_nome: string
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_validade: string | null
          empresa_id: string | null
          funcao_vinculada: string | null
          id: string
          mime_type: string
          nome_arquivo: string
          nome_original: string
          observacoes: string | null
          pasta_id: string | null
          pop_id: string | null
          status: string
          storage_path: string
          tamanho: number
          tenant_id: string
          tipo: string
          total_versoes: number
          updated_at: string
          versao: string | null
          versao_atual: number
        }
        Insert: {
          atividade_vinculada?: string | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_validade?: string | null
          empresa_id?: string | null
          funcao_vinculada?: string | null
          id?: string
          mime_type: string
          nome_arquivo: string
          nome_original: string
          observacoes?: string | null
          pasta_id?: string | null
          pop_id?: string | null
          status?: string
          storage_path: string
          tamanho: number
          tenant_id: string
          tipo: string
          total_versoes?: number
          updated_at?: string
          versao?: string | null
          versao_atual?: number
        }
        Update: {
          atividade_vinculada?: string | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_validade?: string | null
          empresa_id?: string | null
          funcao_vinculada?: string | null
          id?: string
          mime_type?: string
          nome_arquivo?: string
          nome_original?: string
          observacoes?: string | null
          pasta_id?: string | null
          pop_id?: string | null
          status?: string
          storage_path?: string
          tamanho?: number
          tenant_id?: string
          tipo?: string
          total_versoes?: number
          updated_at?: string
          versao?: string | null
          versao_atual?: number
        }
        Relationships: [
          {
            foreignKeyName: "documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
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
      empresa_cadastro: {
        Row: {
          ai_context: string | null
          aposentadoria_especial: boolean | null
          aprendiz_obrigatorio: boolean | null
          aprendiz_quantidade_atual: number | null
          aprendiz_quantidade_maxima: number | null
          aprendiz_quantidade_minima: number | null
          ativo: boolean
          atualizado_por: string | null
          bairro: string | null
          caepf: string | null
          cei: string | null
          cep: string | null
          cidade: string | null
          cipa_data_mandato_fim: string | null
          cipa_data_mandato_inicio: string | null
          cipa_membros: Json | null
          cipa_obrigatoria: boolean | null
          cipa_situacao: string | null
          cnae_descricao: string | null
          cnae_principal: string | null
          cnaes_secundarios: Json | null
          cnpj: string | null
          complemento: string | null
          condicoes_especiais_detalhes: Json | null
          cpf: string | null
          created_at: string
          email: string | null
          endereco: string | null
          espaco_confinado: boolean | null
          estado: string | null
          fap_atual: number | null
          fap_classificacao: string | null
          fap_historico: Json | null
          grau_risco: number | null
          grau_risco_ajustado: number | null
          grau_risco_justificativa: string | null
          grupo_economico_id: string | null
          id: string
          insalubridade: boolean | null
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          jornada_padrao: string | null
          logo_url: string | null
          matriz_id: string | null
          nome_fantasia: string | null
          numero: string | null
          pcd_obrigatoria: boolean | null
          pcd_percentual_exigido: number | null
          pcd_quantidade_atual: number | null
          pcd_quantidade_exigida: number | null
          periculosidade: boolean | null
          possui_escalas_especiais: boolean | null
          possui_terceiro_turno: boolean | null
          razao_social: string | null
          sesmt_obrigatorio: boolean | null
          sesmt_profissionais: Json | null
          sesmt_situacao: string | null
          tac_detalhes: Json | null
          tac_possui: boolean | null
          telefone: string | null
          tenant_id: string
          tipo_pessoa: string
          tipo_unidade: string
          total_colaboradores: number | null
          trabalho_altura: boolean | null
          turnos: Json | null
          updated_at: string
          website: string | null
        }
        Insert: {
          ai_context?: string | null
          aposentadoria_especial?: boolean | null
          aprendiz_obrigatorio?: boolean | null
          aprendiz_quantidade_atual?: number | null
          aprendiz_quantidade_maxima?: number | null
          aprendiz_quantidade_minima?: number | null
          ativo?: boolean
          atualizado_por?: string | null
          bairro?: string | null
          caepf?: string | null
          cei?: string | null
          cep?: string | null
          cidade?: string | null
          cipa_data_mandato_fim?: string | null
          cipa_data_mandato_inicio?: string | null
          cipa_membros?: Json | null
          cipa_obrigatoria?: boolean | null
          cipa_situacao?: string | null
          cnae_descricao?: string | null
          cnae_principal?: string | null
          cnaes_secundarios?: Json | null
          cnpj?: string | null
          complemento?: string | null
          condicoes_especiais_detalhes?: Json | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          espaco_confinado?: boolean | null
          estado?: string | null
          fap_atual?: number | null
          fap_classificacao?: string | null
          fap_historico?: Json | null
          grau_risco?: number | null
          grau_risco_ajustado?: number | null
          grau_risco_justificativa?: string | null
          grupo_economico_id?: string | null
          id?: string
          insalubridade?: boolean | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          jornada_padrao?: string | null
          logo_url?: string | null
          matriz_id?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          pcd_obrigatoria?: boolean | null
          pcd_percentual_exigido?: number | null
          pcd_quantidade_atual?: number | null
          pcd_quantidade_exigida?: number | null
          periculosidade?: boolean | null
          possui_escalas_especiais?: boolean | null
          possui_terceiro_turno?: boolean | null
          razao_social?: string | null
          sesmt_obrigatorio?: boolean | null
          sesmt_profissionais?: Json | null
          sesmt_situacao?: string | null
          tac_detalhes?: Json | null
          tac_possui?: boolean | null
          telefone?: string | null
          tenant_id: string
          tipo_pessoa?: string
          tipo_unidade?: string
          total_colaboradores?: number | null
          trabalho_altura?: boolean | null
          turnos?: Json | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          ai_context?: string | null
          aposentadoria_especial?: boolean | null
          aprendiz_obrigatorio?: boolean | null
          aprendiz_quantidade_atual?: number | null
          aprendiz_quantidade_maxima?: number | null
          aprendiz_quantidade_minima?: number | null
          ativo?: boolean
          atualizado_por?: string | null
          bairro?: string | null
          caepf?: string | null
          cei?: string | null
          cep?: string | null
          cidade?: string | null
          cipa_data_mandato_fim?: string | null
          cipa_data_mandato_inicio?: string | null
          cipa_membros?: Json | null
          cipa_obrigatoria?: boolean | null
          cipa_situacao?: string | null
          cnae_descricao?: string | null
          cnae_principal?: string | null
          cnaes_secundarios?: Json | null
          cnpj?: string | null
          complemento?: string | null
          condicoes_especiais_detalhes?: Json | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          espaco_confinado?: boolean | null
          estado?: string | null
          fap_atual?: number | null
          fap_classificacao?: string | null
          fap_historico?: Json | null
          grau_risco?: number | null
          grau_risco_ajustado?: number | null
          grau_risco_justificativa?: string | null
          grupo_economico_id?: string | null
          id?: string
          insalubridade?: boolean | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          jornada_padrao?: string | null
          logo_url?: string | null
          matriz_id?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          pcd_obrigatoria?: boolean | null
          pcd_percentual_exigido?: number | null
          pcd_quantidade_atual?: number | null
          pcd_quantidade_exigida?: number | null
          periculosidade?: boolean | null
          possui_escalas_especiais?: boolean | null
          possui_terceiro_turno?: boolean | null
          razao_social?: string | null
          sesmt_obrigatorio?: boolean | null
          sesmt_profissionais?: Json | null
          sesmt_situacao?: string | null
          tac_detalhes?: Json | null
          tac_possui?: boolean | null
          telefone?: string | null
          tenant_id?: string
          tipo_pessoa?: string
          tipo_unidade?: string
          total_colaboradores?: number | null
          trabalho_altura?: boolean | null
          turnos?: Json | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_cadastro_grupo_economico_id_fkey"
            columns: ["grupo_economico_id"]
            isOneToOne: false
            referencedRelation: "grupos_economicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_cadastro_matriz_id_fkey"
            columns: ["matriz_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_cadastro_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_experiencia_config: {
        Row: {
          alerta_15_dias: boolean
          alerta_2_dias: boolean
          alerta_7_dias: boolean
          clausula_assecuratoria_padrao: boolean
          created_at: string
          dias_antecedencia_acao: number
          duracao_primeiro_periodo: number
          duracao_segundo_periodo: number | null
          empresa_id: string
          id: string
          modelo_periodos: string
          politica_interna: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          alerta_15_dias?: boolean
          alerta_2_dias?: boolean
          alerta_7_dias?: boolean
          clausula_assecuratoria_padrao?: boolean
          created_at?: string
          dias_antecedencia_acao?: number
          duracao_primeiro_periodo?: number
          duracao_segundo_periodo?: number | null
          empresa_id: string
          id?: string
          modelo_periodos?: string
          politica_interna?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          alerta_15_dias?: boolean
          alerta_2_dias?: boolean
          alerta_7_dias?: boolean
          clausula_assecuratoria_padrao?: boolean
          created_at?: string
          dias_antecedencia_acao?: number
          duracao_primeiro_periodo?: number
          duracao_segundo_periodo?: number | null
          empresa_id?: string
          id?: string
          modelo_periodos?: string
          politica_interna?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_experiencia_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_experiencia_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_import_pendencias: {
        Row: {
          arquivo_nome: string | null
          cnpj: string
          created_at: string
          empresa_existente_id: string | null
          id: string
          importado_por: string | null
          importado_por_nome: string | null
          linha_planilha: number | null
          motivo: string
          razao_social_existente: string | null
          razao_social_planilha: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          cnpj: string
          created_at?: string
          empresa_existente_id?: string | null
          id?: string
          importado_por?: string | null
          importado_por_nome?: string | null
          linha_planilha?: number | null
          motivo?: string
          razao_social_existente?: string | null
          razao_social_planilha?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          cnpj?: string
          created_at?: string
          empresa_existente_id?: string | null
          id?: string
          importado_por?: string | null
          importado_por_nome?: string | null
          linha_planilha?: number | null
          motivo?: string
          razao_social_existente?: string | null
          razao_social_planilha?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_import_pendencias_empresa_existente_id_fkey"
            columns: ["empresa_existente_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_obrigacoes: {
        Row: {
          acao_gerada_id: string | null
          ativo: boolean
          base_legal: string | null
          categoria: string
          created_at: string
          criticidade: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          origem: string | null
          origem_campo: string | null
          prazo_sugerido: string | null
          responsavel_sugerido: string | null
          status: string
          subcategoria: string | null
          tenant_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          acao_gerada_id?: string | null
          ativo?: boolean
          base_legal?: string | null
          categoria: string
          created_at?: string
          criticidade?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          origem?: string | null
          origem_campo?: string | null
          prazo_sugerido?: string | null
          responsavel_sugerido?: string | null
          status?: string
          subcategoria?: string | null
          tenant_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          acao_gerada_id?: string | null
          ativo?: boolean
          base_legal?: string | null
          categoria?: string
          created_at?: string
          criticidade?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          origem?: string | null
          origem_campo?: string | null
          prazo_sugerido?: string | null
          responsavel_sugerido?: string | null
          status?: string
          subcategoria?: string | null
          tenant_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_obrigacoes_acao_gerada_id_fkey"
            columns: ["acao_gerada_id"]
            isOneToOne: false
            referencedRelation: "plano_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_obrigacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_obrigacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_categorias: {
        Row: {
          created_at: string
          id: string
          nome: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_categorias_tenant_id_fkey"
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
      epi_config: {
        Row: {
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
          usar_controle_estoque: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
          usar_controle_estoque?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          usar_controle_estoque?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "epi_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
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
          empresa_id: string | null
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
          tamanho: string | null
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
          empresa_id?: string | null
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
          tamanho?: string | null
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
          empresa_id?: string | null
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
          tamanho?: string | null
          tenant_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_entregas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
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
      epi_estoque_local: {
        Row: {
          created_at: string
          epi_id: string
          id: string
          local_estoque_id: string
          quantidade: number
          quantidade_minima: number
          tamanho: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          epi_id: string
          id?: string
          local_estoque_id: string
          quantidade?: number
          quantidade_minima?: number
          tamanho?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          epi_id?: string
          id?: string
          local_estoque_id?: string
          quantidade?: number
          quantidade_minima?: number
          tamanho?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_estoque_local_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_estoque_local_local_estoque_id_fkey"
            columns: ["local_estoque_id"]
            isOneToOne: false
            referencedRelation: "epi_locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_estoque_local_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_locais_estoque: {
        Row: {
          ativo: boolean
          created_at: string
          filial_id: string | null
          id: string
          nome: string
          observacoes: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          tenant_id: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          filial_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          tenant_id: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          filial_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          tenant_id?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_locais_estoque_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_locais_estoque_tenant_id_fkey"
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
          local_estoque_id: string | null
          motivo: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_atual: number
          realizado_por: string | null
          realizado_por_nome: string | null
          subtipo: string | null
          tamanho: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          documento_referencia?: string | null
          epi_id: string
          id?: string
          local_estoque_id?: string | null
          motivo?: string | null
          quantidade: number
          quantidade_anterior: number
          quantidade_atual: number
          realizado_por?: string | null
          realizado_por_nome?: string | null
          subtipo?: string | null
          tamanho?: string | null
          tenant_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          documento_referencia?: string | null
          epi_id?: string
          id?: string
          local_estoque_id?: string | null
          motivo?: string | null
          quantidade?: number
          quantidade_anterior?: number
          quantidade_atual?: number
          realizado_por?: string | null
          realizado_por_nome?: string | null
          subtipo?: string | null
          tamanho?: string | null
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
            foreignKeyName: "epi_movimentacoes_local_estoque_id_fkey"
            columns: ["local_estoque_id"]
            isOneToOne: false
            referencedRelation: "epi_locais_estoque"
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
      epi_nf_itens: {
        Row: {
          created_at: string
          descricao_nf: string | null
          epi_id: string
          id: string
          local_estoque_id: string
          movimentacao_id: string | null
          nota_fiscal_id: string
          quantidade: number
          tamanho: string | null
          tenant_id: string
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string
          descricao_nf?: string | null
          epi_id: string
          id?: string
          local_estoque_id: string
          movimentacao_id?: string | null
          nota_fiscal_id: string
          quantidade: number
          tamanho?: string | null
          tenant_id: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string
          descricao_nf?: string | null
          epi_id?: string
          id?: string
          local_estoque_id?: string
          movimentacao_id?: string | null
          nota_fiscal_id?: string
          quantidade?: number
          tamanho?: string | null
          tenant_id?: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_nf_itens_epi_id_fkey"
            columns: ["epi_id"]
            isOneToOne: false
            referencedRelation: "epis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_nf_itens_local_estoque_id_fkey"
            columns: ["local_estoque_id"]
            isOneToOne: false
            referencedRelation: "epi_locais_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_nf_itens_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "epi_movimentacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_nf_itens_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "epi_notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_nf_itens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_notas_fiscais: {
        Row: {
          chave_acesso: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_emissao: string | null
          fornecedor_cnpj: string | null
          fornecedor_nome: string | null
          id: string
          numero_nf: string
          observacoes: string | null
          origem: string
          serie: string | null
          tenant_id: string
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          chave_acesso?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_emissao?: string | null
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string | null
          id?: string
          numero_nf: string
          observacoes?: string | null
          origem?: string
          serie?: string | null
          tenant_id: string
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          chave_acesso?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_emissao?: string | null
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string | null
          id?: string
          numero_nf?: string
          observacoes?: string | null
          origem?: string
          serie?: string | null
          tenant_id?: string
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epi_notas_fiscais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_tamanhos: {
        Row: {
          created_at: string
          id: string
          ordem: number
          tamanho: string
          tenant_id: string
          tipo_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordem?: number
          tamanho: string
          tenant_id: string
          tipo_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ordem?: number
          tamanho?: string
          tenant_id?: string
          tipo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_tamanhos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epi_tamanhos_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "epi_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_tipos: {
        Row: {
          ca_numero: string | null
          ca_validade: string | null
          categoria: string | null
          controla_tamanho: boolean
          created_at: string
          descricao: string | null
          estoque_minimo: number | null
          fabricante: string | null
          id: string
          is_active: boolean | null
          marca: string | null
          nome: string
          obrigatorio_para_funcoes: string[] | null
          periodicidade_troca_dias: number | null
          quantidade_estoque: number | null
          tenant_id: string
          tipo_durabilidade: string
          unidade_medida: string
          updated_at: string
          validade_meses: number | null
        }
        Insert: {
          ca_numero?: string | null
          ca_validade?: string | null
          categoria?: string | null
          controla_tamanho?: boolean
          created_at?: string
          descricao?: string | null
          estoque_minimo?: number | null
          fabricante?: string | null
          id?: string
          is_active?: boolean | null
          marca?: string | null
          nome: string
          obrigatorio_para_funcoes?: string[] | null
          periodicidade_troca_dias?: number | null
          quantidade_estoque?: number | null
          tenant_id: string
          tipo_durabilidade?: string
          unidade_medida?: string
          updated_at?: string
          validade_meses?: number | null
        }
        Update: {
          ca_numero?: string | null
          ca_validade?: string | null
          categoria?: string | null
          controla_tamanho?: boolean
          created_at?: string
          descricao?: string | null
          estoque_minimo?: number | null
          fabricante?: string | null
          id?: string
          is_active?: boolean | null
          marca?: string | null
          nome?: string
          obrigatorio_para_funcoes?: string[] | null
          periodicidade_troca_dias?: number | null
          quantidade_estoque?: number | null
          tenant_id?: string
          tipo_durabilidade?: string
          unidade_medida?: string
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
          empresa_id: string | null
          id: string
          local_estoque_id: string | null
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
          empresa_id?: string | null
          id?: string
          local_estoque_id?: string | null
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
          empresa_id?: string | null
          id?: string
          local_estoque_id?: string | null
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
            foreignKeyName: "epis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epis_local_estoque_id_fkey"
            columns: ["local_estoque_id"]
            isOneToOne: false
            referencedRelation: "epi_locais_estoque"
            referencedColumns: ["id"]
          },
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
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
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
            foreignKeyName: "ergonomia_acoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
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
      ergonomia_analises: {
        Row: {
          atividade: string | null
          cargo: string
          classificacao_risco: string | null
          conformidade_estimada: number | null
          contexto_adicional: string | null
          created_at: string
          data_analise: string
          empresa_id: string | null
          evidencias_urls: Json | null
          id: string
          lacunas_normativas: Json | null
          num_trabalhadores: number | null
          realizado_por: string | null
          realizado_por_id: string | null
          recomendacoes: Json | null
          resumo_geral: string | null
          riscos_identificados: Json | null
          setor: string
          status: string | null
          tenant_id: string
          tipo_analise: string
          transcricao_audio: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          atividade?: string | null
          cargo: string
          classificacao_risco?: string | null
          conformidade_estimada?: number | null
          contexto_adicional?: string | null
          created_at?: string
          data_analise?: string
          empresa_id?: string | null
          evidencias_urls?: Json | null
          id?: string
          lacunas_normativas?: Json | null
          num_trabalhadores?: number | null
          realizado_por?: string | null
          realizado_por_id?: string | null
          recomendacoes?: Json | null
          resumo_geral?: string | null
          riscos_identificados?: Json | null
          setor: string
          status?: string | null
          tenant_id: string
          tipo_analise?: string
          transcricao_audio?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          atividade?: string | null
          cargo?: string
          classificacao_risco?: string | null
          conformidade_estimada?: number | null
          contexto_adicional?: string | null
          created_at?: string
          data_analise?: string
          empresa_id?: string | null
          evidencias_urls?: Json | null
          id?: string
          lacunas_normativas?: Json | null
          num_trabalhadores?: number | null
          realizado_por?: string | null
          realizado_por_id?: string | null
          recomendacoes?: Json | null
          resumo_geral?: string | null
          riscos_identificados?: Json | null
          setor?: string
          status?: string | null
          tenant_id?: string
          tipo_analise?: string
          transcricao_audio?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ergonomia_analises_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ergonomia_analises_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
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
            foreignKeyName: "ergonomia_evidencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
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
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "ergonomia_itens_nr17_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
        ]
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
          analise_id: string | null
          ativo: boolean
          cargo: string | null
          created_at: string
          departamento: string | null
          descricao: string | null
          eixo: Database["public"]["Enums"]["ergonomia_eixo"]
          empresa_id: string | null
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
          unidade: string | null
          updated_at: string
        }
        Insert: {
          analise_id?: string | null
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          departamento?: string | null
          descricao?: string | null
          eixo: Database["public"]["Enums"]["ergonomia_eixo"]
          empresa_id?: string | null
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
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          analise_id?: string | null
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          departamento?: string | null
          descricao?: string | null
          eixo?: Database["public"]["Enums"]["ergonomia_eixo"]
          empresa_id?: string | null
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
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ergonomia_riscos_analise_id_fkey"
            columns: ["analise_id"]
            isOneToOne: false
            referencedRelation: "ergonomia_analises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ergonomia_riscos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ergonomia_riscos_item_nr17_id_fkey"
            columns: ["item_nr17_id"]
            isOneToOne: false
            referencedRelation: "ergonomia_itens_nr17"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_certificados: {
        Row: {
          ambiente: string
          ativo: boolean | null
          certificado_nome: string
          certificado_path: string
          cnpj: string
          cnpj_procurador: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          empresa_id: string | null
          id: string
          nome_empresa: string
          nome_procurador: string | null
          senha_hash: string | null
          tenant_id: string
          tipo: string
          updated_at: string
          validade: string | null
        }
        Insert: {
          ambiente?: string
          ativo?: boolean | null
          certificado_nome: string
          certificado_path: string
          cnpj: string
          cnpj_procurador?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          empresa_id?: string | null
          id?: string
          nome_empresa: string
          nome_procurador?: string | null
          senha_hash?: string | null
          tenant_id: string
          tipo?: string
          updated_at?: string
          validade?: string | null
        }
        Update: {
          ambiente?: string
          ativo?: boolean | null
          certificado_nome?: string
          certificado_path?: string
          cnpj?: string
          cnpj_procurador?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          empresa_id?: string | null
          id?: string
          nome_empresa?: string
          nome_procurador?: string | null
          senha_hash?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esocial_certificados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_certificados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      esocial_transmissoes: {
        Row: {
          certificado_id: string | null
          codigo_retorno: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          empresa_id: string | null
          evento_sst_id: string | null
          id: string
          mensagem_retorno: string | null
          numero_recibo: string | null
          protocolo: string | null
          status: string
          tenant_id: string
          tentativas: number | null
          tipo_evento: string
          ultima_tentativa: string | null
          updated_at: string
          xml_enviado: string | null
          xml_retorno: string | null
        }
        Insert: {
          certificado_id?: string | null
          codigo_retorno?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          empresa_id?: string | null
          evento_sst_id?: string | null
          id?: string
          mensagem_retorno?: string | null
          numero_recibo?: string | null
          protocolo?: string | null
          status?: string
          tenant_id: string
          tentativas?: number | null
          tipo_evento: string
          ultima_tentativa?: string | null
          updated_at?: string
          xml_enviado?: string | null
          xml_retorno?: string | null
        }
        Update: {
          certificado_id?: string | null
          codigo_retorno?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          empresa_id?: string | null
          evento_sst_id?: string | null
          id?: string
          mensagem_retorno?: string | null
          numero_recibo?: string | null
          protocolo?: string | null
          status?: string
          tenant_id?: string
          tentativas?: number | null
          tipo_evento?: string
          ultima_tentativa?: string | null
          updated_at?: string
          xml_enviado?: string | null
          xml_retorno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esocial_transmissoes_certificado_id_fkey"
            columns: ["certificado_id"]
            isOneToOne: false
            referencedRelation: "esocial_certificados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_transmissoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_transmissoes_evento_sst_id_fkey"
            columns: ["evento_sst_id"]
            isOneToOne: false
            referencedRelation: "eventos_sst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esocial_transmissoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      estrategia_cultura: {
        Row: {
          comportamentos_esperados: Json | null
          comportamentos_nao_tolerados: Json | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          empresa_id: string | null
          grupo_economico_id: string | null
          id: string
          missao: string | null
          principios: Json | null
          tenant_id: string
          updated_at: string
          valores: Json | null
          visao: string | null
        }
        Insert: {
          comportamentos_esperados?: Json | null
          comportamentos_nao_tolerados?: Json | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          empresa_id?: string | null
          grupo_economico_id?: string | null
          id?: string
          missao?: string | null
          principios?: Json | null
          tenant_id: string
          updated_at?: string
          valores?: Json | null
          visao?: string | null
        }
        Update: {
          comportamentos_esperados?: Json | null
          comportamentos_nao_tolerados?: Json | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          empresa_id?: string | null
          grupo_economico_id?: string | null
          id?: string
          missao?: string | null
          principios?: Json | null
          tenant_id?: string
          updated_at?: string
          valores?: Json | null
          visao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estrategia_cultura_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_cultura_grupo_economico_id_fkey"
            columns: ["grupo_economico_id"]
            isOneToOne: false
            referencedRelation: "grupos_economicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_cultura_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      estrategia_oceano_azul: {
        Row: {
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          descricao: string | null
          empresa_id: string | null
          grupo_economico_id: string | null
          id: string
          swot_id: string | null
          tenant_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          empresa_id?: string | null
          grupo_economico_id?: string | null
          id?: string
          swot_id?: string | null
          tenant_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          empresa_id?: string | null
          grupo_economico_id?: string | null
          id?: string
          swot_id?: string | null
          tenant_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estrategia_oceano_azul_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_oceano_azul_grupo_economico_id_fkey"
            columns: ["grupo_economico_id"]
            isOneToOne: false
            referencedRelation: "grupos_economicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_oceano_azul_swot_id_fkey"
            columns: ["swot_id"]
            isOneToOne: false
            referencedRelation: "estrategia_swot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_oceano_azul_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      estrategia_oceano_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          oceano_id: string
          ordem: number | null
          quadrante: Database["public"]["Enums"]["oceano_quadrante"]
          swot_item_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          oceano_id: string
          ordem?: number | null
          quadrante: Database["public"]["Enums"]["oceano_quadrante"]
          swot_item_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          oceano_id?: string
          ordem?: number | null
          quadrante?: Database["public"]["Enums"]["oceano_quadrante"]
          swot_item_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estrategia_oceano_itens_oceano_id_fkey"
            columns: ["oceano_id"]
            isOneToOne: false
            referencedRelation: "estrategia_oceano_azul"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_oceano_itens_swot_item_id_fkey"
            columns: ["swot_item_id"]
            isOneToOne: false
            referencedRelation: "estrategia_swot_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_oceano_itens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      estrategia_organograma: {
        Row: {
          cargo_id: string | null
          colaborador_id: string | null
          created_at: string
          departamento_id: string | null
          empresa_id: string | null
          grupo_economico_id: string | null
          id: string
          nome_ocupante: string | null
          ordem: number | null
          parent_id: string | null
          tenant_id: string
          tipo: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          cargo_id?: string | null
          colaborador_id?: string | null
          created_at?: string
          departamento_id?: string | null
          empresa_id?: string | null
          grupo_economico_id?: string | null
          id?: string
          nome_ocupante?: string | null
          ordem?: number | null
          parent_id?: string | null
          tenant_id: string
          tipo?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          cargo_id?: string | null
          colaborador_id?: string | null
          created_at?: string
          departamento_id?: string | null
          empresa_id?: string | null
          grupo_economico_id?: string | null
          id?: string
          nome_ocupante?: string | null
          ordem?: number | null
          parent_id?: string | null
          tenant_id?: string
          tipo?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estrategia_organograma_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_organograma_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "admissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_organograma_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_organograma_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_organograma_grupo_economico_id_fkey"
            columns: ["grupo_economico_id"]
            isOneToOne: false
            referencedRelation: "grupos_economicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_organograma_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "estrategia_organograma"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_organograma_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      estrategia_swot: {
        Row: {
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          descricao: string | null
          empresa_id: string | null
          escopo: string | null
          grupo_economico_id: string | null
          id: string
          periodo: string | null
          projeto: string | null
          tenant_id: string
          titulo: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          empresa_id?: string | null
          escopo?: string | null
          grupo_economico_id?: string | null
          id?: string
          periodo?: string | null
          projeto?: string | null
          tenant_id: string
          titulo: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          empresa_id?: string | null
          escopo?: string | null
          grupo_economico_id?: string | null
          id?: string
          periodo?: string | null
          projeto?: string | null
          tenant_id?: string
          titulo?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estrategia_swot_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_swot_grupo_economico_id_fkey"
            columns: ["grupo_economico_id"]
            isOneToOne: false
            referencedRelation: "grupos_economicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_swot_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      estrategia_swot_itens: {
        Row: {
          classificacao:
            | Database["public"]["Enums"]["swot_classificacao"]
            | null
          created_at: string
          descricao: string
          id: string
          impacto: Database["public"]["Enums"]["swot_impacto"] | null
          ordem: number | null
          swot_id: string
          tenant_id: string
          tipo: Database["public"]["Enums"]["swot_tipo"]
          updated_at: string
        }
        Insert: {
          classificacao?:
            | Database["public"]["Enums"]["swot_classificacao"]
            | null
          created_at?: string
          descricao: string
          id?: string
          impacto?: Database["public"]["Enums"]["swot_impacto"] | null
          ordem?: number | null
          swot_id: string
          tenant_id: string
          tipo: Database["public"]["Enums"]["swot_tipo"]
          updated_at?: string
        }
        Update: {
          classificacao?:
            | Database["public"]["Enums"]["swot_classificacao"]
            | null
          created_at?: string
          descricao?: string
          id?: string
          impacto?: Database["public"]["Enums"]["swot_impacto"] | null
          ordem?: number | null
          swot_id?: string
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["swot_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estrategia_swot_itens_swot_id_fkey"
            columns: ["swot_id"]
            isOneToOne: false
            referencedRelation: "estrategia_swot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_swot_itens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_sst_acoes: {
        Row: {
          acao_id: string
          created_at: string
          evento_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          acao_id: string
          created_at?: string
          evento_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          acao_id?: string
          created_at?: string
          evento_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_sst_acoes_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "plano_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_sst_acoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_sst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_sst_acoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_sst_anexos: {
        Row: {
          arquivo_nome: string
          arquivo_tamanho: number | null
          arquivo_url: string
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          evento_id: string
          id: string
          tenant_id: string
          tipo: string | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_tamanho?: number | null
          arquivo_url: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          evento_id: string
          id?: string
          tenant_id: string
          tipo?: string | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_tamanho?: number | null
          arquivo_url?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          evento_id?: string
          id?: string
          tenant_id?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evento_sst_anexos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_sst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_sst_anexos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      eventos_sst: {
        Row: {
          afastamento:
            | Database["public"]["Enums"]["acidente_afastamento"]
            | null
          agente_causador_esocial: string | null
          atendimento:
            | Database["public"]["Enums"]["acidente_atendimento"]
            | null
          cat_arquivo_nome: string | null
          cat_arquivo_url: string | null
          cat_data_emissao: string | null
          cat_emitida: boolean | null
          cat_numero: string | null
          cat_observacoes: string | null
          cat_tipo: Database["public"]["Enums"]["cat_tipo"] | null
          categoria_principal: string | null
          cid10: string | null
          codigo: string | null
          colaborador_funcao: string | null
          colaborador_id: string | null
          colaborador_nome: string | null
          colaborador_tempo_empresa: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_evento: string
          descricao: string | null
          dias_afastamento_total: number | null
          fatores_ergonomicos: string[] | null
          gravidade_lesao:
            | Database["public"]["Enums"]["acidente_gravidade_lesao"]
            | null
          gravidade_potencial: string | null
          hora_evento: string | null
          horas_perdidas: number | null
          id: string
          local_especifico: string | null
          nexo_causal: string | null
          obito: boolean | null
          origem_predominante: string | null
          outros_envolvidos: string | null
          percepcao_causa: string | null
          setor: string | null
          status: Database["public"]["Enums"]["evento_sst_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["evento_sst_tipo"]
          tipo_acidente_legal: string | null
          turno: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          afastamento?:
            | Database["public"]["Enums"]["acidente_afastamento"]
            | null
          agente_causador_esocial?: string | null
          atendimento?:
            | Database["public"]["Enums"]["acidente_atendimento"]
            | null
          cat_arquivo_nome?: string | null
          cat_arquivo_url?: string | null
          cat_data_emissao?: string | null
          cat_emitida?: boolean | null
          cat_numero?: string | null
          cat_observacoes?: string | null
          cat_tipo?: Database["public"]["Enums"]["cat_tipo"] | null
          categoria_principal?: string | null
          cid10?: string | null
          codigo?: string | null
          colaborador_funcao?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          colaborador_tempo_empresa?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_evento: string
          descricao?: string | null
          dias_afastamento_total?: number | null
          fatores_ergonomicos?: string[] | null
          gravidade_lesao?:
            | Database["public"]["Enums"]["acidente_gravidade_lesao"]
            | null
          gravidade_potencial?: string | null
          hora_evento?: string | null
          horas_perdidas?: number | null
          id?: string
          local_especifico?: string | null
          nexo_causal?: string | null
          obito?: boolean | null
          origem_predominante?: string | null
          outros_envolvidos?: string | null
          percepcao_causa?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["evento_sst_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["evento_sst_tipo"]
          tipo_acidente_legal?: string | null
          turno?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          afastamento?:
            | Database["public"]["Enums"]["acidente_afastamento"]
            | null
          agente_causador_esocial?: string | null
          atendimento?:
            | Database["public"]["Enums"]["acidente_atendimento"]
            | null
          cat_arquivo_nome?: string | null
          cat_arquivo_url?: string | null
          cat_data_emissao?: string | null
          cat_emitida?: boolean | null
          cat_numero?: string | null
          cat_observacoes?: string | null
          cat_tipo?: Database["public"]["Enums"]["cat_tipo"] | null
          categoria_principal?: string | null
          cid10?: string | null
          codigo?: string | null
          colaborador_funcao?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          colaborador_tempo_empresa?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_evento?: string
          descricao?: string | null
          dias_afastamento_total?: number | null
          fatores_ergonomicos?: string[] | null
          gravidade_lesao?:
            | Database["public"]["Enums"]["acidente_gravidade_lesao"]
            | null
          gravidade_potencial?: string | null
          hora_evento?: string | null
          horas_perdidas?: number | null
          id?: string
          local_especifico?: string | null
          nexo_causal?: string | null
          obito?: boolean | null
          origem_predominante?: string | null
          outros_envolvidos?: string | null
          percepcao_causa?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["evento_sst_status"]
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["evento_sst_tipo"]
          tipo_acidente_legal?: string | null
          turno?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_sst_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      experiencia_assinatura_links: {
        Row: {
          assinado_em: string | null
          assinatura_url: string | null
          contrato_id: string
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          documento_html: string | null
          documento_storage_path: string | null
          expira_em: string
          id: string
          ip_assinatura: string | null
          signatario_email: string | null
          signatario_nome: string
          signatario_papel: string
          status: string
          tenant_id: string
          tipo_documento: string
          token: string
          updated_at: string
          user_agent_assinatura: string | null
        }
        Insert: {
          assinado_em?: string | null
          assinatura_url?: string | null
          contrato_id: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          documento_html?: string | null
          documento_storage_path?: string | null
          expira_em?: string
          id?: string
          ip_assinatura?: string | null
          signatario_email?: string | null
          signatario_nome: string
          signatario_papel?: string
          status?: string
          tenant_id: string
          tipo_documento?: string
          token?: string
          updated_at?: string
          user_agent_assinatura?: string | null
        }
        Update: {
          assinado_em?: string | null
          assinatura_url?: string | null
          contrato_id?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          documento_html?: string | null
          documento_storage_path?: string | null
          expira_em?: string
          id?: string
          ip_assinatura?: string | null
          signatario_email?: string | null
          signatario_nome?: string
          signatario_papel?: string
          status?: string
          tenant_id?: string
          tipo_documento?: string
          token?: string
          updated_at?: string
          user_agent_assinatura?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experiencia_assinatura_links_tenant_id_fkey"
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
      feedbacks: {
        Row: {
          categoria: Database["public"]["Enums"]["feedback_categoria"]
          colaborador_cargo: string | null
          colaborador_departamento: string | null
          colaborador_filial: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          descricao: string
          descricao_ia: string | null
          empresa_id: string | null
          enviado_email: boolean | null
          ia_utilizada: boolean | null
          id: string
          pdi_id: string | null
          pdi_titulo: string | null
          registrado_por: string
          registrado_por_nome: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          categoria: Database["public"]["Enums"]["feedback_categoria"]
          colaborador_cargo?: string | null
          colaborador_departamento?: string | null
          colaborador_filial?: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          descricao: string
          descricao_ia?: string | null
          empresa_id?: string | null
          enviado_email?: boolean | null
          ia_utilizada?: boolean | null
          id?: string
          pdi_id?: string | null
          pdi_titulo?: string | null
          registrado_por: string
          registrado_por_nome: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["feedback_categoria"]
          colaborador_cargo?: string | null
          colaborador_departamento?: string | null
          colaborador_filial?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          descricao?: string
          descricao_ia?: string | null
          empresa_id?: string | null
          enviado_email?: boolean | null
          ia_utilizada?: boolean | null
          id?: string
          pdi_id?: string | null
          pdi_titulo?: string | null
          registrado_por?: string
          registrado_por_nome?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_pdi_id_fkey"
            columns: ["pdi_id"]
            isOneToOne: false
            referencedRelation: "pdis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_assinatura_links: {
        Row: {
          abono_pecuniario: boolean | null
          assinado_em: string | null
          assinatura_ip: string | null
          cargo: string | null
          colaborador_cpf: string | null
          colaborador_nome: string
          created_at: string
          data_fim_ferias: string
          data_inicio_ferias: string
          departamento: string | null
          dias_abono: number | null
          dias_ferias: number
          documento_storage_path: string | null
          expira_em: string
          id: string
          salario_base: number | null
          status: string
          tenant_id: string
          token: string
          updated_at: string
        }
        Insert: {
          abono_pecuniario?: boolean | null
          assinado_em?: string | null
          assinatura_ip?: string | null
          cargo?: string | null
          colaborador_cpf?: string | null
          colaborador_nome: string
          created_at?: string
          data_fim_ferias: string
          data_inicio_ferias: string
          departamento?: string | null
          dias_abono?: number | null
          dias_ferias: number
          documento_storage_path?: string | null
          expira_em?: string
          id?: string
          salario_base?: number | null
          status?: string
          tenant_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          abono_pecuniario?: boolean | null
          assinado_em?: string | null
          assinatura_ip?: string | null
          cargo?: string | null
          colaborador_cpf?: string | null
          colaborador_nome?: string
          created_at?: string
          data_fim_ferias?: string
          data_inicio_ferias?: string
          departamento?: string | null
          dias_abono?: number | null
          dias_ferias?: number
          documento_storage_path?: string | null
          expira_em?: string
          id?: string
          salario_base?: number | null
          status?: string
          tenant_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ferias_assinatura_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_historico: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          id: string
          solicitacao_id: string
          tenant_id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          solicitacao_id: string
          tenant_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          solicitacao_id?: string
          tenant_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_historico_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "ferias_solicitacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_historico_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_solicitacoes: {
        Row: {
          abono_pecuniario: boolean | null
          acao_preventiva: boolean | null
          acao_preventiva_id: string | null
          aprovado_por: string | null
          aprovado_por_nome: string | null
          assinatura_link_id: string | null
          assinatura_status: string | null
          aviso_gerado: boolean | null
          cargo: string | null
          checkin_retorno_enviado: boolean | null
          checkin_retorno_respondido: boolean | null
          checkin_retorno_respostas: Json | null
          colaborador_cpf: string | null
          colaborador_id: string | null
          colaborador_nome: string
          created_at: string
          data_aprovacao: string | null
          data_fim: string
          data_inicio: string
          departamento: string | null
          dias_abono: number | null
          dias_solicitados: number
          empresa_id: string | null
          id: string
          inr_nivel_momento: string | null
          inr_score_momento: number | null
          mensagem_pre_ferias: string | null
          mensagem_pre_ferias_enviada: boolean | null
          motivo_recusa: string | null
          observacoes: string | null
          periodo_aquisitivo_fim: string | null
          periodo_aquisitivo_inicio: string | null
          recibo_gerado: boolean | null
          registro_financeiro_id: string | null
          salario_base: number | null
          saldo_dias: number
          status: string
          tenant_id: string
          updated_at: string
          valor_abono: number | null
          valor_ferias: number | null
          valor_terco: number | null
          valor_total_bruto: number | null
        }
        Insert: {
          abono_pecuniario?: boolean | null
          acao_preventiva?: boolean | null
          acao_preventiva_id?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
          assinatura_link_id?: string | null
          assinatura_status?: string | null
          aviso_gerado?: boolean | null
          cargo?: string | null
          checkin_retorno_enviado?: boolean | null
          checkin_retorno_respondido?: boolean | null
          checkin_retorno_respostas?: Json | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome: string
          created_at?: string
          data_aprovacao?: string | null
          data_fim: string
          data_inicio: string
          departamento?: string | null
          dias_abono?: number | null
          dias_solicitados: number
          empresa_id?: string | null
          id?: string
          inr_nivel_momento?: string | null
          inr_score_momento?: number | null
          mensagem_pre_ferias?: string | null
          mensagem_pre_ferias_enviada?: boolean | null
          motivo_recusa?: string | null
          observacoes?: string | null
          periodo_aquisitivo_fim?: string | null
          periodo_aquisitivo_inicio?: string | null
          recibo_gerado?: boolean | null
          registro_financeiro_id?: string | null
          salario_base?: number | null
          saldo_dias?: number
          status?: string
          tenant_id: string
          updated_at?: string
          valor_abono?: number | null
          valor_ferias?: number | null
          valor_terco?: number | null
          valor_total_bruto?: number | null
        }
        Update: {
          abono_pecuniario?: boolean | null
          acao_preventiva?: boolean | null
          acao_preventiva_id?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
          assinatura_link_id?: string | null
          assinatura_status?: string | null
          aviso_gerado?: boolean | null
          cargo?: string | null
          checkin_retorno_enviado?: boolean | null
          checkin_retorno_respondido?: boolean | null
          checkin_retorno_respostas?: Json | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string
          created_at?: string
          data_aprovacao?: string | null
          data_fim?: string
          data_inicio?: string
          departamento?: string | null
          dias_abono?: number | null
          dias_solicitados?: number
          empresa_id?: string | null
          id?: string
          inr_nivel_momento?: string | null
          inr_score_momento?: number | null
          mensagem_pre_ferias?: string | null
          mensagem_pre_ferias_enviada?: boolean | null
          motivo_recusa?: string | null
          observacoes?: string | null
          periodo_aquisitivo_fim?: string | null
          periodo_aquisitivo_inicio?: string | null
          recibo_gerado?: boolean | null
          registro_financeiro_id?: string | null
          salario_base?: number | null
          saldo_dias?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          valor_abono?: number | null
          valor_ferias?: number | null
          valor_terco?: number | null
          valor_total_bruto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_solicitacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_solicitacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      filiais: {
        Row: {
          ativo: boolean
          cep: string | null
          cidade: string | null
          cno: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          empresa_id: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          responsavel_id: string | null
          telefone: string | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cep?: string | null
          cidade?: string | null
          cno?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
          telefone?: string | null
          tenant_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cep?: string | null
          cidade?: string | null
          cno?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          telefone?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "filiais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filiais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_13_calculo: {
        Row: {
          ano: number
          base_fgts: number | null
          base_inss: number | null
          base_irrf: number | null
          colaborador_cpf: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          id: string
          media_variaveis: number | null
          memoria_calculo: Json | null
          meses_trabalhados: number
          parcela: number
          remuneracao_base: number
          status: string
          tenant_id: string
          tipo_vinculo: string | null
          total_descontos: number | null
          total_liquido: number
          updated_at: string
          valor_bruto: number
          valor_fgts: number | null
          valor_inss: number | null
          valor_irrf: number | null
          valor_primeira_parcela: number | null
        }
        Insert: {
          ano: number
          base_fgts?: number | null
          base_inss?: number | null
          base_irrf?: number | null
          colaborador_cpf?: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          id?: string
          media_variaveis?: number | null
          memoria_calculo?: Json | null
          meses_trabalhados?: number
          parcela?: number
          remuneracao_base?: number
          status?: string
          tenant_id: string
          tipo_vinculo?: string | null
          total_descontos?: number | null
          total_liquido?: number
          updated_at?: string
          valor_bruto?: number
          valor_fgts?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
          valor_primeira_parcela?: number | null
        }
        Update: {
          ano?: number
          base_fgts?: number | null
          base_inss?: number | null
          base_irrf?: number | null
          colaborador_cpf?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          id?: string
          media_variaveis?: number | null
          memoria_calculo?: Json | null
          meses_trabalhados?: number
          parcela?: number
          remuneracao_base?: number
          status?: string
          tenant_id?: string
          tipo_vinculo?: string | null
          total_descontos?: number | null
          total_liquido?: number
          updated_at?: string
          valor_bruto?: number
          valor_fgts?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
          valor_primeira_parcela?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_13_calculo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_alertas_prazo: {
        Row: {
          colaborador_id: string | null
          colaborador_nome: string | null
          competencia: string
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          data_limite: string
          descricao: string
          id: string
          status: string
          tenant_id: string
          tipo: string
          valor_referencia: number | null
        }
        Insert: {
          colaborador_id?: string | null
          colaborador_nome?: string | null
          competencia: string
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          data_limite: string
          descricao: string
          id?: string
          status?: string
          tenant_id: string
          tipo: string
          valor_referencia?: number | null
        }
        Update: {
          colaborador_id?: string | null
          colaborador_nome?: string | null
          competencia?: string
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          data_limite?: string
          descricao?: string
          id?: string
          status?: string
          tenant_id?: string
          tipo?: string
          valor_referencia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_alertas_prazo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_cct: {
        Row: {
          adicional_he_100: number | null
          adicional_he_50: number | null
          adicional_noturno: number | null
          ativo: boolean
          beneficios_obrigatorios: Json | null
          created_at: string
          id: string
          numero_registro: string | null
          observacoes: string | null
          piso_salarial: number | null
          sindicato: string
          tenant_id: string
          updated_at: string
          vigencia_fim: string
          vigencia_inicio: string
        }
        Insert: {
          adicional_he_100?: number | null
          adicional_he_50?: number | null
          adicional_noturno?: number | null
          ativo?: boolean
          beneficios_obrigatorios?: Json | null
          created_at?: string
          id?: string
          numero_registro?: string | null
          observacoes?: string | null
          piso_salarial?: number | null
          sindicato: string
          tenant_id: string
          updated_at?: string
          vigencia_fim: string
          vigencia_inicio: string
        }
        Update: {
          adicional_he_100?: number | null
          adicional_he_50?: number | null
          adicional_noturno?: number | null
          ativo?: boolean
          beneficios_obrigatorios?: Json | null
          created_at?: string
          id?: string
          numero_registro?: string | null
          observacoes?: string | null
          piso_salarial?: number | null
          sindicato?: string
          tenant_id?: string
          updated_at?: string
          vigencia_fim?: string
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "folha_cct_tenant_id_fkey"
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
      folha_ferias_calculo: {
        Row: {
          base_fgts: number | null
          base_inss: number | null
          base_irrf: number | null
          colaborador_cpf: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          data_fim_gozo: string
          data_inicio_gozo: string
          data_pagamento: string | null
          dias_abono: number | null
          dias_gozo: number
          em_dobro: boolean | null
          id: string
          media_variaveis: number | null
          memoria_calculo: Json | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          prazo_legal: string | null
          remuneracao_base: number
          status: string
          tenant_id: string
          tipo_vinculo: string | null
          total_bruto: number
          total_descontos: number | null
          total_liquido: number
          updated_at: string
          valor_abono: number | null
          valor_abono_terco: number | null
          valor_ferias: number
          valor_fgts: number | null
          valor_inss: number | null
          valor_irrf: number | null
          valor_terco: number
        }
        Insert: {
          base_fgts?: number | null
          base_inss?: number | null
          base_irrf?: number | null
          colaborador_cpf?: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          data_fim_gozo: string
          data_inicio_gozo: string
          data_pagamento?: string | null
          dias_abono?: number | null
          dias_gozo?: number
          em_dobro?: boolean | null
          id?: string
          media_variaveis?: number | null
          memoria_calculo?: Json | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          prazo_legal?: string | null
          remuneracao_base?: number
          status?: string
          tenant_id: string
          tipo_vinculo?: string | null
          total_bruto?: number
          total_descontos?: number | null
          total_liquido?: number
          updated_at?: string
          valor_abono?: number | null
          valor_abono_terco?: number | null
          valor_ferias?: number
          valor_fgts?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
          valor_terco?: number
        }
        Update: {
          base_fgts?: number | null
          base_inss?: number | null
          base_irrf?: number | null
          colaborador_cpf?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          data_fim_gozo?: string
          data_inicio_gozo?: string
          data_pagamento?: string | null
          dias_abono?: number | null
          dias_gozo?: number
          em_dobro?: boolean | null
          id?: string
          media_variaveis?: number | null
          memoria_calculo?: Json | null
          periodo_aquisitivo_fim?: string
          periodo_aquisitivo_inicio?: string
          prazo_legal?: string | null
          remuneracao_base?: number
          status?: string
          tenant_id?: string
          tipo_vinculo?: string | null
          total_bruto?: number
          total_descontos?: number | null
          total_liquido?: number
          updated_at?: string
          valor_abono?: number | null
          valor_abono_terco?: number | null
          valor_ferias?: number
          valor_fgts?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
          valor_terco?: number
        }
        Relationships: [
          {
            foreignKeyName: "folha_ferias_calculo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_historico: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          entidade: string | null
          entidade_id: string | null
          id: string
          periodo_id: string | null
          tenant_id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          periodo_id?: string | null
          tenant_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          periodo_id?: string | null
          tenant_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_historico_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "folha_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_historico_tenant_id_fkey"
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
      folha_lancamentos: {
        Row: {
          colaborador_cpf: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          id: string
          lote_id: string | null
          origem: string
          periodo_id: string
          referencia: string | null
          rubrica_codigo: string | null
          rubrica_descricao: string
          rubrica_id: string | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["rubrica_tipo"]
          valor: number
        }
        Insert: {
          colaborador_cpf?: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          id?: string
          lote_id?: string | null
          origem?: string
          periodo_id: string
          referencia?: string | null
          rubrica_codigo?: string | null
          rubrica_descricao: string
          rubrica_id?: string | null
          tenant_id: string
          tipo?: Database["public"]["Enums"]["rubrica_tipo"]
          valor?: number
        }
        Update: {
          colaborador_cpf?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          id?: string
          lote_id?: string | null
          origem?: string
          periodo_id?: string
          referencia?: string | null
          rubrica_codigo?: string | null
          rubrica_descricao?: string
          rubrica_id?: string | null
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["rubrica_tipo"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "folha_lancamentos_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "folha_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_lancamentos_rubrica_id_fkey"
            columns: ["rubrica_id"]
            isOneToOne: false
            referencedRelation: "folha_rubricas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_lancamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_lotes: {
        Row: {
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          descricao: string
          filtros: Json | null
          id: string
          percentual: number | null
          periodo_id: string | null
          rubrica_id: string | null
          status: string
          tenant_id: string
          tipo_aplicacao: string
          total_colaboradores: number | null
          total_valor: number | null
          valor: number | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
          vigencia_tipo: string | null
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao: string
          filtros?: Json | null
          id?: string
          percentual?: number | null
          periodo_id?: string | null
          rubrica_id?: string | null
          status?: string
          tenant_id: string
          tipo_aplicacao?: string
          total_colaboradores?: number | null
          total_valor?: number | null
          valor?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
          vigencia_tipo?: string | null
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string
          filtros?: Json | null
          id?: string
          percentual?: number | null
          periodo_id?: string | null
          rubrica_id?: string | null
          status?: string
          tenant_id?: string
          tipo_aplicacao?: string
          total_colaboradores?: number | null
          total_valor?: number | null
          valor?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
          vigencia_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_lotes_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "folha_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_lotes_rubrica_id_fkey"
            columns: ["rubrica_id"]
            isOneToOne: false
            referencedRelation: "folha_rubricas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_lotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_memoria_calculo: {
        Row: {
          base_fgts: number | null
          base_inss: number | null
          base_irrf: number | null
          colaborador_id: string
          created_at: string
          deducao_dependentes: number | null
          dependentes_irrf: number | null
          detalhes: Json | null
          id: string
          periodo_id: string
          tabela_inss_id: string | null
          tabela_irrf_id: string | null
          tenant_id: string
          teto_inss_aplicado: number | null
          tipo: string
          tipo_vinculo: string | null
          valor_fgts: number | null
          valor_inss: number | null
          valor_irrf: number | null
        }
        Insert: {
          base_fgts?: number | null
          base_inss?: number | null
          base_irrf?: number | null
          colaborador_id: string
          created_at?: string
          deducao_dependentes?: number | null
          dependentes_irrf?: number | null
          detalhes?: Json | null
          id?: string
          periodo_id: string
          tabela_inss_id?: string | null
          tabela_irrf_id?: string | null
          tenant_id: string
          teto_inss_aplicado?: number | null
          tipo?: string
          tipo_vinculo?: string | null
          valor_fgts?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
        }
        Update: {
          base_fgts?: number | null
          base_inss?: number | null
          base_irrf?: number | null
          colaborador_id?: string
          created_at?: string
          deducao_dependentes?: number | null
          dependentes_irrf?: number | null
          detalhes?: Json | null
          id?: string
          periodo_id?: string
          tabela_inss_id?: string | null
          tabela_irrf_id?: string | null
          tenant_id?: string
          teto_inss_aplicado?: number | null
          tipo?: string
          tipo_vinculo?: string | null
          valor_fgts?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_memoria_calculo_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "folha_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_memoria_calculo_tenant_id_fkey"
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
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
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
            foreignKeyName: "folha_periodos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_periodos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_provisoes: {
        Row: {
          colaborador_id: string
          colaborador_nome: string
          competencia: string
          created_at: string
          data_reversao: string | null
          encargos_fgts: number | null
          encargos_inss: number | null
          id: string
          revertida: boolean | null
          tenant_id: string
          tipo: string
          valor_provisao: number
          valor_terco: number | null
          valor_total: number
        }
        Insert: {
          colaborador_id: string
          colaborador_nome: string
          competencia: string
          created_at?: string
          data_reversao?: string | null
          encargos_fgts?: number | null
          encargos_inss?: number | null
          id?: string
          revertida?: boolean | null
          tenant_id: string
          tipo: string
          valor_provisao?: number
          valor_terco?: number | null
          valor_total?: number
        }
        Update: {
          colaborador_id?: string
          colaborador_nome?: string
          competencia?: string
          created_at?: string
          data_reversao?: string | null
          encargos_fgts?: number | null
          encargos_inss?: number | null
          id?: string
          revertida?: boolean | null
          tenant_id?: string
          tipo?: string
          valor_provisao?: number
          valor_terco?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "folha_provisoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_rescisoes: {
        Row: {
          admissao_id: string | null
          aliquota_multa_fgts: number | null
          aprovado_em: string | null
          aprovado_por: string | null
          aprovado_por_nome: string | null
          aviso_previo_valor: number | null
          aviso_tipo: string | null
          base_fgts: number | null
          base_inss: number | null
          base_irrf: number | null
          colaborador_cpf: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          data_aviso: string | null
          data_desligamento: string
          data_pagamento: string | null
          decimo_terceiro_proporcional: number | null
          descricao_outros_descontos: string | null
          dias_aviso: number | null
          dias_saldo: number | null
          ferias_proporcionais: number | null
          ferias_vencidas: number | null
          id: string
          indenizacao_art479: number | null
          media_variaveis: number | null
          memoria_calculo: Json | null
          motivo: string | null
          multa_fgts: number | null
          outros_descontos: number | null
          prazo_legal: string | null
          saldo_salario: number | null
          status: Database["public"]["Enums"]["rescisao_status"]
          tenant_id: string
          terco_ferias: number | null
          tipo_rescisao: Database["public"]["Enums"]["rescisao_tipo"]
          tipo_vinculo: string | null
          total_bruto: number
          total_descontos: number | null
          total_liquido: number
          updated_at: string
          valor_fgts: number | null
          valor_inss: number | null
          valor_irrf: number | null
        }
        Insert: {
          admissao_id?: string | null
          aliquota_multa_fgts?: number | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
          aviso_previo_valor?: number | null
          aviso_tipo?: string | null
          base_fgts?: number | null
          base_inss?: number | null
          base_irrf?: number | null
          colaborador_cpf?: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          data_aviso?: string | null
          data_desligamento: string
          data_pagamento?: string | null
          decimo_terceiro_proporcional?: number | null
          descricao_outros_descontos?: string | null
          dias_aviso?: number | null
          dias_saldo?: number | null
          ferias_proporcionais?: number | null
          ferias_vencidas?: number | null
          id?: string
          indenizacao_art479?: number | null
          media_variaveis?: number | null
          memoria_calculo?: Json | null
          motivo?: string | null
          multa_fgts?: number | null
          outros_descontos?: number | null
          prazo_legal?: string | null
          saldo_salario?: number | null
          status?: Database["public"]["Enums"]["rescisao_status"]
          tenant_id: string
          terco_ferias?: number | null
          tipo_rescisao: Database["public"]["Enums"]["rescisao_tipo"]
          tipo_vinculo?: string | null
          total_bruto?: number
          total_descontos?: number | null
          total_liquido?: number
          updated_at?: string
          valor_fgts?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
        }
        Update: {
          admissao_id?: string | null
          aliquota_multa_fgts?: number | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
          aviso_previo_valor?: number | null
          aviso_tipo?: string | null
          base_fgts?: number | null
          base_inss?: number | null
          base_irrf?: number | null
          colaborador_cpf?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          data_aviso?: string | null
          data_desligamento?: string
          data_pagamento?: string | null
          decimo_terceiro_proporcional?: number | null
          descricao_outros_descontos?: string | null
          dias_aviso?: number | null
          dias_saldo?: number | null
          ferias_proporcionais?: number | null
          ferias_vencidas?: number | null
          id?: string
          indenizacao_art479?: number | null
          media_variaveis?: number | null
          memoria_calculo?: Json | null
          motivo?: string | null
          multa_fgts?: number | null
          outros_descontos?: number | null
          prazo_legal?: string | null
          saldo_salario?: number | null
          status?: Database["public"]["Enums"]["rescisao_status"]
          tenant_id?: string
          terco_ferias?: number | null
          tipo_rescisao?: Database["public"]["Enums"]["rescisao_tipo"]
          tipo_vinculo?: string | null
          total_bruto?: number
          total_descontos?: number | null
          total_liquido?: number
          updated_at?: string
          valor_fgts?: number | null
          valor_inss?: number | null
          valor_irrf?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_rescisoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_rubricas: {
        Row: {
          ativa: boolean
          classificacao_esocial: string | null
          codigo_interno: string
          created_at: string
          descricao: string
          forma_calculo: Database["public"]["Enums"]["forma_calculo"]
          id: string
          incide_13: boolean
          incide_ferias: boolean
          incide_fgts: boolean
          incide_inss: boolean
          incide_irrf: boolean
          incide_rescisao: boolean
          natureza: Database["public"]["Enums"]["rubrica_natureza"]
          natureza_contabil: string | null
          permitido_para_vinculos: string[] | null
          prioridade_calculo: number
          protegida: boolean
          tenant_id: string
          tipo: Database["public"]["Enums"]["rubrica_tipo"]
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          classificacao_esocial?: string | null
          codigo_interno: string
          created_at?: string
          descricao: string
          forma_calculo?: Database["public"]["Enums"]["forma_calculo"]
          id?: string
          incide_13?: boolean
          incide_ferias?: boolean
          incide_fgts?: boolean
          incide_inss?: boolean
          incide_irrf?: boolean
          incide_rescisao?: boolean
          natureza?: Database["public"]["Enums"]["rubrica_natureza"]
          natureza_contabil?: string | null
          permitido_para_vinculos?: string[] | null
          prioridade_calculo?: number
          protegida?: boolean
          tenant_id: string
          tipo?: Database["public"]["Enums"]["rubrica_tipo"]
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          classificacao_esocial?: string | null
          codigo_interno?: string
          created_at?: string
          descricao?: string
          forma_calculo?: Database["public"]["Enums"]["forma_calculo"]
          id?: string
          incide_13?: boolean
          incide_ferias?: boolean
          incide_fgts?: boolean
          incide_inss?: boolean
          incide_irrf?: boolean
          incide_rescisao?: boolean
          natureza?: Database["public"]["Enums"]["rubrica_natureza"]
          natureza_contabil?: string | null
          permitido_para_vinculos?: string[] | null
          prioridade_calculo?: number
          protegida?: boolean
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["rubrica_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folha_rubricas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_tabelas_inss: {
        Row: {
          created_at: string
          faixas: Json
          id: string
          tenant_id: string
          teto: number
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          created_at?: string
          faixas?: Json
          id?: string
          tenant_id: string
          teto?: number
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          created_at?: string
          faixas?: Json
          id?: string
          tenant_id?: string
          teto?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "folha_tabelas_inss_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_tabelas_irrf: {
        Row: {
          created_at: string
          deducao_por_dependente: number
          faixas: Json
          id: string
          tenant_id: string
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          created_at?: string
          deducao_por_dependente?: number
          faixas?: Json
          id?: string
          tenant_id: string
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          created_at?: string
          deducao_por_dependente?: number
          faixas?: Json
          id?: string
          tenant_id?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "folha_tabelas_irrf_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_vinculos_config: {
        Row: {
          aliquota_fgts: number
          created_at: string
          direito_13: boolean
          direito_aviso_previo: boolean
          direito_ferias: boolean
          fgts: boolean
          id: string
          inss_empregado: boolean
          multa_fgts_dispensa: number
          observacoes: string | null
          tenant_id: string
          tipo_vinculo: string
        }
        Insert: {
          aliquota_fgts?: number
          created_at?: string
          direito_13?: boolean
          direito_aviso_previo?: boolean
          direito_ferias?: boolean
          fgts?: boolean
          id?: string
          inss_empregado?: boolean
          multa_fgts_dispensa?: number
          observacoes?: string | null
          tenant_id: string
          tipo_vinculo: string
        }
        Update: {
          aliquota_fgts?: number
          created_at?: string
          direito_13?: boolean
          direito_aviso_previo?: boolean
          direito_ferias?: boolean
          fgts?: boolean
          id?: string
          inss_empregado?: boolean
          multa_fgts_dispensa?: number
          observacoes?: string | null
          tenant_id?: string
          tipo_vinculo?: string
        }
        Relationships: [
          {
            foreignKeyName: "folha_vinculos_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_atividades: {
        Row: {
          cargo_id: string
          classificacao: Database["public"]["Enums"]["classificacao_atividade"]
          como: string | null
          complexidade: Database["public"]["Enums"]["complexidade_atividade"]
          created_at: string
          descricao: string | null
          frequencia: Database["public"]["Enums"]["frequencia_atividade"]
          id: string
          nome: string
          processo: string | null
          resultado_esperado: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cargo_id: string
          classificacao?: Database["public"]["Enums"]["classificacao_atividade"]
          como?: string | null
          complexidade?: Database["public"]["Enums"]["complexidade_atividade"]
          created_at?: string
          descricao?: string | null
          frequencia?: Database["public"]["Enums"]["frequencia_atividade"]
          id?: string
          nome: string
          processo?: string | null
          resultado_esperado?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cargo_id?: string
          classificacao?: Database["public"]["Enums"]["classificacao_atividade"]
          como?: string | null
          complexidade?: Database["public"]["Enums"]["complexidade_atividade"]
          created_at?: string
          descricao?: string | null
          frequencia?: Database["public"]["Enums"]["frequencia_atividade"]
          id?: string
          nome?: string
          processo?: string | null
          resultado_esperado?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcao_atividades_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_atividades_tenant_id_fkey"
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
      funcao_competencia_recursos: {
        Row: {
          competencia_id: string
          created_at: string
          descricao: string | null
          id: string
          tenant_id: string
          tipo: Database["public"]["Enums"]["tipo_conteudo_funcao"]
          titulo: string
          url: string
        }
        Insert: {
          competencia_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          tenant_id: string
          tipo?: Database["public"]["Enums"]["tipo_conteudo_funcao"]
          titulo: string
          url: string
        }
        Update: {
          competencia_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["tipo_conteudo_funcao"]
          titulo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcao_competencia_recursos_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "funcao_competencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_competencia_recursos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_competencias: {
        Row: {
          cargo_id: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tenant_id: string
          tipo: Database["public"]["Enums"]["tipo_competencia"]
          updated_at: string
        }
        Insert: {
          cargo_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tenant_id: string
          tipo?: Database["public"]["Enums"]["tipo_competencia"]
          updated_at?: string
        }
        Update: {
          cargo_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["tipo_competencia"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcao_competencias_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_competencias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_config: {
        Row: {
          ativar_mudanca_funcao: boolean | null
          ativar_onboarding: boolean | null
          created_at: string
          id: string
          nota_minima_padrao: number | null
          reaplicacao_meses: number | null
          tenant_id: string
          treinamento_epi_obrigatorio: boolean | null
          updated_at: string
        }
        Insert: {
          ativar_mudanca_funcao?: boolean | null
          ativar_onboarding?: boolean | null
          created_at?: string
          id?: string
          nota_minima_padrao?: number | null
          reaplicacao_meses?: number | null
          tenant_id: string
          treinamento_epi_obrigatorio?: boolean | null
          updated_at?: string
        }
        Update: {
          ativar_mudanca_funcao?: boolean | null
          ativar_onboarding?: boolean | null
          created_at?: string
          id?: string
          nota_minima_padrao?: number | null
          reaplicacao_meses?: number | null
          tenant_id?: string
          treinamento_epi_obrigatorio?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcao_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_conteudos: {
        Row: {
          atividade_id: string
          created_at: string
          descricao: string | null
          id: string
          tenant_id: string
          tipo: Database["public"]["Enums"]["tipo_conteudo_funcao"]
          titulo: string
          url: string
        }
        Insert: {
          atividade_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          tenant_id: string
          tipo?: Database["public"]["Enums"]["tipo_conteudo_funcao"]
          titulo: string
          url: string
        }
        Update: {
          atividade_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["tipo_conteudo_funcao"]
          titulo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcao_conteudos_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "funcao_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_conteudos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_epi_conteudos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          tenant_id: string
          tipo: Database["public"]["Enums"]["tipo_conteudo_funcao"]
          titulo: string
          url: string
          vinculacao_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          tenant_id: string
          tipo?: Database["public"]["Enums"]["tipo_conteudo_funcao"]
          titulo: string
          url: string
          vinculacao_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["tipo_conteudo_funcao"]
          titulo?: string
          url?: string
          vinculacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcao_epi_conteudos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_epi_conteudos_vinculacao_id_fkey"
            columns: ["vinculacao_id"]
            isOneToOne: false
            referencedRelation: "funcao_epi_vinculacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_epi_questionarios: {
        Row: {
          created_at: string
          id: string
          opcoes: Json
          ordem: number
          pergunta: string
          resposta_correta: number
          tenant_id: string
          vinculacao_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opcoes?: Json
          ordem?: number
          pergunta: string
          resposta_correta?: number
          tenant_id: string
          vinculacao_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opcoes?: Json
          ordem?: number
          pergunta?: string
          resposta_correta?: number
          tenant_id?: string
          vinculacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcao_epi_questionarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_epi_questionarios_vinculacao_id_fkey"
            columns: ["vinculacao_id"]
            isOneToOne: false
            referencedRelation: "funcao_epi_vinculacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_epi_vinculacoes: {
        Row: {
          cargo_id: string
          created_at: string
          epi_tipo_id: string
          id: string
          obrigatoriedade: Database["public"]["Enums"]["obrigatoriedade_epi"]
          tenant_id: string
        }
        Insert: {
          cargo_id: string
          created_at?: string
          epi_tipo_id: string
          id?: string
          obrigatoriedade?: Database["public"]["Enums"]["obrigatoriedade_epi"]
          tenant_id: string
        }
        Update: {
          cargo_id?: string
          created_at?: string
          epi_tipo_id?: string
          id?: string
          obrigatoriedade?: Database["public"]["Enums"]["obrigatoriedade_epi"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcao_epi_vinculacoes_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_epi_vinculacoes_epi_tipo_id_fkey"
            columns: ["epi_tipo_id"]
            isOneToOne: false
            referencedRelation: "epi_tipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_epi_vinculacoes_tenant_id_fkey"
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
      funcao_ferramentas: {
        Row: {
          atividade_id: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tenant_id: string
          tipo: Database["public"]["Enums"]["tipo_ferramenta"]
          url_manual: string | null
        }
        Insert: {
          atividade_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tenant_id: string
          tipo?: Database["public"]["Enums"]["tipo_ferramenta"]
          url_manual?: string | null
        }
        Update: {
          atividade_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["tipo_ferramenta"]
          url_manual?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcao_ferramentas_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "funcao_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_ferramentas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_indicadores: {
        Row: {
          cargo_id: string
          created_at: string | null
          descricao: string | null
          id: string
          meta: string | null
          nome: string
          periodicidade: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cargo_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          meta?: string | null
          nome: string
          periodicidade?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cargo_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          meta?: string | null
          nome?: string
          periodicidade?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcao_indicadores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_pop_versoes: {
        Row: {
          alterado_por: string | null
          alterado_por_nome: string | null
          conteudo_snapshot: Json
          created_at: string
          html_snapshot: string | null
          id: string
          motivo_alteracao: string | null
          pop_id: string
          resumo_mudancas: string | null
          status: string
          tenant_id: string
          titulo: string
          versao: string
        }
        Insert: {
          alterado_por?: string | null
          alterado_por_nome?: string | null
          conteudo_snapshot: Json
          created_at?: string
          html_snapshot?: string | null
          id?: string
          motivo_alteracao?: string | null
          pop_id: string
          resumo_mudancas?: string | null
          status: string
          tenant_id: string
          titulo: string
          versao: string
        }
        Update: {
          alterado_por?: string | null
          alterado_por_nome?: string | null
          conteudo_snapshot?: Json
          created_at?: string
          html_snapshot?: string | null
          id?: string
          motivo_alteracao?: string | null
          pop_id?: string
          resumo_mudancas?: string | null
          status?: string
          tenant_id?: string
          titulo?: string
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcao_pop_versoes_pop_id_fkey"
            columns: ["pop_id"]
            isOneToOne: false
            referencedRelation: "funcao_pops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_pop_versoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_pops: {
        Row: {
          aprovado_por: string | null
          aprovado_por_nome: string | null
          atividade_id: string
          cargo_id: string
          codigo: string
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          criterios_qualidade: string | null
          data_aprovacao: string | null
          definicoes: string | null
          epis_sst: string | null
          escopo: string | null
          gerado_por_ia: boolean
          html_completo: string | null
          id: string
          materiais_ferramentas: Json | null
          objetivo: string | null
          pre_requisitos: Json | null
          procedimento_passos: Json | null
          referencias: string | null
          registros_evidencias: string | null
          responsabilidades: Json | null
          status: string
          tenant_id: string
          titulo: string
          tratamento_nao_conformidades: string | null
          updated_at: string
          versao_atual: string
        }
        Insert: {
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
          atividade_id: string
          cargo_id: string
          codigo: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          criterios_qualidade?: string | null
          data_aprovacao?: string | null
          definicoes?: string | null
          epis_sst?: string | null
          escopo?: string | null
          gerado_por_ia?: boolean
          html_completo?: string | null
          id?: string
          materiais_ferramentas?: Json | null
          objetivo?: string | null
          pre_requisitos?: Json | null
          procedimento_passos?: Json | null
          referencias?: string | null
          registros_evidencias?: string | null
          responsabilidades?: Json | null
          status?: string
          tenant_id: string
          titulo: string
          tratamento_nao_conformidades?: string | null
          updated_at?: string
          versao_atual?: string
        }
        Update: {
          aprovado_por?: string | null
          aprovado_por_nome?: string | null
          atividade_id?: string
          cargo_id?: string
          codigo?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          criterios_qualidade?: string | null
          data_aprovacao?: string | null
          definicoes?: string | null
          epis_sst?: string | null
          escopo?: string | null
          gerado_por_ia?: boolean
          html_completo?: string | null
          id?: string
          materiais_ferramentas?: Json | null
          objetivo?: string | null
          pre_requisitos?: Json | null
          procedimento_passos?: Json | null
          referencias?: string | null
          registros_evidencias?: string | null
          responsabilidades?: Json | null
          status?: string
          tenant_id?: string
          titulo?: string
          tratamento_nao_conformidades?: string | null
          updated_at?: string
          versao_atual?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcao_pops_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_responsabilidades: {
        Row: {
          atividade_id: string
          consequencia_erro: string | null
          created_at: string
          id: string
          interfaces: string | null
          responsavel_direto: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          atividade_id: string
          consequencia_erro?: string | null
          created_at?: string
          id?: string
          interfaces?: string | null
          responsavel_direto?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          atividade_id?: string
          consequencia_erro?: string | null
          created_at?: string
          id?: string
          interfaces?: string | null
          responsavel_direto?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcao_responsabilidades_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "funcao_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_responsabilidades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_treinamento_evidencias: {
        Row: {
          aceite_eletronico: boolean | null
          aprovado: boolean | null
          cargo_id: string
          colaborador_cpf: string | null
          colaborador_id: string | null
          colaborador_nome: string
          created_at: string
          data_acesso: string
          data_conclusao: string | null
          detalhes: Json | null
          id: string
          nota: number | null
          nota_minima: number | null
          tenant_id: string
          tentativa: number | null
          tipo_treinamento: string
          vinculacao_id: string | null
        }
        Insert: {
          aceite_eletronico?: boolean | null
          aprovado?: boolean | null
          cargo_id: string
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome: string
          created_at?: string
          data_acesso?: string
          data_conclusao?: string | null
          detalhes?: Json | null
          id?: string
          nota?: number | null
          nota_minima?: number | null
          tenant_id: string
          tentativa?: number | null
          tipo_treinamento?: string
          vinculacao_id?: string | null
        }
        Update: {
          aceite_eletronico?: boolean | null
          aprovado?: boolean | null
          cargo_id?: string
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string
          created_at?: string
          data_acesso?: string
          data_conclusao?: string | null
          detalhes?: Json | null
          id?: string
          nota?: number | null
          nota_minima?: number | null
          tenant_id?: string
          tentativa?: number | null
          tipo_treinamento?: string
          vinculacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcao_treinamento_evidencias_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_treinamento_evidencias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcao_treinamento_evidencias_vinculacao_id_fkey"
            columns: ["vinculacao_id"]
            isOneToOne: false
            referencedRelation: "funcao_epi_vinculacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      funcao_treinamentos: {
        Row: {
          carga_horaria_min: number | null
          cargo_id: string
          created_at: string
          descricao: string | null
          id: string
          obrigatorio: boolean
          tenant_id: string
          tipo: string
          titulo: string
          url: string
        }
        Insert: {
          carga_horaria_min?: number | null
          cargo_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          obrigatorio?: boolean
          tenant_id: string
          tipo?: string
          titulo: string
          url: string
        }
        Update: {
          carga_horaria_min?: number | null
          cargo_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          obrigatorio?: boolean
          tenant_id?: string
          tipo?: string
          titulo?: string
          url?: string
        }
        Relationships: []
      }
      gaf_auditoria: {
        Row: {
          acao: string
          created_at: string | null
          entidade_id: string | null
          entidade_tipo: string
          id: string
          metadados: Json | null
          tenant_id: string
          user_id: string | null
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          entidade_id?: string | null
          entidade_tipo: string
          id?: string
          metadados?: Json | null
          tenant_id: string
          user_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          entidade_id?: string | null
          entidade_tipo?: string
          id?: string
          metadados?: Json | null
          tenant_id?: string
          user_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      gaf_usuarios_perfis: {
        Row: {
          created_at: string | null
          id: string
          perfil: Database["public"]["Enums"]["gaf_perfil"]
          pode_ver_anexos_medicos: boolean | null
          pode_ver_cid: boolean | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          perfil: Database["public"]["Enums"]["gaf_perfil"]
          pode_ver_anexos_medicos?: boolean | null
          pode_ver_cid?: boolean | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          perfil?: Database["public"]["Enums"]["gaf_perfil"]
          pode_ver_anexos_medicos?: boolean | null
          pode_ver_cid?: boolean | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gro_exportacoes_log: {
        Row: {
          campanha_id: string
          exportado_em: string
          id: string
          riscos_gerados: number
          status: string
          tenant_id: string
        }
        Insert: {
          campanha_id: string
          exportado_em?: string
          id?: string
          riscos_gerados?: number
          status?: string
          tenant_id: string
        }
        Update: {
          campanha_id?: string
          exportado_em?: string
          id?: string
          riscos_gerados?: number
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      gro_riscos: {
        Row: {
          acao_id: string | null
          analise_ergonomia_id: string | null
          atividade: string | null
          ativo: boolean
          base_normativa: string[] | null
          campanha_id: string | null
          cargo: string | null
          created_at: string
          descricao: string | null
          dimensao_psicossocial: string | null
          empresa_id: string | null
          ergonomia_risco_id: string | null
          fonte: string
          grupos_expostos: string[] | null
          id: string
          medidas_existentes: string[] | null
          medidas_recomendadas: string[] | null
          necessita_reavaliacao: boolean
          nivel_risco: string
          perigo_identificado: string | null
          probabilidade: string
          reavaliacao_motivo: string | null
          reavaliacao_solicitada_em: string | null
          score_dimensao: number | null
          setor: string | null
          severidade: string
          status_gro: string
          subtipo: string
          tenant_id: string
          titulo: string
          trabalhadores_expostos: number | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          acao_id?: string | null
          analise_ergonomia_id?: string | null
          atividade?: string | null
          ativo?: boolean
          base_normativa?: string[] | null
          campanha_id?: string | null
          cargo?: string | null
          created_at?: string
          descricao?: string | null
          dimensao_psicossocial?: string | null
          empresa_id?: string | null
          ergonomia_risco_id?: string | null
          fonte?: string
          grupos_expostos?: string[] | null
          id?: string
          medidas_existentes?: string[] | null
          medidas_recomendadas?: string[] | null
          necessita_reavaliacao?: boolean
          nivel_risco?: string
          perigo_identificado?: string | null
          probabilidade?: string
          reavaliacao_motivo?: string | null
          reavaliacao_solicitada_em?: string | null
          score_dimensao?: number | null
          setor?: string | null
          severidade?: string
          status_gro?: string
          subtipo: string
          tenant_id: string
          titulo: string
          trabalhadores_expostos?: number | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          acao_id?: string | null
          analise_ergonomia_id?: string | null
          atividade?: string | null
          ativo?: boolean
          base_normativa?: string[] | null
          campanha_id?: string | null
          cargo?: string | null
          created_at?: string
          descricao?: string | null
          dimensao_psicossocial?: string | null
          empresa_id?: string | null
          ergonomia_risco_id?: string | null
          fonte?: string
          grupos_expostos?: string[] | null
          id?: string
          medidas_existentes?: string[] | null
          medidas_recomendadas?: string[] | null
          necessita_reavaliacao?: boolean
          nivel_risco?: string
          perigo_identificado?: string | null
          probabilidade?: string
          reavaliacao_motivo?: string | null
          reavaliacao_solicitada_em?: string | null
          score_dimensao?: number | null
          setor?: string | null
          severidade?: string
          status_gro?: string
          subtipo?: string
          tenant_id?: string
          titulo?: string
          trabalhadores_expostos?: number | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gro_riscos_analise_ergonomia_id_fkey"
            columns: ["analise_ergonomia_id"]
            isOneToOne: false
            referencedRelation: "ergonomia_analises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gro_riscos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gro_riscos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gro_riscos_ergonomia_risco_id_fkey"
            columns: ["ergonomia_risco_id"]
            isOneToOne: false
            referencedRelation: "ergonomia_riscos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gro_riscos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos_economicos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          logo_url: string | null
          nome: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_economicos_tenant_id_fkey"
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
      hub_calendario_envios: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string | null
          dia_limite: number
          id: string
          tenant_id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          descricao?: string | null
          dia_limite: number
          id?: string
          tenant_id: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          dia_limite?: number
          id?: string
          tenant_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_calendario_envios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_calendario_status: {
        Row: {
          calendario_id: string
          competencia: string
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          id: string
          observacoes: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          calendario_id: string
          competencia: string
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          calendario_id?: string
          competencia?: string
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_calendario_status_calendario_id_fkey"
            columns: ["calendario_id"]
            isOneToOne: false
            referencedRelation: "hub_calendario_envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_calendario_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_catalogo_documentos: {
        Row: {
          ativo: boolean
          codigo: string | null
          created_at: string
          id: string
          nome: string
          obrigatoriedade: string
          ordem: number
          prazo_retencao_anos: number | null
          processo_tipo: Database["public"]["Enums"]["hub_processo_tipo"] | null
          requer_assinatura: boolean
          template_url: string | null
          tenant_id: string
          visibilidade_perfis: string[] | null
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          nome: string
          obrigatoriedade?: string
          ordem?: number
          prazo_retencao_anos?: number | null
          processo_tipo?:
            | Database["public"]["Enums"]["hub_processo_tipo"]
            | null
          requer_assinatura?: boolean
          template_url?: string | null
          tenant_id: string
          visibilidade_perfis?: string[] | null
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          nome?: string
          obrigatoriedade?: string
          ordem?: number
          prazo_retencao_anos?: number | null
          processo_tipo?:
            | Database["public"]["Enums"]["hub_processo_tipo"]
            | null
          requer_assinatura?: boolean
          template_url?: string | null
          tenant_id?: string
          visibilidade_perfis?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_catalogo_documentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_certidoes: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          created_at: string
          data_emissao: string
          data_validade: string
          id: string
          numero: string | null
          observacoes: string | null
          orgao_emissor: string
          status: string
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          data_emissao: string
          data_validade: string
          id?: string
          numero?: string | null
          observacoes?: string | null
          orgao_emissor: string
          status?: string
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          data_emissao?: string
          data_validade?: string
          id?: string
          numero?: string | null
          observacoes?: string | null
          orgao_emissor?: string
          status?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_certidoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_checklist_templates: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          item: string
          obrigatorio: boolean
          ordem: number
          tenant_id: string | null
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          item: string
          obrigatorio?: boolean
          ordem?: number
          tenant_id?: string | null
          tipo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          item?: string
          obrigatorio?: boolean
          ordem?: number
          tenant_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_checklist_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_competencias: {
        Row: {
          aprovado_por: string | null
          checklist: Json | null
          competencia: string
          created_at: string
          data_aprovacao: string | null
          data_envio: string | null
          data_finalizacao: string | null
          enviado_por: string | null
          id: string
          observacoes: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          aprovado_por?: string | null
          checklist?: Json | null
          competencia: string
          created_at?: string
          data_aprovacao?: string | null
          data_envio?: string | null
          data_finalizacao?: string | null
          enviado_por?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          aprovado_por?: string | null
          checklist?: Json | null
          competencia?: string
          created_at?: string
          data_aprovacao?: string | null
          data_envio?: string | null
          data_finalizacao?: string | null
          enviado_por?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_competencias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_config: {
        Row: {
          auto_gerar_admissao: boolean
          auto_gerar_advertencia: boolean
          auto_gerar_atestado: boolean
          auto_gerar_demissao: boolean
          auto_gerar_ferias: boolean
          auto_gerar_folha: boolean
          contabilidade_id: string | null
          created_at: string
          empresa_id: string | null
          id: string
          modulo_ativo: boolean
          notificar_email: boolean
          notificar_sistema: boolean
          observacoes: string | null
          sla_admissao: number | null
          sla_advertencia: number | null
          sla_demissao: number | null
          sla_ferias: number | null
          sla_folha: number | null
          sla_geral: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          auto_gerar_admissao?: boolean
          auto_gerar_advertencia?: boolean
          auto_gerar_atestado?: boolean
          auto_gerar_demissao?: boolean
          auto_gerar_ferias?: boolean
          auto_gerar_folha?: boolean
          contabilidade_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          modulo_ativo?: boolean
          notificar_email?: boolean
          notificar_sistema?: boolean
          observacoes?: string | null
          sla_admissao?: number | null
          sla_advertencia?: number | null
          sla_demissao?: number | null
          sla_ferias?: number | null
          sla_folha?: number | null
          sla_geral?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          auto_gerar_admissao?: boolean
          auto_gerar_advertencia?: boolean
          auto_gerar_atestado?: boolean
          auto_gerar_demissao?: boolean
          auto_gerar_ferias?: boolean
          auto_gerar_folha?: boolean
          contabilidade_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          modulo_ativo?: boolean
          notificar_email?: boolean
          notificar_sistema?: boolean
          observacoes?: string | null
          sla_admissao?: number | null
          sla_advertencia?: number | null
          sla_demissao?: number | null
          sla_ferias?: number | null
          sla_folha?: number | null
          sla_geral?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_config_contabilidade_id_fkey"
            columns: ["contabilidade_id"]
            isOneToOne: false
            referencedRelation: "hub_contabilidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_contabilidades: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          email_notificacoes: string | null
          email_principal: string | null
          id: string
          nome: string
          observacoes: string | null
          responsavel_nome: string | null
          telefone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email_notificacoes?: string | null
          email_principal?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          responsavel_nome?: string | null
          telefone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email_notificacoes?: string | null
          email_principal?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          responsavel_nome?: string | null
          telefone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_contabilidades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          colaborador_cpf: string | null
          colaborador_nome: string | null
          competencia: string
          competencia_id: string | null
          created_at: string
          descricao: string | null
          direcao: string
          enviado_por: string | null
          id: string
          observacoes: string | null
          status: string
          tenant_id: string
          tipo: string
          updated_at: string
          versao: number
          versao_anterior_id: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          colaborador_cpf?: string | null
          colaborador_nome?: string | null
          competencia: string
          competencia_id?: string | null
          created_at?: string
          descricao?: string | null
          direcao?: string
          enviado_por?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id: string
          tipo: string
          updated_at?: string
          versao?: number
          versao_anterior_id?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          colaborador_cpf?: string | null
          colaborador_nome?: string | null
          competencia?: string
          competencia_id?: string | null
          created_at?: string
          descricao?: string | null
          direcao?: string
          enviado_por?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
          versao?: number
          versao_anterior_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_documentos_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "hub_competencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_documentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_documentos_versao_anterior_id_fkey"
            columns: ["versao_anterior_id"]
            isOneToOne: false
            referencedRelation: "hub_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_guias: {
        Row: {
          competencia: string
          competencia_id: string | null
          comprovante_nome: string | null
          comprovante_url: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string | null
          id: string
          observacoes: string | null
          status: string
          tenant_id: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          competencia: string
          competencia_id?: string | null
          comprovante_nome?: string | null
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id: string
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          competencia?: string
          competencia_id?: string | null
          comprovante_nome?: string | null
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "hub_guias_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "hub_competencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_guias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_historico: {
        Row: {
          acao: string
          competencia: string | null
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          documento_id: string | null
          id: string
          ip_acesso: string | null
          perfil: string | null
          tenant_id: string
          tipo_documento: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          competencia?: string | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          documento_id?: string | null
          id?: string
          ip_acesso?: string | null
          perfil?: string | null
          tenant_id: string
          tipo_documento?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          competencia?: string | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          documento_id?: string | null
          id?: string
          ip_acesso?: string | null
          perfil?: string | null
          tenant_id?: string
          tipo_documento?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_historico_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_notificacao_config: {
        Row: {
          alertas_cnd: boolean | null
          alertas_competencia: boolean | null
          alertas_envio: boolean | null
          alertas_guias: boolean | null
          alertas_recebimento: boolean | null
          created_at: string
          id: string
          modo: string
          tenant_id: string
          tipo: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alertas_cnd?: boolean | null
          alertas_competencia?: boolean | null
          alertas_envio?: boolean | null
          alertas_guias?: boolean | null
          alertas_recebimento?: boolean | null
          created_at?: string
          id?: string
          modo?: string
          tenant_id: string
          tipo?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alertas_cnd?: boolean | null
          alertas_competencia?: boolean | null
          alertas_envio?: boolean | null
          alertas_guias?: boolean | null
          alertas_recebimento?: boolean | null
          created_at?: string
          id?: string
          modo?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_notificacao_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_processo_assinaturas: {
        Row: {
          assinado_em: string | null
          created_at: string
          documento_id: string | null
          expira_em: string | null
          hash_documento: string | null
          id: string
          imagem_assinatura_url: string | null
          ip_assinatura: string | null
          link_assinatura: string | null
          motivo_recusa: string | null
          ordem: number
          processo_id: string
          recusado_em: string | null
          signatario_cpf: string | null
          signatario_email: string | null
          signatario_nome: string
          signatario_papel: string
          status: Database["public"]["Enums"]["hub_assinatura_status"]
          tenant_id: string
          token: string | null
          updated_at: string
        }
        Insert: {
          assinado_em?: string | null
          created_at?: string
          documento_id?: string | null
          expira_em?: string | null
          hash_documento?: string | null
          id?: string
          imagem_assinatura_url?: string | null
          ip_assinatura?: string | null
          link_assinatura?: string | null
          motivo_recusa?: string | null
          ordem?: number
          processo_id: string
          recusado_em?: string | null
          signatario_cpf?: string | null
          signatario_email?: string | null
          signatario_nome: string
          signatario_papel?: string
          status?: Database["public"]["Enums"]["hub_assinatura_status"]
          tenant_id: string
          token?: string | null
          updated_at?: string
        }
        Update: {
          assinado_em?: string | null
          created_at?: string
          documento_id?: string | null
          expira_em?: string | null
          hash_documento?: string | null
          id?: string
          imagem_assinatura_url?: string | null
          ip_assinatura?: string | null
          link_assinatura?: string | null
          motivo_recusa?: string | null
          ordem?: number
          processo_id?: string
          recusado_em?: string | null
          signatario_cpf?: string | null
          signatario_email?: string | null
          signatario_nome?: string
          signatario_papel?: string
          status?: Database["public"]["Enums"]["hub_assinatura_status"]
          tenant_id?: string
          token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_processo_assinaturas_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "hub_processo_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_processo_assinaturas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "hub_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_processo_assinaturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_processo_checklist: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          descricao: string | null
          id: string
          item: string
          justificativa_excecao: string | null
          obrigatorio: boolean
          ordem: number
          preenchido_automaticamente: boolean
          processo_id: string
          tenant_id: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          item: string
          justificativa_excecao?: string | null
          obrigatorio?: boolean
          ordem?: number
          preenchido_automaticamente?: boolean
          processo_id: string
          tenant_id: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          item?: string
          justificativa_excecao?: string | null
          obrigatorio?: boolean
          ordem?: number
          preenchido_automaticamente?: boolean
          processo_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_processo_checklist_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "hub_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_processo_checklist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_processo_comentarios: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          autor_nome: string
          autor_perfil: string
          conteudo: string
          created_at: string
          eh_interno: boolean
          eh_pendencia: boolean
          id: string
          pendencia_resolvida: boolean
          pendencia_resolvida_em: string | null
          processo_id: string
          tenant_id: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          autor_nome: string
          autor_perfil?: string
          conteudo: string
          created_at?: string
          eh_interno?: boolean
          eh_pendencia?: boolean
          id?: string
          pendencia_resolvida?: boolean
          pendencia_resolvida_em?: string | null
          processo_id: string
          tenant_id: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          autor_nome?: string
          autor_perfil?: string
          conteudo?: string
          created_at?: string
          eh_interno?: boolean
          eh_pendencia?: boolean
          id?: string
          pendencia_resolvida?: boolean
          pendencia_resolvida_em?: string | null
          processo_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_processo_comentarios_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "hub_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_processo_comentarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_processo_documentos: {
        Row: {
          arquivo_mime: string | null
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          assinatura_status:
            | Database["public"]["Enums"]["hub_assinatura_status"]
            | null
          created_at: string
          descricao: string | null
          eh_obrigatorio: boolean
          eh_versao_final: boolean
          enviado_por: string | null
          id: string
          nome: string
          origem: Database["public"]["Enums"]["hub_doc_origem"]
          processo_id: string
          requer_assinatura: boolean
          status: string
          tenant_id: string
          tipo: Database["public"]["Enums"]["hub_doc_tipo"]
          updated_at: string
          versao: number
          versao_anterior_id: string | null
        }
        Insert: {
          arquivo_mime?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          assinatura_status?:
            | Database["public"]["Enums"]["hub_assinatura_status"]
            | null
          created_at?: string
          descricao?: string | null
          eh_obrigatorio?: boolean
          eh_versao_final?: boolean
          enviado_por?: string | null
          id?: string
          nome: string
          origem?: Database["public"]["Enums"]["hub_doc_origem"]
          processo_id: string
          requer_assinatura?: boolean
          status?: string
          tenant_id: string
          tipo?: Database["public"]["Enums"]["hub_doc_tipo"]
          updated_at?: string
          versao?: number
          versao_anterior_id?: string | null
        }
        Update: {
          arquivo_mime?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          assinatura_status?:
            | Database["public"]["Enums"]["hub_assinatura_status"]
            | null
          created_at?: string
          descricao?: string | null
          eh_obrigatorio?: boolean
          eh_versao_final?: boolean
          enviado_por?: string | null
          id?: string
          nome?: string
          origem?: Database["public"]["Enums"]["hub_doc_origem"]
          processo_id?: string
          requer_assinatura?: boolean
          status?: string
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["hub_doc_tipo"]
          updated_at?: string
          versao?: number
          versao_anterior_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_processo_documentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "hub_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_processo_documentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_processo_documentos_versao_anterior_id_fkey"
            columns: ["versao_anterior_id"]
            isOneToOne: false
            referencedRelation: "hub_processo_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_processo_historico: {
        Row: {
          acao: string
          created_at: string
          dados_extras: Json | null
          descricao: string | null
          id: string
          ip: string | null
          perfil: string | null
          processo_id: string
          status_anterior:
            | Database["public"]["Enums"]["hub_processo_status"]
            | null
          status_novo: Database["public"]["Enums"]["hub_processo_status"] | null
          tenant_id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_extras?: Json | null
          descricao?: string | null
          id?: string
          ip?: string | null
          perfil?: string | null
          processo_id: string
          status_anterior?:
            | Database["public"]["Enums"]["hub_processo_status"]
            | null
          status_novo?:
            | Database["public"]["Enums"]["hub_processo_status"]
            | null
          tenant_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_extras?: Json | null
          descricao?: string | null
          id?: string
          ip?: string | null
          perfil?: string | null
          processo_id?: string
          status_anterior?:
            | Database["public"]["Enums"]["hub_processo_status"]
            | null
          status_novo?:
            | Database["public"]["Enums"]["hub_processo_status"]
            | null
          tenant_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_processo_historico_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "hub_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_processo_historico_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_processos: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          codigo: string
          colaborador_cpf: string | null
          colaborador_id: string | null
          colaborador_matricula: string | null
          colaborador_nome: string | null
          competencia: string | null
          concluido_em: string | null
          contabilidade_id: string | null
          created_at: string
          data_limite: string | null
          data_referencia: string | null
          descricao: string | null
          empresa_id: string | null
          enviado_em: string | null
          enviado_por: string | null
          gerado_automaticamente: boolean
          id: string
          motivo_cancelamento: string | null
          observacoes_internas: string | null
          origem_descricao: string | null
          origem_modulo: string | null
          origem_registro_id: string | null
          prioridade: Database["public"]["Enums"]["hub_prioridade"]
          processado_em: string | null
          protocolo_externo: string | null
          recebido_em: string | null
          sla_horas: number | null
          sla_status: string | null
          sla_vencimento: string | null
          status: Database["public"]["Enums"]["hub_processo_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["hub_processo_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          codigo?: string
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_matricula?: string | null
          colaborador_nome?: string | null
          competencia?: string | null
          concluido_em?: string | null
          contabilidade_id?: string | null
          created_at?: string
          data_limite?: string | null
          data_referencia?: string | null
          descricao?: string | null
          empresa_id?: string | null
          enviado_em?: string | null
          enviado_por?: string | null
          gerado_automaticamente?: boolean
          id?: string
          motivo_cancelamento?: string | null
          observacoes_internas?: string | null
          origem_descricao?: string | null
          origem_modulo?: string | null
          origem_registro_id?: string | null
          prioridade?: Database["public"]["Enums"]["hub_prioridade"]
          processado_em?: string | null
          protocolo_externo?: string | null
          recebido_em?: string | null
          sla_horas?: number | null
          sla_status?: string | null
          sla_vencimento?: string | null
          status?: Database["public"]["Enums"]["hub_processo_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["hub_processo_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          codigo?: string
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_matricula?: string | null
          colaborador_nome?: string | null
          competencia?: string | null
          concluido_em?: string | null
          contabilidade_id?: string | null
          created_at?: string
          data_limite?: string | null
          data_referencia?: string | null
          descricao?: string | null
          empresa_id?: string | null
          enviado_em?: string | null
          enviado_por?: string | null
          gerado_automaticamente?: boolean
          id?: string
          motivo_cancelamento?: string | null
          observacoes_internas?: string | null
          origem_descricao?: string | null
          origem_modulo?: string | null
          origem_registro_id?: string | null
          prioridade?: Database["public"]["Enums"]["hub_prioridade"]
          processado_em?: string | null
          protocolo_externo?: string | null
          recebido_em?: string | null
          sla_horas?: number | null
          sla_status?: string | null
          sla_vencimento?: string | null
          status?: Database["public"]["Enums"]["hub_processo_status"]
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["hub_processo_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_processos_contabilidade_id_fkey"
            columns: ["contabilidade_id"]
            isOneToOne: false
            referencedRelation: "hub_contabilidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_processos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_processos_tenant_id_fkey"
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
      jornada_alertas: {
        Row: {
          acao_sugerida: string | null
          analise_id: string | null
          colaborador_cpf: string | null
          colaborador_nome: string | null
          created_at: string
          data_referencia: string | null
          departamento: string | null
          descricao: string | null
          id: string
          lido: boolean | null
          resolvido: boolean | null
          resolvido_em: string | null
          resolvido_por: string | null
          setor: string | null
          severidade: string
          tenant_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          acao_sugerida?: string | null
          analise_id?: string | null
          colaborador_cpf?: string | null
          colaborador_nome?: string | null
          created_at?: string
          data_referencia?: string | null
          departamento?: string | null
          descricao?: string | null
          id?: string
          lido?: boolean | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          setor?: string | null
          severidade?: string
          tenant_id: string
          tipo: string
          titulo: string
        }
        Update: {
          acao_sugerida?: string | null
          analise_id?: string | null
          colaborador_cpf?: string | null
          colaborador_nome?: string | null
          created_at?: string
          data_referencia?: string | null
          departamento?: string | null
          descricao?: string | null
          id?: string
          lido?: boolean | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          setor?: string | null
          severidade?: string
          tenant_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornada_alertas_analise_id_fkey"
            columns: ["analise_id"]
            isOneToOne: false
            referencedRelation: "jornada_analises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_alertas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_analises: {
        Row: {
          cargo: string | null
          colaborador_cpf: string
          colaborador_nome: string
          created_at: string
          departamento: string | null
          detalhes_conformidade: Json | null
          dias_trabalhados: number | null
          gestor: string | null
          id: string
          media_diaria_horas: number | null
          media_semanal_horas: number | null
          nivel_risco: string
          periodo_fim: string
          periodo_inicio: string
          score_risco: number | null
          setor: string | null
          status_conformidade: string
          tenant_id: string
          total_ajustes_manuais: number | null
          total_atrasos: number | null
          total_horas_extras: number | null
          total_horas_trabalhadas: number | null
          unidade: string | null
          updated_at: string
          violacoes_dsr: number | null
          violacoes_horas_extras: number | null
          violacoes_interjornada: number | null
          violacoes_intervalo: number | null
          violacoes_jornada_diaria: number | null
        }
        Insert: {
          cargo?: string | null
          colaborador_cpf: string
          colaborador_nome: string
          created_at?: string
          departamento?: string | null
          detalhes_conformidade?: Json | null
          dias_trabalhados?: number | null
          gestor?: string | null
          id?: string
          media_diaria_horas?: number | null
          media_semanal_horas?: number | null
          nivel_risco?: string
          periodo_fim: string
          periodo_inicio: string
          score_risco?: number | null
          setor?: string | null
          status_conformidade?: string
          tenant_id: string
          total_ajustes_manuais?: number | null
          total_atrasos?: number | null
          total_horas_extras?: number | null
          total_horas_trabalhadas?: number | null
          unidade?: string | null
          updated_at?: string
          violacoes_dsr?: number | null
          violacoes_horas_extras?: number | null
          violacoes_interjornada?: number | null
          violacoes_intervalo?: number | null
          violacoes_jornada_diaria?: number | null
        }
        Update: {
          cargo?: string | null
          colaborador_cpf?: string
          colaborador_nome?: string
          created_at?: string
          departamento?: string | null
          detalhes_conformidade?: Json | null
          dias_trabalhados?: number | null
          gestor?: string | null
          id?: string
          media_diaria_horas?: number | null
          media_semanal_horas?: number | null
          nivel_risco?: string
          periodo_fim?: string
          periodo_inicio?: string
          score_risco?: number | null
          setor?: string | null
          status_conformidade?: string
          tenant_id?: string
          total_ajustes_manuais?: number | null
          total_atrasos?: number | null
          total_horas_extras?: number | null
          total_horas_trabalhadas?: number | null
          unidade?: string | null
          updated_at?: string
          violacoes_dsr?: number | null
          violacoes_horas_extras?: number | null
          violacoes_interjornada?: number | null
          violacoes_intervalo?: number | null
          violacoes_jornada_diaria?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jornada_analises_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          created_at: string
          enviado_por: string | null
          enviado_por_id: string | null
          id: string
          nome: string
          observacoes: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          tenant_id: string
          tipo: string
          vinculo_tipo: string | null
          vinculo_valor: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string
          enviado_por?: string | null
          enviado_por_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          tenant_id: string
          tipo?: string
          vinculo_tipo?: string | null
          vinculo_valor?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string
          enviado_por?: string | null
          enviado_por_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          tenant_id?: string
          tipo?: string
          vinculo_tipo?: string | null
          vinculo_valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jornada_documentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_importacoes: {
        Row: {
          created_at: string
          erros: Json | null
          id: string
          importado_por: string | null
          importado_por_id: string | null
          mapeamento_colunas: Json | null
          nome_arquivo: string
          periodo_fim: string | null
          periodo_inicio: string | null
          registros_erros: number | null
          registros_importados: number | null
          status: string
          tenant_id: string
          tipo_arquivo: string
          total_registros: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          erros?: Json | null
          id?: string
          importado_por?: string | null
          importado_por_id?: string | null
          mapeamento_colunas?: Json | null
          nome_arquivo: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          registros_erros?: number | null
          registros_importados?: number | null
          status?: string
          tenant_id: string
          tipo_arquivo?: string
          total_registros?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          erros?: Json | null
          id?: string
          importado_por?: string | null
          importado_por_id?: string | null
          mapeamento_colunas?: Json | null
          nome_arquivo?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          registros_erros?: number | null
          registros_importados?: number | null
          status?: string
          tenant_id?: string
          tipo_arquivo?: string
          total_registros?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornada_importacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_parametros: {
        Row: {
          ativo: boolean
          created_at: string
          descanso_interjornada_min: number
          descanso_semanal_min: number
          horas_extras_diaria_max: number
          id: string
          intervalo_intrajornada_min: number
          jornada_diaria_max: number
          jornada_semanal_max: number
          nome: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descanso_interjornada_min?: number
          descanso_semanal_min?: number
          horas_extras_diaria_max?: number
          id?: string
          intervalo_intrajornada_min?: number
          jornada_diaria_max?: number
          jornada_semanal_max?: number
          nome?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descanso_interjornada_min?: number
          descanso_semanal_min?: number
          horas_extras_diaria_max?: number
          id?: string
          intervalo_intrajornada_min?: number
          jornada_diaria_max?: number
          jornada_semanal_max?: number
          nome?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornada_parametros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_templates_mapeamento: {
        Row: {
          created_at: string
          criado_por: string | null
          criado_por_id: string | null
          descricao: string | null
          headers_originais: string[] | null
          id: string
          mapeamento: Json
          nome: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          criado_por_id?: string | null
          descricao?: string | null
          headers_originais?: string[] | null
          id?: string
          mapeamento?: Json
          nome: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          criado_por_id?: string | null
          descricao?: string | null
          headers_originais?: string[] | null
          id?: string
          mapeamento?: Json
          nome?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornada_templates_mapeamento_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_leads: {
        Row: {
          cargo: string | null
          convertido: boolean | null
          created_at: string | null
          diagnostico_resultado: Json | null
          email: string
          empresa: string | null
          id: string
          ip_address: string | null
          landing_page_origem: string | null
          nome: string
          num_funcionarios: string | null
          perfil_diagnostico: string | null
          pontuacao_diagnostico: number | null
          setor: string | null
          telefone: string | null
          updated_at: string | null
          urgencia: string | null
        }
        Insert: {
          cargo?: string | null
          convertido?: boolean | null
          created_at?: string | null
          diagnostico_resultado?: Json | null
          email: string
          empresa?: string | null
          id?: string
          ip_address?: string | null
          landing_page_origem?: string | null
          nome: string
          num_funcionarios?: string | null
          perfil_diagnostico?: string | null
          pontuacao_diagnostico?: number | null
          setor?: string | null
          telefone?: string | null
          updated_at?: string | null
          urgencia?: string | null
        }
        Update: {
          cargo?: string | null
          convertido?: boolean | null
          created_at?: string | null
          diagnostico_resultado?: Json | null
          email?: string
          empresa?: string | null
          id?: string
          ip_address?: string | null
          landing_page_origem?: string | null
          nome?: string
          num_funcionarios?: string | null
          perfil_diagnostico?: string | null
          pontuacao_diagnostico?: number | null
          setor?: string | null
          telefone?: string | null
          updated_at?: string | null
          urgencia?: string | null
        }
        Relationships: []
      }
      landing_vagas: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          total_vagas: number
          updated_at: string | null
          vagas_preenchidas: number
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          total_vagas?: number
          updated_at?: string | null
          vagas_preenchidas?: number
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          total_vagas?: number
          updated_at?: string | null
          vagas_preenchidas?: number
        }
        Relationships: []
      }
      lead_interacoes: {
        Row: {
          conteudo: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          metadata: Json | null
          tipo: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          tipo: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_interacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          cargo: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          empresa: string | null
          id: string
          landing_lead_id: string | null
          nome: string
          notas: string | null
          origem: Database["public"]["Enums"]["lead_origem"]
          proxima_acao_data: string | null
          proxima_acao_descricao: string | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[] | null
          telefone: string | null
          tenant_convertido_id: string | null
          ultimo_contato_at: string | null
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          landing_lead_id?: string | null
          nome: string
          notas?: string | null
          origem?: Database["public"]["Enums"]["lead_origem"]
          proxima_acao_data?: string | null
          proxima_acao_descricao?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          telefone?: string | null
          tenant_convertido_id?: string | null
          ultimo_contato_at?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          cargo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          landing_lead_id?: string | null
          nome?: string
          notas?: string | null
          origem?: Database["public"]["Enums"]["lead_origem"]
          proxima_acao_data?: string | null
          proxima_acao_descricao?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          telefone?: string | null
          tenant_convertido_id?: string | null
          ultimo_contato_at?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_landing_lead_id_fkey"
            columns: ["landing_lead_id"]
            isOneToOne: false
            referencedRelation: "landing_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_convertido_id_fkey"
            columns: ["tenant_convertido_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lembretes_dispensados: {
        Row: {
          chave: string
          dispensado_em: string
          id: string
          tenant_id: string
          usuario_id: string
        }
        Insert: {
          chave: string
          dispensado_em?: string
          id?: string
          tenant_id: string
          usuario_id: string
        }
        Update: {
          chave?: string
          dispensado_em?: string
          id?: string
          tenant_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_dispensados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      manuais_gerados: {
        Row: {
          created_at: string
          documento_id: string | null
          empresa_id: string | null
          gerado_por: string | null
          gerado_por_nome: string | null
          html: string
          id: string
          referencia_id: string | null
          tenant_id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          documento_id?: string | null
          empresa_id?: string | null
          gerado_por?: string | null
          gerado_por_nome?: string | null
          html: string
          id?: string
          referencia_id?: string | null
          tenant_id: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          documento_id?: string | null
          empresa_id?: string | null
          gerado_por?: string | null
          gerado_por_nome?: string | null
          html?: string
          id?: string
          referencia_id?: string | null
          tenant_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manuais_gerados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manuais_gerados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_funcao_assinaturas: {
        Row: {
          assinatura_colaborador: Json | null
          assinatura_gestor: Json | null
          cargo_id: string
          cargo_nome: string
          colaborador_cpf: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          data_assinatura_colaborador: string | null
          data_assinatura_gestor: string | null
          data_conclusao: string | null
          data_envio: string
          documento_arquivado_id: string | null
          empresa_id: string | null
          enviado_por: string | null
          enviado_por_nome: string | null
          gestor_cpf: string | null
          gestor_email: string | null
          gestor_id: string | null
          gestor_nome: string | null
          id: string
          manual_html_snapshot: string
          manual_titulo: string | null
          observacoes: string | null
          pdf_storage_path: string | null
          status: string
          tenant_id: string
          termo_html: string
          updated_at: string
        }
        Insert: {
          assinatura_colaborador?: Json | null
          assinatura_gestor?: Json | null
          cargo_id: string
          cargo_nome: string
          colaborador_cpf?: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          data_assinatura_colaborador?: string | null
          data_assinatura_gestor?: string | null
          data_conclusao?: string | null
          data_envio?: string
          documento_arquivado_id?: string | null
          empresa_id?: string | null
          enviado_por?: string | null
          enviado_por_nome?: string | null
          gestor_cpf?: string | null
          gestor_email?: string | null
          gestor_id?: string | null
          gestor_nome?: string | null
          id?: string
          manual_html_snapshot: string
          manual_titulo?: string | null
          observacoes?: string | null
          pdf_storage_path?: string | null
          status?: string
          tenant_id: string
          termo_html: string
          updated_at?: string
        }
        Update: {
          assinatura_colaborador?: Json | null
          assinatura_gestor?: Json | null
          cargo_id?: string
          cargo_nome?: string
          colaborador_cpf?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          data_assinatura_colaborador?: string | null
          data_assinatura_gestor?: string | null
          data_conclusao?: string | null
          data_envio?: string
          documento_arquivado_id?: string | null
          empresa_id?: string | null
          enviado_por?: string | null
          enviado_por_nome?: string | null
          gestor_cpf?: string | null
          gestor_email?: string | null
          gestor_id?: string | null
          gestor_nome?: string | null
          id?: string
          manual_html_snapshot?: string
          manual_titulo?: string | null
          observacoes?: string | null
          pdf_storage_path?: string | null
          status?: string
          tenant_id?: string
          termo_html?: string
          updated_at?: string
        }
        Relationships: []
      }
      manual_funcao_links: {
        Row: {
          assinatura_id: string
          created_at: string
          expires_at: string
          id: string
          tenant_id: string
          tipo_assinante: string
          token: string
          used_at: string | null
        }
        Insert: {
          assinatura_id: string
          created_at?: string
          expires_at?: string
          id?: string
          tenant_id: string
          tipo_assinante: string
          token: string
          used_at?: string | null
        }
        Update: {
          assinatura_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          tenant_id?: string
          tipo_assinante?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_funcao_links_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "manual_funcao_assinaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_afiliados_comissoes: {
        Row: {
          created_at: string
          id: string
          profissional_id: string
          status: string | null
          tenant_indicado_id: string | null
          tipo: string | null
          valor: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          profissional_id: string
          status?: string | null
          tenant_indicado_id?: string | null
          tipo?: string | null
          valor?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          profissional_id?: string
          status?: string | null
          tenant_indicado_id?: string | null
          tipo?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_afiliados_comissoes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_afiliados_comissoes_tenant_indicado_id_fkey"
            columns: ["tenant_indicado_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_audit_log: {
        Row: {
          acao: string
          contratacao_id: string | null
          created_at: string
          dados: Json | null
          descricao: string | null
          id: string
          profissional_id: string | null
          tenant_id: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          contratacao_id?: string | null
          created_at?: string
          dados?: Json | null
          descricao?: string | null
          id?: string
          profissional_id?: string | null
          tenant_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          contratacao_id?: string | null
          created_at?: string
          dados?: Json | null
          descricao?: string | null
          id?: string
          profissional_id?: string | null
          tenant_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_audit_log_contratacao_id_fkey"
            columns: ["contratacao_id"]
            isOneToOne: false
            referencedRelation: "marketplace_contratacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_audit_log_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_avaliacoes: {
        Row: {
          aderencia_escopo: number | null
          avaliador_id: string | null
          clareza: number | null
          comentario: string | null
          contratacao_id: string
          created_at: string
          id: string
          nota_geral: number | null
          pontualidade: number | null
          profissional_id: string
          profissionalismo: number | null
          servico_id: string
          tenant_id: string
        }
        Insert: {
          aderencia_escopo?: number | null
          avaliador_id?: string | null
          clareza?: number | null
          comentario?: string | null
          contratacao_id: string
          created_at?: string
          id?: string
          nota_geral?: number | null
          pontualidade?: number | null
          profissional_id: string
          profissionalismo?: number | null
          servico_id: string
          tenant_id: string
        }
        Update: {
          aderencia_escopo?: number | null
          avaliador_id?: string | null
          clareza?: number | null
          comentario?: string | null
          contratacao_id?: string
          created_at?: string
          id?: string
          nota_geral?: number | null
          pontualidade?: number | null
          profissional_id?: string
          profissionalismo?: number | null
          servico_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_avaliacoes_contratacao_id_fkey"
            columns: ["contratacao_id"]
            isOneToOne: false
            referencedRelation: "marketplace_contratacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_avaliacoes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_avaliacoes_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "marketplace_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_avaliacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_categorias: {
        Row: {
          ativo: boolean | null
          created_at: string
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_contratacoes: {
        Row: {
          acao_vinculada_id: string | null
          created_at: string
          data_agendamento: string | null
          data_conclusao: string | null
          duracao_minutos: number | null
          hora_agendamento: string | null
          id: string
          modalidade: Database["public"]["Enums"]["marketplace_servico_modalidade"]
          observacoes: string | null
          profissional_confirmou: boolean | null
          profissional_id: string
          servico_id: string
          solicitante_id: string | null
          solicitante_nome: string | null
          status:
            | Database["public"]["Enums"]["marketplace_contratacao_status"]
            | null
          tenant_id: string
          termo_aceito: boolean | null
          termo_aceito_data: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          acao_vinculada_id?: string | null
          created_at?: string
          data_agendamento?: string | null
          data_conclusao?: string | null
          duracao_minutos?: number | null
          hora_agendamento?: string | null
          id?: string
          modalidade: Database["public"]["Enums"]["marketplace_servico_modalidade"]
          observacoes?: string | null
          profissional_confirmou?: boolean | null
          profissional_id: string
          servico_id: string
          solicitante_id?: string | null
          solicitante_nome?: string | null
          status?:
            | Database["public"]["Enums"]["marketplace_contratacao_status"]
            | null
          tenant_id: string
          termo_aceito?: boolean | null
          termo_aceito_data?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          acao_vinculada_id?: string | null
          created_at?: string
          data_agendamento?: string | null
          data_conclusao?: string | null
          duracao_minutos?: number | null
          hora_agendamento?: string | null
          id?: string
          modalidade?: Database["public"]["Enums"]["marketplace_servico_modalidade"]
          observacoes?: string | null
          profissional_confirmou?: boolean | null
          profissional_id?: string
          servico_id?: string
          solicitante_id?: string | null
          solicitante_nome?: string | null
          status?:
            | Database["public"]["Enums"]["marketplace_contratacao_status"]
            | null
          tenant_id?: string
          termo_aceito?: boolean | null
          termo_aceito_data?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_contratacoes_acao_vinculada_id_fkey"
            columns: ["acao_vinculada_id"]
            isOneToOne: false
            referencedRelation: "plano_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_contratacoes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_contratacoes_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "marketplace_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_contratacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_denuncias: {
        Row: {
          acao_tomada: string | null
          analisado_em: string | null
          analisado_por: string | null
          contratacao_id: string | null
          created_at: string
          denunciante_id: string | null
          denunciante_nome: string | null
          descricao: string
          evidencias: string[] | null
          gravidade: string
          id: string
          profissional_id: string
          status: string
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          acao_tomada?: string | null
          analisado_em?: string | null
          analisado_por?: string | null
          contratacao_id?: string | null
          created_at?: string
          denunciante_id?: string | null
          denunciante_nome?: string | null
          descricao: string
          evidencias?: string[] | null
          gravidade?: string
          id?: string
          profissional_id: string
          status?: string
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          acao_tomada?: string | null
          analisado_em?: string | null
          analisado_por?: string | null
          contratacao_id?: string | null
          created_at?: string
          denunciante_id?: string | null
          denunciante_nome?: string | null
          descricao?: string
          evidencias?: string[] | null
          gravidade?: string
          id?: string
          profissional_id?: string
          status?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_denuncias_contratacao_id_fkey"
            columns: ["contratacao_id"]
            isOneToOne: false
            referencedRelation: "marketplace_contratacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_denuncias_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_denuncias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_escopo_habilitacao: {
        Row: {
          categoria_id: string | null
          categoria_nome: string
          conselho: string
          created_at: string
          descricao: string | null
          id: string
        }
        Insert: {
          categoria_id?: string | null
          categoria_nome: string
          conselho: string
          created_at?: string
          descricao?: string | null
          id?: string
        }
        Update: {
          categoria_id?: string | null
          categoria_nome?: string
          conselho?: string
          created_at?: string
          descricao?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_escopo_habilitacao_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_pacotes: {
        Row: {
          ativo: boolean
          created_at: string
          desconto_percentual: number | null
          descricao: string | null
          duracao_total_minutos: number | null
          id: string
          modalidade: string
          nome: string
          preco_individual_soma: number | null
          preco_pacote: number
          profissional_id: string
          publico_alvo: string | null
          servicos_ids: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          desconto_percentual?: number | null
          descricao?: string | null
          duracao_total_minutos?: number | null
          id?: string
          modalidade?: string
          nome: string
          preco_individual_soma?: number | null
          preco_pacote: number
          profissional_id: string
          publico_alvo?: string | null
          servicos_ids?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          desconto_percentual?: number | null
          descricao?: string | null
          duracao_total_minutos?: number | null
          id?: string
          modalidade?: string
          nome?: string
          preco_individual_soma?: number | null
          preco_pacote?: number
          profissional_id?: string
          publico_alvo?: string | null
          servicos_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_pacotes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_profissionais: {
        Row: {
          aceite_codigo_etica: boolean | null
          aceite_codigo_etica_data: string | null
          areas_atuacao: string[] | null
          bio: string | null
          certificacoes: string[] | null
          cidade: string | null
          codigo_afiliado: string | null
          conselho: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string
          especialidades: string[] | null
          estado: string | null
          formacao_academica: string | null
          foto_url: string | null
          id: string
          latitude: number | null
          link_afiliado: string | null
          longitude: number | null
          modalidades_atendimento:
            | Database["public"]["Enums"]["marketplace_servico_modalidade"][]
            | null
          nome_completo: string
          nota_media: number | null
          plano: Database["public"]["Enums"]["marketplace_plano_tipo"] | null
          registro_profissional: string | null
          registro_validade: string | null
          selo_verificado: boolean | null
          status:
            | Database["public"]["Enums"]["marketplace_profissional_status"]
            | null
          telefone: string | null
          tem_atestado_capacidade: boolean
          tenant_id: string | null
          total_avaliacoes: number | null
          total_servicos_executados: number | null
          uf_registro: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aceite_codigo_etica?: boolean | null
          aceite_codigo_etica_data?: string | null
          areas_atuacao?: string[] | null
          bio?: string | null
          certificacoes?: string[] | null
          cidade?: string | null
          codigo_afiliado?: string | null
          conselho?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email: string
          especialidades?: string[] | null
          estado?: string | null
          formacao_academica?: string | null
          foto_url?: string | null
          id?: string
          latitude?: number | null
          link_afiliado?: string | null
          longitude?: number | null
          modalidades_atendimento?:
            | Database["public"]["Enums"]["marketplace_servico_modalidade"][]
            | null
          nome_completo: string
          nota_media?: number | null
          plano?: Database["public"]["Enums"]["marketplace_plano_tipo"] | null
          registro_profissional?: string | null
          registro_validade?: string | null
          selo_verificado?: boolean | null
          status?:
            | Database["public"]["Enums"]["marketplace_profissional_status"]
            | null
          telefone?: string | null
          tem_atestado_capacidade?: boolean
          tenant_id?: string | null
          total_avaliacoes?: number | null
          total_servicos_executados?: number | null
          uf_registro?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aceite_codigo_etica?: boolean | null
          aceite_codigo_etica_data?: string | null
          areas_atuacao?: string[] | null
          bio?: string | null
          certificacoes?: string[] | null
          cidade?: string | null
          codigo_afiliado?: string | null
          conselho?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string
          especialidades?: string[] | null
          estado?: string | null
          formacao_academica?: string | null
          foto_url?: string | null
          id?: string
          latitude?: number | null
          link_afiliado?: string | null
          longitude?: number | null
          modalidades_atendimento?:
            | Database["public"]["Enums"]["marketplace_servico_modalidade"][]
            | null
          nome_completo?: string
          nota_media?: number | null
          plano?: Database["public"]["Enums"]["marketplace_plano_tipo"] | null
          registro_profissional?: string | null
          registro_validade?: string | null
          selo_verificado?: boolean | null
          status?:
            | Database["public"]["Enums"]["marketplace_profissional_status"]
            | null
          telefone?: string | null
          tem_atestado_capacidade?: boolean
          tenant_id?: string | null
          total_avaliacoes?: number | null
          total_servicos_executados?: number | null
          uf_registro?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_profissionais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_profissional_documentos: {
        Row: {
          arquivo_url: string
          categoria: string
          created_at: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          profissional_id: string
          tamanho_bytes: number | null
        }
        Insert: {
          arquivo_url: string
          categoria: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          profissional_id: string
          tamanho_bytes?: number | null
        }
        Update: {
          arquivo_url?: string
          categoria?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          profissional_id?: string
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_profissional_documentos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_servicos: {
        Row: {
          ativo: boolean | null
          base_legal: string | null
          categoria_id: string | null
          created_at: string
          descricao: string
          duracao_estimada_minutos: number | null
          evidencia_minima: string | null
          id: string
          modalidade: Database["public"]["Enums"]["marketplace_servico_modalidade"]
          nome: string
          preco_referencia: number | null
          profissional_id: string
          publico_alvo: string | null
          updated_at: string
          vinculo_tipo_acao: string | null
        }
        Insert: {
          ativo?: boolean | null
          base_legal?: string | null
          categoria_id?: string | null
          created_at?: string
          descricao: string
          duracao_estimada_minutos?: number | null
          evidencia_minima?: string | null
          id?: string
          modalidade?: Database["public"]["Enums"]["marketplace_servico_modalidade"]
          nome: string
          preco_referencia?: number | null
          profissional_id: string
          publico_alvo?: string | null
          updated_at?: string
          vinculo_tipo_acao?: string | null
        }
        Update: {
          ativo?: boolean | null
          base_legal?: string | null
          categoria_id?: string | null
          created_at?: string
          descricao?: string
          duracao_estimada_minutos?: number | null
          evidencia_minima?: string | null
          id?: string
          modalidade?: Database["public"]["Enums"]["marketplace_servico_modalidade"]
          nome?: string
          preco_referencia?: number | null
          profissional_id?: string
          publico_alvo?: string | null
          updated_at?: string
          vinculo_tipo_acao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_servicos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_servicos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "marketplace_profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_acao_tempo: {
        Row: {
          acao_id: string
          created_at: string | null
          id: string
          meta_id: string
          observacao: string | null
          registrado_por: string | null
          registrado_por_nome: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          acao_id: string
          created_at?: string | null
          id?: string
          meta_id: string
          observacao?: string | null
          registrado_por?: string | null
          registrado_por_nome?: string | null
          tenant_id: string
          tipo: string
        }
        Update: {
          acao_id?: string
          created_at?: string | null
          id?: string
          meta_id?: string
          observacao?: string | null
          registrado_por?: string | null
          registrado_por_nome?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_acao_tempo_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "meta_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_acao_tempo_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_acao_tempo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_acoes: {
        Row: {
          created_at: string | null
          descricao: string
          evidencia_esperada: string | null
          id: string
          meta_id: string
          ordem: number | null
          prazo: string | null
          prioridade: string | null
          progresso: number | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status: string | null
          tenant_id: string
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao: string
          evidencia_esperada?: string | null
          id?: string
          meta_id: string
          ordem?: number | null
          prazo?: string | null
          prioridade?: string | null
          progresso?: number | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string | null
          tenant_id: string
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string
          evidencia_esperada?: string | null
          id?: string
          meta_id?: string
          ordem?: number | null
          prazo?: string | null
          prioridade?: string | null
          progresso?: number | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string | null
          tenant_id?: string
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_acoes_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_acoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_aem: {
        Row: {
          colaborador_observacao: string | null
          colaborador_sinaliza_dificuldade: boolean | null
          colaborador_validou: boolean | null
          colaborador_validou_em: string | null
          compativel_competencias: string | null
          compativel_funcao: string | null
          created_at: string | null
          exige_atencao_continua: boolean | null
          exige_horas_extras: string | null
          exigencia_cognitiva: string | null
          exigencia_emocional: string | null
          exigencia_fisica: string | null
          grau_autonomia: string | null
          id: string
          ierm_nivel: string | null
          ierm_score: number | null
          impacta_jornada: boolean | null
          meta_id: string
          possibilidade_ajuste_metodo: string | null
          preenchido_por: string | null
          preenchido_por_nome: string | null
          pressao_prazo: string | null
          revisado_em: string | null
          revisado_por: string | null
          revisado_por_nome: string | null
          ritmo_imposto: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          colaborador_observacao?: string | null
          colaborador_sinaliza_dificuldade?: boolean | null
          colaborador_validou?: boolean | null
          colaborador_validou_em?: string | null
          compativel_competencias?: string | null
          compativel_funcao?: string | null
          created_at?: string | null
          exige_atencao_continua?: boolean | null
          exige_horas_extras?: string | null
          exigencia_cognitiva?: string | null
          exigencia_emocional?: string | null
          exigencia_fisica?: string | null
          grau_autonomia?: string | null
          id?: string
          ierm_nivel?: string | null
          ierm_score?: number | null
          impacta_jornada?: boolean | null
          meta_id: string
          possibilidade_ajuste_metodo?: string | null
          preenchido_por?: string | null
          preenchido_por_nome?: string | null
          pressao_prazo?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          revisado_por_nome?: string | null
          ritmo_imposto?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          colaborador_observacao?: string | null
          colaborador_sinaliza_dificuldade?: boolean | null
          colaborador_validou?: boolean | null
          colaborador_validou_em?: string | null
          compativel_competencias?: string | null
          compativel_funcao?: string | null
          created_at?: string | null
          exige_atencao_continua?: boolean | null
          exige_horas_extras?: string | null
          exigencia_cognitiva?: string | null
          exigencia_emocional?: string | null
          exigencia_fisica?: string | null
          grau_autonomia?: string | null
          id?: string
          ierm_nivel?: string | null
          ierm_score?: number | null
          impacta_jornada?: boolean | null
          meta_id?: string
          possibilidade_ajuste_metodo?: string | null
          preenchido_por?: string | null
          preenchido_por_nome?: string | null
          pressao_prazo?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          revisado_por_nome?: string | null
          ritmo_imposto?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_aem_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_aem_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_historico: {
        Row: {
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          id: string
          meta_id: string
          tenant_id: string
          tipo: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          meta_id: string
          tenant_id: string
          tipo: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          meta_id?: string
          tenant_id?: string
          tipo?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_historico_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_historico_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          aprovador_id: string | null
          aprovador_nome: string | null
          categoria_meta: string | null
          ciclo_avaliacao_id: string | null
          colaborador_id: string | null
          colaborador_nome: string | null
          compartilhada: boolean | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_aprovacao: string | null
          data_fim: string | null
          data_inicio: string | null
          departamento_id: string | null
          departamento_nome: string | null
          descricao: string | null
          empresa_id: string | null
          formula_medicao: string | null
          id: string
          ierm_calculado_em: string | null
          ierm_nivel: string | null
          ierm_score: number | null
          indicador_direcao:
            | Database["public"]["Enums"]["indicador_direcao"]
            | null
          indicador_nome: string | null
          indicador_tipo: Database["public"]["Enums"]["indicador_tipo"] | null
          indicador_unidade: string | null
          justificativa_aprovacao: string | null
          meta_pai_id: string | null
          nivel: Database["public"]["Enums"]["meta_nivel"] | null
          objetivo_estrategico: string | null
          origem_meta: string | null
          origem_referencia_id: string | null
          periodo: Database["public"]["Enums"]["meta_periodo"]
          peso: number | null
          premiacao_atingida: boolean | null
          premiacao_descricao: string | null
          premiacao_tipo: string | null
          premiacao_valor: number | null
          progresso: number
          responsavel_id: string | null
          responsavel_nome: string | null
          risco_descricao: string | null
          risco_ia: string | null
          risco_nivel: string | null
          setor_id: string | null
          setor_nome: string | null
          status: Database["public"]["Enums"]["meta_status"]
          sugestao_ia: Json | null
          swot_id: string | null
          tags: string[] | null
          tenant_id: string
          tipo: string
          titulo: string
          trimestre: number | null
          unidade_id: string | null
          unidade_nome: string | null
          updated_at: string
          valor_alvo: number | null
          valor_atual: number | null
          valor_baseline: number | null
          valor_maximo: number | null
          valor_minimo: number | null
          versao: number | null
          vinculo_ciclo_id: string | null
          workflow_status:
            | Database["public"]["Enums"]["meta_workflow_status"]
            | null
        }
        Insert: {
          ano: number
          aprovador_id?: string | null
          aprovador_nome?: string | null
          categoria_meta?: string | null
          ciclo_avaliacao_id?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          compartilhada?: boolean | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_aprovacao?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          departamento_id?: string | null
          departamento_nome?: string | null
          descricao?: string | null
          empresa_id?: string | null
          formula_medicao?: string | null
          id?: string
          ierm_calculado_em?: string | null
          ierm_nivel?: string | null
          ierm_score?: number | null
          indicador_direcao?:
            | Database["public"]["Enums"]["indicador_direcao"]
            | null
          indicador_nome?: string | null
          indicador_tipo?: Database["public"]["Enums"]["indicador_tipo"] | null
          indicador_unidade?: string | null
          justificativa_aprovacao?: string | null
          meta_pai_id?: string | null
          nivel?: Database["public"]["Enums"]["meta_nivel"] | null
          objetivo_estrategico?: string | null
          origem_meta?: string | null
          origem_referencia_id?: string | null
          periodo?: Database["public"]["Enums"]["meta_periodo"]
          peso?: number | null
          premiacao_atingida?: boolean | null
          premiacao_descricao?: string | null
          premiacao_tipo?: string | null
          premiacao_valor?: number | null
          progresso?: number
          responsavel_id?: string | null
          responsavel_nome?: string | null
          risco_descricao?: string | null
          risco_ia?: string | null
          risco_nivel?: string | null
          setor_id?: string | null
          setor_nome?: string | null
          status?: Database["public"]["Enums"]["meta_status"]
          sugestao_ia?: Json | null
          swot_id?: string | null
          tags?: string[] | null
          tenant_id: string
          tipo?: string
          titulo: string
          trimestre?: number | null
          unidade_id?: string | null
          unidade_nome?: string | null
          updated_at?: string
          valor_alvo?: number | null
          valor_atual?: number | null
          valor_baseline?: number | null
          valor_maximo?: number | null
          valor_minimo?: number | null
          versao?: number | null
          vinculo_ciclo_id?: string | null
          workflow_status?:
            | Database["public"]["Enums"]["meta_workflow_status"]
            | null
        }
        Update: {
          ano?: number
          aprovador_id?: string | null
          aprovador_nome?: string | null
          categoria_meta?: string | null
          ciclo_avaliacao_id?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          compartilhada?: boolean | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_aprovacao?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          departamento_id?: string | null
          departamento_nome?: string | null
          descricao?: string | null
          empresa_id?: string | null
          formula_medicao?: string | null
          id?: string
          ierm_calculado_em?: string | null
          ierm_nivel?: string | null
          ierm_score?: number | null
          indicador_direcao?:
            | Database["public"]["Enums"]["indicador_direcao"]
            | null
          indicador_nome?: string | null
          indicador_tipo?: Database["public"]["Enums"]["indicador_tipo"] | null
          indicador_unidade?: string | null
          justificativa_aprovacao?: string | null
          meta_pai_id?: string | null
          nivel?: Database["public"]["Enums"]["meta_nivel"] | null
          objetivo_estrategico?: string | null
          origem_meta?: string | null
          origem_referencia_id?: string | null
          periodo?: Database["public"]["Enums"]["meta_periodo"]
          peso?: number | null
          premiacao_atingida?: boolean | null
          premiacao_descricao?: string | null
          premiacao_tipo?: string | null
          premiacao_valor?: number | null
          progresso?: number
          responsavel_id?: string | null
          responsavel_nome?: string | null
          risco_descricao?: string | null
          risco_ia?: string | null
          risco_nivel?: string | null
          setor_id?: string | null
          setor_nome?: string | null
          status?: Database["public"]["Enums"]["meta_status"]
          sugestao_ia?: Json | null
          swot_id?: string | null
          tags?: string[] | null
          tenant_id?: string
          tipo?: string
          titulo?: string
          trimestre?: number | null
          unidade_id?: string | null
          unidade_nome?: string | null
          updated_at?: string
          valor_alvo?: number | null
          valor_atual?: number | null
          valor_baseline?: number | null
          valor_maximo?: number | null
          valor_minimo?: number | null
          versao?: number | null
          vinculo_ciclo_id?: string | null
          workflow_status?:
            | Database["public"]["Enums"]["meta_workflow_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_ciclo_avaliacao_id_fkey"
            columns: ["ciclo_avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacao_ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_meta_pai_id_fkey"
            columns: ["meta_pai_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_setor_id_fkey"
            columns: ["setor_id"]
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
            foreignKeyName: "metas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
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
      metas_checkins: {
        Row: {
          bloqueios: string | null
          created_at: string
          id: string
          meta_id: string
          observacao: string | null
          previsao_atingimento: string | null
          progresso_anterior: number | null
          progresso_novo: number | null
          realizado_por: string | null
          realizado_por_nome: string | null
          tenant_id: string
          valor_anterior: number | null
          valor_novo: number | null
        }
        Insert: {
          bloqueios?: string | null
          created_at?: string
          id?: string
          meta_id: string
          observacao?: string | null
          previsao_atingimento?: string | null
          progresso_anterior?: number | null
          progresso_novo?: number | null
          realizado_por?: string | null
          realizado_por_nome?: string | null
          tenant_id: string
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Update: {
          bloqueios?: string | null
          created_at?: string
          id?: string
          meta_id?: string
          observacao?: string | null
          previsao_atingimento?: string | null
          progresso_anterior?: number | null
          progresso_novo?: number | null
          realizado_por?: string | null
          realizado_por_nome?: string | null
          tenant_id?: string
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_checkins_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_checkins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_configuracao: {
        Row: {
          created_at: string
          dias_alerta_prazo: number | null
          escala_max: number | null
          escala_min: number | null
          exigir_aprovacao_estrategica: boolean | null
          exigir_aprovacao_individual: boolean | null
          exigir_aprovacao_setor: boolean | null
          exigir_aprovacao_unidade: boolean | null
          exigir_indicador: boolean | null
          exigir_objetivo_estrategico: boolean | null
          frequencia_checkin: string | null
          id: string
          integrar_avaliacao_desempenho: boolean | null
          modelo_avaliacao: string | null
          niveis_habilitados: string[] | null
          permitir_desdobramento: boolean | null
          permitir_metas_compartilhadas: boolean | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dias_alerta_prazo?: number | null
          escala_max?: number | null
          escala_min?: number | null
          exigir_aprovacao_estrategica?: boolean | null
          exigir_aprovacao_individual?: boolean | null
          exigir_aprovacao_setor?: boolean | null
          exigir_aprovacao_unidade?: boolean | null
          exigir_indicador?: boolean | null
          exigir_objetivo_estrategico?: boolean | null
          frequencia_checkin?: string | null
          id?: string
          integrar_avaliacao_desempenho?: boolean | null
          modelo_avaliacao?: string | null
          niveis_habilitados?: string[] | null
          permitir_desdobramento?: boolean | null
          permitir_metas_compartilhadas?: boolean | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dias_alerta_prazo?: number | null
          escala_max?: number | null
          escala_min?: number | null
          exigir_aprovacao_estrategica?: boolean | null
          exigir_aprovacao_individual?: boolean | null
          exigir_aprovacao_setor?: boolean | null
          exigir_aprovacao_unidade?: boolean | null
          exigir_indicador?: boolean | null
          exigir_objetivo_estrategico?: boolean | null
          frequencia_checkin?: string | null
          id?: string
          integrar_avaliacao_desempenho?: boolean | null
          modelo_avaliacao?: string | null
          niveis_habilitados?: string[] | null
          permitir_desdobramento?: boolean | null
          permitir_metas_compartilhadas?: boolean | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_configuracao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_evidencias: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          descricao: string | null
          id: string
          link_externo: string | null
          meta_id: string
          periodo_referencia: string | null
          tenant_id: string
          tipo: string
          titulo: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          id?: string
          link_externo?: string | null
          meta_id: string
          periodo_referencia?: string | null
          tenant_id: string
          tipo?: string
          titulo?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          id?: string
          link_externo?: string | null
          meta_id?: string
          periodo_referencia?: string | null
          tenant_id?: string
          tipo?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_evidencias_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_evidencias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_indicadores: {
        Row: {
          ativo: boolean | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          descricao: string | null
          direcao: Database["public"]["Enums"]["indicador_direcao"]
          formula: string | null
          frequencia_atualizacao: string | null
          id: string
          nome: string
          origem_dados: string | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["indicador_tipo"]
          unidade_medida: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          direcao?: Database["public"]["Enums"]["indicador_direcao"]
          formula?: string | null
          frequencia_atualizacao?: string | null
          id?: string
          nome: string
          origem_dados?: string | null
          tenant_id: string
          tipo?: Database["public"]["Enums"]["indicador_tipo"]
          unidade_medida?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          direcao?: Database["public"]["Enums"]["indicador_direcao"]
          formula?: string | null
          frequencia_atualizacao?: string | null
          id?: string
          nome?: string
          origem_dados?: string | null
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["indicador_tipo"]
          unidade_medida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_indicadores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_participantes: {
        Row: {
          created_at: string
          id: string
          meta_id: string
          papel: string | null
          participante_id: string
          participante_nome: string
          peso: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta_id: string
          papel?: string | null
          participante_id: string
          participante_nome: string
          peso?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta_id?: string
          papel?: string | null
          participante_id?: string
          participante_nome?: string
          peso?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_participantes_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_participantes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_workflow_log: {
        Row: {
          acao: string
          created_at: string
          id: string
          justificativa: string | null
          meta_id: string
          status_anterior:
            | Database["public"]["Enums"]["meta_workflow_status"]
            | null
          status_novo: Database["public"]["Enums"]["meta_workflow_status"]
          tenant_id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          id?: string
          justificativa?: string | null
          meta_id: string
          status_anterior?:
            | Database["public"]["Enums"]["meta_workflow_status"]
            | null
          status_novo: Database["public"]["Enums"]["meta_workflow_status"]
          tenant_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          id?: string
          justificativa?: string | null
          meta_id?: string
          status_anterior?:
            | Database["public"]["Enums"]["meta_workflow_status"]
            | null
          status_novo?: Database["public"]["Enums"]["meta_workflow_status"]
          tenant_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_workflow_log_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_workflow_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          bloqueado: boolean | null
          colaborador_cargo: string | null
          colaborador_departamento: string | null
          colaborador_filial: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          data_ocorrencia: string
          descricao: string
          empresa_id: string | null
          id: string
          is_advertencia: boolean | null
          registrado_por: string
          registrado_por_nome: string
          tenant_id: string
          tipo: Database["public"]["Enums"]["ocorrencia_tipo"]
          updated_at: string
        }
        Insert: {
          bloqueado?: boolean | null
          colaborador_cargo?: string | null
          colaborador_departamento?: string | null
          colaborador_filial?: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          data_ocorrencia?: string
          descricao: string
          empresa_id?: string | null
          id?: string
          is_advertencia?: boolean | null
          registrado_por: string
          registrado_por_nome: string
          tenant_id: string
          tipo: Database["public"]["Enums"]["ocorrencia_tipo"]
          updated_at?: string
        }
        Update: {
          bloqueado?: boolean | null
          colaborador_cargo?: string | null
          colaborador_departamento?: string | null
          colaborador_filial?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          data_ocorrencia?: string
          descricao?: string
          empresa_id?: string | null
          id?: string
          is_advertencia?: boolean | null
          registrado_por?: string
          registrado_por_nome?: string
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["ocorrencia_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      onboarding_checklist_items: {
        Row: {
          created_at: string
          descricao: string | null
          etapa_id: string
          id: string
          obrigatorio: boolean | null
          ordem: number
          tenant_id: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          etapa_id: string
          id?: string
          obrigatorio?: boolean | null
          ordem?: number
          tenant_id: string
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          etapa_id?: string
          id?: string
          obrigatorio?: boolean | null
          ordem?: number
          tenant_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklist_items_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "onboarding_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklist_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklist_progresso: {
        Row: {
          checklist_item_id: string
          concluido: boolean | null
          created_at: string
          data_conclusao: string | null
          id: string
          observacao: string | null
          processo_id: string
          tenant_id: string
        }
        Insert: {
          checklist_item_id: string
          concluido?: boolean | null
          created_at?: string
          data_conclusao?: string | null
          id?: string
          observacao?: string | null
          processo_id: string
          tenant_id: string
        }
        Update: {
          checklist_item_id?: string
          concluido?: boolean | null
          created_at?: string
          data_conclusao?: string | null
          id?: string
          observacao?: string | null
          processo_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklist_progresso_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "onboarding_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklist_progresso_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "onboarding_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklist_progresso_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_etapas: {
        Row: {
          ativo: boolean | null
          conteudo_texto: string | null
          conteudo_url: string | null
          created_at: string
          descricao: string | null
          formato: string | null
          id: string
          obrigatoria: boolean | null
          ordem: number
          pontuacao: number | null
          template_id: string
          tempo_estimado_min: number | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["onboarding_etapa_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          conteudo_texto?: string | null
          conteudo_url?: string | null
          created_at?: string
          descricao?: string | null
          formato?: string | null
          id?: string
          obrigatoria?: boolean | null
          ordem?: number
          pontuacao?: number | null
          template_id: string
          tempo_estimado_min?: number | null
          tenant_id: string
          tipo?: Database["public"]["Enums"]["onboarding_etapa_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          conteudo_texto?: string | null
          conteudo_url?: string | null
          created_at?: string
          descricao?: string | null
          formato?: string | null
          id?: string
          obrigatoria?: boolean | null
          ordem?: number
          pontuacao?: number | null
          template_id?: string
          tempo_estimado_min?: number | null
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["onboarding_etapa_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_etapas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_etapas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_mensagens: {
        Row: {
          autor_cargo: string | null
          autor_nome: string
          created_at: string
          etapa_id: string
          id: string
          mensagem: string
          ordem: number
          tenant_id: string
          tipo: string | null
        }
        Insert: {
          autor_cargo?: string | null
          autor_nome: string
          created_at?: string
          etapa_id: string
          id?: string
          mensagem: string
          ordem?: number
          tenant_id: string
          tipo?: string | null
        }
        Update: {
          autor_cargo?: string | null
          autor_nome?: string
          created_at?: string
          etapa_id?: string
          id?: string
          mensagem?: string
          ordem?: number
          tenant_id?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_mensagens_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "onboarding_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_mensagens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_percepcao_cultural: {
        Row: {
          categoria: string
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          id: string
          pergunta_chave: string
          pergunta_texto: string
          processo_id: string | null
          resposta: string
          tenant_id: string
        }
        Insert: {
          categoria?: string
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          id?: string
          pergunta_chave: string
          pergunta_texto: string
          processo_id?: string | null
          resposta: string
          tenant_id: string
        }
        Update: {
          categoria?: string
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          id?: string
          pergunta_chave?: string
          pergunta_texto?: string
          processo_id?: string | null
          resposta?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_percepcao_cultural_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "onboarding_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_percepcao_cultural_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_processos: {
        Row: {
          admissao_id: string
          certificado_emitido: boolean | null
          colaborador_cpf: string
          colaborador_nome: string
          created_at: string
          data_conclusao: string | null
          data_inicio: string | null
          id: string
          pdi_alimentado: boolean | null
          pontos_obtidos: number | null
          progresso: number | null
          status: string
          template_id: string | null
          tenant_id: string
          trilha_id: string | null
          updated_at: string
        }
        Insert: {
          admissao_id: string
          certificado_emitido?: boolean | null
          colaborador_cpf: string
          colaborador_nome: string
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          pdi_alimentado?: boolean | null
          pontos_obtidos?: number | null
          progresso?: number | null
          status?: string
          template_id?: string | null
          tenant_id: string
          trilha_id?: string | null
          updated_at?: string
        }
        Update: {
          admissao_id?: string
          certificado_emitido?: boolean | null
          colaborador_cpf?: string
          colaborador_nome?: string
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          pdi_alimentado?: boolean | null
          pontos_obtidos?: number | null
          progresso?: number | null
          status?: string
          template_id?: string | null
          tenant_id?: string
          trilha_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_processos_admissao_id_fkey"
            columns: ["admissao_id"]
            isOneToOne: false
            referencedRelation: "admissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_processos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_processos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_processos_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_respostas: {
        Row: {
          created_at: string
          etapa_id: string
          id: string
          pergunta: string
          processo_id: string
          resposta: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          etapa_id: string
          id?: string
          pergunta: string
          processo_id: string
          resposta?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          etapa_id?: string
          id?: string
          pergunta?: string
          processo_id?: string
          resposta?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_respostas_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "onboarding_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_respostas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "onboarding_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_respostas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_templates: {
        Row: {
          ativo: boolean
          conexao_pdi: boolean | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          departamentos: string[] | null
          descricao: string | null
          emitir_certificado: boolean | null
          funcoes: string[] | null
          id: string
          nome: string
          pontuacao_total: number | null
          prazo_dias: number | null
          tenant_id: string
          tipos_vinculo: string[] | null
          unidades: string[] | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          conexao_pdi?: boolean | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          departamentos?: string[] | null
          descricao?: string | null
          emitir_certificado?: boolean | null
          funcoes?: string[] | null
          id?: string
          nome: string
          pontuacao_total?: number | null
          prazo_dias?: number | null
          tenant_id: string
          tipos_vinculo?: string[] | null
          unidades?: string[] | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          conexao_pdi?: boolean | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          departamentos?: string[] | null
          descricao?: string | null
          emitir_certificado?: boolean | null
          funcoes?: string[] | null
          id?: string
          nome?: string
          pontuacao_total?: number | null
          prazo_dias?: number | null
          tenant_id?: string
          tipos_vinculo?: string[] | null
          unidades?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_servico_links: {
        Row: {
          created_at: string
          enviado_em: string | null
          enviado_via: string | null
          expires_at: string
          id: string
          ordem_servico_id: string
          tenant_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          enviado_em?: string | null
          enviado_via?: string | null
          expires_at?: string
          id?: string
          ordem_servico_id: string
          tenant_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          enviado_em?: string | null
          enviado_via?: string | null
          expires_at?: string
          id?: string
          ordem_servico_id?: string
          tenant_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordem_servico_links_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          ano: number
          assinada_em: string | null
          assinatura_geo: Json | null
          assinatura_hash: string | null
          assinatura_ip: string | null
          assinatura_selfie_url: string | null
          cargo_id: string | null
          cargo_nome: string | null
          colaborador_id: string
          conteudo_html: string | null
          conteudo_json: Json | null
          created_at: string
          criado_por: string | null
          data_emissao: string
          data_vigencia: string | null
          empresa_id: string | null
          id: string
          motivo_reemissao: string | null
          numero_formatado: string | null
          numero_sequencial: number
          os_anterior_id: string | null
          pdf_url: string | null
          pgr_id: string | null
          responsavel_emissao_id: string | null
          responsavel_emissao_nome: string | null
          responsavel_tecnico_nome: string | null
          responsavel_tecnico_registro: string | null
          setor_nome: string | null
          status: string
          tenant_id: string
          updated_at: string
          versao: number
        }
        Insert: {
          ano: number
          assinada_em?: string | null
          assinatura_geo?: Json | null
          assinatura_hash?: string | null
          assinatura_ip?: string | null
          assinatura_selfie_url?: string | null
          cargo_id?: string | null
          cargo_nome?: string | null
          colaborador_id: string
          conteudo_html?: string | null
          conteudo_json?: Json | null
          created_at?: string
          criado_por?: string | null
          data_emissao?: string
          data_vigencia?: string | null
          empresa_id?: string | null
          id?: string
          motivo_reemissao?: string | null
          numero_formatado?: string | null
          numero_sequencial: number
          os_anterior_id?: string | null
          pdf_url?: string | null
          pgr_id?: string | null
          responsavel_emissao_id?: string | null
          responsavel_emissao_nome?: string | null
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_registro?: string | null
          setor_nome?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          versao?: number
        }
        Update: {
          ano?: number
          assinada_em?: string | null
          assinatura_geo?: Json | null
          assinatura_hash?: string | null
          assinatura_ip?: string | null
          assinatura_selfie_url?: string | null
          cargo_id?: string | null
          cargo_nome?: string | null
          colaborador_id?: string
          conteudo_html?: string | null
          conteudo_json?: Json | null
          created_at?: string
          criado_por?: string | null
          data_emissao?: string
          data_vigencia?: string | null
          empresa_id?: string | null
          id?: string
          motivo_reemissao?: string | null
          numero_formatado?: string | null
          numero_sequencial?: number
          os_anterior_id?: string | null
          pdf_url?: string | null
          pgr_id?: string | null
          responsavel_emissao_id?: string | null
          responsavel_emissao_nome?: string | null
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_registro?: string | null
          setor_nome?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_os_anterior_id_fkey"
            columns: ["os_anterior_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_pgr_id_fkey"
            columns: ["pgr_id"]
            isOneToOne: false
            referencedRelation: "sst_documentos"
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
          departamento_destino: string | null
          id: string
          mensagem: string
          prioridade: string | null
          respondido_em: string | null
          respondido_por: string | null
          respondido_por_nome: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
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
          departamento_destino?: string | null
          id?: string
          mensagem: string
          prioridade?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          respondido_por_nome?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
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
          departamento_destino?: string | null
          id?: string
          mensagem?: string
          prioridade?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          respondido_por_nome?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
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
      ouvidoria_roteamento: {
        Row: {
          ativo: boolean
          created_at: string
          departamento_responsavel: string | null
          id: string
          responsavel_id: string | null
          responsavel_nome: string | null
          tenant_id: string
          tipo_manifestacao: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          departamento_responsavel?: string | null
          id?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          tenant_id: string
          tipo_manifestacao: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          departamento_responsavel?: string | null
          id?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          tenant_id?: string
          tipo_manifestacao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ouvidoria_roteamento_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pdi_acoes: {
        Row: {
          created_at: string
          data_vencimento: string | null
          descricao: string | null
          duracao_estimada: string | null
          evidencia_obrigatoria: boolean | null
          frequencia: string | null
          id: string
          material_vinculado: string | null
          meta_id: string
          status: Database["public"]["Enums"]["pdi_acao_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["pdi_acao_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_vencimento?: string | null
          descricao?: string | null
          duracao_estimada?: string | null
          evidencia_obrigatoria?: boolean | null
          frequencia?: string | null
          id?: string
          material_vinculado?: string | null
          meta_id: string
          status?: Database["public"]["Enums"]["pdi_acao_status"]
          tenant_id: string
          tipo?: Database["public"]["Enums"]["pdi_acao_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_vencimento?: string | null
          descricao?: string | null
          duracao_estimada?: string | null
          evidencia_obrigatoria?: boolean | null
          frequencia?: string | null
          id?: string
          material_vinculado?: string | null
          meta_id?: string
          status?: Database["public"]["Enums"]["pdi_acao_status"]
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["pdi_acao_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdi_acoes_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "pdi_metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdi_acoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pdi_assinatura_links: {
        Row: {
          assinado_em: string | null
          assinatura_url: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          documento_storage_path: string | null
          expira_em: string
          id: string
          ip_assinatura: string | null
          pdi_id: string
          signatario_nome: string
          signatario_papel: string
          signatario_telefone: string | null
          status: string
          tenant_id: string
          token: string
          updated_at: string
          user_agent_assinatura: string | null
        }
        Insert: {
          assinado_em?: string | null
          assinatura_url?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          documento_storage_path?: string | null
          expira_em?: string
          id?: string
          ip_assinatura?: string | null
          pdi_id: string
          signatario_nome: string
          signatario_papel: string
          signatario_telefone?: string | null
          status?: string
          tenant_id: string
          token?: string
          updated_at?: string
          user_agent_assinatura?: string | null
        }
        Update: {
          assinado_em?: string | null
          assinatura_url?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          documento_storage_path?: string | null
          expira_em?: string
          id?: string
          ip_assinatura?: string | null
          pdi_id?: string
          signatario_nome?: string
          signatario_papel?: string
          signatario_telefone?: string | null
          status?: string
          tenant_id?: string
          token?: string
          updated_at?: string
          user_agent_assinatura?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdi_assinatura_links_pdi_id_fkey"
            columns: ["pdi_id"]
            isOneToOne: false
            referencedRelation: "pdis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdi_assinatura_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pdi_checkins: {
        Row: {
          avancos: string | null
          bloqueios: string | null
          created_at: string
          id: string
          meta_id: string
          proximo_passo: string | null
          realizado_por: string | null
          realizado_por_nome: string | null
          tenant_id: string
          valor_atualizado: number | null
        }
        Insert: {
          avancos?: string | null
          bloqueios?: string | null
          created_at?: string
          id?: string
          meta_id: string
          proximo_passo?: string | null
          realizado_por?: string | null
          realizado_por_nome?: string | null
          tenant_id: string
          valor_atualizado?: number | null
        }
        Update: {
          avancos?: string | null
          bloqueios?: string | null
          created_at?: string
          id?: string
          meta_id?: string
          proximo_passo?: string | null
          realizado_por?: string | null
          realizado_por_nome?: string | null
          tenant_id?: string
          valor_atualizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pdi_checkins_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "pdi_metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdi_checkins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pdi_evidencias: {
        Row: {
          acao_id: string | null
          arquivo_nome: string | null
          arquivo_url: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          descricao: string | null
          id: string
          link_url: string | null
          meta_id: string | null
          tenant_id: string
          tipo: string
          titulo: string
          validado_em: string | null
          validado_por: string | null
          validado_por_nome: string | null
        }
        Insert: {
          acao_id?: string | null
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          id?: string
          link_url?: string | null
          meta_id?: string | null
          tenant_id: string
          tipo?: string
          titulo: string
          validado_em?: string | null
          validado_por?: string | null
          validado_por_nome?: string | null
        }
        Update: {
          acao_id?: string | null
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          id?: string
          link_url?: string | null
          meta_id?: string | null
          tenant_id?: string
          tipo?: string
          titulo?: string
          validado_em?: string | null
          validado_por?: string | null
          validado_por_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdi_evidencias_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "pdi_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdi_evidencias_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "pdi_metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdi_evidencias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pdi_feedbacks: {
        Row: {
          autor_id: string | null
          autor_nome: string | null
          comentario: string | null
          created_at: string
          id: string
          meta_id: string | null
          pdi_id: string
          ponto_forte: string | null
          ponto_melhorar: string | null
          recomendacao: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          autor_nome?: string | null
          comentario?: string | null
          created_at?: string
          id?: string
          meta_id?: string | null
          pdi_id: string
          ponto_forte?: string | null
          ponto_melhorar?: string | null
          recomendacao?: string | null
          tenant_id: string
          tipo?: string
        }
        Update: {
          autor_id?: string | null
          autor_nome?: string | null
          comentario?: string | null
          created_at?: string
          id?: string
          meta_id?: string | null
          pdi_id?: string
          ponto_forte?: string | null
          ponto_melhorar?: string | null
          recomendacao?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdi_feedbacks_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "pdi_metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdi_feedbacks_pdi_id_fkey"
            columns: ["pdi_id"]
            isOneToOne: false
            referencedRelation: "pdis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdi_feedbacks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pdi_metas: {
        Row: {
          atingivel: string | null
          categoria: Database["public"]["Enums"]["pdi_meta_categoria"]
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          dependencias: string | null
          descricao: string | null
          especifica: string | null
          frequencia_checkin:
            | Database["public"]["Enums"]["pdi_checkin_frequencia"]
            | null
          id: string
          indicador_sucesso: string | null
          mensuravel: string | null
          observacoes: string | null
          pdi_id: string
          peso: number | null
          progresso: number
          relevante: string | null
          status: Database["public"]["Enums"]["pdi_meta_status"]
          temporal: string | null
          tenant_id: string
          titulo: string
          unidade: string | null
          updated_at: string
          valor_alvo: number | null
          valor_atual: number | null
          valor_base: number | null
        }
        Insert: {
          atingivel?: string | null
          categoria?: Database["public"]["Enums"]["pdi_meta_categoria"]
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          dependencias?: string | null
          descricao?: string | null
          especifica?: string | null
          frequencia_checkin?:
            | Database["public"]["Enums"]["pdi_checkin_frequencia"]
            | null
          id?: string
          indicador_sucesso?: string | null
          mensuravel?: string | null
          observacoes?: string | null
          pdi_id: string
          peso?: number | null
          progresso?: number
          relevante?: string | null
          status?: Database["public"]["Enums"]["pdi_meta_status"]
          temporal?: string | null
          tenant_id: string
          titulo: string
          unidade?: string | null
          updated_at?: string
          valor_alvo?: number | null
          valor_atual?: number | null
          valor_base?: number | null
        }
        Update: {
          atingivel?: string | null
          categoria?: Database["public"]["Enums"]["pdi_meta_categoria"]
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          dependencias?: string | null
          descricao?: string | null
          especifica?: string | null
          frequencia_checkin?:
            | Database["public"]["Enums"]["pdi_checkin_frequencia"]
            | null
          id?: string
          indicador_sucesso?: string | null
          mensuravel?: string | null
          observacoes?: string | null
          pdi_id?: string
          peso?: number | null
          progresso?: number
          relevante?: string | null
          status?: Database["public"]["Enums"]["pdi_meta_status"]
          temporal?: string | null
          tenant_id?: string
          titulo?: string
          unidade?: string | null
          updated_at?: string
          valor_alvo?: number | null
          valor_atual?: number | null
          valor_base?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pdi_metas_pdi_id_fkey"
            columns: ["pdi_id"]
            isOneToOne: false
            referencedRelation: "pdis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdi_metas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pdis: {
        Row: {
          ciclo_avaliacao_id: string | null
          co_responsavel_id: string | null
          co_responsavel_nome: string | null
          colaborador_cargo: string | null
          colaborador_departamento: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_fim: string
          data_inicio: string
          descricao: string | null
          empresa_id: string | null
          gatilho: string | null
          id: string
          observacoes: string | null
          periodo: Database["public"]["Enums"]["pdi_periodo"]
          pontuacao: number
          progresso: number
          responsavel_id: string | null
          responsavel_nome: string | null
          status: Database["public"]["Enums"]["pdi_status"]
          tenant_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ciclo_avaliacao_id?: string | null
          co_responsavel_id?: string | null
          co_responsavel_nome?: string | null
          colaborador_cargo?: string | null
          colaborador_departamento?: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_fim: string
          data_inicio: string
          descricao?: string | null
          empresa_id?: string | null
          gatilho?: string | null
          id?: string
          observacoes?: string | null
          periodo?: Database["public"]["Enums"]["pdi_periodo"]
          pontuacao?: number
          progresso?: number
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["pdi_status"]
          tenant_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ciclo_avaliacao_id?: string | null
          co_responsavel_id?: string | null
          co_responsavel_nome?: string | null
          colaborador_cargo?: string | null
          colaborador_departamento?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          empresa_id?: string | null
          gatilho?: string | null
          id?: string
          observacoes?: string | null
          periodo?: Database["public"]["Enums"]["pdi_periodo"]
          pontuacao?: number
          progresso?: number
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["pdi_status"]
          tenant_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_acesso_sensivel_log: {
        Row: {
          acao: string
          created_at: string
          descricao: string | null
          id: string
          modulo: string
          recurso: string | null
          tenant_id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          descricao?: string | null
          id?: string
          modulo: string
          recurso?: string | null
          tenant_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          descricao?: string | null
          id?: string
          modulo?: string
          recurso?: string | null
          tenant_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfil_acesso_sensivel_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_audit_log: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          id: string
          perfil_id: string | null
          realizado_por: string | null
          realizado_por_nome: string | null
          tenant_id: string
          usuario_alvo_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          perfil_id?: string | null
          realizado_por?: string | null
          realizado_por_nome?: string | null
          tenant_id: string
          usuario_alvo_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          perfil_id?: string | null
          realizado_por?: string | null
          realizado_por_nome?: string | null
          tenant_id?: string
          usuario_alvo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfil_audit_log_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_excecoes: {
        Row: {
          acao: Database["public"]["Enums"]["perfil_acao"]
          ativo: boolean
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          empresa_id: string | null
          escopo: Database["public"]["Enums"]["perfil_escopo_tipo"]
          expira_em: string | null
          id: string
          justificativa: string | null
          modulo: string
          recurso: string | null
          tenant_id: string
          tipo: string
          usuario_id: string
        }
        Insert: {
          acao: Database["public"]["Enums"]["perfil_acao"]
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          empresa_id?: string | null
          escopo?: Database["public"]["Enums"]["perfil_escopo_tipo"]
          expira_em?: string | null
          id?: string
          justificativa?: string | null
          modulo: string
          recurso?: string | null
          tenant_id: string
          tipo?: string
          usuario_id: string
        }
        Update: {
          acao?: Database["public"]["Enums"]["perfil_acao"]
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          empresa_id?: string | null
          escopo?: Database["public"]["Enums"]["perfil_escopo_tipo"]
          expira_em?: string | null
          id?: string
          justificativa?: string | null
          modulo?: string
          recurso?: string | null
          tenant_id?: string
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_excecoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_excecoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_permissoes: {
        Row: {
          acao: Database["public"]["Enums"]["perfil_acao"]
          ativo: boolean
          created_at: string
          escopo: Database["public"]["Enums"]["perfil_escopo_tipo"]
          id: string
          is_sensivel: boolean | null
          modulo: string
          observacao: string | null
          perfil_id: string
          recurso: string | null
          requer_2fa: boolean
          tenant_id: string
        }
        Insert: {
          acao: Database["public"]["Enums"]["perfil_acao"]
          ativo?: boolean
          created_at?: string
          escopo?: Database["public"]["Enums"]["perfil_escopo_tipo"]
          id?: string
          is_sensivel?: boolean | null
          modulo: string
          observacao?: string | null
          perfil_id: string
          recurso?: string | null
          requer_2fa?: boolean
          tenant_id: string
        }
        Update: {
          acao?: Database["public"]["Enums"]["perfil_acao"]
          ativo?: boolean
          created_at?: string
          escopo?: Database["public"]["Enums"]["perfil_escopo_tipo"]
          id?: string
          is_sensivel?: boolean | null
          modulo?: string
          observacao?: string | null
          perfil_id?: string
          recurso?: string | null
          requer_2fa?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_permissoes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_permissoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_templates: {
        Row: {
          ativo: boolean
          cor: string | null
          criado_em: string
          descricao: string | null
          icone: string | null
          id: string
          modulos_padrao: Json | null
          nome: string
          tipo_usuario_sugerido: string | null
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          criado_em?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          modulos_padrao?: Json | null
          nome: string
          tipo_usuario_sugerido?: string | null
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          criado_em?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          modulos_padrao?: Json | null
          nome?: string
          tipo_usuario_sugerido?: string | null
        }
        Relationships: []
      }
      perfis_acesso: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          descricao: string | null
          expira_em: string | null
          icone: string | null
          id: string
          is_perfil_assistido: boolean | null
          nivel_risco: string | null
          nome: string
          permite_acumulo: boolean
          template_origem_id: string | null
          tenant_id: string
          tipo: string
          tipo_usuario_sugerido: string | null
          total_usuarios: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          expira_em?: string | null
          icone?: string | null
          id?: string
          is_perfil_assistido?: boolean | null
          nivel_risco?: string | null
          nome: string
          permite_acumulo?: boolean
          template_origem_id?: string | null
          tenant_id: string
          tipo?: string
          tipo_usuario_sugerido?: string | null
          total_usuarios?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          expira_em?: string | null
          icone?: string | null
          id?: string
          is_perfil_assistido?: boolean | null
          nivel_risco?: string | null
          nome?: string
          permite_acumulo?: boolean
          template_origem_id?: string | null
          tenant_id?: string
          tipo?: string
          tipo_usuario_sugerido?: string | null
          total_usuarios?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_acesso_template_origem_id_fkey"
            columns: ["template_origem_id"]
            isOneToOne: false
            referencedRelation: "perfil_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_acesso_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissao_trabalhadores: {
        Row: {
          apto: boolean
          aso_ok: boolean
          created_at: string
          docs_ok: boolean
          id: string
          motivo_bloqueio: string | null
          permissao_id: string
          tenant_id: string
          trabalhador_id: string
          treins_ok: boolean
        }
        Insert: {
          apto?: boolean
          aso_ok?: boolean
          created_at?: string
          docs_ok?: boolean
          id?: string
          motivo_bloqueio?: string | null
          permissao_id: string
          tenant_id: string
          trabalhador_id: string
          treins_ok?: boolean
        }
        Update: {
          apto?: boolean
          aso_ok?: boolean
          created_at?: string
          docs_ok?: boolean
          id?: string
          motivo_bloqueio?: string | null
          permissao_id?: string
          tenant_id?: string
          trabalhador_id?: string
          treins_ok?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "permissao_trabalhadores_permissao_id_fkey"
            columns: ["permissao_id"]
            isOneToOne: false
            referencedRelation: "permissoes_trabalho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissao_trabalhadores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissao_trabalhadores_trabalhador_id_fkey"
            columns: ["trabalhador_id"]
            isOneToOne: false
            referencedRelation: "terceiro_trabalhadores"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_trabalho: {
        Row: {
          atividade: string
          atividades_risco: string[] | null
          codigo: string
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_fim: string
          data_inicio: string
          descricao: string | null
          empresa_id: string | null
          encerrado_em: string | null
          encerrado_por: string | null
          encerrado_por_nome: string | null
          id: string
          liberado_em: string | null
          liberado_por: string | null
          liberado_por_nome: string | null
          local: string
          motivo_bloqueio: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["pt_status"]
          tenant_id: string
          terceiro_id: string
          updated_at: string
        }
        Insert: {
          atividade: string
          atividades_risco?: string[] | null
          codigo: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_fim: string
          data_inicio: string
          descricao?: string | null
          empresa_id?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          encerrado_por_nome?: string | null
          id?: string
          liberado_em?: string | null
          liberado_por?: string | null
          liberado_por_nome?: string | null
          local: string
          motivo_bloqueio?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["pt_status"]
          tenant_id: string
          terceiro_id: string
          updated_at?: string
        }
        Update: {
          atividade?: string
          atividades_risco?: string[] | null
          codigo?: string
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          empresa_id?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          encerrado_por_nome?: string | null
          id?: string
          liberado_em?: string | null
          liberado_por?: string | null
          liberado_por_nome?: string | null
          local?: string
          motivo_bloqueio?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["pt_status"]
          tenant_id?: string
          terceiro_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_trabalho_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissoes_trabalho_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissoes_trabalho_terceiro_id_fkey"
            columns: ["terceiro_id"]
            isOneToOne: false
            referencedRelation: "terceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_acoes: {
        Row: {
          arquivada: boolean
          arquivada_em: string | null
          arquivada_por: string | null
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
          empresa_id: string | null
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
          arquivada?: boolean
          arquivada_em?: string | null
          arquivada_por?: string | null
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
          empresa_id?: string | null
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
          arquivada?: boolean
          arquivada_em?: string | null
          arquivada_por?: string | null
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
          empresa_id?: string | null
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
            foreignKeyName: "plano_acoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
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
      ponto_acordos: {
        Row: {
          ativo: boolean
          created_at: string
          documento_url: string | null
          empresa_id: string | null
          id: string
          observacoes: string | null
          tenant_id: string
          tipo: string
          titulo: string
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          documento_url?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          tenant_id: string
          tipo: string
          titulo: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          documento_url?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          tenant_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: []
      }
      ponto_ajustes: {
        Row: {
          anexos: Json
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
          empresa_id: string | null
          hora_original: string | null
          hora_solicitada: string | null
          horas_abonadas: number
          id: string
          justificativa_id: string | null
          motivo: string
          observacao_aprovador: string | null
          ponto_diario_id: string | null
          status: string
          tenant_id: string
          tipo_ajuste: string
          tipo_marcacao: string | null
        }
        Insert: {
          anexos?: Json
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
          empresa_id?: string | null
          hora_original?: string | null
          hora_solicitada?: string | null
          horas_abonadas?: number
          id?: string
          justificativa_id?: string | null
          motivo: string
          observacao_aprovador?: string | null
          ponto_diario_id?: string | null
          status?: string
          tenant_id: string
          tipo_ajuste: string
          tipo_marcacao?: string | null
        }
        Update: {
          anexos?: Json
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
          empresa_id?: string | null
          hora_original?: string | null
          hora_solicitada?: string | null
          horas_abonadas?: number
          id?: string
          justificativa_id?: string | null
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
            foreignKeyName: "ponto_ajustes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_ajustes_justificativa_id_fkey"
            columns: ["justificativa_id"]
            isOneToOne: false
            referencedRelation: "ponto_justificativas"
            referencedColumns: ["id"]
          },
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
      ponto_alertas: {
        Row: {
          colaborador_cpf: string | null
          colaborador_id: string | null
          colaborador_nome: string | null
          created_at: string | null
          data_referencia: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          resolvido: boolean | null
          resolvido_em: string | null
          resolvido_por: string | null
          severidade: string
          tenant_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          created_at?: string | null
          data_referencia?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
          tenant_id: string
          tipo: string
          titulo: string
        }
        Update: {
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          created_at?: string | null
          data_referencia?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
          tenant_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_alertas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_alertas_tenant_id_fkey"
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
      ponto_banco_horas: {
        Row: {
          colaborador_cpf: string | null
          colaborador_id: string
          colaborador_nome: string
          compensados_minutos: number | null
          competencia: string
          convertido_extras: boolean | null
          created_at: string | null
          creditos_minutos: number | null
          data_conversao: string | null
          debitos_minutos: number | null
          empresa_id: string | null
          id: string
          observacoes: string | null
          prazo_compensacao: string | null
          saldo_anterior_minutos: number | null
          saldo_atual_minutos: number | null
          tenant_id: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          colaborador_cpf?: string | null
          colaborador_id: string
          colaborador_nome: string
          compensados_minutos?: number | null
          competencia: string
          convertido_extras?: boolean | null
          created_at?: string | null
          creditos_minutos?: number | null
          data_conversao?: string | null
          debitos_minutos?: number | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          prazo_compensacao?: string | null
          saldo_anterior_minutos?: number | null
          saldo_atual_minutos?: number | null
          tenant_id: string
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          colaborador_cpf?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          compensados_minutos?: number | null
          competencia?: string
          convertido_extras?: boolean | null
          created_at?: string | null
          creditos_minutos?: number | null
          data_conversao?: string | null
          debitos_minutos?: number | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          prazo_compensacao?: string | null
          saldo_anterior_minutos?: number | null
          saldo_atual_minutos?: number | null
          tenant_id?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_banco_horas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_banco_horas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_banco_horas_config: {
        Row: {
          acordo_id: string | null
          ativo: boolean | null
          created_at: string
          data_inicio: string | null
          empresa_id: string | null
          escala_id: string | null
          exige_acordo_individual: boolean | null
          exige_cct_act: boolean | null
          forma_compensacao: string | null
          forma_pagamento_vencer: string | null
          id: string
          limite_acumulo_horas: number | null
          permite_saldo_negativo: boolean | null
          permite_saldo_positivo: boolean | null
          prazo_compensacao_dias: number | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          acordo_id?: string | null
          ativo?: boolean | null
          created_at?: string
          data_inicio?: string | null
          empresa_id?: string | null
          escala_id?: string | null
          exige_acordo_individual?: boolean | null
          exige_cct_act?: boolean | null
          forma_compensacao?: string | null
          forma_pagamento_vencer?: string | null
          id?: string
          limite_acumulo_horas?: number | null
          permite_saldo_negativo?: boolean | null
          permite_saldo_positivo?: boolean | null
          prazo_compensacao_dias?: number | null
          tenant_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          acordo_id?: string | null
          ativo?: boolean | null
          created_at?: string
          data_inicio?: string | null
          empresa_id?: string | null
          escala_id?: string | null
          exige_acordo_individual?: boolean | null
          exige_cct_act?: boolean | null
          forma_compensacao?: string | null
          forma_pagamento_vencer?: string | null
          id?: string
          limite_acumulo_horas?: number | null
          permite_saldo_negativo?: boolean | null
          permite_saldo_positivo?: boolean | null
          prazo_compensacao_dias?: number | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_banco_horas_config_acordo_id_fkey"
            columns: ["acordo_id"]
            isOneToOne: false
            referencedRelation: "ponto_acordos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_banco_horas_config_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "ponto_escalas"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_banco_horas_movimentacoes: {
        Row: {
          banco_horas_id: string
          colaborador_cpf: string
          created_at: string | null
          created_by: string | null
          data_referencia: string
          descricao: string | null
          id: string
          minutos: number
          tenant_id: string
          tipo: string
        }
        Insert: {
          banco_horas_id: string
          colaborador_cpf: string
          created_at?: string | null
          created_by?: string | null
          data_referencia: string
          descricao?: string | null
          id?: string
          minutos: number
          tenant_id: string
          tipo: string
        }
        Update: {
          banco_horas_id?: string
          colaborador_cpf?: string
          created_at?: string | null
          created_by?: string | null
          data_referencia?: string
          descricao?: string | null
          id?: string
          minutos?: number
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_banco_horas_movimentacoes_banco_horas_id_fkey"
            columns: ["banco_horas_id"]
            isOneToOne: false
            referencedRelation: "ponto_banco_horas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_banco_horas_movimentacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_cct_config: {
        Row: {
          adicional_noturno_percentual: number | null
          ativo: boolean | null
          banco_horas_permitido: boolean | null
          banco_horas_prazo_compensacao_meses: number | null
          categoria_profissional: string | null
          created_at: string | null
          dsr_proporcional: boolean | null
          empresa_id: string | null
          he_limite_diario_min: number | null
          he_percentual_dia_util: number | null
          he_percentual_domingos: number | null
          he_percentual_feriados: number | null
          hora_noturna_fim: string | null
          hora_noturna_inicio: string | null
          id: string
          intervalo_maximo_min: number | null
          intervalo_minimo_min: number | null
          jornada_diaria_horas: number | null
          jornada_semanal_horas: number | null
          nome: string
          observacoes: string | null
          sindicato: string | null
          tenant_id: string
          updated_at: string | null
          usa_hora_ficta: boolean | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          adicional_noturno_percentual?: number | null
          ativo?: boolean | null
          banco_horas_permitido?: boolean | null
          banco_horas_prazo_compensacao_meses?: number | null
          categoria_profissional?: string | null
          created_at?: string | null
          dsr_proporcional?: boolean | null
          empresa_id?: string | null
          he_limite_diario_min?: number | null
          he_percentual_dia_util?: number | null
          he_percentual_domingos?: number | null
          he_percentual_feriados?: number | null
          hora_noturna_fim?: string | null
          hora_noturna_inicio?: string | null
          id?: string
          intervalo_maximo_min?: number | null
          intervalo_minimo_min?: number | null
          jornada_diaria_horas?: number | null
          jornada_semanal_horas?: number | null
          nome: string
          observacoes?: string | null
          sindicato?: string | null
          tenant_id: string
          updated_at?: string | null
          usa_hora_ficta?: boolean | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          adicional_noturno_percentual?: number | null
          ativo?: boolean | null
          banco_horas_permitido?: boolean | null
          banco_horas_prazo_compensacao_meses?: number | null
          categoria_profissional?: string | null
          created_at?: string | null
          dsr_proporcional?: boolean | null
          empresa_id?: string | null
          he_limite_diario_min?: number | null
          he_percentual_dia_util?: number | null
          he_percentual_domingos?: number | null
          he_percentual_feriados?: number | null
          hora_noturna_fim?: string | null
          hora_noturna_inicio?: string | null
          id?: string
          intervalo_maximo_min?: number | null
          intervalo_minimo_min?: number | null
          jornada_diaria_horas?: number | null
          jornada_semanal_horas?: number | null
          nome?: string
          observacoes?: string | null
          sindicato?: string | null
          tenant_id?: string
          updated_at?: string | null
          usa_hora_ficta?: boolean | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_cct_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_cct_config_tenant_id_fkey"
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
          exigir_selfie_interno: boolean
          exigir_selfie_link: boolean
          he_diaria_max_minutos: number | null
          hora_entrada_padrao: string
          hora_retorno_almoco_padrao: string
          hora_saida_almoco_padrao: string
          hora_saida_padrao: string
          id: string
          interjornada_min_minutos: number | null
          jornada_diaria_max_minutos: number | null
          jornada_semanal_max_minutos: number | null
          modo_apuracao: string | null
          modo_registro: string
          permitir_registro_fora_horario: boolean
          ponto_excecao_acordo_url: string | null
          tenant_id: string
          tolerancia_atraso: number
          tolerancia_hora_extra: number
          updated_at: string
        }
        Insert: {
          bloquear_dispositivo_nao_autorizado?: boolean
          created_at?: string
          exigir_localizacao?: boolean
          exigir_selfie_interno?: boolean
          exigir_selfie_link?: boolean
          he_diaria_max_minutos?: number | null
          hora_entrada_padrao?: string
          hora_retorno_almoco_padrao?: string
          hora_saida_almoco_padrao?: string
          hora_saida_padrao?: string
          id?: string
          interjornada_min_minutos?: number | null
          jornada_diaria_max_minutos?: number | null
          jornada_semanal_max_minutos?: number | null
          modo_apuracao?: string | null
          modo_registro?: string
          permitir_registro_fora_horario?: boolean
          ponto_excecao_acordo_url?: string | null
          tenant_id: string
          tolerancia_atraso?: number
          tolerancia_hora_extra?: number
          updated_at?: string
        }
        Update: {
          bloquear_dispositivo_nao_autorizado?: boolean
          created_at?: string
          exigir_localizacao?: boolean
          exigir_selfie_interno?: boolean
          exigir_selfie_link?: boolean
          he_diaria_max_minutos?: number | null
          hora_entrada_padrao?: string
          hora_retorno_almoco_padrao?: string
          hora_saida_almoco_padrao?: string
          hora_saida_padrao?: string
          id?: string
          interjornada_min_minutos?: number | null
          jornada_diaria_max_minutos?: number | null
          jornada_semanal_max_minutos?: number | null
          modo_apuracao?: string | null
          modo_registro?: string
          permitir_registro_fora_horario?: boolean
          ponto_excecao_acordo_url?: string | null
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
          adicional_noturno_minutos: number | null
          atraso_minutos: number | null
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          data: string
          empresa_id: string | null
          entrada: string | null
          escala_id: string | null
          he_intervalo_suprimido_minutos: number | null
          horas_extras: string | null
          horas_extras_100_minutos: number | null
          horas_extras_50_minutos: number | null
          horas_faltantes: string | null
          horas_trabalhadas: string | null
          id: string
          intervalo_intrajornada_minutos: number | null
          observacao: string | null
          retorno_almoco: string | null
          saida: string | null
          saida_almoco: string | null
          status: string
          tenant_id: string
          tolerancia_aplicada: boolean | null
          updated_at: string
        }
        Insert: {
          adicional_noturno_minutos?: number | null
          atraso_minutos?: number | null
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          data: string
          empresa_id?: string | null
          entrada?: string | null
          escala_id?: string | null
          he_intervalo_suprimido_minutos?: number | null
          horas_extras?: string | null
          horas_extras_100_minutos?: number | null
          horas_extras_50_minutos?: number | null
          horas_faltantes?: string | null
          horas_trabalhadas?: string | null
          id?: string
          intervalo_intrajornada_minutos?: number | null
          observacao?: string | null
          retorno_almoco?: string | null
          saida?: string | null
          saida_almoco?: string | null
          status?: string
          tenant_id: string
          tolerancia_aplicada?: boolean | null
          updated_at?: string
        }
        Update: {
          adicional_noturno_minutos?: number | null
          atraso_minutos?: number | null
          colaborador_cpf?: string
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          data?: string
          empresa_id?: string | null
          entrada?: string | null
          escala_id?: string | null
          he_intervalo_suprimido_minutos?: number | null
          horas_extras?: string | null
          horas_extras_100_minutos?: number | null
          horas_extras_50_minutos?: number | null
          horas_faltantes?: string | null
          horas_trabalhadas?: string | null
          id?: string
          intervalo_intrajornada_minutos?: number | null
          observacao?: string | null
          retorno_almoco?: string | null
          saida?: string | null
          saida_almoco?: string | null
          status?: string
          tenant_id?: string
          tolerancia_aplicada?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_diario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_diario_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "ponto_escalas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_diario_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_escala_atribuicoes: {
        Row: {
          ativa: boolean | null
          colaborador_cpf: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          escala_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          ativa?: boolean | null
          colaborador_cpf?: string | null
          colaborador_id: string
          colaborador_nome: string
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          escala_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          ativa?: boolean | null
          colaborador_cpf?: string | null
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          escala_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_escala_atribuicoes_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "ponto_escalas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_escala_atribuicoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_escala_historico_interpretacao: {
        Row: {
          ajuste_usuario: Json | null
          alertas: Json | null
          created_at: string
          descricao_contratual: string | null
          entrada_original: string
          escala_id: string | null
          id: string
          nivel_confianca: string | null
          origem_input: string
          saida_ia: Json
          tenant_id: string
          transcricao_audio: string | null
          user_id: string | null
        }
        Insert: {
          ajuste_usuario?: Json | null
          alertas?: Json | null
          created_at?: string
          descricao_contratual?: string | null
          entrada_original: string
          escala_id?: string | null
          id?: string
          nivel_confianca?: string | null
          origem_input?: string
          saida_ia: Json
          tenant_id: string
          transcricao_audio?: string | null
          user_id?: string | null
        }
        Update: {
          ajuste_usuario?: Json | null
          alertas?: Json | null
          created_at?: string
          descricao_contratual?: string | null
          entrada_original?: string
          escala_id?: string | null
          id?: string
          nivel_confianca?: string | null
          origem_input?: string
          saida_ia?: Json
          tenant_id?: string
          transcricao_audio?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_escala_historico_interpretacao_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "ponto_escalas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_escala_historico_interpretacao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_escala_padroes: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          descricao: string | null
          estrutura: Json
          exemplo_descricao: string | null
          id: string
          nome: string
          tenant_id: string | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          estrutura: Json
          exemplo_descricao?: string | null
          id?: string
          nome: string
          tenant_id?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          estrutura?: Json
          exemplo_descricao?: string | null
          id?: string
          nome?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_escala_padroes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_escala_periodos: {
        Row: {
          created_at: string
          dia_semana: string
          escala_id: string
          hora_fim: string
          hora_inicio: string
          id: string
          ordem_bloco: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          dia_semana: string
          escala_id: string
          hora_fim: string
          hora_inicio: string
          id?: string
          ordem_bloco?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          dia_semana?: string
          escala_id?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          ordem_bloco?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_escala_periodos_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "ponto_escalas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_escala_periodos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_escala_recorrencias: {
        Row: {
          created_at: string
          descricao: string | null
          dia_semana: string
          escala_id: string
          hora_fim: string
          hora_inicio: string
          id: string
          observacao: string | null
          ordinal_mes: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          dia_semana: string
          escala_id: string
          hora_fim: string
          hora_inicio: string
          id?: string
          observacao?: string | null
          ordinal_mes: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          dia_semana?: string
          escala_id?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          observacao?: string | null
          ordinal_mes?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_escala_recorrencias_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "ponto_escalas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_escala_recorrencias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_escalas: {
        Row: {
          acordo_individual_url: string | null
          adicional_noturno_fim: string | null
          adicional_noturno_inicio: string | null
          ativa: boolean | null
          cct_act_url: string | null
          ciclo_horas_descanso: number | null
          ciclo_horas_trabalho: number | null
          ciclo_inicio_data: string | null
          ciclo_inicio_hora: string | null
          compensacoes_mensais: Json | null
          created_at: string | null
          descricao_contratual: string | null
          descricao_original: string | null
          dias_config: Json | null
          dias_semana: Json | null
          domingo_util: boolean | null
          empresa_id: string | null
          hora_entrada_padrao: string | null
          hora_saida_padrao: string | null
          id: string
          intervalo_intrajornada_minutos: number
          janela_flexivel: Json | null
          jornada_diaria_minutos: number
          jornada_mensal_minutos: number | null
          jornada_semanal_minutos: number
          modalidade: string
          nivel_confianca: string | null
          nome: string
          observacoes: string | null
          origem_input: string | null
          percentual_adicional_noturno: number | null
          percentual_hora_extra_100: number | null
          percentual_hora_extra_50: number | null
          regras_extras: Json | null
          sabado_util: boolean | null
          tenant_id: string
          tipo: string
          tolerancia_diaria_minutos: number
          tolerancia_minutos: number
          updated_at: string | null
          usa_hora_ficta_noturna: boolean | null
        }
        Insert: {
          acordo_individual_url?: string | null
          adicional_noturno_fim?: string | null
          adicional_noturno_inicio?: string | null
          ativa?: boolean | null
          cct_act_url?: string | null
          ciclo_horas_descanso?: number | null
          ciclo_horas_trabalho?: number | null
          ciclo_inicio_data?: string | null
          ciclo_inicio_hora?: string | null
          compensacoes_mensais?: Json | null
          created_at?: string | null
          descricao_contratual?: string | null
          descricao_original?: string | null
          dias_config?: Json | null
          dias_semana?: Json | null
          domingo_util?: boolean | null
          empresa_id?: string | null
          hora_entrada_padrao?: string | null
          hora_saida_padrao?: string | null
          id?: string
          intervalo_intrajornada_minutos?: number
          janela_flexivel?: Json | null
          jornada_diaria_minutos?: number
          jornada_mensal_minutos?: number | null
          jornada_semanal_minutos?: number
          modalidade?: string
          nivel_confianca?: string | null
          nome: string
          observacoes?: string | null
          origem_input?: string | null
          percentual_adicional_noturno?: number | null
          percentual_hora_extra_100?: number | null
          percentual_hora_extra_50?: number | null
          regras_extras?: Json | null
          sabado_util?: boolean | null
          tenant_id: string
          tipo?: string
          tolerancia_diaria_minutos?: number
          tolerancia_minutos?: number
          updated_at?: string | null
          usa_hora_ficta_noturna?: boolean | null
        }
        Update: {
          acordo_individual_url?: string | null
          adicional_noturno_fim?: string | null
          adicional_noturno_inicio?: string | null
          ativa?: boolean | null
          cct_act_url?: string | null
          ciclo_horas_descanso?: number | null
          ciclo_horas_trabalho?: number | null
          ciclo_inicio_data?: string | null
          ciclo_inicio_hora?: string | null
          compensacoes_mensais?: Json | null
          created_at?: string | null
          descricao_contratual?: string | null
          descricao_original?: string | null
          dias_config?: Json | null
          dias_semana?: Json | null
          domingo_util?: boolean | null
          empresa_id?: string | null
          hora_entrada_padrao?: string | null
          hora_saida_padrao?: string | null
          id?: string
          intervalo_intrajornada_minutos?: number
          janela_flexivel?: Json | null
          jornada_diaria_minutos?: number
          jornada_mensal_minutos?: number | null
          jornada_semanal_minutos?: number
          modalidade?: string
          nivel_confianca?: string | null
          nome?: string
          observacoes?: string | null
          origem_input?: string | null
          percentual_adicional_noturno?: number | null
          percentual_hora_extra_100?: number | null
          percentual_hora_extra_50?: number | null
          regras_extras?: Json | null
          sabado_util?: boolean | null
          tenant_id?: string
          tipo?: string
          tolerancia_diaria_minutos?: number
          tolerancia_minutos?: number
          updated_at?: string | null
          usa_hora_ficta_noturna?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_escalas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_escalas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_espelhos: {
        Row: {
          arquivo_url: string | null
          assinatura_hash: string | null
          banco_horas_saldo_minutos: number | null
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          competencia: string
          confirmado_por: string | null
          created_at: string | null
          data_confirmacao: string | null
          empresa_id: string | null
          fechamento_id: string | null
          id: string
          ressalva_texto: string | null
          status: string
          tenant_id: string
          total_adicional_noturno_minutos: number | null
          total_atrasos_minutos: number | null
          total_dsr: number | null
          total_faltas: number | null
          total_horas_extras_100_minutos: number | null
          total_horas_extras_50_minutos: number | null
          total_horas_normais_minutos: number | null
          updated_at: string | null
        }
        Insert: {
          arquivo_url?: string | null
          assinatura_hash?: string | null
          banco_horas_saldo_minutos?: number | null
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          competencia: string
          confirmado_por?: string | null
          created_at?: string | null
          data_confirmacao?: string | null
          empresa_id?: string | null
          fechamento_id?: string | null
          id?: string
          ressalva_texto?: string | null
          status?: string
          tenant_id: string
          total_adicional_noturno_minutos?: number | null
          total_atrasos_minutos?: number | null
          total_dsr?: number | null
          total_faltas?: number | null
          total_horas_extras_100_minutos?: number | null
          total_horas_extras_50_minutos?: number | null
          total_horas_normais_minutos?: number | null
          updated_at?: string | null
        }
        Update: {
          arquivo_url?: string | null
          assinatura_hash?: string | null
          banco_horas_saldo_minutos?: number | null
          colaborador_cpf?: string
          colaborador_id?: string
          colaborador_nome?: string
          competencia?: string
          confirmado_por?: string | null
          created_at?: string | null
          data_confirmacao?: string | null
          empresa_id?: string | null
          fechamento_id?: string | null
          id?: string
          ressalva_texto?: string | null
          status?: string
          tenant_id?: string
          total_adicional_noturno_minutos?: number | null
          total_atrasos_minutos?: number | null
          total_dsr?: number | null
          total_faltas?: number | null
          total_horas_extras_100_minutos?: number | null
          total_horas_extras_50_minutos?: number | null
          total_horas_normais_minutos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_espelhos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_espelhos_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "ponto_fechamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_espelhos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_exportacoes_folha: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          competencia: string
          created_at: string | null
          dados_exportados: Json | null
          empresa_id: string | null
          formato: string | null
          gerado_por: string | null
          gerado_por_id: string | null
          id: string
          sistema_destino: string | null
          status: string | null
          tenant_id: string
          total_colaboradores: number | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          competencia: string
          created_at?: string | null
          dados_exportados?: Json | null
          empresa_id?: string | null
          formato?: string | null
          gerado_por?: string | null
          gerado_por_id?: string | null
          id?: string
          sistema_destino?: string | null
          status?: string | null
          tenant_id: string
          total_colaboradores?: number | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          competencia?: string
          created_at?: string | null
          dados_exportados?: Json | null
          empresa_id?: string | null
          formato?: string | null
          gerado_por?: string | null
          gerado_por_id?: string | null
          id?: string
          sistema_destino?: string | null
          status?: string | null
          tenant_id?: string
          total_colaboradores?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_exportacoes_folha_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_exportacoes_folha_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_fechamentos: {
        Row: {
          competencia: string
          created_at: string | null
          data_fechamento: string | null
          empresa_id: string | null
          fechado_por: string | null
          fechado_por_nome: string | null
          id: string
          observacoes: string | null
          status: string
          tenant_id: string
          total_adicional_noturno_minutos: number | null
          total_atrasos: number | null
          total_colaboradores: number | null
          total_faltas: number | null
          total_horas_extras_minutos: number | null
          total_horas_normais_minutos: number | null
          updated_at: string | null
        }
        Insert: {
          competencia: string
          created_at?: string | null
          data_fechamento?: string | null
          empresa_id?: string | null
          fechado_por?: string | null
          fechado_por_nome?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id: string
          total_adicional_noturno_minutos?: number | null
          total_atrasos?: number | null
          total_colaboradores?: number | null
          total_faltas?: number | null
          total_horas_extras_minutos?: number | null
          total_horas_normais_minutos?: number | null
          updated_at?: string | null
        }
        Update: {
          competencia?: string
          created_at?: string | null
          data_fechamento?: string | null
          empresa_id?: string | null
          fechado_por?: string | null
          fechado_por_nome?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id?: string
          total_adicional_noturno_minutos?: number | null
          total_atrasos?: number | null
          total_colaboradores?: number | null
          total_faltas?: number | null
          total_horas_extras_minutos?: number | null
          total_horas_normais_minutos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_fechamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_fechamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_justificativas: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string | null
          horas_abono: number
          id: string
          nome: string
          ordem: number
          requer_anexo: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          horas_abono?: number
          id?: string
          nome: string
          ordem?: number
          requer_anexo?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          horas_abono?: number
          id?: string
          nome?: string
          ordem?: number
          requer_anexo?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ponto_links: {
        Row: {
          ativo: boolean
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          data_expiracao: string | null
          id: string
          tenant_id: string
          token: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          data_expiracao?: string | null
          id?: string
          tenant_id: string
          token: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          colaborador_cpf?: string
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          data_expiracao?: string | null
          id?: string
          tenant_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_marcacoes: {
        Row: {
          classificacao_clt: string | null
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          comprovante_gerado: boolean | null
          created_at: string
          created_by: string | null
          data_marcacao: string
          dispositivo: string | null
          empresa_id: string | null
          endereco_geolocalizacao: string | null
          hash_marcacao: string
          hora_marcacao: string
          id: string
          ip_origem: string | null
          latitude: number | null
          longitude: number | null
          marcacao_original: boolean
          selfie_nome: string | null
          selfie_url: string | null
          tenant_id: string
          tipo_marcacao: string
          user_agent: string | null
        }
        Insert: {
          classificacao_clt?: string | null
          colaborador_cpf: string
          colaborador_id: string
          colaborador_nome: string
          comprovante_gerado?: boolean | null
          created_at?: string
          created_by?: string | null
          data_marcacao?: string
          dispositivo?: string | null
          empresa_id?: string | null
          endereco_geolocalizacao?: string | null
          hash_marcacao: string
          hora_marcacao?: string
          id?: string
          ip_origem?: string | null
          latitude?: number | null
          longitude?: number | null
          marcacao_original?: boolean
          selfie_nome?: string | null
          selfie_url?: string | null
          tenant_id: string
          tipo_marcacao: string
          user_agent?: string | null
        }
        Update: {
          classificacao_clt?: string | null
          colaborador_cpf?: string
          colaborador_id?: string
          colaborador_nome?: string
          comprovante_gerado?: boolean | null
          created_at?: string
          created_by?: string | null
          data_marcacao?: string
          dispositivo?: string | null
          empresa_id?: string | null
          endereco_geolocalizacao?: string | null
          hash_marcacao?: string
          hora_marcacao?: string
          id?: string
          ip_origem?: string | null
          latitude?: number | null
          longitude?: number | null
          marcacao_original?: boolean
          selfie_nome?: string | null
          selfie_url?: string | null
          tenant_id?: string
          tipo_marcacao?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_marcacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_marcacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_repc_importacoes: {
        Row: {
          arquivo_nome: string
          arquivo_url: string | null
          created_at: string | null
          empresa_id: string | null
          erros: Json | null
          fabricante: string | null
          id: string
          importado_por: string | null
          importado_por_id: string | null
          modelo: string | null
          numero_serie: string | null
          registros_importados: number | null
          registros_rejeitados: number | null
          status: string | null
          tenant_id: string
          tipo_equipamento: string | null
          total_registros: number | null
          updated_at: string | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_url?: string | null
          created_at?: string | null
          empresa_id?: string | null
          erros?: Json | null
          fabricante?: string | null
          id?: string
          importado_por?: string | null
          importado_por_id?: string | null
          modelo?: string | null
          numero_serie?: string | null
          registros_importados?: number | null
          registros_rejeitados?: number | null
          status?: string | null
          tenant_id: string
          tipo_equipamento?: string | null
          total_registros?: number | null
          updated_at?: string | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_url?: string | null
          created_at?: string | null
          empresa_id?: string | null
          erros?: Json | null
          fabricante?: string | null
          id?: string
          importado_por?: string | null
          importado_por_id?: string | null
          modelo?: string | null
          numero_serie?: string | null
          registros_importados?: number | null
          registros_rejeitados?: number | null
          status?: string | null
          tenant_id?: string
          tipo_equipamento?: string | null
          total_registros?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_repc_importacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_repc_importacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_semanal: {
        Row: {
          ano: number
          colaborador_cpf: string
          colaborador_nome: string
          created_at: string | null
          data_fim: string
          data_inicio: string
          he_semanal_excedente_minutos: number | null
          id: string
          limite_semanal_minutos: number | null
          semana: number
          tenant_id: string
          total_he_diaria_minutos: number | null
          total_horas_trabalhadas_minutos: number | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          colaborador_cpf: string
          colaborador_nome: string
          created_at?: string | null
          data_fim: string
          data_inicio: string
          he_semanal_excedente_minutos?: number | null
          id?: string
          limite_semanal_minutos?: number | null
          semana: number
          tenant_id: string
          total_he_diaria_minutos?: number | null
          total_horas_trabalhadas_minutos?: number | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          colaborador_cpf?: string
          colaborador_nome?: string
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          he_semanal_excedente_minutos?: number | null
          id?: string
          limite_semanal_minutos?: number | null
          semana?: number
          tenant_id?: string
          total_he_diaria_minutos?: number | null
          total_horas_trabalhadas_minutos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_semanal_tenant_id_fkey"
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
          onboarding_concluido: boolean
          onboarding_token: string | null
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
          onboarding_concluido?: boolean
          onboarding_token?: string | null
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
          onboarding_concluido?: boolean
          onboarding_token?: string | null
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
      programa_validador_clientes: {
        Row: {
          aceita_beta: boolean | null
          aceite_ip: string | null
          aceite_termos_em: string | null
          aceite_user_agent: string | null
          aceite_versao_termos: string | null
          activation_token: string | null
          activation_token_expires_at: string | null
          cidade_foro: string | null
          cnpj: string | null
          conta_ativada: boolean | null
          conta_ativada_em: string | null
          created_at: string
          data_contrato: string | null
          data_fim_piloto: string | null
          data_inicio_piloto: string | null
          data_vigencia_fim: string | null
          dia_vencimento: number | null
          empresa_cadastro_id: string | null
          endereco: string | null
          fase: string
          id: string
          modulos_contratados: string[] | null
          nome_empresa: string
          observacoes: string | null
          onboarding_token: string | null
          plano: string | null
          poc_cargo: string | null
          poc_email: string | null
          poc_nome: string | null
          poc_telefone: string | null
          quantidade_colaboradores: number | null
          representante: string | null
          responsavel_seguramente: string | null
          segmento: string | null
          tamanho_empresa: string | null
          tenant_id: string | null
          tipo_cliente: string
          updated_at: string
          user_id: string | null
          valor_mensal: number | null
        }
        Insert: {
          aceita_beta?: boolean | null
          aceite_ip?: string | null
          aceite_termos_em?: string | null
          aceite_user_agent?: string | null
          aceite_versao_termos?: string | null
          activation_token?: string | null
          activation_token_expires_at?: string | null
          cidade_foro?: string | null
          cnpj?: string | null
          conta_ativada?: boolean | null
          conta_ativada_em?: string | null
          created_at?: string
          data_contrato?: string | null
          data_fim_piloto?: string | null
          data_inicio_piloto?: string | null
          data_vigencia_fim?: string | null
          dia_vencimento?: number | null
          empresa_cadastro_id?: string | null
          endereco?: string | null
          fase?: string
          id?: string
          modulos_contratados?: string[] | null
          nome_empresa: string
          observacoes?: string | null
          onboarding_token?: string | null
          plano?: string | null
          poc_cargo?: string | null
          poc_email?: string | null
          poc_nome?: string | null
          poc_telefone?: string | null
          quantidade_colaboradores?: number | null
          representante?: string | null
          responsavel_seguramente?: string | null
          segmento?: string | null
          tamanho_empresa?: string | null
          tenant_id?: string | null
          tipo_cliente?: string
          updated_at?: string
          user_id?: string | null
          valor_mensal?: number | null
        }
        Update: {
          aceita_beta?: boolean | null
          aceite_ip?: string | null
          aceite_termos_em?: string | null
          aceite_user_agent?: string | null
          aceite_versao_termos?: string | null
          activation_token?: string | null
          activation_token_expires_at?: string | null
          cidade_foro?: string | null
          cnpj?: string | null
          conta_ativada?: boolean | null
          conta_ativada_em?: string | null
          created_at?: string
          data_contrato?: string | null
          data_fim_piloto?: string | null
          data_inicio_piloto?: string | null
          data_vigencia_fim?: string | null
          dia_vencimento?: number | null
          empresa_cadastro_id?: string | null
          endereco?: string | null
          fase?: string
          id?: string
          modulos_contratados?: string[] | null
          nome_empresa?: string
          observacoes?: string | null
          onboarding_token?: string | null
          plano?: string | null
          poc_cargo?: string | null
          poc_email?: string | null
          poc_nome?: string | null
          poc_telefone?: string | null
          quantidade_colaboradores?: number | null
          representante?: string | null
          responsavel_seguramente?: string | null
          segmento?: string | null
          tamanho_empresa?: string | null
          tenant_id?: string | null
          tipo_cliente?: string
          updated_at?: string
          user_id?: string | null
          valor_mensal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "programa_validador_clientes_empresa_cadastro_id_fkey"
            columns: ["empresa_cadastro_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programa_validador_clientes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      programa_validador_contratos: {
        Row: {
          assinado_em: string | null
          assinado_por: string | null
          assinatura_img: string | null
          cliente_id: string
          created_at: string
          enviado_em: string | null
          expira_em: string
          html_assinado: string | null
          html_contrato: string
          id: string
          ip_assinatura: string | null
          status: string
          storage_path: string | null
          token: string
          updated_at: string
        }
        Insert: {
          assinado_em?: string | null
          assinado_por?: string | null
          assinatura_img?: string | null
          cliente_id: string
          created_at?: string
          enviado_em?: string | null
          expira_em?: string
          html_assinado?: string | null
          html_contrato: string
          id?: string
          ip_assinatura?: string | null
          status?: string
          storage_path?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          assinado_em?: string | null
          assinado_por?: string | null
          assinatura_img?: string | null
          cliente_id?: string
          created_at?: string
          enviado_em?: string | null
          expira_em?: string
          html_assinado?: string | null
          html_contrato?: string
          id?: string
          ip_assinatura?: string | null
          status?: string
          storage_path?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programa_validador_contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "programa_validador_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      programa_validador_documento_links: {
        Row: {
          aceito_em: string | null
          aceito_por: string | null
          cliente_id: string
          created_at: string
          documento_id: string | null
          expira_em: string
          html_assinado: string | null
          html_documento: string
          id: string
          motivo_recusa: string | null
          recusado_em: string | null
          status: string
          tipo: string
          token: string
          updated_at: string
        }
        Insert: {
          aceito_em?: string | null
          aceito_por?: string | null
          cliente_id: string
          created_at?: string
          documento_id?: string | null
          expira_em?: string
          html_assinado?: string | null
          html_documento: string
          id?: string
          motivo_recusa?: string | null
          recusado_em?: string | null
          status?: string
          tipo: string
          token?: string
          updated_at?: string
        }
        Update: {
          aceito_em?: string | null
          aceito_por?: string | null
          cliente_id?: string
          created_at?: string
          documento_id?: string | null
          expira_em?: string
          html_assinado?: string | null
          html_documento?: string
          id?: string
          motivo_recusa?: string | null
          recusado_em?: string | null
          status?: string
          tipo?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programa_validador_documento_links_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "programa_validador_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programa_validador_documento_links_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "programa_validador_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      programa_validador_documentos: {
        Row: {
          aceito_em: string | null
          arquivo_url: string | null
          cliente_id: string
          created_at: string
          enviado_em: string | null
          id: string
          observacao: string | null
          status: string
          tipo: string
          updated_at: string
          versao: string | null
        }
        Insert: {
          aceito_em?: string | null
          arquivo_url?: string | null
          cliente_id: string
          created_at?: string
          enviado_em?: string | null
          id?: string
          observacao?: string | null
          status?: string
          tipo: string
          updated_at?: string
          versao?: string | null
        }
        Update: {
          aceito_em?: string | null
          arquivo_url?: string | null
          cliente_id?: string
          created_at?: string
          enviado_em?: string | null
          id?: string
          observacao?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          versao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programa_validador_documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "programa_validador_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      programa_validador_historico: {
        Row: {
          autor: string | null
          cliente_id: string
          created_at: string
          descricao: string | null
          id: string
          tipo: string
          titulo: string
        }
        Insert: {
          autor?: string | null
          cliente_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          tipo: string
          titulo: string
        }
        Update: {
          autor?: string | null
          cliente_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "programa_validador_historico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "programa_validador_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      psicossocial_alertas: {
        Row: {
          acao_criada_id: string | null
          acao_id: string | null
          campanha_id: string | null
          classificacao: string | null
          created_at: string
          descricao: string | null
          dimensao_id: string | null
          dimensao_nome: string | null
          funcao: string | null
          id: string
          metadados: Json | null
          resolvido: boolean | null
          resolvido_em: string | null
          score_ips: number | null
          score_risco: number | null
          setor: string | null
          severidade: string
          tenant_id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          acao_criada_id?: string | null
          acao_id?: string | null
          campanha_id?: string | null
          classificacao?: string | null
          created_at?: string
          descricao?: string | null
          dimensao_id?: string | null
          dimensao_nome?: string | null
          funcao?: string | null
          id?: string
          metadados?: Json | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          score_ips?: number | null
          score_risco?: number | null
          setor?: string | null
          severidade?: string
          tenant_id: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          acao_criada_id?: string | null
          acao_id?: string | null
          campanha_id?: string | null
          classificacao?: string | null
          created_at?: string
          descricao?: string | null
          dimensao_id?: string | null
          dimensao_nome?: string | null
          funcao?: string | null
          id?: string
          metadados?: Json | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          score_ips?: number | null
          score_risco?: number | null
          setor?: string | null
          severidade?: string
          tenant_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "psicossocial_alertas_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "plano_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psicossocial_alertas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      psicossocial_consentimentos: {
        Row: {
          aceite_anonimato: boolean
          campanha_id: string
          created_at: string
          id: string
          identificacao_voluntaria: boolean
          ip_address: string | null
          session_hash: string
          tenant_id: string
          timestamp_aceite: string
          user_agent: string | null
          versao_termo: string
        }
        Insert: {
          aceite_anonimato?: boolean
          campanha_id: string
          created_at?: string
          id?: string
          identificacao_voluntaria?: boolean
          ip_address?: string | null
          session_hash: string
          tenant_id: string
          timestamp_aceite?: string
          user_agent?: string | null
          versao_termo?: string
        }
        Update: {
          aceite_anonimato?: boolean
          campanha_id?: string
          created_at?: string
          id?: string
          identificacao_voluntaria?: boolean
          ip_address?: string | null
          session_hash?: string
          tenant_id?: string
          timestamp_aceite?: string
          user_agent?: string | null
          versao_termo?: string
        }
        Relationships: [
          {
            foreignKeyName: "psicossocial_consentimentos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psicossocial_consentimentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      psicossocial_dimensoes: {
        Row: {
          ativo: boolean | null
          categoria: string
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          instrumento: string
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          instrumento?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          instrumento?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      psicossocial_entrevistas: {
        Row: {
          campanha_id: string
          colaborador_id: string | null
          colaborador_nome: string | null
          concluida_em: string | null
          consentimento_lgpd_em: string | null
          created_at: string
          empresa_id: string | null
          fase_atual: number
          ghe_id_snapshot: string | null
          id: string
          iniciada_em: string | null
          modalidade: string
          resumo_ia: Json | null
          riscos_cobertos: number
          status: string
          tenant_id: string
          token: string
          total_riscos: number
          updated_at: string
        }
        Insert: {
          campanha_id: string
          colaborador_id?: string | null
          colaborador_nome?: string | null
          concluida_em?: string | null
          consentimento_lgpd_em?: string | null
          created_at?: string
          empresa_id?: string | null
          fase_atual?: number
          ghe_id_snapshot?: string | null
          id?: string
          iniciada_em?: string | null
          modalidade?: string
          resumo_ia?: Json | null
          riscos_cobertos?: number
          status?: string
          tenant_id: string
          token?: string
          total_riscos?: number
          updated_at?: string
        }
        Update: {
          campanha_id?: string
          colaborador_id?: string | null
          colaborador_nome?: string | null
          concluida_em?: string | null
          consentimento_lgpd_em?: string | null
          created_at?: string
          empresa_id?: string | null
          fase_atual?: number
          ghe_id_snapshot?: string | null
          id?: string
          iniciada_em?: string | null
          modalidade?: string
          resumo_ia?: Json | null
          riscos_cobertos?: number
          status?: string
          tenant_id?: string
          token?: string
          total_riscos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "psicossocial_entrevistas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      psicossocial_entrevistas_evidencias: {
        Row: {
          campanha_id: string
          created_at: string
          empresa_id: string | null
          entrevista_id: string
          id: string
          justificativa: string | null
          nivel_risco: string | null
          presente: boolean
          probabilidade: number | null
          risco_catalogo_id: string | null
          risco_nome: string
          severidade: number | null
          tenant_id: string
          trechos_anonimizados: string[] | null
        }
        Insert: {
          campanha_id: string
          created_at?: string
          empresa_id?: string | null
          entrevista_id: string
          id?: string
          justificativa?: string | null
          nivel_risco?: string | null
          presente?: boolean
          probabilidade?: number | null
          risco_catalogo_id?: string | null
          risco_nome: string
          severidade?: number | null
          tenant_id: string
          trechos_anonimizados?: string[] | null
        }
        Update: {
          campanha_id?: string
          created_at?: string
          empresa_id?: string | null
          entrevista_id?: string
          id?: string
          justificativa?: string | null
          nivel_risco?: string | null
          presente?: boolean
          probabilidade?: number | null
          risco_catalogo_id?: string | null
          risco_nome?: string
          severidade?: number | null
          tenant_id?: string
          trechos_anonimizados?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "psicossocial_entrevistas_evidencias_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psicossocial_entrevistas_evidencias_entrevista_id_fkey"
            columns: ["entrevista_id"]
            isOneToOne: false
            referencedRelation: "psicossocial_entrevistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psicossocial_entrevistas_evidencias_risco_catalogo_id_fkey"
            columns: ["risco_catalogo_id"]
            isOneToOne: false
            referencedRelation: "psicossocial_riscos"
            referencedColumns: ["id"]
          },
        ]
      }
      psicossocial_entrevistas_mensagens: {
        Row: {
          content: string
          created_at: string
          entrevista_id: string
          fase: number | null
          id: string
          origem: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          entrevista_id: string
          fase?: number | null
          id?: string
          origem?: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          entrevista_id?: string
          fase?: number | null
          id?: string
          origem?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "psicossocial_entrevistas_mensagens_entrevista_id_fkey"
            columns: ["entrevista_id"]
            isOneToOne: false
            referencedRelation: "psicossocial_entrevistas"
            referencedColumns: ["id"]
          },
        ]
      }
      psicossocial_evidencias: {
        Row: {
          campanha_id: string | null
          created_at: string
          id: string
          indicador: string
          metadados: Json | null
          periodo_fim: string | null
          periodo_inicio: string | null
          peso: number | null
          referencia_id: string | null
          tenant_id: string
          tipo_modulo: string
          valor: number | null
          valor_texto: string | null
        }
        Insert: {
          campanha_id?: string | null
          created_at?: string
          id?: string
          indicador: string
          metadados?: Json | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          peso?: number | null
          referencia_id?: string | null
          tenant_id: string
          tipo_modulo: string
          valor?: number | null
          valor_texto?: string | null
        }
        Update: {
          campanha_id?: string | null
          created_at?: string
          id?: string
          indicador?: string
          metadados?: Json | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          peso?: number | null
          referencia_id?: string | null
          tenant_id?: string
          tipo_modulo?: string
          valor?: number | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "psicossocial_evidencias_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      psicossocial_ghe: {
        Row: {
          ativo: boolean
          ausencias_justificadas: number
          codigo: string
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          percentual_minimo: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          ausencias_justificadas?: number
          codigo: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          percentual_minimo?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          ausencias_justificadas?: number
          codigo?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          percentual_minimo?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      psicossocial_ghe_cargos: {
        Row: {
          cargo_id: string
          created_at: string
          departamento_id: string | null
          ghe_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          cargo_id: string
          created_at?: string
          departamento_id?: string | null
          ghe_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          cargo_id?: string
          created_at?: string
          departamento_id?: string | null
          ghe_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "psicossocial_ghe_cargos_ghe_id_fkey"
            columns: ["ghe_id"]
            isOneToOne: false
            referencedRelation: "psicossocial_ghe"
            referencedColumns: ["id"]
          },
        ]
      }
      psicossocial_indice_confiabilidade: {
        Row: {
          calculado_em: string
          campanha_id: string
          classificacao: string
          created_at: string
          detalhes: Json | null
          id: string
          indice_confiabilidade: number
          periodo_fim: string | null
          periodo_inicio: string | null
          score_absenteismo: number | null
          score_acidentes: number | null
          score_afastamentos: number | null
          score_denuncias: number | null
          score_humor: number | null
          score_turnover: number | null
          tenant_id: string
          total_colaboradores: number | null
          updated_at: string
        }
        Insert: {
          calculado_em?: string
          campanha_id: string
          classificacao?: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          indice_confiabilidade?: number
          periodo_fim?: string | null
          periodo_inicio?: string | null
          score_absenteismo?: number | null
          score_acidentes?: number | null
          score_afastamentos?: number | null
          score_denuncias?: number | null
          score_humor?: number | null
          score_turnover?: number | null
          tenant_id: string
          total_colaboradores?: number | null
          updated_at?: string
        }
        Update: {
          calculado_em?: string
          campanha_id?: string
          classificacao?: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          indice_confiabilidade?: number
          periodo_fim?: string | null
          periodo_inicio?: string | null
          score_absenteismo?: number | null
          score_acidentes?: number | null
          score_afastamentos?: number | null
          score_denuncias?: number | null
          score_humor?: number | null
          score_turnover?: number | null
          tenant_id?: string
          total_colaboradores?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "psicossocial_indice_confiabilidade_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psicossocial_indice_confiabilidade_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      psicossocial_instrumento_dimensao: {
        Row: {
          created_at: string
          descricao: string | null
          dimensao: string
          id: string
          instrumento: string
          risco_nome: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          dimensao: string
          id?: string
          instrumento: string
          risco_nome: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          dimensao?: string
          id?: string
          instrumento?: string
          risco_nome?: string
        }
        Relationships: []
      }
      psicossocial_inventario_riscos: {
        Row: {
          acao_recomendada: string | null
          campanha_id: string | null
          classificacao: string
          created_at: string
          evidencias: Json | null
          exposicao: string
          fator_psicossocial: string
          funcao: string | null
          id: string
          plano_acao_id: string | null
          probabilidade: string
          setor: string | null
          severidade: string
          status: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          acao_recomendada?: string | null
          campanha_id?: string | null
          classificacao?: string
          created_at?: string
          evidencias?: Json | null
          exposicao?: string
          fator_psicossocial: string
          funcao?: string | null
          id?: string
          plano_acao_id?: string | null
          probabilidade?: string
          setor?: string | null
          severidade?: string
          status?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          acao_recomendada?: string | null
          campanha_id?: string | null
          classificacao?: string
          created_at?: string
          evidencias?: Json | null
          exposicao?: string
          fator_psicossocial?: string
          funcao?: string | null
          id?: string
          plano_acao_id?: string | null
          probabilidade?: string
          setor?: string | null
          severidade?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "psicossocial_inventario_riscos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      psicossocial_otp_verificacao: {
        Row: {
          campanha_id: string
          codigo: string
          criado_em: string
          expira_em: string
          id: string
          telefone_hash: string
          tentativas: number
          verificado: boolean
          verificado_em: string | null
        }
        Insert: {
          campanha_id: string
          codigo: string
          criado_em?: string
          expira_em?: string
          id?: string
          telefone_hash: string
          tentativas?: number
          verificado?: boolean
          verificado_em?: string | null
        }
        Update: {
          campanha_id?: string
          codigo?: string
          criado_em?: string
          expira_em?: string
          id?: string
          telefone_hash?: string
          tentativas?: number
          verificado?: boolean
          verificado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "psicossocial_otp_verificacao_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      psicossocial_participacoes: {
        Row: {
          campanha_id: string
          cargo: string | null
          colaborador_cpf: string | null
          colaborador_id: string | null
          colaborador_nome: string | null
          created_at: string
          elegivel: boolean
          enviado_em: string | null
          enviado_via: string | null
          id: string
          respondido: boolean
          respondido_em: string | null
          setor: string | null
          tenant_id: string
          token: string
          turno: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          campanha_id: string
          cargo?: string | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          created_at?: string
          elegivel?: boolean
          enviado_em?: string | null
          enviado_via?: string | null
          id?: string
          respondido?: boolean
          respondido_em?: string | null
          setor?: string | null
          tenant_id: string
          token?: string
          turno?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          campanha_id?: string
          cargo?: string | null
          colaborador_cpf?: string | null
          colaborador_id?: string | null
          colaborador_nome?: string | null
          created_at?: string
          elegivel?: boolean
          enviado_em?: string | null
          enviado_via?: string | null
          id?: string
          respondido?: boolean
          respondido_em?: string | null
          setor?: string | null
          tenant_id?: string
          token?: string
          turno?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "psicossocial_participacoes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psicossocial_participacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      psicossocial_riscos: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          padrao: boolean
          severidade: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          padrao?: boolean
          severidade?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          padrao?: boolean
          severidade?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      psicossocial_telefone_usado: {
        Row: {
          campanha_id: string
          criado_em: string
          id: string
          telefone_hash: string
        }
        Insert: {
          campanha_id: string
          criado_em?: string
          id?: string
          telefone_hash: string
        }
        Update: {
          campanha_id?: string
          criado_em?: string
          id?: string
          telefone_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "psicossocial_telefone_usado_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
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
          empresa_id: string | null
          escopo: string | null
          escopo_tipo: string | null
          escopo_valores: string[] | null
          evento_gatilho_id: string | null
          evento_gatilho_tipo: string | null
          ghe_ids: string[]
          gro_exportado_em: string | null
          gro_riscos_count: number | null
          ibd_score: number | null
          ibo_score: number | null
          icop_score: number | null
          id: string
          inot_score: number | null
          instrumento: string | null
          ips_classificacao: string | null
          ips_score: number | null
          irec_score: number | null
          irps_score: number | null
          mensagem_institucional: string | null
          motivo_extraordinaria: string | null
          nome: string
          periodicidade: string | null
          permite_identificacao_voluntaria: boolean
          politica_uso_dados: string | null
          radar_data: Json | null
          situacoes_trabalho: Json | null
          status: Database["public"]["Enums"]["campanha_psicossocial_status"]
          tenant_id: string
          tipo: string
          tipo_instrumento: string
          token_publico: string | null
          total_respostas: number | null
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
          empresa_id?: string | null
          escopo?: string | null
          escopo_tipo?: string | null
          escopo_valores?: string[] | null
          evento_gatilho_id?: string | null
          evento_gatilho_tipo?: string | null
          ghe_ids?: string[]
          gro_exportado_em?: string | null
          gro_riscos_count?: number | null
          ibd_score?: number | null
          ibo_score?: number | null
          icop_score?: number | null
          id?: string
          inot_score?: number | null
          instrumento?: string | null
          ips_classificacao?: string | null
          ips_score?: number | null
          irec_score?: number | null
          irps_score?: number | null
          mensagem_institucional?: string | null
          motivo_extraordinaria?: string | null
          nome: string
          periodicidade?: string | null
          permite_identificacao_voluntaria?: boolean
          politica_uso_dados?: string | null
          radar_data?: Json | null
          situacoes_trabalho?: Json | null
          status?: Database["public"]["Enums"]["campanha_psicossocial_status"]
          tenant_id: string
          tipo?: string
          tipo_instrumento?: string
          token_publico?: string | null
          total_respostas?: number | null
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
          empresa_id?: string | null
          escopo?: string | null
          escopo_tipo?: string | null
          escopo_valores?: string[] | null
          evento_gatilho_id?: string | null
          evento_gatilho_tipo?: string | null
          ghe_ids?: string[]
          gro_exportado_em?: string | null
          gro_riscos_count?: number | null
          ibd_score?: number | null
          ibo_score?: number | null
          icop_score?: number | null
          id?: string
          inot_score?: number | null
          instrumento?: string | null
          ips_classificacao?: string | null
          ips_score?: number | null
          irec_score?: number | null
          irps_score?: number | null
          mensagem_institucional?: string | null
          motivo_extraordinaria?: string | null
          nome?: string
          periodicidade?: string | null
          permite_identificacao_voluntaria?: boolean
          politica_uso_dados?: string | null
          radar_data?: Json | null
          situacoes_trabalho?: Json | null
          status?: Database["public"]["Enums"]["campanha_psicossocial_status"]
          tenant_id?: string
          tipo?: string
          tipo_instrumento?: string
          token_publico?: string | null
          total_respostas?: number | null
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
            foreignKeyName: "questionario_psicossocial_campanhas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
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
          cargo_snapshot: string | null
          colaborador_id: string | null
          concluido_em: string | null
          convite_id: string | null
          cpf_hash: string | null
          created_at: string
          ghe_id_snapshot: string | null
          ghe_nome_snapshot: string | null
          id: string
          identificacao_voluntaria: boolean
          indicadores: Json | null
          ip_address: string | null
          participacao_id: string | null
          respostas: Json
          setor_snapshot: string | null
          tempo_resposta_segundos: number | null
          tenant_id: string
          unidade_snapshot: string | null
          user_agent: string | null
        }
        Insert: {
          campanha_id: string
          cargo_snapshot?: string | null
          colaborador_id?: string | null
          concluido_em?: string | null
          convite_id?: string | null
          cpf_hash?: string | null
          created_at?: string
          ghe_id_snapshot?: string | null
          ghe_nome_snapshot?: string | null
          id?: string
          identificacao_voluntaria?: boolean
          indicadores?: Json | null
          ip_address?: string | null
          participacao_id?: string | null
          respostas?: Json
          setor_snapshot?: string | null
          tempo_resposta_segundos?: number | null
          tenant_id: string
          unidade_snapshot?: string | null
          user_agent?: string | null
        }
        Update: {
          campanha_id?: string
          cargo_snapshot?: string | null
          colaborador_id?: string | null
          concluido_em?: string | null
          convite_id?: string | null
          cpf_hash?: string | null
          created_at?: string
          ghe_id_snapshot?: string | null
          ghe_nome_snapshot?: string | null
          id?: string
          identificacao_voluntaria?: boolean
          indicadores?: Json | null
          ip_address?: string | null
          participacao_id?: string | null
          respostas?: Json
          setor_snapshot?: string | null
          tempo_resposta_segundos?: number | null
          tenant_id?: string
          unidade_snapshot?: string | null
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
            foreignKeyName: "questionario_psicossocial_respostas_participacao_id_fkey"
            columns: ["participacao_id"]
            isOneToOne: false
            referencedRelation: "psicossocial_participacoes"
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
      restricoes_laborais: {
        Row: {
          adaptacoes_necessarias: string | null
          afastamento_id: string | null
          anexo_url: string | null
          atividades_vedadas: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string
          id: string
          origem: string | null
          permanente: boolean | null
          responsavel_tecnico: string | null
          status: string | null
          temporaria: boolean | null
          tenant_id: string
          trabalhador_id: string | null
          updated_at: string | null
        }
        Insert: {
          adaptacoes_necessarias?: string | null
          afastamento_id?: string | null
          anexo_url?: string | null
          atividades_vedadas?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao: string
          id?: string
          origem?: string | null
          permanente?: boolean | null
          responsavel_tecnico?: string | null
          status?: string | null
          temporaria?: boolean | null
          tenant_id: string
          trabalhador_id?: string | null
          updated_at?: string | null
        }
        Update: {
          adaptacoes_necessarias?: string | null
          afastamento_id?: string | null
          anexo_url?: string | null
          atividades_vedadas?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string
          id?: string
          origem?: string | null
          permanente?: boolean | null
          responsavel_tecnico?: string | null
          status?: string | null
          temporaria?: boolean | null
          tenant_id?: string
          trabalhador_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restricoes_laborais_afastamento_id_fkey"
            columns: ["afastamento_id"]
            isOneToOne: false
            referencedRelation: "afastamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      sst_documentos: {
        Row: {
          analise_ia: Json | null
          analise_ia_status: string | null
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          cnpj_relacionado: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_emissao: string | null
          data_vigencia: string | null
          empresa_emissora: string | null
          empresa_id: string | null
          id: string
          observacoes: string | null
          profissional_responsavel: string | null
          status: string
          tenant_id: string
          tipo: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          analise_ia?: Json | null
          analise_ia_status?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          cnpj_relacionado?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_emissao?: string | null
          data_vigencia?: string | null
          empresa_emissora?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          profissional_responsavel?: string | null
          status?: string
          tenant_id: string
          tipo: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          analise_ia?: Json | null
          analise_ia_status?: string | null
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          cnpj_relacionado?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_emissao?: string | null
          data_vigencia?: string | null
          empresa_emissora?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          profissional_responsavel?: string | null
          status?: string
          tenant_id?: string
          tipo?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sst_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sst_documentos_tenant_id_fkey"
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
      suporte_ticket_comentarios: {
        Row: {
          autor_id: string | null
          autor_nome: string | null
          conteudo: string
          created_at: string
          id: string
          tenant_id: string
          ticket_id: string
        }
        Insert: {
          autor_id?: string | null
          autor_nome?: string | null
          conteudo: string
          created_at?: string
          id?: string
          tenant_id: string
          ticket_id: string
        }
        Update: {
          autor_id?: string | null
          autor_nome?: string | null
          conteudo?: string
          created_at?: string
          id?: string
          tenant_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suporte_ticket_comentarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suporte_ticket_comentarios_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "suporte_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      suporte_tickets: {
        Row: {
          atribuido_a_id: string | null
          atribuido_a_nome: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          descricao: string
          id: string
          modulo: string | null
          prioridade: Database["public"]["Enums"]["ticket_prioridade"]
          resolucao: string | null
          resolvido_em: string | null
          screenshot_url: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["ticket_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          atribuido_a_id?: string | null
          atribuido_a_nome?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao: string
          id?: string
          modulo?: string | null
          prioridade?: Database["public"]["Enums"]["ticket_prioridade"]
          resolucao?: string | null
          resolvido_em?: string | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tenant_id: string
          tipo?: Database["public"]["Enums"]["ticket_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          atribuido_a_id?: string | null
          atribuido_a_nome?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string
          id?: string
          modulo?: string | null
          prioridade?: Database["public"]["Enums"]["ticket_prioridade"]
          resolucao?: string | null
          resolvido_em?: string | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["ticket_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suporte_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_manual: {
        Row: {
          content: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tabelas_fiscais: {
        Row: {
          ativo: boolean
          created_at: string
          deducao_por_dependente: number | null
          faixas: Json
          id: string
          observacoes: string | null
          tenant_id: string
          teto: number | null
          tipo: string
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          deducao_por_dependente?: number | null
          faixas?: Json
          id?: string
          observacoes?: string | null
          tenant_id: string
          teto?: number | null
          tipo: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          deducao_por_dependente?: number | null
          faixas?: Json
          id?: string
          observacoes?: string | null
          tenant_id?: string
          teto?: number | null
          tipo?: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabelas_fiscais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_spinoffs: {
        Row: {
          contadores: Json
          created_at: string
          empresa_id: string
          executado_por: string
          id: string
          mensagem_erro: string | null
          owner_email: string
          owner_user_id: string | null
          status: string
          tenant_destino_id: string
          tenant_origem_id: string
          updated_at: string
        }
        Insert: {
          contadores?: Json
          created_at?: string
          empresa_id: string
          executado_por: string
          id?: string
          mensagem_erro?: string | null
          owner_email: string
          owner_user_id?: string | null
          status?: string
          tenant_destino_id: string
          tenant_origem_id: string
          updated_at?: string
        }
        Update: {
          contadores?: Json
          created_at?: string
          empresa_id?: string
          executado_por?: string
          id?: string
          mensagem_erro?: string | null
          owner_email?: string
          owner_user_id?: string | null
          status?: string
          tenant_destino_id?: string
          tenant_origem_id?: string
          updated_at?: string
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
      terceiro_audit_log: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          entidade_id: string
          entidade_tipo: string
          id: string
          tenant_id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          entidade_id: string
          entidade_tipo: string
          id?: string
          tenant_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          entidade_id?: string
          entidade_tipo?: string
          id?: string
          tenant_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terceiro_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      terceiro_documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_emissao: string | null
          data_validade: string | null
          id: string
          nome: string
          observacoes: string | null
          status: Database["public"]["Enums"]["terceiro_doc_status"] | null
          tenant_id: string
          terceiro_id: string
          tipo: string
          trabalhador_id: string | null
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["terceiro_doc_status"] | null
          tenant_id: string
          terceiro_id: string
          tipo: string
          trabalhador_id?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["terceiro_doc_status"] | null
          tenant_id?: string
          terceiro_id?: string
          tipo?: string
          trabalhador_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terceiro_documentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiro_documentos_terceiro_id_fkey"
            columns: ["terceiro_id"]
            isOneToOne: false
            referencedRelation: "terceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiro_documentos_trabalhador_id_fkey"
            columns: ["trabalhador_id"]
            isOneToOne: false
            referencedRelation: "terceiro_trabalhadores"
            referencedColumns: ["id"]
          },
        ]
      }
      terceiro_trabalhadores: {
        Row: {
          atividades: string[] | null
          atividades_risco: string[] | null
          ativo: boolean | null
          cpf: string | null
          created_at: string
          funcao: string | null
          id: string
          nome: string
          setor: string | null
          status: Database["public"]["Enums"]["terceiro_status"] | null
          tenant_id: string
          terceiro_id: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          atividades?: string[] | null
          atividades_risco?: string[] | null
          ativo?: boolean | null
          cpf?: string | null
          created_at?: string
          funcao?: string | null
          id?: string
          nome: string
          setor?: string | null
          status?: Database["public"]["Enums"]["terceiro_status"] | null
          tenant_id: string
          terceiro_id: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          atividades?: string[] | null
          atividades_risco?: string[] | null
          ativo?: boolean | null
          cpf?: string | null
          created_at?: string
          funcao?: string | null
          id?: string
          nome?: string
          setor?: string | null
          status?: Database["public"]["Enums"]["terceiro_status"] | null
          tenant_id?: string
          terceiro_id?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terceiro_trabalhadores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiro_trabalhadores_terceiro_id_fkey"
            columns: ["terceiro_id"]
            isOneToOne: false
            referencedRelation: "terceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      terceiro_treinamentos: {
        Row: {
          carga_horaria: number | null
          certificado_nome: string | null
          certificado_url: string | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          data_realizacao: string | null
          data_validade: string | null
          descricao: string | null
          id: string
          status: Database["public"]["Enums"]["terceiro_doc_status"] | null
          tenant_id: string
          terceiro_id: string
          tipo: string
          trabalhador_id: string
          trilha_id: string | null
          updated_at: string
        }
        Insert: {
          carga_horaria?: number | null
          certificado_nome?: string | null
          certificado_url?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_realizacao?: string | null
          data_validade?: string | null
          descricao?: string | null
          id?: string
          status?: Database["public"]["Enums"]["terceiro_doc_status"] | null
          tenant_id: string
          terceiro_id: string
          tipo: string
          trabalhador_id: string
          trilha_id?: string | null
          updated_at?: string
        }
        Update: {
          carga_horaria?: number | null
          certificado_nome?: string | null
          certificado_url?: string | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          data_realizacao?: string | null
          data_validade?: string | null
          descricao?: string | null
          id?: string
          status?: Database["public"]["Enums"]["terceiro_doc_status"] | null
          tenant_id?: string
          terceiro_id?: string
          tipo?: string
          trabalhador_id?: string
          trilha_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terceiro_treinamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiro_treinamentos_terceiro_id_fkey"
            columns: ["terceiro_id"]
            isOneToOne: false
            referencedRelation: "terceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiro_treinamentos_trabalhador_id_fkey"
            columns: ["trabalhador_id"]
            isOneToOne: false
            referencedRelation: "terceiro_trabalhadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiro_treinamentos_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      terceiros: {
        Row: {
          atividade_principal: string | null
          atividade_risco: boolean | null
          cnae: string | null
          cnpj: string
          contrato_fim: string | null
          contrato_inicio: string | null
          created_at: string
          email: string | null
          empresa_id: string | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          responsavel_cargo: string | null
          responsavel_nome: string | null
          setores: string[] | null
          status: Database["public"]["Enums"]["terceiro_status"] | null
          telefone: string | null
          tenant_id: string
          tipo_acesso: Database["public"]["Enums"]["terceiro_acesso"] | null
          tipo_servico: string[] | null
          unidades: string[] | null
          updated_at: string
        }
        Insert: {
          atividade_principal?: string | null
          atividade_risco?: boolean | null
          cnae?: string | null
          cnpj: string
          contrato_fim?: string | null
          contrato_inicio?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          responsavel_cargo?: string | null
          responsavel_nome?: string | null
          setores?: string[] | null
          status?: Database["public"]["Enums"]["terceiro_status"] | null
          telefone?: string | null
          tenant_id: string
          tipo_acesso?: Database["public"]["Enums"]["terceiro_acesso"] | null
          tipo_servico?: string[] | null
          unidades?: string[] | null
          updated_at?: string
        }
        Update: {
          atividade_principal?: string | null
          atividade_risco?: boolean | null
          cnae?: string | null
          cnpj?: string
          contrato_fim?: string | null
          contrato_inicio?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          responsavel_cargo?: string | null
          responsavel_nome?: string | null
          setores?: string[] | null
          status?: Database["public"]["Enums"]["terceiro_status"] | null
          telefone?: string | null
          tenant_id?: string
          tipo_acesso?: Database["public"]["Enums"]["terceiro_acesso"] | null
          tipo_servico?: string[] | null
          unidades?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terceiros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_atribuicoes: {
        Row: {
          alvo_id: string | null
          alvo_nome: string | null
          created_at: string
          id: string
          tenant_id: string
          tipo_alvo: string
          trilha_id: string
        }
        Insert: {
          alvo_id?: string | null
          alvo_nome?: string | null
          created_at?: string
          id?: string
          tenant_id: string
          tipo_alvo?: string
          trilha_id: string
        }
        Update: {
          alvo_id?: string | null
          alvo_nome?: string | null
          created_at?: string
          id?: string
          tenant_id?: string
          tipo_alvo?: string
          trilha_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trilha_atribuicoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_atribuicoes_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_certificados: {
        Row: {
          codigo: string
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          data_conclusao: string
          id: string
          pontos_obtidos: number
          tenant_id: string
          trilha_id: string
        }
        Insert: {
          codigo?: string
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          data_conclusao?: string
          id?: string
          pontos_obtidos?: number
          tenant_id: string
          trilha_id: string
        }
        Update: {
          codigo?: string
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          data_conclusao?: string
          id?: string
          pontos_obtidos?: number
          tenant_id?: string
          trilha_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trilha_certificados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_certificados_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_medalhas: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          criterio: Json
          descricao: string | null
          icone: string
          id: string
          nome: string
          pontos_bonus: number
          tenant_id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          criterio?: Json
          descricao?: string | null
          icone?: string
          id?: string
          nome: string
          pontos_bonus?: number
          tenant_id: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          criterio?: Json
          descricao?: string | null
          icone?: string
          id?: string
          nome?: string
          pontos_bonus?: number
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "trilha_medalhas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_medalhas_colaboradores: {
        Row: {
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          data_conquista: string
          id: string
          medalha_id: string
          tenant_id: string
          trilha_id: string | null
        }
        Insert: {
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          data_conquista?: string
          id?: string
          medalha_id: string
          tenant_id: string
          trilha_id?: string | null
        }
        Update: {
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          data_conquista?: string
          id?: string
          medalha_id?: string
          tenant_id?: string
          trilha_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trilha_medalhas_colaboradores_medalha_id_fkey"
            columns: ["medalha_id"]
            isOneToOne: false
            referencedRelation: "trilha_medalhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_medalhas_colaboradores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_medalhas_colaboradores_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_modulos: {
        Row: {
          acao_pdi_id: string | null
          ativo: boolean | null
          competencia_relacionada: string | null
          conteudo_texto: string | null
          conteudo_url: string | null
          created_at: string
          descricao: string | null
          evidencia_obrigatoria: boolean | null
          id: string
          objetivo: string | null
          ordem: number
          ordem_tipo: Database["public"]["Enums"]["trilha_modulo_ordem_tipo"]
          pontuacao: number | null
          tempo_estimado_min: number | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["trilha_modulo_tipo"]
          titulo: string
          trilha_id: string
          updated_at: string
        }
        Insert: {
          acao_pdi_id?: string | null
          ativo?: boolean | null
          competencia_relacionada?: string | null
          conteudo_texto?: string | null
          conteudo_url?: string | null
          created_at?: string
          descricao?: string | null
          evidencia_obrigatoria?: boolean | null
          id?: string
          objetivo?: string | null
          ordem?: number
          ordem_tipo?: Database["public"]["Enums"]["trilha_modulo_ordem_tipo"]
          pontuacao?: number | null
          tempo_estimado_min?: number | null
          tenant_id: string
          tipo?: Database["public"]["Enums"]["trilha_modulo_tipo"]
          titulo: string
          trilha_id: string
          updated_at?: string
        }
        Update: {
          acao_pdi_id?: string | null
          ativo?: boolean | null
          competencia_relacionada?: string | null
          conteudo_texto?: string | null
          conteudo_url?: string | null
          created_at?: string
          descricao?: string | null
          evidencia_obrigatoria?: boolean | null
          id?: string
          objetivo?: string | null
          ordem?: number
          ordem_tipo?: Database["public"]["Enums"]["trilha_modulo_ordem_tipo"]
          pontuacao?: number | null
          tempo_estimado_min?: number | null
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["trilha_modulo_tipo"]
          titulo?: string
          trilha_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trilha_modulos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_modulos_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_notificacoes: {
        Row: {
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          descricao: string | null
          id: string
          lida: boolean
          tenant_id: string
          tipo: string
          titulo: string
          trilha_id: string
          trilha_nome: string
        }
        Insert: {
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          descricao?: string | null
          id?: string
          lida?: boolean
          tenant_id: string
          tipo: string
          titulo: string
          trilha_id: string
          trilha_nome: string
        }
        Update: {
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          descricao?: string | null
          id?: string
          lida?: boolean
          tenant_id?: string
          tipo?: string
          titulo?: string
          trilha_id?: string
          trilha_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "trilha_notificacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_progresso: {
        Row: {
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          data_conclusao: string | null
          data_inicio: string | null
          evidencia_texto: string | null
          evidencia_url: string | null
          id: string
          modulo_id: string
          nota: number | null
          pontos_obtidos: number | null
          status: Database["public"]["Enums"]["trilha_progresso_status"]
          tenant_id: string
          trilha_id: string
          updated_at: string
        }
        Insert: {
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          evidencia_texto?: string | null
          evidencia_url?: string | null
          id?: string
          modulo_id: string
          nota?: number | null
          pontos_obtidos?: number | null
          status?: Database["public"]["Enums"]["trilha_progresso_status"]
          tenant_id: string
          trilha_id: string
          updated_at?: string
        }
        Update: {
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          evidencia_texto?: string | null
          evidencia_url?: string | null
          id?: string
          modulo_id?: string
          nota?: number | null
          pontos_obtidos?: number | null
          status?: Database["public"]["Enums"]["trilha_progresso_status"]
          tenant_id?: string
          trilha_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trilha_progresso_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "trilha_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_progresso_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_progresso_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_quiz_perguntas: {
        Row: {
          created_at: string
          id: string
          modulo_id: string
          opcoes: string[]
          ordem: number
          pergunta: string
          resposta_correta: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modulo_id: string
          opcoes: string[]
          ordem?: number
          pergunta: string
          resposta_correta?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modulo_id?: string
          opcoes?: string[]
          ordem?: number
          pergunta?: string
          resposta_correta?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trilha_quiz_perguntas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "trilha_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_quiz_perguntas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_terceiro_progresso: {
        Row: {
          created_at: string
          data_conclusao: string | null
          data_inicio: string | null
          evidencia_texto: string | null
          evidencia_url: string | null
          id: string
          modulo_id: string
          nota: number | null
          pontos_obtidos: number | null
          status: string
          tenant_id: string
          terceiro_cpf: string
          terceiro_empresa: string | null
          terceiro_nome: string
          trilha_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          evidencia_texto?: string | null
          evidencia_url?: string | null
          id?: string
          modulo_id: string
          nota?: number | null
          pontos_obtidos?: number | null
          status?: string
          tenant_id: string
          terceiro_cpf: string
          terceiro_empresa?: string | null
          terceiro_nome: string
          trilha_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          evidencia_texto?: string | null
          evidencia_url?: string | null
          id?: string
          modulo_id?: string
          nota?: number | null
          pontos_obtidos?: number | null
          status?: string
          tenant_id?: string
          terceiro_cpf?: string
          terceiro_empresa?: string | null
          terceiro_nome?: string
          trilha_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trilha_terceiro_progresso_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "trilha_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_terceiro_progresso_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_terceiro_progresso_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trilhas: {
        Row: {
          conexao_indicadores: string[] | null
          conexao_pdi: boolean | null
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          imagem_url: string | null
          nome: string
          objetivo: string | null
          pontuacao_minima: number | null
          prazo_dias: number | null
          prioridade: Database["public"]["Enums"]["trilha_prioridade"]
          publico_terceiros: boolean
          status: Database["public"]["Enums"]["trilha_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["trilha_tipo"]
          token_publico: string | null
          total_modulos: number | null
          updated_at: string
          visibilidade: Database["public"]["Enums"]["trilha_visibilidade"]
        }
        Insert: {
          conexao_indicadores?: string[] | null
          conexao_pdi?: boolean | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          imagem_url?: string | null
          nome: string
          objetivo?: string | null
          pontuacao_minima?: number | null
          prazo_dias?: number | null
          prioridade?: Database["public"]["Enums"]["trilha_prioridade"]
          publico_terceiros?: boolean
          status?: Database["public"]["Enums"]["trilha_status"]
          tenant_id: string
          tipo?: Database["public"]["Enums"]["trilha_tipo"]
          token_publico?: string | null
          total_modulos?: number | null
          updated_at?: string
          visibilidade?: Database["public"]["Enums"]["trilha_visibilidade"]
        }
        Update: {
          conexao_indicadores?: string[] | null
          conexao_pdi?: boolean | null
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          imagem_url?: string | null
          nome?: string
          objetivo?: string | null
          pontuacao_minima?: number | null
          prazo_dias?: number | null
          prioridade?: Database["public"]["Enums"]["trilha_prioridade"]
          publico_terceiros?: boolean
          status?: Database["public"]["Enums"]["trilha_status"]
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["trilha_tipo"]
          token_publico?: string | null
          total_modulos?: number | null
          updated_at?: string
          visibilidade?: Database["public"]["Enums"]["trilha_visibilidade"]
        }
        Relationships: [
          {
            foreignKeyName: "trilhas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilhas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      usuario_audit_log: {
        Row: {
          acao: string
          created_at: string
          executor_id: string | null
          executor_nome: string | null
          id: string
          ip_address: string | null
          justificativa: string | null
          objeto: string
          origem: string | null
          tenant_id: string
          usuario_id: string | null
          valor_anterior: Json | null
          valor_novo: Json | null
          vinculo_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          executor_id?: string | null
          executor_nome?: string | null
          id?: string
          ip_address?: string | null
          justificativa?: string | null
          objeto: string
          origem?: string | null
          tenant_id: string
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
          vinculo_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          executor_id?: string | null
          executor_nome?: string | null
          id?: string
          ip_address?: string | null
          justificativa?: string | null
          objeto?: string
          origem?: string | null
          tenant_id?: string
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
          vinculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuario_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_perfil_vinculos: {
        Row: {
          ativo: boolean
          atribuido_por: string | null
          atribuido_por_nome: string | null
          created_at: string
          empresa_id: string | null
          expira_em: string | null
          id: string
          is_perfil_principal: boolean | null
          observacao: string | null
          perfil_id: string
          tenant_id: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atribuido_por?: string | null
          atribuido_por_nome?: string | null
          created_at?: string
          empresa_id?: string | null
          expira_em?: string | null
          id?: string
          is_perfil_principal?: boolean | null
          observacao?: string | null
          perfil_id: string
          tenant_id: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atribuido_por?: string | null
          atribuido_por_nome?: string | null
          created_at?: string
          empresa_id?: string | null
          expira_em?: string | null
          id?: string
          is_perfil_principal?: boolean | null
          observacao?: string | null
          perfil_id?: string
          tenant_id?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_perfil_vinculos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_perfil_vinculos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_perfil_vinculos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_vinculos: {
        Row: {
          aprovado_por_nome: string | null
          aprovado_por_user_id: string | null
          contexto_operacional: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          empresa_id: string
          id: string
          observacoes: string | null
          status: Database["public"]["Enums"]["vinculo_status"]
          tenant_id: string
          tipo_vinculo: Database["public"]["Enums"]["usuario_tipo"]
          unidade_filial: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          aprovado_por_nome?: string | null
          aprovado_por_user_id?: string | null
          contexto_operacional?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["vinculo_status"]
          tenant_id: string
          tipo_vinculo?: Database["public"]["Enums"]["usuario_tipo"]
          unidade_filial?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          aprovado_por_nome?: string | null
          aprovado_por_user_id?: string | null
          contexto_operacional?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["vinculo_status"]
          tenant_id?: string
          tipo_vinculo?: Database["public"]["Enums"]["usuario_tipo"]
          unidade_filial?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_vinculos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_vinculos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_vinculos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_base"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_base: {
        Row: {
          alerta_duplicidade: boolean | null
          autenticacao_2fa: boolean | null
          auth_user_id: string | null
          cargo_funcao: string | null
          convite_aceito_em: string | null
          convite_enviado_em: string | null
          convite_expira_em: string | null
          convite_token: string | null
          cpf: string | null
          created_at: string
          criado_por_nome: string | null
          criado_por_user_id: string | null
          data_nascimento: string | null
          duplicidade_nivel: string | null
          email_principal: string
          email_validado: boolean | null
          foto_url: string | null
          id: string
          idioma: string | null
          matricula: string | null
          nome_completo: string
          nome_social: string | null
          observacoes: string | null
          origem_cadastro: string | null
          primeiro_acesso_em: string | null
          qualidade_pct: number | null
          qualidade_score: Database["public"]["Enums"]["qualidade_score"] | null
          status: Database["public"]["Enums"]["usuario_status"]
          sugestao_tipo_ia: Database["public"]["Enums"]["usuario_tipo"] | null
          telefone_principal: string | null
          telefone_validado: boolean | null
          tenant_id: string
          tipo_usuario: Database["public"]["Enums"]["usuario_tipo"] | null
          ultimo_acesso_em: string | null
          updated_at: string
        }
        Insert: {
          alerta_duplicidade?: boolean | null
          autenticacao_2fa?: boolean | null
          auth_user_id?: string | null
          cargo_funcao?: string | null
          convite_aceito_em?: string | null
          convite_enviado_em?: string | null
          convite_expira_em?: string | null
          convite_token?: string | null
          cpf?: string | null
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          data_nascimento?: string | null
          duplicidade_nivel?: string | null
          email_principal: string
          email_validado?: boolean | null
          foto_url?: string | null
          id?: string
          idioma?: string | null
          matricula?: string | null
          nome_completo: string
          nome_social?: string | null
          observacoes?: string | null
          origem_cadastro?: string | null
          primeiro_acesso_em?: string | null
          qualidade_pct?: number | null
          qualidade_score?:
            | Database["public"]["Enums"]["qualidade_score"]
            | null
          status?: Database["public"]["Enums"]["usuario_status"]
          sugestao_tipo_ia?: Database["public"]["Enums"]["usuario_tipo"] | null
          telefone_principal?: string | null
          telefone_validado?: boolean | null
          tenant_id: string
          tipo_usuario?: Database["public"]["Enums"]["usuario_tipo"] | null
          ultimo_acesso_em?: string | null
          updated_at?: string
        }
        Update: {
          alerta_duplicidade?: boolean | null
          autenticacao_2fa?: boolean | null
          auth_user_id?: string | null
          cargo_funcao?: string | null
          convite_aceito_em?: string | null
          convite_enviado_em?: string | null
          convite_expira_em?: string | null
          convite_token?: string | null
          cpf?: string | null
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          data_nascimento?: string | null
          duplicidade_nivel?: string | null
          email_principal?: string
          email_validado?: boolean | null
          foto_url?: string | null
          id?: string
          idioma?: string | null
          matricula?: string | null
          nome_completo?: string
          nome_social?: string | null
          observacoes?: string | null
          origem_cadastro?: string | null
          primeiro_acesso_em?: string | null
          qualidade_pct?: number | null
          qualidade_score?:
            | Database["public"]["Enums"]["qualidade_score"]
            | null
          status?: Database["public"]["Enums"]["usuario_status"]
          sugestao_tipo_ia?: Database["public"]["Enums"]["usuario_tipo"] | null
          telefone_principal?: string | null
          telefone_validado?: boolean | null
          tenant_id?: string
          tipo_usuario?: Database["public"]["Enums"]["usuario_tipo"] | null
          ultimo_acesso_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_base_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ferias_relatorio_setor: {
        Row: {
          acoes_preventivas: number | null
          aprovadas: number | null
          concluidas: number | null
          custo_total: number | null
          em_gozo: number | null
          media_inr: number | null
          pendentes: number | null
          setor: string | null
          tenant_id: string | null
          total_dias_concedidos: number | null
          total_solicitacoes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_solicitacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      psicossocial_participacao_stats: {
        Row: {
          campanha_id: string | null
          taxa_participacao: number | null
          tenant_id: string | null
          total_elegiveis: number | null
          total_responderam: number | null
        }
        Relationships: [
          {
            foreignKeyName: "psicossocial_participacoes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "questionario_psicossocial_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psicossocial_participacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aceitar_consentimento_entrevista: {
        Args: { p_modalidade: string; p_token: string }
        Returns: string
      }
      assinar_contrato_por_token: {
        Args: {
          p_assinante_ip: string
          p_assinante_nome: string
          p_assinatura_imagem: string
          p_html_assinado: string
          p_token: string
        }
        Returns: undefined
      }
      assinar_manual_funcao_publica: {
        Args: {
          p_cpf: string
          p_geo: Json
          p_ip: string
          p_nome: string
          p_selfie_url: string
          p_token: string
        }
        Returns: Json
      }
      assinar_ordem_servico_publica: {
        Args: {
          p_geo: Json
          p_ip: string
          p_selfie_url: string
          p_token: string
        }
        Returns: Json
      }
      atualizar_cliente_por_onboarding_token: {
        Args: {
          p_cnpj?: string
          p_nome_empresa?: string
          p_quantidade_colaboradores?: number
          p_segmento?: string
          p_token: string
        }
        Returns: undefined
      }
      atualizar_convite_por_token: {
        Args: { p_status: string; p_token: string }
        Returns: undefined
      }
      atualizar_documento_link_por_token: {
        Args: {
          p_assinante_ip?: string
          p_assinante_nome?: string
          p_html_assinado?: string
          p_status: string
          p_token: string
        }
        Returns: undefined
      }
      atualizar_status_ferias_automatico: { Args: never; Returns: undefined }
      auto_abrir_competencia_mensal: { Args: never; Returns: undefined }
      bloquear_profissionais_expirados: { Args: never; Returns: undefined }
      buscar_campanha_por_token_publico: {
        Args: { p_token: string }
        Returns: {
          campanha_anonimo: boolean
          campanha_blocos_dinamicos: Json
          campanha_data_fim: string
          campanha_data_inicio: string
          campanha_descricao: string
          campanha_id: string
          campanha_instrumento: string
          campanha_mensagem_institucional: string
          campanha_nome: string
          campanha_politica_uso_dados: string
          campanha_status: string
          tenant_id: string
        }[]
      }
      buscar_cliente_por_activation_token: {
        Args: { p_token: string }
        Returns: {
          activation_token_expires_at: string
          cnpj: string
          conta_ativada: boolean
          id: string
          nome_empresa: string
          onboarding_token: string
          poc_email: string
          poc_nome: string
          tenant_id: string
        }[]
      }
      buscar_cliente_por_onboarding_token: {
        Args: { p_token: string }
        Returns: {
          activation_token_expires_at: string
          cnpj: string
          conta_ativada: boolean
          id: string
          nome_empresa: string
          onboarding_token: string
          poc_email: string
          poc_nome: string
          tenant_id: string
        }[]
      }
      buscar_contrato_por_token: {
        Args: { p_token: string }
        Returns: {
          assinado_em: string
          cliente_id: string
          html_assinado: string
          html_contrato: string
          id: string
          status: string
          token: string
        }[]
      }
      buscar_contratos_por_cliente: {
        Args: { p_cliente_id: string }
        Returns: {
          assinado_em: string
          html_assinado: string
          id: string
          status: string
          token: string
        }[]
      }
      buscar_convite_por_token: {
        Args: { p_token: string }
        Returns: {
          campanha_anonimo: boolean
          campanha_blocos_dinamicos: Json
          campanha_data_fim: string
          campanha_data_inicio: string
          campanha_descricao: string
          campanha_id: string
          campanha_instrumento: string
          campanha_mensagem_institucional: string
          campanha_nome: string
          campanha_permite_identificacao_voluntaria: boolean
          campanha_politica_uso_dados: string
          campanha_status: string
          campanha_tipo: string
          colaborador_cargo: string
          colaborador_cpf: string
          colaborador_departamento: string
          colaborador_id: string
          colaborador_nome: string
          concluido_em: string
          created_at: string
          enviado_em: string
          enviado_via: string
          id: string
          iniciado_em: string
          status: string
          tenant_id: string
          token: string
        }[]
      }
      buscar_doc_links_por_cliente: {
        Args: { p_cliente_id: string }
        Returns: {
          aceito_em: string
          html_assinado: string
          html_documento: string
          id: string
          status: string
          tipo: string
          token: string
        }[]
      }
      buscar_documento_link_por_token: {
        Args: { p_token: string }
        Returns: {
          aceito_em: string
          cliente_id: string
          cliente_nome_empresa: string
          cliente_onboarding_token: string
          cliente_poc_email: string
          cliente_poc_nome: string
          cliente_tenant_id: string
          html_assinado: string
          html_documento: string
          id: string
          status: string
          tipo: string
          token: string
        }[]
      }
      buscar_experiencia_assinatura_link: {
        Args: { p_token: string }
        Returns: Json
      }
      buscar_ponto_link_por_token: { Args: { p_token: string }; Returns: Json }
      buscar_profissionais_proximos: {
        Args: { p_lat: number; p_lon: number; p_raio_km?: number }
        Returns: {
          areas_atuacao: string[]
          bio: string
          cidade: string
          conselho: string
          distancia_km: number
          email: string
          especialidades: string[]
          estado: string
          foto_url: string
          id: string
          latitude: number
          longitude: number
          modalidades_atendimento: string[]
          nome_completo: string
          nota_media: number
          registro_profissional: string
          selo_verificado: boolean
          status: string
          telefone: string
          tem_atestado_capacidade: boolean
          total_avaliacoes: number
          total_servicos_executados: number
        }[]
      }
      calcular_he_adicional_noturno_dia: {
        Args: { p_colaborador_id: string; p_data: string }
        Returns: Json
      }
      check_ntep_relationship: {
        Args: { p_cid: string; p_cnae: string }
        Returns: string
      }
      classificar_marcacao_clt: {
        Args: { p_marcacao_id: string }
        Returns: string
      }
      clone_perfil_permissoes: {
        Args: {
          _source_perfil_id: string
          _target_perfil_id: string
          _target_tenant_id: string
        }
        Returns: undefined
      }
      colaborador_tem_vinculos: {
        Args: { _admissao_id: string }
        Returns: Json
      }
      consolidar_ponto_diario_manual: {
        Args: { p_colaborador_cpf: string; p_data: string; p_tenant_id: string }
        Returns: undefined
      }
      contar_colaboradores_por_empresa: {
        Args: { p_tenant_id: string }
        Returns: {
          empresa_id: string
          total: number
        }[]
      }
      converter_banco_horas_vencido: { Args: never; Returns: undefined }
      current_user_tenant_id: { Args: never; Returns: string }
      delete_empresa_segura: { Args: { _empresa_id: string }; Returns: Json }
      empresa_existe_por_documento: {
        Args: { p_doc: string; p_tipo: string }
        Returns: string
      }
      ensure_admissao_documentos_by_token: {
        Args: { _token: string }
        Returns: number
      }
      epi_atualizar_estoque_local_otimista: {
        Args: {
          p_estoque_local_id: string
          p_nova_quantidade: number
          p_quantidade_esperada: number
        }
        Returns: boolean
      }
      epi_atualizar_estoque_otimista: {
        Args: {
          p_epi_id: string
          p_nova_quantidade: number
          p_quantidade_esperada: number
        }
        Returns: boolean
      }
      excluir_colaborador_seguro: {
        Args: { _admissao_id: string }
        Returns: Json
      }
      excluir_marcacao_ponto: { Args: { p_marcacao_id: string }; Returns: Json }
      finalizar_admissao_by_token: {
        Args: { _token: string }
        Returns: undefined
      }
      gaf_tem_acesso_sensivel: {
        Args: { p_tenant_id: string; p_tipo_dado: string; p_user_id: string }
        Returns: boolean
      }
      gerar_estrutura_padrao_pastas: {
        Args: {
          p_empresa_id: string
          p_tenant_id: string
          p_user_id?: string
          p_user_nome?: string
        }
        Returns: number
      }
      get_admissao_by_token: {
        Args: { _token: string }
        Returns: {
          agencia: string | null
          aviso_previo_cumprido: boolean | null
          bairro: string | null
          banco: string | null
          bate_ponto: boolean
          cargo: string
          cbo: string | null
          celular: string | null
          centro_custo: string | null
          cep: string | null
          chave_conectividade: string | null
          chave_pix: string | null
          cidade: string | null
          classificacao_interna: string | null
          complemento: string | null
          conta: string | null
          cpf: string
          created_at: string
          criado_por: string | null
          crm_exame_demissional: string | null
          data_admissao: string | null
          data_aviso_previo: string | null
          data_desligamento: string | null
          data_exame_demissional: string | null
          data_homologacao: string | null
          data_nascimento: string | null
          departamento: string | null
          dependentes_irrf: number | null
          desligado_por: string | null
          desligado_por_nome: string | null
          dias_aviso_previo: number | null
          email: string | null
          empresa_id: string | null
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
          foto_url: string | null
          genero: string | null
          gestor_imediato: string | null
          id: string
          inativado_em: string | null
          inativado_por: string | null
          inativo: boolean
          jornada_trabalho: string | null
          matricula_esocial: string | null
          medico_exame_demissional: string | null
          motivo_desligamento: string | null
          motivo_inativacao: string | null
          multa_fgts: boolean | null
          nacionalidade: string | null
          naturalidade: string | null
          nome_completo: string
          nome_mae: string | null
          nome_pai: string | null
          numero: string | null
          observacoes_desligamento: string | null
          onboarding_status: string | null
          onboarding_token: string | null
          resultado_exame_demissional: string | null
          rg: string | null
          salario: number | null
          seguro_desemprego_elegivel: boolean | null
          sindicato_homologacao: string | null
          status: Database["public"]["Enums"]["admissao_status"]
          telefone: string | null
          tenant_id: string
          tipo_aviso_previo: string | null
          tipo_conta: string | null
          tipo_contrato: string | null
          tipo_vinculo: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "admissoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_admissao_documentos_by_token: {
        Args: { _token: string }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "admissao_documentos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_auth_user_email: { Args: never; Returns: string }
      get_current_user_tipo: { Args: never; Returns: string }
      get_entrevista_by_token: {
        Args: { p_token: string }
        Returns: {
          campanha_id: string
          campanha_nome: string
          concluida_em: string
          consentimento_lgpd_em: string
          empresa_nome: string
          fase_atual: number
          id: string
          iniciada_em: string
          modalidade: string
          riscos_cobertos: number
          status: string
          total_riscos: number
        }[]
      }
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
      has_tenant_access: { Args: { _tenant_id: string }; Returns: boolean }
      haversine_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      inativar_colaborador: {
        Args: { _admissao_id: string; _motivo?: string; _reverter?: boolean }
        Returns: undefined
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      list_entrevista_mensagens_by_token: {
        Args: { p_token: string }
        Returns: {
          content: string
          created_at: string
          fase: number
          id: string
          origem: string
          role: string
        }[]
      }
      listar_ponto_externo: {
        Args: { p_dias?: number; p_token: string }
        Returns: Json
      }
      obter_assinatura_manual_publica: {
        Args: { p_token: string }
        Returns: Json
      }
      obter_contrato_publico: { Args: { _token: string }; Returns: Json }
      obter_ordem_servico_publica: { Args: { p_token: string }; Returns: Json }
      processar_ajuste_ponto: {
        Args: {
          p_ajuste_id: string
          p_aprovado: boolean
          p_observacao?: string
        }
        Returns: Json
      }
      proximo_tipo_marcacao_externo: {
        Args: { p_token: string }
        Returns: Json
      }
      recalcular_status_terceiro: {
        Args: { p_terceiro_id: string }
        Returns: undefined
      }
      recalcular_status_trabalhador: {
        Args: { p_trabalhador_id: string }
        Returns: undefined
      }
      reconciliar_pastas_todas_empresas: {
        Args: never
        Returns: {
          out_empresa_id: string
          out_pastas_criadas: number
          out_razao_social: string
        }[]
      }
      registrar_assinatura_contrato:
        | {
            Args: {
              _assinatura_imagem?: string
              _cnpj?: string
              _cpf?: string
              _email?: string
              _endereco?: string
              _geo_lat?: number
              _geo_lng?: number
              _hash?: string
              _ip?: string
              _nome: string
              _razao_social?: string
              _representante?: string
              _rg?: string
              _selfie_imagem?: string
              _telefone?: string
              _token: string
              _user_agent?: string
            }
            Returns: Json
          }
        | {
            Args: {
              _assinatura_imagem: string
              _cpf: string
              _email: string
              _endereco: string
              _geo_lat: number
              _geo_lng: number
              _hash: string
              _ip: string
              _nome: string
              _rg: string
              _selfie_imagem: string
              _telefone: string
              _token: string
              _user_agent: string
            }
            Returns: Json
          }
      registrar_ponto_externo: {
        Args: {
          p_endereco?: string
          p_latitude?: number
          p_longitude?: number
          p_selfie_nome?: string
          p_selfie_url?: string
          p_tipo_marcacao?: string
          p_token: string
        }
        Returns: Json
      }
      salvar_resposta_anonima_campanha:
        | {
            Args: {
              p_indicadores: Json
              p_respostas: Json
              p_tempo_segundos?: number
              p_token_publico: string
              p_user_agent?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_cpf_hash?: string
              p_indicadores: Json
              p_respostas: Json
              p_tempo_segundos?: number
              p_token_publico: string
              p_user_agent?: string
            }
            Returns: Json
          }
      salvar_resposta_por_token_participacao:
        | {
            Args: {
              p_indicadores: Json
              p_respostas: Json
              p_tempo_segundos?: number
              p_token: string
              p_user_agent?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_cpf_hash?: string
              p_indicadores: Json
              p_respostas: Json
              p_tempo_segundos?: number
              p_token: string
              p_user_agent?: string
            }
            Returns: Json
          }
      salvar_resposta_psicossocial: {
        Args: {
          p_identificacao_voluntaria: boolean
          p_indicadores: Json
          p_respostas: Json
          p_tempo_segundos: number
          p_token: string
          p_user_agent: string
        }
        Returns: undefined
      }
      seed_psicossocial_riscos_padrao: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      solicitar_ajuste_ponto_externo: {
        Args: {
          p_anexos?: Json
          p_data_referencia: string
          p_hora_solicitada: string
          p_motivo: string
          p_tipo_marcacao: string
          p_token: string
        }
        Returns: Json
      }
      solicitar_ajustes_ponto_externo_batch: {
        Args: {
          p_anexos?: Json
          p_itens: Json
          p_motivo?: string
          p_token: string
        }
        Returns: Json
      }
      superadmin_delete_tenant: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      superadmin_global_stats: { Args: never; Returns: Json }
      superadmin_growth_series: { Args: { _dias?: number }; Returns: Json }
      superadmin_list_all_empresas: {
        Args: never
        Returns: {
          ativo: boolean
          cnpj: string
          empresa_created_at: string
          empresa_id: string
          is_principal: boolean
          nome_fantasia: string
          razao_social: string
          tenant_id: string
          tenant_nome: string
          tenant_owner_email: string
          tenant_slug: string
          total_empresas_tenant: number
        }[]
      }
      superadmin_list_tenant_users: {
        Args: { _tenant_id: string }
        Returns: Json
      }
      superadmin_psicossocial_overview: { Args: never; Returns: Json }
      superadmin_set_principal_empresa: {
        Args: { _empresa_id: string; _tenant_id: string }
        Returns: undefined
      }
      superadmin_spinoff_dry_run: {
        Args: { p_empresa_id: string }
        Returns: Json
      }
      superadmin_spinoff_dry_run_multi: {
        Args: { p_empresa_ids: string[] }
        Returns: Json
      }
      superadmin_spinoff_execute: {
        Args: {
          p_empresa_id: string
          p_novo_tenant_id: string
          p_owner_email: string
          p_owner_user_id: string
        }
        Returns: Json
      }
      superadmin_spinoff_execute_multi: {
        Args: {
          p_empresa_ids: string[]
          p_novo_tenant_id: string
          p_owner_email: string
          p_owner_user_id: string
        }
        Returns: Json
      }
      superadmin_tenants_list: { Args: never; Returns: Json }
      superadmin_tenants_status: { Args: never; Returns: Json }
      superadmin_usuarios_global: {
        Args: { _limite?: number; _search?: string }
        Returns: Json
      }
      update_admissao_documento_by_token: {
        Args: {
          _arquivo_nome: string
          _arquivo_tamanho: number
          _arquivo_url: string
          _data_envio: string
          _documento_id: string
          _status: string
          _token: string
        }
        Returns: undefined
      }
      update_admissao_foto_by_token: {
        Args: { _foto_url: string; _token: string }
        Returns: undefined
      }
      user_can_access_storage_object: {
        Args: { _bucket: string; _name: string }
        Returns: boolean
      }
      user_has_empresa_vinculo: {
        Args: { _empresa_id: string }
        Returns: boolean
      }
      validar_cpf_colaborador_campanha: {
        Args: { p_campanha_id: string; p_cpf: string; p_hash: string }
        Returns: Json
      }
      validar_token_participacao: { Args: { p_token: string }; Returns: Json }
      verificar_hash_ja_respondeu: {
        Args: { p_campanha_id: string; p_hash: string }
        Returns: boolean
      }
    }
    Enums: {
      acao_gut_prioridade: "baixo" | "medio" | "urgente" | "imediato"
      acao_prioridade: "baixa" | "media" | "alta" | "urgente"
      acao_status:
        | "pendente"
        | "em_andamento"
        | "concluida"
        | "cancelada"
        | "atrasada"
      acidente_afastamento: "sem_afastamento" | "ate_15_dias" | "mais_15_dias"
      acidente_atendimento: "nao_necessario" | "ambulatorial" | "hospitalar"
      acidente_gravidade_lesao: "sem_lesao" | "leve" | "moderada" | "grave"
      admissao_status:
        | "rascunho"
        | "aguardando_documentos"
        | "em_analise"
        | "aprovado"
        | "reprovado"
        | "concluido"
        | "desligado"
      advertencia_status: "pendente" | "enviada" | "formalizada" | "arquivada"
      afastamento_status: "ativo" | "encerrado" | "beneficio_inss"
      afastamento_status_geral:
        | "rascunho"
        | "registrado"
        | "em_analise"
        | "aguardando_documento"
        | "aguardando_inss"
        | "em_beneficio"
        | "prazo_indeterminado"
        | "retorno_pendente"
        | "retorno_concluido"
        | "encerrado"
        | "pendencia_critica"
        | "contestado"
        | "cancelado"
      afastamento_tipo_principal:
        | "doenca_comum"
        | "doenca_ocupacional"
        | "acidente_tipico"
        | "acidente_trajeto"
        | "atestado_odontologico"
        | "licenca_maternidade"
        | "licenca_paternidade"
        | "aborto_nao_criminoso"
        | "beneficio_b31"
        | "beneficio_b91"
        | "reabilitacao_b92"
        | "auxilio_acidente_b94"
        | "licenca_nao_remunerada"
        | "suspensao_disciplinar"
        | "falta_justificada_legal"
        | "mandato_sindical"
        | "determinacao_judicial_legal"
        | "outro_cct_act_politica_interna"
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
      cat_tipo: "inicial" | "reabertura" | "comunicacao_obito"
      classificacao_atividade: "rotineira" | "critica" | "excepcional"
      classificacao_interna:
        | "TRAINEE"
        | "PCD"
        | "TELETRABALHO"
        | "EFETIVO"
        | "OUTROS"
      complexidade_atividade: "baixa" | "media" | "alta"
      contrato_assinatura_status:
        | "pendente"
        | "assinado"
        | "expirado"
        | "revogado"
      contrato_categoria:
        | "live"
        | "aula"
        | "uso_sistema"
        | "parceria"
        | "nda"
        | "evento"
        | "outro"
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
      evento_sst_status:
        | "em_aberto"
        | "em_analise"
        | "acoes_andamento"
        | "concluido"
      evento_sst_tipo: "incidente" | "acidente"
      feedback_categoria: "reconhecimento" | "alinhamento" | "desenvolvimento"
      forma_calculo:
        | "VALOR_FIXO"
        | "PERCENTUAL_SALARIO"
        | "PERCENTUAL_BASE_ESPECIFICA"
        | "QUANTIDADE_X_VALOR"
        | "IMPORTADA_EXTERNA"
      frequencia_atividade: "diaria" | "semanal" | "mensal" | "eventual"
      gaf_perfil:
        | "admin"
        | "rh"
        | "dp"
        | "sst"
        | "medicina"
        | "juridico"
        | "gestor"
        | "executivo"
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
      hub_assinatura_status:
        | "pendente"
        | "enviado"
        | "assinado"
        | "recusado"
        | "expirado"
      hub_doc_origem:
        | "sistema_automatico"
        | "upload_rh"
        | "devolutiva_contabilidade"
        | "assinatura_concluida"
      hub_doc_tipo:
        | "ficha_registro"
        | "contrato"
        | "aditivo"
        | "aviso_ferias"
        | "recibo_ferias"
        | "advertencia"
        | "aviso_previo"
        | "trct"
        | "rescisao"
        | "espelho_ponto"
        | "relatorio_folha"
        | "holerite"
        | "guia"
        | "comprovante"
        | "aso"
        | "documento_pessoal"
        | "certidao"
        | "procuracao"
        | "declaracao"
        | "laudo"
        | "outros"
      hub_prioridade: "baixa" | "normal" | "alta" | "urgente"
      hub_processo_status:
        | "rascunho"
        | "aguardando_documentos"
        | "pronto_para_envio"
        | "enviado_contabilidade"
        | "recebido_contabilidade"
        | "em_analise"
        | "pendente_complementacao"
        | "processado"
        | "documentos_devolvidos"
        | "aguardando_assinatura"
        | "assinado_parcialmente"
        | "concluido"
        | "cancelado"
        | "erro_integracao"
      hub_processo_tipo:
        | "admissao"
        | "demissao"
        | "ferias"
        | "advertencia"
        | "atestado_afastamento"
        | "ponto_folha"
        | "eventos_variaveis"
        | "solicitacao_geral"
        | "alteracao_contratual"
        | "mudanca_salarial"
        | "cat"
        | "ppp_ltcat"
        | "pro_labore"
      indicador_direcao:
        | "maior_melhor"
        | "menor_melhor"
        | "igual_melhor"
        | "faixa"
      indicador_tipo:
        | "quantitativo"
        | "qualitativo"
        | "percentual"
        | "financeiro"
        | "marco"
        | "hibrido"
      lead_origem:
        | "landing_page"
        | "indicacao"
        | "prospect_manual"
        | "linkedin"
        | "whatsapp"
        | "evento"
        | "outro"
      lead_status:
        | "novo"
        | "contatado"
        | "qualificado"
        | "proposta"
        | "negociacao"
        | "convertido"
        | "perdido"
      marketplace_contratacao_status:
        | "solicitada"
        | "aceita"
        | "em_andamento"
        | "concluida"
        | "cancelada"
        | "recusada"
      marketplace_plano_tipo: "base" | "profissional" | "parceiro"
      marketplace_profissional_status:
        | "pendente"
        | "ativo"
        | "suspenso"
        | "bloqueado"
      marketplace_servico_modalidade: "presencial" | "online" | "hibrido"
      meta_nivel: "estrategica" | "unidade" | "setor" | "individual"
      meta_periodo: "mensal" | "trimestral" | "semestral" | "anual"
      meta_status:
        | "nao_iniciada"
        | "em_andamento"
        | "concluida"
        | "cancelada"
        | "atrasada"
      meta_workflow_status:
        | "rascunho"
        | "em_aprovacao"
        | "ativa"
        | "em_revisao"
        | "suspensa"
        | "encerrada"
        | "cancelada"
      nexo_trabalho: "nao" | "em_analise" | "sim"
      obrigatoriedade_epi: "obrigatorio" | "recomendado" | "condicional"
      oceano_quadrante: "eliminar" | "reduzir" | "elevar" | "criar"
      ocorrencia_tipo: "positiva" | "neutra" | "negativa"
      okr_tipo: "percentual" | "quantidade" | "binario" | "monetario"
      onboarding_etapa_tipo:
        | "apresentacao_institucional"
        | "cultura_valores"
        | "mural_boas_vindas"
        | "checklist_integracao"
        | "conteudo_livre"
        | "quiz"
        | "reflexao"
      pdi_acao_status:
        | "nao_iniciada"
        | "em_andamento"
        | "concluida"
        | "bloqueada"
      pdi_acao_tipo:
        | "tarefa"
        | "habito"
        | "rotina"
        | "projeto"
        | "mentoria"
        | "treinamento"
      pdi_checkin_frequencia: "semanal" | "quinzenal" | "mensal"
      pdi_meta_categoria:
        | "tecnica"
        | "comportamental"
        | "processos"
        | "lideranca"
        | "cultura"
        | "saude_bem_estar"
      pdi_meta_status:
        | "nao_iniciada"
        | "em_andamento"
        | "concluida"
        | "atrasada"
        | "cancelada"
      pdi_periodo: "trimestral" | "semestral" | "anual" | "personalizado"
      pdi_status: "rascunho" | "ativo" | "pausado" | "concluido" | "cancelado"
      perfil_acao:
        | "visualizar"
        | "criar"
        | "editar"
        | "excluir"
        | "inativar"
        | "exportar"
        | "importar"
        | "aprovar"
        | "assinar"
        | "compartilhar"
        | "parametrizar"
        | "administrar"
        | "acessar_sensivel"
        | "acessar_anonimizado"
        | "ver_indicadores"
        | "ver_individual"
      perfil_escopo_tipo:
        | "proprio_usuario"
        | "subordinados_diretos"
        | "equipe_direta_indireta"
        | "setor"
        | "unidade"
        | "empresa_inteira"
        | "grupo_economico"
        | "multiplas_empresas"
        | "carteira_clientes"
        | "customizado"
      pt_status:
        | "rascunho"
        | "liberada"
        | "bloqueada"
        | "encerrada"
        | "cancelada"
      qualidade_score:
        | "completo"
        | "suficiente"
        | "incompleto"
        | "inconsistente"
      rescisao_status:
        | "em_calculo"
        | "em_conferencia"
        | "aprovada"
        | "paga"
        | "reaberta"
      rescisao_tipo:
        | "PEDIDO_DEMISSAO"
        | "DISPENSA_SEM_JUSTA_CAUSA"
        | "DISPENSA_COM_JUSTA_CAUSA"
        | "TERMINO_EXPERIENCIA"
        | "RESCISAO_INDIRETA"
        | "ACORDO_484A"
        | "FALECIMENTO"
        | "TERMINO_TEMPORARIO"
        | "TERMINO_APRENDIZ"
        | "ENCERRAMENTO_ESTAGIO"
      resposta_status: "pendente" | "em_andamento" | "concluida"
      risco_severidade: "baixo" | "medio" | "alto" | "critico"
      rubrica_natureza: "REMUNERATORIA" | "INDENIZATORIA" | "OUTRA"
      rubrica_tipo: "PROVENTO" | "DESCONTO" | "INFORMATIVA"
      swot_classificacao:
        | "estrategico"
        | "operacional"
        | "cultural"
        | "pessoas"
        | "mercado"
      swot_impacto: "baixo" | "medio" | "alto"
      swot_tipo: "forca" | "fraqueza" | "oportunidade" | "ameaca"
      tarefa_status: "nao_iniciada" | "em_andamento" | "bloqueada" | "concluida"
      tenant_plan:
        | "free"
        | "starter"
        | "professional"
        | "enterprise"
        | "early_adopter"
        | "tester"
      terceiro_acesso: "eventual" | "recorrente" | "continuo"
      terceiro_doc_status: "valido" | "a_vencer" | "vencido" | "pendente"
      terceiro_status: "liberado" | "restrito" | "bloqueado"
      ticket_prioridade: "baixa" | "media" | "alta" | "critica"
      ticket_status:
        | "aberto"
        | "em_analise"
        | "em_andamento"
        | "resolvido"
        | "fechado"
        | "cancelado"
      ticket_tipo: "bug" | "falha" | "reclamacao" | "sugestao" | "duvida"
      tipo_avaliador:
        | "auto"
        | "gestor"
        | "par"
        | "subordinado"
        | "cliente_interno"
      tipo_competencia: "tecnica" | "comportamental" | "cognitiva"
      tipo_conteudo_funcao:
        | "manual"
        | "pop"
        | "instrucao"
        | "video"
        | "apresentacao"
        | "documento"
        | "link"
      tipo_ferramenta: "sistema" | "software" | "planilha" | "equipamento"
      tipo_vinculo:
        | "CLT_PRAZO_INDETERMINADO"
        | "CLT_EXPERIENCIA"
        | "CLT_INTERMITENTE"
        | "CLT_TEMPO_PARCIAL"
        | "APRENDIZ"
        | "ESTAGIO"
        | "TEMPORARIO_LEI6019"
        | "PJ"
      trilha_modulo_ordem_tipo: "sequencial" | "livre"
      trilha_modulo_tipo:
        | "video"
        | "pdf"
        | "link"
        | "apresentacao"
        | "conteudo_interno"
        | "quiz"
        | "atividade_pratica"
        | "checklist"
        | "reflexao"
        | "estudo_caso"
        | "microdesafio"
      trilha_prioridade: "obrigatoria" | "recomendada" | "opcional"
      trilha_progresso_status: "nao_iniciado" | "em_andamento" | "concluido"
      trilha_status: "rascunho" | "ativa" | "arquivada"
      trilha_tipo:
        | "tecnica"
        | "comportamental"
        | "lideranca"
        | "cultura"
        | "ergonomia_saude"
        | "processos"
        | "onboarding"
      trilha_visibilidade: "publica" | "restrita"
      usuario_status:
        | "rascunho"
        | "pendente_convite"
        | "convite_enviado"
        | "aguardando_ativacao"
        | "ativo"
        | "bloqueado"
        | "suspenso"
        | "inativo"
        | "arquivado"
      usuario_tipo:
        | "administrador"
        | "rh_dp"
        | "gestor"
        | "lideranca"
        | "tecnico_seguranca"
        | "saude_ocupacional"
        | "clinica_parceira"
        | "consultor_externo"
        | "prestador_terceiro"
        | "auditor"
        | "implantador"
        | "suporte_autorizado"
        | "corporativo_multiempresa"
        | "colaborador"
      vinculo_status:
        | "ativo"
        | "pendente"
        | "suspenso"
        | "revogado"
        | "encerrado"
        | "expirado"
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
      acao_status: [
        "pendente",
        "em_andamento",
        "concluida",
        "cancelada",
        "atrasada",
      ],
      acidente_afastamento: ["sem_afastamento", "ate_15_dias", "mais_15_dias"],
      acidente_atendimento: ["nao_necessario", "ambulatorial", "hospitalar"],
      acidente_gravidade_lesao: ["sem_lesao", "leve", "moderada", "grave"],
      admissao_status: [
        "rascunho",
        "aguardando_documentos",
        "em_analise",
        "aprovado",
        "reprovado",
        "concluido",
        "desligado",
      ],
      advertencia_status: ["pendente", "enviada", "formalizada", "arquivada"],
      afastamento_status: ["ativo", "encerrado", "beneficio_inss"],
      afastamento_status_geral: [
        "rascunho",
        "registrado",
        "em_analise",
        "aguardando_documento",
        "aguardando_inss",
        "em_beneficio",
        "prazo_indeterminado",
        "retorno_pendente",
        "retorno_concluido",
        "encerrado",
        "pendencia_critica",
        "contestado",
        "cancelado",
      ],
      afastamento_tipo_principal: [
        "doenca_comum",
        "doenca_ocupacional",
        "acidente_tipico",
        "acidente_trajeto",
        "atestado_odontologico",
        "licenca_maternidade",
        "licenca_paternidade",
        "aborto_nao_criminoso",
        "beneficio_b31",
        "beneficio_b91",
        "reabilitacao_b92",
        "auxilio_acidente_b94",
        "licenca_nao_remunerada",
        "suspensao_disciplinar",
        "falta_justificada_legal",
        "mandato_sindical",
        "determinacao_judicial_legal",
        "outro_cct_act_politica_interna",
      ],
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
      cat_tipo: ["inicial", "reabertura", "comunicacao_obito"],
      classificacao_atividade: ["rotineira", "critica", "excepcional"],
      classificacao_interna: [
        "TRAINEE",
        "PCD",
        "TELETRABALHO",
        "EFETIVO",
        "OUTROS",
      ],
      complexidade_atividade: ["baixa", "media", "alta"],
      contrato_assinatura_status: [
        "pendente",
        "assinado",
        "expirado",
        "revogado",
      ],
      contrato_categoria: [
        "live",
        "aula",
        "uso_sistema",
        "parceria",
        "nda",
        "evento",
        "outro",
      ],
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
      evento_sst_status: [
        "em_aberto",
        "em_analise",
        "acoes_andamento",
        "concluido",
      ],
      evento_sst_tipo: ["incidente", "acidente"],
      feedback_categoria: ["reconhecimento", "alinhamento", "desenvolvimento"],
      forma_calculo: [
        "VALOR_FIXO",
        "PERCENTUAL_SALARIO",
        "PERCENTUAL_BASE_ESPECIFICA",
        "QUANTIDADE_X_VALOR",
        "IMPORTADA_EXTERNA",
      ],
      frequencia_atividade: ["diaria", "semanal", "mensal", "eventual"],
      gaf_perfil: [
        "admin",
        "rh",
        "dp",
        "sst",
        "medicina",
        "juridico",
        "gestor",
        "executivo",
      ],
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
      hub_assinatura_status: [
        "pendente",
        "enviado",
        "assinado",
        "recusado",
        "expirado",
      ],
      hub_doc_origem: [
        "sistema_automatico",
        "upload_rh",
        "devolutiva_contabilidade",
        "assinatura_concluida",
      ],
      hub_doc_tipo: [
        "ficha_registro",
        "contrato",
        "aditivo",
        "aviso_ferias",
        "recibo_ferias",
        "advertencia",
        "aviso_previo",
        "trct",
        "rescisao",
        "espelho_ponto",
        "relatorio_folha",
        "holerite",
        "guia",
        "comprovante",
        "aso",
        "documento_pessoal",
        "certidao",
        "procuracao",
        "declaracao",
        "laudo",
        "outros",
      ],
      hub_prioridade: ["baixa", "normal", "alta", "urgente"],
      hub_processo_status: [
        "rascunho",
        "aguardando_documentos",
        "pronto_para_envio",
        "enviado_contabilidade",
        "recebido_contabilidade",
        "em_analise",
        "pendente_complementacao",
        "processado",
        "documentos_devolvidos",
        "aguardando_assinatura",
        "assinado_parcialmente",
        "concluido",
        "cancelado",
        "erro_integracao",
      ],
      hub_processo_tipo: [
        "admissao",
        "demissao",
        "ferias",
        "advertencia",
        "atestado_afastamento",
        "ponto_folha",
        "eventos_variaveis",
        "solicitacao_geral",
        "alteracao_contratual",
        "mudanca_salarial",
        "cat",
        "ppp_ltcat",
        "pro_labore",
      ],
      indicador_direcao: [
        "maior_melhor",
        "menor_melhor",
        "igual_melhor",
        "faixa",
      ],
      indicador_tipo: [
        "quantitativo",
        "qualitativo",
        "percentual",
        "financeiro",
        "marco",
        "hibrido",
      ],
      lead_origem: [
        "landing_page",
        "indicacao",
        "prospect_manual",
        "linkedin",
        "whatsapp",
        "evento",
        "outro",
      ],
      lead_status: [
        "novo",
        "contatado",
        "qualificado",
        "proposta",
        "negociacao",
        "convertido",
        "perdido",
      ],
      marketplace_contratacao_status: [
        "solicitada",
        "aceita",
        "em_andamento",
        "concluida",
        "cancelada",
        "recusada",
      ],
      marketplace_plano_tipo: ["base", "profissional", "parceiro"],
      marketplace_profissional_status: [
        "pendente",
        "ativo",
        "suspenso",
        "bloqueado",
      ],
      marketplace_servico_modalidade: ["presencial", "online", "hibrido"],
      meta_nivel: ["estrategica", "unidade", "setor", "individual"],
      meta_periodo: ["mensal", "trimestral", "semestral", "anual"],
      meta_status: [
        "nao_iniciada",
        "em_andamento",
        "concluida",
        "cancelada",
        "atrasada",
      ],
      meta_workflow_status: [
        "rascunho",
        "em_aprovacao",
        "ativa",
        "em_revisao",
        "suspensa",
        "encerrada",
        "cancelada",
      ],
      nexo_trabalho: ["nao", "em_analise", "sim"],
      obrigatoriedade_epi: ["obrigatorio", "recomendado", "condicional"],
      oceano_quadrante: ["eliminar", "reduzir", "elevar", "criar"],
      ocorrencia_tipo: ["positiva", "neutra", "negativa"],
      okr_tipo: ["percentual", "quantidade", "binario", "monetario"],
      onboarding_etapa_tipo: [
        "apresentacao_institucional",
        "cultura_valores",
        "mural_boas_vindas",
        "checklist_integracao",
        "conteudo_livre",
        "quiz",
        "reflexao",
      ],
      pdi_acao_status: [
        "nao_iniciada",
        "em_andamento",
        "concluida",
        "bloqueada",
      ],
      pdi_acao_tipo: [
        "tarefa",
        "habito",
        "rotina",
        "projeto",
        "mentoria",
        "treinamento",
      ],
      pdi_checkin_frequencia: ["semanal", "quinzenal", "mensal"],
      pdi_meta_categoria: [
        "tecnica",
        "comportamental",
        "processos",
        "lideranca",
        "cultura",
        "saude_bem_estar",
      ],
      pdi_meta_status: [
        "nao_iniciada",
        "em_andamento",
        "concluida",
        "atrasada",
        "cancelada",
      ],
      pdi_periodo: ["trimestral", "semestral", "anual", "personalizado"],
      pdi_status: ["rascunho", "ativo", "pausado", "concluido", "cancelado"],
      perfil_acao: [
        "visualizar",
        "criar",
        "editar",
        "excluir",
        "inativar",
        "exportar",
        "importar",
        "aprovar",
        "assinar",
        "compartilhar",
        "parametrizar",
        "administrar",
        "acessar_sensivel",
        "acessar_anonimizado",
        "ver_indicadores",
        "ver_individual",
      ],
      perfil_escopo_tipo: [
        "proprio_usuario",
        "subordinados_diretos",
        "equipe_direta_indireta",
        "setor",
        "unidade",
        "empresa_inteira",
        "grupo_economico",
        "multiplas_empresas",
        "carteira_clientes",
        "customizado",
      ],
      pt_status: [
        "rascunho",
        "liberada",
        "bloqueada",
        "encerrada",
        "cancelada",
      ],
      qualidade_score: [
        "completo",
        "suficiente",
        "incompleto",
        "inconsistente",
      ],
      rescisao_status: [
        "em_calculo",
        "em_conferencia",
        "aprovada",
        "paga",
        "reaberta",
      ],
      rescisao_tipo: [
        "PEDIDO_DEMISSAO",
        "DISPENSA_SEM_JUSTA_CAUSA",
        "DISPENSA_COM_JUSTA_CAUSA",
        "TERMINO_EXPERIENCIA",
        "RESCISAO_INDIRETA",
        "ACORDO_484A",
        "FALECIMENTO",
        "TERMINO_TEMPORARIO",
        "TERMINO_APRENDIZ",
        "ENCERRAMENTO_ESTAGIO",
      ],
      resposta_status: ["pendente", "em_andamento", "concluida"],
      risco_severidade: ["baixo", "medio", "alto", "critico"],
      rubrica_natureza: ["REMUNERATORIA", "INDENIZATORIA", "OUTRA"],
      rubrica_tipo: ["PROVENTO", "DESCONTO", "INFORMATIVA"],
      swot_classificacao: [
        "estrategico",
        "operacional",
        "cultural",
        "pessoas",
        "mercado",
      ],
      swot_impacto: ["baixo", "medio", "alto"],
      swot_tipo: ["forca", "fraqueza", "oportunidade", "ameaca"],
      tarefa_status: ["nao_iniciada", "em_andamento", "bloqueada", "concluida"],
      tenant_plan: [
        "free",
        "starter",
        "professional",
        "enterprise",
        "early_adopter",
        "tester",
      ],
      terceiro_acesso: ["eventual", "recorrente", "continuo"],
      terceiro_doc_status: ["valido", "a_vencer", "vencido", "pendente"],
      terceiro_status: ["liberado", "restrito", "bloqueado"],
      ticket_prioridade: ["baixa", "media", "alta", "critica"],
      ticket_status: [
        "aberto",
        "em_analise",
        "em_andamento",
        "resolvido",
        "fechado",
        "cancelado",
      ],
      ticket_tipo: ["bug", "falha", "reclamacao", "sugestao", "duvida"],
      tipo_avaliador: [
        "auto",
        "gestor",
        "par",
        "subordinado",
        "cliente_interno",
      ],
      tipo_competencia: ["tecnica", "comportamental", "cognitiva"],
      tipo_conteudo_funcao: [
        "manual",
        "pop",
        "instrucao",
        "video",
        "apresentacao",
        "documento",
        "link",
      ],
      tipo_ferramenta: ["sistema", "software", "planilha", "equipamento"],
      tipo_vinculo: [
        "CLT_PRAZO_INDETERMINADO",
        "CLT_EXPERIENCIA",
        "CLT_INTERMITENTE",
        "CLT_TEMPO_PARCIAL",
        "APRENDIZ",
        "ESTAGIO",
        "TEMPORARIO_LEI6019",
        "PJ",
      ],
      trilha_modulo_ordem_tipo: ["sequencial", "livre"],
      trilha_modulo_tipo: [
        "video",
        "pdf",
        "link",
        "apresentacao",
        "conteudo_interno",
        "quiz",
        "atividade_pratica",
        "checklist",
        "reflexao",
        "estudo_caso",
        "microdesafio",
      ],
      trilha_prioridade: ["obrigatoria", "recomendada", "opcional"],
      trilha_progresso_status: ["nao_iniciado", "em_andamento", "concluido"],
      trilha_status: ["rascunho", "ativa", "arquivada"],
      trilha_tipo: [
        "tecnica",
        "comportamental",
        "lideranca",
        "cultura",
        "ergonomia_saude",
        "processos",
        "onboarding",
      ],
      trilha_visibilidade: ["publica", "restrita"],
      usuario_status: [
        "rascunho",
        "pendente_convite",
        "convite_enviado",
        "aguardando_ativacao",
        "ativo",
        "bloqueado",
        "suspenso",
        "inativo",
        "arquivado",
      ],
      usuario_tipo: [
        "administrador",
        "rh_dp",
        "gestor",
        "lideranca",
        "tecnico_seguranca",
        "saude_ocupacional",
        "clinica_parceira",
        "consultor_externo",
        "prestador_terceiro",
        "auditor",
        "implantador",
        "suporte_autorizado",
        "corporativo_multiempresa",
        "colaborador",
      ],
      vinculo_status: [
        "ativo",
        "pendente",
        "suspenso",
        "revogado",
        "encerrado",
        "expirado",
      ],
      workflow_status: ["pendente", "aprovado", "rejeitado"],
    },
  },
} as const
