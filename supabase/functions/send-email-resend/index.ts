import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ─── Templates ───
import { ConviteColaboradorEmail } from '../_shared/transactional-templates/convite-colaborador.tsx'
import { AlertaSaudeEmail } from '../_shared/transactional-templates/alerta-saude.tsx'
import { ASOVencimentoEmail } from '../_shared/transactional-templates/aso-vencimento.tsx'
import { TreinamentoVencimentoEmail } from '../_shared/transactional-templates/treinamento-vencimento.tsx'
import { PlanoAcaoEmail } from '../_shared/transactional-templates/plano-acao.tsx'
import { FeedbackEmail } from '../_shared/transactional-templates/feedback.tsx'
import { OcorrenciaEmail } from '../_shared/transactional-templates/ocorrencia.tsx'
import { GenericoEmail } from '../_shared/transactional-templates/generico.tsx'

interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
}

const TEMPLATES: Record<string, TemplateEntry> = {
  'convite-colaborador': {
    component: ConviteColaboradorEmail,
    subject: 'Você foi convidado para o YourEyes',
  },
  'alerta-saude': {
    component: AlertaSaudeEmail,
    subject: (data) => `⚠️ Alerta de Saúde: ${data?.titulo || 'Ação necessária'}`,
  },
  'aso-vencimento': {
    component: ASOVencimentoEmail,
    subject: (data) => `🩺 ASO próximo do vencimento: ${data?.colaborador || ''}`,
  },
  'treinamento-vencimento': {
    component: TreinamentoVencimentoEmail,
    subject: (data) => `📋 Treinamento próximo do vencimento: ${data?.treinamento || ''}`,
  },
  'plano-acao': {
    component: PlanoAcaoEmail,
    subject: (data) => `📌 Plano de Ação: ${data?.titulo || 'Nova ação atribuída'}`,
  },
  'feedback': {
    component: FeedbackEmail,
    subject: 'Novo feedback registrado',
  },
  'ocorrencia': {
    component: OcorrenciaEmail,
    subject: (data) => `🔔 Ocorrência registrada: ${data?.tipo || ''}`,
  },
  'generico': {
    component: GenericoEmail,
    subject: (data) => data?.assunto || 'Notificação YourEyes',
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY não configurada')
    }

    // Validate JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify the user token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { templateName, recipientEmail, templateData, from } = body

    if (!templateName || !recipientEmail) {
      return new Response(
        JSON.stringify({ error: 'templateName e recipientEmail são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const template = TEMPLATES[templateName]
    if (!template) {
      return new Response(
        JSON.stringify({ error: `Template não encontrado: ${templateName}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Render template
    const props = { ...templateData }
    const html = await renderAsync(React.createElement(template.component, props))

    // Resolve subject
    const subject = typeof template.subject === 'function'
      ? template.subject(templateData || {})
      : template.subject

    // Send via Resend
    const fromAddress = from || 'Seguramente <noreply@seguramente.app.br>'

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [recipientEmail],
        subject,
        html,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend error:', resendData)
      return new Response(
        JSON.stringify({ error: 'Falha ao enviar email', details: resendData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Email enviado com sucesso:', {
      to: recipientEmail,
      template: templateName,
      resendId: resendData.id,
    })

    return new Response(
      JSON.stringify({ success: true, id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro ao enviar email:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
