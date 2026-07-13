const XLSX = require('xlsx');
const path = require('path');

try {
  const filePath = path.join(__dirname, '..', '..', 'test mail.xlsx');
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws);
  
  console.log('Total Rows:', data.length);
  if (data.length > 0) {
    console.log('Headers:', Object.keys(data[0]));
    console.log('Sample Row 1:', data[0]);
  }
} catch (error) {
  console.error('Error reading Excel headers:', error);
}
