/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  googleSignIn, 
  logout, 
  getAccessToken 
} from '../lib/auth';
import { 
  listUserSpreadsheets, 
  getSpreadsheetSheets, 
  fetchSheetData, 
  GoogleSpreadsheetFile
} from '../lib/googleSheets';
import { Participant, Activity, ActivityLogs, DbBackup } from '../types';
import { 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  Settings, 
  Grid, 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  CheckCircle, 
  LogOut, 
  X,
  FileCheck,
  Search,
  Sparkles,
  AlertTriangle,
  FileDown,
  ExternalLink,
  FileText
} from 'lucide-react';
import { User } from 'firebase/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface SettingsViewProps {
  participants: Participant[];
  activities: Activity[];
  logs: ActivityLogs;
  onImportParticipants: (roster: Participant[]) => void;
  onUpdateActivities: (list: Activity[]) => void;
  onRestoreState: (backup: DbBackup) => void;
  onResetDatabase: () => void;
  onAuthChange: (user: User | null, token: string | null) => void;
  currentUser: User | null;
  currentAccessToken: string | null;
  eventName: string;
  onUpdateEventName: (name: string) => void;
  primaryMatchField: string;
  onUpdatePrimaryMatchField: (field: string) => void;
  databaseManagerName: string;
  onUpdateDatabaseManagerName: (name: string) => void;
}

