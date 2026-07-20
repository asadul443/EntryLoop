/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { QrCode, Download, Send, Copy, Check, Users, Sparkles, RefreshCw, Layers, FileText, Loader2, ArrowRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Participant } from '../types';

interface QRGeneratorProps {
  onSimulateScan: (qrText: string) => void;
  importedParticipants: Participant[];
  eventName?: string;
}

// Global helper to render a high-quality participant ticket layout to a Canvas element.
// Used for both single and bulk compilation.
const generateTicketCanvas = (
  participant: Participant, 
  format: 'JSON' | 'CSV',
  eventName?: string
): Promise<HTMLCanvasElement> => {
  return new Promise((resolve, reject) => {
    const payload = format === 'JSON' 
      ? JSON.stringify(participant, null, 2)
      : `${participant.name},${participant.studentID},${participant.tokenNumber},${participant.contactNumber},${participant.tShirtSize}`;
      
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = qrUrl;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        const padding = 30;
        const qrSize = 300;
        const topMargin = 90;
        const bottomMargin = 50;

        canvas.width = qrSize + (padding * 2);
        canvas.height = qrSize + topMargin + bottomMargin;

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Elegant indigo top accent band
        ctx.fillStyle = '#4f46e5';
        ctx.fillRect(0, 0, canvas.width, 10);

        // Header Label
        ctx.textAlign = 'center';
        ctx.fillStyle = '#6366f1'; // Indigo-500
        const headerText = eventName ? eventName.trim().toUpperCase() : 'PARTICIPANT TICKET';
        let headerFont = 'bold 14px system-ui, -apple-system, sans-serif';
        if (headerText.length > 22) {
          headerFont = 'bold 11px system-ui, -apple-system, sans-serif';
        }
        if (headerText.length > 32) {
          headerFont = 'bold 9px system-ui, -apple-system, sans-serif';
        }
        ctx.font = headerFont;
        ctx.fillText(headerText, canvas.width / 2, 36);

        // Name (Centered & Bold uppercase)
        ctx.fillStyle = '#0f172a'; // Slate-900
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        let displayName = participant.name.toUpperCase();
        if (displayName.length > 20) {
          ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
        }
        if (displayName.length > 28) {
          ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
        }
        if (displayName.length > 35) {
          displayName = displayName.substring(0, 32) + '...';
        }
        ctx.fillText(displayName, canvas.width / 2, 64);

        // QR Code Image
        ctx.drawImage(img, padding, topMargin, qrSize, qrSize);

        // Line
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, canvas.height - 40);
        ctx.lineTo(canvas.width - padding, canvas.height - 40);
        ctx.stroke();

        // Footer details (Displaying Contact Number)
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        const contactStr = participant.contactNumber ? `CONTACT: ${participant.contactNumber}` : 'NO CONTACT PROVIDED';
        ctx.fillText(contactStr, canvas.width / 2, canvas.height - 18);

        resolve(canvas);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error(`Failed to load QR code image for token ${participant.tokenNumber}`));
    };
  });
};

