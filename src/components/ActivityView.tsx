/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Activity, Participant, ScanLogEntry } from '../types';
import Scanner from './Scanner';
import { audioFeedback } from '../lib/audio';
import { 
  ArrowLeft, 
  Camera, 
  Search, 
  Download, 
  CheckCircle, 
  XCircle, 
  FileSpreadsheet, 
  Clock, 
  Barcode, 
  AlertCircle,
  X,
  Keyboard,
  FileDown,
  CloudLightning,
  Trash2,
  Sparkles,
  Award
} from 'lucide-react';
import { exportToExistingSpreadsheet, createNewSpreadsheetWithData } from '../lib/googleSheets';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ActivityViewProps {
  activity: Activity;
  participants: Participant[];
  logs: ScanLogEntry[];
  accessToken: string | null;
  activeSpreadsheetId: string | null;
  onBack: () => void;
  onAddLog: (entry: Omit<ScanLogEntry, 'id' | 'timestamp'>) => void;
  onDeleteLog?: (entryId: string) => void;
  primaryMatchField: string;
}

// Highly intelligent helper function to match scanned text to a participant using various advanced heuristics
export function findParticipantFromScannedText(
  rawText: string, 
  participants: Participant[],
  primaryMatchField: string = localStorage.getItem('event_qr_primary_match_field') || 'fuzzy'
): Participant | null {
  if (!rawText || !participants || participants.length === 0) return null;

  const text = rawText.trim();

  // Helper to normalize strings for robust comparison (removes spaces, hyphens, slashes, underscores, dots, and lowercases)
  const normalize = (val: string) => {
    if (!val) return '';
    return val.toString().toLowerCase().replace(/[\s\-_.\/\\#]/g, '').trim();
  };

  const normText = normalize(text);

  // If the user specified a specific primary field to match, we evaluate only that field
  if (primaryMatchField && ['studentID', 'tokenNumber', 'contactNumber', 'name'].includes(primaryMatchField)) {
    const fieldKey = primaryMatchField as keyof Participant;

    // 1. Direct match on the selected field (case-insensitive)
    const directMatch = participants.find(p => {
      const val = p[fieldKey]?.toString().trim();
      return val && val.toLowerCase() === text.toLowerCase();
    });
    if (directMatch) return directMatch;

    // 2. Normalized match on the selected field
    const directNormMatch = participants.find(p => {
      const val = p[fieldKey]?.toString().trim();
      return val && normalize(val) === normText;
    });
    if (directNormMatch) return directNormMatch;

    // 3. JSON extraction
    try {
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonStr = text.substring(jsonStart, jsonEnd + 1);
        const data = JSON.parse(jsonStr);
        
        const getVal = (keys: string[]) => {
          for (const k of Object.keys(data)) {
            const cleanK = k.toLowerCase().replace(/[\s\-_]/g, '');
            if (keys.includes(cleanK)) {
              return data[k];
            }
          }
          return null;
        };

        let targetKeys: string[] = [];
        if (primaryMatchField === 'studentID') {
          targetKeys = ['studentid', 'student', 'id', 'roll', 'reg', 'rollno', 'registration', 'registrationnumber', 'sid'];
        } else if (primaryMatchField === 'tokenNumber') {
          targetKeys = ['token', 'tokennumber', 'sl', 'serial', 'sno', 'ticket'];
        } else if (primaryMatchField === 'contactNumber') {
          targetKeys = ['contact', 'phone', 'mobile', 'contactnumber', 'phonenumber'];
        } else if (primaryMatchField === 'name') {
          targetKeys = ['name', 'fullname', 'full_name', 'participant', 'studentname', 'nameofstudent'];
        }

        const extractedVal = getVal(targetKeys);
        if (extractedVal) {
          const normExtracted = normalize(extractedVal.toString());
          const jsonMatch = participants.find(p => {
            const val = p[fieldKey]?.toString().trim();
            return val && normalize(val) === normExtracted;
          });
          if (jsonMatch) return jsonMatch;
        }
      }
    } catch (e) {
      console.warn('Fuzzy JSON parse failed:', e);
    }

    // 4. URL Parameters parsing
    try {
      if (text.includes('?') || text.includes('http://') || text.includes('https://')) {
        const queryStr = text.split('?')[1] || text;
        const params = new URLSearchParams(queryStr);
        
        let targetKeys: string[] = [];
        if (primaryMatchField === 'studentID') {
          targetKeys = ['studentID', 'studentId', 'id', 'roll', 'sid', 'reg'];
        } else if (primaryMatchField === 'tokenNumber') {
          targetKeys = ['token', 'tokenNumber', 'sl', 'serial'];
        } else if (primaryMatchField === 'contactNumber') {
          targetKeys = ['contact', 'phone', 'mobile', 'contactNumber', 'phoneNumber'];
        } else if (primaryMatchField === 'name') {
          targetKeys = ['name', 'fullName', 'participant'];
        }

        let extractedVal = null;
        for (const k of targetKeys) {
          if (params.has(k)) {
            extractedVal = params.get(k);
            break;
          }
        }

        if (extractedVal) {
          const normExtracted = normalize(extractedVal);
          const urlMatch = participants.find(p => {
            const val = p[fieldKey]?.toString().trim();
            return val && normalize(val) === normExtracted;
          });
          if (urlMatch) return urlMatch;
        }
      }
    } catch (e) {
      console.warn('URL parsing extraction failed:', e);
    }

    // 5. Delimiter segments
    const segments = text.split(/[\s,\-_.:=()\[\]|\\/;\t\r\n]+/).map(s => s.trim()).filter(Boolean);
    for (const seg of segments) {
      if (seg.length < 2) continue;
      const segNorm = normalize(seg);
      const segMatch = participants.find(p => {
        const val = p[fieldKey]?.toString().trim();
        return val && normalize(val) === segNorm;
      });
      if (segMatch) return segMatch;
    }

    // 6. Substring containment
    const substringMatch = participants.find(p => {
      const val = p[fieldKey]?.toString().trim();
      if (val && val.length >= 3) {
        if (text.toLowerCase().includes(val.toLowerCase()) || normalize(text).includes(normalize(val))) {
          return true;
        }
      }
      return false;
    });
    if (substringMatch) return substringMatch;

    return null;
  }

  // Fallback heuristic 1: Direct exact match on student ID, token, contact, or name
  const directMatch = participants.find(p => {
    const sId = p.studentID?.toString().trim();
    const token = p.tokenNumber?.toString().trim();
    const name = p.name?.toString().trim();
    const contact = p.contactNumber?.toString().trim();

    return (
      (sId && sId.toLowerCase() === text.toLowerCase()) ||
      (token && token === text) ||
      (name && name.toLowerCase() === text.toLowerCase()) ||
      (contact && contact === text)
    );
  });
  if (directMatch) return directMatch;

  // Fallback heuristic 2: Normalized exact match on student ID or token number (ignoring dashes, slashes, spaces)
  if (normText.length >= 2) {
    const directNormMatch = participants.find(p => {
      const sIdNorm = p.studentID ? normalize(p.studentID) : '';
      const tokenNorm = p.tokenNumber ? normalize(p.tokenNumber) : '';
      const contactNorm = p.contactNumber ? normalize(p.contactNumber) : '';
      return (
        (sIdNorm && sIdNorm === normText) || 
        (tokenNorm && tokenNorm === normText) ||
        (contactNorm && contactNorm === normText)
      );
    });
    if (directNormMatch) return directNormMatch;
  }

  // Fallback heuristic 3: Handle JSON format nested anywhere in text
  try {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const jsonStr = text.substring(jsonStart, jsonEnd + 1);
      const data = JSON.parse(jsonStr);
      
      const getVal = (keys: string[]) => {
        for (const k of Object.keys(data)) {
          const cleanK = k.toLowerCase().replace(/[\s\-_]/g, '');
          if (keys.includes(cleanK)) {
            return data[k];
          }
        }
        return null;
      };

      const sId = getVal(['studentid', 'student', 'id', 'roll', 'reg', 'rollno', 'registration', 'registrationnumber', 'sid']);
      const token = getVal(['token', 'tokennumber', 'sl', 'serial', 'sno', 'ticket']);
      const name = getVal(['name', 'fullname', 'full_name', 'participant', 'studentname', 'nameofstudent']);
      const contact = getVal(['contact', 'phone', 'mobile', 'contactnumber', 'phonenumber']);

      const jsonMatch = participants.find(p => {
        const pId = p.studentID?.toString().trim().toLowerCase();
        const pToken = p.tokenNumber?.toString().trim().toLowerCase();
        const pName = p.name?.toString().trim().toLowerCase();
        const pContact = p.contactNumber?.toString().trim().toLowerCase();

        if (sId && pId && pId === sId.toString().trim().toLowerCase()) return true;
        if (token && pToken && pToken === token.toString().trim().toLowerCase()) return true;
        if (name && pName && pName === name.toString().trim().toLowerCase()) return true;
        if (contact && pContact && pContact === contact.toString().trim().toLowerCase()) return true;
        
        // Try normalized checks for JSON field extraction too
        if (sId && pId && normalize(pId) === normalize(sId.toString())) return true;
        if (token && pToken && normalize(pToken) === normalize(token.toString())) return true;
        
        return false;
      });

      if (jsonMatch) return jsonMatch;
    }
  } catch (e) {
    console.warn('Fuzzy JSON parse failed:', e);
  }

  // Fallback heuristic 4: URL Parameters parsing (e.g. Google Forms / custom QR web links)
  try {
    if (text.includes('?') || text.includes('http://') || text.includes('https://')) {
      const queryStr = text.split('?')[1] || text;
      const params = new URLSearchParams(queryStr);
      
      const sId = params.get('studentID') || params.get('studentId') || params.get('id') || params.get('roll') || params.get('sid') || params.get('reg');
      const token = params.get('token') || params.get('tokenNumber') || params.get('sl') || params.get('serial');
      const name = params.get('name') || params.get('fullname') || params.get('participant');

      const urlMatch = participants.find(p => {
        const pId = p.studentID?.toString().trim().toLowerCase();
        const pToken = p.tokenNumber?.toString().trim().toLowerCase();
        const pName = p.name?.toString().trim().toLowerCase();

        if (sId && pId && pId === sId.trim().toLowerCase()) return true;
        if (token && pToken && pToken === token.trim().toLowerCase()) return true;
        if (name && pName && pName === name.trim().toLowerCase()) return true;
        
        if (sId && pId && normalize(pId) === normalize(sId)) return true;
        if (token && pToken && normalize(pToken) === normalize(token)) return true;
        return false;
      });

      if (urlMatch) return urlMatch;
    }
  } catch (e) {
    console.warn('URL parsing extraction failed:', e);
  }

  // Fallback heuristic 5: Split text by all standard delimiters
  const segments = text.split(/[\s,\-_.:=()\[\]|\\/;\t\r\n]+/).map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    if (seg.length < 2) continue; // Skip single characters to prevent false matches (e.g. size 'M')
    const segLower = seg.toLowerCase();
    const segNorm = normalize(seg);

    const segMatch = participants.find(p => {
      const pId = p.studentID?.toString().trim().toLowerCase();
      const pToken = p.tokenNumber?.toString().trim().toLowerCase();
      
      return (
        pId === segLower || 
        pToken === segLower ||
        (pId && normalize(pId) === segNorm) ||
        (pToken && normalize(pToken) === segNorm)
      );
    });

    if (segMatch) return segMatch;
  }

  // Fallback heuristic 6: Substring scanning
  const substringMatch = participants.find(p => {
    const sId = p.studentID?.toString().trim();
    if (sId && sId.length >= 4) {
      if (text.toLowerCase().includes(sId.toLowerCase()) || normalize(text).includes(normalize(sId))) {
        return true;
      }
    }

    const token = p.tokenNumber?.toString().trim();
    if (token && token.length >= 3) {
      if (text.includes(token)) {
        return true;
      }
    }

    return false;
  });
  if (substringMatch) return substringMatch;

  // Fallback heuristic 7: Fuzzy Name containment
  const nameContainMatch = participants.find(p => {
    const name = p.name?.toString().trim().toLowerCase();
    if (name && name.length >= 5) {
      if (text.toLowerCase().includes(name) || name.includes(text.toLowerCase())) {
        return true;
      }
    }
    return false;
  });
  if (nameContainMatch) return nameContainMatch;

  return null;
}

