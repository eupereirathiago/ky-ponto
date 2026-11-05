/**
 * Utilitários Criptográficos e de Validação para KyDelicia Ponto
 * Conformidade com integridade de dados (SHA-256), proteção de PIN e regras CLT/MTE.
 */

// Validador matemático oficial de CPF (Receita Federal - Módulo 11)
export function isValidCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  // Bloquear dígitos todos iguais (111.111.111-11, etc.)
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

export function formatCPF(cpf: string): string {
  const clean = cpf.replace(/\D/g, '').slice(0, 11);
  return clean
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function formatCNPJ(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, '').slice(0, 14);
  return clean
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

// Cálculo de Hash SHA-256 via Web Crypto API nativa do navegador
export async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Gera Salt criptográfico aleatório
export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Gera Hash seguro para PIN com Salt individual
export async function hashPin(pin: string, salt: string): Promise<string> {
  return sha256(`ky-ponto-salt:${salt}:${pin}:sec-v2`);
}

// Distância em metros entre duas coordenadas GPS (Fórmula de Haversine)
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Formatação amigável de minutos para HH:MM
export function minutesToHHMM(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Formatação do fuso America/Fortaleza
export function formatFortalezaDate(dateObj: Date): {
  dateStr: string;
  timeStr: string;
  fullReadable: string;
} {
  const optionsDate: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Fortaleza',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };
  const optionsTime: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Fortaleza',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  const optionsFull: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Fortaleza',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };

  const dateStr = dateObj.toLocaleDateString('pt-BR', optionsDate);
  const timeStr = dateObj.toLocaleTimeString('pt-BR', optionsTime);
  const fullReadable = dateObj.toLocaleDateString('pt-BR', optionsFull);

  return { dateStr, timeStr, fullReadable };
}
