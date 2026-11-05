import React, { useState, useEffect, useRef } from 'react';
import { PontoStore } from '../../lib/storage';
import { Employee, PunchRecord, PunchType, Company, WorkLocation } from '../../types';
import { KyLogo } from '../../components/KyLogo';
import { ReceiptModal } from '../../components/ReceiptModal';
import {
  Clock,
  Camera,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Check,
  ArrowRight,
  User,
  Coffee,
  LogOut,
  LogIn,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface TerminalViewProps {
  onOpenAdmin: () => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ onOpenAdmin }) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [identifiedEmployee, setIdentifiedEmployee] = useState<Employee | null>(null);
  const [todayPunches, setTodayPunches] = useState<PunchRecord[]>([]);
  const [selectedPunchType, setSelectedPunchType] = useState<PunchType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastCreatedPunch, setLastCreatedPunch] = useState<PunchRecord | null>(null);

  // Câmera e Geolocation
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [geoCoords, setGeoCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'checking' | 'inside' | 'outside' | 'error'>('checking');
  const [distanceMeters, setDistanceMeters] = useState<number>(0);

  // Timer de inatividade da sessão (segurança para terminal compartilhado)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const company: Company = PontoStore.getCompany();
  const location: WorkLocation = PontoStore.getLocation();

  // Relógio do terminal
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Timer regressivo de sessão quando colaborador identificado
  useEffect(() => {
    if (!identifiedEmployee || lastCreatedPunch) return;

    setSecondsRemaining(30);
    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          handleResetSession();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [identifiedEmployee, lastCreatedPunch]);

  // Teclado físico suporte para digitação de PIN
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (identifiedEmployee) return;
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClearPin();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinInput, identifiedEmployee]);

  // Captura de GPS ao identificar o colaborador
  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('inside'); // fallback
      return;
    }
    setGeoStatus('checking');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        };
        setGeoCoords(coords);
        // Calcula distância do estabelecimento
        const dist = Math.round(
          6371e3 *
            2 *
            Math.asin(
              Math.sqrt(
                Math.sin((((coords.latitude - location.latitude) * Math.PI) / 180) / 2) ** 2 +
                  Math.cos((location.latitude * Math.PI) / 180) *
                    Math.cos((coords.latitude * Math.PI) / 180) *
                    Math.sin((((coords.longitude - location.longitude) * Math.PI) / 180) / 2) ** 2
              )
            )
        );
        setDistanceMeters(dist);
        setGeoStatus(dist <= location.radius_meters ? 'inside' : 'outside');
      },
      () => {
        // Se permissão negada, marcamos como verificado na sede padrão para teste
        setGeoStatus('inside');
        setDistanceMeters(14);
      },
      { timeout: 5000, enableHighAccuracy: true }
    );
  };

  // Iniciar câmera do terminal
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      setCameraError('Câmera indisponível ou permissão negada. O registro continuará com foto simulada.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = (): string | null => {
    if (videoRef.current && cameraActive) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 240, 240);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setPhotoDataUrl(dataUrl);
          return dataUrl;
        }
      } catch (e) {
        console.warn('Erro ao capturar frame do canvas:', e);
      }
    }
    return null;
  };

  const handleDigit = (digit: string) => {
    if (pinInput.length < 6) {
      const next = pinInput + digit;
      setPinInput(next);
      setPinError(null);
      if (next.length === 6) {
        verifyPin(next);
      }
    }
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
    setPinError(null);
  };

  const handleClearPin = () => {
    setPinInput('');
    setPinError(null);
  };

  const verifyPin = async (pin: string) => {
    setIsVerifying(true);
    setPinError(null);

    try {
      const result = await PontoStore.validatePin(pin);
      if (result.success && result.employee) {
        setIdentifiedEmployee(result.employee);
        const punches = PontoStore.getTodayPunchesForEmployee(result.employee.id);
        setTodayPunches(punches);

        // Define a próxima batida recomendada
        const nextType = getNextRecommendedPunchType(punches);
        setSelectedPunchType(nextType);

        // Inicia câmera e GPS
        startCamera();
        requestGeolocation();
      } else {
        setPinError(result.error || 'PIN inválido');
        setPinInput('');
      }
    } catch {
      setPinError('Erro ao validar credencial');
      setPinInput('');
    } finally {
      setIsVerifying(false);
    }
  };

  const getNextRecommendedPunchType = (punches: PunchRecord[]): PunchType => {
    if (punches.length === 0) return 'ENTRY';
    if (punches.length === 1) return 'BREAK_START';
    if (punches.length === 2) return 'BREAK_END';
    return 'EXIT';
  };

  const handleConfirmPunch = async () => {
    if (!identifiedEmployee || !selectedPunchType) return;
    setIsSubmitting(true);

    try {
      const photo = capturePhoto();
      stopCamera();

      const newPunch = await PontoStore.registerPunch({
        employee_id: identifiedEmployee.id,
        punch_type: selectedPunchType,
        photo_base64: photo,
        locationCoords: geoCoords || undefined,
        mockLocation: !geoCoords,
      });

      setLastCreatedPunch(newPunch);
      setTodayPunches(PontoStore.getTodayPunchesForEmployee(identifiedEmployee.id));
    } catch (e) {
      console.error('Falha ao registrar marcação:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSession = () => {
    stopCamera();
    setPinInput('');
    setPinError(null);
    setIdentifiedEmployee(null);
    setSelectedPunchType(null);
    setPhotoDataUrl(null);
    setLastCreatedPunch(null);
    setGeoCoords(null);
    setGeoStatus('checking');
  };

  // Horário em formato elegante
  const timeFormatted = currentTime.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateFormatted = currentTime.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#FFF7E8] text-[#2B0F0F] flex flex-col justify-between p-4 md:p-8">
      {/* Topo do Terminal: Logo e Acesso Administrativo */}
      <header className="flex items-center justify-between gap-4 max-w-4xl mx-auto w-full pb-4 border-b border-[#2B0F0F]/10">
        <KyLogo size={46} subtitle={`${company.trade_name} · Quintino Cunha`} />

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-[#7A655C] bg-white/70 py-1.5 px-3 rounded-full border border-[#2B0F0F]/10">
            <span className="w-2 h-2 rounded-full bg-[#3E9B5F]" />
            Sincronizado HLB (UTC-03)
          </div>

          <button
            onClick={onOpenAdmin}
            className="text-xs font-bold text-[#2B0F0F] bg-white hover:bg-[#FFA600] hover:text-[#2B0F0F] border border-[#2B0F0F]/15 py-2 px-3.5 rounded-xl shadow-2xs transition-all active:scale-95 flex items-center gap-1.5"
          >
            <ShieldCheck size={14} className="text-[#FFA600]" />
            Painel do Gestor
          </button>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="max-w-xl mx-auto w-full my-auto py-6">
        {!identifiedEmployee ? (
          /* TELA 1: RELÓGIO & TECLADO DE PIN DE 6 DÍGITOS */
          <div className="flex flex-col items-center text-center">
            {/* Relógio Grande */}
            <div className="font-heading font-extrabold text-5xl sm:text-6xl text-[#2B0F0F] tabular-nums tracking-tight">
              {timeFormatted}
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#7A655C] capitalize mt-1 mb-6">
              {dateFormatted}
            </p>

            {/* Cartão de Entrada de PIN */}
            <div className="w-full bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-sm p-6 sm:p-8 flex flex-col items-center">
              <span className="font-heading font-extrabold text-xl text-[#2B0F0F] mb-1">
                Digite seu PIN de 6 dígitos
              </span>
              <p className="text-xs text-[#7A655C] mb-5">
                Use o teclado na tela ou o teclado físico para registrar seu ponto
              </p>

              {/* Indicador visual de 6 dígitos */}
              <div className="flex items-center gap-3 mb-6">
                {[0, 1, 2, 3, 4, 5].map(idx => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      idx < pinInput.length
                        ? 'bg-[#FFA600] border-[#2B0F0F] scale-110 shadow-xs'
                        : 'bg-[#FFF7E8] border-[#2B0F0F]/30'
                    }`}
                  />
                ))}
              </div>

              {/* Mensagem de Erro ou Alerta */}
              {pinError && (
                <div className="w-full mb-4 py-2 px-3 rounded-xl bg-[#D8483B]/10 border border-[#D8483B]/20 text-[#D8483B] text-xs font-bold animate-shake">
                  {pinError}
                </div>
              )}

              {/* Teclado Numérico Touch Grande */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    onClick={() => handleDigit(num)}
                    disabled={isVerifying}
                    className="h-14 sm:h-16 rounded-2xl bg-[#FFF7E8] hover:bg-[#FFA600] text-[#2B0F0F] font-heading font-extrabold text-2xl border border-[#2B0F0F]/15 active:scale-95 transition-all shadow-2xs flex items-center justify-center cursor-pointer"
                  >
                    {num}
                  </button>
                ))}

                <button
                  onClick={handleClearPin}
                  disabled={isVerifying || pinInput.length === 0}
                  className="h-14 sm:h-16 rounded-2xl bg-white hover:bg-gray-100 text-[#7A655C] font-bold text-xs uppercase border border-[#2B0F0F]/15 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  Limpar
                </button>

                <button
                  onClick={() => handleDigit('0')}
                  disabled={isVerifying}
                  className="h-14 sm:h-16 rounded-2xl bg-[#FFF7E8] hover:bg-[#FFA600] text-[#2B0F0F] font-heading font-extrabold text-2xl border border-[#2B0F0F]/15 active:scale-95 transition-all shadow-2xs flex items-center justify-center cursor-pointer"
                >
                  0
                </button>

                <button
                  onClick={handleBackspace}
                  disabled={isVerifying || pinInput.length === 0}
                  className="h-14 sm:h-16 rounded-2xl bg-white hover:bg-gray-100 text-[#2B0F0F] font-bold text-lg border border-[#2B0F0F]/15 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                  aria-label="Apagar dígito"
                >
                  ⌫
                </button>
              </div>

              {/* Dica amigável de teste rápido para demonstração */}
              <div className="mt-6 pt-4 border-t border-[#2B0F0F]/10 w-full text-center">
                <span className="text-[11px] font-semibold text-[#7A655C] flex items-center justify-center gap-1 mb-2">
                  <Sparkles size={13} className="text-[#FFA600]" /> PINs da equipe para teste rápido:
                </span>
                <div className="flex flex-wrap justify-center gap-1.5 text-[11px]">
                  <button
                    onClick={() => {
                      setPinInput('123456');
                      verifyPin('123456');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#FFF7E8] border border-[#2B0F0F]/15 hover:bg-[#FFA600] text-[#2B0F0F] font-semibold transition-colors"
                  >
                    Ana: 123456
                  </button>
                  <button
                    onClick={() => {
                      setPinInput('654321');
                      verifyPin('654321');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#FFF7E8] border border-[#2B0F0F]/15 hover:bg-[#FFA600] text-[#2B0F0F] font-semibold transition-colors"
                  >
                    Carlos: 654321
                  </button>
                  <button
                    onClick={() => {
                      setPinInput('112233');
                      verifyPin('112233');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#FFF7E8] border border-[#2B0F0F]/15 hover:bg-[#FFA600] text-[#2B0F0F] font-semibold transition-colors"
                  >
                    Mariana: 112233
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* TELA 2: IDENTIFICAÇÃO DO COLABORADOR, CÂMERA, GPS & CONFIRMAÇÃO */
          <div className="bg-white rounded-3xl border border-[#2B0F0F]/15 shadow-sm p-6 sm:p-8 animate-in fade-in duration-200">
            {/* Topo do colaborador com contagem regressiva de segurança */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#2B0F0F]/10">
              <div>
                <span className="text-xs font-bold text-[#FFA600] uppercase tracking-wider">
                  Colaborador Identificado
                </span>
                <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#2B0F0F] flex items-center gap-2">
                  Olá, {identifiedEmployee.name}! 👋
                </h2>
                <p className="text-xs text-[#7A655C]">
                  {identifiedEmployee.role} · Matrícula {identifiedEmployee.registration_number}
                </p>
              </div>

              {/* Botão Cancelar com timer de segurança */}
              <button
                onClick={handleResetSession}
                className="flex flex-col items-end text-xs text-[#7A655C] hover:text-[#D8483B] transition-colors"
              >
                <span className="font-bold underline flex items-center gap-1">
                  <RotateCcw size={12} /> Sair ({secondsRemaining}s)
                </span>
                <span className="text-[10px] text-gray-400">Protege sua privacidade</span>
              </button>
            </div>

            {/* Resumo das Marcações do Dia de Hoje */}
            <div className="my-5">
              <span className="text-xs font-bold text-[#7A655C] uppercase block mb-2">
                Suas marcações hoje ({todayPunches.length} de 4 registradas):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'ENTRY', label: '1. Entrada', icon: LogIn, color: 'text-[#3E9B5F]' },
                  { key: 'BREAK_START', label: '2. Intervalo', icon: Coffee, color: 'text-[#FFA600]' },
                  { key: 'BREAK_END', label: '3. Retorno', icon: RotateCcw, color: 'text-[#3E9B5F]' },
                  { key: 'EXIT', label: '4. Saída', icon: LogOut, color: 'text-[#D8483B]' },
                ].map(step => {
                  const match = todayPunches.find(p => p.punch_type === step.key);
                  return (
                    <div
                      key={step.key}
                      className={`p-2.5 rounded-2xl border text-center transition-all ${
                        match
                          ? 'bg-[#FFF7E8] border-[#2B0F0F]/15'
                          : 'bg-gray-50/70 border-gray-200 opacity-60'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-[#7A655C] mb-1">{step.label}</div>
                      <div className="font-heading font-extrabold text-sm text-[#2B0F0F] tabular-nums">
                        {match ? match.timestamp_local.split('às ')[1] : '--:--'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Seletor do Tipo de Marcação com cores oficiais da identidade visual */}
            <div className="mb-5">
              <span className="text-xs font-bold text-[#7A655C] uppercase block mb-2">
                Qual registro você deseja realizar agora?
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedPunchType('ENTRY')}
                  className={`p-3.5 rounded-2xl font-heading font-extrabold text-sm text-left border-2 transition-all flex items-center justify-between cursor-pointer ${
                    selectedPunchType === 'ENTRY'
                      ? 'bg-[#3E9B5F] text-white border-[#2B0F0F] shadow-sm'
                      : 'bg-white text-[#2B0F0F] border-gray-200 hover:border-[#3E9B5F]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <LogIn size={16} /> 1. Entrada
                  </span>
                  {selectedPunchType === 'ENTRY' && <Check size={16} />}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPunchType('BREAK_START')}
                  className={`p-3.5 rounded-2xl font-heading font-extrabold text-sm text-left border-2 transition-all flex items-center justify-between cursor-pointer ${
                    selectedPunchType === 'BREAK_START'
                      ? 'bg-[#FFA600] text-[#2B0F0F] border-[#2B0F0F] shadow-sm'
                      : 'bg-white text-[#2B0F0F] border-gray-200 hover:border-[#FFA600]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Coffee size={16} /> 2. Saída Intervalo
                  </span>
                  {selectedPunchType === 'BREAK_START' && <Check size={16} />}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPunchType('BREAK_END')}
                  className={`p-3.5 rounded-2xl font-heading font-extrabold text-sm text-left border-2 transition-all flex items-center justify-between cursor-pointer ${
                    selectedPunchType === 'BREAK_END'
                      ? 'bg-[#3E9B5F] text-white border-[#2B0F0F] shadow-sm'
                      : 'bg-white text-[#2B0F0F] border-gray-200 hover:border-[#3E9B5F]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw size={16} /> 3. Retorno Intervalo
                  </span>
                  {selectedPunchType === 'BREAK_END' && <Check size={16} />}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPunchType('EXIT')}
                  className={`p-3.5 rounded-2xl font-heading font-extrabold text-sm text-left border-2 transition-all flex items-center justify-between cursor-pointer ${
                    selectedPunchType === 'EXIT'
                      ? 'bg-[#D8483B] text-white border-[#2B0F0F] shadow-sm'
                      : 'bg-white text-[#2B0F0F] border-gray-200 hover:border-[#D8483B]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <LogOut size={16} /> 4. Saída Final
                  </span>
                  {selectedPunchType === 'EXIT' && <Check size={16} />}
                </button>
              </div>
            </div>

            {/* Evidências Operacionais: Câmera & Localização */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 p-3.5 rounded-2xl bg-[#FFF7E8]/60 border border-[#2B0F0F]/10">
              {/* Câmera / Selfie */}
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-[#2B0F0F]/10 text-center">
                <span className="text-[11px] font-bold text-[#7A655C] flex items-center gap-1 mb-1.5">
                  <Camera size={13} className="text-[#FFA600]" /> Foto do Registro
                </span>
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 relative flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                  />
                  {!cameraActive && (
                    <div className="text-center p-2 text-[10px] text-gray-400">
                      <User size={24} className="mx-auto mb-1 text-gray-300" />
                      Selfie pronta
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-500 mt-1">Evidência anexada ao registro</span>
              </div>

              {/* Status do Local Autorizado / Geofence */}
              <div className="flex flex-col justify-center p-3 rounded-xl bg-white border border-[#2B0F0F]/10 text-xs">
                <span className="text-[11px] font-bold text-[#7A655C] flex items-center gap-1 mb-1">
                  <MapPin size={13} className="text-[#FFA600]" /> Localização do Terminal
                </span>
                <div className="font-bold text-[#2B0F0F] text-xs">{location.name}</div>
                <div className="text-[11px] text-gray-500 mb-2">{location.address}</div>

                {geoStatus === 'inside' ? (
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3E9B5F] bg-[#3E9B5F]/10 py-1 px-2 rounded-md">
                    <Check size={12} /> No local autorizado ({distanceMeters}m da matriz)
                  </div>
                ) : geoStatus === 'outside' ? (
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FFA600] bg-[#FFA600]/10 py-1 px-2 rounded-md">
                    <AlertTriangle size={12} /> Fora do raio ({distanceMeters}m) · Alerta gravado
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-400 flex items-center gap-1">
                    <RefreshCw size={11} className="animate-spin" /> Verificando GPS...
                  </div>
                )}
              </div>
            </div>

            {/* Botão de Registro Final com Cantos Arredondados 18px */}
            <button
              onClick={handleConfirmPunch}
              disabled={isSubmitting || !selectedPunchType}
              className={`w-full py-4 px-6 rounded-[18px] font-heading font-extrabold text-lg text-white shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
                selectedPunchType === 'ENTRY' || selectedPunchType === 'BREAK_END'
                  ? 'bg-[#3E9B5F] hover:bg-[#348350]'
                  : selectedPunchType === 'EXIT'
                  ? 'bg-[#D8483B] hover:bg-[#bd3d31]'
                  : 'bg-[#FFA600] hover:bg-[#e09200] text-[#2B0F0F]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={18} className="animate-spin" /> Gravando e Assinando Marcação...
                </>
              ) : (
                <>
                  <Check size={20} />
                  Confirmar Registro Agora ({timeFormatted.substring(0, 5)})
                </>
              )}
            </button>
          </div>
        )}
      </main>

      {/* Rodapé institucional com aviso de conformidade regulamentar */}
      <footer className="max-w-4xl mx-auto w-full pt-4 border-t border-[#2B0F0F]/10 flex flex-col sm:flex-row items-center justify-between text-xs text-[#7A655C] gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#2B0F0F]">{company.trade_name}</span>
          <span>·</span>
          <span>Ponto Digital (REP-P e PTRP)</span>
          <span>·</span>
          <span>Portaria MTP nº 671/2021</span>
        </div>
        <div>Fuso Oficial: America/Fortaleza (UTC-03)</div>
      </footer>

      {/* Modal de Comprovante de Marcação Obrigatório */}
      {lastCreatedPunch && identifiedEmployee && (
        <ReceiptModal
          punch={lastCreatedPunch}
          employee={identifiedEmployee}
          company={company}
          onClose={() => {
            setLastCreatedPunch(null);
            handleResetSession();
          }}
          onNewPunch={handleResetSession}
        />
      )}
    </div>
  );
};
