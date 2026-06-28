export const vehicles = [
  { id: 'v1', plate: 'กฉ9647', color: '#f97316' }, // Bright Orange
  { id: 'v2', plate: 'กฉ3500', color: '#3b82f6' }, // Bright Blue
  { id: 'v3', plate: 'ช9919', color: '#8b5cf6' }  // Bright Purple
];

export const drivers = [
  { id: 'd1', name: 'นายสุนันท์ ค่ำคูณ' },
  { id: 'd2', name: 'นายมานิตย์ ประดับทอง' },
  { id: 'd3', name: 'นายจักรินทร์ จันทร์สา' },
  { id: 'd4', name: 'นายสดสี สีนอก' },
  { id: 'd5', name: 'นายศักดิ์ดา ออมทรัพย์' }
];

export const generateMockData = (year, month) => {
  const trips = [];
  const inspections = [];
  const risks = [];

  const startMonth = month === 0 ? 1 : month;
  const endMonth = month === 0 ? 12 : month;

  for (let m = startMonth; m <= endMonth; m++) {
    const daysInMonth = new Date(year, m, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Inspections
      vehicles.forEach(vehicle => {
        const isInspected = Math.random() > 0.1;
        inspections.push({
          date: dateStr,
          day: day,
          month: m,
          vehicleId: vehicle.id,
          vehiclePlate: vehicle.plate,
          completed: isInspected,
          inspectorName: isInspected ? drivers[Math.floor(Math.random() * drivers.length)].name.split(' ')[0] : 'X',
          time: isInspected ? `0${7 + Math.floor(Math.random() * 2)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}` : null
        });
      });

      // Trips and Speeding
      const numTrips = Math.floor(Math.random() * 5) + 1; 
      for (let i = 0; i < numTrips; i++) {
        const driver = drivers[Math.floor(Math.random() * drivers.length)];
        const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
        const hasSpeeding = Math.random() < 0.2;
        const maxSpeed = hasSpeeding ? Math.floor(Math.random() * 40) + 91 : Math.floor(Math.random() * 30) + 60; 
        
        trips.push({
          id: `t_${m}_${day}_${i}`,
          date: dateStr,
          month: m,
          driverId: driver.id,
          driverName: driver.name,
          vehicleId: vehicle.id,
          vehiclePlate: vehicle.plate,
          maxSpeed: maxSpeed,
          isSpeeding: hasSpeeding,
        });
      }

      // Risks/Incidents
      if (Math.random() < 0.05) { 
        const riskTypes = ['ยางรั่ว', 'ระบบไฟขัดข้อง', 'เฉี่ยวชนเล็กน้อย', 'แอร์ไม่เย็น'];
        const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
        risks.push({
          id: `r_${m}_${day}`,
          date: dateStr,
          month: m,
          type: riskTypes[Math.floor(Math.random() * riskTypes.length)],
          vehiclePlate: vehicle.plate
        });
      }
    }
  }

  return { trips, inspections, risks };
};
