/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Participant, Activity, ScanLogEntry, ActivityLogs } from '../types';
import { 
  Search, 
  Edit2, 
  Trash2, 
  Filter, 
  Calendar, 
  User, 
  Tag, 
  X, 
  Check, 
  CheckCircle,
  FileDown,
  AlertCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface VerifiedViewProps {
  activities: Activity[];
  participants: Participant[];
  logs: ActivityLogs;
  onUpdateLogEntry: (activityId: string, entryId: string, updatedFields: Partial<ScanLogEntry>) => void;
  onDeleteLogEntry: (activityId: string, entryId: string) => void;
  eventName?: string;
}

export default function VerifiedView({
  activities,
  participants,
  logs,
  onUpdateLogEntry,
  onDeleteLogEntry,
  eventName
}: VerifiedViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState<string>('all');
  
  // Editing state
  const [editingEntry, setEditingEntry] = useState<{
    activityId: string;
    entry: ScanLogEntry;
  } | null>(null);

  // Form states for editing
  const [editName, setEditName] = useState('');
  const [editStudentID, setEditStudentID] = useState('');
  const [editTokenNumber, setEditTokenNumber] = useState('');
  const [editTimestamp, setEditTimestamp] = useState('');
  const [editStatus, setEditStatus] = useState<'success' | 'duplicate' | 'invalid'>('success');
  const [editReason, setEditReason] = useState('');

  // Collect all verified/scanned log entries across all activities
  const allEntries: { activityId: string; activityName: string; entry: ScanLogEntry }[] = [];
  
  Object.entries(logs).forEach(([actId, entryList]) => {
    const act = activities.find(a => a.id === actId);
    const actName = act ? act.name : actId;
    entryList.forEach(entry => {
      // By default, show success (verified) logs, but let's let them view/edit all logs if they want, or focus on Verified.
      // The user requested: "different page just for verified participant" - but also "edit this history"
      // We will show all success (verified) logs, but they can edit status too!
      if (entry.status === 'success') {
        allEntries.push({
          activityId: actId,
          activityName: actName,
          entry
        });
      }
    });
  });

  // Filter entries
  const filteredEntries = allEntries.filter(item => {
    const matchesActivity = selectedActivityId === 'all' || item.activityId === selectedActivityId;
    const normSearch = searchQuery.toLowerCase().trim();
    const matchesSearch = !normSearch || 
      item.entry.name.toLowerCase().includes(normSearch) ||
      item.entry.studentID.toLowerCase().includes(normSearch) ||
      item.entry.tokenNumber.toString().includes(normSearch) ||
      item.activityName.toLowerCase().includes(normSearch);
    
    return matchesActivity && matchesSearch;
  });

  // Open edit modal
  const handleStartEdit = (activityId: string, entry: ScanLogEntry) => {
    setEditingEntry({ activityId, entry });
    setEditName(entry.name);
    setEditStudentID(entry.studentID);
    setEditTokenNumber(entry.tokenNumber);
    setEditTimestamp(entry.timestamp);
    setEditStatus(entry.status);
    setEditReason(entry.reason || '');
  };

  // Save edit changes
  const handleSaveEdit = () => {
    if (!editingEntry) return;
    if (!editName.trim()) {
      alert('Name cannot be empty.');
      return;
    }

    onUpdateLogEntry(editingEntry.activityId, editingEntry.entry.id, {
      name: editName.trim(),
      studentID: editStudentID.trim(),
      tokenNumber: editTokenNumber.trim(),
      timestamp: editTimestamp,
      status: editStatus,
      reason: editReason.trim(),
    });

    setEditingEntry(null);
  };

  // Delete entry
  const handleDelete = (activityId: string, entryId: string, name: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete the check-in history entry for "${name}"? This will allow them to scan/check-in again.`);
    if (confirmed) {
      onDeleteLogEntry(activityId, entryId);
    }
  };

  // Excel CSV Export
  const downloadAllCSV = () => {
    if (filteredEntries.length === 0) {
      alert('No history entries to export.');
      return;
    }

    const headers = ['Timestamp', 'Station/Activity', 'Token Number', 'Student ID', 'Full Name', 'Status'];
    const rows = filteredEntries.map(item => [
      new Date(item.entry.timestamp).toLocaleString(),
      item.activityName,
      item.entry.tokenNumber,
      item.entry.studentID,
      item.entry.name,
      item.entry.status.toUpperCase()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CivilScanner_Verified_Participants.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Operational Report Export
  const downloadPDFReport = () => {
    if (filteredEntries.length === 0) {
      alert('No verified entries to export.');
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const selectedStationName = selectedActivityId === 'all' 
        ? 'All Stations' 
        : (activities.find(a => a.id === selectedActivityId)?.name || 'Station');

      const titleText = eventName ? `${eventName} - Verified Scan Logs` : 'Verified Scan Logs';
      const subTitleText = selectedActivityId === 'all' 
        ? 'Consolidated operational report for all scanning stations'
        : `Operational report for station: ${selectedStationName}`;

      // Header Banner
      doc.setFillColor(79, 70, 229); // Indigo-600
      doc.rect(0, 0, 210, 35, 'F');

      // Title & Metadata
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(titleText, 15, 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(subTitleText, 15, 23);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, 29);
      doc.text(`Total Records: ${filteredEntries.length}`, 160, 29);

      // Add a small Statistics Summary block
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Log Summary', 15, 45);

      const summaryHeaders = [['Metric', 'Detail']];
      const summaryRows = [
        ['Event Name', eventName || 'Unspecified Event'],
        ['Station/Activity Filter', selectedStationName],
        ['Search/Filter Query', searchQuery || 'None'],
        ['Successful Scans Listed', filteredEntries.length.toString()],
      ];

      autoTable(doc, {
        startY: 48,
        head: summaryHeaders,
        body: summaryRows,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241], fontStyle: 'bold' }, // indigo-500
        margin: { left: 15, right: 15 },
        styles: { fontSize: 9 },
      });

      const tableStartY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Verified Logs Table', 15, tableStartY);

      const tableHeaders = [['Token', 'Full Name', 'Student ID', 'Station', 'Time Verified']];
      const tableRows = filteredEntries.map(item => [
        `#${item.entry.tokenNumber}`,
        item.entry.name,
        item.entry.studentID || '—',
        item.activityName,
        new Date(item.entry.timestamp).toLocaleString()
      ]);

      autoTable(doc, {
        startY: tableStartY + 3,
        head: tableHeaders,
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' }, // indigo-600
        margin: { left: 15, right: 15 },
        styles: { fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: 25, fontStyle: 'bold' },
          1: { cellWidth: 50 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
          4: { cellWidth: 35 }
        }
      });

      const cleanEventName = (eventName || 'Event_Scanner').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const cleanStationName = selectedStationName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const filename = `${cleanEventName}_${cleanStationName}_Verified_Logs_${new Date().toISOString().split('T')[0]}.pdf`;

      doc.save(filename);
    } catch (err: any) {
      console.error(err);
      alert(`Could not generate PDF: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-indigo-600" />
            Verified Participants Database
          </h2>
          <p className="text-xs text-slate-500">View, search, edit, or delete successful event verification logs</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <button
            onClick={downloadAllCSV}
            disabled={filteredEntries.length === 0}
            className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-2xl text-xs transition-all border-0 cursor-pointer shadow-md"
          >
            <FileDown className="w-4 h-4" />
            <span>Export CSV ({filteredEntries.length})</span>
          </button>

          <button
            onClick={downloadPDFReport}
            disabled={filteredEntries.length === 0}
            className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-2xl text-xs transition-all border-0 cursor-pointer shadow-md"
          >
            <FileDown className="w-4 h-4" />
            <span>Download PDF ({filteredEntries.length})</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Search */}
        <div className="md:col-span-7 relative">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search verified logs by name, student ID, token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
          />
        </div>

        {/* Activity Station Filter */}
        <div className="md:col-span-5 flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={selectedActivityId}
            onChange={(e) => setSelectedActivityId(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-50/55 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
          >
            <option value="all">All Stations / Activities</option>
            {activities.map(act => (
              <option key={act.id} value={act.id}>{act.icon} {act.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Database Table */}
      <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-150 font-bold text-slate-600 text-[10px] uppercase tracking-wider">
                <th className="p-4 pl-6">Participant Details</th>
                <th className="p-4">Verification Station</th>
                <th className="p-4 font-mono">Token Number</th>
                <th className="p-4">Time Verified</th>
                <th className="p-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-slate-400 font-medium">
                    <CheckCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    No verified history found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredEntries.map(({ activityId, activityName, entry }, idx) => (
                  <tr key={`${entry.id}-${idx}`} className="hover:bg-slate-50/40 text-slate-700 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="font-extrabold text-slate-800 text-sm">{entry.name}</div>
                      <div className="font-mono text-[11px] text-slate-400 mt-0.5">{entry.studentID || 'No Student ID'}</div>
                    </td>
                    <td className="p-4">
                      <span className="bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1 rounded-xl text-[10px] uppercase tracking-wide">
                        {activityName}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold text-indigo-600">
                      #{entry.tokenNumber}
                    </td>
                    <td className="p-4 font-mono text-[11px] text-slate-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4 text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleStartEdit(activityId, entry)}
                          className="p-2 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-xl border-0 cursor-pointer transition-colors"
                          title="Edit history record"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(activityId, entry.id, entry.name)}
                          className="p-2 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl border-0 cursor-pointer transition-colors"
                          title="Remove check-in"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Edit Verification Record</h3>
                  <p className="text-[11px] text-slate-500">Update log details manually</p>
                </div>
              </div>
              <button
                onClick={() => setEditingEntry(null)}
                className="p-1.5 hover:bg-white text-slate-400 hover:text-slate-600 rounded-xl border-0 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Full Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Student ID */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> Student ID
                </label>
                <input
                  type="text"
                  value={editStudentID}
                  onChange={(e) => setEditStudentID(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Token Number */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> Token Number
                </label>
                <input
                  type="text"
                  value={editTokenNumber}
                  onChange={(e) => setEditTokenNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Timestamp */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Date & Time Verified
                </label>
                <input
                  type="datetime-local"
                  value={editTimestamp.substring(0, 16)} // Slices to format acceptable by input type
                  onChange={(e) => {
                    if (e.target.value) {
                      setEditTimestamp(new Date(e.target.value).toISOString());
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="success">VERIFIED (Success)</option>
                  <option value="duplicate">DUPLICATE</option>
                  <option value="invalid">DENIED (Invalid)</option>
                </select>
              </div>

              {/* Reason */}
              {editStatus !== 'success' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Reason</label>
                  <input
                    type="text"
                    value={editReason}
                    placeholder="Enter reason..."
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-5 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingEntry(null)}
                className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-5 rounded-xl text-xs cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
