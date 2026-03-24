const fs = require('fs');
const path = require('path');

console.log('\n💉 Inyectando API Key en AndroidManifest.xml...\n');

const manifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.error('❌ ERROR: AndroidManifest.xml no existe');
  console.error('   Ruta esperada:', manifestPath);
  process.exit(1);
}

let manifestContent = fs.readFileSync(manifestPath, 'utf8');

// Verificar si la API key ya existe
const apiKeyRegex = /<meta-data\s+android:name="com\.google\.android\.geo\.API_KEY"/;
if (apiKeyRegex.test(manifestContent)) {
  console.log('✅ API Key ya existe en AndroidManifest.xml');
  console.log('   No es necesario inyectarla nuevamente\n');
  process.exit(0);
}

// Buscar la etiqueta <application>
const applicationTagRegex = /(<application[^>]*>)/;
const match = manifestContent.match(applicationTagRegex);

if (!match) {
  console.error('❌ ERROR: No se encontró la etiqueta <application> en AndroidManifest.xml');
  process.exit(1);
}

// Inyectar la API key justo después de la etiqueta <application>
const apiKeyMetaData = '\n    <!-- Google Maps API Key -->\n    <meta-data android:name="com.google.android.geo.API_KEY" android:value="AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU"/>';

manifestContent = manifestContent.replace(
  applicationTagRegex,
  `$1${apiKeyMetaData}`
);

// Guardar el archivo modificado
fs.writeFileSync(manifestPath, manifestContent, 'utf8');

console.log('✅ API Key inyectada exitosamente en AndroidManifest.xml');
console.log('   Valor: AIzaSyDu-vsndSIMluuvLfmGf_sAhQiNDliznrU\n');

// Verificar que se inyectó correctamente
const verifyContent = fs.readFileSync(manifestPath, 'utf8');
if (/<meta-data\s+android:name="com\.google\.android\.geo\.API_KEY"/.test(verifyContent)) {
  console.log('✅ Verificación exitosa: API Key presente en AndroidManifest.xml\n');
  process.exit(0);
} else {
  console.error('❌ ERROR: La API Key no se inyectó correctamente');
  process.exit(1);
}
