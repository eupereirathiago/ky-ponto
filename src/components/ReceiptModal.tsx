import React, { useState } from 'react';
import { PunchRecord, Employee, Company } from '../types';
import { formatCPF, formatCNPJ } from '../lib/crypto';
import { PontoStore } from '../lib/storage';
import { Printer, Download, Clock, CheckCircle2, ShieldCheck, X, FileText, ChevronRight } from 'lucide-react';
import { KyLogo } from './KyLogo';

interface ReceiptModalProps {
  punch: PunchRecord;
  employee: Employee;
  company: Company;
  onClose: () => void;
  onNewPunch: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  punch,
  employee,
  company,
  onClose,
  onNewPunch,
}) => {
  const [showHistory48h, setShowHistory48h] = useState(false);
  const recentReceipts = PontoStore.getRecentReceipts(employee.id, 48);

  const getPunchTypeLabel = (type: string) => {
    switch (type) {
      case 'ENTRY':
        return { label: 'ENTRADA', color: 'text-[#3E9B5F] bg-[#3E9B5F]/10 border-[#3E9B5F]/20' };
      case 'BREAK_START':
        return { label: 'SAÍDA PARA INTERVALO', color: 'text-[#FFA600] bg-[#FFA600]/10 border-[#FFA600]/20' };
      case 'BREAK_END':
        return { label: 'RETORNO DO INTERVALO', color: 'text-[#3E9B5F] bg-[#3E9B5F]/10 border-[#3E9B5F]/20' };
      case 'EXIT':
        return { label: 'SAÍDA FINAL', color: 'text-[#D8483B] bg-[#D8483B]/10 border-[#D8483B]/20' };
      default:
        return { label: type, color: 'text-[#2B0F0F] bg-gray-100 border-gray-200' };
    }
  };

  const currentBadge = getPunchTypeLabel(punch.punch_type);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadText = () => {
    const textContent = `
============================================================
      COMPROVANTE DE REGISTRO DE PONTO ELETRÔNICO
      (Portaria MTP nº 671/2021 - REP-P)
============================================================
EMPREGADOR: ${company.corporate_name}
CNPJ: ${formatCNPJ(company.cnpj)}
ENDEREÇO: ${company.address}
REP-P: ${company.rep_p_identifier} (v${company.software_version})
------------------------------------------------------------
COLABORADOR: ${employee.name}
CPF: ${formatCPF(employee.cpf)}
MATRÍCULA: ${employee.registration_number}
CARGO: ${employee.role}
------------------------------------------------------------
NSR (NÚMERO SEQUENCIAL REGISTRADO): ${String(punch.nsr).padStart(9, '0')}
DATA/HORA DA MARCAÇÃO: ${punch.timestamp_local}
HORÁRIO UTC CONFIÁVEL: ${punch.timestamp_utc}
TIPO DE EVENTO: ${currentBadge.label}
CÓDIGO DE AUTENTICIDADE: ${punch.receipt_code}
HASH SHA-256 INTEGRIDADE:
${punch.sha256_hash}
HASH ANTERIOR:
${punch.prev_hash}
============================================================
Este comprovante eletrônico é de visualização garantida ao 
trabalhador e pode ser extraído das últimas 48 horas.
============================================================
    `.trim();

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comprovante_ponto_${employee.registration_number}_nsr_${punch.nsr}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#FFF7E8] rounded-3xl border border-[#2B0F0F]/15 shadow-2xl p-6 sm:p-7 text-[#2B0F0F] my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="no-print absolute top-5 right-5 p-2 rounded-full text-[#7A655C] hover:bg-[#2B0F0F]/5 hover:text-[#2B0F0F] transition-colors"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        {/* Topo com Sucesso */}
        <div className="no-print text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#3E9B5F]/15 text-[#3E9B5F] mb-2 shadow-inner">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="font-heading font-extrabold text-2xl text-[#2B0F0F]">
            Ponto Registrado com Sucesso! 🍰
          </h2>
          <p className="text-sm text-[#7A655C]">
            Comprovante eletrônico emitido conforme Portaria MTP nº 671/2021
          </p>
        </div>

        {/* Cupom / Comprovante Regulamentar Estilizado (Pronto para impressão) */}
        <div className="bg-white rounded-2xl border border-dashed border-[#2B0F0F]/20 p-5 shadow-xs text-xs space-y-3 font-mono">
          {/* Cabeçalho do cupom */}
          <div className="text-center pb-3 border-b border-gray-200">
            <div className="flex justify-center mb-1">
              <KyLogo size={36} showText={false} />
            </div>
            <div className="font-bold text-sm text-[#2B0F0F]">{company.corporate_name}</div>
            <div className="text-gray-500 text-[11px]">CNPJ: {formatCNPJ(company.cnpj)}</div>
            <div className="text-gray-500 text-[10px]">{company.address}</div>
            <div className="text-[10px] text-[#FFA600] font-semibold mt-1">
              REP-P: {company.rep_p_identifier} · v{company.software_version}
            </div>
          </div>

          {/* Dados do Trabalhador */}
          <div className="py-1 border-b border-gray-200 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">TRABALHADOR:</span>
              <span className="font-bold text-right text-[#2B0F0F]">{employee.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">CPF:</span>
              <span className="font-semibold text-gray-700">{formatCPF(employee.cpf)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">MATRÍCULA:</span>
              <span className="font-semibold text-gray-700">{employee.registration_number}</span>
            </div>
          </div>

          {/* Dados da Marcação */}
          <div className="py-2 border-b border-gray-200 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">EVENTO REGISTRADO:</span>
              <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${currentBadge.color}`}>
                {currentBadge.label}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">DATA E HORA:</span>
              <span className="font-bold text-sm text-[#2B0F0F]">{punch.timestamp_local}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">NSR (SEQUENCIAL):</span>
              <span className="font-extrabold text-sm text-[#FFA600]">
                #{String(punch.nsr).padStart(6, '0')}
              </span>
            </div>
          </div>

          {/* Integridade Criptográfica */}
          <div className="pt-1 text-[10px] space-y-1 text-gray-500">
            <div className="flex items-center gap-1 text-[#3E9B5F] font-semibold">
              <ShieldCheck size={12} /> Assinatura e Integridade Criptográfica (SHA-256)
            </div>
            <div className="bg-[#FFF7E8]/70 p-2 rounded border border-[#2B0F0F]/10 break-all text-[9px] text-[#2B0F0F]">
              <span className="font-bold text-gray-500 block mb-0.5">HASH DA MARCAÇÃO:</span>
              {punch.sha256_hash}
            </div>
            <div className="flex justify-between text-[10px] pt-1 text-gray-400">
              <span>Autenticação: {punch.receipt_code}</span>
              <span>Fuso: America/Fortaleza</span>
            </div>
          </div>
        </div>

        {/* Botões de Ação do Comprovante */}
        <div className="no-print mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-[#2B0F0F]/20 bg-white font-semibold text-xs text-[#2B0F0F] hover:bg-[#FFF7E8] transition-colors"
            >
              <Printer size={15} /> Imprimir Cupom
            </button>
            <button
              onClick={handleDownloadText}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-[#2B0F0F]/20 bg-white font-semibold text-xs text-[#2B0F0F] hover:bg-[#FFF7E8] transition-colors"
            >
              <Download size={15} /> Baixar Arquivo
            </button>
          </div>

          {/* Opção regulamentar: Comprovantes das últimas 48h */}
          <div className="pt-1">
            <button
              onClick={() => setShowHistory48h(!showHistory48h)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-white/60 hover:bg-white text-xs font-semibold text-[#7A655C] hover:text-[#2B0F0F] transition-colors border border-[#2B0F0F]/10"
            >
              <span className="flex items-center gap-2">
                <FileText size={14} className="text-[#FFA600]" />
                Ver comprovantes das últimas 48 horas ({recentReceipts.length})
              </span>
              <ChevronRight
                size={14}
                className={`transform transition-transform ${showHistory48h ? 'rotate-90' : ''}`}
              />
            </button>

            {showHistory48h && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-white border border-[#2B0F0F]/10 p-2 space-y-1.5 text-xs">
                {recentReceipts.length === 0 ? (
                  <p className="text-gray-400 text-center py-2">Nenhum outro comprovante nas últimas 48 horas.</p>
                ) : (
                  recentReceipts.map(rec => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#FFF7E8]/40 hover:bg-[#FFF7E8] text-[11px]"
                    >
                      <div>
                        <span className="font-bold text-[#2B0F0F]">NSR #{String(rec.nsr).padStart(5, '0')}</span>
                        <span className="text-gray-500 ml-2">{rec.punch_type}</span>
                        <div className="text-[10px] text-gray-400">{rec.timestamp_local}</div>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-[#FFA600]">
                        {rec.receipt_code}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Botão de retorno imediato ao terminal para o próximo colega */}
          <button
            onClick={onNewPunch}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#FFA600] hover:bg-[#e09200] font-heading font-extrabold text-base text-[#2B0F0F] shadow-sm transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            Concluir e Liberar Terminal
          </button>
        </div>
      </div>
    </div>
  );
};
