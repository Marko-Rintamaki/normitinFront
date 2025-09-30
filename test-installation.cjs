const { io } = require('socket.io-client');

console.log('🔌 Yhdistetään Socket.IO palvelimeen...');

const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
  timeout: 5000
});

socket.on('connect', () => {
  console.log('✅ Socket.IO yhteys muodostettu, ID:', socket.id);
  
  // Testataan asennustavan lisäämistä tuotteelle
  console.log('🔧 Testataan asennustavan lisäämistä tuotteelle 1201902');
  
  const addInstallationRequest = {
    action: 'add_product_installation',
    productCode: '1201902',
    productLine: 'L',
    methodCode: 3, // Numerona: Erikoisasennus (method_code 3 on saatavilla L-linjalle)
    standardHours: 0.5, // 30 minuuttia
    isDefault: false
  };
  
  console.log('📤 Lähetetään add installation request:', JSON.stringify(addInstallationRequest, null, 2));
  
  socket.emit('api-request', addInstallationRequest, (response) => {
    console.log('📥 Vastaus saapui!');
    console.log('🔧 Tulos:', JSON.stringify(response, null, 2));
    
    if (response && response.success) {
      console.log('✅ Asennustapa lisätty onnistuneesti!');
    } else {
      console.log('❌ Asennustavan lisääminen epäonnistui');
      if (response && response.error) {
        console.log('🔥 Virhe:', response.error);
      }
    }
    
    socket.disconnect();
  });
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket.IO yhteyden muodostaminen epäonnistui:', error.message);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Socket.IO yhteys katkaistiin:', reason);
  process.exit(0);
});

// Timeout varalta
setTimeout(() => {
  console.log('⏰ Timeout - katkaistaan yhteys');
  socket.disconnect();
  process.exit(1);
}, 10000);