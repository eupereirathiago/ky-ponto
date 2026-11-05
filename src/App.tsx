import React, { useState, useEffect } from 'react';
import { PontoStore } from './lib/storage';
import { TerminalView } from './features/terminal/TerminalView';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { KyLogo } from './components/KyLogo';

export default function App() {
  const [currentView, setCurrentView] = useState<'terminal' | 'admin'>('terminal');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Inicialização assíncrona do banco de dados e sementes iniciais com PINs com salt/hash
    PontoStore.initSeedIfNeeded().then(() => {
      setIsReady(true);
    });
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#FFF7E8] text-[#2B0F0F] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <KyLogo size={64} showText={false} />
          <h2 className="font-heading font-extrabold text-2xl text-[#2B0F0F]">
            Carregando KyPonto...
          </h2>
          <p className="text-xs text-[#7A655C]">
            Inicializando ambiente seguro de ponto eletrônico
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF7E8] text-[#2B0F0F]">
      {currentView === 'terminal' ? (
        <TerminalView onOpenAdmin={() => setCurrentView('admin')} />
      ) : (
        <AdminDashboard onBackToTerminal={() => setCurrentView('terminal')} />
      )}
    </div>
  );
}
