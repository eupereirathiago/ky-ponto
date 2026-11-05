import React, { useState, useMemo } from 'react';
import { PontoStore } from '../../lib/storage';
import {
  Employee,
  PunchRecord,
  Company,
  WorkLocation,
  TimeTreatment,
  AuditEvent,
  DayWorkSummary,
  PunchType,
  EmailDispatchLog,
} from '../../types';
import { KyLogo } from '../../components/KyLogo';
import {
  isValidCPF,
  formatCPF,
  formatCNPJ,
  minutesToHHMM,
} from '../../lib/crypto';
import {
  Users,
  CalendarCheck,
  FileSpreadsheet,
  Settings,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Printer,
  Download,
  Plus,
  KeyRound,
  ShieldAlert,
  ArrowLeft,
  Coffee,
  LogIn,
  LogOut,
  RotateCcw,
  Search,
  Building,
  MapPin,
  Camera,
  Mail,
  Send,
  Eye,
  X,
  Edit3,
  Phone,
  Check,
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToTerminal: () => void;
}

type TabType = 'overview' | 'employees' | 'timecard' | 'reports' | 'settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToTerminal }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [employees, setEmployees] = useState<Employee[]>(() => PontoStore.getEmployees());
  const [company, setCompany] = useState<Company>(() => PontoStore.getCompany());
  const [location, setLocation] = useState<WorkLocation>(() => PontoStore.getLocation());
  const [punches, setPunches] = useState<PunchRecord[]>(() => PontoStore.getPunches());
  const [treatments, setTreatments] = useState<TimeTreatment[]>(() => PontoStore.getTreatments());
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>(() => PontoStore.getAuditLogs());
  const [sentEmails, setSentEmails] = useState<EmailDispatchLog[]>(() => PontoStore.getSentEmails());

  // Colaboradores
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
  const [initialPinInput, setInitialPinInput] = useState('123456');
  const [employeeFormError, setEmployeeFormError] = useState<string | null>(null);

  // Redefinição e Envio de PIN por E-mail
  const [pinResetModalEmp, setPinResetModalEmp] = useState<Employee | null>(null);
  const [newPinInput, setNewPinInput] = useState('');
  const [emailModalPreview, setEmailModalPreview] = useState<{ emailBody: string; recipient: string } | null>(null);
  const [pinNotification, setPinNotification] = useState<string | null>(null);

  // Espelho de Ponto / Timecard
  const [selectedEmpIdForTimecard, setSelectedEmpIdForTimecard] = useState<string>(
    () => employees[0]?.id || ''
  );

  // Ajuste Manual de Horário
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustTargetDate, setAdjustTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [adjustPunchType, setAdjustPunchType] = useState<PunchType>('ENTRY');
  const [adjustCurrentTime, setAdjustCurrentTime] = useState<string>('');
  const [adjustNewTime, setAdjustNewTime] = useState<string>('08:00');
  const [adjustJustification, setAdjustJustification] = useState<string>('');
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Visualizador de Foto da Batida
  const [photoViewerPunch, setPhotoViewerPunch] = useState<PunchRecord | null>(null);

  // Relatórios
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const refreshAll = () => {
    setEmployees(PontoStore.getEmployees());
    setPunches(PontoStore.getPunches());
    setTreatments(PontoStore.getTreatments());
    setAuditLogs(PontoStore.getAuditLogs());
    setSentEmails(PontoStore.getSentEmails());
    setCompany(PontoStore.getCompany());
    setLocation(PontoStore.getLocation());
  };

  // --- PRESENÇA AO VIVO HOJE ---
  const todayStr = new Date().toISOString().split('T')[0];
  const liveStatusList = useMemo(() => {
    return employees.map(emp => {
      const summary = PontoStore.calculateDaySummary(emp.id, todayStr);
      const empTodayPunches = punches
        .filter(p => p.employee_id === emp.id && p.timestamp_utc.startsWith(todayStr))
        .sort((a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime());

      let statusText = 'Não iniciou jornada';
      let statusColor = 'text-gray-400 bg-gray-100';

      if (summary.effective_entry_time && !summary.effective_break_start_time) {
        statusText = 'Em atividade (Trabalhando)';
        statusColor = 'text-[#3E9B5F] bg-[#3E9B5F]/10 border-[#3E9B5F]/20';
      } else if (summary.effective_break_start_time && !summary.effective_break_end_time) {
        statusText = 'Em intervalo de refeição';
        statusColor = 'text-[#FFA600] bg-[#FFA600]/10 border-[#FFA600]/20';
      } else if (summary.effective_break_end_time && !summary.effective_exit_time) {
        statusText = 'Retornou da pausa (Trabalhando)';
        statusColor = 'text-[#3E9B5F] bg-[#3E9B5F]/10 border-[#3E9B5F]/20';
      } else if (summary.effective_exit_time) {
        statusText = 'Jornada encerrada';
        statusColor = 'text-[#D8483B] bg-[#D8483B]/10 border-[#D8483B]/20';
      }

      return {
        employee: emp,
        punches: empTodayPunches,
        summary,
        statusText,
        statusColor,
      };
    });
  }, [employees, punches, treatments, todayStr]);

  // --- ESPELHO DE PONTO DO COLABORADOR SELECIONADO ---
  const selectedEmployee = useMemo(
    () => employees.find(e => e.id === selectedEmpIdForTimecard),
    [employees, selectedEmpIdForTimecard]
  );

  const timecardDays: DayWorkSummary[] = useMemo(() => {
    if (!selectedEmployee) return [];
    const days: DayWorkSummary[] = [];

    // Gerar os últimos 7 dias até hoje para visualização
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      days.push(PontoStore.calculateDaySummary(selectedEmployee.id, dStr));
    }
    return days;
  }, [selectedEmployee, punches, treatments]);

  // --- SALVAR NOVO COLABORADOR COM ENVIO DE PIN POR E-MAIL ---
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmployeeFormError(null);

    if (!editingEmployee?.name || !editingEmployee?.cpf || !editingEmployee?.email) {
      setEmployeeFormError('Por favor preencha nome, CPF e e-mail.');
      return;
    }

    if (!isValidCPF(editingEmployee.cpf)) {
      setEmployeeFormError('CPF inválido. Verifique os dígitos e o dígito verificador.');
      return;
    }

    const result = await PontoStore.saveEmployee(
      {
        id: editingEmployee.id,
        name: editingEmployee.name,
        cpf: editingEmployee.cpf,
        email: editingEmployee.email,
        registration_number: editingEmployee.registration_number,
        role: editingEmployee.role,
        department: editingEmployee.department,
        admission_date: editingEmployee.admission_date,
        status: editingEmployee.status || 'ACTIVE',
        schedule_template_id: editingEmployee.schedule_template_id || 'sch_comercial_8h',
      },
      initialPinInput
    );

    setIsEmployeeModalOpen(false);
    setEditingEmployee(null);

    if (result.emailBody) {
      setEmailModalPreview({
        emailBody: result.emailBody,
        recipient: result.employee.email,
      });
    }

    refreshAll();
  };

  // --- REDEFINIR PIN E DISPARAR E-MAIL ---
  const handleConfirmPinResetAndEmail = async () => {
    if (!pinResetModalEmp) return;
    if (newPinInput.length !== 6 || !/^\d{6}$/.test(newPinInput)) {
      setEmployeeFormError('O PIN deve conter exatamente 6 números.');
      return;
    }

    const res = await PontoStore.resetEmployeePin(pinResetModalEmp.id, newPinInput, 'Gestor Ki Delícia');
    if (res.success && res.emailBody) {
      setEmailModalPreview({
        emailBody: res.emailBody,
        recipient: pinResetModalEmp.email,
      });
      setPinResetModalEmp(null);
      setNewPinInput('');
      refreshAll();
    }
  };

  // --- AJUSTE MANUAL DE HORÁRIOS (ALTERAÇÃO MANUAL COM HORA ORIGINAL E NOVA HORA) ---
  const openAdjustmentModal = (dateStr: string, punchType: PunchType, currentTimeRecorded?: string) => {
    setAdjustTargetDate(dateStr);
    setAdjustPunchType(punchType);
    setAdjustCurrentTime(currentTimeRecorded || 'Não registrado');
    setAdjustNewTime(currentTimeRecorded || (punchType === 'ENTRY' ? '08:00' : punchType === 'BREAK_START' ? '12:00' : punchType === 'BREAK_END' ? '13:00' : '17:00'));
    setAdjustJustification('');
    setAdjustError(null);
    setIsAdjustmentModalOpen(true);
  };

  const handleSaveTimeAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);

    if (!adjustNewTime) {
      setAdjustError('Informe o novo horário.');
      return;
    }

    if (!adjustJustification.trim() || adjustJustification.length < 5) {
      setAdjustError('A justificativa da alteração manual é obrigatória por lei e deve ser detalhada.');
      return;
    }

    PontoStore.applyManualTimeAdjustment({
      employee_id: selectedEmpIdForTimecard,
      date: adjustTargetDate,
      target_punch_type: adjustPunchType,
      original_time: adjustCurrentTime === 'Não registrado' ? null : adjustCurrentTime,
      adjusted_time: adjustNewTime,
      justification: adjustJustification,
      admin_name: 'Gestor Administrativo Ki Delícia',
    });

    setIsAdjustmentModalOpen(false);
    refreshAll();
  };

  // --- EXPORTAR CSV RELATÓRIO CONSOLIDADO ---
  const handleExportCSV = () => {
    let csv = 'Colaborador;CPF;Matricula;Data;Entrada;Pausa_Inicio;Pausa_Fim;Saida;Horas_Trabalhadas;Saldo;Status_Ajuste\n';

    employees.forEach(emp => {
      const summary = PontoStore.calculateDaySummary(emp.id, reportEndDate);
      const ent = summary.effective_entry_time || '--:--';
      const bst = summary.effective_break_start_time || '--:--';
      const ben = summary.effective_break_end_time || '--:--';
      const ext = summary.effective_exit_time || '--:--';
      const worked = minutesToHHMM(summary.worked_minutes);
      const balance = minutesToHHMM(summary.excess_minutes - summary.deficit_minutes);
      const adjStatus = summary.has_adjustments ? 'Contem Ajuste Manual do Gestor' : 'Original Sem Ajustes';

      csv += `"${emp.name}";"${formatCPF(emp.cpf)}";"${emp.registration_number}";"${reportEndDate}";"${ent}";"${bst}";"${ben}";"${ext}";"${worked}";"${balance}";"${adjStatus}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kidelicia_folha_ponto_${reportEndDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getPunchTypeTitle = (type: PunchType): string => {
    switch (type) {
      case 'ENTRY':
        return '1ª Entrada';
      case 'BREAK_START':
        return '1ª Saída (Pausa Intervalo)';
      case 'BREAK_END':
        return '2ª Entrada (Retorno do Intervalo)';
      case 'EXIT':
        return '2ª Saída (Saída Final)';
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF7E8] text-[#2B0F0F] flex flex-col">
      {/* Barra de Navegação Superior do Painel do Administrador */}
      <header className="bg-white border-b border-[#2B0F0F]/15 sticky top-0 z-30 px-4 md:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToTerminal}
              className="flex items-center gap-1.5 text-xs font-bold text-[#2B0F0F] bg-[#FFF7E8] hover:bg-[#FFA600] border border-[#2B0F0F]/15 py-1.5 px-3 rounded-xl transition-all cursor-pointer"
            >
              <ArrowLeft size={14} /> Voltar ao Terminal
            </button>
            <div className="h-5 w-px bg-gray-200 hidden sm:block" />
            <KyLogo size={36} subtitle="Painel do Gestor (PTRP)" />
          </div>

          {/* Abas do Painel */}
          <nav className="flex items-center gap-1 bg-[#FFF7E8] p-1 rounded-2xl border border-[#2B0F0F]/10 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#2B0F0F] text-[#FFF7E8] shadow-xs'
                  : 'text-[#7A655C] hover:text-[#2B0F0F]'
              }`}
            >
              <Clock size={14} /> Presença Hoje
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'employees'
                  ? 'bg-[#2B0F0F] text-[#FFF7E8] shadow-xs'
                  : 'text-[#7A655C] hover:text-[#2B0F0F]'
              }`}
            >
              <Users size={14} /> Colaboradores
            </button>
            <button
              onClick={() => setActiveTab('timecard')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'timecard'
                  ? 'bg-[#2B0F0F] text-[#FFF7E8] shadow-xs'
                  : 'text-[#7A655C] hover:text-[#2B0F0F]'
              }`}
            >
              <CalendarCheck size={14} /> Espelho & Ajuste de Horas
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-[#2B0F0F] text-[#FFF7E8] shadow-xs'
                  : 'text-[#7A655C] hover:text-[#2B0F0F]'
              }`}
            >
              <FileSpreadsheet size={14} /> Relatórios & E-mails
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#2B0F0F] text-[#FFF7E8] shadow-xs'
                  : 'text-[#7A655C] hover:text-[#2B0F0F]'
              }`}
            >
              <Settings size={14} /> Dados da Empresa
            </button>
          </nav>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto w-full p-4 md:p-8 flex-1">
        {/* ABA 1: VISÃO GERAL / PRESENÇA AO VIVO & FOTOS DAS BATIDAS */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Banner Institucional da Empresa Oficial */}
            <div className="bg-white p-5 rounded-3xl border border-[#2B0F0F]/15 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-[#FFA600] uppercase tracking-wider">
                  Empregador Ativo
                </span>
                <h2 className="font-heading font-extrabold text-2xl text-[#2B0F0F]">
                  {company.corporate_name} ({company.trade_name})
                </h2>
                <p className="text-xs text-[#7A655C]">
                  CNPJ: <b>{formatCNPJ(company.cnpj)}</b> · {company.address}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#3E9B5F]/15 text-[#3E9B5F] text-xs font-bold border border-[#3E9B5F]/20">
                  REP-P Conforme Portaria 671/2021
                </span>
              </div>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-[#2B0F0F]/15 shadow-2xs">
                <span className="text-xs font-bold text-[#7A655C] uppercase block mb-1">
                  Trabalhando Agora
                </span>
                <div className="font-heading font-extrabold text-3xl text-[#3E9B5F]">
                  {liveStatusList.filter(l => l.statusText.includes('Trabalhando')).length}
                </div>
                <span className="text-xs text-gray-500">De {employees.length} ativos na escala</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#2B0F0F]/15 shadow-2xs">
                <span className="text-xs font-bold text-[#7A655C] uppercase block mb-1">
                  Em Intervalo (Almoço)
                </span>
                <div className="font-heading font-extrabold text-3xl text-[#FFA600]">
                  {liveStatusList.filter(l => l.statusText.includes('intervalo')).length}
                </div>
                <span className="text-xs text-gray-500">Pausa intrajornada (60 min)</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#2B0F0F]/15 shadow-2xs">
                <span className="text-xs font-bold text-[#7A655C] uppercase block mb-1">
                  Marcações Hoje (com Foto)
                </span>
                <div className="font-heading font-extrabold text-3xl text-[#2B0F0F] tabular-nums">
                  {punches.filter(p => p.timestamp_utc.startsWith(todayStr)).length}
                </div>
                <span className="text-xs text-gray-500">Com comprovação de selfie/foto</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#2B0F0F]/15 shadow-2xs">
                <span className="text-xs font-bold text-[#7A655C] uppercase block mb-1">
                  Jornadas Concluídas
                </span>
                <div className="font-heading font-extrabold text-3xl text-[#D8483B]">
                  {liveStatusList.filter(l => l.statusText.includes('encerrada')).length}
                </div>
                <span className="text-xs text-gray-500">4 batidas registradas</span>
              </div>
            </div>

            {/* Tabela de Presença ao Vivo com Botão de Ver Foto */}
            <div className="bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-2xs p-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 flex-wrap gap-2">
                <div>
                  <h3 className="font-heading font-extrabold text-xl text-[#2B0F0F]">
                    Presença e Evidências Fotográficas de Hoje
                  </h3>
                  <p className="text-xs text-[#7A655C]">
                    Clique em qualquer foto para visualizar a comprovação com selo, hora e geolocalização
                  </p>
                </div>
                <button
                  onClick={refreshAll}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#2B0F0F] bg-[#FFF7E8] hover:bg-[#FFA600] px-3 py-1.5 rounded-xl border border-[#2B0F0F]/15 cursor-pointer"
                >
                  <RotateCcw size={13} /> Atualizar Lista
                </button>
              </div>

              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-[#7A655C] font-bold">
                      <th className="py-3 px-3">Colaborador</th>
                      <th className="py-3 px-3">Status Hoje</th>
                      <th className="py-3 px-3">Entrada (Foto)</th>
                      <th className="py-3 px-3">Saída Intervalo</th>
                      <th className="py-3 px-3">Retorno Intervalo</th>
                      <th className="py-3 px-3">Saída Final</th>
                      <th className="py-3 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {liveStatusList.map(item => {
                      const ent = item.punches.find(p => p.punch_type === 'ENTRY');
                      const bst = item.punches.find(p => p.punch_type === 'BREAK_START');
                      const ben = item.punches.find(p => p.punch_type === 'BREAK_END');
                      const ext = item.punches.find(p => p.punch_type === 'EXIT');

                      return (
                        <tr key={item.employee.id} className="hover:bg-[#FFF7E8]/40 transition-colors">
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-[#2B0F0F] text-sm">{item.employee.name}</div>
                            <div className="text-[11px] text-gray-400">
                              Matrícula: {item.employee.registration_number} · {item.employee.role}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${item.statusColor}`}
                            >
                              {item.statusText}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            {ent ? (
                              <button
                                onClick={() => setPhotoViewerPunch(ent)}
                                className="inline-flex items-center gap-1.5 py-1 px-2 rounded-lg bg-gray-50 hover:bg-[#FFF7E8] border border-gray-200 font-mono font-bold text-gray-800 transition-colors cursor-pointer"
                                title="Ver foto de comprovação"
                              >
                                <Camera size={13} className="text-[#3E9B5F]" />
                                {ent.time_only}
                              </button>
                            ) : (
                              <span className="text-gray-400 font-mono">--:--</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            {bst ? (
                              <button
                                onClick={() => setPhotoViewerPunch(bst)}
                                className="inline-flex items-center gap-1.5 py-1 px-2 rounded-lg bg-gray-50 hover:bg-[#FFF7E8] border border-gray-200 font-mono font-bold text-gray-800 transition-colors cursor-pointer"
                              >
                                <Camera size={13} className="text-[#FFA600]" />
                                {bst.time_only}
                              </button>
                            ) : (
                              <span className="text-gray-400 font-mono">--:--</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            {ben ? (
                              <button
                                onClick={() => setPhotoViewerPunch(ben)}
                                className="inline-flex items-center gap-1.5 py-1 px-2 rounded-lg bg-gray-50 hover:bg-[#FFF7E8] border border-gray-200 font-mono font-bold text-gray-800 transition-colors cursor-pointer"
                              >
                                <Camera size={13} className="text-[#3E9B5F]" />
                                {ben.time_only}
                              </button>
                            ) : (
                              <span className="text-gray-400 font-mono">--:--</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            {ext ? (
                              <button
                                onClick={() => setPhotoViewerPunch(ext)}
                                className="inline-flex items-center gap-1.5 py-1 px-2 rounded-lg bg-gray-50 hover:bg-[#FFF7E8] border border-gray-200 font-mono font-bold text-gray-800 transition-colors cursor-pointer"
                              >
                                <Camera size={13} className="text-[#D8483B]" />
                                {ext.time_only}
                              </button>
                            ) : (
                              <span className="text-gray-400 font-mono">--:--</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedEmpIdForTimecard(item.employee.id);
                                setActiveTab('timecard');
                              }}
                              className="text-xs font-bold text-[#FFA600] hover:text-[#2B0F0F] underline cursor-pointer"
                            >
                              Ver Espelho / Ajustar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: COLABORADORES & ENVIO DE PIN POR E-MAIL */}
        {activeTab === 'employees' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-2xs p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="font-heading font-extrabold text-2xl text-[#2B0F0F]">
                    Colaboradores da Ki Delícia
                  </h3>
                  <p className="text-xs text-[#7A655C]">
                    Cada colaborador possui um PIN exclusivo, <b>pessoal e intransferível</b>, enviado para seu e-mail individual
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nome ou CPF..."
                      value={employeeSearch}
                      onChange={e => setEmployeeSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs w-52 focus:outline-none focus:border-[#FFA600]"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setEditingEmployee({
                        name: '',
                        cpf: '',
                        email: '',
                        registration_number: `KD-00${employees.length + 1}`,
                        role: 'Atendente',
                        department: 'Balcão',
                        admission_date: new Date().toISOString().split('T')[0],
                        status: 'ACTIVE',
                        schedule_template_id: 'sch_comercial_8h',
                      });
                      setInitialPinInput(Math.floor(100000 + Math.random() * 900000).toString());
                      setIsEmployeeModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-[#FFA600] hover:bg-[#e09200] font-heading font-extrabold text-xs text-[#2B0F0F] shadow-2xs cursor-pointer"
                  >
                    <Plus size={15} /> Cadastrar & Enviar PIN
                  </button>
                </div>
              </div>

              {/* Tabela de Colaboradores */}
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-[#7A655C] font-bold">
                      <th className="py-3 px-3">Colaborador</th>
                      <th className="py-3 px-3">CPF</th>
                      <th className="py-3 px-3">Matrícula</th>
                      <th className="py-3 px-3">Cargo / Setor</th>
                      <th className="py-3 px-3">E-mail Cadastrado</th>
                      <th className="py-3 px-3 text-right">Ações de Segurança</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employees
                      .filter(
                        e =>
                          e.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                          e.cpf.includes(employeeSearch.replace(/\D/g, ''))
                      )
                      .map(emp => (
                        <tr key={emp.id} className="hover:bg-[#FFF7E8]/40 transition-colors">
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-[#2B0F0F] text-sm">{emp.name}</div>
                            <span className="text-[10px] text-gray-400">Admissão: {new Date(emp.admission_date).toLocaleDateString('pt-BR')}</span>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-semibold">{formatCPF(emp.cpf)}</td>
                          <td className="py-3.5 px-3 font-mono text-gray-700">{emp.registration_number}</td>
                          <td className="py-3.5 px-3">
                            <span className="font-semibold text-gray-800">{emp.role}</span>
                            <div className="text-[10px] text-gray-400">{emp.department}</div>
                          </td>
                          <td className="py-3.5 px-3 text-gray-600 font-medium">
                            <div className="flex items-center gap-1.5">
                              <Mail size={13} className="text-[#FFA600]" />
                              {emp.email}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right space-x-2">
                            <button
                              onClick={() => {
                                setPinResetModalEmp(emp);
                                setNewPinInput(Math.floor(100000 + Math.random() * 900000).toString());
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FFA600] hover:bg-[#e09200] text-[11px] font-bold text-[#2B0F0F] transition-colors cursor-pointer shadow-2xs"
                              title="Redefinir PIN e enviar por e-mail"
                            >
                              <Send size={12} /> Redefinir & Enviar PIN
                            </button>
                            <button
                              onClick={() => {
                                setEditingEmployee(emp);
                                setIsEmployeeModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: ESPELHO DE PONTO & AJUSTE MANUAL DE HORÁRIOS PELO ADMINISTRADOR */}
        {activeTab === 'timecard' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-2xs p-6">
              {/* Seletor do Colaborador */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#7A655C] uppercase block mb-1">
                      Selecione o Colaborador para Espelho de Ponto:
                    </label>
                    <select
                      value={selectedEmpIdForTimecard}
                      onChange={e => setSelectedEmpIdForTimecard(e.target.value)}
                      className="py-1.5 px-3 rounded-xl border border-gray-300 text-xs font-bold text-[#2B0F0F] bg-white focus:outline-none focus:border-[#FFA600]"
                    >
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.registration_number}) - {e.role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer"
                  >
                    <Printer size={14} /> Imprimir Espelho Oficial
                  </button>
                </div>
              </div>

              {/* Informações do Colaborador e Escala */}
              {selectedEmployee && (
                <div className="my-4 p-4 rounded-2xl bg-[#FFF7E8]/60 border border-[#2B0F0F]/10 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px]">COLABORADOR</span>
                    <span className="font-bold text-[#2B0F0F] text-sm">{selectedEmployee.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">CPF / MATRÍCULA</span>
                    <span className="font-semibold text-gray-700">
                      {formatCPF(selectedEmployee.cpf)} · {selectedEmployee.registration_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">ESTABELECIMENTO</span>
                    <span className="font-semibold text-gray-700">
                      {company.trade_name} (Quintino Cunha)
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">REGRA DE INTERVALO</span>
                    <span className="font-semibold text-[#FFA600]">
                      1 hora planejada (Art. 71 CLT)
                    </span>
                  </div>
                </div>
              )}

              {/* Grade de Ponto com Edição / Ajuste Manual de Horários */}
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-[#7A655C] font-bold">
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">1ª Entrada</th>
                      <th className="py-2.5 px-3">1ª Saída (Pausa)</th>
                      <th className="py-2.5 px-3">2ª Entrada (Retorno)</th>
                      <th className="py-2.5 px-3">2ª Saída Final</th>
                      <th className="py-2.5 px-3">Duração Pausa</th>
                      <th className="py-2.5 px-3">Trabalhado</th>
                      <th className="py-2.5 px-3">Saldo</th>
                      <th className="py-2.5 px-3">Status de Ajuste / Tratamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {timecardDays.map(day => {
                      const balance = day.excess_minutes - day.deficit_minutes;

                      return (
                        <tr key={day.date} className="hover:bg-[#FFF7E8]/40 transition-colors">
                          <td className="py-3 px-3 font-semibold text-[#2B0F0F]">
                            {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                              weekday: 'short',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </td>

                          {/* 1ª Entrada */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-sm">
                                {day.effective_entry_time || '--:--'}
                              </span>
                              <button
                                onClick={() => openAdjustmentModal(day.date, 'ENTRY', day.effective_entry_time)}
                                className="p-1 rounded-md text-gray-400 hover:text-[#FFA600] hover:bg-[#FFF7E8] transition-colors cursor-pointer"
                                title="Editar horário de entrada"
                              >
                                <Edit3 size={13} />
                              </button>
                            </div>
                          </td>

                          {/* 1ª Saída (Intervalo) */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-sm">
                                {day.effective_break_start_time || '--:--'}
                              </span>
                              <button
                                onClick={() => openAdjustmentModal(day.date, 'BREAK_START', day.effective_break_start_time)}
                                className="p-1 rounded-md text-gray-400 hover:text-[#FFA600] hover:bg-[#FFF7E8] transition-colors cursor-pointer"
                                title="Editar horário de saída para intervalo"
                              >
                                <Edit3 size={13} />
                              </button>
                            </div>
                          </td>

                          {/* 2ª Entrada (Retorno) */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-sm">
                                {day.effective_break_end_time || '--:--'}
                              </span>
                              <button
                                onClick={() => openAdjustmentModal(day.date, 'BREAK_END', day.effective_break_end_time)}
                                className="p-1 rounded-md text-gray-400 hover:text-[#FFA600] hover:bg-[#FFF7E8] transition-colors cursor-pointer"
                                title="Editar horário de retorno do intervalo"
                              >
                                <Edit3 size={13} />
                              </button>
                            </div>
                          </td>

                          {/* 2ª Saída Final */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-sm">
                                {day.effective_exit_time || '--:--'}
                              </span>
                              <button
                                onClick={() => openAdjustmentModal(day.date, 'EXIT', day.effective_exit_time)}
                                className="p-1 rounded-md text-gray-400 hover:text-[#FFA600] hover:bg-[#FFF7E8] transition-colors cursor-pointer"
                                title="Editar horário de saída final"
                              >
                                <Edit3 size={13} />
                              </button>
                            </div>
                          </td>

                          {/* Duração Pausa */}
                          <td className="py-3 px-3">
                            {day.break_duration_minutes > 0 ? (
                              <span
                                className={`font-mono font-semibold ${
                                  day.break_duration_minutes < 60 ? 'text-[#FFA600]' : 'text-gray-700'
                                }`}
                              >
                                {day.break_duration_minutes} min
                              </span>
                            ) : (
                              <span className="text-gray-400">--</span>
                            )}
                          </td>

                          {/* Trabalhado */}
                          <td className="py-3 px-3 font-mono font-bold text-[#2B0F0F]">
                            {minutesToHHMM(day.worked_minutes)}
                          </td>

                          {/* Saldo */}
                          <td className="py-3 px-3 font-mono font-bold">
                            {balance > 0 ? (
                              <span className="text-[#3E9B5F]">+{minutesToHHMM(balance)}</span>
                            ) : balance < 0 ? (
                              <span className="text-[#D8483B]">{minutesToHHMM(balance)}</span>
                            ) : (
                              <span className="text-gray-400">00:00</span>
                            )}
                          </td>

                          {/* Status de Ajustes e Ocorrências */}
                          <td className="py-3 px-3">
                            {day.treatments.map(t => (
                              <div
                                key={t.id}
                                className="text-[11px] text-[#3E9B5F] font-bold flex items-center gap-1 mb-1"
                              >
                                <CheckCircle2 size={12} />
                                <span>
                                  Ajustado ({t.target_punch_type}): {t.adjusted_time} (Orig: {t.original_time || 'N/A'}) - "{t.justification}"
                                </span>
                              </div>
                            ))}
                            {day.has_pending_issues && (
                              <div className="space-y-0.5">
                                {day.issue_descriptions.map((desc, idx) => (
                                  <div
                                    key={idx}
                                    className="text-[10px] text-[#FFA600] font-semibold flex items-center gap-1"
                                  >
                                    <AlertTriangle size={11} /> {desc}
                                  </div>
                                ))}
                              </div>
                            )}
                            {!day.has_pending_issues && day.treatments.length === 0 && day.punches.length === 4 && (
                              <span className="text-[11px] text-gray-400">Regular</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Princípio de Auditoria Legal */}
              <div className="mt-6 p-4 rounded-2xl bg-[#FFF7E8] border border-[#2B0F0F]/15 text-xs text-[#7A655C] flex items-start gap-3">
                <ShieldAlert size={20} className="text-[#FFA600] shrink-0 mt-0.5" />
                <div>
                  <b className="text-[#2B0F0F] block">Garantia Regulamentar de Auditoria e Edição</b>
                  Você pode editar qualquer horário registrado em caso de esquecimento ou divergência. Conforme a Portaria 671/2021, o sistema grava o horário original que você quis consertar, o novo horário ajustado e a justificativa fundamentada, mantendo o histórico 100% auditável.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 4: RELATÓRIOS & HISTÓRICO DE E-MAILS DE PIN */}
        {activeTab === 'reports' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-2xs p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="font-heading font-extrabold text-2xl text-[#2B0F0F]">
                    Relatórios Gerenciais da Folha & Comunicação
                  </h3>
                  <p className="text-xs text-[#7A655C]">
                    Exportação da folha para CSV e histórico de e-mails com PIN enviados à equipe
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-[#3E9B5F] hover:bg-[#348350] font-heading font-extrabold text-xs text-white shadow-2xs cursor-pointer"
                  >
                    <Download size={15} /> Exportar CSV da Folha
                  </button>
                </div>
              </div>

              {/* Central de E-mails e Notificações (Resend / Edge Function) */}
              <div className="mt-6 p-5 rounded-2xl bg-[#FFF7E8]/60 border border-[#2B0F0F]/15">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2B0F0F]/10">
                  <div>
                    <h4 className="font-heading font-extrabold text-base text-[#2B0F0F] flex items-center gap-2">
                      <Mail size={16} className="text-[#FFA600]" /> Disparos de PIN via Supabase Edge Function (Resend)
                    </h4>
                    <p className="text-xs text-[#7A655C]">
                      Envio de credenciais direto para a caixa de entrada dos colaboradores com aviso de código pessoal e intransferível
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const testPin = Math.floor(100000 + Math.random() * 900000).toString();
                      const res = PontoStore.dispatchPinEmail(
                        {
                          id: 'emp_admin_test',
                          company_id: company.id,
                          name: 'Gestor (Teste de Produção)',
                          cpf: '00000000000',
                          email: company.email,
                          registration_number: 'TESTE-01',
                          role: 'Administração',
                          department: 'RH',
                          admission_date: new Date().toISOString().split('T')[0],
                          status: 'ACTIVE',
                          schedule_template_id: 'sch_comercial_8h',
                          pin_hash: '',
                          pin_salt: '',
                          pin_failed_attempts: 0,
                          pin_locked_until: null,
                        },
                        testPin,
                        false,
                        'Teste do Sistema'
                      );
                      setEmailModalPreview({
                        emailBody: res.emailBody,
                        recipient: company.email,
                      });
                      refreshAll();
                    }}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#FFA600] hover:bg-[#e09200] text-xs font-bold text-[#2B0F0F] shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Send size={13} /> Testar Disparo de E-mail
                  </button>
                </div>

                <div className="my-3 flex items-center gap-2 text-xs text-[#3E9B5F] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3E9B5F] animate-pulse" />
                  Edge Function `send-email-pin` configurada para produção (Chave segura no servidor)
                </div>

                {/* Tabela de Histórico de E-mails */}
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white mt-3">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FFF7E8]/80 text-[#7A655C] font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Data/Hora</th>
                        <th className="py-2.5 px-3">Colaborador</th>
                        <th className="py-2.5 px-3">E-mail Destino</th>
                        <th className="py-2.5 px-3">Tipo de Notificação</th>
                        <th className="py-2.5 px-3">Status de Envio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sentEmails.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-gray-400">
                            Nenhum e-mail de PIN disparado nesta sessão ainda.
                          </td>
                        </tr>
                      ) : (
                        sentEmails.map(mail => (
                          <tr key={mail.id} className="hover:bg-gray-50">
                            <td className="py-2.5 px-3 font-mono text-gray-500">
                              {new Date(mail.sent_at).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-[#2B0F0F]">{mail.employee_name}</td>
                            <td className="py-2.5 px-3 font-mono text-gray-700">{mail.recipient_email}</td>
                            <td className="py-2.5 px-3 font-semibold text-[#FFA600]">{mail.type}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3E9B5F]/15 text-[#3E9B5F]">
                                ✓ Disparado com Sucesso
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 5: DADOS OFICIAIS DA EMPRESA (SEM NENHUMA EXPOSIÇÃO DE BANCO OU DADOS SENSÍVEIS) */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Informações Oficiais do Empregador extraídas do Cartão CNPJ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-2xs p-6">
                <div className="flex items-center gap-2 mb-4 font-heading font-extrabold text-lg text-[#2B0F0F]">
                  <Building size={18} className="text-[#FFA600]" /> Cadastro Oficial do Empregador
                </div>
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px] font-bold">NOME EMPRESARIAL (RAZÃO SOCIAL)</span>
                    <span className="font-extrabold text-gray-900 text-sm">{company.corporate_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] font-bold">TÍTULO DO ESTABELECIMENTO (NOME FANTASIA)</span>
                    <span className="font-bold text-[#FFA600] text-sm">{company.trade_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] font-bold">CNPJ (RECEITA FEDERAL)</span>
                    <span className="font-mono font-bold text-gray-900 text-sm">{formatCNPJ(company.cnpj)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] font-bold">ENDEREÇO DA MATRIZ</span>
                    <span className="font-semibold text-gray-800">{company.address}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                    <div>
                      <span className="text-gray-400 block text-[10px] font-bold">E-MAIL INSTITUCIONAL</span>
                      <span className="font-mono font-semibold text-gray-800">{company.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] font-bold">TELEFONE DE CONTATO</span>
                      <span className="font-semibold text-gray-800">{company.phone}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] font-bold">FUSO HORÁRIO OFICIAL</span>
                    <span className="font-semibold text-[#3E9B5F]">{company.timezone} (UTC-03)</span>
                  </div>
                </div>
              </div>

              {/* Local de Trabalho Autorizado (Geofence) */}
              <div className="bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-2xs p-6">
                <div className="flex items-center gap-2 mb-4 font-heading font-extrabold text-lg text-[#2B0F0F]">
                  <MapPin size={18} className="text-[#3E9B5F]" /> Estabelecimento e Raio de Ponto
                </div>
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px] font-bold">LOCAL AUTORIZADO</span>
                    <span className="font-bold text-gray-900">{location.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] font-bold">LOGRADOURO</span>
                    <span className="text-gray-700">{location.address}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-400 block text-[10px] font-bold">LATITUDE</span>
                      <span className="font-mono text-gray-800">{location.latitude}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] font-bold">LONGITUDE</span>
                      <span className="font-mono text-gray-800">{location.longitude}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] font-bold">RAIO DE TOLERÂNCIA DE PONTO</span>
                    <span className="font-extrabold text-[#3E9B5F] text-sm">{location.radius_meters} metros</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FFF7E8] border border-[#2B0F0F]/10 text-[11px] text-[#7A655C]">
                    ✓ Conforme a Portaria 671/2021, batidas fora do raio são registradas normalmente com alerta circunstanciado para análise da gerência, sem bloquear o direito de ponto do colaborador.
                  </div>
                </div>
              </div>
            </div>

            {/* Trilha de Auditoria Limpa e Segura */}
            <div className="bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-2xs p-6">
              <h4 className="font-heading font-extrabold text-lg text-[#2B0F0F] mb-3">
                Trilha de Auditoria do Sistema (Audit Trail)
              </h4>
              <p className="text-xs text-[#7A655C] mb-3">
                Registros de operações administrativas sem exibição de senhas, chaves ou dados sensíveis
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
                {auditLogs.map(log => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-[#FFF7E8]/40 border border-[#2B0F0F]/10 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-[#2B0F0F] flex items-center gap-2">
                        <span>{log.action}</span>
                        <span className="text-[10px] text-gray-500 font-normal">por {log.actor}</span>
                      </div>
                      <div className="text-gray-600 text-[11px] mt-0.5">{log.details}</div>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE EDIÇÃO / AJUSTE MANUAL DE HORÁRIO (Com hora original e nova hora) */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-2xl p-6 text-[#2B0F0F] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-heading font-extrabold text-xl flex items-center gap-2">
                <Edit3 size={18} className="text-[#FFA600]" /> Ajuste Manual de Horário
              </h3>
              <button
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#7A655C] my-3">
              Colaborador: <b>{selectedEmployee?.name}</b> · Data: <b>{adjustTargetDate}</b>
            </p>

            {adjustError && (
              <div className="mb-3 py-2 px-3 rounded-xl bg-[#D8483B]/10 border border-[#D8483B]/20 text-[#D8483B] text-xs font-bold">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleSaveTimeAdjustment} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-[#7A655C] block mb-1">Qual marcação você deseja consertar?</label>
                <select
                  value={adjustPunchType}
                  onChange={e => setAdjustPunchType(e.target.value as PunchType)}
                  className="w-full py-2 px-3 rounded-xl border border-gray-300 font-bold text-gray-800 focus:outline-none focus:border-[#FFA600]"
                >
                  <option value="ENTRY">1ª Entrada</option>
                  <option value="BREAK_START">1ª Saída (Pausa Intervalo)</option>
                  <option value="BREAK_END">2ª Entrada (Retorno do Intervalo)</option>
                  <option value="EXIT">2ª Saída Final</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-[#FFF7E8]/70 border border-[#2B0F0F]/10">
                <div>
                  <span className="text-gray-500 block text-[10px] font-bold">HORA ATUAL REGISTRADA:</span>
                  <span className="font-mono font-bold text-gray-700 text-sm">
                    {adjustCurrentTime || 'Sem marcação'}
                  </span>
                </div>
                <div>
                  <label className="text-[#2B0F0F] block text-[10px] font-bold">NOVA HORA CORRIGIDA:</label>
                  <input
                    type="time"
                    required
                    value={adjustNewTime}
                    onChange={e => setAdjustNewTime(e.target.value)}
                    className="w-full py-1 px-2 rounded-lg border border-gray-300 font-mono font-extrabold text-[#2B0F0F] text-base focus:outline-none focus:border-[#FFA600]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#7A655C] block mb-1">
                  Justificativa da Alteração Manual (Obrigatória por lei):
                </label>
                <textarea
                  required
                  rows={3}
                  value={adjustJustification}
                  onChange={e => setAdjustJustification(e.target.value)}
                  placeholder="Ex: Colaborador esqueceu de registrar o ponto ao retornar do almoço; horário confirmado pela gerência da loja."
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-medium focus:outline-none focus:border-[#FFA600]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  className="py-2 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold text-gray-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl bg-[#FFA600] hover:bg-[#e09200] font-heading font-extrabold text-[#2B0F0F] cursor-pointer"
                >
                  Confirmar Correção de Horário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DE FOTO DA BATIDA */}
      {photoViewerPunch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-2xl p-6 text-[#2B0F0F] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-heading font-extrabold text-lg flex items-center gap-2">
                <Camera size={18} className="text-[#3E9B5F]" /> Foto de Comprovação de Ponto
              </h3>
              <button
                onClick={() => setPhotoViewerPunch(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-4 flex flex-col items-center">
              <div className="w-64 h-64 rounded-2xl overflow-hidden border-2 border-[#2B0F0F]/20 shadow-inner bg-gray-100 flex items-center justify-center">
                {photoViewerPunch.photo_base64 ? (
                  <img
                    src={photoViewerPunch.photo_base64}
                    alt="Foto da batida de ponto"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-gray-400">Foto indisponível</span>
                )}
              </div>

              {/* Dados da Foto */}
              <div className="w-full mt-3 p-3 rounded-2xl bg-[#FFF7E8] border border-[#2B0F0F]/10 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">EVENTO:</span>
                  <span className="font-bold text-[#2B0F0F]">{photoViewerPunch.punch_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">DATA/HORA:</span>
                  <span className="font-semibold text-gray-800">{photoViewerPunch.timestamp_local}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">NSR SEQUENCIAL:</span>
                  <span className="font-mono font-bold text-[#FFA600]">#{photoViewerPunch.nsr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">LOCALIZAÇÃO:</span>
                  <span className="font-semibold text-[#3E9B5F]">
                    {photoViewerPunch.location?.is_within_radius ? 'No local autorizado' : 'Raio verificado'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setPhotoViewerPunch(null)}
              className="w-full py-2.5 rounded-xl bg-[#2B0F0F] text-[#FFF7E8] font-bold text-xs"
            >
              Fechar Visualização
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO DE COLABORADOR COM ENVIO DE PIN POR E-MAIL */}
      {isEmployeeModalOpen && editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-2xl p-6 text-[#2B0F0F] animate-in zoom-in-95 duration-150">
            <h3 className="font-heading font-extrabold text-xl mb-1">
              {editingEmployee.id ? 'Editar Colaborador' : 'Cadastrar Colaborador & Enviar PIN'}
            </h3>
            <p className="text-xs text-[#7A655C] mb-4">
              O PIN será enviado para o e-mail informado com aviso de ser <b>pessoal e intransferível</b>.
            </p>

            {employeeFormError && (
              <div className="mb-4 py-2 px-3 rounded-xl bg-[#D8483B]/10 border border-[#D8483B]/20 text-[#D8483B] text-xs font-bold">
                {employeeFormError}
              </div>
            )}

            <form onSubmit={handleSaveEmployee} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#7A655C] block mb-1">Nome Completo:</label>
                <input
                  type="text"
                  required
                  value={editingEmployee.name || ''}
                  onChange={e => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl border border-gray-300 font-semibold focus:outline-none focus:border-[#FFA600]"
                  placeholder="Ex: Francisca Maria Maciel"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#7A655C] block mb-1">CPF (com validação):</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.cpf ? formatCPF(editingEmployee.cpf) : ''}
                    onChange={e =>
                      setEditingEmployee({
                        ...editingEmployee,
                        cpf: e.target.value.replace(/\D/g, '').slice(0, 11),
                      })
                    }
                    className="w-full py-2 px-3 rounded-xl border border-gray-300 font-mono font-semibold focus:outline-none focus:border-[#FFA600]"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#7A655C] block mb-1">Matrícula Interna:</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.registration_number || ''}
                    onChange={e =>
                      setEditingEmployee({ ...editingEmployee, registration_number: e.target.value })
                    }
                    className="w-full py-2 px-3 rounded-xl border border-gray-300 font-mono font-semibold focus:outline-none focus:border-[#FFA600]"
                    placeholder="KD-001"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#7A655C] block mb-1">
                  E-mail do Colaborador (onde receberá o PIN):
                </label>
                <input
                  type="email"
                  required
                  value={editingEmployee.email || ''}
                  onChange={e => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl border border-gray-300 font-semibold focus:outline-none focus:border-[#FFA600]"
                  placeholder="colaborador@kidelicia.com.br"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#7A655C] block mb-1">Cargo:</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.role || ''}
                    onChange={e => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                    className="w-full py-2 px-3 rounded-xl border border-gray-300 font-semibold focus:outline-none focus:border-[#FFA600]"
                    placeholder="Confeiteiro, Padeiro..."
                  />
                </div>
                <div>
                  <label className="font-bold text-[#7A655C] block mb-1">Setor:</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.department || ''}
                    onChange={e =>
                      setEditingEmployee({ ...editingEmployee, department: e.target.value })
                    }
                    className="w-full py-2 px-3 rounded-xl border border-gray-300 font-semibold focus:outline-none focus:border-[#FFA600]"
                    placeholder="Produção, Balcão..."
                  />
                </div>
              </div>

              {!editingEmployee.id && (
                <div className="p-3 rounded-2xl bg-[#FFF7E8] border border-[#2B0F0F]/10">
                  <label className="font-bold text-[#2B0F0F] block mb-1">
                    PIN Inicial de 6 Dígitos (Enviado para o e-mail):
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={initialPinInput}
                    onChange={e => setInitialPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full py-2 px-3 rounded-xl border border-gray-300 font-mono font-bold text-base text-center tracking-widest focus:outline-none focus:border-[#FFA600]"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="py-2 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold text-gray-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl bg-[#FFA600] hover:bg-[#e09200] font-heading font-extrabold text-[#2B0F0F] cursor-pointer flex items-center gap-1.5"
                >
                  <Send size={14} /> Salvar & Enviar PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE REDEFINIÇÃO DE PIN COM ENVIO DE E-MAIL */}
      {pinResetModalEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-2xl p-6 text-[#2B0F0F] animate-in zoom-in-95 duration-150">
            <h3 className="font-heading font-extrabold text-xl mb-1 flex items-center gap-2">
              <KeyRound size={20} className="text-[#FFA600]" /> Redefinir & Enviar PIN
            </h3>
            <p className="text-xs text-[#7A655C] mb-4">
              Colaborador: <b>{pinResetModalEmp.name}</b>
              <br />
              Destino: <b>{pinResetModalEmp.email}</b>
            </p>

            <div className="space-y-4">
              <div>
                <label className="font-bold text-[#7A655C] block mb-1 text-xs">Novo PIN de 6 dígitos:</label>
                <input
                  type="text"
                  maxLength={6}
                  value={newPinInput}
                  onChange={e => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full py-2.5 px-3 text-center tracking-widest text-lg font-mono rounded-xl border border-gray-300 font-bold focus:outline-none focus:border-[#FFA600]"
                  placeholder="••••••"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPinResetModalEmp(null)}
                  className="py-2 px-3.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPinResetAndEmail}
                  className="py-2 px-4 rounded-xl bg-[#FFA600] hover:bg-[#e09200] font-heading font-extrabold text-xs text-[#2B0F0F] cursor-pointer flex items-center gap-1.5"
                >
                  <Send size={14} /> Disparar para E-mail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE E-MAIL ENVIADO */}
      {emailModalPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-2xl p-6 text-[#2B0F0F] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-heading font-extrabold text-lg flex items-center gap-2 text-[#3E9B5F]">
                <CheckCircle2 size={20} /> E-mail Disparado com Sucesso!
              </h3>
              <button
                onClick={() => setEmailModalPreview(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#7A655C] my-3">
              O PIN foi enviado para <b>{emailModalPreview.recipient}</b> com orientações expressas de segurança:
            </p>

            <div className="bg-[#FFF7E8] p-3.5 rounded-2xl border border-[#2B0F0F]/10 font-mono text-[11px] whitespace-pre-wrap text-gray-800 max-h-56 overflow-y-auto">
              {emailModalPreview.emailBody}
            </div>

            <button
              onClick={() => setEmailModalPreview(null)}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#2B0F0F] text-[#FFF7E8] font-bold text-xs"
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
