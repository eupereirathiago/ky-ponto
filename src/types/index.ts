export type PunchType = 'ENTRY' | 'BREAK_START' | 'BREAK_END' | 'EXIT';

export interface Company {
  id: string;
  corporate_name: string; // F. M. P. MACIEL LTDA
  trade_name: string;     // KI DELICIA / Ky Delícia
  cnpj: string;           // 56503256000176
  address: string;        // Av. Mozart Pinheiro de Lucena, 3096 - Quintino Cunha, Fortaleza - CE
  email: string;          // FRANCISCAMP409@GMAIL.COM
  phone: string;          // (85) 9430-7834
  timezone: string;       // 'America/Fortaleza'
  rep_p_identifier: string; // 'KYDELICIA-REPP-01'
  software_version: string;
}

export interface WorkLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  address: string;
}

export interface Terminal {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  work_location_id: string;
  last_heartbeat: string;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  entry_time: string;       // "08:00"
  break_start_time: string; // "12:00"
  break_end_time: string;   // "13:00"
  exit_time: string;        // "17:00"
  expected_work_minutes: number; // 480 (8h)
  planned_break_minutes: number;  // 60
}

export interface Employee {
  id: string;
  company_id: string;
  name: string;
  cpf: string;
  email: string;
  registration_number: string; // Matrícula
  role: string;
  department: string;
  admission_date: string;
  dismissal_date?: string | null;
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  schedule_template_id: string;
  pin_hash: string;
  pin_salt: string;
  pin_failed_attempts: number;
  pin_locked_until: string | null;
}

export interface PunchRecord {
  id: string;
  nsr: number; // Número Sequencial de Registro regulamentar (1, 2, 3...)
  company_id: string;
  employee_id: string;
  terminal_id: string;
  punch_type: PunchType;
  timestamp_utc: string; // ISO UTC confiável
  timestamp_local: string; // Formatada America/Fortaleza (Ex: "05/11/2026 às 08:02:15")
  time_only: string; // "08:02"
  photo_base64?: string | null;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    is_within_radius: boolean;
    distance_meters: number;
  } | null;
  sha256_hash: string;
  prev_hash: string;
  receipt_code: string;
}

export interface TimeTreatment {
  id: string;
  company_id: string;
  employee_id: string;
  date: string; // YYYY-MM-DD
  treatment_type: 
    | 'AJUSTE_HORARIO_MANUAL'
    | 'INCLUSAO_MANUAL' 
    | 'JUSTIFICATIVA_ATRASO' 
    | 'ATESTADO_MEDICO' 
    | 'AJUSTE_INTERVALO' 
    | 'HORA_EXTRA_AUTORIZADA'
    | 'OUTRO';
  target_punch_type: PunchType; // Qual horário está sendo ajustado: ENTRY, BREAK_START, BREAK_END ou EXIT
  original_time?: string | null; // Horário original gravado (ex: "08:45" ou null se não bateu)
  adjusted_time: string; // Novo horário definido pelo gestor (ex: "08:00")
  justification: string; // Motivo obrigatório da alteração
  decided_by: string;     // Nome ou e-mail do gestor responsável
  decided_at: string;
  status: 'APROVADO' | 'PENDENTE' | 'REJEITADO';
}

export interface EmailDispatchLog {
  id: string;
  employee_id: string;
  employee_name: string;
  recipient_email: string;
  subject: string;
  sent_at: string;
  status: 'ENVIADO' | 'PENDENTE' | 'FALHA';
  type: 'PIN_GERADO' | 'PIN_REDEFINIDO' | 'COMPROVANTE_MARCACAO';
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target_entity: string;
  target_id: string;
  details: string;
}

export interface DayWorkSummary {
  date: string; // YYYY-MM-DD
  employee_id: string;
  punches: PunchRecord[];
  treatments: TimeTreatment[];
  // Horários vigentes (considerando ajustes manuais aprovados)
  effective_entry_time?: string;
  effective_break_start_time?: string;
  effective_break_end_time?: string;
  effective_exit_time?: string;
  // Marcações originais
  entry?: PunchRecord;
  break_start?: PunchRecord;
  break_end?: PunchRecord;
  exit?: PunchRecord;
  // Métricas calculadas
  worked_minutes: number;
  expected_minutes: number;
  excess_minutes: number;  // Excedente bruto
  deficit_minutes: number; // Déficit bruto
  break_duration_minutes: number;
  has_pending_issues: boolean;
  issue_descriptions: string[];
  has_adjustments: boolean;
}
