#!/usr/bin/env node

/**
 * Script de verificación para EAS Build
 * Verifica que todo esté configurado correctamente antes de compilar
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Verificando configuración para EAS Build...\n');

let hasErrors = false;
let hasWarnings = false;

// Verificar Node.js
try {
  const nodeVersion = process.version;
  console.log(`✅ Node.js: ${nodeVersion}`);
} catch (error) {
  console.log('❌ Node.js no encontrado');
  hasErrors = true;
}

// Verificar npm
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ npm: v${npmVersion}`);
} catch (error) {
  console.log('❌ npm no encontrado');
  hasErrors = true;
}

// Verificar EAS CLI
try {
  const easVersion = execSync('eas --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ EAS CLI: ${easVersion}`);
} catch (error) {
  console.log('❌ EAS CLI no instalado');
  console.log('   Instala con: npm install -g eas-cli');
  hasErrors = true;
}

// Verificar login en EAS
try {
  execSync('eas whoami', { encoding: 'utf-8', stdio: 'pipe' });
  const username = execSync('eas whoami', { encoding: 'utf-8' }).trim();
  console.log(`✅ Login en EAS: ${username}`);
} catch (error) {
  console.log('⚠️  No has iniciado sesión en EAS');
  console.log('   Ejecuta: eas login');
  hasWarnings = true;
}

// Verificar app.json
const appJsonPath = path.join(__dirname, '..', 'app.json');
if (fs.existsSync(appJsonPath)) {
  console.log('✅ app.json encontrado');
  
  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    
    // Verificar package name
    if (appJson.expo?.android?.package) {
      console.log(`✅ Android package: ${appJson.expo.android.package}`);
    } else {
      console.log('⚠️  Android package no configurado en app.json');
      hasWarnings = true;
    }
    
    // Verificar bundle identifier
    if (appJson.expo?.ios?.bundleIdentifier) {
      console.log(`✅ iOS bundle identifier: ${appJson.expo.ios.bundleIdentifier}`);
    } else {
      console.log('⚠️  iOS bundle identifier no configurado en app.json');
      hasWarnings = true;
    }
    
    // Verificar Google Maps API Key
    const androidApiKey = appJson.expo?.android?.config?.googleMaps?.apiKey;
    const iosApiKey = appJson.expo?.ios?.config?.googleMapsApiKey;
    const pluginApiKey = appJson.expo?.plugins?.find(
      p => Array.isArray(p) && p[0] === 'react-native-maps'
    )?.[1]?.googleMapsApiKey;
    
    if (androidApiKey && androidApiKey !== 'YOUR_ANDROID_GOOGLE_MAPS_API_KEY') {
      console.log('✅ Google Maps API Key (Android) configurada');
    } else {
      console.log('⚠️  Google Maps API Key (Android) no configurada');
      console.log('   Configura en app.json: expo.android.config.googleMaps.apiKey');
      hasWarnings = true;
    }
    
    if (iosApiKey && iosApiKey !== 'YOUR_IOS_GOOGLE_MAPS_API_KEY') {
      console.log('✅ Google Maps API Key (iOS) configurada');
    } else {
      console.log('⚠️  Google Maps API Key (iOS) no configurada');
      console.log('   Configura en app.json: expo.ios.config.googleMapsApiKey');
      hasWarnings = true;
    }
    
  } catch (error) {
    console.log('❌ Error al leer app.json:', error.message);
    hasErrors = true;
  }
} else {
  console.log('❌ app.json no encontrado');
  hasErrors = true;
}

// Verificar eas.json
const easJsonPath = path.join(__dirname, '..', 'eas.json');
if (fs.existsSync(easJsonPath)) {
  console.log('✅ eas.json encontrado');
  
  try {
    const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf-8'));
    
    if (easJson.build?.development) {
      console.log('✅ Perfil "development" configurado');
    } else {
      console.log('⚠️  Perfil "development" no encontrado en eas.json');
      hasWarnings = true;
    }
    
  } catch (error) {
    console.log('❌ Error al leer eas.json:', error.message);
    hasErrors = true;
  }
} else {
  console.log('⚠️  eas.json no encontrado');
  console.log('   Ejecuta: eas build:configure');
  hasWarnings = true;
}

// Verificar package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(packageJsonPath)) {
  console.log('✅ package.json encontrado');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    // Verificar dependencias críticas
    const criticalDeps = [
      'expo',
      'react-native-maps',
      'expo-notifications',
      'expo-location'
    ];
    
    criticalDeps.forEach(dep => {
      if (packageJson.dependencies?.[dep]) {
        console.log(`✅ ${dep} instalado`);
      } else {
        console.log(`⚠️  ${dep} no encontrado en dependencias`);
        hasWarnings = true;
      }
    });
    
  } catch (error) {
    console.log('❌ Error al leer package.json:', error.message);
    hasErrors = true;
  }
} else {
  console.log('❌ package.json no encontrado');
  hasErrors = true;
}

// Resumen
console.log('\n' + '='.repeat(60));

if (hasErrors) {
  console.log('❌ Hay errores que deben corregirse antes de compilar');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  Hay advertencias, pero puedes continuar');
  console.log('   Recomendamos corregirlas para evitar problemas');
  console.log('\n✅ Puedes compilar con: npm run build:dev:android');
  process.exit(0);
} else {
  console.log('✅ Todo listo para compilar!');
  console.log('\n🚀 Ejecuta: npm run build:dev:android');
  process.exit(0);
}
