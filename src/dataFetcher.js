import Papa from 'papaparse';
import { vehicles, drivers } from './mockData'; // keep vehicles info for colors

const SHEET_URLS = {
  inspections: 'https://docs.google.com/spreadsheets/d/1vSDhMOr7A2iKfzvP9Cv_nSKJkJk0kYCLHLPGdCzqzs0/export?format=csv&gid=1907779796',
  speeding: 'https://docs.google.com/spreadsheets/d/1fPL_eTSRUBIlgrwF0MwjEOeEN6YVfHi9eoCoSaNsy3g/export?format=csv&gid=239312134',
  usage_9647: 'https://docs.google.com/spreadsheets/d/1rb3Sk7l02wVW2ju4LUz-TC125n2OFjDCFbJoNRFG6rk/export?format=csv&gid=0',
  usage_3500: 'https://docs.google.com/spreadsheets/d/1rb3Sk7l02wVW2ju4LUz-TC125n2OFjDCFbJoNRFG6rk/export?format=csv&gid=1510255099',
  usage_9919: 'https://docs.google.com/spreadsheets/d/1rb3Sk7l02wVW2ju4LUz-TC125n2OFjDCFbJoNRFG6rk/export?format=csv&gid=1055722390',
  risks: 'https://docs.google.com/spreadsheets/d/1BtC9QZY3mxkiMgc7kyLl6AryVI31IaAwQFfyU2dGrxk/export?format=csv&gid=0',
  alcohol: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ5XuyW3hQYtwmFSi6DeNoS2taSPX8xx6UVOLVql8taqKcm6TDpo44OPN3cLFKj4W72nBNpv8kicodv/pub?output=csv'
};

const parseCSV = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error)
      });
    });
  } catch (error) {
    console.error("Error fetching CSV from:", url, error);
    throw error;
  }
};

// Helper to parse dates like "1/6/2026" or "1/6/69" (Thai year) or "01/06/2026 14:52:22" or "2026-06-28"
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  let dStr = dateStr.split(' ')[0]; // get just the date part
  let timeStr = dateStr.split(' ')[1];
  let hour = 12; // default
  if (timeStr) {
    hour = parseInt(timeStr.split(':')[0], 10);
  }
  
  if (dStr.includes('-')) {
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10), day: parseInt(parts[2], 10), hour };
    }
  }

  let parts = dStr.split('/');
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    
    // Handle Thai short year (e.g. 69 -> 2569 -> 2026)
    if (year < 100) {
      year = (year + 2500) - 543;
    } else if (year > 2500) {
      // Full Thai year
      year = year - 543;
    }
    
    return { year, month, day, hour };
  }
  return null;
};

// Normalize vehicle plate from string
const normalizePlate = (str) => {
  if (!str) return 'ไม่ทราบ';
  if (str.includes('9647')) return 'กฉ9647';
  if (str.includes('3500')) return 'กฉ3500';
  if (str.includes('9919')) return 'ช9919';
  return str;
};