export default function QRGenerator({ onSimulateScan, importedParticipants, eventName }: QRGeneratorProps) {
  const [formData, setFormData] = useState<Participant>({
    name: 'Asadul Khan',
    studentID: 'STU-2026-9081',
    tokenNumber: '105',
    contactNumber: '+8801712345678',
    tShirtSize: 'XL',
  });

  const [copied, setCopied] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [format, setFormat] = useState<'JSON' | 'CSV'>('JSON');

  // Bulk Progress State
  const [bulkProgress, setBulkProgress] = useState<{
    active: boolean;
    total: number;
    current: number;
    currentName: string;
    type: 'PDF' | 'JPG' | '';
  }>({
    active: false,
    total: 0,
    current: 0,
    currentName: '',
    type: ''
  });

  // QR String formats
  const jsonString = JSON.stringify(formData, null, 2);
  const csvString = `${formData.name},${formData.studentID},${formData.tokenNumber},${formData.contactNumber},${formData.tShirtSize}`;
  const qrDataText = format === 'JSON' ? jsonString : csvString;

  // Free API for QR code rendering
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrDataText)}`;

  const downloadQRAsJPG = () => {
    setDownloading(true);
    generateTicketCanvas(formData, format, eventName)
      .then((canvas) => {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const link = document.createElement('a');
        const cleanName = formData.name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
        link.download = `QR_${cleanName}_Token_${formData.tokenNumber}.jpg`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch((err) => {
        console.error('Canvas error:', err);
        alert('Could not render JPG locally. Opening standard QR instead.');
        window.open(qrCodeUrl, '_blank');
      })
      .finally(() => {
        setDownloading(false);
      });
  };

  // Bulk PDF Generator
  const downloadBulkAsPDF = async () => {
    if (importedParticipants.length === 0) return;
    setBulkProgress({
      active: true,
      total: importedParticipants.length,
      current: 0,
      currentName: '',
      type: 'PDF'
    });

    try {
      // Create a PDF matching the ticket aspect ratio (360x440 px)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [360, 440]
      });

      for (let i = 0; i < importedParticipants.length; i++) {
        const p = importedParticipants[i];
        setBulkProgress(prev => ({
          ...prev,
          current: i + 1,
          currentName: p.name
        }));

        const canvas = await generateTicketCanvas(p, format, eventName);
        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        if (i > 0) {
          pdf.addPage([360, 440], 'portrait');
        }

        pdf.addImage(imgData, 'JPEG', 0, 0, 360, 440);
        
        // Stagger slightly so UI does not lock up and displays accurate progress
        await new Promise(resolve => setTimeout(resolve, 80));
      }

      pdf.save(`Bulk_Tickets_${importedParticipants.length}_Participants.pdf`);
    } catch (err) {
      console.error('Bulk PDF Compilation failed:', err);
      alert('An error occurred while compiling the bulk PDF booklet. Please try again.');
    } finally {
      setBulkProgress(prev => ({ ...prev, active: false }));
    }
  };

  // Bulk individual JPG download triggered sequentially
  const downloadBulkAsJPG = async () => {
    if (importedParticipants.length === 0) return;

    const confirmDownload = window.confirm(
      `This will sequentially download ${importedParticipants.length} high-resolution JPG image files directly to your device. Please make sure multiple downloads are allowed by your browser. Do you wish to proceed?`
    );
    if (!confirmDownload) return;

    setBulkProgress({
      active: true,
      total: importedParticipants.length,
      current: 0,
      currentName: '',
      type: 'JPG'
    });

    try {
      for (let i = 0; i < importedParticipants.length; i++) {
        const p = importedParticipants[i];
        setBulkProgress(prev => ({
          ...prev,
          current: i + 1,
          currentName: p.name
        }));

        const canvas = await generateTicketCanvas(p, format, eventName);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

        const link = document.createElement('a');
        const cleanName = p.name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
        link.download = `QR_${cleanName}_Token_${p.tokenNumber}.jpg`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Stagger sequential browser file trigger so it is handled correctly
        await new Promise(resolve => setTimeout(resolve, 450));
      }
    } catch (err) {
      console.error('Bulk JPG download error:', err);
      alert('Sequential download was interrupted. Please ensure your browser permits multiple file downloads.');
    } finally {
      setBulkProgress(prev => ({ ...prev, active: false }));
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(qrDataText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectParticipantPreset = (p: Participant) => {
    setFormData(p);
    setShowPresets(false);
  };

  const generateRandomParticipant = () => {
    const firstNames = ['John', 'Emma', 'Sadik', 'Ayesha', 'Asif', 'Sophia', 'Rahul', 'Farhana', 'David', 'Priyah'];
    const lastNames = ['Doe', 'Smith', 'Hasan', 'Chowdhury', 'Begum', 'Miller', 'Sharma', 'Ali', 'Tailor', 'Patel'];
    const sizes = ['S', 'M', 'L', 'XL', 'XXL', 'NONE'];
    
    const randomFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randomLast = lastNames[Math.floor(Math.random() * lastNames.length)];
    const randId = `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const randToken = Math.floor(100 + Math.random() * 899).toString();
    const randPhone = `+8801${Math.floor(300000000 + Math.random() * 699999999)}`;
    const randSize = sizes[Math.floor(Math.random() * sizes.length)];

    setFormData({
      name: `${randomFirst} ${randomLast}`,
      studentID: randId,
      tokenNumber: randToken,
      contactNumber: randPhone,
      tShirtSize: randSize,
    });
  };

  return (
    <div className="space-y-6 relative">
      {/* Dynamic Bulk Loader Overlay */}
      {bulkProgress.active && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-6">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            
            <div>
              <h4 className="text-xl font-bold text-slate-900">
                Compiling Bulk Passes ({bulkProgress.type})
              </h4>
              <p className="text-sm text-slate-500 mt-1">
                Please do not close this tab. Rendering high-resolution assets...
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100/50 rounded-2xl p-4 text-left">
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>PROGRESS</span>
                <span>{bulkProgress.current} / {bulkProgress.total}</span>
              </div>
              
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-3">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-extrabold text-indigo-600">PROCESSING:</span>
                <span className="font-bold text-slate-700 truncate max-w-[240px]">
                  {bulkProgress.currentName ? bulkProgress.currentName.toUpperCase() : 'Initializing...'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Generating vector layouts, custom typography layers, and active QR code payloads dynamically.
            </p>
          </div>
        </div>
      )}

      {/* Main Single QR Simulator Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-base">Ticket Generator</h3>
              <p className="text-xs text-slate-400">Generate and download entry passes with dynamic QR codes</p>
            </div>
          </div>
          
          <button
            onClick={generateRandomParticipant}
            className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 active:scale-95 transition-all py-1.5 px-3 rounded-full font-medium"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Random
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form Fields */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">QR Code Payload Fields</label>
              {importedParticipants.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowPresets(!showPresets)}
                    className="flex items-center gap-1 text-xs text-emerald-600 font-medium hover:underline bg-transparent border-0 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Load Imported ({importedParticipants.length})
                  </button>

                  {showPresets && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto p-2">
                      <p className="text-[10px] font-bold text-slate-400 p-2 uppercase tracking-wide">Select Participant</p>
                      {importedParticipants.slice(0, 15).map((p, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectParticipantPreset(p)}
                          className="w-full text-left p-2 rounded-xl text-xs hover:bg-slate-50 transition-all block overflow-hidden text-ellipsis whitespace-nowrap"
                        >
                          <span className="font-semibold text-slate-700">#{p.tokenNumber}</span> {p.name}
                        </button>
                      ))}
                      {importedParticipants.length > 15 && (
                        <p className="text-[10px] text-slate-400 text-center py-1 italic">Showing first 15</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Student ID</label>
                  <input
                    type="text"
                    value={formData.studentID}
                    onChange={(e) => setFormData({ ...formData, studentID: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Token Number</label>
                  <input
                    type="text"
                    value={formData.tokenNumber}
                    onChange={(e) => setFormData({ ...formData, tokenNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">T-Shirt Size</label>
                  <select
                    value={formData.tShirtSize}
                    onChange={(e) => setFormData({ ...formData, tShirtSize: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  >
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                    <option value="NONE">NONE</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">QR ENCODING FORMAT</label>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFormat('JSON')}
                  className={`flex-1 text-center py-1 text-xs font-semibold rounded-lg transition-all ${format === 'JSON' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Structured JSON
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('CSV')}
                  className={`flex-1 text-center py-1 text-xs font-semibold rounded-lg transition-all ${format === 'CSV' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Raw CSV String
                </button>
              </div>
            </div>
          </div>

          {/* QR Code and Actions */}
          <div className="flex flex-col items-center justify-center border-l border-dashed border-slate-100 pl-0 md:pl-6">
            <div className="relative group bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center justify-center h-48 w-48 mb-4">
              <img
                src={qrCodeUrl}
                alt="Generated Event QR"
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full rounded-2xl shadow-sm bg-white p-2"
              />
              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all rounded-3xl flex items-center justify-center gap-3">
                <button
                  onClick={downloadQRAsJPG}
                  disabled={downloading}
                  className="w-10 h-10 rounded-xl bg-white/25 hover:bg-white/40 disabled:opacity-50 text-white flex items-center justify-center backdrop-blur-sm transition-all border-0 cursor-pointer"
                  title="Download Premium JPG Ticket"
                >
                  <Download className={`w-5 h-5 ${downloading ? 'animate-bounce' : ''}`} />
                </button>
                <button
                  onClick={handleCopy}
                  className="w-10 h-10 rounded-xl bg-white/25 hover:bg-white/40 text-white flex items-center justify-center backdrop-blur-sm transition-all border-0 cursor-pointer"
                  title="Copy QR Text String"
                >
                  {copied ? <Check className="w-5 h-5 text-emerald-300" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="w-full space-y-2">
              <button
                onClick={downloadQRAsJPG}
                disabled={downloading}
                className="w-full flex items-center justify-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-75 active:scale-98 shadow-md hover:shadow-lg rounded-2xl py-3 px-4 font-semibold text-sm transition-all cursor-pointer"
              >
                <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
                <span>{downloading ? 'Generating ticket...' : 'Download JPG Ticket'}</span>
              </button>
              <p className="text-[11px] text-center text-slate-400">
                Generates and downloads a custom ticket with the participant's full name printed above the high-resolution QR code.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Bulk Operations Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
        {/* Soft decorative background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/50 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-base">Bulk Ticket Operations</h3>
            <p className="text-xs text-slate-400">Compile and export high-resolution QR tickets for your whole guest list</p>
          </div>
        </div>

        {importedParticipants.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-slate-700">No imported guest list detected</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
              Import a participant guest list from Google Sheets or your custom clipboard paste in the <strong>Settings</strong> tab to activate bulk processing.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 border border-slate-100/80 p-4 rounded-2xl">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">ACTIVE GUEST LIST</p>
                <h4 className="text-sm font-extrabold text-slate-800 mt-0.5 flex items-center gap-1.5">
                  <span>{importedParticipants.length} registered participants loaded</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </h4>
              </div>
              <div className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 animate-spin" />
                <span>Ready to compile</span>
              </div>
            </div>

            {/* Main Bulk Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: PDF compilation */}
              <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between space-y-4 hover:border-indigo-100 hover:bg-slate-50 transition-all">
                <div className="space-y-1">
                  <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center mb-1">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h5 className="font-bold text-slate-800 text-sm">Download PDF Booklet</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Compiles every participant ticket into a single, multi-page PDF document. Optimized for badge printing or paper operations.
                  </p>
                </div>
                
                <button
                  onClick={downloadBulkAsPDF}
                  className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer border-0 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Compile PDF ({importedParticipants.length} pages)</span>
                </button>
              </div>

              {/* Option 2: JPG sequential download */}
              <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between space-y-4 hover:border-emerald-100 hover:bg-slate-50 transition-all">
                <div className="space-y-1">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mb-1">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <h5 className="font-bold text-slate-800 text-sm">Download Individual JPGs</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Downloads an individual high-resolution JPG image pass for every attendee sequentially. Best for emailing or WhatsApp distribution.
                  </p>
                </div>
                
                <button
                  onClick={downloadBulkAsJPG}
                  className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer border-0 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download all JPGs</span>
                </button>
              </div>
            </div>

            {/* Bulk Actions complete */}
          </div>
        )}
      </div>
    </div>
  );
}
