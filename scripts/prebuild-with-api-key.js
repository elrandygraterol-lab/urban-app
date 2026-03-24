#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('\n🚀 Iniciando prebuild con inyección de API Key...\n');

// Determinar el directorio raíz del proyecto
const projectRoot = process.cwd();
console.log('📁 Directorio de trabajo:', projectRoot);

try {
  // Step 1: Run expo prebuild
  console.log('\n📦 Paso 1/3: Ejecutando expo prebuild --clean...\n');
  execSync('npx expo prebuild --clean --platform android', {
    stdio: 'inherit',
    cwd: projectRoot,
    env: { ...process.env }
  });
  console.log('\n✅ Prebuild completado\n');

  // Step 2: Inject API key
  console.log('\n💉 Paso 2/3: Inyectando API Key...\n');
  
  const manifestPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ ERROR: AndroidManifest.xml no existe en:', manifestPath);
    process.exit(1);
  }

  let manifestContent = fs.readFileSync(manifestPath, 'utf8');

  // Verificar si la API key ya existe
  const apiKeyRegex = /<meta-data\s+android:name="com\.google\.android\.geo\.API_KEY"/;
  if (apiKeyRegex.test(manifestContent)) {
    console.log('✅ API Key ya existe en AndroidManifest.xml\n');
  } else {
    // Buscar la etiqueta <application>
    const applicationTagRegex = /(<application[^>]*>)/;
    const match = manifestContent.match(applicationTagRegex);

    if (!match) {
      console.error('❌ ERROR: No se encontró la etiqueta <application> en AndroidManifest.xml');
      process.exit(1);
    }

    // Inyectar la API key
    const apiKeyMetaData = '\n    <!-- Google Maps API Key -->\n    <meta-data android:name="com.google.android.geo.API_KEY" android:value="AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU"/>';
    manifestContent = manifestContent.replace(applicationTagRegex, `$1${apiKeyMetaData}`);
    
    fs.writeFileSync(manifestPath, manifestContent, 'utf8');
    console.log('✅ API Key inyectada exitosamente\n');
  }

  // Step 3: Verify API key
  console.log('\n🔍 Paso 3/3: Verificando API Key...\n');
  
  const verifyContent = fs.readFileSync(manifestPath, 'utf8');
  const verifyRegex = /<meta-data\s+android:name="com\.google\.android\.geo\.API_KEY"\s+android:value="([^"]+)"\s*\/>/;
  const verifyMatch = verifyContent.match(verifyRegex);

  if (verifyMatch) {
    const apiKey = verifyMatch[1];
    console.log('✅ API Key encontrada:', apiKey);
    
    if (apiKey === 'AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU') {
      console.log('✅ API Key es correcta\n');
    } else {
      console.error('❌ ERROR: API Key incorrecta');
      process.exit(1);
    }
  } else {
    console.error('❌ ERROR: API Key no encontrada después de la inyección');
    process.exit(1);
  }

  console.log('\n✅ Prebuild con API Key completado exitosamente!\n');
  process.exit(0);
  
} catch (error) {
  console.error('\n❌ ERROR en prebuild:');
  console.error('Mensaje:', error.message);
  if (error.stdout) console.error('stdout:', error.stdout.toString());
  if (error.stderr) console.error('stderr:', error.stderr.toString());
  process.exit(1);
}