export const fetchDashboardData = async () => {
  try {
    const [
      inspectionsRaw, 
      speedingRaw, 
      usage9647Raw, 
      usage3500Raw, 
      usage9919Raw,
      risksRaw,
      alcoholRaw
    ] = await Promise.all([
      parseCSV(SHEET_URLS.inspections),
      parseCSV(SHEET_URLS.speeding),
      parseCSV(SHEET_URLS.usage_9647),
      parseCSV(SHEET_URLS.usage_3500),
      parseCSV(SHEET_URLS.usage_9919),
      parseCSV(SHEET_URLS.risks),
      parseCSV(SHEET_URLS.alcohol)
    ]);

    const allTrips = [];
    const allInspections = [];
    const allRisks = [];

    // Process Inspections
    // Headers: ประทับเวลา, ชื่อผู้ตรวจสอบความพร้อมใช้  >>, ตรวจสอบรถReferคัน >>
    inspectionsRaw.forEach((row, idx) => {
      const ts = row['ประทับเวลา'];
      const dateInfo = parseDate(ts);
      if (dateInfo) {
        const plateRaw = row['ตรวจสอบรถReferคัน >>'];
        const plate = normalizePlate(plateRaw);
        const inspectorFullName = row['ชื่อผู้ตรวจสอบความพร้อมใช้  >>'] || 'ไม่ระบุ';
        const inspectorName = inspectorFullName.replace('นาย', '').split(' ')[0];

        allInspections.push({
          id: `insp_${idx}`,
          date: `${dateInfo.year}-${String(dateInfo.month).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`,
          year: dateInfo.year,
          month: dateInfo.month,
          day: dateInfo.day,
          hour: dateInfo.hour,
          period: dateInfo.hour < 12 ? 'morning' : 'evening',
          vehiclePlate: plate,
          vehicleId: vehicles.find(v => v.plate === plate)?.id || plate,
          completed: true,
          inspectorName: inspectorName
        });
      }
    });

    // Process Speeding
    // Headers: No., Car Name, License Plate, Province, Driver, Start Date, Start Position, End Date, End Position, Limit Speed, Max Speed, Period
    const parseDurationToMinutes = (periodStr) => {
      if (!periodStr) return 0;
      let minutes = 0;
      let seconds = 0;
      const minMatch = periodStr.match(/(\d+)\s*minutes?/);
      const secMatch = periodStr.match(/(\d+)\s*seconds?/);
      if (minMatch) minutes += parseInt(minMatch[1], 10);
      if (secMatch) seconds += parseInt(secMatch[1], 10);
      return minutes + (seconds / 60);
    };

    speedingRaw.forEach((row, idx) => {
      const ts = row['Start Date'];
      const dateInfo = parseDate(ts);
      if (dateInfo) {
        const speed = parseFloat(row['Max Speed']) || 0;
        // Count as speeding if Max Speed > 90
        const isSpeeding = speed > 90;
        const durationStr = row['Period'];
        const durationMinutes = parseDurationToMinutes(durationStr);

        allTrips.push({
          id: `speed_${idx}`,
          date: `${dateInfo.year}-${String(dateInfo.month).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`,
          year: dateInfo.year,
          month: dateInfo.month,
          day: dateInfo.day,
          vehiclePlate: normalizePlate(row['License Plate']),
          source: 'speeding',
          driverName: row['Driver'] || 'ไม่ระบุ',
          maxSpeed: speed,
          isSpeeding: isSpeeding,
          durationMinutes: durationMinutes,
          durationStr: durationStr
        });
      }
    });

    // Process Usage
    const processUsage = (data, plate) => {
      data.forEach((row, idx) => {
        const ts = row['วันที่ออกเดินทาง'];
        const dateInfo = parseDate(ts);
        if (dateInfo) {
          const isRefuel = (row['สถานที่ไป'] && row['สถานที่ไป'].includes('เติมน้ำมัน')) || 
                           (row['ER/IPD'] && row['ER/IPD'].includes('เติมน้ำมัน'));

          const fuelCost = parseFloat(row['จำนวนเงิน']) || 0;
          const fuelVolume = parseFloat(row['เติมน้ำมันกี่ลิตร']) || 0;
          const distance = parseFloat(row['รวมระยะทาง']) || 0;
          let shift = row['เป็นเวร'] || 'ไม่ระบุ';
          if (shift.includes('เช้า')) shift = 'เช้า';
          else if (shift.includes('บ่าย')) shift = 'บ่าย';
          else if (shift.includes('ดึก')) shift = 'ดึก';
          else shift = 'ไม่ระบุ';

          allTrips.push({
            id: `usage_${plate}_${idx}`,
            date: `${dateInfo.year}-${String(dateInfo.month).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`,
            year: dateInfo.year,
            month: dateInfo.month,
            day: dateInfo.day,
            vehiclePlate: plate,
            source: 'usage',
            driverName: row['พนักงานขับรถ'] || row['ผู้ใช้รถ'] || 'ไม่ระบุ',
            isRefuel: isRefuel,
            fuelCost: fuelCost,
            fuelVolume: fuelVolume,
            distance: distance,
            shift: shift
          });
        }
      });
    };

    processUsage(usage9647Raw, 'กฉ9647');
    processUsage(usage3500Raw, 'กฉ3500');
    processUsage(usage9919Raw, 'ช9919');

    // Process Risks
    if (risksRaw && risksRaw.length > 0) {
      risksRaw.forEach((row, idx) => {
        const keys = Object.keys(row);
        let ts = row['วันที่เกิดเหตุ'] || row['ประทับเวลา'];
        if (!ts) {
          const dateKey = keys.find(k => k.includes('วันที่') || k.includes('เวลา'));
          if (dateKey) ts = row[dateKey];
        }
        if (!ts && keys.length > 0) ts = row[keys[0]];
        if (!ts) return;

        const dateInfo = parseDate(ts);
        if (dateInfo) {
          allRisks.push({
            id: `risk_${idx}`,
            date: ts,
            year: dateInfo.year,
            month: dateInfo.month,
            day: dateInfo.day,
            hour: dateInfo.hour,
            period: dateInfo.hour < 12 ? 'morning' : 'evening',
            vehiclePlate: normalizePlate(row['ทะเบียนรถ'] || row[keys.find(k => k.includes('ทะเบียน'))]),
            driverName: row['พนักงานขับรถ'] || row[keys.find(k => k.includes('พนักงาน'))],
            details: row['รายละเอียดเหตุการณ์'] || row[keys.find(k => k.includes('รายละเอียด'))],
            location: row['สถานที่เกิดเหตุ'] || row[keys.find(k => k.includes('สถานที่'))]
          });
        }
      });
    }

    // Process Alcohol Tests
    const alcoholTests = [];
    if (alcoholRaw && alcoholRaw.length > 0) {
      alcoholRaw.forEach((row, idx) => {
        const ts = row['วัน-เดือน-ปี ที่ทำการตรวจวัดปริมาณแอลกอฮอล์'] || row['ประทับเวลา'];
        const dateInfo = parseDate(ts);
        if (dateInfo) {
          let shift = row['ช่วงเวลาในการตรวจปริมาณแอลกอฮอล์'] || '';
          if (shift.includes('เช้า')) shift = 'เช้า';
          else if (shift.includes('บ่าย')) shift = 'บ่าย';
          else if (shift.includes('ดึก')) shift = 'ดึก';
          else shift = 'ไม่ระบุ';

          const driverRaw = row['ชื่อ-สกุล พนักงานขับรถที่เข้ารับการตรวจปริมาณแอลกอออล์'] || '';
          const driverName = driverRaw.replace(/^[0-9]+\.\s*/, '').replace(/นาย|นาง|นางสาว/g, '').trim().split(' ')[0];

          const alcoholLevelStr = row['ปริมาณแอลกอฮอล์ที่ตรวจวัดได้'] || '0';
          const isFailed = parseFloat(alcoholLevelStr) > 0;

          alcoholTests.push({
            id: `alc_${idx}`,
            date: `${dateInfo.year}-${String(dateInfo.month).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`,
            year: dateInfo.year,
            month: dateInfo.month,
            day: dateInfo.day,
            shift: shift,
            driverName: driverName,
            isFailed: isFailed,
            level: alcoholLevelStr
          });
        }
      });
    }

    return {
      allTrips,
      allInspections,
      risks: allRisks,
      alcoholTests: alcoholTests
    };
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
};