export default function SettingsView({
  participants,
  activities,
  logs,
  onImportParticipants,
  onUpdateActivities,
  onRestoreState,
  onResetDatabase,
  onAuthChange,
  currentUser,
  currentAccessToken,
  eventName,
  onUpdateEventName,
  primaryMatchField,
  onUpdatePrimaryMatchField,
  databaseManagerName,
  onUpdateDatabaseManagerName
}: SettingsViewProps) {
  // Auth state tracking
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(!currentUser);

  // Event Name local editing state
  const [localEventName, setLocalEventName] = useState(eventName || '');

  useEffect(() => {
    setLocalEventName(eventName || '');
  }, [eventName]);

  // Database Manager Name local editing state
  const [localDatabaseManagerName, setLocalDatabaseManagerName] = useState(databaseManagerName || '');

  useEffect(() => {
    setLocalDatabaseManagerName(databaseManagerName || '');
  }, [databaseManagerName]);

  // Local state for matching rule
  const [localPrimaryField, setLocalPrimaryField] = useState<string>(primaryMatchField || 'fuzzy');

  useEffect(() => {
    if (primaryMatchField) {
      setLocalPrimaryField(primaryMatchField);
    }
  }, [primaryMatchField]);

  // Sheets discovery state
  const [spreadsheets, setSpreadsheets] = useState<GoogleSpreadsheetFile[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string | null>(null);
  const [selectedSpreadsheetName, setSelectedSpreadsheetName] = useState<string>('');
  const [sheetTabs, setSheetTabs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [importLoading, setImportLoading] = useState(false);

  // New custom activity states
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityIcon, setNewActivityIcon] = useState('📦');

  // Safety confirmation modal state
  const [safetyModal, setSafetyModal] = useState<{
    isOpen: boolean;
    actionType: 'wipe' | 'overwrite' | null;
    pendingParticipants?: Participant[];
  }>({
    isOpen: false,
    actionType: null,
  });
  const [confirmText, setConfirmText] = useState('');

  // Column Mapping states
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [loadedRows, setLoadedRows] = useState<any[][]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const [mapping, setMapping] = useState<{
    name: string;
    studentID: string;
    tokenNumber: string;
    contactNumber: string;
    tShirtSize: string;
  }>({
    name: '',
    studentID: '',
    tokenNumber: '',
    contactNumber: '',
    tShirtSize: '',
  });

  // Trigger spreadsheet list on mount if logged in
  const [isInIframe, setIsInIframe] = useState(false);
  const [importMethod, setImportMethod] = useState<'google' | 'file'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }
  }, []);

  useEffect(() => {
    if (currentAccessToken) {
      loadUserSpreadsheets();
    }
  }, [currentAccessToken]);

  // Generate high-quality client-side PDF using jsPDF & jspdf-autotable
  const handleDownloadPDFReport = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Calculate statistics
      const totalParticipants = participants.length;
      const totalStations = activities.length;
      let totalSuccess = 0;
      activities.forEach(act => {
        const actLogs = logs[act.id] || [];
        totalSuccess += actLogs.filter(l => l.status === 'success').length;
      });
      const totalPossible = totalParticipants * totalStations;
      const percentComplete = totalPossible > 0 ? Math.round((totalSuccess / totalPossible) * 100) : 0;

      // Header Banner
      doc.setFillColor(79, 70, 229); // indigo-600
      doc.rect(0, 0, 210, 35, 'F');

      // Title & Date
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('Event Tracker Operational Report', 15, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, 26);
      doc.text(`Overall Completion: ${percentComplete}%`, 155, 26);

      // Section 1: Executive Summary
      doc.setTextColor(30, 41, 59); // slate-800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Executive Summary', 15, 46);

      const summaryHeaders = [['Metric', 'Value']];
      const summaryRows = [
        ['Total Registered Participants', totalParticipants.toString()],
        ['Active Scanning Stations', totalStations.toString()],
        ['Total Valid Scan Logs', totalSuccess.toString()],
        ['Total Expected Scans', totalPossible.toString()],
        ['Overall Completion Rate', `${percentComplete}%`],
      ];

      autoTable(doc, {
        startY: 50,
        head: summaryHeaders,
        body: summaryRows,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241], fontStyle: 'bold' }, // indigo-500
        margin: { left: 15, right: 15 },
        styles: { fontSize: 9 },
      });

      // Section 2: Station Performance
      const nextY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Station Performance Metrics', 15, nextY);

      const stationHeaders = [['Station', 'Valid Scans', 'Duplicates', 'Denied', 'Completion %']];
      const stationRows = activities.map(act => {
        const actLogs = logs[act.id] || [];
        const successCount = actLogs.filter(l => l.status === 'success').length;
        const dups = actLogs.filter(l => l.status === 'duplicate').length;
        const invalid = actLogs.filter(l => l.status === 'invalid').length;
        const completionPercent = totalParticipants > 0 ? Math.round((successCount / totalParticipants) * 100) : 0;
        return [
          `${act.icon} ${act.name}`,
          successCount.toString(),
          dups.toString(),
          invalid.toString(),
          `${completionPercent}%`
        ];
      });

      autoTable(doc, {
        startY: nextY + 4,
        head: stationHeaders,
        body: stationRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' }, // indigo-600
        margin: { left: 15, right: 15 },
        styles: { fontSize: 9 },
      });

      // Section 3: Master Registry & Completion Status
      doc.addPage();
      
      // Secondary header banner
      doc.setFillColor(79, 70, 229); // indigo-600
      doc.rect(0, 0, 210, 15, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Participant Master Registry & Station Progress', 15, 10);

      const participantHeaders = [
        ['Token', 'Name', 'Student ID', ...activities.map(a => a.name)]
      ];

      const participantRows = participants.map(p => {
        const row = [
          p.tokenNumber,
          p.name,
          p.studentID,
        ];

        activities.forEach(act => {
          const actLogs = logs[act.id] || [];
          const completed = actLogs.some(l => l.studentID === p.studentID && l.status === 'success');
          row.push(completed ? 'Scanned' : 'Pending');
        });

        return row;
      });

      autoTable(doc, {
        startY: 22,
        head: participantHeaders,
        body: participantRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' }, // indigo-600
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          2: { fontStyle: 'italic' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index >= 3) {
            const val = data.cell.text[0];
            if (val === 'Scanned') {
              data.cell.styles.textColor = [16, 124, 65]; // green text
              data.cell.styles.fontStyle = 'bold';
            } else if (val === 'Pending') {
              data.cell.styles.textColor = [220, 38, 38]; // red text
            }
          }
        },
        margin: { left: 15, right: 15 },
      });

      const reportDate = new Date().toISOString().split('T')[0];
      doc.save(`Event_Summary_Report_${reportDate}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('An error occurred while generating the PDF report.');
    }
  };

  // Safe Execute Trigger
  const handleSafetyActionConfirm = () => {
    if (safetyModal.actionType === 'wipe') {
      if (confirmText.trim().toUpperCase() !== 'DELETE ALL DATA') {
        alert('Confirmation text mismatch. Please type "DELETE ALL DATA" to proceed.');
        return;
      }
      onResetDatabase();
      alert('Database successfully wiped.');
    } else if (safetyModal.actionType === 'overwrite' && safetyModal.pendingParticipants) {
      onImportParticipants(safetyModal.pendingParticipants);
      onUpdateEventName(localEventName.trim());
      onUpdatePrimaryMatchField(localPrimaryField);
      alert(`Successfully imported ${safetyModal.pendingParticipants.length} participants into local database!`);
      setShowMappingModal(false);
      setSelectedSpreadsheetId(null);
    }
    setSafetyModal({ isOpen: false, actionType: null });
    setConfirmText('');
  };

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        onAuthChange(res.user, res.accessToken);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Google Auth Failed:', err);
      alert('Failed to authorize with Google Account. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    const confirmed = window.confirm('Are you sure you want to sign out from Google? This will clear active sheets caches.');
    if (!confirmed) return;
    try {
      await logout();
      onAuthChange(null, null);
      setNeedsAuth(true);
      setSpreadsheets([]);
      setSelectedSpreadsheetId(null);
      setSheetTabs([]);
    } catch (err) {
      console.error(err);
    }
  };

  // Google Drive Spreadsheets Discovery
  const loadUserSpreadsheets = async () => {
    if (!currentAccessToken) return;
    setLoadingSheets(true);
    try {
      const list = await listUserSpreadsheets(currentAccessToken);
      setSpreadsheets(list);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        // Expired token
        onAuthChange(null, null);
        setNeedsAuth(true);
      } else {
        alert(`Could not load files from Drive: ${err.message}`);
      }
    } finally {
      setLoadingSheets(false);
    }
  };

  // Fetch Sheet Tabs
  const handleSpreadsheetSelect = async (id: string, name: string) => {
    if (!currentAccessToken) return;
    setSelectedSpreadsheetId(id);
    setSelectedSpreadsheetName(name);
    setSheetTabs([]);
    setSelectedTab('');
    
    try {
      const tabs = await getSpreadsheetSheets(currentAccessToken, id);
      setSheetTabs(tabs);
      if (tabs.length > 0) {
        setSelectedTab(tabs[0]); // default
      }
    } catch (err: any) {
      alert(`Could not fetch spreadsheet tabs: ${err.message}`);
    }
  };

  const guessColumnMappings = (headers: string[]) => {
    const guess = {
      name: '',
      studentID: '',
      tokenNumber: '',
      contactNumber: '',
      tShirtSize: '',
    };

    const clean = (h: any) => {
      if (!h) return '';
      return h.toString().toLowerCase().replace(/[\s\-_.]/g, '').trim();
    };

    // 1. Name Guessing
    let nameMatch = headers.find(h => {
      const c = clean(h);
      return c === 'name' || c === 'fullname' || c === 'studentname' || c === 'participantname' || c === 'participant' || c === 'namecol' || c === 'nameofstudent' || c === 'nameofparticipant';
    });
    if (!nameMatch) {
      nameMatch = headers.find(h => {
        const c = clean(h);
        return c.includes('name') || c.includes('participant') || c.includes('full');
      });
    }
    guess.name = nameMatch || headers[0] || '';

    // 2. Student ID Guessing
    // Exclude columns that are clearly registration types, fee statuses, roles, categories
    const isIdWordBlacklisted = (c: string) => {
      return c.includes('type') || c.includes('fee') || c.includes('payment') || c.includes('category') || c.includes('status') || c.includes('role');
    };

    let studentIdMatch = headers.find(h => {
      const c = clean(h);
      if (isIdWordBlacklisted(c)) return false;
      return c === 'studentid' || c === 'id' || c === 'studentroll' || c === 'roll' || c === 'rollno' || c === 'registration' || c === 'registrationnumber' || c === 'regno' || c === 'enrollment' || c === 'enrollmentno' || c === 'regid' || c === 'sid';
    });
    if (!studentIdMatch) {
      studentIdMatch = headers.find(h => {
        const c = clean(h);
        if (isIdWordBlacklisted(c)) return false;
        return c.includes('student') || c.includes('roll') || c.includes('id') || c.includes('reg') || c.includes('enroll');
      });
    }
    guess.studentID = studentIdMatch || '';

    // 3. Token Number / SL
    let tokenMatch = headers.find(h => {
      const c = clean(h);
      if (c.includes('phone') || c.includes('mobile') || c.includes('contact')) return false;
      return c === 'token' || c === 'tokennumber' || c === 'serial' || c === 'sl' || c === 'sno' || c === 'serialno' || c === 'ticket' || c === 'ticketnumber';
    });
    if (!tokenMatch) {
      tokenMatch = headers.find(h => {
        const c = clean(h);
        if (c.includes('phone') || c.includes('mobile') || c.includes('contact')) return false;
        return c.includes('token') || c.includes('serial') || c.includes('sl') || c.includes('ticket') || c.includes('no') || c.includes('num');
      });
    }
    guess.tokenNumber = tokenMatch || '';

    // 4. Contact Number
    let contactMatch = headers.find(h => {
      const c = clean(h);
      return c === 'contact' || c === 'phone' || c === 'mobile' || c === 'phonenumber' || c === 'contactnumber' || c === 'cell' || c === 'tel';
    });
    if (!contactMatch) {
      contactMatch = headers.find(h => {
        const c = clean(h);
        return c.includes('phone') || c.includes('mobile') || c.includes('contact') || c.includes('cell') || c.includes('tel');
      });
    }
    guess.contactNumber = contactMatch || '';

    // 5. T-Shirt Size
    let sizeMatch = headers.find(h => {
      const c = clean(h);
      return c === 'size' || c === 'tshirt' || c === 'shirt' || c === 'tsize' || c === 'tshirtsize';
    });
    if (!sizeMatch) {
      sizeMatch = headers.find(h => {
        const c = clean(h);
        return c.includes('size') || c.includes('shirt');
      });
    }
    guess.tShirtSize = sizeMatch || '';

    return guess;
  };

  const parsePdfFile = async (file: File) => {
    setImportLoading(true);
    try {
      if (!(window as any).pdfjsLib) {
        // Load pdf.js dynamically from CDN
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
          script.onload = () => {
            resolve();
          };
          script.onerror = () => {
            reject(new Error('Failed to load PDF processing library from CDN. Please verify your internet connection.'));
          };
          document.head.appendChild(script);
        });
      }

      const pdfjsLib = (window as any).pdfjsLib;
      // Configure PDF.js worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // Step 1: Extract text in a structured coordinate-preserved manner for the LLM
      const textPages: string[] = [];
      const localRowsFallback: string[][] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        interface PdfTextItem {
          str: string;
          x: number;
          y: number;
          width: number;
          height: number;
        }

        const items: PdfTextItem[] = textContent.items.map((item: any) => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width || 0,
          height: item.transform[3] || 0,
        }));

        if (items.length === 0) continue;

        // Group items by Y coordinate with a tolerance (e.g., 5 units)
        const rowsMap: { y: number; items: PdfTextItem[] }[] = [];
        const tolerance = 5;

        for (const item of items) {
          if (!item.str.trim()) continue;

          let placed = false;
          for (const r of rowsMap) {
            if (Math.abs(r.y - item.y) <= tolerance) {
              r.items.push(item);
              placed = true;
              break;
            }
          }
          if (!placed) {
            rowsMap.push({ y: item.y, items: [item] });
          }
        }

        // Sort rows from top to bottom (descending Y)
        rowsMap.sort((a, b) => b.y - a.y);

        // Sort items within each row from left to right (ascending X)
        const pageLines: string[] = [];
        for (const r of rowsMap) {
          r.items.sort((a, b) => a.x - b.x);
          
          const mergedCells: string[] = [];
          let currentCell = '';
          let lastXEnd = -1;

          for (const item of r.items) {
            const itemWidth = item.width || (item.str.length * 6);
            if (lastXEnd === -1) {
              currentCell = item.str;
              lastXEnd = item.x + itemWidth;
            } else if (item.x - lastXEnd < 10) {
              const separator = item.x - lastXEnd > 2 ? ' ' : '';
              currentCell += separator + item.str;
              lastXEnd = Math.max(lastXEnd, item.x + itemWidth);
            } else {
              mergedCells.push(currentCell.trim());
              currentCell = item.str;
              lastXEnd = item.x + itemWidth;
            }
          }
          if (currentCell) {
            mergedCells.push(currentCell.trim());
          }

          if (mergedCells.length > 0) {
            localRowsFallback.push(mergedCells);
            pageLines.push(mergedCells.join('    ')); // Add noticeable spacing for column delimiters
          }
        }

        textPages.push(`--- PAGE ${pageNum} ---\n${pageLines.join('\n')}`);
      }

      const fullExtractedText = textPages.join('\n\n');

      // Step 2: Send text to server for high-precision parsing using Gemini
      try {
        const response = await fetch('/api/parse-roster', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: fullExtractedText }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        if (data.table && Array.isArray(data.table) && data.table.length >= 2) {
          const nonEmptyRows = data.table.filter((row: any) => Array.isArray(row) && row.some(cell => cell && cell.trim() !== ''));
          if (nonEmptyRows.length >= 2) {
            console.log('Successfully parsed PDF roster with Gemini:', nonEmptyRows.length, 'rows.');
            const headers = nonEmptyRows[0];
            setHeaderRowIndex(0);
            setRawHeaders(headers);
            setLoadedRows(nonEmptyRows);

            // Guess initially
            const guessed = guessColumnMappings(headers);
            setMapping(guessed);
            
            // Open the visual mapping step modal!
            setShowMappingModal(true);
            return; // We are fully done!
          }
        }
        throw new Error('Parsed table data had invalid structure.');
      } catch (backendErr: any) {
        console.warn('Backend Gemini-powered PDF parsing failed, falling back to local heuristic parsing:', backendErr);
        
        // Step 3: Fallback to Local Coordinate Heuristics if API call fails
        if (localRowsFallback.length < 2) {
          throw new Error('Could not parse any tabular data from the PDF file. Make sure it contains text.');
        }

        const nonEmptyRows = localRowsFallback.filter(row => row.some(cell => cell !== ''));
        if (nonEmptyRows.length < 2) {
          throw new Error('No valid participant data found in the selected PDF.');
        }

        const headers = nonEmptyRows[0];
        setHeaderRowIndex(0);
        setRawHeaders(headers);
        setLoadedRows(nonEmptyRows);

        // Guess initially
        const guessed = guessColumnMappings(headers);
        setMapping(guessed);
        
        // Open the visual mapping step modal!
        setShowMappingModal(true);
      }

    } catch (err: any) {
      console.error(err);
      alert(`Failed to parse PDF file: ${err.message || 'Please check your PDF format.'}`);
    } finally {
      setImportLoading(false);
    }
  };

  // Local File Upload & Parsing (Offline Excel/CSV support)
  const parseLocalFile = (file: File) => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      setPendingPdfFile(file);
      return;
    }
    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        if (data.length < 2) {
          throw new Error('Spreadsheet/CSV file must contain at least a header row and one participant data row.');
        }

        // Convert rows to strings cleanly
        const formattedRows = data.map((row: any) => {
          if (!Array.isArray(row)) return [];
          return row.map((val: any) => {
            if (val === undefined || val === null) return '';
            return val.toString().trim();
          });
        });

        // Filter out completely empty rows
        const nonEmptyRows = formattedRows.filter(row => row.some(cell => cell !== ''));
        if (nonEmptyRows.length < 2) {
          throw new Error('No valid participant data found in the selected file.');
        }

        const headers = nonEmptyRows[0];
        setHeaderRowIndex(0);
        setRawHeaders(headers);
        setLoadedRows(nonEmptyRows);

        // Guess initially
        const guessed = guessColumnMappings(headers);
        setMapping(guessed);
        
        // Open the visual mapping step modal!
        setShowMappingModal(true);
      } catch (err: any) {
        console.error(err);
        alert(`Failed to parse file: ${err.message || 'Please check your spreadsheet or CSV format.'}`);
      } finally {
        setImportLoading(false);
      }
    };

    reader.onerror = () => {
      alert('Error reading file. Please try again.');
      setImportLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseLocalFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      parseLocalFile(file);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      ['Full Name', 'Student ID', 'Token Number', 'Contact Number', 'T-Shirt Size'],
      ['Asadul Khan', '2026-CSE-001', 'TOKEN-101', '+15551234567', 'XL'],
      ['Sarah Connor', '2026-CSE-002', 'TOKEN-102', '+15559876543', 'M']
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws, "Participants Template");
    XLSX.writeFile(wb, "Roster_Import_Template.xlsx");
  };

  // Import Values & Parse Columns
  const handleImportData = async () => {
    if (!currentAccessToken || !selectedSpreadsheetId || !selectedTab) return;
    setImportLoading(true);

    try {
      const rows = await fetchSheetData(currentAccessToken, selectedSpreadsheetId, selectedTab);
      
      if (rows.length < 2) {
        throw new Error('Spreadsheet must contain at least a header row and one participant data row.');
      }

      // Store fetched sheet rows and headers for visual confirmation
      const headers = rows[0].map((h: any) => h?.toString() || '');
      setHeaderRowIndex(0);
      setRawHeaders(headers);
      setLoadedRows(rows);

      // Guess initially
      const guessed = guessColumnMappings(headers);
      setMapping(guessed);
      
      // Open the visual mapping step modal!
      setShowMappingModal(true);
    } catch (err: any) {
      console.error(err);
      alert(`Import failed: ${err.message || 'Check column header mappings and sheet formats.'}`);
    } finally {
      setImportLoading(false);
    }
  };

  // Final Confirmation of mapping
  const handleConfirmImport = () => {
    if (loadedRows.length <= headerRowIndex) return;

    const nameHeader = mapping.name;
    const studentIdHeader = mapping.studentID;
    const tokenHeader = mapping.tokenNumber;
    const contactHeader = mapping.contactNumber;
    const sizeHeader = mapping.tShirtSize;

    const headers = loadedRows[headerRowIndex].map((h: any) => h?.toString() || '');
    const nameIdx = headers.indexOf(nameHeader);
    const studentIdIdx = headers.indexOf(studentIdHeader);
    const tokenIdx = tokenHeader ? headers.indexOf(tokenHeader) : -1;
    const contactIdx = contactHeader ? headers.indexOf(contactHeader) : -1;
    const sizeIdx = sizeHeader ? headers.indexOf(sizeHeader) : -1;

    if (nameIdx === -1 || studentIdIdx === -1) {
      alert('Columns "Name" and "Student ID" are mandatory headers. Please match them.');
      return;
    }

    const parsedParticipants: Participant[] = [];

    for (let i = headerRowIndex + 1; i < loadedRows.length; i++) {
      const row = loadedRows[i];
      if (!row || row.length === 0 || !row[nameIdx]) continue; // skip empty rows

      parsedParticipants.push({
        name: row[nameIdx]?.toString()?.trim() || '',
        studentID: row[studentIdIdx]?.toString()?.trim() || '',
        tokenNumber: tokenIdx !== -1 && row[tokenIdx] ? row[tokenIdx].toString().trim() : (i - headerRowIndex).toString(),
        contactNumber: contactIdx !== -1 && row[contactIdx] ? row[contactIdx].toString().trim() : '',
        tShirtSize: sizeIdx !== -1 && row[sizeIdx] ? row[sizeIdx].toString().trim().toUpperCase() : (mapping.tShirtSize === 'NONE' ? 'NONE' : 'M'),
      });
    }

    if (participants.length > 0) {
      setConfirmText('');
      setSafetyModal({
        isOpen: true,
        actionType: 'overwrite',
        pendingParticipants: parsedParticipants,
      });
    } else {
      onImportParticipants(parsedParticipants);
      onUpdateEventName(localEventName.trim());
      onUpdatePrimaryMatchField(localPrimaryField);
      alert(`Successfully imported ${parsedParticipants.length} participants into local database!`);
      setShowMappingModal(false);
      setSelectedSpreadsheetId(null);
    }
  };

  // Add Custom Activity Card Station
  const handleAddCustomActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityName.trim()) return;

    const newId = newActivityName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Check duplicates
    if (activities.some(a => a.id === newId)) {
      alert('An activity station with this name already exists.');
      return;
    }

    const nextActivities: Activity[] = [
      ...activities,
      {
        id: newId,
        name: newActivityName.trim(),
        icon: newActivityIcon,
        scannedCount: 0,
        duplicateAttempts: 0
      }
    ];

    onUpdateActivities(nextActivities);
    setNewActivityName('');
    setNewActivityIcon('📦');
  };

  // Delete Station
  const handleDeleteActivity = (id: string, name: string) => {
    const logsCount = logs[id]?.length || 0;
    const warningText = logsCount > 0 
      ? `Station "${name}" contains ${logsCount} logged scans. Deleting it will permanently erase these scan logs! Proceed?`
      : `Are you sure you want to delete the "${name}" station?`;

    const confirmed = window.confirm(warningText);
    if (!confirmed) return;

    const nextActivities = activities.filter(a => a.id !== id);
    onUpdateActivities(nextActivities);
  };

  // DB Backup Downloader
  const downloadBackup = () => {
    const backupData: DbBackup = {
      version: 1,
      timestamp: new Date().toISOString(),
      participants,
      activities,
      logs
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Event_Scanner_DB_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // DB Restore Uploader
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup: DbBackup = JSON.parse(event.target?.result as string);
        if (!backup.participants || !backup.activities || !backup.logs) {
          throw new Error('Invalid JSON format: missing required elements.');
        }

        const confirmed = window.confirm(
          `Do you want to restore this database? It will overwrite current settings and load ${backup.participants.length} participants and ${backup.activities.length} activity stations.`
        );

        if (confirmed) {
          onRestoreState(backup);
          alert('Database restored successfully!');
        }
      } catch (err: any) {
        alert(`Failed to parse backup file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Master Clear DB
  const handleReset = () => {
    setConfirmText('');
    setSafetyModal({
      isOpen: true,
      actionType: 'wipe'
    });
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Settings Title */}
      <div className="bg-white border border-slate-100 p-5 rounded-3xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Coordinator Dashboard</h2>
          <p className="text-xs text-slate-400">Import sheets, manage stations, and perform backups</p>
        </div>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Roster Import Management (Online Google Sheets / Offline Excel & CSV) */}
        <div className="lg:col-span-7 bg-white border border-slate-100 p-6 rounded-3xl shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-500" />
                Roster Import Station
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Populate scannable participants database</p>
            </div>
            {importMethod === 'google' && currentUser && (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold py-1.5 px-3 rounded-xl text-xs border-0 cursor-pointer transition-colors"
                title="Disconnect Google Account"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span>Disconnect</span>
              </button>
            )}
          </div>

          {/* Active Event Name Input */}
          <div className="bg-slate-50/55 p-4 rounded-2xl border border-slate-100/60 space-y-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>🏷️ Active Event / Campaign Name</span>
            </label>
            <input
              type="text"
              value={localEventName}
              onChange={(e) => {
                setLocalEventName(e.target.value);
                onUpdateEventName(e.target.value);
              }}
              placeholder="e.g. Annual Symposium 2026, CSE Seminar, Sports Meet"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm placeholder:font-normal placeholder:text-slate-400"
            />
            <p className="text-[9px] text-slate-400">
              This event name dynamically displays with active monitoring on the dashboard and upper navigation bar.
            </p>
          </div>

          {/* Operator Name Input */}
          <div className="bg-slate-50/55 p-4 rounded-2xl border border-slate-100/60 space-y-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>👤 Operator Name</span>
            </label>
            <input
              type="text"
              value={localDatabaseManagerName}
              onChange={(e) => {
                setLocalDatabaseManagerName(e.target.value);
                onUpdateDatabaseManagerName(e.target.value);
              }}
              placeholder="e.g. Asadul Khan"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm placeholder:font-normal placeholder:text-slate-400"
            />
            <p className="text-[9px] text-slate-400">
              Enter the operator name to display as Operator on the dashboard.
            </p>
          </div>

          {/* Mandatory QR Code Match Field Selection */}
          <div className="bg-slate-50/55 p-4 rounded-2xl border border-slate-100/60 space-y-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>🛡️ Mandatory QR Code Match Field</span>
            </label>
            <select
              value={localPrimaryField}
              onChange={(e) => {
                setLocalPrimaryField(e.target.value);
                onUpdatePrimaryMatchField(e.target.value);
              }}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
            >
              <option value="studentID">Student ID (Requires perfect match in QR text/JSON/URL)</option>
              <option value="tokenNumber">Token Number (Requires perfect match in QR text/JSON/URL)</option>
              <option value="contactNumber">Contact Number (Requires perfect match in QR text/JSON/URL)</option>
              <option value="name">Participant Name (Requires perfect match in QR text/JSON/URL)</option>
              <option value="fuzzy">Permissive Matching (Fallback heuristics)</option>
            </select>
            <p className="text-[9px] text-slate-400">
              Select which column field must match perfectly inside the scanned QR code content. This prevents false or mismatching scanner read operations.
            </p>
          </div>

          {/* Import Method Tabs */}
          <div className="flex gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100/80">
            <button
              onClick={() => {
                setImportMethod('google');
                setImportLoading(false);
              }}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border-0 cursor-pointer transition-all ${
                importMethod === 'google'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Google Sheets</span>
            </button>
            <button
              onClick={() => {
                setImportMethod('file');
                setImportLoading(false);
              }}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border-0 cursor-pointer transition-all ${
                importMethod === 'file'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
              }`}
            >
              <Upload className="w-4 h-4 text-indigo-500" />
              <span>Offline File (Excel/CSV)</span>
            </button>
          </div>

          {importLoading ? (
            <div className="py-14 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Processing sheet rows...</p>
              <p className="text-[10px] text-slate-400">Extracting columns and mapping rosters...</p>
            </div>
          ) : importMethod === 'google' ? (
            // Google Sheets Flow
            needsAuth ? (
              <div className="py-6 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-4">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm mb-1">Google Sheets Participant Sync</h4>
                <p className="text-xs text-slate-400 max-w-xs mb-4 leading-relaxed">
                  Connect your Google Account to automatically discover spreadsheet participant rosters, select ranges, and save scan logs directly.
                </p>

                {/* GSI Material Button (Official standard resembling button) */}
                <button onClick={handleSignIn} disabled={isLoggingIn} className="gsi-material-button relative border border-slate-200 bg-white hover:bg-slate-50 active:scale-98 cursor-pointer py-1 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center h-11 mb-3">
                  <div className="gsi-material-button-state"></div>
                  <div className="gsi-material-button-content-wrapper flex items-center gap-3">
                    <div className="gsi-material-button-icon flex items-center justify-center w-5 h-5">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents font-semibold text-slate-700 text-xs">{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
                  </div>
                </button>
                <p className="text-[10px] text-slate-400 max-w-xs">
                  Bypassing browser iframe restrictions with secure pop-up bridge authentication.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Account connected card */}
                <div className="flex items-center gap-3 bg-emerald-50/55 p-3 rounded-2xl border border-emerald-100/40">
                  <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-xs uppercase shadow-inner">
                    {currentUser?.email?.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 leading-none">Authorized Roster Sync</p>
                    <p className="text-[10px] text-slate-400 mt-1">{currentUser?.email}</p>
                  </div>
                </div>

                {/* Discovery files lists */}
                {!selectedSpreadsheetId ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Google Spreadsheet</span>
                      <button
                        onClick={loadUserSpreadsheets}
                        className="text-xs text-indigo-600 bg-transparent border-0 font-bold hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingSheets ? 'animate-spin' : ''}`} />
                        Refresh Drive
                      </button>
                    </div>

                    <div className="border border-slate-50 rounded-2xl max-h-56 overflow-y-auto divide-y divide-slate-50">
                      {loadingSheets ? (
                        <div className="text-center py-10 text-slate-400 text-xs flex justify-center items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                          Fetching event logs from Drive...
                        </div>
                      ) : spreadsheets.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-xs">
                          No Google spreadsheets found in your Drive.
                        </div>
                      ) : (
                        spreadsheets.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleSpreadsheetSelect(s.id, s.name)}
                            className="w-full text-left p-3 hover:bg-slate-50 flex justify-between items-center transition-colors border-0 bg-transparent cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              <span className="text-xs font-semibold text-slate-800 truncate max-w-xs">{s.name}</span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-mono">
                              {new Date(s.modifiedTime).toLocaleDateString()}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-indigo-600" />
                        <div>
                          <h4 className="font-bold text-slate-800 text-xs">Active File:</h4>
                          <p className="text-[11px] text-indigo-600 font-bold max-w-xs truncate">{selectedSpreadsheetName}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedSpreadsheetId(null)}
                        className="p-1 hover:bg-white text-slate-400 hover:text-slate-600 rounded-lg border-0 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sheet Tab Name</label>
                        <select
                          value={selectedTab}
                          onChange={(e) => setSelectedTab(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-800 font-medium focus:outline-none"
                        >
                          {sheetTabs.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-end">
                        <button
                          onClick={handleImportData}
                          disabled={importLoading}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-xl text-xs border-0 cursor-pointer shadow-sm active:scale-95 transition-all"
                        >
                          {importLoading ? 'Reading values...' : 'Import & Map Columns'}
                        </button>
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-relaxed">
                      Import matches columns automatically by looking for headers like Name, Student ID, Token Number, Contact Number, and T Shirt Size.
                    </p>
                  </div>
                )}
              </div>
            )
          ) : (
            // Offline File Upload Flow (Excel/CSV/PDF)
            <div className="space-y-4 animate-fadeIn">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('offline-file-input')?.click()}
                className={`border-2 border-dashed rounded-[2rem] p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all relative ${
                  isDragging 
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                    : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/40'
                }`}
              >
                <input
                  id="offline-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf"
                  onChange={handleLocalFileChange}
                  className="hidden"
                />
                
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-transform ${
                  isDragging ? 'bg-indigo-100 text-indigo-600 scale-110 shadow-inner' : 'bg-slate-50 text-slate-400'
                }`}>
                  <Upload className="w-6 h-6" />
                </div>
                
                <h4 className="font-extrabold text-slate-800 text-sm mb-1">
                  Upload Excel, CSV or PDF file
                </h4>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-1">
                  Drag & drop your local roster file here, or <span className="text-indigo-600 font-bold hover:underline">browse files</span>
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  Supports .xlsx, .xls, .csv, .pdf files
                </p>
              </div>

              {/* Template generator & tips */}
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/75 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">File Requirements</span>
                  <p className="text-[11px] text-slate-500">
                    File must contain a header row with Name & Student ID. PDFs are mapped visually just like spreadsheets!
                  </p>
                </div>
                <button
                  onClick={downloadTemplate}
                  type="button"
                  className="bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 hover:border-slate-300 font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer whitespace-nowrap self-stretch md:self-auto justify-center"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Download Template</span>
                </button>
              </div>
            </div>
          )}

          {/* Master Roster summary indicator */}
          {participants.length > 0 && (
            <div className="border-t border-slate-50 pt-4 mt-2 flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-slate-800">Master Roster Database</p>
                <p className="text-[10px] text-slate-400">Total imported participant rosters available offline.</p>
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-full border border-emerald-100/35 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                {participants.length} Scannable Records
              </span>
            </div>
          )}
        </div>

        {/* Activity Stations & DB Reset operations */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Create custom stations */}
          <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-50 pb-3">
              <Grid className="w-4 h-4 text-indigo-500" />
              Manage Scan Stations
            </h3>

            {/* List existing */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activities.map((act) => {
                const count = logs[act.id]?.filter(l => l.status === 'success').length || 0;
                return (
                  <div key={act.id} className="flex justify-between items-center p-2.5 rounded-xl border border-slate-50 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{act.icon}</span>
                      <div>
                        <span className="text-xs font-semibold text-slate-800 block leading-none">{act.name}</span>
                        <span className="text-[9px] text-slate-400 font-bold">{count} logged scans</span>
                      </div>
                    </div>
                    
                    {activities.length > 1 && (
                      <button
                        onClick={() => handleDeleteActivity(act.id, act.name)}
                        className="p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-100 rounded-lg border-0 cursor-pointer transition-colors"
                        title="Delete Station"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Form to add */}
            <form onSubmit={handleAddCustomActivity} className="pt-2 border-t border-slate-50 flex gap-2">
              <div className="w-16">
                <select
                  value={newActivityIcon}
                  onChange={(e) => setNewActivityIcon(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-1.5 py-2 text-base text-center focus:outline-none cursor-pointer"
                  title="Choose Station Icon"
                >
                  {/* Access & Entry */}
                  <option value="🎟️">🎟️</option>
                  <option value="🎫">🎫</option>
                  <option value="🚪">🚪</option>
                  <option value="🔑">🔑</option>
                  <option value="🛡️">🛡️</option>
                  <option value="📍">📍</option>
                  
                  {/* Swag & Apparel */}
                  <option value="👕">👕</option>
                  <option value="🧢">🧢</option>
                  <option value="🎒">🎒</option>
                  <option value="🎁">🎁</option>
                  <option value="🛍️">🛍️</option>
                  <option value="📦">📦</option>
                  
                  {/* Food & Beverage */}
                  <option value="🍔">🍔</option>
                  <option value="🍕">🍕</option>
                  <option value="🍟">🍟</option>
                  <option value="🥤">🥤</option>
                  <option value="☕">☕</option>
                  <option value="🍩">🍩</option>
                  <option value="🍉">🍉</option>
                  
                  {/* Materials & Certificates */}
                  <option value="📜">📜</option>
                  <option value="📚">📚</option>
                  <option value="🖊️">🖊️</option>
                  <option value="📁">📁</option>
                  
                  {/* Recognition & Fun */}
                  <option value="🏆">🏆</option>
                  <option value="🎖️">🎖️</option>
                  <option value="🎯">🎯</option>
                  <option value="🎈">🎈</option>
                  <option value="🍿">🍿</option>
                  <option value="🎤">🎤</option>
                  
                  {/* Tech & Support */}
                  <option value="💻">💻</option>
                  <option value="📱">📱</option>
                  <option value="📢">📢</option>
                  <option value="⏰">⏰</option>
                  <option value="🚗">🚗</option>
                </select>
              </div>

              <input
                type="text"
                placeholder="Station name..."
                value={newActivityName}
                onChange={(e) => setNewActivityName(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />

              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-2 rounded-xl text-xs transition-all border-0 cursor-pointer shadow-sm active:scale-95 flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Backup, Restore, Wipe Operations */}
          <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-50 pb-3">
              <Database className="w-4 h-4 text-slate-500" />
              Database Operations
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={downloadBackup}
                className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 hover:bg-slate-50/50 hover:border-slate-200 transition-all text-center border-0 cursor-pointer"
              >
                <Download className="w-5 h-5 text-indigo-600 mb-1.5" />
                <span className="text-xs font-bold text-slate-700">Backup DB</span>
                <span className="text-[9px] text-slate-400">Save offline JSON</span>
              </button>

              <label className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 hover:bg-slate-50/50 hover:border-slate-200 transition-all text-center cursor-pointer">
                <Upload className="w-5 h-5 text-indigo-600 mb-1.5" />
                <span className="text-xs font-bold text-slate-700">Restore DB</span>
                <span className="text-[9px] text-slate-400">Upload JSON file</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFile}
                  className="hidden"
                />
              </label>
            </div>

            <div className="pt-2 border-t border-slate-50">
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 font-bold py-2.5 px-4 rounded-xl text-xs border-0 cursor-pointer transition-all active:scale-98"
              >
                <Trash2 className="w-4 h-4" />
                <span>Wipe Database</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Column Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8 animate-fadeIn">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Configure Column Mapping</h3>
                  <p className="text-[11px] text-slate-500">Confirm or adjust which columns match each participant field</p>
                </div>
              </div>
              <button
                onClick={() => setShowMappingModal(false)}
                className="p-1.5 hover:bg-white text-slate-400 hover:text-slate-600 rounded-xl border-0 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Alert Warning */}
              <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 text-[11px] text-indigo-700 leading-relaxed flex gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span>
                  We scanned your column headers and auto-selected the best fits. If any headers matched incorrectly (e.g., matching <strong>registration type</strong> as student ID), please change the selection below.
                </span>
              </div>

              {/* Event Name Input Option during Upload */}
              <div className="bg-indigo-50/30 p-4.5 rounded-2xl border border-indigo-150/40 space-y-2.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-2">
                  <span className="text-base">🏷️</span>
                  <span>Event / Campaign Name</span>
                  <span className="text-[10px] text-slate-400 font-medium font-mono">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={localEventName}
                  onChange={(e) => setLocalEventName(e.target.value)}
                  placeholder="e.g. Annual Symposium 2026, Sports Meet, CSE TechFest"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm placeholder:font-normal placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-400">
                  Provide a title to show prominently at the top of all scanning and logging screens.
                </p>
              </div>

              {/* Header Row Index Selector */}
              <div className="bg-indigo-50/30 p-4.5 rounded-2xl border border-indigo-150/40 space-y-2.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-2">
                  <span className="text-base">📌</span>
                  <span>Header Row (Heading Location)</span>
                </label>
                <select
                  value={headerRowIndex}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10);
                    setHeaderRowIndex(idx);
                    if (loadedRows[idx]) {
                      const nextHeaders = loadedRows[idx].map((h: any) => h?.toString() || '');
                      setRawHeaders(nextHeaders);
                      const guessed = guessColumnMappings(nextHeaders);
                      setMapping(guessed);
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm cursor-pointer"
                >
                  {loadedRows.slice(0, 10).map((row, idx) => {
                    const rowPreview = row.slice(0, 4).filter(Boolean).join(', ') + (row.length > 4 ? '...' : '');
                    return (
                      <option key={idx} value={idx}>
                        Row {idx + 1}: {rowPreview || '[Blank Row]'}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-slate-400">
                  Select the row in your file that contains the actual column names (e.g. Name, Student ID). Rows before this row will be skipped during import.
                </p>
              </div>

              {/* Form Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name Mapping */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                    <span>Full Name Column</span>
                    <span className="text-red-500 text-xs">*</span>
                  </label>
                  <select
                    value={mapping.name}
                    onChange={(e) => setMapping(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="" disabled>-- Select Column --</option>
                    {rawHeaders.map((h, idx) => (
                      <option key={`${h}-${idx}`} value={h}>{h || `[Column ${idx + 1}]`}</option>
                    ))}
                  </select>
                </div>

                {/* Student ID Mapping */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                    <span>Student ID / Roll / Reg Column</span>
                    <span className="text-red-500 text-xs">*</span>
                  </label>
                  <select
                    value={mapping.studentID}
                    onChange={(e) => setMapping(prev => ({ ...prev, studentID: e.target.value }))}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="" disabled>-- Select Column --</option>
                    {rawHeaders.map((h, idx) => (
                      <option key={`${h}-${idx}`} value={h}>{h || `[Column ${idx + 1}]`}</option>
                    ))}
                  </select>
                </div>

                {/* Token Number Mapping */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center justify-between">
                    <span>Token Number / Sl No.</span>
                    <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                  </label>
                  <select
                    value={mapping.tokenNumber}
                    onChange={(e) => setMapping(prev => ({ ...prev, tokenNumber: e.target.value }))}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="">-- Auto-generate Sequence Number --</option>
                    {rawHeaders.map((h, idx) => (
                      <option key={`${h}-${idx}`} value={h}>{h || `[Column ${idx + 1}]`}</option>
                    ))}
                  </select>
                </div>

                {/* Contact Number Mapping */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center justify-between">
                    <span>Contact Number</span>
                    <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                  </label>
                  <select
                    value={mapping.contactNumber}
                    onChange={(e) => setMapping(prev => ({ ...prev, contactNumber: e.target.value }))}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="">-- No Contact Column --</option>
                    {rawHeaders.map((h, idx) => (
                      <option key={`${h}-${idx}`} value={h}>{h || `[Column ${idx + 1}]`}</option>
                    ))}
                  </select>
                </div>

                {/* T-Shirt Size Mapping */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center justify-between">
                    <span>T-Shirt Size</span>
                    <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                  </label>
                  <select
                    value={mapping.tShirtSize}
                    onChange={(e) => setMapping(prev => ({ ...prev, tShirtSize: e.target.value }))}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="">-- Default to 'M' size --</option>
                    <option value="NONE">-- None (No T-Shirt) --</option>
                    {rawHeaders.map((h, idx) => (
                      <option key={`${h}-${idx}`} value={h}>{h || `[Column ${idx + 1}]`}</option>
                    ))}
                  </select>
                </div>

                {/* Mandatory QR Match Field */}
                <div className="col-span-1 md:col-span-2 pt-2 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                    <span>🛡️ Mandatory QR Code Match Field</span>
                    <span className="text-indigo-500 text-xs">*</span>
                  </label>
                  <select
                    value={localPrimaryField}
                    onChange={(e) => setLocalPrimaryField(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="studentID">Student ID (Requires perfect match in QR text/JSON/URL)</option>
                    <option value="tokenNumber">Token Number (Requires perfect match in QR text/JSON/URL)</option>
                    <option value="contactNumber">Contact Number (Requires perfect match in QR text/JSON/URL)</option>
                    <option value="name">Participant Name (Requires perfect match in QR text/JSON/URL)</option>
                    <option value="fuzzy">Permissive Matching (Fallback heuristics)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Enforces that at least this single selected field MUST match perfectly inside the scanned QR code data for authentication.
                  </p>
                </div>
              </div>

              {/* Roster Live Preview Table */}
              <div className="space-y-2">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Live Preview (First 3 Rows)</span>
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/55 border-b border-slate-150 font-bold text-slate-600 text-[10px] uppercase">
                        <th className="p-3">Name</th>
                        <th className="p-3">Student ID</th>
                        <th className="p-3">Token</th>
                        <th className="p-3">Contact</th>
                        <th className="p-3">T-Shirt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        if (loadedRows.length <= headerRowIndex) return [];

                        const headers = loadedRows[headerRowIndex];
                        const nameIdx = headers.indexOf(mapping.name);
                        const studentIdIdx = headers.indexOf(mapping.studentID);
                        const tokenIdx = mapping.tokenNumber ? headers.indexOf(mapping.tokenNumber) : -1;
                        const contactIdx = mapping.contactNumber ? headers.indexOf(mapping.contactNumber) : -1;
                        const sizeIdx = mapping.tShirtSize ? headers.indexOf(mapping.tShirtSize) : -1;

                        const previewRows = [];
                        for (let i = headerRowIndex + 1; i < Math.min(loadedRows.length, headerRowIndex + 4); i++) {
                          const row = loadedRows[i];
                          if (!row || row.length === 0) continue;
                          previewRows.push({
                            name: nameIdx !== -1 && row[nameIdx] ? row[nameIdx].toString().trim() : '—',
                            studentID: studentIdIdx !== -1 && row[studentIdIdx] ? row[studentIdIdx].toString().trim() : '—',
                            tokenNumber: tokenIdx !== -1 && row[tokenIdx] ? row[tokenIdx].toString().trim() : (i - headerRowIndex).toString(),
                            contactNumber: contactIdx !== -1 && row[contactIdx] ? row[contactIdx].toString().trim() : '—',
                            tShirtSize: sizeIdx !== -1 && row[sizeIdx] ? row[sizeIdx].toString().trim().toUpperCase() : (mapping.tShirtSize === 'NONE' ? 'NONE' : 'M'),
                          });
                        }
                        return previewRows;
                      })().map((p, idx) => (
                        <tr key={idx} className="text-slate-700">
                          <td className="p-3 font-semibold truncate max-w-[120px]">{p.name}</td>
                          <td className="p-3 font-mono text-[11px]">{p.studentID}</td>
                          <td className="p-3 font-mono text-[11px]">{p.tokenNumber}</td>
                          <td className="p-3 truncate max-w-[100px]">{p.contactNumber}</td>
                          <td className="p-3"><span className="bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded text-[10px]">{p.tShirtSize}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 p-5 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowMappingModal(false)}
                className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold py-2.5 px-5 rounded-2xl text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={!mapping.name || !mapping.studentID}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-6 rounded-2xl text-xs cursor-pointer transition-colors shadow-md flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                Import {Math.max(0, loadedRows.length - (headerRowIndex + 1))} Participants
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Summary & PDF Download Modal */}
      {safetyModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8 animate-fadeIn">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-50 to-amber-50 p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    {safetyModal.actionType === 'wipe' ? 'Confirm Database Wipe' : 'Confirm Roster Overwrite'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {safetyModal.actionType === 'wipe' 
                      ? 'You are about to permanently wipe all local database records'
                      : 'You are about to replace your active participant roster with new sheet data'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSafetyModal({ isOpen: false, actionType: null });
                  setConfirmText('');
                }}
                className="p-1.5 hover:bg-white text-slate-400 hover:text-slate-600 rounded-xl border-0 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Highlight Warning Alert box */}
              <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-100/50 text-xs text-amber-800 leading-relaxed space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertTriangle className="w-4.5 h-4.5 text-amber-600 flex-shrink-0" />
                  <span>CRITICAL DATA ACTION PROTECTION</span>
                </div>
                <p>
                  This action is irreversible and will erase/replace your active participant records, activity definitions, and scan logs. 
                  We have compiled a **comprehensive report PDF** of your complete current database, including master roster list and scan histories at all stations.
                </p>
              </div>

              {/* Total Summary Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Database State Summary</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Total Registered */}
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Registered Participants</span>
                    <span className="text-2xl font-black text-slate-800">{participants.length}</span>
                  </div>
                  
                  {/* Total Stations */}
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Active Scan Stations</span>
                    <span className="text-2xl font-black text-slate-800">{activities.length}</span>
                  </div>

                  {/* Overall Scan success */}
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Valid Scan Logs</span>
                    <span className="text-2xl font-black text-slate-800">
                      {(() => {
                        let count = 0;
                        activities.forEach(a => {
                          count += (logs[a.id] || []).filter(l => l.status === 'success').length;
                        });
                        return count;
                      })()}
                    </span>
                  </div>
                </div>

                {/* Detailed Station Checklist summary table */}
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/20">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500 text-[10px] uppercase">
                        <th className="p-3 pl-4">Station</th>
                        <th className="p-3 text-right">Valid Scans</th>
                        <th className="p-3 text-right">Duplicates</th>
                        <th className="p-3 pr-4 text-right">Denied</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activities.map(act => {
                        const actLogs = logs[act.id] || [];
                        const valids = actLogs.filter(l => l.status === 'success').length;
                        const dups = actLogs.filter(l => l.status === 'duplicate').length;
                        const invalids = actLogs.filter(l => l.status === 'invalid').length;
                        return (
                          <tr key={act.id} className="text-slate-700">
                            <td className="p-3 pl-4 font-semibold flex items-center gap-1.5">
                              <span className="text-sm">{act.icon}</span>
                              <span>{act.name}</span>
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-emerald-600">{valids}</td>
                            <td className="p-3 text-right font-mono text-amber-600">{dups}</td>
                            <td className="p-3 pr-4 text-right font-mono text-rose-600">{invalids}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Area: Download PDF */}
              <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-0.5 text-center sm:text-left font-sans">
                  <span className="text-xs font-bold text-indigo-950 block">Download Summary Report PDF</span>
                  <span className="text-[10px] text-indigo-600 font-medium">Always secure a hardcopy PDF report before executing any destructive operations.</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPDFReport}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.02] text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2 border-0 cursor-pointer shadow-sm transition-all"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Download Full PDF Report</span>
                </button>
              </div>

              {/* Verification input field */}
              {safetyModal.actionType === 'wipe' && (
                <div className="space-y-2 pt-2 border-t border-slate-100 animate-fadeIn">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                    <span>To authorize, type the exact verification phrase:</span>
                    <span className="text-rose-500 text-xs">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE ALL DATA"
                      className="flex-1 bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all uppercase placeholder:normal-case placeholder:font-normal"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Type "DELETE ALL DATA" (case-insensitive) to confirm complete wipe.
                  </p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-5 border-t border-slate-150 flex justify-end gap-3">
              <button
                onClick={() => {
                  setSafetyModal({ isOpen: false, actionType: null });
                  setConfirmText('');
                }}
                className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold py-2.5 px-5 rounded-2xl text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSafetyActionConfirm}
                disabled={
                  safetyModal.actionType === 'wipe' 
                    ? confirmText.trim().toUpperCase() !== 'DELETE ALL DATA'
                    : false
                }
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-6 rounded-2xl text-xs cursor-pointer transition-colors shadow-md flex items-center gap-1.5"
              >
                {safetyModal.actionType === 'wipe' ? <Trash2 className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                <span>
                  {safetyModal.actionType === 'wipe' ? 'Execute Complete Wipe' : 'Execute Import Overwrite'}
                </span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PDF Upload Warning Modal */}
      {pendingPdfFile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">PDF Import Warning</h3>
                  <p className="text-[10px] text-slate-500">Unstructured file format detected</p>
                </div>
              </div>
              <button
                onClick={() => setPendingPdfFile(null)}
                className="p-1.5 hover:bg-white text-slate-400 hover:text-slate-600 rounded-xl border-0 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-slate-600 leading-relaxed">
                  You are attempting to import a roster using a <strong>PDF file</strong> (<span className="font-mono text-[11px] text-indigo-600 font-bold">{pendingPdfFile.name}</span>).
                </p>
                <div className="p-3.5 bg-amber-50 text-amber-850 text-xs font-semibold rounded-2xl border border-amber-100/50 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span className="leading-relaxed">
                    PDF files do not have a fixed table structure. Roster data (like names or tokens) can sometimes be misplaced, cut off, or parsed incorrectly depending on the PDF layout.
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  We highly recommend using an <strong>Excel (.xlsx, .xls)</strong> or <strong>CSV</strong> spreadsheet file for a <strong>butter smooth, flawless experience</strong>.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-5 border-t border-slate-150 flex justify-end gap-2.5">
              <button
                onClick={() => setPendingPdfFile(null)}
                className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer transition-colors"
              >
                Cancel & Use Excel
              </button>
              <button
                onClick={() => {
                  const file = pendingPdfFile;
                  setPendingPdfFile(null);
                  parsePdfFile(file);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>Continue with PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
