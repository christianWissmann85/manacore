import { ReactNode } from 'react';
import { Header } from './Header';

interface MainLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  loading?: boolean;
}

export function MainLayout({ sidebar, children }: MainLayoutProps) {
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-app-gradient">
      <Header />

      {/* 
        Grid Layout: 
        - Mobile: Stacked
        - Desktop: 1fr (Board) | 400px (Inspector) 
        - Large: 1fr (Board) | 450px (Inspector)
      */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_450px] min-h-0 relative">
        {/* Main Content (Board) */}
        <main className="relative min-w-0 min-h-0 flex flex-col overflow-hidden">{children}</main>

        {/* Sidebar (Inspector) */}
        <aside className="hidden lg:flex flex-col border-l border-glass-border bg-glass-surface/30 backdrop-blur-md min-h-0 z-20">
          {sidebar}
        </aside>
      </div>
    </div>
  );
}
