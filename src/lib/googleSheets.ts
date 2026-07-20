/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GoogleSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime: string;
}

/**
 * Lists the user's spreadsheets from Google Drive
 */
export async function listUserSpreadsheets(accessToken: string): Promise<GoogleSpreadsheetFile[]> {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)&pageSize=40`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch spreadsheets (${response.status})`);
  }
  
  const data = await response.json();
  return data.files || [];
}

/**
 * Gets sheet names (tabs) within a Google Spreadsheet
 */
export async function getSpreadsheetSheets(accessToken: string, spreadsheetId: string): Promise<string[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch spreadsheet structure');
  }
  
  const data = await response.json();
  return (data.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);
}

/**
 * Fetches all row values of a specific sheet inside a spreadsheet
 */
export async function fetchSheetData(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  const range = encodeURIComponent(`${sheetName}!A:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch spreadsheet row data');
  }
  
  const data = await response.json();
  return data.values || [];
}

/**
 * Creates a brand new spreadsheet and writes data to it
 * Returns the spreadsheet ID
 */
export async function createNewSpreadsheetWithData(
  accessToken: string,
  title: string,
  sheetName: string,
  headers: string[],
  rows: string[][]
): Promise<{ id: string; url: string }> {
  // 1. Create spreadsheet
  const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: sheetName } }],
    }),
  });

  if (!createRes.ok) {
    const errorData = await createRes.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to create new spreadsheet');
  }

  const spreadsheet = await createRes.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  const spreadsheetUrl = spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Write data
  await writeSheetValues(accessToken, spreadsheetId, sheetName, headers, rows);

  return { id: spreadsheetId, url: spreadsheetUrl };
}

/**
 * Writes data rows to a sheet (adding the tab if it doesn't exist)
 */
export async function exportToExistingSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  rows: string[][]
): Promise<void> {
  // 1. Try to add the sheet tab in case it does not exist
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  
  try {
    const addSheetRes = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: { title: sheetName },
            },
          },
        ],
      }),
    });
    
    // If it's 400, the sheet tab probably already exists, which is fine!
    if (!addSheetRes.ok && addSheetRes.status !== 400) {
      console.warn('Adding sheet tab failed, attempting to write directly anyway...');
    }
  } catch (err) {
    console.warn('Could not add tab (might already exist):', err);
  }

  // 2. Write values (clear existing data in that sheet tab first, or just overwrite from A1)
  // To keep it simple and clean, we overwrite from A1 onwards.
  await writeSheetValues(accessToken, spreadsheetId, sheetName, headers, rows);
}

/**
 * Helper to write cells using PUT /values/range
 */
async function writeSheetValues(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  rows: string[][]
): Promise<void> {
  const range = `${sheetName}!A1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  
  const body = {
    range,
    majorDimension: 'ROWS',
    values: [headers, ...rows],
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to write data values to sheet');
  }
}
