#!/usr/bin/env node

/**
 * Script de verificación pre-build
 * Verifica que todo esté listo antes de iniciar un build en EAS
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración para EAS Build...\n');

let hasErrors = false;
let hasWarnings = false;

// Verificar archivos requeridos
const requiredFiles = [
  'app.json',
  'eas.json',
  'package.json',
  '.npmrc'
];

console.log('📁 Verificando archivos requeridos:');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) hasErrors = true;
});

// Verificar package.json
console.log('\n📦 Verificando package.json:');
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  
  // Verificar dependencias críticas
  const criticalDeps = [
    'expo',
    'expo-dev-client',
    'react',
    'react-native',
    'expo-router'
  ];
  
  criticalDeps.forEach(dep => {
    const exists = pkg.dependencies && pkg.dependencies[dep];
    console.log(`  ${exists ? '✅' : '❌'} ${dep}: ${exists || 'NO INSTALADO'}`);
    if (!exists) hasErrors = true;
  });
  
  // Verificar versión de React
  const reactVersion = pkg.dependencies.react;
  if (reactVersion && reactVersion.includes('19')) {
    console.log('  ⚠️  React 19 detectado - puede causar problemas');
    hasWarnings = true;
  }
  
} catch (error) {
  console.log('  ❌ Error leyendo package.json:', error.message);
  hasErrors = true;
}

// Verificar eas.json
console.log('\n⚙️  Verificando eas.json:');
try {
  const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf8'));
  
  const hasDevelopment = eas.build && eas.build.development;
  console.log(`  ${hasDevelopment ? '✅' : '❌'} Perfil "development" configurado`);
  if (!hasDevelopment) hasErrors = true;
  
  if (hasDevelopment) {
    const hasDevClient = eas.build.development.developmentClient === true;
    console.log(`  ${hasDevClient ? '✅' : '❌'} developmentClient habilitado`);
    if (!hasDevClient) hasErrors = true;
    
    const hasAndroid = eas.build.development.android;
    console.log(`  ${hasAndroid ? '✅' : '❌'} Configuración Android presente`);
    if (!hasAndroid) hasErrors = true;
  }
  
} catch (error) {
  console.log('  ❌ Error leyendo eas.json:', error.message);
  hasErrors = true;
}

// Verificar app.json
console.log('\n📱 Verificando app.json:');
try {
  const app = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'));
  
  const hasProjectId = app.expo && app.expo.extra && app.expo.extra.eas && app.expo.extra.eas.projectId;
  console.log(`  ${hasProjectId ? '✅' : '❌'} EAS Project ID configurado`);
  if (!hasProjectId) hasErrors = true;
  
  const hasAndroidPackage = app.expo && app.expo.android && app.expo.android.package;
  console.log(`  ${hasAndroidPackage ? '✅' : '❌'} Android package configurado`);
  if (!hasAndroidPackage) hasErrors = true;
  
} catch (error) {
  console.log('  ❌ Error leyendo app.json:', error.message);
  hasErrors = true;
}

// Verificar .npmrc
console.log('\n🔧 Verificando .npmrc:');
try {
  const npmrc = fs.readFileSync(path.join(__dirname, '..', '.npmrc'), 'utf8');
  const hasLegacyPeerDeps = npmrc.includes('legacy-peer-deps=true');
  console.log(`  ${hasLegacyPeerDeps ? '✅' : '⚠️ '} legacy-peer-deps configurado`);
  if (!hasLegacyPeerDeps) hasWarnings = true;
} catch (error) {
  console.log('  ⚠️  .npmrc no encontrado o no se pudo leer');
  hasWarnings = true;
}

// Verificar archivos de sonido
console.log('\n🔔 Verificando assets de notificaciones:');
const soundFile = path.join(__dirname, '..', 'assets', 'sounds', 'notification.wav');
const soundExists = fs.existsSync(soundFile);
console.log(`  ${soundExists ? '✅' : '⚠️ '} notification.wav existe`);
if (!soundExists) hasWarnings = true;

// Resumen
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ ERRORES ENCONTRADOS - El build probablemente fallará');
  console.log('   Por favor corrige los errores antes de continuar.');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  ADVERTENCIAS ENCONTRADAS - El build puede tener problemas');
  console.log('   Revisa las advertencias antes de continuar.');
  process.exit(0);
} else {
  console.log('✅ TODO LISTO - Puedes proceder con el build');
  console.log('\n💡 Ejecuta: npm run build:dev:android');
  process.exit(0);
}
