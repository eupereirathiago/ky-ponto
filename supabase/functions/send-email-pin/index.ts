/**
 * Supabase Edge Function: send-email-pin
 * Ambiente: Deno (TypeScript)
 * Objetivo: Disparar e-mail transacional real com o PIN de ponto do colaborador
 * Provedor recomendado: Resend (ou SendGrid via API REST)
 *
 * Como rodar localmente ou fazer deploy:
 * supabase functions deploy send-email-pin --no-verify-jwt
 * supabase secrets set RESEND_API_KEY=re_123456789
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestPayload {
  employee_id: string;
  employee_name: string;
  recipient_email: string;
  pin: string;
  is_reset?: boolean;
}

serve(async (req: Request) => {
  // Tratar requisições OPTIONS (preflight CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: RequestPayload = await req.json();
    const { employee_name, recipient_email, pin, is_reset } = payload;

    // 1. Validação dos dados de entrada
    if (!recipient_email || !pin || pin.length !== 6) {
      return new Response(
        JSON.stringify({ error: "E-mail ou PIN inválido (o PIN deve ter exatamente 6 dígitos)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Chave de API lida com segurança dos Secrets do servidor
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    // Se a chave ainda não estiver configurada no Supabase, retorna simulação segura informando o passo a passo
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: "Modo de simulação: Configure o Secret RESEND_API_KEY no Supabase para envio real.",
          recipient: recipient_email,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Montar o assunto e template HTML oficial da Ki Delícia
    const subject = is_reset
      ? "[Ki Delícia Ponto] Seu novo PIN de acesso foi redefinido"
      : "[Ki Delícia Ponto] Seu PIN pessoal e intransferível de registro de ponto";

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #FFF7E8; color: #2B0F0F; margin: 0; padding: 20px; }
          .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 2px solid #2B0F0F; padding: 30px; }
          .header { text-align: center; border-bottom: 2px dashed #FFA600; padding-bottom: 20px; margin-bottom: 20px; }
          .logo-title { font-size: 26px; font-weight: 800; color: #2B0F0F; margin: 0; }
          .logo-orange { color: #FFA600; }
          .subtitle { font-size: 13px; color: #7A655C; margin-top: 5px; }
          .pin-box { background: #FFF7E8; border: 2px solid #FFA600; border-radius: 16px; padding: 18px; text-align: center; margin: 25px 0; }
          .pin-label { font-size: 12px; font-weight: bold; color: #7A655C; text-transform: uppercase; letter-spacing: 1px; }
          .pin-number { font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #2B0F0F; margin: 8px 0 0; font-family: monospace; }
          .alert-box { background: #FFF3DF; border-left: 4px solid #D8483B; padding: 14px; border-radius: 8px; font-size: 12px; line-height: 1.5; color: #2B0F0F; margin: 20px 0; }
          .footer { font-size: 11px; color: #7A655C; text-align: center; margin-top: 25px; border-top: 1px solid #eee; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 class="logo-title">Ki <span class="logo-orange">Delícia</span></h1>
            <div class="subtitle">F. M. P. MACIEL LTDA · Ponto Eletrônico Oficial</div>
          </div>

          <p>Olá, <strong>${employee_name}</strong>,</p>
          <p>Seu código de identificação no Terminal de Ponto físico da unidade Quintino Cunha foi gerado com sucesso:</p>

          <div class="pin-box">
            <div class="pin-label">Seu PIN de Acesso</div>
            <div class="pin-number">${pin}</div>
          </div>

          <div class="alert-box">
            <strong>⚠️ AVISO OBRIGATÓRIO DE SEGURANÇA:</strong><br>
            • Este PIN é <strong>PESSOAL e RIGOROSAMENTE INTRANSFERÍVEL</strong>.<br>
            • Não compartilhe este código com nenhum colega de trabalho.<br>
            • O ponto exige selfie no terminal compartilhado para atestar sua presença.<br>
            • Caso esqueça ou suspeite de vazamento, comunique imediatamente o RH.
          </div>

          <div class="footer">
            <strong>F. M. P. MACIEL LTDA · CNPJ 56.503.256/0001-76</strong><br>
            Av. Mozart Pinheiro de Lucena, 3096 - Quintino Cunha, Fortaleza - CE<br>
            Portaria MTP nº 671/2021 (REP-P)
          </div>
        </div>
      </body>
      </html>
    `;

    // 4. Chamada REST para a API do Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Ki Delicia Ponto <nao-responda@kidelicia.com.br>", // Ou 'onboarding@resend.dev' durante testes
        to: [recipient_email],
        subject: subject,
        html: htmlBody,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(resendData.message || "Falha ao enviar e-mail via Resend API.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: resendData.id,
        recipient: recipient_email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno no envio de e-mail." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
