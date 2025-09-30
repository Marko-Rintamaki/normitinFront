const { io } = require('socket.io-client');

console.log('🔌 Yhdistetään Socket.IO palvelimeen...');

const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
  timeout: 5000
});

socket.on('connect', () => {
  console.log('✅ Socket.IO yhteys muodostettu, ID:', socket.id);
  
  // Testataan asennustapojen hakua ensin
  console.log('� Testataan asennustapojen hakua');
  
  const installationMethodsRequest = {
    action: 'get_product_installation_methods'
  };
  
  console.log('📤 Lähetetään installation methods request:', JSON.stringify(installationMethodsRequest, null, 2));
  
  socket.emit('api-request', installationMethodsRequest, (response) => {
    console.log('📥 Asennustavat vastaanotttu!');
    console.log('🔧 Asennustavat:', JSON.stringify(response, null, 2));
    
    if (response && response.success && response.data) {
      console.log(`🔧 Löydettiin ${response.data.length} asennustapaa:`);
      response.data.forEach((method, index) => {
        console.log(`${index + 1}. ${method.id} - ${method.method_name} (koodi: ${method.method_code})`);
      });
    }
    
    // Sitten testataan tuotehakua
    console.log('\n🔍 Testataan hakua: "ht muhvi 110"');
    
    const apiRequestData = {
      action: 'search_products',
      query: 'ht muhvi 110',
      limit: 10,
      offset: 0
    };
    
    console.log('📤 Lähetetään api-request:', JSON.stringify(apiRequestData, null, 2));
    
    socket.emit('api-request', apiRequestData, (response) => {
      console.log('📥 Vastaus saapui!');
      console.log('📋 Hakutulos:', JSON.stringify(response, null, 2));
      
      if (response && response.success && response.data && response.data.products) {
        console.log(`📦 Löydettiin ${response.data.products.length} tuotetta:`);
        response.data.products.forEach((product, index) => {
          console.log(`${index + 1}. ${product.product_code} - ${product.general_name} (${product.supplier_name})`);
        });
      } else {
        console.log('❌ Haku epäonnistui tai ei tuloksia');
        if (response && response.error) {
          console.log('🔥 Virhe:', response.error);
        }
      }
      
      socket.disconnect();
    });
  });
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket.IO yhteyden muodostaminen epäonnistui:', error.message);
  process.exit(1);
});

// Kuuntele kaikkia viestejä debuggausta varten
socket.onAny((eventName, ...args) => {
  console.log('📨 Socket.IO tapahtuma:', eventName, args);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Socket.IO yhteys katkaistiin:', reason);
  process.exit(0);
});

// Timeout jos ei vastausta 10 sekunnissa
setTimeout(() => {
  console.log('⏱️ Aikakatkaistu - ei vastausta 10 sekunnissa');
  socket.disconnect();
  process.exit(1);
}, 10000);