import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Activity, User, ShieldCheck, Clock, Filter } from 'lucide-react';
import { ActivityEvent, UserPersona } from '../types.ts';
import { apiRequest } from '../api.ts';

export default function ActivityLogDrawer({
  currentUser,
  isOpen,
  onClose,
  refreshTick,
}: {
  currentUser: UserPersona;
  isOpen: boolean;
  onClose: () => void;
  refreshTick: number;
}) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [activeSessionsCount, setActiveSessionsCount] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchActivities = async () => {
    try {
      const res = await apiRequest<{ activities: ActivityEvent[]; activeSessionsCount: number }>(
        '/api/activity'
      );
      setActivities(res.activities || []);
      setActiveSessionsCount(res.activeSessionsCount || 1);
    } catch {
      // Ignore background fetch error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchActivities();
    }
  }, [isOpen, refreshTick]);

  if (!isOpen) return null;

  const filtered = activities.filter((act) => {
    const matchesCat = filterCategory === 'all' || act.category === filterCategory;
    if (!matchesCat) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      act.userName.toLowerCase().includes(q) ||
      act.action.toLowerCase().includes(q) ||
      act.details.toLowerCase().includes(q) ||
      act.userRoleLabel.toLowerCase().includes(q)
    );
  });

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSec < 15) return 'Just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return date.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  const getCategoryColor = (cat: ActivityEvent['category']) => {
    switch (cat) {
      case 'application':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'drive':
        return 'text-indigo-700 bg-indigo-50 border-indigo-200';
      case 'placement':
        return 'text-teal-700 bg-teal-50 border-teal-200';
      case 'student':
        return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'query':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-[1px]">
      <div className="bg-white border-l border-slate-200 w-full max-w-lg h-full flex flex-col justify-between overflow-y-auto p-6 shadow-2xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <h3 className="text-lg font-bold text-slate-900">Live Interactions & Audit Trail</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Real-time monitoring of users interacting with the database and application.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-md"
              aria-label="Close activity drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Interacting User Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Your Active Session</span>
              <span className="text-emerald-700 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs"
                style={{ backgroundColor: currentUser.avatarColor }}
              >
                {currentUser.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</div>
                <div className="text-xs text-slate-500 font-mono truncate">{currentUser.email}</div>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-semibold bg-white border border-slate-200 text-slate-700 whitespace-nowrap">
                {currentUser.roleLabel}
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Filter Activity Feed</span>
              </span>
              <button
                type="button"
                onClick={fetchActivities}
                className="inline-flex items-center gap-1 text-indigo-700 hover:underline"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'application', label: 'Applications' },
                { id: 'drive', label: 'Drives' },
                { id: 'placement', label: 'Placements' },
                { id: 'query', label: 'Queries' },
                { id: 'student', label: 'Students' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilterCategory(c.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    filterCategory === c.id
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactions Feed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filtered.length} interaction events</span>
              <span className="font-mono">{activeSessionsCount} active session personas</span>
            </div>

            {loading ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
                {filtered.map((item) => (
                  <div key={item.id} className="p-3.5 hover:bg-slate-50/80 transition-colors space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {item.userName}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded truncate">
                          {item.userRoleLabel}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-bold rounded border shrink-0 ${getCategoryColor(
                          item.category
                        )}`}
                      >
                        {item.action}
                      </span>
                      <p className="text-xs text-slate-600 leading-snug break-words">
                        {item.details}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                No recent activity matching the selected category.
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>College Placement System Live Audit</span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
