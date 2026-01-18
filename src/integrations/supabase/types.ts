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
      tenant_plan: ["free", "starter", "professional", "enterprise"],
      workflow_status: ["pendente", "aprovado", "rejeitado"],
    },
  },
} as const
