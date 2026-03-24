const fs = require('fs');
const path = require('path');

console.log('\n🔍 Verificando API Key en AndroidManifest.xml...\n');

const manifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.error('❌ ERROR: AndroidManifest.xml no existe');
  console.error('   Ruta esperada:', manifestPath);
  console.error('\n💡 Solución: Ejecuta "npx expo prebuild --clean" primero\n');
  process.exit(1);
}

const manifestContent = fs.readFileSync(manifestPath, 'utf8');

// Buscar la API key
const apiKeyRegex = /<meta-data\s+android:name="com\.google\.android\.geo\.API_KEY"\s+android:value="([^"]+)"\s*\/>/;
const match = manifestContent.match(apiKeyRegex);

if (match) {
  const apiKey = match[1];
  console.log('✅ API Key encontrada en AndroidManifest.xml');
  console.log('   Valor:', apiKey);
  
  if (apiKey === 'AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU') {
    console.log('✅ API Key es correcta\n');
    process.exit(0);
  } else {
    console.log('⚠️  API Key NO coincide con la esperada');
    console.log('   Esperada: AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU');
    console.log('   Encontrada:', apiKey);
    console.log('\n💡 Solución: Verifica app.json o app.config.js\n');
    process.exit(1);
  }
} else {
  console.log('❌ API Key NO encontrada en AndroidManifest.xml');
  console.log('\n📋 Contenido relevante del AndroidManifest.xml:');
  
  // Mostrar las primeras 50 líneas para debugging
  const lines = manifestContent.split('\n').slice(0, 50);
  lines.forEach((line, index) => {
    if (line.includes('meta-data') || line.includes('google') || line.includes('maps')) {
      console.log(`   Línea ${index + 1}: ${line.trim()}`);
    }
  });
  
  console.log('\n💡 Solución:');
  console.log('   1. Verifica que app.json o app.config.js tenga la configuración correcta');
  console.log('   2. Ejecuta: npx expo prebuild --clean');
  console.log('   3. Ejecuta este script nuevamente\n');
  process.exit(1);
}
