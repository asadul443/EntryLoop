/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Participant } from '../types';
import { 
  Search, 
  User, 
  FileDown, 
  Users, 
  Phone,
  CheckCircle2,
  Trash2,
  Edit2,
  Plus,
  X,
  UserPlus,
  Save,
  AlertCircle,
  Sliders
} from 'lucide-react';

interface RegisteredViewProps {
  participants: Participant[];
  onAddParticipant: (p: Participant) => void;
  onEditParticipant: (oldStudentID: string, oldToken: string, updated: Participant) => void;
  onDeleteParticipant: (studentID: string, token: string) => void;
}

export default function RegisteredView({ 
  participants,
  onAddParticipant,
  onEditParticipant,
  onDeleteParticipant
}: RegisteredViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  
  // Manage list modal states
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedParticipantToken, setSelectedParticipantToken] = useState('');

  // Form fields
  const [formName, setFormName] = useState('');
  const [formStudentID, setFormStudentID] = useState('');
  const [formTokenNumber, setFormTokenNumber] = useState('');
  const [formContactNumber, setFormContactNumber] = useState('');
  const [formTShirtSize, setFormTShirtSize] = useState('M');

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Deletion confirmation state
  const [confirmDeleteParticipant, setConfirmDeleteParticipant] = useState<Participant | null>(null);

  // Filter participants
  const filteredParticipants = participants.filter(p => {
    const normSearch = searchQuery.toLowerCase().trim();
    return !normSearch || 
      p.name?.toLowerCase().includes(normSearch) ||
      p.studentID?.toLowerCase().includes(normSearch) ||
      p.tokenNumber?.toString().includes(normSearch) ||
      p.contactNumber?.toLowerCase().includes(normSearch) ||
      p.tShirtSize?.toLowerCase().includes(normSearch);
  });

  // Open the Add Participant form
  const openAddModal = () => {
    const maxToken = participants.reduce((max, p) => {
      const val = parseInt(p.tokenNumber, 10);
      return isNaN(val) ? max : Math.max(max, val);
    }, 0);
    
    setModalMode('add');
    setEditingParticipant(null);
    setFormName('');
    setFormStudentID('');
    setFormTokenNumber((maxToken + 1).toString());
    setFormContactNumber('');
    setFormTShirtSize('M');
    setError(null);
    setShowModal(true);
  };

  // Open the Edit Participant form
  const openEditModal = (p: Participant) => {
    setModalMode('edit');
    setEditingParticipant(p);
    setFormName(p.name || '');
    setFormStudentID(p.studentID || '');
    setFormTokenNumber(p.tokenNumber || '');
    setFormContactNumber(p.contactNumber || '');
    setFormTShirtSize(p.tShirtSize || 'M');
    setError(null);
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = formName.trim();
    const studentID = formStudentID.trim();
    const tokenNumber = formTokenNumber.trim();
    const contactNumber = formContactNumber.trim();
    const tShirtSize = formTShirtSize;

    if (!name) {
      setError('Name is required.');
      return;
    }

    if (!tokenNumber) {
      setError('Token Number is required.');
      return;
    }

    // Check for duplicates
    const isDuplicateStudentID = participants.some(p => {
      if (modalMode === 'edit' && editingParticipant && p.studentID === editingParticipant.studentID && p.tokenNumber === editingParticipant.tokenNumber) {
        return false;
      }
      return studentID && p.studentID && p.studentID.toLowerCase() === studentID.toLowerCase();
    });

    const isDuplicateTokenNumber = participants.some(p => {
      if (modalMode === 'edit' && editingParticipant && p.studentID === editingParticipant.studentID && p.tokenNumber === editingParticipant.tokenNumber) {
        return false;
      }
      return p.tokenNumber && p.tokenNumber.toLowerCase() === tokenNumber.toLowerCase();
    });

    if (isDuplicateTokenNumber) {
      setError(`Token Number "${tokenNumber}" is already assigned to another participant.`);
      return;
    }

    if (studentID && isDuplicateStudentID) {
      setError(`Student ID "${studentID}" is already assigned to another participant.`);
      return;
    }

    const participantData: Participant = {
      name,
      studentID,
      tokenNumber,
      contactNumber,
      tShirtSize
    };

    if (modalMode === 'add') {
      onAddParticipant(participantData);
    } else if (modalMode === 'edit' && editingParticipant) {
      onEditParticipant(editingParticipant.studentID, editingParticipant.tokenNumber, participantData);
    }

    setShowModal(false);
  };

  // Export Registered list to Excel CSV
  const downloadCSV = () => {
    if (filteredParticipants.length === 0) {
      alert('No participants to export.');
      return;
    }

    const headers = ['Token Number', 'Student ID', 'Full Name', 'Contact Number', 'T-Shirt Size'];
    const rows = filteredParticipants.map(p => [
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
    link.setAttribute("download", `CivilScanner_Registered_Participants.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Registered Master List
          </h2>
          <p className="text-xs text-slate-500">View, add, edit, and manage all registered offline participant rosters securely.</p>
        </div>

        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => {
              setSelectedParticipantToken('');
              setShowManageModal(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 font-bold py-2.5 px-4.5 rounded-2xl text-xs transition-all cursor-pointer shadow-sm"
          >
            <Sliders className="w-4 h-4 text-slate-500" />
            <span>Manage (Edit/Delete)</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4.5 rounded-2xl text-xs transition-all border-0 cursor-pointer shadow-md"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Participant</span>
          </button>
          
          <button
            onClick={downloadCSV}
            disabled={filteredParticipants.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-2.5 px-4.5 rounded-2xl text-xs transition-all border-0 cursor-pointer shadow-md"
          >
            <FileDown className="w-4 h-4" />
            <span>Export CSV ({filteredParticipants.length})</span>
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm flex items-center gap-4 max-w-sm">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Registered</span>
            <span className="text-2xl font-black text-slate-800">{participants.length}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search registered list by name, student ID, token, contact, t-shirt size..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-150 font-bold text-slate-600 text-[10px] uppercase tracking-wider">
                <th className="p-4 pl-6">Participant Details</th>
                <th className="p-4 font-mono">Token Number</th>
                <th className="p-4">Contact Number</th>
                <th className="p-4">T-Shirt Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-slate-400 font-medium">
                    <Users className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    No registered participants found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((p, idx) => (
                  <tr key={`${p.studentID || 'no-id'}-${idx}`} className="hover:bg-slate-50/40 text-slate-700 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {p.name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 mt-0.5 ml-5">{p.studentID || 'No Student ID'}</div>
                    </td>
                    <td className="p-4 font-mono font-bold text-indigo-600">
                      #{p.tokenNumber}
                    </td>
                    <td className="p-4 font-mono text-[11px] text-slate-500">
                      {p.contactNumber ? (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-350" />
                          {p.contactNumber}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`font-bold px-2.5 py-1 rounded text-[10px] uppercase tracking-wide ${
                        p.tShirtSize === 'NONE' 
                          ? 'bg-slate-100 text-slate-500' 
                          : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {p.tShirtSize || 'M'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manage Participant Modal */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                Manage Participant
              </h3>
              <button
                onClick={() => setShowManageModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg border-0 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Select Participant to Edit or Delete
                </label>
                <select
                  value={selectedParticipantToken}
                  onChange={(e) => setSelectedParticipantToken(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
                >
                  <option value="">-- Choose a Participant --</option>
                  {participants.map((p) => (
                    <option key={p.tokenNumber} value={p.tokenNumber}>
                      #{p.tokenNumber} - {p.name} {p.studentID ? `(${p.studentID})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedParticipantToken ? (() => {
                const selectedP = participants.find(p => p.tokenNumber === selectedParticipantToken);
                if (!selectedP) return null;

                return (
                  <div className="space-y-5">
                    {/* Participant Info Card */}
                    <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3.5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-200/50">
                        Selected Participant Info
                      </h4>
                      <div className="grid grid-cols-2 gap-3.5 text-xs">
                        <div>
                          <span className="block text-[10px] text-slate-400 font-medium">Name</span>
                          <span className="font-extrabold text-slate-800 flex items-center gap-1.5 mt-0.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {selectedP.name}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400 font-medium">Token Number</span>
                          <span className="font-mono font-bold text-indigo-600 mt-0.5 block">
                            #{selectedP.tokenNumber}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400 font-medium">Student ID</span>
                          <span className="font-mono text-slate-600 mt-0.5 block">
                            {selectedP.studentID || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400 font-medium">T-Shirt Size</span>
                          <span className="mt-1.5 block">
                            <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide ${
                              selectedP.tShirtSize === 'NONE' 
                                ? 'bg-slate-150 text-slate-600' 
                                : 'bg-indigo-50 text-indigo-700'
                            }`}>
                              {selectedP.tShirtSize || 'M'}
                            </span>
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="block text-[10px] text-slate-400 font-medium">Contact Number</span>
                          <span className="font-mono text-slate-600 flex items-center gap-1.5 mt-0.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {selectedP.contactNumber || '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Panel */}
                    <div className="pt-2.5 flex items-center justify-end gap-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteParticipant(selectedP);
                          setShowManageModal(false);
                        }}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2.5 px-4 rounded-xl text-xs border border-red-100/50 cursor-pointer transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Participant</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          openEditModal(selectedP);
                          setShowManageModal(false);
                        }}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs border-0 cursor-pointer shadow-sm transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Edit Details</span>
                      </button>
                    </div>
                  </div>
                );
              })() : (
                <div className="py-8 text-center text-slate-400 font-medium bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <User className="w-8 h-8 text-slate-350 mx-auto mb-2 opacity-60" />
                  Please select a participant from the list above to proceed with editing or deleting.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Participant Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                {modalMode === 'add' ? 'Add New Participant' : 'Edit Participant Details'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg border-0 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3.5 bg-red-50 text-red-700 text-xs font-semibold rounded-2xl border border-red-100/50 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Student ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 21-44586-1"
                    value={formStudentID}
                    onChange={(e) => setFormStudentID(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Token Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 101"
                    value={formTokenNumber}
                    onChange={(e) => setFormTokenNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contact Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 01712345678"
                    value={formContactNumber}
                    onChange={(e) => setFormContactNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">T-Shirt Size</label>
                  <select
                    value={formTShirtSize}
                    onChange={(e) => setFormTShirtSize(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold"
                  >
                    <option value="NONE">NONE</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs border-0 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-xs border-0 cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Participant</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-scaleUp p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Delete Participant?</h3>
                <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl space-y-1.5 text-xs text-slate-600">
              <p><strong>Name:</strong> {confirmDeleteParticipant.name}</p>
              <p><strong>Student ID:</strong> {confirmDeleteParticipant.studentID || '—'}</p>
              <p><strong>Token:</strong> #{confirmDeleteParticipant.tokenNumber}</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteParticipant(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs border-0 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteParticipant(confirmDeleteParticipant.studentID, confirmDeleteParticipant.tokenNumber);
                  setConfirmDeleteParticipant(null);
                }}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-xl text-xs border-0 cursor-pointer shadow-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
