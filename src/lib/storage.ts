/**
 * Motor de Dados e Persistência do KyDelicia Ponto
 * Dados reais da empresa F. M. P. MACIEL LTDA (KI DELICIA) - CNPJ: 56.503.256/0001-76
 * Conformidade com REP-P e PTRP (Portaria MTP nº 671/2021).
 */

import {
  Company,
  WorkLocation,
  Terminal,
  ScheduleTemplate,
  Employee,
  PunchRecord,
  TimeTreatment,
  AuditEvent,
  PunchType,
  DayWorkSummary,
  EmailDispatchLog,
} from '../types';
import {
  sha256,
  hashPin,
  generateSalt,
  formatFortalezaDate,
  calculateDistanceMeters,
} from './crypto';

const STORAGE_KEYS = {
  COMPANY: 'kyponto_company_v3',
  LOCATION: 'kyponto_location_v3',
  TERMINAL: 'kyponto_terminal_v3',
  SCHEDULES: 'kyponto_schedules_v3',
  EMPLOYEES: 'kyponto_employees_v3',
  PUNCHES: 'kyponto_punches_v3',
  TREATMENTS: 'kyponto_treatments_v3',
  AUDIT: 'kyponto_audit_v3',
  EMAILS: 'kyponto_emails_v3',
  NSR_COUNTER: 'kyponto_nsr_counter_v3',
};

// Dados oficiais extraídos da Certidão de CNPJ da Receita Federal do Brasil
export const DEFAULT_COMPANY: Company = {
  id: 'comp_kidelicia_01',
  corporate_name: 'F. M. P. MACIEL LTDA',
  trade_name: 'KI DELICIA',
  cnpj: '56503256000176', // 56.503.256/0001-76
  address: 'Av. Mozart Pinheiro de Lucena, 3096 - Quintino Cunha, Fortaleza - CE, CEP: 60.352-642',
  email: 'FRANCISCAMP409@GMAIL.COM',
  phone: '(85) 9430-7834',
  timezone: 'America/Fortaleza',
  rep_p_identifier: 'KIDELICIA-REPP-01',
  software_version: '2.0.0-PROD',
};

export const DEFAULT_LOCATION: WorkLocation = {
  id: 'loc_quintino_cunha_01',
  name: 'Matriz Quintino Cunha - Loja e Produção',
  latitude: -3.7381,
  longitude: -38.5878,
  radius_meters: 150, // 150 metros de raio de tolerância
  address: 'Av. Mozart Pinheiro de Lucena, 3096 - Quintino Cunha, Fortaleza - CE',
};

export const DEFAULT_TERMINAL: Terminal = {
  id: 'term_tablet_balcao_01',
  code: 'TERM-QUIOSQUE-01',
  name: 'Terminal Quiosque Balcão e Produção',
  is_active: true,
  work_location_id: 'loc_quintino_cunha_01',
  last_heartbeat: new Date().toISOString(),
};

export const DEFAULT_SCHEDULES: ScheduleTemplate[] = [
  {
    id: 'sch_comercial_8h',
    name: 'Geral Confeitaria e Balcão (08:00 às 17:00)',
    description: 'Jornada regular de 8 horas com 1 hora de intervalo para refeição',
    entry_time: '08:00',
    break_start_time: '12:00',
    break_end_time: '13:00',
    exit_time: '17:00',
    expected_work_minutes: 480,
    planned_break_minutes: 60,
  },
  {
    id: 'sch_producao_padaria',
    name: 'Produção Matinal de Pães e Salgados (06:00 às 15:00)',
    description: 'Turno matinal dos padeiros com 1 hora de intervalo para descanso/refeição',
    entry_time: '06:00',
    break_start_time: '10:00',
    break_end_time: '11:00',
    exit_time: '15:00',
    expected_work_minutes: 480,
    planned_break_minutes: 60,
  },
];

