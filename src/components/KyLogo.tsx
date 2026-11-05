import React from 'react';

interface KyLogoProps {
  size?: number;
  showText?: boolean;
  subtitle?: string;
  className?: string;
}

export const KyLogo: React.FC<KyLogoProps> = ({
  size = 48,
  showText = true,
  subtitle = 'Ponto Digital Ky Delícia',
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Ícone Vetorial Oficial: Chapéu de Chef + Relógio de Ponto */}
      <div
        className="relative flex items-center justify-center shrink-0 rounded-2xl bg-[#2B0F0F] p-1.5 shadow-sm"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 240 240"
          className="w-full h-full"
          aria-label="Ícone KyPonto: Relógio e Chapéu de Chef"
        >
          <defs>
            <g id="kyponto-shape">
              <circle cx="120" cy="155" r="58" />
              {/* Chapéu de chef sobre o relógio */}
              <path d="M86 88C68 86 64 56 86 50C86 28 118 20 128 36C146 24 172 40 160 58C176 66 170 88 154 88Z" />
              <rect x="84" y="84" width="72" height="20" rx="8" />
            </g>
          </defs>

          {/* Borda externa brilhante Laranja Forno */}
          <use
            href="#kyponto-shape"
            fill="#FFA600"
            stroke="#FFA600"
            strokeWidth="24"
            strokeLinejoin="round"
          />
          {/* Contorno chocolate */}
          <use
            href="#kyponto-shape"
            fill="#2B0F0F"
            stroke="#2B0F0F"
            strokeWidth="12"
            strokeLinejoin="round"
          />

          {/* Mostrador branco do relógio */}
          <circle cx="120" cy="155" r="58" fill="#FFFFFF" />

          {/* Chapéu de chef preenchido com contorno chocolate */}
          <path
            d="M86 88C68 86 64 56 86 50C86 28 118 20 128 36C146 24 172 40 160 58C176 66 170 88 154 88Z"
            fill="#FFFFFF"
            stroke="#2B0F0F"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          {/* Brilho da dobra do chapéu */}
          <path
            d="M148 44C156 52 156 60 152 70"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <rect
            x="84"
            y="84"
            width="72"
            height="20"
            rx="8"
            fill="#FFFFFF"
            stroke="#2B0F0F"
            strokeWidth="5"
          />

          {/* Ponteiros e marcadores do relógio */}
          <g stroke="#2B0F0F" strokeWidth="6" strokeLinecap="round" fill="none">
            <path d="M120 155V122" />
            <path d="M120 155L142 168" />
            <path d="M74 155h7" />
            <path d="M159 155h7" />
            <path d="M120 202v-7" />
          </g>

          {/* Ponto central laranja */}
          <circle cx="120" cy="155" r="7" fill="#FFA600" stroke="#2B0F0F" strokeWidth="4" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col text-left leading-tight">
          <span className="font-heading font-extrabold text-2xl tracking-tight text-[#2B0F0F] flex items-center gap-1">
            Ky<span className="text-[#FFA600]">Ponto</span>
          </span>
          {subtitle && (
            <span className="text-xs font-semibold text-[#7A655C]">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
