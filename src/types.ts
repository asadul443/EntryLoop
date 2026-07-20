/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Participant {
  name: string;
  studentID: string;
  tokenNumber: string;
  contactNumber: string;
  tShirtSize: string;
}

export interface ScanLogEntry {
  id: string;
  timestamp: string;
  studentID: string;
  tokenNumber: string;
  name: string;
  status: 'success' | 'duplicate' | 'invalid';
  reason?: string;
}

export interface Activity {
  id: string;
  name: string;
  icon: string; // Lucide icon identifier
  scannedCount: number;
  duplicateAttempts: number;
}

export interface ActivityLogs {
  [activityId: string]: ScanLogEntry[];
}

export interface AppState {
  participants: Participant[];
  activities: Activity[];
  logs: ActivityLogs;
  activeActivityId: string | null; // null means dashboard
}

export interface DbBackup {
  version: number;
  timestamp: string;
  participants: Participant[];
  activities: Activity[];
  logs: ActivityLogs;
}
