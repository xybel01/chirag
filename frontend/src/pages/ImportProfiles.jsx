import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { getCollectionItems, setCollectionDoc } from '../utils/firebase.js';

// Suggested portal fields to map for user profiles
const PORTAL_FIELDS = [
  { key: 'employeeName', label: 'Employee Full Name', required: true },
  { key: 'employeeId', label: 'Employee ID', required: true },
  { key: 'email', label: 'Email Address', required: true },
  { key: 'department', label: 'Department', required: true },
  { key: 'designation', label: 'Job Designation', required: true },
  { key: 'companyName', label: 'Corporate Company', required: true },
  { key: 'location', label: 'Office Location Site', required: true },
  { key: 'mobileNumber', label: 'Mobile Number' },
  { key: 'employmentStatus', label: 'Employment Status (ACTIVE/INACTIVE)' }
];

const STEPS = [
  'Upload File',
  'Map Columns',
  'Validate Data',
  'Review Duplicates',
  'Import',
  'Summary'
];

export default function ImportProfiles() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authorized
  useEffect(() => {
    if (user && !['SUPER_ADMIN', 'ADMIN', 'IT_MANAGER', 'IT_SUPPORT'].includes(user.role)) {
      navigate('/');
    }
  }, [user, navigate]);

  // Stepper state
  const [step, setStep] = useState(1);
  
  // Data state
  const [fileName, setFileName] = useState('');
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  
  // Mapping state: key -> Excel Header mapping
  const [mapping, setMapping] = useState({});
  
  // Validation state
  const [validatedData, setValidatedData] = useState([]); // Array of { data, errors, isValid }
  const [invalidRowsCount, setInvalidRowsCount] = useState(0);

  // Duplicates review state
  const [conflicts, setConflicts] = useState([]); // Array of { newUser, existingUser, resolution: 'SKIP' | 'UPDATE' }
  
  // Import tracking
  const [importProgress, setImportProgress] = useState(0);
  const [importLogs, setImportLogs] = useState({ total: 0, success: 0, updated: 0, skipped: 0, failed: 0 });
  const [failedRows, setFailedRows] = useState([]);

  // Standard regexes
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Handle file upload & parse headers/rows
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (data.length > 0) {
          const headers = data[0].map(h => String(h).trim());
          const rows = XLSX.utils.sheet_to_json(ws);

          setExcelHeaders(headers);
          setRawRows(rows);

          // Auto-mapping suggestion
          const autoMap = {};
          PORTAL_FIELDS.forEach((pf) => {
            const matched = headers.find(
              h => h.toLowerCase() === pf.key.toLowerCase() || 
                   h.toLowerCase().includes(pf.label.toLowerCase()) ||
                   h.toLowerCase().replace(/[^a-z0-9]/g, '') === pf.key.toLowerCase()
            );
            if (matched) autoMap[pf.key] = matched;
          });
          setMapping(autoMap);
          setStep(2);
        }
      } catch (err) {
        alert('Failed to parse Excel file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Perform validation on mapped data
  const handleRunValidation = () => {
    let invalidCount = 0;
    const validated = rawRows.map((row, index) => {
      const data = {};
      const errors = [];

      PORTAL_FIELDS.forEach((pf) => {
        const mappedHeader = mapping[pf.key];
        let val = mappedHeader ? row[mappedHeader] : null;

        // Trim values
        if (typeof val === 'string') {
          val = val.trim().replace(/\s+/g, ' ');
        }
        
        // Blank to null
        if (val === undefined || val === null || String(val).trim() === '') {
          val = null;
        }

        // Standardize employment status
        if (pf.key === 'employmentStatus') {
          if (val) {
            const upper = String(val).toUpperCase().trim();
            val = (upper === 'INACTIVE' || upper === 'LEFT' || upper === 'RESIGNED') ? 'INACTIVE' : 'ACTIVE';
          } else {
            val = 'ACTIVE'; // default
          }
        }

        data[pf.key] = val;
      });

      // Required fields validation
      PORTAL_FIELDS.forEach((pf) => {
        if (pf.required && !data[pf.key]) {
          errors.push(`${pf.label} is required`);
        }
      });

      // Format validations
      if (data.email && !EMAIL_REGEX.test(data.email)) {
        errors.push(`Invalid email format: ${data.email}`);
      }

      const isValid = errors.length === 0;
      if (!isValid) invalidCount++;

      return {
        rowNumber: index + 1,
        data,
        errors,
        isValid
      };
    });

    setValidatedData(validated);
    setInvalidRowsCount(invalidCount);
    setStep(3);
  };

  // Perform Firestore check for duplicate emails
  const handleCheckDuplicates = async () => {
    try {
      const existingUsers = await getCollectionItems('users');
      const detectedConflicts = [];

      // Only check duplicates for valid records
      const validRecords = validatedData.filter(r => r.isValid);

      validRecords.forEach((record) => {
        const { data } = record;
        const duplicate = existingUsers.find(
          (u) => String(u.email || '').toLowerCase() === String(data.email).toLowerCase() ||
                 String(u.id || '').toLowerCase() === String(data.email).toLowerCase()
        );

        if (duplicate) {
          detectedConflicts.push({
            rowNumber: record.rowNumber,
            newUser: data,
            existingUser: duplicate,
            resolution: 'SKIP', // default resolution
          });
        }
      });

      setConflicts(detectedConflicts);
      setStep(4);
    } catch (error) {
      alert('Error searching duplicates in Firestore: ' + error.message);
    }
  };

  // Resolve duplicate state changes
  const setResolution = (index, value) => {
    setConflicts((prev) => {
      const next = [...prev];
      next[index].resolution = value;
      return next;
    });
  };

  // Perform final import to Firestore
  const handleImport = async () => {
    setStep(5);
    setImportProgress(0);

    const validRecords = validatedData.filter(r => r.isValid);
    const totalCount = validRecords.length;

    let success = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const failures = [];

    for (let i = 0; i < totalCount; i++) {
      const record = validRecords[i];
      const { data } = record;

      // Check if this record had a conflict
      const conflict = conflicts.find(c => c.rowNumber === record.rowNumber);

      if (conflict && conflict.resolution === 'SKIP') {
        skipped++;
        setImportProgress(Math.round(((i + 1) / totalCount) * 100));
        continue;
      }

      try {
        const userDocId = data.email.toLowerCase();
        const existingConflict = conflict && conflict.resolution === 'UPDATE';
        
        const userData = {
          employeeName: data.employeeName,
          employeeId: data.employeeId,
          email: data.email,
          department: data.department,
          designation: data.designation,
          companyName: data.companyName,
          location: data.location,
          mobileNumber: data.mobileNumber || null,
          employmentStatus: data.employmentStatus || 'ACTIVE'
        };

        // If updating an existing user, preserve fields like profilePhoto or other metadata if they exist
        if (existingConflict && conflict.existingUser) {
          const mergedData = {
            ...conflict.existingUser,
            ...userData
          };
          await setCollectionDoc('users', userDocId, mergedData);
          updated++;
        } else {
          await setCollectionDoc('users', userDocId, userData);
          success++;
        }

      } catch (err) {
        failed++;
        failures.push({
          row: record.rowNumber,
          email: data.email,
          error: err.message
        });
      }

      setImportProgress(Math.round(((i + 1) / totalCount) * 100));
    }

    // Process invalid/failed rows too for logs
    const invalidRecords = validatedData.filter(r => !r.isValid);
    invalidRecords.forEach((record) => {
      failed++;
      failures.push({
        row: record.rowNumber,
        email: record.data.email || 'Unknown',
        error: record.errors.join(', ')
      });
    });

    setImportLogs({
      total: validatedData.length,
      success,
      updated,
      skipped,
      failed
    });
    setFailedRows(failures);
    setStep(6);
  };

  // Export failed rows as Excel sheet
  const handleDownloadErrors = () => {
    if (failedRows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(failedRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import Failures");
    XLSX.writeFile(wb, "profile_import_failures.xlsx");
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <PageHeader title="Bulk User Profile Import Wizard" subtitle="Import employee profiles from Excel or CSV sheets" />

      {/* Stepper Progress Bar */}
      <div className="mb-8 card p-4 bg-white shadow-xs">
        <div className="flex justify-between items-center">
          {STEPS.map((s, idx) => (
            <div key={s} className="flex items-center flex-1 last:flex-initial">
              <div className="flex flex-col items-center">
                <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                  step === idx + 1 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                    : step > idx + 1
                      ? 'border-emerald-600 bg-emerald-500 text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-400'
                }`}>
                  {step > idx + 1 ? '✓' : idx + 1}
                </div>
                <span className={`text-2xs font-semibold mt-1 tracking-wide ${
                  step === idx + 1 ? 'text-indigo-700 font-bold' : 'text-gray-400'
                }`}>{s}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${
                  step > idx + 1 ? 'bg-emerald-500' : 'bg-gray-150'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="card p-8 bg-white border border-dashed border-gray-300 text-center max-w-lg mx-auto">
          <svg className="mx-auto h-12 w-12 text-indigo-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <h3 className="mt-4 font-bold text-gray-800 text-base">Upload Excel or CSV File</h3>
          <p className="text-xs text-gray-500 mt-1">Supports file formats like .xlsx, .xls and .csv</p>
          <label className="mt-5 btn-primary cursor-pointer inline-flex justify-center mx-auto">
            Choose File
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      )}

      {/* Step 2: Map Columns */}
      {step === 2 && (
        <div className="card p-6 bg-white space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-800 text-base">Map Headers</h3>
            <p className="text-xs text-gray-500">Align your spreadsheet headers with employee profile fields.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {PORTAL_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col border border-gray-100 p-2.5 rounded-xl bg-slate-50/50">
                <span className="text-xs font-bold text-indigo-900 flex items-center">
                  {field.label} {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </span>
                <select
                  value={mapping[field.key] || ''}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="input mt-1.5 py-1 text-xs"
                >
                  <option value="">-- Don't Import / Skip --</option>
                  {excelHeaders.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-4 mt-6">
            <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn-primary" onClick={handleRunValidation}>Run Validation</button>
          </div>
        </div>
      )}

      {/* Step 3: Validate */}
      {step === 3 && (
        <div className="card p-6 bg-white space-y-4">
          <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-800 text-base">Data Validation</h3>
              <p className="text-xs text-gray-500">Please review format validation errors before importing.</p>
            </div>
            <div className="flex gap-2">
              <span className="rounded bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {validatedData.length - invalidRowsCount} Valid Rows
              </span>
              <span className={`rounded px-2.5 py-1 text-xs font-semibold ${
                invalidRowsCount > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-400'
              }`}>
                {invalidRowsCount} Invalid Rows
              </span>
            </div>
          </div>

          <div className="max-h-96 overflow-auto border border-gray-100 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-gray-100 text-gray-500 sticky top-0">
                <tr>
                  <th className="p-3">Row</th>
                  <th className="p-3">Employee Name</th>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Email Address</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {validatedData.map((row) => (
                  <tr key={row.rowNumber} className={row.isValid ? 'bg-white hover:bg-slate-50/20' : 'bg-red-50/30'}>
                    <td className="p-3 font-semibold">{row.rowNumber}</td>
                    <td className="p-3">{row.data.employeeName || '—'}</td>
                    <td className="p-3">{row.data.employeeId || '—'}</td>
                    <td className="p-3">{row.data.email || '—'}</td>
                    <td className="p-3">{row.data.department || '—'}</td>
                    <td className="p-3">
                      {row.isValid ? (
                        <span className="text-emerald-600 font-bold">Valid</span>
                      ) : (
                        <span className="text-red-600 font-bold" title={row.errors.join(', ')}>
                          ❌ {row.errors[0]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between border-t border-gray-100 pt-4 mt-6">
            <button className="btn-secondary" onClick={() => setStep(2)}>Back</button>
            <button 
              className="btn-primary" 
              onClick={handleCheckDuplicates}
              disabled={validatedData.length - invalidRowsCount === 0}
            >
              Check Duplicates
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Duplicates */}
      {step === 4 && (
        <div className="card p-6 bg-white space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-800 text-base">Duplicate Records Resolution</h3>
            <p className="text-xs text-gray-500">Conflicts detected by Email ID in the database.</p>
          </div>

          {conflicts.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <svg className="mx-auto h-12 w-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="mt-3 font-semibold text-gray-700">No duplicates detected!</h4>
              <p className="text-xs text-gray-400 mt-1">All valid items can be safely imported as new records.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {conflicts.map((conf, idx) => (
                <div key={idx} className="border border-indigo-50 bg-indigo-50/10 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-2xs font-bold text-indigo-700">
                      Row {conf.rowNumber} duplicate email: {conf.newUser.email}
                    </span>
                    <h4 className="text-sm font-bold text-gray-800">
                      {conf.newUser.employeeName} ({conf.newUser.employeeId})
                    </h4>
                    <p className="text-xs text-gray-500">
                      Existing database employee: <strong className="text-indigo-900">{conf.existingUser.employeeName}</strong> ({conf.existingUser.employeeId || 'No ID'})
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setResolution(idx, 'SKIP')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border ${
                        conf.resolution === 'SKIP' 
                          ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Skip Row
                    </button>
                    <button
                      type="button"
                      onClick={() => setResolution(idx, 'UPDATE')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border ${
                        conf.resolution === 'UPDATE' 
                          ? 'bg-brand-600 border-brand-700 text-white shadow-sm'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Update Existing (Overwrite)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between border-t border-gray-100 pt-4 mt-6">
            <button className="btn-secondary" onClick={() => setStep(3)}>Back</button>
            <button className="btn-primary" onClick={handleImport}>Run Import</button>
          </div>
        </div>
      )}

      {/* Step 5: Import */}
      {step === 5 && (
        <div className="card p-8 bg-white max-w-md mx-auto text-center space-y-4">
          <div className="relative flex items-center justify-center mx-auto h-16 w-16">
            <div className="absolute h-full w-full rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
            <span className="text-xs font-bold text-indigo-700">{importProgress}%</span>
          </div>
          <h3 className="font-bold text-gray-800 text-base">Importing User Profiles to Firestore...</h3>
          <p className="text-xs text-gray-500">Writing employee profiles. Please wait.</p>
          <div className="w-full bg-gray-150 h-2 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-brand-600 to-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
          </div>
        </div>
      )}

      {/* Step 6: Summary */}
      {step === 6 && (
        <div className="card p-6 bg-white space-y-6 max-w-lg mx-auto">
          <div className="text-center">
            <div className="inline-flex h-12 w-12 bg-emerald-50 text-emerald-600 items-center justify-center rounded-full shadow-sm mb-3">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-800 text-lg">Import Process Complete!</h3>
            <p className="text-xs text-gray-500">The employee profiles have been saved to Firestore.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border border-gray-100 rounded-xl p-3 bg-slate-50/50 text-center">
              <span className="text-2xs font-bold text-gray-500 uppercase tracking-wide">Total Rows</span>
              <h4 className="text-2xl font-black text-gray-800 mt-1">{importLogs.total}</h4>
            </div>
            <div className="border border-gray-100 rounded-xl p-3 bg-slate-50/50 text-center">
              <span className="text-2xs font-bold text-emerald-600 uppercase tracking-wide">Successfully Imported</span>
              <h4 className="text-2xl font-black text-emerald-600 mt-1">{importLogs.success}</h4>
            </div>
            <div className="border border-gray-100 rounded-xl p-3 bg-slate-50/50 text-center">
              <span className="text-2xs font-bold text-indigo-600 uppercase tracking-wide">Updated Profiles</span>
              <h4 className="text-2xl font-black text-indigo-600 mt-1">{importLogs.updated}</h4>
            </div>
            <div className="border border-gray-100 rounded-xl p-3 bg-slate-50/50 text-center">
              <span className="text-2xs font-bold text-amber-600 uppercase tracking-wide">Skipped Rows</span>
              <h4 className="text-2xl font-black text-amber-600 mt-1">{importLogs.skipped}</h4>
            </div>
          </div>

          {importLogs.failed > 0 && (
            <div className="border border-red-100 bg-red-50/20 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-red-800">⚠️ {importLogs.failed} Rows Failed or Invalid</h4>
                  <p className="text-xs text-red-600">Rows containing validation errors or upload issues were not written.</p>
                </div>
                <button
                  onClick={handleDownloadErrors}
                  className="px-3 py-1.5 bg-red-600 border border-red-700 text-white rounded-xl text-xs font-bold hover:bg-red-700 active:scale-95 transition-all shadow-xs"
                >
                  Download Log
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-center border-t border-gray-100 pt-4 mt-6">
            <button className="btn-primary px-6" onClick={() => navigate('/user-profiles')}>Return to Profiles</button>
          </div>
        </div>
      )}
    </div>
  );
}
