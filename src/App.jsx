import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Activity, AlertTriangle, CheckCircle, Truck, Calendar as CalendarIcon, Users, ShieldAlert, CalendarDays, ClipboardCheck, Loader2, Gauge, Fuel
} from 'lucide-react';
import { vehicles, drivers } from './mockData'; 
import { fetchDashboardData } from './dataFetcher';
import './index.css';

const THAI_MONTHS = [
  'ทุกเดือน', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const App = () => {
  const [selectedYear, setSelectedYear] = useState(2026); 
  const [selectedMonth, setSelectedMonth] = useState(6); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveData, setLiveData] = useState({ allTrips: [], allInspections: [], risks: [] });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchDashboardData();
        setLiveData(data);
        setError(null);
      } catch (err) {
        console.error("Failed to load data", err);
        setError("ไม่สามารถดึงข้อมูลจาก Google Sheets ได้ กรุณาตรวจสอบสิทธิ์การเข้าถึงไฟล์");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const { trips, inspections, risks } = useMemo(() => {
    if (!liveData) return { trips: [], inspections: [], risks: [] };
    
    const filteredTrips = liveData.allTrips.filter(t => 
      t.year === selectedYear && (selectedMonth === 0 || t.month === selectedMonth)
    );
    const filteredRisks = liveData.risks.filter(r => 
      r.year === selectedYear && (selectedMonth === 0 || r.month === selectedMonth)
    );
    
    let processedInspections = [];
    const startMonth = selectedMonth === 0 ? 1 : selectedMonth;
    const endMonth = selectedMonth === 0 ? 12 : selectedMonth;
    
    for (let m = startMonth; m <= endMonth; m++) {
      const daysInMonth = new Date(selectedYear, m, 0).getDate();
      let limitDay = daysInMonth;
      
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const today = new Date().getDate();

      const currentHour = new Date().getHours();

      if (selectedYear === currentYear && m === currentMonth) {
        limitDay = today;
      } else if (selectedYear > currentYear || (selectedYear === currentYear && m > currentMonth)) {
        limitDay = 0; 
      }

      const isTwiceADayMonth = selectedYear > 2026 || (selectedYear === 2026 && m >= 7);

      for (let day = 1; day <= limitDay; day++) {
        vehicles.forEach(vehicle => {
          if (isTwiceADayMonth) {
            // Check Morning
            const morningRecord = liveData.allInspections.find(i => i.year === selectedYear && i.month === m && i.day === day && i.vehiclePlate === vehicle.plate && i.period === 'morning');
            if (morningRecord) {
              processedInspections.push({ ...morningRecord, month: m });
            } else {
              processedInspections.push({
                year: selectedYear, month: m, day, vehiclePlate: vehicle.plate, vehicleId: vehicle.id, completed: false, period: 'morning', inspectorName: 'X'
              });
            }
            
            // Check Evening
            let isEveningRequired = true;
            if (selectedYear === currentYear && m === currentMonth && day === today && currentHour < 12) {
              isEveningRequired = false; // Not required yet if it's still morning today
            }
            if (isEveningRequired) {
              const eveningRecord = liveData.allInspections.find(i => i.year === selectedYear && i.month === m && i.day === day && i.vehiclePlate === vehicle.plate && i.period === 'evening');
              if (eveningRecord) {
                processedInspections.push({ ...eveningRecord, month: m });
              } else {
                processedInspections.push({
                  year: selectedYear, month: m, day, vehiclePlate: vehicle.plate, vehicleId: vehicle.id, completed: false, period: 'evening', inspectorName: 'X'
                });
              }
            }
          } else {
            // Legacy check (once a day)
            const record = liveData.allInspections.find(i => i.year === selectedYear && i.month === m && i.day === day && i.vehiclePlate === vehicle.plate);
            if (record) {
              processedInspections.push({ ...record, month: m });
            } else {
              processedInspections.push({
                year: selectedYear, month: m, day, vehiclePlate: vehicle.plate, vehicleId: vehicle.id, completed: false, period: 'any', inspectorName: 'X'
              });
            }
          }
        });
      }
    }

    return { trips: filteredTrips, inspections: processedInspections, risks: filteredRisks };
  }, [liveData, selectedYear, selectedMonth]);

  const totalTrips = trips.filter(t => t.source === 'usage').length;
  const speedingTrips = trips.filter(t => t.isSpeeding);
  const totalSpeeding = speedingTrips.length;
  const totalRisks = risks.length;

  const maxSpeedsByDriver = useMemo(() => {
    if (speedingTrips.length === 0) return [];
    const maxByDriver = {};
    speedingTrips.forEach(trip => {
      const driver = trip.driverName;
      if (!maxByDriver[driver] || trip.maxSpeed > maxByDriver[driver]) {
        maxByDriver[driver] = trip.maxSpeed;
      }
    });
    return Object.entries(maxByDriver)
      .map(([name, maxSpeed]) => ({ name, maxSpeed }))
      .sort((a, b) => b.maxSpeed - a.maxSpeed);
  }, [speedingTrips]);

  const fuelAndDistanceSummary = useMemo(() => {
    return vehicles.map(v => {
      const vTrips = trips.filter(t => t.vehiclePlate === v.plate && t.source === 'usage');
      const totalDistance = vTrips.reduce((sum, t) => sum + (t.distance || 0), 0);
      const totalFuelCost = vTrips.reduce((sum, t) => sum + (t.fuelCost || 0), 0);
      const totalFuelVolume = vTrips.reduce((sum, t) => sum + (t.fuelVolume || 0), 0);
      return {
        ...v,
        totalDistance,
        totalFuelCost,
        totalFuelVolume
      };
    });
  }, [trips]);

  const dailyShiftTrips = useMemo(() => {
    if (selectedMonth === 0) return [];
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const data = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayTrips = trips.filter(t => !t.isRefuel && t.source === 'usage' && t.day === day);
      data.push({
        day: day.toString(),
        'เช้า': dayTrips.filter(t => t.shift === 'เช้า').length,
        'บ่าย': dayTrips.filter(t => t.shift === 'บ่าย').length,
        'ดึก': dayTrips.filter(t => t.shift === 'ดึก').length,
      });
    }
    return data;
  }, [trips, selectedMonth, selectedYear]);

  const inspectionRatesByVehicle = useMemo(() => {
    return vehicles.map(v => {
      const vehicleInspections = inspections.filter(i => i.vehiclePlate === v.plate);
      const completed = vehicleInspections.filter(i => i.completed).length;
      const total = vehicleInspections.length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { ...v, completed, total, rate, label: `${v.plate} (${rate}%)` };
    });
  }, [inspections]);

  const inspectionsByInspector = useMemo(() => {
    const counts = {};
    inspections.filter(i => i.completed).forEach(i => {
      counts[i.inspectorName] = (counts[i.inspectorName] || 0) + 1;
    });
    return Object.keys(counts)
      .map(name => ({ name, count: counts[name] }))
      .sort((a,b) => b.count - a.count);
  }, [inspections]);

  const tripsByVehicle = useMemo(() => {
    const counts = {};
    const usageTrips = trips.filter(t => t.source === 'usage');
    usageTrips.forEach(t => {
      counts[t.vehiclePlate] = (counts[t.vehiclePlate] || 0) + 1;
    });
    return vehicles.map(v => {
      const count = counts[v.plate] || 0;
      const percent = totalTrips > 0 ? Math.round((count / totalTrips) * 100) : 0;
      return { name: v.plate, value: count, percent, color: v.color };
    });
  }, [trips, totalTrips]);

  const speedingByDriver = useMemo(() => {
    const dataMap = {};
    speedingTrips.forEach(t => {
      if (!dataMap[t.driverName]) {
        dataMap[t.driverName] = { name: t.driverName, total: 0, totalOffset: 0.01, durationMinutes: 0 };
        vehicles.forEach(v => dataMap[t.driverName][v.plate] = 0);
      }
      dataMap[t.driverName][t.vehiclePlate] += 1;
      dataMap[t.driverName].total += 1;
      dataMap[t.driverName].durationMinutes += (t.durationMinutes || 0);
    });
    
    // Round duration
    Object.values(dataMap).forEach(d => {
      d.durationMinutes = Math.round(d.durationMinutes * 10) / 10;
    });
    
    return Object.values(dataMap).sort((a,b) => b.total - a.total);
  }, [speedingTrips]);

  const recentSpeeding = [...speedingTrips].reverse().slice(0, 5);

  const isMonthSelected = selectedMonth > 0;
  let calendarDays = [];
  let daysOfWeek = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  
  if (isMonthSelected) {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const firstDayOfWeek = new Date(selectedYear, selectedMonth - 1, 1).getDay(); 
    calendarDays = Array.from({length: firstDayOfWeek}, () => null).concat(
      Array.from({length: daysInMonth}, (_, i) => i + 1)
    );
  }

  const getInspectionsForDay = (day) => {
    return inspections.filter(i => i.day === day && i.month === selectedMonth);
  };

  const years = [2024, 2025, 2026, 2027];

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-color)' }}>
        <Loader2 size={48} className="text-primary" style={{ animation: 'spin 1s linear infinite' }} />
        <h2 style={{ marginTop: '1rem', color: 'var(--text-main)' }}>กำลังดึงข้อมูลจาก Google Sheets...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-color)' }}>
        <ShieldAlert size={48} style={{ color: 'var(--danger)' }} />
        <h2 style={{ marginTop: '1rem', color: 'var(--text-main)' }}>{error}</h2>
        <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>ลองใหม่</button>
      </div>
    );
  }

  const renderCustomBarLabel = (props) => {
    const { x, y, width, height, value } = props;
    if (value === 0) return null;
    return (
      <text x={x + width / 2} y={y + height / 2} fill="#ffffff" textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight="bold">
        {value}
      </text>
    );
  };

  return (
    <div className="dashboard-container">
      <header className="header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1rem', borderBottom: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--primary)', paddingBottom: '1rem' }}>
          <div className="header-title">
            <h1>Dashboard ความปลอดภัยรถส่งต่อผู้ป่วย</h1>
            <p>โรงพยาบาลค้อวัง</p>
          </div>
          <button 
            style={{
              backgroundColor: 'var(--danger)',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontFamily: 'Sarabun, sans-serif',
              fontSize: '1rem',
              boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)'
            }}
            onClick={() => window.open('https://script.google.com/macros/s/AKfycbyutQ-4VV-MjEUDg3uPnk5_xoc52UpqniyX4TECKW2Vsv3_Fj7ltALRDeuirVorj_4Y/exec', '_blank')}
          >
            <ShieldAlert size={20} />
            รายงานความเสี่ยง
          </button>
        </div>
        
        <div className="filter-bar" style={{ marginTop: '0' }}>
          <div className="filter-group">
            <CalendarIcon size={18} style={{ color: 'var(--primary)' }} />
            <label>เดือน:</label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
              {THAI_MONTHS.map((monthName, idx) => (
                <option key={idx} value={idx}>{monthName}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>ปี:</label>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="summary-cards">
        <div className="card">
          <div className="card-header">
            <span className="card-title">ความเร็วสูงสุดแต่ละคน (&gt;90)</span>
            <div className="card-icon warning"><Gauge size={20} /></div>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {maxSpeedsByDriver.length > 0 ? (
              maxSpeedsByDriver.map((driver, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>{driver.name}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--danger)' }}>
                    {driver.maxSpeed} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-light)' }}>กม./ชม.</span>
                  </span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-light)', textAlign: 'center', padding: '1rem 0' }}>ไม่มีข้อมูลความเร็วเกิน 90 กม./ชม.</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">จำนวนเที่ยวรถทั้งหมด</span>
            <div className="card-icon primary"><Truck size={20} /></div>
          </div>
          <div className="card-value">{totalTrips} <span className="card-subvalue">รอบ</span></div>
        </div>
        
        <div className="card">
          <div className="card-header">
            <span className="card-title">การขับรถเร็วเกินกำหนด</span>
            <div className="card-icon danger"><AlertTriangle size={20} /></div>
          </div>
          <div className="card-value">{totalSpeeding} <span className="card-subvalue">ครั้ง</span></div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">ความเสี่ยง (ปัญหาที่พบ)</span>
            <div className="card-icon warning"><ShieldAlert size={20} /></div>
          </div>
          <div className="card-value">{totalRisks} <span className="card-subvalue">รายการ</span></div>
        </div>

        <div className="card" style={{ padding: '1rem 1.5rem' }}>
          <div className="card-header" style={{ marginBottom: '0.5rem' }}>
            <span className="card-title">ตรวจสภาพรถ (ร้อยละ)</span>
            <div className="card-icon success"><CheckCircle size={20} /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            {inspectionRatesByVehicle.map(v => (
              <div key={v.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: v.color }}>{v.plate}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {v.rate}% <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>({v.completed}/{v.total})</span>
                  </span>
                </div>
                <div style={{ width: '100%', backgroundColor: '#f1f5f9', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ width: `${v.rate}%`, backgroundColor: v.color, height: '100%', borderRadius: '4px' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="panel">
          <div className="panel-header">
            <Activity size={24} style={{ color: 'var(--primary)' }} />
            <h2 className="panel-title">สถิติขับรถเร็วแยกตามพนักงานขับรถ และทะเบียนรถ</h2>
          </div>
          <div style={{ height: 320 }}>
            {speedingByDriver.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={speedingByDriver} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={14} tick={{fill: '#0f172a'}} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={14} tick={{fill: '#64748b'}} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    cursor={{fill: '#f1f5f9'}}
                  />
                  <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
                  {vehicles.map(v => (
                    <Bar key={v.plate} dataKey={v.plate} stackId="a" fill={v.color} name={`ทะเบียน ${v.plate}`} barSize={50}>
                      <LabelList dataKey={v.plate} content={renderCustomBarLabel} />
                    </Bar>
                  ))}
                  {/* Dummy bar to render the total label at the top of the stack */}
                  <Bar dataKey="totalOffset" stackId="a" fill="transparent" barSize={50}>
                    <LabelList dataKey="total" position="top" fill="#0f172a" fontSize={14} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                ไม่มีสถิติขับรถเร็วใน{isMonthSelected ? 'เดือนนี้' : 'ปีนี้'} 🎉
              </div>
            )}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
            *หมายเหตุ: จำนวนครั้งของการขับรถเร็วนับจากการขับเร็วตั้งแต่ 90 กม./ชม. เกิน 5 นาที
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <Activity size={24} style={{ color: 'var(--danger)' }} />
            <h2 className="panel-title">ระยะเวลารวมที่ขับรถเร็วเกิน 90 กม./ชม. แยกคนขับ (นาที)</h2>
          </div>
          <div style={{ height: 320 }}>
            {speedingByDriver.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={speedingByDriver} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={14} tick={{fill: '#0f172a'}} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={14} tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    cursor={{fill: '#f1f5f9'}}
                    formatter={(value) => [`${value} นาที`, 'ระยะเวลา']}
                  />
                  <Bar dataKey="durationMinutes" fill="#ef4444" name="ระยะเวลา (นาที)" barSize={50}>
                    <LabelList dataKey="durationMinutes" position="top" fill="#0f172a" fontSize={12} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">ไม่มีข้อมูลการขับรถเร็ว</div>
            )}
          </div>
        </div>

        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-header">
            <Activity size={24} style={{ color: 'var(--primary)' }} />
            <h2 className="panel-title">กราฟจำนวนรอบการขับรถส่งต่อรายวัน แยกตามเวร (ไม่รวมเติมน้ำมัน)</h2>
          </div>
          <div style={{ height: 320 }}>
            {isMonthSelected && dailyShiftTrips.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyShiftTrips} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={14} tick={{fill: '#0f172a'}} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={14} tick={{fill: '#64748b'}} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    cursor={{fill: '#f1f5f9'}}
                  />
                  <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
                  <Bar dataKey="เช้า" stackId="a" fill="#3b82f6" name="เวรเช้า" />
                  <Bar dataKey="บ่าย" stackId="a" fill="#f59e0b" name="เวรบ่าย" />
                  <Bar dataKey="ดึก" stackId="a" fill="#8b5cf6" name="เวรดึก" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                {isMonthSelected ? 'ไม่มีข้อมูลการขับรถส่งต่อในเดือนนี้' : 'กรุณาเลือกเดือนเพื่อดูกราฟรายวัน'}
              </div>
            )}
          </div>
        </div>

        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-header">
            <Fuel size={24} style={{ color: 'var(--primary)' }} />
            <h2 className="panel-title">สรุปการใช้รถ ค่าน้ำมัน และระยะทาง แยกตามคัน</h2>
          </div>
          <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 600 }}>ทะเบียนรถ</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 600 }}>รวมระยะทาง (กม.)</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 600 }}>ค่าน้ำมัน (บาท)</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 600 }}>ปริมาณน้ำมัน (ลิตร)</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 600 }}>อัตราสิ้นเปลือง (กม./ลิตร)</th>
                </tr>
              </thead>
              <tbody>
                {fuelAndDistanceSummary.map(v => {
                  const fuelEconomy = v.totalFuelVolume > 0 ? (v.totalDistance / v.totalFuelVolume).toFixed(2) : '-';
                  return (
                    <tr key={v.plate} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: v.color }}>{v.plate}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{v.totalDistance.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{v.totalFuelCost.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{v.totalFuelVolume.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{fuelEconomy}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <Truck size={24} style={{ color: 'var(--primary)' }} />
            <h2 className="panel-title">จำนวนรอบการใช้ส่งต่อ (รวมทั้งหมด {totalTrips} รอบ)</h2>
          </div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tripsByVehicle}
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  label={({name, value, percent}) => `${name} ${value}รอบ (${percent}%)`}
                  labelLine={false}
                  fontSize={12}
                >
                  {tripsByVehicle.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value, name, props) => [`${value} รอบ (${props.payload.percent}%)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>





      <div className="panel">
        <div className="panel-header">
          <CalendarDays size={24} style={{ color: 'var(--primary)' }} />
          <h2 className="panel-title">ปฏิทินตรวจความพร้อมใช้รถ {isMonthSelected ? `ประจำเดือน${THAI_MONTHS[selectedMonth]}` : 'ตลอดทั้งปี (ซ่อนปฏิทิน)'}</h2>
        </div>
        
        {isMonthSelected ? (
          <div className="calendar-grid">
            {daysOfWeek.map(d => (
              <div key={d} className="calendar-header-day">{d}</div>
            ))}
            {calendarDays.map((day, idx) => (
              <div key={idx} className={`calendar-day ${day === null ? 'empty' : ''}`}>
                {day && (
                  <>
                    <div className="calendar-date">{day}</div>
                    <div className="calendar-inspections">
                      {getInspectionsForDay(day).map((ins, i) => (
                        <div key={i} className={`cal-inspect-item ${!ins.completed ? 'missed' : ''}`}>
                          {ins.period === 'morning' && '☀️เช้า: '}
                          {ins.period === 'evening' && '🌙เย็น: '}
                          {ins.vehiclePlate} {ins.completed ? `(${ins.inspectorName})` : '(ขาด)'}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            เลือกเดือนที่ต้องการ เพื่อดูปฏิทินการตรวจสภาพรถแบบรายวัน
          </div>
        )}
        
        <div style={{ marginTop: '1.5rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <ClipboardCheck size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>รายการตรวจเช็คความพร้อมใช้รถประจำวัน (25 รายการ)</h3>
          </div>
          <ol style={{ 
            fontSize: '0.9rem', 
            color: '#475569', 
            columnCount: 2, 
            columnGap: '2rem',
            paddingLeft: '1.5rem', 
            margin: 0,
            lineHeight: '1.6'
          }}>
            <li>ระดับน้ำมันเชื้อเพลิง</li>
            <li>ระยะทางปัจจุบัน</li>
            <li>เข็มขัดนิรภัย</li>
            <li>ความพร้อมใช้งานออกซิเจนประจำรถ Refer</li>
            <li>ประกันรถ</li>
            <li>พรบ.รถ</li>
            <li>ภาษีรถ</li>
            <li>แบตเตอรี่รถ</li>
            <li>สี/รอยบุบ/รอยขูดขีด รอบคัน</li>
            <li>ระดับน้ำมันเครื่อง</li>
            <li>ไฟแสงสว่างหน้า ซ้าย - ขวา และไฟหรี่รอบคันรถ</li>
            <li>สัญญาณไฟเลี้ยวหน้า (ไฟหน้า) ซ้าย-ขวา</li>
            <li>สัญญาณไฟเลี้ยวหลัง(ไฟท้าย) ซ้าย-ขวา</li>
            <li>สัญญาณไฟแจ้งเมื่อถอยหลัง</li>
            <li>กล้องหน้ารถ - กล้องหลังรถ – GPS</li>
            <li>กล้องภายใน-ภายนอกรถ/GPS</li>
            <li>ระบบรูดบัตรขับขี่และระบบGPS</li>
            <li>ลมยาง ล้อหน้า (ซ้าย - ขวา)</li>
            <li>ลมยาง ล้อหลัง (ซ้าย - ขวา)</li>
            <li>ความสะอาด/ความพร้อมใช้ของรถส่งต่อผู้ป่วย [ถังขยะติดเชื้อ] [เปลนอนส่งต่อผู้ป่วย] [ความสะอาดเครื่องมือแพทย์] [อุปกรณ์น้ำยาฆ่าเชื้อ]</li>
            <li>ความตึงและสภาพสายพาน</li>
            <li>ความพร้อมใช้ของหน้าปัดน้ำฝน/น้ำหน้าปัดน้ำฝน</li>
            <li>ระดับน้ำมันพวงมาลัยพาวเวอร์</li>
            <li>ระดับน้ำยาหล่อเย็น(หม้อน้ำ)</li>
            <li>ความพร้อมใช้ระดับน้ำมันเบรก</li>
          </ol>
        </div>
      </div>

    </div>
  );
};

export default App;
