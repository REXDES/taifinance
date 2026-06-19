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
      account_groups: {
        Row: {
          color: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          color: string
          company_id: string
          created_at: string
          current_balance: number
          description: string | null
          group_id: string | null
          id: string
          initial_balance: number
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          current_balance?: number
          description?: string | null
          group_id?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          current_balance?: number
          description?: string | null
          group_id?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connections: {
        Row: {
          account_id: string | null
          account_number: string | null
          agency: string | null
          client_id: string
          client_secret: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_sync_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          account_number?: string | null
          agency?: string | null
          client_id: string
          client_secret: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          account_number?: string | null
          agency?: string | null
          client_id?: string
          client_secret?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients_suppliers: {
        Row: {
          biometry_similarity_score: number | null
          biometry_verified_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          doc_back_url: string | null
          doc_front_url: string | null
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          selfie_url: string | null
          type: string
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          biometry_similarity_score?: number | null
          biometry_verified_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          doc_back_url?: string | null
          doc_front_url?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          selfie_url?: string | null
          type: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          biometry_similarity_score?: number | null
          biometry_verified_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          doc_back_url?: string | null
          doc_front_url?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          selfie_url?: string | null
          type?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          bank_digital_module_enabled: boolean
          city: string | null
          cnpj: string | null
          color: string
          created_at: string
          created_by: string | null
          credit_module_enabled: boolean
          email: string | null
          fantasy_name: string | null
          id: string
          machines_module_enabled: boolean
          name: string
          phone: string | null
          pix_city: string | null
          pix_holder_name: string | null
          pix_key: string | null
          pix_key_type: string | null
          state: string | null
          updated_at: string
          whatsapp_notify_days_before: number[]
          whatsapp_notify_enabled: boolean
          whatsapp_notify_time: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          bank_digital_module_enabled?: boolean
          city?: string | null
          cnpj?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          credit_module_enabled?: boolean
          email?: string | null
          fantasy_name?: string | null
          id?: string
          machines_module_enabled?: boolean
          name: string
          phone?: string | null
          pix_city?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          state?: string | null
          updated_at?: string
          whatsapp_notify_days_before?: number[]
          whatsapp_notify_enabled?: boolean
          whatsapp_notify_time?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          bank_digital_module_enabled?: boolean
          city?: string | null
          cnpj?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          credit_module_enabled?: boolean
          email?: string | null
          fantasy_name?: string | null
          id?: string
          machines_module_enabled?: boolean
          name?: string
          phone?: string | null
          pix_city?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          state?: string | null
          updated_at?: string
          whatsapp_notify_days_before?: number[]
          whatsapp_notify_enabled?: boolean
          whatsapp_notify_time?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      credit_applications: {
        Row: {
          approved_limit: number | null
          bureau_analysis: Json | null
          classification: string | null
          client_supplier_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          current_step: number
          decision: string | null
          decision_reason: string | null
          documento: string
          id: string
          nome: string | null
          probabilidade_inadimplencia: number | null
          qualification_draft: Json | null
          score: number | null
          simulation: Json | null
          status: string
          texto_score_bucket: string | null
          tipo_documento: string
          updated_at: string
        }
        Insert: {
          approved_limit?: number | null
          bureau_analysis?: Json | null
          classification?: string | null
          client_supplier_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          current_step?: number
          decision?: string | null
          decision_reason?: string | null
          documento: string
          id?: string
          nome?: string | null
          probabilidade_inadimplencia?: number | null
          qualification_draft?: Json | null
          score?: number | null
          simulation?: Json | null
          status?: string
          texto_score_bucket?: string | null
          tipo_documento: string
          updated_at?: string
        }
        Update: {
          approved_limit?: number | null
          bureau_analysis?: Json | null
          classification?: string | null
          client_supplier_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_step?: number
          decision?: string | null
          decision_reason?: string | null
          documento?: string
          id?: string
          nome?: string | null
          probabilidade_inadimplencia?: number | null
          qualification_draft?: Json | null
          score?: number | null
          simulation?: Json | null
          status?: string
          texto_score_bucket?: string | null
          tipo_documento?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_biometry: {
        Row: {
          ai_analysis: Json | null
          application_id: string
          company_id: string
          completed_at: string | null
          created_at: string
          doc_back_url: string | null
          doc_front_url: string | null
          id: string
          link_sent_at: string | null
          liveness_passed: boolean | null
          ocr_data: Json | null
          public_token: string
          rejection_reason: string | null
          selfie_url: string | null
          similarity_score: number | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          application_id: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          doc_back_url?: string | null
          doc_front_url?: string | null
          id?: string
          link_sent_at?: string | null
          liveness_passed?: boolean | null
          ocr_data?: Json | null
          public_token?: string
          rejection_reason?: string | null
          selfie_url?: string | null
          similarity_score?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          application_id?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          doc_back_url?: string | null
          doc_front_url?: string | null
          id?: string
          link_sent_at?: string | null
          liveness_passed?: boolean | null
          ocr_data?: Json | null
          public_token?: string
          rejection_reason?: string | null
          selfie_url?: string | null
          similarity_score?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_biometry_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "credit_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_consultations: {
        Row: {
          application_id: string | null
          approved_limit: number | null
          bureau_analysis: Json | null
          classification: string | null
          company_id: string
          consulted_by: string | null
          created_at: string
          decision: string | null
          decision_reason: string | null
          documento: string
          id: string
          pdf_data: string | null
          provider: string
          raw_response: Json | null
          score: number | null
          summary: Json | null
        }
        Insert: {
          application_id?: string | null
          approved_limit?: number | null
          bureau_analysis?: Json | null
          classification?: string | null
          company_id: string
          consulted_by?: string | null
          created_at?: string
          decision?: string | null
          decision_reason?: string | null
          documento: string
          id?: string
          pdf_data?: string | null
          provider?: string
          raw_response?: Json | null
          score?: number | null
          summary?: Json | null
        }
        Update: {
          application_id?: string | null
          approved_limit?: number | null
          bureau_analysis?: Json | null
          classification?: string | null
          company_id?: string
          consulted_by?: string | null
          created_at?: string
          decision?: string | null
          decision_reason?: string | null
          documento?: string
          id?: string
          pdf_data?: string | null
          provider?: string
          raw_response?: Json | null
          score?: number | null
          summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_consultations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "credit_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_contracts: {
        Row: {
          application_id: string
          client_supplier_id: string | null
          company_id: string
          contract_status: string
          created_at: string
          created_by: string | null
          description: string
          first_due_date: string
          id: string
          juros_mensal_pct: number
          num_parcelas: number
          parcela_amount: number
          pdf_url: string | null
          principal_amount: number
          total_amount: number
          updated_at: string
          whatsapp_accepted_at: string | null
          whatsapp_accepted_ip: string | null
        }
        Insert: {
          application_id: string
          client_supplier_id?: string | null
          company_id: string
          contract_status?: string
          created_at?: string
          created_by?: string | null
          description: string
          first_due_date: string
          id?: string
          juros_mensal_pct: number
          num_parcelas: number
          parcela_amount: number
          pdf_url?: string | null
          principal_amount: number
          total_amount: number
          updated_at?: string
          whatsapp_accepted_at?: string | null
          whatsapp_accepted_ip?: string | null
        }
        Update: {
          application_id?: string
          client_supplier_id?: string | null
          company_id?: string
          contract_status?: string
          created_at?: string
          created_by?: string | null
          description?: string
          first_due_date?: string
          id?: string
          juros_mensal_pct?: number
          num_parcelas?: number
          parcela_amount?: number
          pdf_url?: string | null
          principal_amount?: number
          total_amount?: number
          updated_at?: string
          whatsapp_accepted_at?: string | null
          whatsapp_accepted_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_contracts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "credit_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_decision_log: {
        Row: {
          application_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          decision: string | null
          id: string
          input: Json | null
          output: Json | null
          rules_snapshot: Json | null
          step: string
        }
        Insert: {
          application_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          decision?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          rules_snapshot?: Json | null
          step: string
        }
        Update: {
          application_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          decision?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          rules_snapshot?: Json | null
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_decision_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "credit_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ignored_occurrences: {
        Row: {
          application_id: string | null
          category: string
          company_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          descricao: string | null
          documento: string
          id: string
          occurrence_key: string
          raw_record: Json
          request_reason: string | null
          requested_at: string
          requested_by: string | null
          scope: string
          status: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          category: string
          company_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          descricao?: string | null
          documento: string
          id?: string
          occurrence_key: string
          raw_record: Json
          request_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          scope?: string
          status?: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          category?: string
          company_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          descricao?: string | null
          documento?: string
          id?: string
          occurrence_key?: string
          raw_record?: Json
          request_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          scope?: string
          status?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      credit_overridden_criteria: {
        Row: {
          actual_value: string | null
          application_id: string
          company_id: string
          created_at: string
          criterion: string
          criterion_label: string | null
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          id: string
          limit_value: string | null
          request_reason: string | null
          requested_at: string
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_value?: string | null
          application_id: string
          company_id: string
          created_at?: string
          criterion: string
          criterion_label?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          id?: string
          limit_value?: string | null
          request_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_value?: string | null
          application_id?: string
          company_id?: string
          created_at?: string
          criterion?: string
          criterion_label?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          id?: string
          limit_value?: string | null
          request_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_qualifications: {
        Row: {
          application_id: string
          cep: string | null
          cidade: string | null
          company_id: string
          created_at: string
          email: string | null
          endereco_entrega: string | null
          id: string
          notes: string | null
          profissao: string | null
          renda_mensal: number | null
          uf: string | null
          updated_at: string
          whatsapp_phone: string
        }
        Insert: {
          application_id: string
          cep?: string | null
          cidade?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          endereco_entrega?: string | null
          id?: string
          notes?: string | null
          profissao?: string | null
          renda_mensal?: number | null
          uf?: string | null
          updated_at?: string
          whatsapp_phone: string
        }
        Update: {
          application_id?: string
          cep?: string | null
          cidade?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          endereco_entrega?: string | null
          id?: string
          notes?: string | null
          profissao?: string | null
          renda_mensal?: number | null
          uf?: string | null
          updated_at?: string
          whatsapp_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_qualifications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "credit_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_rules: {
        Row: {
          bolsa_familia_block: boolean
          company_id: string
          consulta_price: number
          contract_clauses: string | null
          created_at: string
          ia_require_liveness: boolean
          ia_similarity_threshold: number
          id: string
          juros_mensal_pct: number
          max_alertas_restricoes: number
          max_ccf_total: number
          max_classificacao_score: string
          max_contratos_recentes: string
          max_dependentes_bolsa_familia: number
          max_dias_inadimplencia_interna: number
          max_faturas_em_atraso: string
          max_pendencias_financeiras: number
          max_probabilidade_inadimplencia: number
          max_protestos: number
          min_idade_pf: number
          min_meses_cnpj: number
          min_nivel_confianca_levels: Json
          min_score_analise: number
          mora_diaria_pct: number
          multa_atraso_pct: number
          parcela_minima: number
          score_bands: Json
          sugestao_negocio_block_buckets: Json
          sugestao_negocio_block_levels: Json
          teto_credito: number
          texto_pagamento_block_levels: Json
          updated_at: string
          use_bureau_limits: boolean
        }
        Insert: {
          bolsa_familia_block?: boolean
          company_id: string
          consulta_price?: number
          contract_clauses?: string | null
          created_at?: string
          ia_require_liveness?: boolean
          ia_similarity_threshold?: number
          id?: string
          juros_mensal_pct?: number
          max_alertas_restricoes?: number
          max_ccf_total?: number
          max_classificacao_score?: string
          max_contratos_recentes?: string
          max_dependentes_bolsa_familia?: number
          max_dias_inadimplencia_interna?: number
          max_faturas_em_atraso?: string
          max_pendencias_financeiras?: number
          max_probabilidade_inadimplencia?: number
          max_protestos?: number
          min_idade_pf?: number
          min_meses_cnpj?: number
          min_nivel_confianca_levels?: Json
          min_score_analise?: number
          mora_diaria_pct?: number
          multa_atraso_pct?: number
          parcela_minima?: number
          score_bands?: Json
          sugestao_negocio_block_buckets?: Json
          sugestao_negocio_block_levels?: Json
          teto_credito?: number
          texto_pagamento_block_levels?: Json
          updated_at?: string
          use_bureau_limits?: boolean
        }
        Update: {
          bolsa_familia_block?: boolean
          company_id?: string
          consulta_price?: number
          contract_clauses?: string | null
          created_at?: string
          ia_require_liveness?: boolean
          ia_similarity_threshold?: number
          id?: string
          juros_mensal_pct?: number
          max_alertas_restricoes?: number
          max_ccf_total?: number
          max_classificacao_score?: string
          max_contratos_recentes?: string
          max_dependentes_bolsa_familia?: number
          max_dias_inadimplencia_interna?: number
          max_faturas_em_atraso?: string
          max_pendencias_financeiras?: number
          max_probabilidade_inadimplencia?: number
          max_protestos?: number
          min_idade_pf?: number
          min_meses_cnpj?: number
          min_nivel_confianca_levels?: Json
          min_score_analise?: number
          mora_diaria_pct?: number
          multa_atraso_pct?: number
          parcela_minima?: number
          score_bands?: Json
          sugestao_negocio_block_buckets?: Json
          sugestao_negocio_block_levels?: Json
          teto_credito?: number
          texto_pagamento_block_levels?: Json
          updated_at?: string
          use_bureau_limits?: boolean
        }
        Relationships: []
      }
      element_favorites: {
        Row: {
          created_at: string
          element_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          element_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          element_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "element_favorites_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "elements"
            referencedColumns: ["id"]
          },
        ]
      }
      element_work_groups: {
        Row: {
          added_by: string | null
          created_at: string | null
          element_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          element_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          element_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "element_work_groups_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "element_work_groups_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "element_work_groups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      elements: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          position: number
          project_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          position?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          position?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "elements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_tags: {
        Row: {
          color: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_access: {
        Row: {
          created_at: string
          element_id: string | null
          id: string
          invitation_id: string
          project_id: string | null
        }
        Insert: {
          created_at?: string
          element_id?: string | null
          id?: string
          invitation_id: string
          project_id?: string | null
        }
        Update: {
          created_at?: string
          element_id?: string | null
          id?: string
          invitation_id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_access_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_access_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_access_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_account_access: {
        Row: {
          account_id: string
          created_at: string
          id: string
          invitation_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          invitation_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          invitation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_account_access_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_account_access_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_account_group_access: {
        Row: {
          account_group_id: string
          created_at: string
          id: string
          invitation_id: string
        }
        Insert: {
          account_group_id: string
          created_at?: string
          id?: string
          invitation_id: string
        }
        Update: {
          account_group_id?: string
          created_at?: string
          id?: string
          invitation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_account_group_access_account_group_id_fkey"
            columns: ["account_group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_account_group_access_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_company_access: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invitation_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invitation_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invitation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_company_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_company_access_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          access_all: boolean | null
          company_id: string
          company_limit: number | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          is_used: boolean
          name: string | null
          role: Database["public"]["Enums"]["app_role"]
          temp_password: string
          token_hash: string | null
        }
        Insert: {
          access_all?: boolean | null
          company_id: string
          company_limit?: number | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          is_used?: boolean
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          temp_password: string
          token_hash?: string | null
        }
        Update: {
          access_all?: boolean | null
          company_id?: string
          company_limit?: number | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          is_used?: boolean
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          temp_password?: string
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_horimeter_logs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          machine_id: string
          notes: string | null
          reading: number
          reference_id: string | null
          source: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id: string
          notes?: string | null
          reading: number
          reference_id?: string | null
          source: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string
          notes?: string | null
          reading?: number
          reference_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_horimeter_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_locations: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      machine_types: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          acquisition_date: string | null
          acquisition_source: string
          acquisition_value: number
          brand: string | null
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          current_horimeter: number
          destination: string | null
          id: string
          location: string | null
          model: string | null
          name: string
          notes: string | null
          preventive_maintenance_interval_hours: number | null
          rental_price_daily: number | null
          rental_price_monthly: number | null
          rental_price_weekly: number | null
          sale_price: number | null
          status: string
          technical_status: string
          type_id: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          acquisition_date?: string | null
          acquisition_source?: string
          acquisition_value?: number
          brand?: string | null
          category?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          current_horimeter?: number
          destination?: string | null
          id?: string
          location?: string | null
          model?: string | null
          name: string
          notes?: string | null
          preventive_maintenance_interval_hours?: number | null
          rental_price_daily?: number | null
          rental_price_monthly?: number | null
          rental_price_weekly?: number | null
          sale_price?: number | null
          status?: string
          technical_status?: string
          type_id?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          acquisition_date?: string | null
          acquisition_source?: string
          acquisition_value?: number
          brand?: string | null
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_horimeter?: number
          destination?: string | null
          id?: string
          location?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          preventive_maintenance_interval_hours?: number | null
          rental_price_daily?: number | null
          rental_price_monthly?: number | null
          rental_price_weekly?: number | null
          sale_price?: number | null
          status?: string
          technical_status?: string
          type_id?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "machine_types"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          horimeter_at_service: number | null
          id: string
          machine_id: string
          mechanic_id: string | null
          payment_mode: string
          start_date: string
          status: string
          total_cost: number
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          horimeter_at_service?: number | null
          id?: string
          machine_id: string
          mechanic_id?: string | null
          payment_mode?: string
          start_date: string
          status?: string
          total_cost?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          horimeter_at_service?: number | null
          id?: string
          machine_id?: string
          mechanic_id?: string | null
          payment_mode?: string
          start_date?: string
          status?: string
          total_cost?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "mechanics"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanics: {
        Row: {
          company_id: string
          created_at: string
          document: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          document?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          element_id: string
          id: string
          meeting_type: string
          scheduled_at: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          element_id: string
          id?: string
          meeting_type?: string
          scheduled_at: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          element_id?: string
          id?: string
          meeting_type?: string
          scheduled_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "elements"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      operators: {
        Row: {
          company_id: string
          created_at: string
          document: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          document?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payable_receivable_tags: {
        Row: {
          created_at: string
          payable_receivable_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          payable_receivable_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          payable_receivable_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payable_receivable_tags_payable_receivable_id_fkey"
            columns: ["payable_receivable_id"]
            isOneToOne: false
            referencedRelation: "payables_receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_receivable_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "finance_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      payables_receivables: {
        Row: {
          amount: number | null
          category_id: string | null
          client_supplier_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          credit_contract_id: string | null
          description: string
          due_date: string
          id: string
          installment_number: number | null
          is_amount_pending: boolean
          maintenance_id: string | null
          paid_account_id: string | null
          paid_amount: number | null
          paid_by: string | null
          paid_date: string | null
          parent_id: string | null
          payment_type: string
          rental_id: string | null
          status: string
          subcategory_id: string | null
          total_installments: number | null
          transaction_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          category_id?: string | null
          client_supplier_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          credit_contract_id?: string | null
          description: string
          due_date: string
          id?: string
          installment_number?: number | null
          is_amount_pending?: boolean
          maintenance_id?: string | null
          paid_account_id?: string | null
          paid_amount?: number | null
          paid_by?: string | null
          paid_date?: string | null
          parent_id?: string | null
          payment_type: string
          rental_id?: string | null
          status?: string
          subcategory_id?: string | null
          total_installments?: number | null
          transaction_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          category_id?: string | null
          client_supplier_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          credit_contract_id?: string | null
          description?: string
          due_date?: string
          id?: string
          installment_number?: number | null
          is_amount_pending?: boolean
          maintenance_id?: string | null
          paid_account_id?: string | null
          paid_amount?: number | null
          paid_by?: string | null
          paid_date?: string | null
          parent_id?: string | null
          payment_type?: string
          rental_id?: string | null
          status?: string
          subcategory_id?: string | null
          total_installments?: number | null
          transaction_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_receivables_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_receivables_client_supplier_id_fkey"
            columns: ["client_supplier_id"]
            isOneToOne: false
            referencedRelation: "clients_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_receivables_paid_account_id_fkey"
            columns: ["paid_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_receivables_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "payables_receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_receivables_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "transaction_subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_receivables_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
          whatsapp_phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          whatsapp_phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          subscription: Json
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          subscription: Json
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          subscription?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rental_kit_items: {
        Row: {
          created_at: string
          id: string
          kit_id: string
          machine_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kit_id: string
          machine_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kit_id?: string
          machine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_kit_items_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "rental_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_kit_items_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_kits: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      rental_machines: {
        Row: {
          created_at: string
          id: string
          machine_id: string
          price_snapshot: number | null
          rental_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id: string
          price_snapshot?: number | null
          rental_id: string
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string
          price_snapshot?: number | null
          rental_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_machines_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_machines_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_price_tables: {
        Row: {
          company_id: string
          created_at: string
          id: string
          machine_id: string
          max_qty: number | null
          min_qty: number
          price: number
          unit: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          machine_id: string
          max_qty?: number | null
          min_qty?: number
          price: number
          unit: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          machine_id?: string
          max_qty?: number | null
          min_qty?: number
          price?: number
          unit?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_price_tables_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          billing_frequency: string | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          horimeter_end: number | null
          horimeter_start: number | null
          id: string
          installments_count: number | null
          kit_id: string | null
          notes: string | null
          operator_id: string | null
          paid_account_id: string | null
          payment_mode: string
          qty: number
          start_date: string
          status: string
          total_amount: number
          transaction_id: string | null
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          billing_frequency?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          horimeter_end?: number | null
          horimeter_start?: number | null
          id?: string
          installments_count?: number | null
          kit_id?: string | null
          notes?: string | null
          operator_id?: string | null
          paid_account_id?: string | null
          payment_mode?: string
          qty?: number
          start_date: string
          status?: string
          total_amount?: number
          transaction_id?: string | null
          unit: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          billing_frequency?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          horimeter_end?: number | null
          horimeter_start?: number | null
          id?: string
          installments_count?: number | null
          kit_id?: string | null
          notes?: string | null
          operator_id?: string | null
          paid_account_id?: string | null
          payment_mode?: string
          qty?: number
          start_date?: string
          status?: string
          total_amount?: number
          transaction_id?: string | null
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "rental_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_paid_account_id_fkey"
            columns: ["paid_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      status_configs: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          name: string
          priority: number
          updated_at: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          priority?: number
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          element_id: string
          end_date: string | null
          estimated_value: number | null
          id: string
          is_hidden: boolean
          name: string
          observation: string | null
          parent_task_id: string | null
          position: number
          priority: number | null
          responsible_id: string | null
          start_date: string | null
          status_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          element_id: string
          end_date?: string | null
          estimated_value?: number | null
          id?: string
          is_hidden?: boolean
          name: string
          observation?: string | null
          parent_task_id?: string | null
          position?: number
          priority?: number | null
          responsible_id?: string | null
          start_date?: string | null
          status_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          element_id?: string
          end_date?: string | null
          estimated_value?: number | null
          id?: string
          is_hidden?: boolean
          name?: string
          observation?: string | null
          parent_task_id?: string | null
          position?: number
          priority?: number | null
          responsible_id?: string | null
          start_date?: string | null
          status_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "status_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_categories: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          monthly_budget: number | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          monthly_budget?: number | null
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          monthly_budget?: number | null
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_tags: {
        Row: {
          created_at: string
          tag_id: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          tag_id: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          tag_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "finance_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tags_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
          notes: string | null
          subcategory_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          description: string
          id?: string
          notes?: string | null
          subcategory_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          notes?: string | null
          subcategory_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "transaction_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_tags: {
        Row: {
          created_at: string
          tag_id: string
          transfer_id: string
        }
        Insert: {
          created_at?: string
          tag_id: string
          transfer_id: string
        }
        Update: {
          created_at?: string
          tag_id?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "finance_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_tags_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          from_account_id: string
          id: string
          to_account_id: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          from_account_id: string
          id?: string
          to_account_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          from_account_id?: string
          id?: string
          to_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_account_access: {
        Row: {
          account_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_account_access_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_account_group_access: {
        Row: {
          account_group_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          account_group_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          account_group_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_account_group_access_account_group_id_fkey"
            columns: ["account_group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_element_access: {
        Row: {
          created_at: string
          element_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          element_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          element_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_element_access_element_id_fkey"
            columns: ["element_id"]
            isOneToOne: false
            referencedRelation: "elements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_project_access: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_project_access_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_limit: number | null
          id: string
          invitation_limit: number | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_limit?: number | null
          id?: string
          invitation_limit?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_limit?: number | null
          id?: string
          invitation_limit?: number | null
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
      accept_invitation: {
        Args: { _invitation_id: string; _user_id: string }
        Returns: boolean
      }
      check_invitation_status: {
        Args: { _invitation_id: string }
        Returns: {
          invitation_exists: boolean
          invitation_name: string
          is_expired: boolean
          is_used: boolean
          user_email: string
          user_exists: boolean
        }[]
      }
      count_companies_created_by: {
        Args: { _user_id: string }
        Returns: number
      }
      generate_invitation_token: { Args: never; Returns: string }
      get_company_limit: { Args: { _user_id: string }; Returns: number }
      get_invitation_by_id: {
        Args: { _invitation_id: string }
        Returns: {
          company_id: string
          email: string
          expires_at: string
          id: string
          is_used: boolean
          name: string
          role: Database["public"]["Enums"]["app_role"]
          temp_password: string
        }[]
      }
      get_user_company_ids: { Args: { _user_id: string }; Returns: string[] }
      has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_invitation_token: { Args: { token: string }; Returns: string }
      is_supervisor: { Args: { _user_id: string }; Returns: boolean }
      validate_invitation_token: {
        Args: { _invitation_id: string; _token: string }
        Returns: {
          company_id: string
          email: string
          expires_at: string
          id: string
          is_used: boolean
          is_valid: boolean
          name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
    }
    Enums: {
      app_role: "supervisor" | "gerente" | "operador"
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
      app_role: ["supervisor", "gerente", "operador"],
    },
  },
} as const
