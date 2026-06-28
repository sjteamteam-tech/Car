import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Activity, AlertTriangle, CheckCircle, Truck, Calendar as CalendarIcon, Users, ShieldAlert, CalendarDays, ClipboardCheck, Loader2
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

      if (selectedYear === currentYear && m === currentMonth) {
        limitDay = today;
      } else if (selectedYear > currentYear || (selectedYear === currentYear && m > currentMonth)) {
        limitDay = 0; 
      }

      for (let day = 1; day <= limitDay; day++) {
        vehicles.forEach(vehicle => {
          const record = liveData.allInspections.find(i => i.year === selectedYear && i.month === m && i.day === day && i.vehiclePlate === vehicle.plate);
          if (record) {
            processedInspections.push({ ...record, month: m });
          } else {
            processedInspections.push({
              year: selectedYear,
              month: m,
              day: day,
              vehiclePlate: vehicle.plate,
              vehicleId: vehicle.id,
              completed: false,
              inspectorName: 'X'
            });
          }
        });
      }
    }

    return { trips: filteredTrips, inspections: processedInspections, risks: filteredRisks };
  }, [liveData, selectedYear, selectedMonth]);

  const totalTrips = trips.filter(t => t.source === 'usage').length;
  const speedingTrips = trips.filter(t => t.isSpeeding);
  const totalSpeeding = speedingTrips.length;
  const totalDriversCount = drivers.length;
  const totalRisks = risks.length;

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
        dataMap[t.driverName] = { name: t.driverName, total: 0, totalOffset: 0.01 };
        vehicles.forEach(v => dataMap[t.driverName][v.plate] = 0);
      }
      dataMap[t.driverName][t.vehiclePlate] += 1;
      dataMap[t.driverName].total += 1;
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
            <span className="card-title">พนักงานขับรถ</span>
            <div className="card-icon info"><Users size={20} /></div>
          </div>
          <div className="card-value">{totalDriversCount} <span className="card-subvalue">คน</span></div>
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
                          ({ins.vehiclePlate}, {ins.inspectorName})
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
      </div>

    </div>
  );
};

export default App;