export default function ActivityView({
  activity,
  participants,
  logs,
  accessToken,
  activeSpreadsheetId,
  onBack,
  onAddLog,
  onDeleteLog,
  primaryMatchField,
}: ActivityViewProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualInput, setManualInput] = useState('');
  
  // Scans history filter
  const [historySearch, setHistorySearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scanned' | 'pending'>('scanned');

  // Scanning feedback state (popups)
  const [popup, setPopup] = useState<{
    show: boolean;
    type: 'success' | 'duplicate' | 'invalid';
    title: string;
    name: string;
    tokenNumber: string;
    studentID: string;
    reason?: string;
  } | null>(null);

  // PDF report pop-up when station achieves 100% completion (last scan)
  const [showCompletionPdfModal, setShowCompletionPdfModal] = useState(false);
  const [prevScannedCount, setPrevScannedCount] = useState<number | null>(null);

  useEffect(() => {
    const currentScannedCount = logs.filter(l => l.status === 'success').length;
    if (prevScannedCount === null) {
      setPrevScannedCount(currentScannedCount);
      return;
    }

    if (
      currentScannedCount === participants.length &&
      prevScannedCount < participants.length &&
      participants.length > 0
    ) {
      // Small timeout so the scan success popup shows first
      const timer = setTimeout(() => {
        setShowCompletionPdfModal(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
    setPrevScannedCount(currentScannedCount);
  }, [logs, participants.length, prevScannedCount]);

  // Auto-dismiss popup timer
  useEffect(() => {
    if (popup?.show) {
      const timer = setTimeout(() => {
        setPopup(null);
      }, 4500); // Auto close after 4.5s
      return () => clearTimeout(timer);
    }
  }, [popup]);

  // Listen for simulated scans from the Simulation Hub
  useEffect(() => {
    const handleSimulatedScan = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        handleQRDecoded(customEvent.detail);
      }
    };
    window.addEventListener('simulated-qr-scan', handleSimulatedScan);
    return () => {
      window.removeEventListener('simulated-qr-scan', handleSimulatedScan);
    };
  }, [logs, participants, popup]);

  // Handle parsing a scanned QR text
  const handleQRDecoded = (text: string) => {
    // If a popup is already active, ignore scans to prevent accidental double-scanning of the same card
    if (popup && popup.show) return;

    const match = findParticipantFromScannedText(text, participants, primaryMatchField);

    if (!match) {
      // Unrecognized raw data or participant not in the imported list
      const previewText = text.length > 50 ? text.substring(0, 50) + '...' : text;
      triggerScanResult({
        type: 'invalid',
        title: '❌ Access Denied',
        name: 'Unrecognized Data',
        studentID: 'None',
        tokenNumber: 'None',
        reason: `Could not match scanned data: "${previewText}". Please check if participant exists in Master sheet.`
      });
      return;
    }

    processScanMatch(match);
  };

  // Perform sheet matching verification
  const processScanMatch = (match: Participant) => {
    // Check duplicates in this activity's successful scan history
    const isDuplicate = logs.some(
      entry => 
        entry.status === 'success' && 
        ((match.studentID && entry.studentID === match.studentID) || 
         (match.tokenNumber && entry.tokenNumber === match.tokenNumber))
    );

    if (isDuplicate) {
      // Duplicate scanned!
      triggerScanResult({
        type: 'duplicate',
        title: 'Already Scanned',
        name: match.name,
        studentID: match.studentID,
        tokenNumber: match.tokenNumber,
        reason: 'Duplicate check-in rejected'
      });
      return;
    }

    // Perfect check-in!
    triggerScanResult({
      type: 'success',
      title: '✅ Welcome',
      name: match.name,
      studentID: match.studentID,
      tokenNumber: match.tokenNumber,
    });
  };

  const triggerScanResult = (result: {
    type: 'success' | 'duplicate' | 'invalid';
    title: string;
    name: string;
    studentID: string;
    tokenNumber: string;
    reason?: string;
  }) => {
    // Play sound based on result
    if (result.type === 'success') {
      audioFeedback.playSuccess();
      // Write log entry in App State
      onAddLog({
        studentID: result.studentID,
        tokenNumber: result.tokenNumber,
        name: result.name,
        status: 'success',
      });
    } else {
      audioFeedback.playError();
      // Record failed/duplicate scan for statistics
      onAddLog({
        studentID: result.studentID,
        tokenNumber: result.tokenNumber,
        name: result.name,
        status: result.type,
        reason: result.reason || '',
      });
    }

    // Trigger popup
    setPopup({
      show: true,
      ...result,
    });
  };

  // Handle Manual Token / ID search & verify
  const handleManualVerify = () => {
    if (!manualInput.trim()) return;
    
    // Search using the same highly intelligent matching rules!
    const match = findParticipantFromScannedText(manualInput, participants);

    if (!match) {
      triggerScanResult({
        type: 'invalid',
        title: '❌ Access Denied',
        name: 'Manual Entry: ' + manualInput,
        studentID: '',
        tokenNumber: '',
        reason: 'No matching student ID, token number, contact, or name found in Master list.'
      });
    } else {
      processScanMatch(match);
    }
    
    setManualInput('');
  };

  // File download formatting (CSV generation)
  const downloadCSV = () => {
    const activityLogs = logs.filter(l => l.status === 'success');
    if (activityLogs.length === 0) {
      alert('No scan history to export yet.');
      return;
    }

    const headers = ['Timestamp', 'Token Number', 'Student ID', 'Full Name', 'Status'];
    const rows = activityLogs.map(l => [
      new Date(l.timestamp).toLocaleString(),
      l.tokenNumber,
      l.studentID,
      l.name,
      'VERIFIED'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activity.name.replace(/\s+/g, '_')}_Log.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Google Sheets Export
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const handleGoogleSheetsExport = async () => {
    if (!accessToken) {
      alert('Authentication required! Please sign in with Google on the Admin Settings tab first.');
      return;
    }

    const successfulLogs = logs.filter(l => l.status === 'success');
    if (successfulLogs.length === 0) {
      alert('No verified scans in log to export.');
      return;
    }

    const confirmed = window.confirm(
      `Do you want to export ${successfulLogs.length} verified scans of "${activity.name}" to Google Sheets? This will create or update a tab inside the event sheet.`
    );
    if (!confirmed) return;

    setIsExportingSheets(true);
    try {
      const headers = ['Timestamp', 'Token Number', 'Student ID', 'Full Name', 'Activity Status'];
      const rows = successfulLogs.map(l => [
        new Date(l.timestamp).toISOString(),
        l.tokenNumber,
        l.studentID,
        l.name,
        'VERIFIED'
      ]);

      const tabTitle = `${activity.name} Log`;

      if (activeSpreadsheetId) {
        // Export to current active spreadsheet
        await exportToExistingSpreadsheet(accessToken, activeSpreadsheetId, tabTitle, headers, rows);
        alert(`Successfully exported logs to spreadsheet tab: "${tabTitle}"!`);
      } else {
        // Create a new spreadsheet in user Drive
        const sheetTitle = `Event Verification Log - ${activity.name}`;
        const newSheet = await createNewSpreadsheetWithData(accessToken, sheetTitle, tabTitle, headers, rows);
        alert(`Created new Google Spreadsheet with logs! File name: "${sheetTitle}"\nURL: ${newSheet.url}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Sheets Export Failed: ${err.message || 'Network error occurred.'}`);
    } finally {
      setIsExportingSheets(false);
    }
  };

  // Filter logs list based on search (only verified success logs)
  const filteredLogs = logs.filter(
    l => 
      l.status === 'success' && (
        l.name.toLowerCase().includes(historySearch.toLowerCase()) ||
        l.studentID.toLowerCase().includes(historySearch.toLowerCase()) ||
        l.tokenNumber.toString().includes(historySearch)
      )
  );

  const scannedCount = logs.filter(l => l.status === 'success').length;
  const duplicateCount = logs.filter(l => l.status === 'duplicate').length;
  const remainingCount = Math.max(0, participants.length - scannedCount);

  // Pending (not scanned yet) calculations
  const scannedTokens = new Set(
    logs
      .filter(l => l.status === 'success')
      .map(l => l.tokenNumber)
  );
  const scannedStudentIDs = new Set(
    logs
      .filter(l => l.status === 'success' && l.studentID)
      .map(l => l.studentID)
  );

  const pendingParticipants = participants.filter(p => {
    const hasTokenScanned = p.tokenNumber && scannedTokens.has(p.tokenNumber);
    const hasStudentIDScanned = p.studentID && scannedStudentIDs.has(p.studentID);
    return !hasTokenScanned && !hasStudentIDScanned;
  });

  const filteredPending = pendingParticipants.filter(p => {
    const normSearch = historySearch.toLowerCase().trim();
    return !normSearch || 
      p.name?.toLowerCase().includes(normSearch) ||
      p.studentID?.toLowerCase().includes(normSearch) ||
      p.tokenNumber?.toString().includes(normSearch) ||
      p.contactNumber?.toLowerCase().includes(normSearch) ||
      p.tShirtSize?.toLowerCase().includes(normSearch);
  });

  // Export pending participants list to CSV
  const downloadPendingCSV = () => {
    if (pendingParticipants.length === 0) {
      alert('No pending participants.');
      return;
    }

    const headers = ['Token Number', 'Student ID', 'Full Name', 'Contact Number', 'T-Shirt Size'];
    const rows = pendingParticipants.map(p => [
      p.tokenNumber || '',
      p.studentID || '',
      p.name || '',
      p.contactNumber || '',
      p.tShirtSize || 'M'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activity.name.replace(/\s+/g, '_')}_Pending_List.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export full station logs to a styled PDF report
  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const currentEventName = localStorage.getItem('event_qr_event_name') || 'Event Scanner';
      const titleText = `${currentEventName} - Verification Report`;
      const subTitleText = `Verification logs for Station: ${activity.name}`;

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
      doc.text(`Total Scanned: ${scannedCount} / ${participants.length}`, 145, 29);

      // Summary Table
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Station Summary', 15, 45);

      const summaryHeaders = [['Metric', 'Detail']];
      const summaryRows = [
        ['Event Name', currentEventName],
        ['Station / Activity', activity.name],
        ['Scanned Participants', `${scannedCount} of ${participants.length} (100% Completed)`],
        ['Completion Status', 'FULLY VERIFIED - 100% COMPLETED'],
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
      doc.text('Scanned Participants Table', 15, tableStartY);

      const tableHeaders = [['Token', 'Full Name', 'Student ID', 'Status', 'Time Verified']];
      const tableRows = logs
        .filter(l => l.status === 'success')
        .map(l => [
          `#${l.tokenNumber}`,
          l.name,
          l.studentID || '—',
          'VERIFIED',
          new Date(l.timestamp || Date.now()).toLocaleString()
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
          1: { cellWidth: 55 },
          2: { cellWidth: 40 },
          3: { cellWidth: 25 },
          4: { cellWidth: 45 }
        }
      });

      const cleanEvent = currentEventName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const cleanStation = activity.name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const filename = `${cleanEvent}_${cleanStation}_Completion_Report.pdf`;

      doc.save(filename);
    } catch (err: any) {
      console.error(err);
      alert(`Could not generate PDF completion report: ${err.message}`);
    }
  };

  const isCompleted = participants.length > 0 && scannedCount === participants.length;

  return (
    <div className="space-y-6 relative animate-fadeIn">
      
      {/* Activity Header */}
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-100 p-5 rounded-3xl">
        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition-all border-0 cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-2xl p-1 bg-slate-50 rounded-xl">{activity.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{activity.name} Status</h2>
              <p className="text-xs text-slate-400">Scan and verify participant credentials</p>
            </div>
          </div>
        </div>

        {/* Real-time Counter Pills */}
        <div className="flex flex-wrap gap-2 relative z-10">
          <div className="bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Scanned: {scannedCount}</span>
          </div>
          <div className="bg-slate-50 text-slate-600 px-3.5 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Remaining: {remainingCount}</span>
          </div>
          <div className="bg-rose-50 text-rose-700 px-3.5 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />
            <span>Dupes: {duplicateCount}</span>
          </div>
        </div>
      </div>

      {/* Completion Celebration Seal Banner */}
      {isCompleted && (
        <div className="bg-emerald-50/60 border border-emerald-100 p-5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn relative overflow-hidden shadow-sm">
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shine pointer-events-none"></div>
          
          <div className="flex items-center gap-3.5 z-10">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-emerald-400/30 animate-ping"></div>
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                Station Scan 100% Completed! 🎉
              </h3>
              <p className="text-xs text-emerald-800 font-medium">
                Awesome! All <strong className="text-emerald-950 font-black">{participants.length}</strong> registered participants have successfully checked in at this station!
              </p>
            </div>
          </div>
          
          <div className="z-10 bg-emerald-600/10 text-emerald-800 border border-emerald-200/50 text-[10px] font-black tracking-widest px-4 py-2 rounded-full uppercase shadow-sm">
            🛡️ 100% VERIFIED
          </div>
        </div>
      )}

      {/* Main operational sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Scanner Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-100 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-500" /> Live Event Camera
              </h3>
              
              <button
                onClick={() => setShowScanner(!showScanner)}
                className={`text-xs font-bold py-1.5 px-3.5 rounded-xl transition-all border-0 cursor-pointer ${showScanner ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
              >
                {showScanner ? 'Close Scanner' : 'Activate Camera'}
              </button>
            </div>

            {/* Embed Scanner */}
            <div className="py-2">
              <Scanner onScanSuccess={handleQRDecoded} isActive={showScanner} />
            </div>
          </div>

          {/* Manual Entry Fallback */}
          <div className="border-t border-slate-50 pt-5 mt-5">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2 mb-3">
              <Keyboard className="w-4 h-4 text-slate-400" /> Manual Verification Search
            </h4>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter Student ID or Token..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualVerify()}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono"
                />
              </div>
              <button
                onClick={handleManualVerify}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all border-0 cursor-pointer shadow-sm active:scale-95"
              >
                Verify
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
              If a participant's printed QR code is torn, verify manually by typing their ID or numeric Token code.
            </p>
          </div>
        </div>

        {/* History logs panel */}
        <div className="lg:col-span-7 bg-white border border-slate-100 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" /> Station Scan Status
              </h3>

              {/* Exports dropdown/row */}
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={activeTab === 'scanned' ? downloadCSV : downloadPendingCSV}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-1.5 px-3.5 rounded-xl text-xs border-0 cursor-pointer transition-all"
                  title={activeTab === 'scanned' ? "Download CSV report" : "Download Pending CSV report"}
                >
                  <FileDown className="w-4 h-4 text-slate-400" />
                  <span>{activeTab === 'scanned' ? 'Excel CSV' : 'Export Pending'}</span>
                </button>
                
                {activeTab === 'scanned' && (
                  <button
                    onClick={handleGoogleSheetsExport}
                    disabled={isExportingSheets}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-700 font-bold py-1.5 px-3.5 rounded-xl text-xs border-0 cursor-pointer transition-all"
                    title="Upload to active Google Sheet"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    <span>{isExportingSheets ? 'Exporting...' : 'Google Sheets'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tab Toggles */}
            <div className="flex border-b border-slate-100 mb-4 gap-1">
              <button
                onClick={() => setActiveTab('scanned')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'scanned'
                    ? 'border-indigo-600 text-indigo-600 font-extrabold'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
                }`}
              >
                Scan History ({scannedCount})
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'pending'
                    ? 'border-indigo-600 text-indigo-600 font-extrabold'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
                }`}
              >
                Pending List ({remainingCount})
              </button>
            </div>

            {/* Filter Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={
                  activeTab === 'scanned'
                    ? "Search history by name, ID, or token..."
                    : "Search pending participants by name, ID, or token..."
                }
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>

            {/* Scan History Log Grid */}
            <div className="border border-slate-50 rounded-2xl overflow-x-auto max-h-[310px] overflow-y-auto">
              {activeTab === 'scanned' ? (
                filteredLogs.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-slate-50/20 text-slate-400 text-xs">
                    {historySearch ? 'No matching records found' : 'No scans recorded yet at this station'}
                  </div>
                ) : (
                  <table className="w-full min-w-[450px] sm:min-w-0 text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4 font-mono">Time</th>
                        <th className="py-2.5 px-3">Token</th>
                        <th className="py-2.5 px-3">Participant</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredLogs.slice().reverse().map((entry, idx) => (
                        <tr key={`${entry.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-4 text-[10px] text-slate-400 font-mono">
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3 text-xs font-bold text-indigo-600 font-mono">
                            #{entry.tokenNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="text-xs font-semibold text-slate-800 leading-none">{entry.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{entry.studentID}</p>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2.5">
                              {entry.status === 'success' && (
                                <span className="inline-block text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                                  VERIFIED
                                </span>
                              )}
                              {entry.status === 'duplicate' && (
                                <span className="inline-block text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md" title={entry.reason}>
                                  DUPLICATE
                                </span>
                              )}
                              {entry.status === 'invalid' && (
                                <span className="inline-block text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md" title={entry.reason}>
                                  DENIED
                                </span>
                              )}

                              {onDeleteLog && (
                                <div className="relative inline-flex items-center">
                                  {confirmDeleteId === entry.id ? (
                                    <div className="flex items-center gap-1 animate-fadeIn">
                                      <button
                                        onClick={() => {
                                          onDeleteLog(entry.id);
                                          setConfirmDeleteId(null);
                                        }}
                                        className="text-[9px] font-bold text-white bg-rose-500 hover:bg-rose-600 px-2 py-1 rounded transition-colors border-0 cursor-pointer"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="text-[9px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors border-0 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmDeleteId(entry.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all border-0 cursor-pointer"
                                      title="Delete scan entry"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                filteredPending.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-slate-50/20 text-slate-400 text-xs">
                    {historySearch ? 'No matching pending participants found' : 'All registered participants have been scanned! 🎉'}
                  </div>
                ) : (
                  <table className="w-full min-w-[450px] sm:min-w-0 text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4 font-mono">Token</th>
                        <th className="py-2.5 px-3">Participant</th>
                        <th className="py-2.5 px-3">Contact</th>
                        <th className="py-2.5 px-4 text-right">Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredPending.map((p, idx) => (
                        <tr key={`${p.studentID || 'no-id'}-${p.tokenNumber || idx}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-4 text-xs font-bold text-indigo-600 font-mono">
                            #{p.tokenNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="text-xs font-semibold text-slate-800 leading-none">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.studentID || 'No Student ID'}</p>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-500 font-mono">
                            {p.contactNumber || '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide ${
                              p.tShirtSize === 'NONE' 
                                ? 'bg-slate-100 text-slate-500' 
                                : 'bg-indigo-50 text-indigo-700'
                            }`}>
                              {p.tShirtSize || 'M'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Modal Popup for Scan Verification Feedback */}
      {popup && popup.show && (() => {
        const activeParticipant = participants.find(p => p.studentID === popup.studentID);
        const tShirtSize = activeParticipant?.tShirtSize || 'M';
        const isTShirtStation = activity.id === 't-shirt' || 
          activity.name.toLowerCase().includes('shirt') || 
          activity.name.toLowerCase().includes('tshirt');

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-8 animate-fadeIn">
            <div className="bg-white w-[480px] max-w-full rounded-[3rem] shadow-2xl p-8 md:p-10 flex flex-col items-center text-center transform scale-100 transition-all relative border border-slate-100">
              {/* Close Button */}
              <button
                onClick={() => setPopup(null)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full p-2 border-0 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Large Verification Icon */}
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-sm ${
                popup.type === 'success' 
                  ? 'bg-emerald-100 text-emerald-600' 
                  : popup.type === 'duplicate' 
                    ? 'bg-amber-100 text-amber-600 animate-bounce'
                    : 'bg-rose-100 text-rose-600 animate-pulse'
              }`}>
                {popup.type === 'success' ? (
                  <CheckCircle className="w-12 h-12" strokeWidth={3} />
                ) : popup.type === 'duplicate' ? (
                  <AlertCircle className="w-12 h-12" strokeWidth={3} />
                ) : (
                  <XCircle className="w-12 h-12" strokeWidth={3} />
                )}
              </div>

              {/* Welcome text or Status header */}
              <h2 className="text-3xl font-black text-slate-900 mb-1 tracking-tight">
                {popup.type === 'success' ? `Welcome, ${popup.name || 'Participant'}!` : popup.name || 'System Notice'}
              </h2>
              <p className={`font-bold text-base mb-6 uppercase tracking-wider ${
                popup.type === 'success' 
                  ? 'text-emerald-600' 
                  : popup.type === 'duplicate' 
                    ? 'text-amber-600'
                    : 'text-rose-600'
              }`}>
                {popup.title}
              </p>
              
              {/* Grid Metadata */}
              <div className="w-full grid grid-cols-2 gap-4 mb-6 text-left">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Token ID</p>
                  <p className="text-lg font-bold text-slate-800">#{popup.tokenNumber || 'N/A'}</p>
                </div>
                {isTShirtStation ? (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">T-Shirt Size</p>
                    <p className="text-lg font-bold text-slate-800">{tShirtSize}</p>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Contact No.</p>
                    <p className="text-base font-bold text-slate-800 truncate" title={activeParticipant?.contactNumber}>
                      {activeParticipant?.contactNumber || '—'}
                    </p>
                  </div>
                )}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Student ID</p>
                  <p className="text-lg font-bold text-slate-800">{popup.studentID || '—'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Station point</p>
                  <p className={`text-lg font-bold ${
                    popup.type === 'success' ? 'text-emerald-600' : 'text-slate-800'
                  }`}>{activity.name}</p>
                </div>
              </div>

              {/* If there is a duplicate/denied reason */}
              {popup.reason && (
                <div className={`w-full text-xs font-bold p-3.5 rounded-2xl mb-6 text-center border ${
                  popup.type === 'duplicate' 
                    ? 'bg-amber-50 text-amber-800 border-amber-200/50' 
                    : 'bg-rose-50 text-rose-800 border-rose-200/50'
                }`}>
                  {popup.reason}
                </div>
              )}
              
              {/* Action Button */}
              <button 
                onClick={() => setPopup(null)}
                className={`w-full py-4 rounded-3xl font-bold text-lg shadow-xl cursor-pointer active:scale-95 transition-all text-white ${
                  popup.type === 'success' 
                    ? 'bg-slate-900 hover:bg-slate-800 shadow-slate-200' 
                    : popup.type === 'duplicate'
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-100'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-100'
                }`}
              >
                Tap to Scan Next
              </button>
              <p className="mt-4 text-slate-400 text-xs font-medium italic">
                Auto-closing in 4s...
              </p>
            </div>
          </div>
        );
      })()}

      {/* Floating Modal for PDF Download on 100% Station Completion */}
      {showCompletionPdfModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-fadeIn animate-duration-300">
          <div className="bg-white w-[520px] max-w-full rounded-[3rem] shadow-2xl p-8 md:p-10 flex flex-col items-center text-center transform scale-100 transition-all relative border border-slate-100 overflow-hidden">
            {/* Ambient decorative gradient background */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>

            {/* Close Button */}
            <button
              onClick={() => setShowCompletionPdfModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full p-2 border-0 cursor-pointer transition-all"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Celebrate Badge */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-emerald-400/30 rounded-full animate-ping scale-75"></div>
              <div className="w-24 h-24 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 relative z-10">
                <Award className="w-12 h-12 animate-pulse" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2 rounded-full shadow-md z-20">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>

            {/* Completion Heading */}
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight mb-3">
              100% Station Completed! 🎉
            </h2>
            
            <p className="text-slate-500 text-sm md:text-base leading-relaxed mb-6 px-2">
              Awesome job! All <strong className="text-slate-900 font-extrabold">{participants.length}</strong> registered participants have successfully scanned and checked in at <strong className="text-emerald-600 font-extrabold">"{activity.name}"</strong>!
            </p>

            {/* Summary statistics quick list */}
            <div className="w-full bg-slate-50/80 border border-slate-100 rounded-2xl p-5 text-left mb-8 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Station / Point</span>
                <span className="text-slate-800 font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide">{activity.name}</span>
              </div>
              <div className="h-[1px] bg-slate-200/50"></div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Verified Checked-In</span>
                <span className="text-emerald-700 font-extrabold">{scannedCount} / {participants.length} (100%)</span>
              </div>
              <div className="h-[1px] bg-slate-200/50"></div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Remaining to Scan</span>
                <span className="text-slate-400 font-bold">0 participants</span>
              </div>
            </div>

            {/* Primary Action Button - Download PDF */}
            <button
              onClick={() => {
                exportToPDF();
                setShowCompletionPdfModal(false);
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base md:text-lg py-4 px-6 rounded-3xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
            >
              <FileDown className="w-5 h-5" />
              <span>Download PDF Report</span>
            </button>

            {/* Dismiss Button */}
            <button
              onClick={() => setShowCompletionPdfModal(false)}
              className="mt-4 text-slate-400 hover:text-slate-600 font-semibold text-sm border-0 bg-transparent hover:underline cursor-pointer"
            >
              Close &amp; Return to Station
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
