async function getStatus(req, res) {
  try {
    // Generate simulated server stats that vary slightly to feel dynamic
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
    
    const servers = [
      { id: 'srv-db', name: 'PostgreSQL DB Server', type: 'Database Server', ip: '10.100.1.15', cpu: rand(10, 35), ram: rand(45, 60), disk: 58, status: 'ONLINE', ping: '1.2ms' },
      { id: 'srv-ad', name: 'Entra ID Domain Controller', type: 'Active Directory', ip: '10.100.1.10', cpu: rand(5, 20), ram: rand(30, 45), disk: 40, status: 'ONLINE', ping: '0.8ms' },
      { id: 'srv-vpn', name: 'FortiClient VPN Gateway', type: 'VPN Gateway', ip: '10.100.10.1', cpu: rand(40, 75), ram: rand(60, 80), disk: 72, status: 'ONLINE', ping: '12ms' },
      { id: 'srv-web', name: 'ERP Application Server', type: 'Web Server', ip: '10.100.1.20', cpu: rand(15, 50), ram: rand(50, 75), disk: 82, status: 'ONLINE', ping: '1.5ms' },
    ];

    const networkDevices = [
      { id: 'net-sw1', name: 'Main Server Room Switch', model: 'Cisco Catalyst 9300', ip: '10.100.1.2', status: 'ONLINE', loss: '0%', ping: '0.5ms' },
      { id: 'net-fw', name: 'Edge Security Firewall', model: 'FortiGate 100F', ip: '192.168.100.1', status: 'ONLINE', loss: '0%', ping: '4.2ms' },
      { id: 'net-wap', name: 'Warehouse Access Point', model: 'Aruba AP-515', ip: '10.100.5.10', status: 'ONLINE', loss: '0%', ping: '18ms' }
    ];

    const services = [
      { id: 'svc-m365', name: 'Microsoft Graph Sync Connector', status: 'ACTIVE', lastSync: new Date().toISOString() },
      { id: 'svc-ssl', name: 'ERP SSL Certificate Expiry', status: 'OK', daysLeft: 145 },
      { id: 'svc-smtp', name: 'SMTP Ticket-to-Email Gateway', status: 'ACTIVE', queueSize: 0 }
    ];

    res.json({
      timestamp: new Date().toISOString(),
      servers,
      networkDevices,
      services
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getStatus };
