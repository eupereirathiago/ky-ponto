/**
 * Serviço de Integração com a Supabase Edge Function: send-email-pin
 * Faz a chamada segura sem expor chaves do Resend ou credenciais no navegador.
 */

export interface SendPinEmailParams {
  employeeId: string;
  employeeName: string;
  recipientEmail: string;
  pin: string;
  isReset?: boolean;
}

export interface SendPinEmailResponse {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

export async function sendPinEmailViaEdgeFunction(
  params: SendPinEmailParams
): Promise<SendPinEmailResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Se o projeto ainda não estiver conectado com chaves de produção do Supabase,
  // mantemos o fluxo de fallback simulado transparente
  if (!supabaseUrl || !supabaseAnonKey) {
    console.info(
      'Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não detectadas. Operando em modo de prévia/simulação.'
    );
    return {
      success: true,
      simulated: true,
      messageId: `sim_${Date.now()}`,
    };
  }

  try {
    const endpoint = `${supabaseUrl}/functions/v1/send-email-pin`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        employee_id: params.employeeId,
        employee_name: params.employeeName,
        recipient_email: params.recipientEmail,
        pin: params.pin,
        is_reset: params.isReset || false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Falha ao comunicar com a Edge Function.',
      };
    }

    return {
      success: true,
      messageId: data.messageId,
      simulated: data.simulated,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro de rede ao conectar com a Edge Function.',
    };
  }
}
