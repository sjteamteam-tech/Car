const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

content = content.replace(
  "const { trips, inspections, risks } = useMemo(() => {",
  "const { trips, inspections, risks, alcoholTests } = useMemo(() => {"
);

content = content.replace(
  "if (!liveData) return { trips: [], inspections: [], risks: [] };",
  "if (!liveData) return { trips: [], inspections: [], risks: [], alcoholTests: [] };"
);

content = content.replace(
  "return { trips: filteredTrips, inspections: processedInspections, risks: filteredRisks };",
  `    const filteredAlcohol = liveData.alcoholTests ? liveData.alcoholTests.filter(a => 
      a.year === selectedYear && (selectedMonth === 0 || a.month === selectedMonth)
    ) : [];
    return { trips: filteredTrips, inspections: processedInspections, risks: filteredRisks, alcoholTests: filteredAlcohol };`
);

const complianceLogic = `  const totalRisks = risks.length;

  const alcoholCompliance = useMemo(() => {
    const compliance = [];
    const missingAlerts = [];
    let totalTests = 0;
    let totalFailed = 0;
    let totalMissing = 0;

    drivers.forEach(driver => {
      const morningTrips = trips.filter(t => t.driverName === driver.name && t.shift === 'เช้า');
      const workedDays = new Set(morningTrips.map(t => \`\${t.year}-\${t.month}-\${t.day}\`));
      const morningReq = workedDays.size;

      const morningTests = alcoholTests.filter(a => a.driverName === driver.name && a.shift === 'เช้า');
      const testedDays = new Set(morningTests.map(a => \`\${a.year}-\${a.month}-\${a.day}\`));
      const morningDone = testedDays.size;

      const afterNightTrips = trips.filter(t => t.driverName === driver.name && (t.shift === 'บ่าย' || t.shift === 'ดึก') && !t.isRefuel);
      const afterNightReq = afterNightTrips.length;

      const afterNightTests = alcoholTests.filter(a => a.driverName === driver.name && (a.shift === 'บ่าย' || a.shift === 'ดึก'));
      const afterNightDone = afterNightTests.length;

      const driverTotalReq = morningReq + afterNightReq;
      const driverTotalDone = morningDone + afterNightDone;
      const rate = driverTotalReq > 0 ? Math.round((Math.min(driverTotalDone, driverTotalReq) / driverTotalReq) * 100) : 100;
      
      let status = '🟢 ดีเยี่ยม';
      if (driverTotalDone < driverTotalReq) status = \`🟡 ขาด \${driverTotalReq - driverTotalDone} ครั้ง\`;
      if (rate < 80) status = \`🔴 ขาดเยอะ (\${rate}%)\`;

      compliance.push({
        name: driver.name,
        morningReq, morningDone,
        afterNightReq, afterNightDone,
        rate, status
      });

      totalTests += driverTotalDone;
      totalMissing += Math.max(0, driverTotalReq - driverTotalDone);

      workedDays.forEach(dateStr => {
        if (!testedDays.has(dateStr)) {
          missingAlerts.push(\`วันที่ \${dateStr} | เวรเช้า | \${driver.name} (มาทำงานแต่ไม่พบผลตรวจ)\`);
        }
      });

      const anTripsByDay = {};
      afterNightTrips.forEach(t => {
        const d = \`\${t.year}-\${t.month}-\${t.day}\`;
        anTripsByDay[d] = (anTripsByDay[d] || 0) + 1;
      });
      const anTestsByDay = {};
      afterNightTests.forEach(a => {
        const d = \`\${a.year}-\${a.month}-\${a.day}\`;
        anTestsByDay[d] = (anTestsByDay[d] || 0) + 1;
      });
      Object.keys(anTripsByDay).forEach(dateStr => {
        const req = anTripsByDay[dateStr];
        const done = anTestsByDay[dateStr] || 0;
        if (done < req) {
          missingAlerts.push(\`วันที่ \${dateStr} | เวรบ่าย/ดึก | \${driver.name} (วิ่งรถ \${req} รอบ แต่ตรวจ \${done} ครั้ง)\`);
        }
      });
    });

    totalFailed = alcoholTests.filter(a => a.isFailed).length;
    missingAlerts.sort();

    return { compliance, missingAlerts, totalTests, totalFailed, totalMissing };
  }, [trips, alcoholTests]);`;

content = content.replace("  const totalRisks = risks.length;", complianceLogic);

const oldCard = `        <div className="card" style={{ padding: '1rem 1.5rem' }}>
          <div className="card-header" style={{ marginBottom: '0.5rem' }}>
            <span className="card-title">ตรวจสภาพรถ (ร้อยละ)</span>
            <div className="card-icon success"><CheckCircle size={20} /></div>
          </div>`;

const newCard = `        <div className="card">
          <div className="card-header">
            <span className="card-title">การตรวจเป่าแอลกอฮอล์</span>
            <div className="card-icon success"><CheckCircle size={20} /></div>
          </div>
          <div className="card-value">{alcoholCompliance.totalTests} <span className="card-subvalue">ครั้ง</span></div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <span style={{ color: alcoholCompliance.totalFailed > 0 ? 'var(--danger)' : '#64748b' }}>
              พบแอลกอฮอล์: {alcoholCompliance.totalFailed} ครั้ง
            </span>
            <span style={{ color: alcoholCompliance.totalMissing > 0 ? '#f59e0b' : '#64748b' }}>
              ขาดตรวจ: {alcoholCompliance.totalMissing} ครั้ง
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.5rem' }}>
          <div className="card-header" style={{ marginBottom: '0.5rem' }}>
            <span className="card-title">ตรวจสภาพรถ (ร้อยละ)</span>
            <div className="card-icon success"><CheckCircle size={20} /></div>
          </div>`;

content = content.replace(oldCard, newCard);

const newPanel = `
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-header">
            <ShieldAlert size={24} style={{ color: 'var(--primary)' }} />
            <h2 className="panel-title">สรุปความครอบคลุมการตรวจสอบเป่าแอลกอฮอล์</h2>
          </div>
          
          {alcoholCompliance.missingAlerts.length > 0 && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginTop: '1rem', color: '#b91c1c' }}>
              <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <AlertTriangle size={18} /> พบการขาดตรวจแอลกอฮอล์ {alcoholCompliance.missingAlerts.length} รายการ:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem', lineHeight: '1.6' }}>
                {alcoholCompliance.missingAlerts.map((alert, idx) => (
                  <li key={idx}>{alert}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 600 }}>พนักงานขับรถ</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 600, textAlign: 'center' }}>เวรเช้า (ตรวจ/วันทำงาน)</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 600, textAlign: 'center' }}>เวรบ่าย-ดึก (ตรวจ/รอบที่ขับ)</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 600, textAlign: 'center' }}>อัตราความสม่ำเสมอ</th>
                  <th style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 600, textAlign: 'center' }}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {alcoholCompliance.compliance.map(c => (
                  <tr key={c.name} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>{c.name}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{c.morningDone} / {c.morningReq}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{c.afterNightDone} / {c.afterNightReq}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 'bold', color: c.rate >= 90 ? 'var(--success)' : c.rate >= 70 ? '#f59e0b' : 'var(--danger)' }}>{c.rate}%</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
`;

content = content.replace(
  '<div className="panel">\n        <div className="panel-header">\n          <CalendarDays size={24}',
  newPanel + '\n      <div className="panel">\n        <div className="panel-header">\n          <CalendarDays size={24}'
);

fs.writeFileSync('src/App.jsx', content);
console.log("App.jsx updated!");
