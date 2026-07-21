/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Participant, 
  Activity, 
  ActivityLogs, 
  ScanLogEntry, 
  DbBackup 
} from './types';
import Dashboard from './components/Dashboard';
import ActivityView from './components/ActivityView';
import QRGenerator from './components/QRGenerator';
import SettingsView from './components/SettingsView';
import VerifiedView from './components/VerifiedView';
import RegisteredView from './components/RegisteredView';
import { initAuth, auth, provider } from './lib/auth';
import { User, signInWithPopup } from 'firebase/auth';
import { motion } from 'motion/react';
import { 
  Grid, 
  QrCode, 
  Settings as SettingsIcon, 
  CheckSquare, 
  Sparkles, 
  ShieldCheck,
  Smartphone,
  ChevronRight,
  Database,
  CheckCircle,
  Users,
  ChevronDown,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

const STORAGE_KEY_PARTICIPANTS = 'event_qr_participants';
const STORAGE_KEY_ACTIVITIES = 'event_qr_activities';
const STORAGE_KEY_LOGS = 'event_qr_logs';

const DEFAULT_ACTIVITIES: Activity[] = [
  { id: 'check-in', name: 'Check In', icon: '🎟️', scannedCount: 0, duplicateAttempts: 0 },
  { id: 'check-out', name: 'Check Out', icon: '🚪', scannedCount: 0, duplicateAttempts: 0 },
  { id: 't-shirt', name: 'T-shirt Distribution', icon: '👕', scannedCount: 0, duplicateAttempts: 0 },
  { id: 'food', name: 'Food Distribution', icon: '🍔', scannedCount: 0, duplicateAttempts: 0 },
];

function GoogleAuthBridge() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async () => {
    setStatus('loading');
    setErrorMsg(null);
    try {
      const result = await signInWithPopup(auth, provider);
      const { GoogleAuthProvider } = await import('firebase/auth');
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (!credential?.accessToken) {
        throw new Error('Failed to retrieve access token from Google sign-in.');
      }

      const idToken = await result.user.getIdToken();

      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_SUCCESS',
          user: {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
          },
          accessToken: credential.accessToken,
          idToken: idToken,
        }, window.location.origin);
        
        setStatus('success');
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        setStatus('success');
        setTimeout(() => {
          window.location.href = window.location.origin;
        }, 1500);
      }
    } catch (err: any) {
      console.error('Bridge Auth Error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-100 rounded-3xl p-8 shadow-xl space-y-6 text-center animate-fadeIn">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-slate-800">Google Authentication Bridge</h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Authorize Civil Scanner to safely access your event spreadsheets and participants roster from Google Drive.
          </p>
        </div>

        {status === 'idle' && (
          <div className="space-y-4">
            <button
              onClick={handleSignIn}
              className="w-full h-12 bg-white hover:bg-slate-50 active:scale-98 border border-slate-200 text-slate-800 font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer group"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
              </div>
              <span className="font-bold text-slate-700 text-sm">Continue with Google Account</span>
            </button>
            <p className="text-[10px] text-slate-400">
              Connections are secured by Google Auth and only request sheet-reading access.
            </p>
          </div>
        )}

        {status === 'loading' && (
          <div className="py-6 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-bold text-slate-600">Completing Secure Authentication...</p>
            <p className="text-[10px] text-slate-400">Please sign in via the Google account popup window.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6 flex flex-col items-center justify-center gap-3 animate-scaleUp">
            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white">
              <CheckCircle className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-emerald-600">Authorized Successfully!</p>
            <p className="text-[10px] text-slate-400">This window will close automatically...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 rounded-2xl border border-red-100/50 flex items-center gap-2 text-left">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-red-800">Connection Failed</p>
                <p className="text-[10px] text-red-600 truncate max-w-[260px]">{errorMsg}</p>
              </div>
            </div>
            <button
              onClick={handleSignIn}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs border-0 cursor-pointer shadow-sm transition-colors"
            >
              Retry Google Sign-In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const AnimatedTabIcon = ({ 
  icon: Icon, 
  isActive, 
  colorClass,
  isMobile = false
}: { 
  icon: any; 
  isActive: boolean; 
  colorClass: string; 
  isMobile?: boolean;
}) => {
  const sizeClasses = isMobile ? "w-5.5 h-5.5" : "w-4.5 h-4.5";
  return (
    <div className="relative flex items-center justify-center rounded-xl">
      <motion.div
        animate={isActive ? {
          scale: [1, 1.25, 1.12],
          rotate: [0, -10, 10, 0],
          y: [0, -2, 0]
        } : {
          scale: 1,
          rotate: 0,
          y: 0
        }}
        whileHover={{
          scale: 1.18,
          rotate: [0, -4, 4, 0],
          transition: { duration: 0.3 }
        }}
        whileTap={{ scale: 0.9 }}
        transition={{
          type: "tween",
          ease: "easeOut",
          duration: 0.45
        }}
        className="relative z-10 flex items-center justify-center"
      >
        <Icon 
          className={`${sizeClasses} transition-colors duration-300 ${
            isActive ? colorClass : 'text-slate-400 group-hover:text-slate-600'
          }`} 
          strokeWidth={isActive ? 3.0 : 2.25} 
        />
      </motion.div>

      {/* Decorative premium active glassmorphic aura under the icon */}
      {isActive && (
        <motion.div 
          layoutId={`iconGlow-${Icon.displayName || Icon.name || 'icon'}-${isMobile ? 'mobile' : 'desktop'}`}
          className="absolute -inset-1.5 bg-current opacity-12 blur-md rounded-full -z-10"
          animate={{
            scale: [0.85, 1.2, 0.85],
            opacity: [0.08, 0.16, 0.08]
          }}
          transition={{
            repeat: Infinity,
            duration: 2.8,
            ease: "easeInOut"
          }}
        />
      )}
    </div>
  );
};

export default function App() {
  // Check if we are a top-level popup helper for Google Auth
  const [isAuthPopup] = useState(() => {
    return window.location.search.includes('auth_popup=true');
  });

  if (isAuthPopup) {
    return <GoogleAuthBridge />;
  }

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'registered' | 'verified' | 'simulator' | 'settings'>('dashboard');
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabConfig = {
    dashboard: { 
      label: 'Dashboard', 
      icon: Grid, 
      textClass: 'text-indigo-600', 
      bgClass: 'bg-indigo-50/80', 
      borderClass: 'border-indigo-150/60',
      activeDesktopClass: 'bg-white text-indigo-600 shadow-sm',
      dotClass: 'bg-indigo-600'
    },
    verified: { 
      label: 'Verified Logs', 
      icon: CheckCircle, 
      textClass: 'text-emerald-600', 
      bgClass: 'bg-emerald-50/80', 
      borderClass: 'border-emerald-150/60',
      activeDesktopClass: 'bg-white text-emerald-600 shadow-sm',
      dotClass: 'bg-emerald-600'
    },
    simulator: { 
      label: 'Ticket Generator', 
      icon: QrCode, 
      textClass: 'text-amber-600', 
      bgClass: 'bg-amber-50/80', 
      borderClass: 'border-amber-150/60',
      activeDesktopClass: 'bg-white text-amber-600 shadow-sm',
      dotClass: 'bg-amber-600'
    },
    settings: { 
      label: 'Settings', 
      icon: SettingsIcon, 
      textClass: 'text-purple-600', 
      bgClass: 'bg-purple-50/80', 
      borderClass: 'border-purple-150/60',
      activeDesktopClass: 'bg-white text-purple-600 shadow-sm',
      dotClass: 'bg-purple-600'
    },
  };

  // Core Event Database
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activities, setActivities] = useState<Activity[]>(DEFAULT_ACTIVITIES);
  const [logs, setLogs] = useState<ActivityLogs>({});

  // Active Google Spreadsheet Context (for sync references)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem('event_qr_active_spreadsheet_id');
  });

  // Active custom event campaign name state
  const [eventName, setEventName] = useState<string>(() => {
    return localStorage.getItem('event_qr_event_name') || '';
  });

  const handleUpdateEventName = (name: string) => {
    setEventName(name);
    localStorage.setItem('event_qr_event_name', name);
  };

  // Active database manager name state
  const [databaseManagerName, setDatabaseManagerName] = useState<string>(() => {
    return localStorage.getItem('event_qr_db_manager_name') || '';
  });

  const handleUpdateDatabaseManagerName = (name: string) => {
    setDatabaseManagerName(name);
    localStorage.setItem('event_qr_db_manager_name', name);
  };

  // Primary matching field select option (studentID, tokenNumber, contactNumber, name, etc.)
  const [primaryMatchField, setPrimaryMatchField] = useState<string>(() => {
    return localStorage.getItem('event_qr_primary_match_field') || 'fuzzy';
  });

  const handleUpdatePrimaryMatchField = (field: string) => {
    setPrimaryMatchField(field);
    localStorage.setItem('event_qr_primary_match_field', field);
  };

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedParticipants = localStorage.getItem(STORAGE_KEY_PARTICIPANTS);
      const storedActivities = localStorage.getItem(STORAGE_KEY_ACTIVITIES);
      const storedLogs = localStorage.getItem(STORAGE_KEY_LOGS);

      if (storedParticipants) setParticipants(JSON.parse(storedParticipants));
      if (storedActivities) setActivities(JSON.parse(storedActivities));
      if (storedLogs) setLogs(JSON.parse(storedLogs));
    } catch (e) {
      console.error('Failed to load storage state:', e);
    }

    // Initialize Firebase Auth session persistence
    initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
  }, []);

  // Synchronize state with history to support device back button
  useEffect(() => {
    const isRoot = activeTab === 'dashboard' && activeActivityId === null;

    const handlePopState = () => {
      // User pressed back button
      if (activeTab !== 'dashboard' || activeActivityId !== null) {
        setActiveTab('dashboard');
        setActiveActivityId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);

    // If we transition FROM root to an alternative view, we push a state to history
    // so that the back button triggers popstate instead of exiting the page.
    if (!isRoot) {
      if (!window.history.state?.isAlternativeView) {
        window.history.pushState({ isAlternativeView: true }, '');
      }
    } else {
      // If we are back at root and the history state has isAlternativeView,
      // we go back in history to keep it in sync.
      if (window.history.state?.isAlternativeView) {
        window.history.back();
      }
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeTab, activeActivityId]);

  // Update localStorage when participants change
  const handleImportParticipants = (list: Participant[]) => {
    setParticipants(list);
    localStorage.setItem(STORAGE_KEY_PARTICIPANTS, JSON.stringify(list));
  };

  // Update localStorage when custom stations are modified
  const handleUpdateActivities = (list: Activity[]) => {
    setActivities(list);
    localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(list));
  };

  // Reset/Restore Database operations
  const handleRestoreState = (backup: DbBackup) => {
    setParticipants(backup.participants);
    setActivities(backup.activities);
    setLogs(backup.logs);
    localStorage.setItem(STORAGE_KEY_PARTICIPANTS, JSON.stringify(backup.participants));
    localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(backup.activities));
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(backup.logs));
  };

  const handleResetDatabase = () => {
    setParticipants([]);
    setActivities(DEFAULT_ACTIVITIES);
    setLogs({});
    setActiveActivityId(null);
    setEventName('');
    setDatabaseManagerName('');
    localStorage.removeItem(STORAGE_KEY_PARTICIPANTS);
    localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(DEFAULT_ACTIVITIES));
    localStorage.removeItem(STORAGE_KEY_LOGS);
    localStorage.removeItem('event_qr_active_spreadsheet_id');
    localStorage.removeItem('event_qr_event_name');
    localStorage.removeItem('event_qr_db_manager_name');
    setActiveSpreadsheetId(null);
  };

  // Add scan logs
  const handleAddLog = (activityId: string, entry: Omit<ScanLogEntry, 'id' | 'timestamp'>) => {
    const fullEntry: ScanLogEntry = {
      ...entry,
      id: `${activityId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString()
    };

    const updatedLogs = {
      ...logs,
      [activityId]: [...(logs[activityId] || []), fullEntry]
    };

    setLogs(updatedLogs);
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));
  };

  // Update verified log history entry
  const handleUpdateLogEntry = (activityId: string, entryId: string, updatedFields: Partial<ScanLogEntry>) => {
    if (!logs[activityId]) return;
    const updatedActivityLogs = logs[activityId].map(entry => {
      if (entry.id === entryId) {
        return { ...entry, ...updatedFields };
      }
      return entry;
    });

    const updatedLogs = {
      ...logs,
      [activityId]: updatedActivityLogs
    };

    setLogs(updatedLogs);
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));
  };

  // Delete verified log history entry
  const handleDeleteLogEntry = (activityId: string, entryId: string) => {
    if (!logs[activityId]) return;
    const updatedActivityLogs = logs[activityId].filter(entry => entry.id !== entryId);

    const updatedLogs = {
      ...logs,
      [activityId]: updatedActivityLogs
    };

    setLogs(updatedLogs);
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));
  };

  // Simulator QR link bridge
  const [simulationTrigger, setSimulationTrigger] = useState<{ text: string; ts: number } | null>(null);
  const handleSimulateQRScan = (qrText: string) => {
    if (activeActivityId) {
      // Trigger scan in current active activity view
      setSimulationTrigger({ text: qrText, ts: Date.now() });
    } else {
      // Prompt user to select station first
      alert('Simulation Received! Please open a scan station (e.g. Check In) from the Dashboard list first, then click "Simulate Scan".');
      setActiveTab('dashboard');
    }
  };

  const handleAuthChange = (user: User | null, token: string | null) => {
    setCurrentUser(user);
    setAccessToken(token);
  };

  const handleAddParticipant = (p: Participant) => {
    const newList = [...participants, p];
    handleImportParticipants(newList);
  };

  const handleEditParticipant = (oldStudentID: string, oldToken: string, updated: Participant) => {
    const newList = participants.map(p => {
      if (p.studentID === oldStudentID && p.tokenNumber === oldToken) {
        return updated;
      }
      return p;
    });
    handleImportParticipants(newList);
  };

  const handleDeleteParticipant = (studentID: string, token: string) => {
    const newList = participants.filter(p => !(p.studentID === studentID && p.tokenNumber === token));
    handleImportParticipants(newList);
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col font-sans text-slate-900 overflow-x-hidden relative">
      
      {/* Upper Navigation Rail */}
      <header className="sticky top-0 z-40 h-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 flex-shrink-0">
            <ShieldCheck className="w-5.5 h-5.5 md:w-6 md:h-6 text-white" strokeWidth={2.75} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
              EntryLoop Scanner
            </h1>
            <p className="text-[9px] md:text-xs text-slate-500 font-bold uppercase tracking-widest leading-none mt-0.5 md:mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
              by Asad 2026
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          {/* Mobile Current Menu Indicator (Only visible on screens smaller than md) */}
          <div className="block md:hidden">
            {(() => {
              if (activeActivityId) {
                const act = activities.find(a => a.id === activeActivityId);
                return (
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600 animate-pulse" strokeWidth={2.5} />
                    <span className="truncate max-w-[100px]">{act?.name || 'Scanner'}</span>
                  </div>
                );
              }
              const item = tabConfig[activeTab as keyof typeof tabConfig];
              const IconComponent = item?.icon || Grid;
              return (
                <div className={`flex items-center gap-1.5 ${item?.bgClass || 'bg-slate-50'} border ${item?.borderClass || 'border-slate-100'} rounded-xl px-3 py-1.5 text-xs font-bold ${item?.textClass || 'text-slate-750'} shadow-sm`}>
                  <IconComponent className="w-3.5 h-3.5" strokeWidth={2.5} />
                  <span>{item?.label || 'Menu'}</span>
                </div>
              );
            })()}
          </div>

          {/* Global tab controllers (Visible only on md and larger screens) - Premium Smart Look */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-100/90 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] relative">
            {(Object.keys(tabConfig) as Array<keyof typeof tabConfig>).map((key) => {
              const item = tabConfig[key];
              const IconComponent = item.icon;
              const isActive = activeTab === key && !activeActivityId;
              return (
                <button
                  key={key}
                  onClick={() => { 
                    setActiveTab(key); 
                    setActiveActivityId(null); 
                  }}
                  className={`relative flex items-center gap-2 py-2 px-4.5 text-xs font-bold rounded-xl transition-all duration-300 border-0 cursor-pointer select-none group outline-none ${
                    isActive 
                      ? 'text-slate-900' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {/* Sliding active background block */}
                  {isActive && (
                    <motion.div
                      layoutId="desktopActiveTabIndicator"
                      className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.02)] z-0"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  
                  {/* Content (retains high z-index to overlay nicely on sliding indicator) */}
                  <span className="relative z-10 flex items-center gap-2">
                    <AnimatedTabIcon 
                      icon={IconComponent} 
                      isActive={isActive} 
                      colorClass={item.textClass} 
                      isMobile={false} 
                    />
                    <span className={`transition-all duration-300 ${isActive ? 'font-extrabold text-slate-900 scale-102' : 'font-semibold'}`}>{item.label}</span>
                    {isActive && (
                      <span className={`w-1 h-1 rounded-full ${item.dotClass} animate-pulse shrink-0`} />
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-28 md:pb-20">
        
        {/* Offline sync banner */}
        {participants.length > 0 && (
          <div className="mb-6 bg-emerald-50/70 border border-emerald-100/50 rounded-2xl px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[11px] font-bold text-emerald-800">
                Roster Synced Offline. Continuous scanner ready.
              </p>
            </div>
            <span className="text-[9px] font-mono font-bold bg-white text-emerald-600 px-2 py-0.5 rounded-md border border-emerald-100">
              {participants.length} PARTICIPANTS LOADED
            </span>
          </div>
        )}

        {/* Selected Activity station view */}
        {activeActivityId ? (() => {
          const activeAct = activities.find(a => a.id === activeActivityId);
          if (!activeAct) return null;
          return (
            <ActivityView
              activity={activeAct}
              participants={participants}
              logs={logs[activeActivityId] || []}
              accessToken={accessToken}
              activeSpreadsheetId={activeSpreadsheetId}
              onBack={() => setActiveActivityId(null)}
              onAddLog={(entry) => handleAddLog(activeActivityId, entry)}
              onDeleteLog={(entryId) => handleDeleteLogEntry(activeActivityId, entryId)}
              primaryMatchField={primaryMatchField}
            />
          );
        })() : (
          /* Tab Selection router */
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                activities={activities}
                participants={participants}
                logs={logs}
                onSelectActivity={(id) => {
                  setActiveActivityId(id);
                }}
                onNavigateToSettings={() => setActiveTab('settings')}
                eventName={eventName}
                onAddParticipant={handleAddParticipant}
                onEditParticipant={handleEditParticipant}
                onDeleteParticipant={handleDeleteParticipant}
                databaseManagerName={databaseManagerName}
              />
            )}

            {activeTab === 'registered' && (
              <RegisteredView
                participants={participants}
                onAddParticipant={handleAddParticipant}
                onEditParticipant={handleEditParticipant}
                onDeleteParticipant={handleDeleteParticipant}
              />
            )}

            {activeTab === 'verified' && (
              <VerifiedView
                activities={activities}
                participants={participants}
                logs={logs}
                onUpdateLogEntry={handleUpdateLogEntry}
                onDeleteLogEntry={handleDeleteLogEntry}
                eventName={eventName}
              />
            )}

            {activeTab === 'simulator' && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-500/15 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                      <QrCode className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                          COMPILATION CENTRE
                        </span>
                      </div>
                      <h2 className="text-xl font-black tracking-tight text-white mt-1">Ticket & Credential Center</h2>
                      <p className="text-xs text-slate-400 mt-1 max-w-xl">
                        Design, customize, and bulk download high-resolution entry passes with live tracking QR codes.
                      </p>
                    </div>
                  </div>
                </div>
                
                <QRGenerator 
                  onSimulateScan={handleSimulateQRScan} 
                  importedParticipants={participants} 
                  eventName={eventName}
                />
              </div>
            )}

            {activeTab === 'settings' && (
              <SettingsView
                participants={participants}
                activities={activities}
                logs={logs}
                onImportParticipants={handleImportParticipants}
                onUpdateActivities={handleUpdateActivities}
                onRestoreState={handleRestoreState}
                onResetDatabase={handleResetDatabase}
                onAuthChange={handleAuthChange}
                currentUser={currentUser}
                currentAccessToken={accessToken}
                eventName={eventName}
                onUpdateEventName={handleUpdateEventName}
                primaryMatchField={primaryMatchField}
                onUpdatePrimaryMatchField={handleUpdatePrimaryMatchField}
                databaseManagerName={databaseManagerName}
                onUpdateDatabaseManagerName={handleUpdateDatabaseManagerName}
              />
            )}
          </>
        )}
      </main>

      {/* Fixed Bottom Navigation Bar (Mobile only) - Floating Glassmorphic Dock */}
      <div className="fixed bottom-4 left-4 right-4 z-40 bg-white/80 backdrop-blur-xl border border-slate-200/50 rounded-3xl shadow-[0_10px_25px_rgba(0,0,0,0.08),0_4px_10px_rgba(0,0,0,0.04)] px-3 py-1.5 flex items-center justify-around md:hidden safe-bottom">
        {(Object.keys(tabConfig) as Array<keyof typeof tabConfig>).map((key) => {
          const item = tabConfig[key];
          const IconComponent = item.icon;
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                setActiveActivityId(null);
              }}
              className="flex flex-col items-center justify-center gap-1 py-1 px-2.5 min-w-[60px] transition-all border-0 bg-transparent cursor-pointer relative select-none"
            >
              {/* Sliding Background indicator for mobile */}
              {isActive && (
                <motion.div
                  layoutId="mobileActiveTabIndicator"
                  className={`absolute inset-x-1 inset-y-0.5 rounded-2xl ${item.bgClass} opacity-70 z-0`}
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                />
              )}

              <div className="relative z-10 p-1">
                <AnimatedTabIcon 
                  icon={IconComponent} 
                  isActive={isActive} 
                  colorClass={item.textClass} 
                  isMobile={true} 
                />
              </div>
              <span className={`relative z-10 text-[9px] font-extrabold tracking-tight transition-all duration-300 ${
                isActive ? `${item.textClass} font-black scale-105` : 'text-slate-500'
              }`}>
                {item.label}
              </span>
              
              {isActive && (
                <motion.span 
                  layoutId="mobileActiveDot"
                  className={`absolute bottom-0.5 w-1 h-1 ${item.dotClass} rounded-full z-10`} 
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Persistent Bridge effect to intercept Simulated scans inside active activity view */}
      {simulationTrigger && activeActivityId && (
        <SimulationInterceptor
          trigger={simulationTrigger}
          onSuccess={(text) => {
            // Find the active activity scanner on screen and execute
            const el = document.getElementById('qr-camera-reader');
            if (el) {
              // Pass values manually
              const view = document.querySelector('[class*="ActivityView"]');
              // Our ActivityView is already configured to scan, so we can mock call its handleQRDecoded directly!
            }
            setSimulationTrigger(null);
          }}
        />
      )}
    </div>
  );
}

// Invisible simulator bridge helper
interface SimulationInterceptorProps {
  trigger: { text: string; ts: number };
  onSuccess: (text: string) => void;
}
function SimulationInterceptor({ trigger, onSuccess }: SimulationInterceptorProps) {
  useEffect(() => {
    // Look up the active window or custom events to trigger scanning
    // We can dispatch a keyboard event or call custom callbacks
    // For extreme simplicity, we write a bridge directly via DOM events or simple timeout callback
    const event = new CustomEvent('simulated-qr-scan', { detail: trigger.text });
    window.dispatchEvent(event);
    onSuccess(trigger.text);
  }, [trigger]);

  return null;
}
