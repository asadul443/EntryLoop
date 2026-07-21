/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Activity, Participant, ScanLogEntry } from '../types';
import { 
  Users, 
  QrCode, 
  Copy, 
  CheckCircle, 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  CheckSquare, 
  ShieldAlert,
  Grid,
  Globe,
  Wifi,
  WifiOff,
  UserCheck,
  RefreshCw,
  CloudLightning,
  Link2,
  LogOut,
  CloudUpload,
  User
} from 'lucide-react';
import RegisteredView from './RegisteredView';

interface DashboardProps {
  activities: Activity[];
  participants: Participant[];
  logs: { [activityId: string]: ScanLogEntry[] };
  onSelectActivity: (id: string) => void;
  onNavigateToSettings: () => void;
  eventName: string;
  onAddParticipant: (p: Participant) => void;
  onEditParticipant: (oldStudentID: string, oldToken: string, updated: Participant) => void;
  onDeleteParticipant: (studentID: string, token: string) => void;
  databaseManagerName?: string;
}

export default function Dashboard({ 
  activities, 
  participants, 
  logs, 
  onSelectActivity,
  onNavigateToSettings,
  eventName,
  onAddParticipant,
  onEditParticipant,
  onDeleteParticipant,
  databaseManagerName
}: DashboardProps) {
  const [showRegisteredList, setShowRegisteredList] = useState(false);
  const [showScansList, setShowScansList] = useState(false);
  const [showDuplicatesList, setShowDuplicatesList] = useState(false);

  const handleToggleRegistered = () => {
    setShowRegisteredList(!showRegisteredList);
    setShowScansList(false);
    setShowDuplicatesList(false);
  };

  const handleToggleScans = () => {
    setShowScansList(!showScansList);
    setShowRegisteredList(false);
    setShowDuplicatesList(false);
  };

  const handleToggleDuplicates = () => {
    setShowDuplicatesList(!showDuplicatesList);
    setShowRegisteredList(false);
    setShowScansList(false);
  };

  const successEntries: { activityName: string; entry: ScanLogEntry }[] = [];
  const duplicateEntries: { activityName: string; entry: ScanLogEntry }[] = [];

  Object.entries(logs).forEach(([actId, entryList]) => {
    const act = activities.find(a => a.id === actId);
    const actName = act ? act.name : actId;
    entryList.forEach(entry => {
      if (entry.status === 'success') {
        successEntries.push({
          activityName: actName,
          entry
        });
      } else if (entry.status === 'duplicate') {
        duplicateEntries.push({
          activityName: actName,
          entry
        });
      }
    });
  });

  // Sort by timestamp descending
  successEntries.sort((a, b) => new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime());
  duplicateEntries.sort((a, b) => new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime());
  
  const totalParticipants = participants.length;
  
  // Calculate aggregate metrics
  const totalScannedAll = Object.values(logs).reduce((acc, currentLogs) => {
    return acc + currentLogs.filter(l => l.status === 'success').length;
  }, 0);

  const totalDuplicatesAll = Object.values(logs).reduce((acc, currentLogs) => {
    return acc + currentLogs.filter(l => l.status === 'duplicate').length;
  }, 0);

  const totalDeniedAll = Object.values(logs).reduce((acc, currentLogs) => {
    return acc + currentLogs.filter(l => l.status === 'invalid').length;
  }, 0);

  // Hourly scan tracking helper
  const getHourlyScanDistribution = () => {
    const hours = Array.from({ length: 12 }, (_, i) => {
      const hr = (8 + i) % 24; // 8:00 AM to 7:00 PM
      return {
        label: `${hr % 12 || 12}${hr >= 12 ? 'PM' : 'AM'}`,
        hour: hr,
        count: 0
      };
    });

    Object.values(logs).forEach(actLogs => {
      actLogs.forEach(entry => {
        if (entry.status === 'success') {
          try {
            const time = new Date(entry.timestamp);
            const hr = time.getHours();
            const matchingHour = hours.find(h => h.hour === hr);
            if (matchingHour) {
              matchingHour.count += 1;
            }
          } catch (e) {
            // Ignore format errors
          }
        }
      });
    });

    return hours;
  };

  const hourlyData = getHourlyScanDistribution();
  const maxHourCount = Math.max(...hourlyData.map(h => h.count), 5);

  // Station-specific verification and completion statistics
  const getStationMetrics = () => {
    return activities.map(act => {
      const actLogs = logs[act.id] || [];
      const checkedIn = actLogs.filter(l => l.status === 'success').length;
      const duplicates = actLogs.filter(l => l.status === 'duplicate').length;
      const remaining = Math.max(0, totalParticipants - checkedIn);
      const percent = totalParticipants > 0 ? Math.round((checkedIn / totalParticipants) * 100) : 0;
      return {
        id: act.id,
        name: act.name,
        icon: act.icon,
        checkedIn,
        duplicates,
        remaining,
        percent,
      };
    });
  };

  const stationMetrics = getStationMetrics();

  const totalPossibleScans = totalParticipants * activities.length;
  const overallScanPercent = totalPossibleScans > 0 ? Math.round((totalScannedAll / totalPossibleScans) * 100) : 0;
  const totalRemainingScans = Math.max(0, totalPossibleScans - totalScannedAll);
  const avgStationsPerParticipant = totalParticipants > 0 ? (totalScannedAll / totalParticipants).toFixed(1) : '0.0';
  const cleanPassRate = (totalScannedAll + totalDuplicatesAll) > 0 
    ? Math.round((totalScannedAll / (totalScannedAll + totalDuplicatesAll)) * 100) 
    : 100;

  return (
    <div className="space-y-8 animate-fadeIn text-slate-900">
      {/* Upper overview section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl border-4 border-indigo-500/20">
        {/* Subtle glowing abstract shapes for high-end feel */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              Realtime Analytics
            </span>
            {eventName && (
              <span className="text-[10px] font-extrabold tracking-widest text-indigo-300 uppercase bg-indigo-500/15 px-3 py-1 rounded-full border border-indigo-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-300 animate-pulse" />
                Active Event
              </span>
            )}
          </div>

          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-4 max-w-3xl leading-tight">
            {eventName ? (
              <span className="bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent drop-shadow-sm">
                {eventName.toUpperCase()}
              </span>
            ) : (
              'Event Operations Control'
            )}
          </h2>

          {eventName && (
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-2 flex items-center gap-1.5">
              <span>Event Operations Control Hub</span>
            </p>
          )}

          <p className="text-slate-300 text-xs md:text-sm mt-3 leading-relaxed max-w-xl font-medium">
            Monitoring <span className="text-indigo-300 font-extrabold">{totalParticipants}</span> registered participants across <span className="text-indigo-300 font-extrabold">{activities.length}</span> activity stations in real-time.
          </p>
        </div>

        {totalParticipants === 0 && (
          <button
            onClick={onNavigateToSettings}
            className="relative z-10 flex items-center gap-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-extrabold py-3 px-6 rounded-2xl text-xs transition-all duration-300 border-0 cursor-pointer shadow-lg shadow-emerald-500/25 active:scale-95"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Import Google Sheet List</span>
          </button>
        )}
      </div>



      {/* Aggregate Scorecards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Database Card */}
        <div 
          onClick={handleToggleRegistered}
          className={`rounded-[2rem] p-6 shadow-sm border transition-all flex items-center gap-4 cursor-pointer hover:shadow-md select-none ${
            showRegisteredList 
              ? 'bg-indigo-50 border-indigo-500/30 ring-2 ring-indigo-500/15' 
              : 'bg-white border-slate-200 hover:border-indigo-300'
          }`}
          title="Click to toggle Registered Roster list"
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
            showRegisteredList ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'bg-slate-100 text-slate-600'
          }`}>
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered</span>
            <span className="text-2xl font-bold text-slate-800">{totalParticipants}</span>
            <span className="text-[10px] text-slate-500 font-bold block">
              {showRegisteredList ? 'Click to hide list' : 'Click to view list'}
            </span>
          </div>
        </div>

        {/* Total Verified Card */}
        <div 
          onClick={handleToggleScans}
          className={`rounded-[2rem] p-6 shadow-sm border transition-all flex items-center gap-4 cursor-pointer hover:shadow-md select-none ${
            showScansList 
              ? 'bg-emerald-50 border-emerald-500/30 ring-2 ring-emerald-500/15' 
              : 'bg-white border-slate-200 hover:border-indigo-300'
          }`}
          title="Click to toggle Verified Scans list"
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
            showScansList ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' : 'bg-emerald-100/50 text-emerald-600'
          }`}>
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Scans</span>
            <span className="text-2xl font-bold text-emerald-600">{totalScannedAll}</span>
            <span className="text-[10px] text-slate-500 font-bold block">
              {showScansList ? 'Click to hide list' : 'Click to view list'}
            </span>
          </div>
        </div>

        {/* Total Duplicates Card */}
        <div 
          onClick={handleToggleDuplicates}
          className={`rounded-[2rem] p-6 shadow-sm border transition-all flex items-center gap-4 cursor-pointer hover:shadow-md select-none ${
            showDuplicatesList 
              ? 'bg-rose-50 border-rose-500/30 ring-2 ring-rose-500/15' 
              : 'bg-white border-slate-200 hover:border-indigo-300'
          }`}
          title="Click to toggle Duplicate Scan Attempts list"
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
            showDuplicatesList ? 'bg-rose-600 text-white shadow-md shadow-rose-100' : 'bg-rose-100/50 text-rose-600 animate-pulse'
          }`}>
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duplicates</span>
            <span className="text-2xl font-bold text-rose-600">{totalDuplicatesAll}</span>
            <span className="text-[10px] text-slate-500 font-bold block">
              {showDuplicatesList ? 'Click to hide list' : 'Click to view list'}
            </span>
          </div>
        </div>

        {/* Remaining Scans Card */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 hover:border-indigo-300 transition-colors flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100/50 flex items-center justify-center text-indigo-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unresolved</span>
            <span className="text-2xl font-bold text-indigo-600">
              {Math.max(0, totalParticipants * activities.length - totalScannedAll)}
            </span>
            <span className="text-[10px] text-slate-500 block">Across all stations</span>
          </div>
        </div>
      </div>

      {/* Conditional Collapsible Registered List Panel */}
      {showRegisteredList && (
        <div className="bg-slate-50 border border-slate-200/60 p-6 rounded-[2.5rem] shadow-inner animate-fadeIn space-y-4">
          <div className="flex justify-between items-center px-1">
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4" /> Integrated Participant Directory
            </h4>
            <button 
              onClick={() => setShowRegisteredList(false)}
              className="bg-white hover:bg-slate-100 text-slate-500 font-bold px-3.5 py-1.5 rounded-xl border border-slate-200 text-[10px] uppercase cursor-pointer transition-colors shadow-sm"
            >
              Hide List
            </button>
          </div>
          <RegisteredView 
            participants={participants} 
            onAddParticipant={onAddParticipant}
            onEditParticipant={onEditParticipant}
            onDeleteParticipant={onDeleteParticipant}
          />
        </div>
      )}

      {/* Conditional Collapsible Verified Scans List Panel */}
      {showScansList && (
        <div className="bg-slate-50 border border-slate-200/60 p-6 rounded-[2.5rem] shadow-inner animate-fadeIn space-y-4">
          <div className="flex justify-between items-center px-1">
            <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Real-time Verified Scan Stream
            </h4>
            <button 
              onClick={() => setShowScansList(false)}
              className="bg-white hover:bg-slate-100 text-slate-500 font-bold px-3.5 py-1.5 rounded-xl border border-slate-200 text-[10px] uppercase cursor-pointer transition-colors shadow-sm"
            >
              Hide List
            </button>
          </div>
          
          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-150 font-bold text-slate-600 text-[10px] uppercase tracking-wider sticky top-0">
                    <th className="p-4 pl-6">Participant</th>
                    <th className="p-4">Station</th>
                    <th className="p-4 font-mono">Token Number</th>
                    <th className="p-4 pr-6">Time Scanned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {successEntries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-slate-400 font-medium">
                        No verified scans recorded yet. Start scanning to see activity stream!
                      </td>
                    </tr>
                  ) : (
                    successEntries.map(({ activityName, entry }, idx) => (
                      <tr key={entry.id || idx} className="hover:bg-slate-50/40 text-slate-700 transition-colors">
                        <td className="p-4 pl-6">
                          <div className="font-extrabold text-slate-800 text-xs">{entry.name}</div>
                          <div className="font-mono text-[10px] text-slate-400 mt-0.5">{entry.studentID || 'No Student ID'}</div>
                        </td>
                        <td className="p-4">
                          <span className="bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-1 rounded-xl text-[10px] uppercase tracking-wide">
                            {activityName}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-emerald-600">
                          #{entry.tokenNumber}
                        </td>
                        <td className="p-4 font-mono text-[10px] text-slate-500 pr-6">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Conditional Collapsible Duplicate Scan Attempts Panel */}
      {showDuplicatesList && (
        <div className="bg-slate-50 border border-slate-200/60 p-6 rounded-[2.5rem] shadow-inner animate-fadeIn space-y-4">
          <div className="flex justify-between items-center px-1">
            <h4 className="text-xs font-bold text-rose-600 uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 animate-bounce" /> Duplicate Check-in Attempts Blocked
            </h4>
            <button 
              onClick={() => setShowDuplicatesList(false)}
              className="bg-white hover:bg-slate-100 text-slate-500 font-bold px-3.5 py-1.5 rounded-xl border border-slate-200 text-[10px] uppercase cursor-pointer transition-colors shadow-sm"
            >
              Hide List
            </button>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-150 font-bold text-slate-600 text-[10px] uppercase tracking-wider sticky top-0">
                    <th className="p-4 pl-6">Participant Name</th>
                    <th className="p-4">Attempted Station</th>
                    <th className="p-4 font-mono">Token</th>
                    <th className="p-4">Reason</th>
                    <th className="p-4 pr-6">Time Blocked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {duplicateEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400 font-medium">
                        Great! No duplicate check-in attempts have been blocked yet.
                      </td>
                    </tr>
                  ) : (
                    duplicateEntries.map(({ activityName, entry }, idx) => (
                      <tr key={entry.id || idx} className="hover:bg-slate-50/40 text-slate-700 transition-colors">
                        <td className="p-4 pl-6">
                          <div className="font-extrabold text-slate-800 text-xs">{entry.name || 'Unknown QR Code'}</div>
                          <div className="font-mono text-[10px] text-slate-400 mt-0.5">{entry.studentID || 'No Student ID'}</div>
                        </td>
                        <td className="p-4">
                          <span className="bg-rose-50 text-rose-700 font-extrabold px-2.5 py-1 rounded-xl text-[10px] uppercase tracking-wide">
                            {activityName}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-rose-600">
                          #{entry.tokenNumber || 'N/A'}
                        </td>
                        <td className="p-4 text-rose-500 font-semibold text-[10px]">
                          {entry.reason || 'Duplicate scan rejected'}
                        </td>
                        <td className="p-4 font-mono text-[10px] text-slate-500 pr-6">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Activity Stations Selection Section */}
      <div>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2 px-1">
          <Grid className="w-4 h-4" /> Active Activity Stations
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {activities.map((act) => {
            const actLogs = logs[act.id] || [];
            const scannedCount = actLogs.filter(l => l.status === 'success').length;
            const duplicateCount = actLogs.filter(l => l.status === 'duplicate').length;
            const remaining = Math.max(0, totalParticipants - scannedCount);
            
            const progressPercent = totalParticipants > 0 
              ? Math.min(100, Math.round((scannedCount / totalParticipants) * 100))
              : 0;

            const getIconColors = (id: string) => {
              if (id.includes('check-in')) return { bg: 'bg-blue-100', text: 'text-indigo-600' };
              if (id.includes('check-out')) return { bg: 'bg-rose-100', text: 'text-rose-600' };
              if (id.includes('t-shirt')) return { bg: 'bg-orange-100', text: 'text-orange-600' };
              if (id.includes('food')) return { bg: 'bg-emerald-100', text: 'text-emerald-600' };
              if (id.includes('certificate')) return { bg: 'bg-purple-100', text: 'text-purple-600' };
              return { bg: 'bg-indigo-100', text: 'text-indigo-600' };
            };

            const colors = getIconColors(act.id);
            const isCompleted = progressPercent === 100 && totalParticipants > 0;

            return (
              <div 
                key={act.id} 
                onClick={() => onSelectActivity(act.id)}
                className={`relative overflow-hidden bg-white rounded-[2rem] p-6 shadow-sm border transition-all cursor-pointer group hover:shadow-md ${
                  isCompleted 
                    ? 'border-emerald-300 hover:border-emerald-400 bg-gradient-to-br from-white to-emerald-50/10' 
                    : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                {/* 100% Completed Stamp Seal */}
                {isCompleted && (
                  <div className="absolute top-[-10px] right-[-10px] pointer-events-none select-none z-10 animate-stamp">
                    <div className="relative flex items-center justify-center p-3">
                      {/* Ripple ring indicators */}
                      <div className="absolute w-20 h-20 rounded-full border-2 border-dashed border-emerald-500/20 bg-emerald-500/5 animate-ripple"></div>
                      <div className="absolute w-20 h-20 rounded-full border border-emerald-500/10 bg-emerald-500/5 animate-ripple" style={{ animationDelay: '0.8s' }}></div>
                      
                      {/* The physical watermark seal badge */}
                      <div className="w-20 h-20 rounded-full bg-white/80 border-4 border-double border-emerald-500/45 text-emerald-600 flex flex-col items-center justify-center shadow-md backdrop-blur-[1px]">
                        <div className="w-full h-full rounded-full border border-dashed border-emerald-500/35 flex flex-col items-center justify-center p-1">
                          <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
                          <span className="text-[7px] font-black tracking-[0.12em] text-emerald-600 uppercase leading-none mt-1.5">COMPLETED</span>
                          <span className="text-[5px] font-bold text-emerald-400 tracking-wider mt-0.5">100% VERIFIED</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-start justify-between mb-4">
                    <span className={`text-2xl font-semibold w-14 h-14 ${colors.bg} ${colors.text} rounded-2xl flex items-center justify-center transition-all group-hover:scale-105 shadow-sm`}>
                      {act.icon}
                    </span>
                    {!isCompleted && (
                      <span className={`text-xs ${colors.text} ${colors.bg} font-bold py-1 px-3 rounded-full uppercase`}>
                        {progressPercent}% Done
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors pr-8">
                    {act.name}
                  </h3>
                  
                  <div className="flex justify-between mt-4">
                    <p className="text-slate-500 text-sm">Scanned: <span className="text-slate-900 font-semibold">{scannedCount}</span></p>
                    <p className="text-slate-500 text-sm">Remaining: <span className="text-slate-900 font-semibold">{remaining}</span></p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="w-full bg-slate-100 rounded-full h-2 mr-4 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCompleted ? 'bg-emerald-500' :
                        act.id.includes('check-in') ? 'bg-blue-500' :
                        act.id.includes('check-out') ? 'bg-rose-500' :
                        act.id.includes('t-shirt') ? 'bg-orange-500' :
                        act.id.includes('food') ? 'bg-emerald-500' :
                        act.id.includes('certificate') ? 'bg-purple-500' : 'bg-indigo-500'
                      }`} 
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectActivity(act.id);
                    }}
                    className={`flex h-10 w-10 rounded-full items-center justify-center transition-all border-0 cursor-pointer active:scale-90 flex-shrink-0 ${
                      isCompleted 
                        ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white' 
                        : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-600 group-hover:text-white'
                    }`}
                    title={`Open ${act.name}`}
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced SVG Analytics Charts */}
      <div className="grid grid-cols-1 gap-6">
        {/* Overall Event Scan Completion Rate */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-indigo-500" />
                Overall Event Scan Completion
              </h3>
              <p className="text-[11px] text-slate-400">Consolidated operational scan completion status across all active event stations</p>
            </div>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
              Operation Status
            </span>
          </div>

          <div className="pt-1">
            {totalParticipants === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl text-center p-4">
                <Users className="w-8 h-8 text-slate-300 mb-1" />
                <span className="text-xs font-semibold text-slate-400">Database Empty</span>
                <span className="text-[10px] text-slate-300">Import participant list to verify event analytics</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-4">
                
                {/* Circular Gauge Progress Indicator */}
                <div className="flex flex-col items-center relative">
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      {/* Grey background circle */}
                      <circle
                        cx="88"
                        cy="88"
                        r="68"
                        className="stroke-slate-100"
                        strokeWidth="14"
                        fill="transparent"
                      />
                      {/* Indigo gradient-like progress circle */}
                      <circle
                        cx="88"
                        cy="88"
                        r="68"
                        className="stroke-indigo-600 transition-all duration-1000 ease-out"
                        strokeWidth="14"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 68}
                        strokeDashoffset={2 * Math.PI * 68 - (overallScanPercent / 100) * (2 * Math.PI * 68)}
                        strokeLinecap="round"
                      />
                    </svg>
                    
                    {/* Centered Percentage Text */}
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-4xl font-black text-slate-800 tracking-tight leading-none">
                        {overallScanPercent}%
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1.5">
                        Completed
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mt-4">
                    {totalScannedAll} valid scans out of {totalPossibleScans} expected ({overallScanPercent}% complete)
                  </p>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* Operator Name at the very bottom */}
      {databaseManagerName && (
        <div className="flex justify-center items-center py-5 bg-slate-50/50 rounded-3xl p-4 border border-slate-100">
          <p className="text-slate-500 text-xs flex flex-wrap justify-center items-center gap-2 font-semibold">
            <span className="text-slate-400 font-medium">Systems operated by</span>
            <span className="text-[10px] font-black tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 uppercase flex items-center gap-1.5 shadow-sm">
              👤 Operator: {databaseManagerName}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
