import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  PieChart,
  Users,
  Briefcase,
  CheckCircle2,
  FileText,
  Database,
  Award,
  Terminal,
  RefreshCw,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { ToastMessage } from './types.ts';
import DashboardPage from './components/DashboardPage.tsx';
import AnalysisPage from './components/AnalysisPage.tsx';
import StudentsPage from './components/StudentsPage.tsx';
import DrivesPage from './components/DrivesPage.tsx';
import EligibilityPage from './components/EligibilityPage.tsx';
import ApplicationsPage from './components/ApplicationsPage.tsx';
import MastersPage from './components/MastersPage.tsx';
import PlacementsPage from './components/PlacementsPage.tsx';
import SqlQueriesPage from './components/SqlQueriesPage.tsx';

type PageKey =
  | 'dashboard'
  | 'analysis'
  | 'students'
  | 'drives'
  | 'eligibility'
  | 'applications'
  | 'masters'
  | 'placements'
  | 'queries';

const NAV_ITEMS: {
  key: PageKey;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    subtitle: 'Campus placement overview, branch progress, and recent application activity.',
    icon: LayoutDashboard,
  },
  {
    key: 'analysis',
    label: 'Analysis',
    subtitle: 'Comparative charts, CGPA & package distributions, and head-to-head branch metrics.',
    icon: PieChart,
  },
  {
    key: 'students',
    label: 'Students',
    subtitle: 'Manage student profiles, computed ages (v_student_age), and multivalued phone numbers.',
    icon: Users,
  },
  {
    key: 'drives',
    label: 'Drives',
    subtitle: 'Schedule company recruitment drives and configure weak-entity eligibility criteria sets.',
    icon: Briefcase,
  },
  {
    key: 'eligibility',
    label: 'Eligibility',
    subtitle: 'Evaluate student drive qualification across CGPA, backlog, and branch rules.',
    icon: CheckCircle2,
  },
  {
    key: 'applications',
    label: 'Applications',
    subtitle: 'Track candidate status, log interview rounds, and record confirmed placement offers.',
    icon: FileText,
  },
  {
    key: 'masters',
    label: 'Masters',
    subtitle: 'Maintain core institutional records for Departments, Partner Companies, and TPOs.',
    icon: Database,
  },
  {
    key: 'placements',
    label: 'Placements',
    subtitle: 'Verified placement records, final compensation packages, and offer dates.',
    icon: Award,
  },
  {
    key: 'queries',
    label: 'SQL Queries',
    subtitle: 'Execute live read-only SELECT queries and inspect raw SQL report outputs.',
    icon: Terminal,
  },
];

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Live polling & manual refresh state
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const [syncLabel, setSyncLabel] = useState('Updated just now');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSyncSuccess = useCallback(() => {
    setLastSyncedAt(new Date());
    setSyncLabel('Updated just now');
    setIsRefreshing(false);
  }, []);

  // Poll the visible page every 5 seconds so changes made in MySQL Workbench appear automatically
  useEffect(() => {
    const pollInterval = setInterval(() => {
      setRefreshTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  // Update human-readable sync label
  useEffect(() => {
    const timer = setInterval(() => {
      const diffSec = Math.floor((Date.now() - lastSyncedAt.getTime()) / 1000);
      if (diffSec < 5) {
        setSyncLabel('Updated just now');
      } else {
        setSyncLabel(`Updated ${diffSec}s ago`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastSyncedAt]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setRefreshTick((t) => t + 1);
  };

  const currentNav = NAV_ITEMS.find((n) => n.key === activePage) || NAV_ITEMS[0];

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }}
    >
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation (30% Secondary Structural Surface) */}
      <aside
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 border-r flex flex-col justify-between transition-transform duration-150 md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Zone */}
          <div
            className="h-16 px-6 flex items-center justify-between border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="font-display text-base font-bold tracking-tight text-slate-900">
              Placement Manager
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-md"
              aria-label="Close navigation menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav Links with 44px accessible touch height */}
          <nav className="p-3 space-y-1" aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setActivePage(item.key);
                    setMobileMenuOpen(false);
                  }}
                  style={
                    isActive
                      ? {
                          backgroundColor: 'var(--color-brand)',
                          color: '#FFFFFF',
                        }
                      : undefined
                  }
                  className={`w-full min-h-[42px] flex items-center gap-3 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    isActive
                      ? 'shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quiet Database & Polling Footer */}
        <div
          className="p-4 border-t text-xs space-y-1"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        >
          <div className="font-mono font-medium text-slate-700">Schema: C_PLACEMENT</div>
          <div>Live sync every 5 seconds</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
          className="h-16 px-4 sm:px-8 border-b flex items-center justify-between gap-4 sticky top-0 z-20"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-semibold text-slate-900 truncate">
                {currentNav.label}
              </h1>
            </div>
          </div>

          {/* Primary Actions: Sync Status, Manual Refresh, and Theme Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-500 font-mono whitespace-nowrap">
              {syncLabel}
            </span>
            <button
              type="button"
              onClick={handleManualRefresh}
              className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
              title="Refresh data now"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`}
              />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Page Viewport with generous 24px–32px rhythm */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Contextual Lead-In (60–75ch max measure) */}
          <div className="border-b border-slate-200 pb-4">
            <p className="text-sm text-slate-600">{currentNav.subtitle}</p>
          </div>

          {activePage === 'dashboard' && (
            <DashboardPage
              refreshTick={refreshTick}
              onSyncSuccess={handleSyncSuccess}
              onNavigate={(p) => setActivePage(p as PageKey)}
            />
          )}

          {activePage === 'analysis' && (
            <AnalysisPage
              refreshTick={refreshTick}
              onSyncSuccess={handleSyncSuccess}
              showToast={showToast}
            />
          )}

          {activePage === 'students' && (
            <StudentsPage
              refreshTick={refreshTick}
              onSyncSuccess={handleSyncSuccess}
              showToast={showToast}
            />
          )}

          {activePage === 'drives' && (
            <DrivesPage
              refreshTick={refreshTick}
              onSyncSuccess={handleSyncSuccess}
              showToast={showToast}
            />
          )}

          {activePage === 'eligibility' && (
            <EligibilityPage
              refreshTick={refreshTick}
              onSyncSuccess={handleSyncSuccess}
              showToast={showToast}
            />
          )}

          {activePage === 'applications' && (
            <ApplicationsPage
              refreshTick={refreshTick}
              onSyncSuccess={handleSyncSuccess}
              showToast={showToast}
            />
          )}

          {activePage === 'masters' && (
            <MastersPage
              refreshTick={refreshTick}
              onSyncSuccess={handleSyncSuccess}
              showToast={showToast}
            />
          )}

          {activePage === 'placements' && (
            <PlacementsPage
              refreshTick={refreshTick}
              onSyncSuccess={handleSyncSuccess}
              showToast={showToast}
            />
          )}

          {activePage === 'queries' && (
            <SqlQueriesPage
              refreshTick={refreshTick}
              onSyncSuccess={handleSyncSuccess}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-lg border shadow-md text-xs font-semibold ${
              toast.type === 'error'
                ? 'bg-red-600 text-white border-red-700'
                : toast.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-white text-slate-800 border-slate-200'
            }`}
          >
            <span>{toast.text}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center opacity-80 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
