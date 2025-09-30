const { io } = require('socket.io-client');

console.log('🔌 Yhdistetään Socket.IO palvelimeen...');

const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
  timeout: 5000
});

socket.on('connect', () => {
  console.log('✅ Socket.IO yhteys muodostettu, ID:', socket.id);
  
  async function testMultipleInstallations() {
    console.log('🔧 Testataan useamman asennustavan lisäämistä tuotteelle 1201902');
    
    const installations = [
      { methodCode: 5, standardHours: 1.0, name: 'Väliaikainen' },
      { methodCode: 99, standardHours: 0.25, name: 'Fallback Test' }
    ];
    
    for (let i = 0; i < installations.length; i++) {
      const installation = installations[i];
      
      console.log(`📤 Lisätään asennustapa ${i + 1}/${installations.length}: ${installation.name}`);
      
      const request = {
        action: 'add_product_installation',
        productCode: '1201902',
        productLine: 'L',
        methodCode: installation.methodCode,
        standardHours: installation.standardHours,
        isDefault: i === 0 // Ensimmäinen on oletus
      };
      
      try {
        const response = await new Promise((resolve, reject) => {
          socket.emit('api-request', request, (response) => {
            if (response && response.success) {
              resolve(response);
            } else {
              reject(new Error(response?.error || 'Request failed'));
            }
          });
        });
        
        console.log(`✅ Asennustapa ${installation.name} lisätty onnistuneesti!`);
        console.log(`   Method code: ${installation.methodCode}, Hours: ${installation.standardHours}`);
      } catch (error) {
        console.log(`❌ Virhe lisätessä asennustapaa ${installation.name}:`, error.message);
      }
    }
    
    console.log('🔍 Haetaan tuotteen kaikki asennustavat...');
    
    const getInstallationsRequest = {
      action: 'get_product_installations',
      productCode: '1201902',
      productLine: 'L'
    };
    
    socket.emit('api-request', getInstallationsRequest, (response) => {
      console.log('📥 Tuotteen asennustavat:');
      console.log(JSON.stringify(response, null, 2));
      
      if (response && response.success && response.data) {
        console.log(`📦 Tuotteella ${response.data.length} asennustapaa:`);
        response.data.forEach((installation, index) => {
          console.log(`${index + 1}. Method ${installation.method_code} - ${installation.standard_hours}h ${installation.is_default ? '(OLETUS)' : ''}`);
        });
      }
      
      socket.disconnect();
    });
  }
  
  testMultipleInstallations();
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
}, 15000);