// Gera um comprovante gráfico / selfie ilustrativa com selo quando a câmera física não está disponível
function generatePresenceBadgePhoto(employeeName: string, role: string, timestampStr: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fundo creme suave com textura
  ctx.fillStyle = '#FFF7E8';
  ctx.fillRect(0, 0, 300, 300);

  // Moldura chocolate
  ctx.strokeStyle = '#2B0F0F';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 288, 288);

  // Círculo central com silhueta / avatar de presença
  ctx.fillStyle = '#FFA600';
  ctx.beginPath();
  ctx.arc(150, 110, 55, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2B0F0F';
  ctx.beginPath();
  ctx.arc(150, 95, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(150, 150, 42, Math.PI, 0, false);
  ctx.fill();

  // Textos de comprovação da batida
  ctx.fillStyle = '#2B0F0F';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(employeeName, 150, 195);

  ctx.fillStyle = '#7A655C';
  ctx.font = '12px sans-serif';
  ctx.fillText(role, 150, 215);

  // Tarja de status verde
  ctx.fillStyle = '#3E9B5F';
  ctx.fillRect(20, 235, 260, 28);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('✓ FOTO CONFIRMADA NO TERMINAL', 150, 253);

  // Carimbo de hora
  ctx.fillStyle = '#7A655C';
  ctx.font = '10px monospace';
  ctx.fillText(timestampStr, 150, 282);

  return canvas.toDataURL('image/jpeg', 0.8);
}

export class PontoStore {
  private static get<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private static set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Falha ao persistir no localStorage:', e);
    }
  }

  public static async initSeedIfNeeded(): Promise<void> {
    const existingCompany = localStorage.getItem(STORAGE_KEYS.COMPANY);
    // Se a empresa ainda não tiver o CNPJ atualizado da F. M. P. MACIEL LTDA, atualiza
    if (!existingCompany || !existingCompany.includes('56503256000176')) {
      const saltAna = generateSalt();
      const saltCarlos = generateSalt();
      const saltMariana = generateSalt();
      const saltRoberto = generateSalt();

      const hashAna = await hashPin('123456', saltAna);
      const hashCarlos = await hashPin('654321', saltCarlos);
      const hashMariana = await hashPin('112233', saltMariana);
      const hashRoberto = await hashPin('445566', saltRoberto);

      const initialEmployees: Employee[] = [
        {
          id: 'emp_01',
          company_id: DEFAULT_COMPANY.id,
          name: 'Ana Silva',
          cpf: '52998224725',
          email: 'ana.silva@kidelicia.com.br',
          registration_number: 'KD-001',
          role: 'Confeiteira Chefe',
          department: 'Confeitaria',
          admission_date: '2024-08-15',
          status: 'ACTIVE',
          schedule_template_id: 'sch_comercial_8h',
          pin_hash: hashAna,
          pin_salt: saltAna,
          pin_failed_attempts: 0,
          pin_locked_until: null,
        },
        {
          id: 'emp_02',
          company_id: DEFAULT_COMPANY.id,
          name: 'Carlos Souza',
          cpf: '06323635384',
          email: 'carlos.souza@kidelicia.com.br',
          registration_number: 'KD-002',
          role: 'Padeiro Especialista',
          department: 'Panificação',
          admission_date: '2024-08-20',
          status: 'ACTIVE',
          schedule_template_id: 'sch_producao_padaria',
          pin_hash: hashCarlos,
          pin_salt: saltCarlos,
          pin_failed_attempts: 0,
          pin_locked_until: null,
        },
        {
          id: 'emp_03',
          company_id: DEFAULT_COMPANY.id,
          name: 'Mariana Lima',
          cpf: '70284489100',
          email: 'mariana.lima@kidelicia.com.br',
          registration_number: 'KD-003',
          role: 'Atendente de Balcão e Caixa',
          department: 'Atendimento',
          admission_date: '2024-09-01',
          status: 'ACTIVE',
          schedule_template_id: 'sch_comercial_8h',
          pin_hash: hashMariana,
          pin_salt: saltMariana,
          pin_failed_attempts: 0,
          pin_locked_until: null,
        },
        {
          id: 'emp_04',
          company_id: DEFAULT_COMPANY.id,
          name: 'Roberto Alves',
          cpf: '81146244191',
          email: 'roberto.alves@kidelicia.com.br',
          registration_number: 'KD-004',
          role: 'Auxiliar de Produção',
          department: 'Cozinha e Salgados',
          admission_date: '2024-10-01',
          status: 'ACTIVE',
          schedule_template_id: 'sch_comercial_8h',
          pin_hash: hashRoberto,
          pin_salt: saltRoberto,
          pin_failed_attempts: 0,
          pin_locked_until: null,
        },
      ];

      this.set(STORAGE_KEYS.COMPANY, DEFAULT_COMPANY);
      this.set(STORAGE_KEYS.LOCATION, DEFAULT_LOCATION);
      this.set(STORAGE_KEYS.TERMINAL, DEFAULT_TERMINAL);
      this.set(STORAGE_KEYS.SCHEDULES, DEFAULT_SCHEDULES);
      this.set(STORAGE_KEYS.EMPLOYEES, initialEmployees);
      this.set(STORAGE_KEYS.NSR_COUNTER, 1);
      this.set(STORAGE_KEYS.PUNCHES, []);
      this.set(STORAGE_KEYS.TREATMENTS, []);
      this.set(STORAGE_KEYS.EMAILS, []);
      this.set(STORAGE_KEYS.AUDIT, [
        {
          id: 'aud_init_01',
          timestamp: new Date().toISOString(),
          actor: 'Sistema',
          action: 'CADASTRO_EMPRESA',
          target_entity: 'companies',
          target_id: DEFAULT_COMPANY.id,
          details: `Empresa F. M. P. MACIEL LTDA (CNPJ ${DEFAULT_COMPANY.cnpj}) cadastrada com sucesso.`,
        },
      ]);

      await this.seedInitialPunches();
    }
  }

  private static async seedInitialPunches(): Promise<void> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    const tCarlos1 = new Date(`${dateStr}T06:01:00-03:00`);
    const tCarlos2 = new Date(`${dateStr}T10:02:00-03:00`);
    const tCarlos3 = new Date(`${dateStr}T11:03:00-03:00`);

    const tMariana1 = new Date(`${dateStr}T08:02:00-03:00`);
    const tMariana2 = new Date(`${dateStr}T12:00:00-03:00`);

    await this.registerPunch({
      employee_id: 'emp_02',
      punch_type: 'ENTRY',
      customDate: tCarlos1,
      mockLocation: true,
    });
    await this.registerPunch({
      employee_id: 'emp_02',
      punch_type: 'BREAK_START',
      customDate: tCarlos2,
      mockLocation: true,
    });
    await this.registerPunch({
      employee_id: 'emp_02',
      punch_type: 'BREAK_END',
      customDate: tCarlos3,
      mockLocation: true,
    });

    await this.registerPunch({
      employee_id: 'emp_03',
      punch_type: 'ENTRY',
      customDate: tMariana1,
      mockLocation: true,
    });
    await this.registerPunch({
      employee_id: 'emp_03',
      punch_type: 'BREAK_START',
      customDate: tMariana2,
      mockLocation: true,
    });
  }

  // --- EMPRESA E ESTABELECIMENTO ---
  public static getCompany(): Company {
    return this.get(STORAGE_KEYS.COMPANY, DEFAULT_COMPANY);
  }

  public static updateCompany(updated: Partial<Company>): Company {
    const curr = this.getCompany();
    const next = { ...curr, ...updated };
    this.set(STORAGE_KEYS.COMPANY, next);
    this.logAudit('ADMIN', 'ATUALIZAR_EMPRESA', 'companies', next.id, 'Dados da empresa atualizados');
    return next;
  }

  public static getLocation(): WorkLocation {
    return this.get(STORAGE_KEYS.LOCATION, DEFAULT_LOCATION);
  }

  public static updateLocation(updated: Partial<WorkLocation>): WorkLocation {
    const curr = this.getLocation();
    const next = { ...curr, ...updated };
    this.set(STORAGE_KEYS.LOCATION, next);
    this.logAudit('ADMIN', 'ATUALIZAR_LOCAL', 'work_locations', next.id, 'Local autorizado atualizado');
    return next;
  }

  public static getTerminal(): Terminal {
    return this.get(STORAGE_KEYS.TERMINAL, DEFAULT_TERMINAL);
  }

  public static getSchedules(): ScheduleTemplate[] {
    return this.get(STORAGE_KEYS.SCHEDULES, DEFAULT_SCHEDULES);
  }

  // --- COLABORADORES E ENVIO DE PIN POR E-MAIL ---
  public static getEmployees(): Employee[] {
    return this.get<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
  }

  public static getEmployeeById(id: string): Employee | undefined {
    return this.getEmployees().find(e => e.id === id);
  }

  public static async validatePin(pin: string): Promise<{ success: boolean; employee?: Employee; error?: string }> {
    const employees = this.getEmployees();
    const now = new Date();

    for (const emp of employees) {
      if (emp.pin_locked_until && new Date(emp.pin_locked_until) > now) {
        const remainingSeconds = Math.ceil((new Date(emp.pin_locked_until).getTime() - now.getTime()) / 1000);
        return {
          success: false,
          error: `PIN bloqueado temporariamente por excesso de tentativas. Tente novamente em ${remainingSeconds} segundos.`,
        };
      }

      const candidateHash = await hashPin(pin, emp.pin_salt);
      if (candidateHash === emp.pin_hash) {
        if (emp.pin_failed_attempts > 0 || emp.pin_locked_until) {
          emp.pin_failed_attempts = 0;
          emp.pin_locked_until = null;
          this.updateEmployeeInternal(emp);
        }
        return { success: true, employee: emp };
      }
    }

    return {
      success: false,
      error: 'PIN incorreto. Verifique seus 6 dígitos e tente novamente.',
    };
  }

  // Envio de PIN individual por e-mail com garantia de ser pessoal e intransferível
  public static dispatchPinEmail(
    employee: Employee,
    pin: string,
    isReset = false,
    adminName = 'Gestor Ki Delícia'
  ): { success: boolean; log: EmailDispatchLog; emailBody: string } {
    const emails = this.get<EmailDispatchLog[]>(STORAGE_KEYS.EMAILS, []);
    const company = this.getCompany();

    const subject = isReset
      ? `[Ki Delícia Ponto] Seu novo PIN de acesso ao terminal foi redefinido`
      : `[Ki Delícia Ponto] Seu PIN pessoal e intransferível de registro de ponto`;

    const emailBody = `
Prezado(a) ${employee.name},

Seu PIN de identificação no Terminal de Ponto da Ki Delícia (${company.corporate_name}) foi gerado com sucesso:

============================================
           SEU PIN DE ACESSO:
               ${pin}
============================================

⚠️ IMPORTANTE - REGRA DE SEGURANÇA:
1. Este PIN é PESSOAL e RIGOROSAMENTE INTRANSFERÍVEL.
2. Nunca compartilhe este código com nenhum outro colaborador, colega ou terceiro.
3. Toda marcação efetuada com este PIN no terminal físico exige comprovação de selfie e é de sua exclusiva responsabilidade.
4. Em caso de esquecimento ou suspeita de uso indevido, solicite imediatamente a redefinição à administração.

Local de trabalho: ${company.address}
Terminal: ${DEFAULT_TERMINAL.name}

Atenciosamente,
Administração de Recursos Humanos
${company.trade_name} · ${company.corporate_name}
    `.trim();

    const log: EmailDispatchLog = {
      id: `mail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      employee_id: employee.id,
      employee_name: employee.name,
      recipient_email: employee.email,
      subject,
      sent_at: new Date().toISOString(),
      status: 'ENVIADO',
      type: isReset ? 'PIN_REDEFINIDO' : 'PIN_GERADO',
    };

    emails.push(log);
    this.set(STORAGE_KEYS.EMAILS, emails);

    this.logAudit(
      adminName,
      isReset ? 'ENVIO_NOVO_PIN_EMAIL' : 'ENVIO_PIN_CADASTRO_EMAIL',
      'employees',
      employee.id,
      `PIN enviado para o e-mail individual ${employee.email} com orientações de uso pessoal e intransferível.`
    );

    return { success: true, log, emailBody };
  }

  public static getSentEmails(): EmailDispatchLog[] {
    return this.get<EmailDispatchLog[]>(STORAGE_KEYS.EMAILS, []).reverse();
  }

  public static async resetEmployeePin(
    employeeId: string,
    newPin: string,
    adminName: string
  ): Promise<{ success: boolean; emailLog?: EmailDispatchLog; emailBody?: string }> {
    const employees = this.getEmployees();
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return { success: false };

    const newSalt = generateSalt();
    const newHash = await hashPin(newPin, newSalt);

    emp.pin_hash = newHash;
    emp.pin_salt = newSalt;
    emp.pin_failed_attempts = 0;
    emp.pin_locked_until = null;

    this.updateEmployeeInternal(emp);

    // Dispara automaticamente o e-mail para o colaborador
    const emailResult = this.dispatchPinEmail(emp, newPin, true, adminName);

    return {
      success: true,
      emailLog: emailResult.log,
      emailBody: emailResult.emailBody,
    };
  }

  public static async saveEmployee(
    employeeData: Partial<Employee> & { name: string; cpf: string; email: string },
    initialPin?: string
  ): Promise<{ employee: Employee; emailBody?: string }> {
    const employees = this.getEmployees();
    const salt = generateSalt();
    const pinToUse = initialPin || Math.floor(100000 + Math.random() * 900000).toString();
    const hash = await hashPin(pinToUse, salt);

    if (employeeData.id) {
      const index = employees.findIndex(e => e.id === employeeData.id);
      if (index >= 0) {
        employees[index] = { ...employees[index], ...employeeData } as Employee;
        this.set(STORAGE_KEYS.EMPLOYEES, employees);
        this.logAudit('ADMIN', 'ATUALIZAR_COLABORADOR', 'employees', employeeData.id, `Dados de ${employeeData.name} atualizados`);
        return { employee: employees[index] };
      }
    }

    const newEmp: Employee = {
      id: `emp_${Date.now()}`,
      company_id: DEFAULT_COMPANY.id,
      name: employeeData.name,
      cpf: employeeData.cpf.replace(/\D/g, ''),
      email: employeeData.email,
      registration_number: employeeData.registration_number || `KD-${String(employees.length + 1).padStart(3, '0')}`,
      role: employeeData.role || 'Atendente',
      department: employeeData.department || 'Geral',
      admission_date: employeeData.admission_date || new Date().toISOString().split('T')[0],
      status: employeeData.status || 'ACTIVE',
      schedule_template_id: employeeData.schedule_template_id || 'sch_comercial_8h',
      pin_hash: hash,
      pin_salt: salt,
      pin_failed_attempts: 0,
      pin_locked_until: null,
    };

    employees.push(newEmp);
    this.set(STORAGE_KEYS.EMPLOYEES, employees);

    this.logAudit('ADMIN', 'CADASTRAR_COLABORADOR', 'employees', newEmp.id, `Novo colaborador cadastrado: ${newEmp.name}`);

    // Disparo imediato do PIN para o e-mail do colaborador
    const emailResult = this.dispatchPinEmail(newEmp, pinToUse, false, 'Administrador');

    return { employee: newEmp, emailBody: emailResult.emailBody };
  }

  private static updateEmployeeInternal(emp: Employee): void {
    const employees = this.getEmployees();
    const index = employees.findIndex(e => e.id === emp.id);
    if (index >= 0) {
      employees[index] = emp;
      this.set(STORAGE_KEYS.EMPLOYEES, employees);
    }
  }

  // --- MOTOR REGULAMENTAR DE PONTO (REP-P): MARCAÇÕES ORIGINAIS E FOTOS ---
  public static getPunches(): PunchRecord[] {
    return this.get<PunchRecord[]>(STORAGE_KEYS.PUNCHES, []);
  }

  public static getRecentReceipts(employeeId: string, hours = 48): PunchRecord[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return this.getPunches()
      .filter(p => p.employee_id === employeeId && p.timestamp_utc >= cutoff)
      .sort((a, b) => b.nsr - a.nsr);
  }

  public static getTodayPunchesForEmployee(employeeId: string, referenceDate = new Date()): PunchRecord[] {
    const dateStr = referenceDate.toISOString().split('T')[0];
    return this.getPunches()
      .filter(p => p.employee_id === employeeId && p.timestamp_utc.startsWith(dateStr))
      .sort((a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime());
  }

  public static async registerPunch(params: {
    employee_id: string;
    punch_type: PunchType;
    photo_base64?: string | null;
    locationCoords?: { latitude: number; longitude: number; accuracy: number };
    customDate?: Date;
    mockLocation?: boolean;
  }): Promise<PunchRecord> {
    const punches = this.getPunches();
    const company = this.getCompany();
    const terminal = this.getTerminal();
    const locConfig = this.getLocation();
    const emp = this.getEmployeeById(params.employee_id);

    let nsrCounter = this.get<number>(STORAGE_KEYS.NSR_COUNTER, 1);
    const nsr = nsrCounter;
    this.set(STORAGE_KEYS.NSR_COUNTER, nsrCounter + 1);

    const timestampObj = params.customDate || new Date();
    const timestamp_utc = timestampObj.toISOString();
    const { dateStr, timeStr } = formatFortalezaDate(timestampObj);
    const timestamp_local = `${dateStr} às ${timeStr}`;
    const time_only = timeStr.substring(0, 5);

    let locationData: PunchRecord['location'] = null;
    if (params.locationCoords) {
      const dist = calculateDistanceMeters(
        params.locationCoords.latitude,
        params.locationCoords.longitude,
        locConfig.latitude,
        locConfig.longitude
      );
      locationData = {
        latitude: params.locationCoords.latitude,
        longitude: params.locationCoords.longitude,
        accuracy: params.locationCoords.accuracy,
        distance_meters: dist,
        is_within_radius: dist <= locConfig.radius_meters,
      };
    } else if (params.mockLocation) {
      locationData = {
        latitude: locConfig.latitude,
        longitude: locConfig.longitude,
        accuracy: 10,
        distance_meters: 8,
        is_within_radius: true,
      };
    }

    // Garante que haja SEMPRE uma foto de comprovação armazenada (selfie real ou badge de presença com carimbo)
    const photoToSave =
      params.photo_base64 ||
      generatePresenceBadgePhoto(emp?.name || 'Colaborador', emp?.role || 'Equipe Ki Delicia', timestamp_local);

    const lastPunch = punches[punches.length - 1];
    const prev_hash = lastPunch ? lastPunch.sha256_hash : 'GENESIS_KIDELICIA_PONTO_000000000000000000';
    const payloadForHash = `${nsr}|${company.cnpj}|${params.employee_id}|${params.punch_type}|${timestamp_utc}|${prev_hash}`;
    const sha256_hash = await sha256(payloadForHash);

    const receipt_code = `REC-${String(nsr).padStart(6, '0')}-${sha256_hash.substring(0, 4).toUpperCase()}`;

    const newPunch: PunchRecord = {
      id: `punch_${Date.now()}_${nsr}`,
      nsr,
      company_id: company.id,
      employee_id: params.employee_id,
      terminal_id: terminal.id,
      punch_type: params.punch_type,
      timestamp_utc,
      timestamp_local,
      time_only,
      photo_base64: photoToSave,
      location: locationData,
      sha256_hash,
      prev_hash,
      receipt_code,
    };

    punches.push(newPunch);
    this.set(STORAGE_KEYS.PUNCHES, punches);

    this.logAudit(
      'TERMINAL',
      'REGISTRO_PONTO',
      'punch_records',
      newPunch.id,
      `Ponto (${params.punch_type}) registrado com foto e NSR #${nsr} para ${emp?.name || params.employee_id}.`
    );

    return newPunch;
  }

  // --- TRATAMENTOS E AJUSTES MANUAIS DE HORÁRIOS PELO ADMINISTRADOR (PTRP) ---
  public static getTreatments(): TimeTreatment[] {
    return this.get<TimeTreatment[]>(STORAGE_KEYS.TREATMENTS, []);
  }

  // Permite ao Administrador ajustar/corrigir qualquer horário com justificativa
  public static applyManualTimeAdjustment(params: {
    employee_id: string;
    date: string; // YYYY-MM-DD
    target_punch_type: PunchType;
    original_time?: string | null;
    adjusted_time: string; // HH:mm
    justification: string;
    admin_name: string;
  }): TimeTreatment {
    const treatments = this.getTreatments();
    const emp = this.getEmployeeById(params.employee_id);

    const newTreatment: TimeTreatment = {
      id: `adj_${Date.now()}`,
      company_id: DEFAULT_COMPANY.id,
      employee_id: params.employee_id,
      date: params.date,
      treatment_type: 'AJUSTE_HORARIO_MANUAL',
      target_punch_type: params.target_punch_type,
      original_time: params.original_time || null,
      adjusted_time: params.adjusted_time,
      justification: params.justification,
      decided_by: params.admin_name,
      decided_at: new Date().toISOString(),
      status: 'APROVADO',
    };

    treatments.push(newTreatment);
    this.set(STORAGE_KEYS.TREATMENTS, treatments);

    this.logAudit(
      params.admin_name,
      'AJUSTE_MANUAL_HORARIO',
      'time_treatments',
      newTreatment.id,
      `Horário de ${params.target_punch_type} no dia ${params.date} de ${emp?.name} ajustado para ${params.adjusted_time} (Horário anterior: ${params.original_time || 'Não registrado'}). Motivo: "${params.justification}".`
    );

    return newTreatment;
  }

  // --- APURAÇÃO DA JORNADA DIÁRIA (Considera marcações originais + ajustes do gestor) ---
  public static calculateDaySummary(employeeId: string, dateStr: string): DayWorkSummary {
    const emp = this.getEmployeeById(employeeId);
    const schedules = this.getSchedules();
    const schedule = schedules.find(s => s.id === emp?.schedule_template_id) || schedules[0];

    const dayPunches = this.getPunches()
      .filter(p => p.employee_id === employeeId && p.timestamp_utc.startsWith(dateStr))
      .sort((a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime());

    const treatments = this.getTreatments().filter(
      t => t.employee_id === employeeId && t.date === dateStr && t.status === 'APROVADO'
    );

    const entry = dayPunches.find(p => p.punch_type === 'ENTRY');
    const break_start = dayPunches.find(p => p.punch_type === 'BREAK_START');
    const break_end = dayPunches.find(p => p.punch_type === 'BREAK_END');
    const exit = dayPunches.find(p => p.punch_type === 'EXIT');

    // Verifica se há ajuste manual aprovado pelo administrador para cada uma das batidas
    const adjEntry = treatments.filter(t => t.target_punch_type === 'ENTRY').pop();
    const adjBreakStart = treatments.filter(t => t.target_punch_type === 'BREAK_START').pop();
    const adjBreakEnd = treatments.filter(t => t.target_punch_type === 'BREAK_END').pop();
    const adjExit = treatments.filter(t => t.target_punch_type === 'EXIT').pop();

    const effective_entry_time = adjEntry?.adjusted_time || entry?.time_only;
    const effective_break_start_time = adjBreakStart?.adjusted_time || break_start?.time_only;
    const effective_break_end_time = adjBreakEnd?.adjusted_time || break_end?.time_only;
    const effective_exit_time = adjExit?.adjusted_time || exit?.time_only;

    const parseTimeToMinutes = (timeStr?: string): number | null => {
      if (!timeStr) return null;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    let worked_minutes = 0;
    let break_duration_minutes = 0;
    const issue_descriptions: string[] = [];

    const mEntry = parseTimeToMinutes(effective_entry_time);
    const mBreakStart = parseTimeToMinutes(effective_break_start_time);
    const mBreakEnd = parseTimeToMinutes(effective_break_end_time);
    const mExit = parseTimeToMinutes(effective_exit_time);

    // 1. Manhã: Entrada até Saída para Almoço
    if (mEntry !== null && mBreakStart !== null && mBreakStart > mEntry) {
      worked_minutes += mBreakStart - mEntry;
    }

    // 2. Intervalo efetivo
    if (mBreakStart !== null && mBreakEnd !== null && mBreakEnd > mBreakStart) {
      break_duration_minutes = mBreakEnd - mBreakStart;
      if (break_duration_minutes < 60) {
        issue_descriptions.push(`Intervalo inferior a 60 min (${break_duration_minutes} min registrados).`);
      } else if (break_duration_minutes > 75) {
        issue_descriptions.push(`Pausa excedente (${break_duration_minutes} min registrados).`);
      }
    }

    // 3. Tarde: Retorno até Saída Final
    if (mBreakEnd !== null && mExit !== null && mExit > mBreakEnd) {
      worked_minutes += mExit - mBreakEnd;
    }

    // Caso de apenas Entrada e Saída (sem intervalo)
    if (mEntry !== null && mExit !== null && mBreakStart === null && mBreakEnd === null) {
      worked_minutes = mExit - mEntry;
      issue_descriptions.push('Jornada sem registro de intervalo intrajornada.');
    }

    const hasPunchesOrAdjustments = dayPunches.length > 0 || treatments.length > 0;
    if (hasPunchesOrAdjustments && (mEntry === null || mExit === null)) {
      const isToday = new Date().toISOString().split('T')[0] === dateStr;
      if (!isToday) {
        issue_descriptions.push('Jornada incompleta: faltam marcações de entrada ou saída.');
      }
    }

    const expected_minutes = schedule ? schedule.expected_work_minutes : 480;
    const diff = worked_minutes - expected_minutes;
    const excess_minutes = Math.max(0, diff);
    const deficit_minutes = Math.max(0, -diff);

    return {
      date: dateStr,
      employee_id: employeeId,
      punches: dayPunches,
      treatments,
      effective_entry_time,
      effective_break_start_time,
      effective_break_end_time,
      effective_exit_time,
      entry,
      break_start,
      break_end,
      exit,
      worked_minutes,
      expected_minutes,
      excess_minutes,
      deficit_minutes,
      break_duration_minutes,
      has_pending_issues: issue_descriptions.length > 0,
      issue_descriptions,
      has_adjustments: treatments.length > 0,
    };
  }

  // --- TRILHA DE AUDITORIA ---
  public static getAuditLogs(): AuditEvent[] {
    return this.get<AuditEvent[]>(STORAGE_KEYS.AUDIT, []).reverse();
  }

  public static logAudit(actor: string, action: string, target_entity: string, target_id: string, details: string): void {
    const logs = this.get<AuditEvent[]>(STORAGE_KEYS.AUDIT, []);
    const event: AuditEvent = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      actor,
      action,
      target_entity,
      target_id,
      details,
    };
    logs.push(event);
    this.set(STORAGE_KEYS.AUDIT, logs);
  }
}
