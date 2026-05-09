// Edge function pública (verify_jwt=false) para enviar resumo do questionário
// psicossocial por e-mail via Resend. NÃO armazena o e-mail nem vincula às respostas.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ResumoItem {
  dimensao: string;
  perguntas: { texto: string; resposta: string }[];
}

interface Payload {
  email: string;
  campanha_nome: string;
  resumo: ResumoItem[];
  total_perguntas: number;
  tempo_segundos?: number;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 255;
}

function buildHtml(p: Payload) {
  const blocos = p.resumo
    .map((d) => {
      const linhas = d.perguntas
        .map(
          (q, i) => `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#444;font-size:13px;width:60%;">
              <strong style="color:#666;">${i + 1}.</strong> ${escapeHtml(q.texto)}
            </td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#111;font-size:13px;font-weight:600;">
              ${escapeHtml(q.resposta)}
            </td>
          </tr>`
        )
        .join('');
      return `
        <h3 style="font-size:15px;color:#5b21b6;margin:24px 0 8px;font-family:Arial,sans-serif;">
          ${escapeHtml(d.dimensao)}
        </h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:6px;overflow:hidden;">
          ${linhas}
        </table>`;
    })
    .join('');

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f5fb;font-family:Arial,sans-serif;color:#111;">
  <div style="max-width:680px;margin:0 auto;padding:24px;background:#fff;">
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:20px;">Resumo do seu Questionário Psicossocial</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:.9;">${escapeHtml(p.campanha_nome)}</p>
    </div>

    <div style="padding:16px 4px 0;">
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 14px;color:#065f46;font-size:12px;line-height:1.5;">
        🔒 <strong>Privacidade e segurança:</strong> este e-mail foi enviado apenas para você,
        sob conexão criptografada (TLS). O endereço informado <strong>não é armazenado</strong>
        em nossa base, <strong>não é vinculado às suas respostas</strong> e <strong>não é
        compartilhado</strong> com a empresa nem com terceiros. Suas respostas continuam
        100% anônimas.
      </div>

      <p style="font-size:13px;color:#444;line-height:1.6;margin:16px 0 4px;">
        Você respondeu <strong>${p.total_perguntas} questões</strong>${
    p.tempo_segundos ? ` em <strong>${Math.floor(p.tempo_segundos / 60)} min</strong>` : ''
  }. Abaixo estão suas respostas, para sua referência pessoal.
      </p>

      ${blocos}

      <p style="font-size:11px;color:#888;margin-top:24px;line-height:1.5;">
        Este é um envio único e automático. Caso não tenha solicitado este e-mail, ignore esta mensagem.
        Conforme a LGPD (Lei nº 13.709/2018), o seu endereço de e-mail é tratado apenas para esta entrega
        e descartado em seguida.
      </p>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY não configurada');

    const body = (await req.json()) as Payload;

    if (!body?.email || !isValidEmail(body.email)) {
      return new Response(JSON.stringify({ error: 'E-mail inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!Array.isArray(body.resumo) || body.resumo.length === 0) {
      return new Response(JSON.stringify({ error: 'Resumo vazio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (typeof body.campanha_nome !== 'string' || body.campanha_nome.length > 200) {
      return new Response(JSON.stringify({ error: 'Campanha inválida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = buildHtml(body);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'YourEyes Psicossocial <noreply@youreyes.com.br>',
        to: [body.email],
        subject: `Resumo do seu questionário — ${body.campanha_nome}`.slice(0, 150),
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend error:', res.status, errText);
      return new Response(JSON.stringify({ error: 'Falha ao enviar e-mail' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('psicossocial-enviar-resumo error:', e);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
