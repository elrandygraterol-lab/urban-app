/**
 * Mobile App Deployment Configuration Verification Script
 * 
 * This script verifies that all required configuration for the Store Management System
 * mobile app is properly set up before deployment.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Mobile App Deployment Configuration...\n');

let hasErrors = false;
let hasWarnings = false;

// Check if .env file exists
console.log('📋 Checking environment configuration...');
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  WARNING: .env file not found. Copy .env.example to .env and configure it.');
  hasWarnings = true;
} else {
  console.log('✅ .env file exists');
  
  // Read .env file
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check required variables
  const requiredVars = [
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
  ];
  
  const storeVars = [
    'EXPO_PUBLIC_STORE_IMAGE_MAX_SIZE_MB',
    'EXPO_PUBLIC_STORE_MAX_LOGO_IMAGES',
    'EXPO_PUBLIC_STORE_MAX_PHOTO_IMAGES',
    'EXPO_PUBLIC_STORE_DEFAULT_SEARCH_RADIUS_KM',
    'EXPO_PUBLIC_STORE_MAX_SEARCH_RADIUS_KM',
    'EXPO_PUBLIC_STORE_DEFAULT_PAGE_SIZE',
    'EXPO_PUBLIC_STORE_MAX_PAGE_SIZE',
  ];
  
  console.log('\n📦 Checking required environment variables...');
  requiredVars.forEach(varName => {
    if (!envContent.includes(varName)) {
      console.log(`❌ ERROR: ${varName} not found in .env`);
      hasErrors = true;
    } else if (envContent.includes(`${varName}=your_`) || envContent.includes(`${varName}=http://localhost`)) {
      console.log(`⚠️  WARNING: ${varName} appears to have development/placeholder value`);
      hasWarnings = true;
    } else {
      console.log(`✅ ${varName} configured`);
    }
  });
  
  console.log('\n🏪 Checking store-specific environment variables...');
  storeVars.forEach(varName => {
    if (!envContent.includes(varName)) {
      console.log(`⚠️  INFO: ${varName} not found (will use default value from app.config.js)`);
    } else {
      console.log(`✅ ${varName} configured`);
    }
  });
}

// Check app.config.js
console.log('\n⚙️  Checking app configuration...');
const appConfigPath = path.join(__dirname, 'app.config.js');
if (!fs.existsSync(appConfigPath)) {
  console.log('❌ ERROR: app.config.js not found');
  hasErrors = true;
} else {
  const appConfigContent = fs.readFileSync(appConfigPath, 'utf8');
  
  if (appConfigContent.includes('storeImageMaxSizeMB')) {
    console.log('✅ Store configuration present in app.config.js');
  } else {
    console.log('⚠️  WARNING: Store configuration not found in app.config.js');
    hasWarnings = true;
  }
  
  if (appConfigContent.includes('projectId')) {
    console.log('✅ EAS project ID configured');
  } else {
    console.log('❌ ERROR: EAS project ID not configured');
    hasErrors = true;
  }
}

// Check eas.json
console.log('\n🏗️  Checking EAS Build configuration...');
const easJsonPath = path.join(__dirname, 'eas.json');
if (!fs.existsSync(easJsonPath)) {
  console.log('❌ ERROR: eas.json not found');
  hasErrors = true;
} else {
  const easJsonContent = fs.readFileSync(easJsonPath, 'utf8');
  const easConfig = JSON.parse(easJsonContent);
  
  if (easConfig.build) {
    console.log('✅ Build profiles configured');
    
    if (easConfig.build.development) {
      console.log('  ✅ Development profile exists');
    }
    
    if (easConfig.build.preview) {
      console.log('  ✅ Preview profile exists');
    }
    
    if (easConfig.build.production) {
      console.log('  ✅ Production profile exists');
      
      if (easConfig.build.production.env && easConfig.build.production.env.NODE_ENV === 'production') {
        console.log('  ✅ Production environment configured');
      } else {
        console.log('  ⚠️  INFO: Production environment not explicitly set');
      }
    } else {
      console.log('  ❌ ERROR: Production profile not configured');
      hasErrors = true;
    }
  } else {
    console.log('❌ ERROR: Build configuration not found in eas.json');
    hasErrors = true;
  }
}

// Check Firebase configuration files
console.log('\n🔥 Checking Firebase configuration...');
const googleServicesAndroid = path.join(__dirname, 'google-services.json');
const googleServicesIOS = path.join(__dirname, 'GoogleService-Info.plist');

if (!fs.existsSync(googleServicesAndroid)) {
  console.log('⚠️  WARNING: google-services.json not found (required for Android push notifications)');
  hasWarnings = true;
} else {
  console.log('✅ google-services.json exists (Android)');
}

if (!fs.existsSync(googleServicesIOS)) {
  console.log('⚠️  WARNING: GoogleService-Info.plist not found (required for iOS push notifications)');
  hasWarnings = true;
} else {
  console.log('✅ GoogleService-Info.plist exists (iOS)');
}

// Check package.json
console.log('\n📦 Checking package configuration...');
const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.log('❌ ERROR: package.json not found');
  hasErrors = true;
} else {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const requiredDeps = [
    'expo',
    'expo-router',
    'react-native',
    'react-native-maps',
    'expo-image-picker',
    'expo-notifications',
  ];
  
  console.log('Checking required dependencies...');
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep} installed`);
    } else {
      console.log(`❌ ERROR: ${dep} not found in dependencies`);
      hasErrors = true;
    }
  });
}

// Check store-related screens
console.log('\n📱 Checking store-related screens...');
const appDir = path.join(__dirname, 'app');
if (!fs.existsSync(appDir)) {
  console.log('❌ ERROR: app directory not found');
  hasErrors = true;
} else {
  const storesDir = path.join(appDir, '(authenticated)', '(tabs)', 'stores');
  if (fs.existsSync(storesDir)) {
    console.log('✅ Stores screens directory exists');
    
    const requiredScreens = [
      'index.tsx',
      '[id].tsx',
      'my-stores.tsx',
      'create.tsx',
    ];
    
    requiredScreens.forEach(screen => {
      const screenPath = path.join(storesDir, screen);
      if (fs.existsSync(screenPath)) {
        console.log(`  ✅ ${screen} exists`);
      } else {
        console.log(`  ⚠️  WARNING: ${screen} not found`);
        hasWarnings = true;
      }
    });
  } else {
    console.log('⚠️  WARNING: Stores screens directory not found');
    hasWarnings = true;
  }
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 VERIFICATION SUMMARY');
console.log('='.repeat(80));

if (hasErrors) {
  console.log('\n❌ ERRORS FOUND - Please fix the errors above before deploying.');
  console.log('\nCommon fixes:');
  console.log('- Copy .env.example to .env and configure all variables');
  console.log('- Ensure EAS project is properly configured');
  console.log('- Install all required dependencies: npm install');
  process.exit(1);
} else if (hasWarnings) {
  console.log('\n⚠️  WARNINGS FOUND - Review the warnings above. Deployment may work but some features might not function correctly.');
  console.log('\nRecommended actions:');
  console.log('- Update EXPO_PUBLIC_API_URL to production backend URL');
  console.log('- Add Firebase configuration files for push notifications');
  console.log('- Review all placeholder values in .env');
  console.log('\nYou can proceed with deployment, but address warnings for full functionality.');
  process.exit(0);
} else {
  console.log('\n✅ ALL CHECKS PASSED - Configuration looks good for deployment!');
  console.log('\nNext steps for deployment:');
  console.log('\n1. Preview Build (Internal Testing):');
  console.log('   eas build --profile preview --platform all');
  console.log('\n2. Production Build:');
  console.log('   eas build --profile production --platform all');
  console.log('\n3. Submit to App Stores:');
  console.log('   eas submit --platform android');
  console.log('   eas submit --platform ios');
  console.log('\nMake sure to:');
  console.log('- Test the preview build thoroughly before production');
  console.log('- Update EXPO_PUBLIC_API_URL to production backend URL');
  console.log('- Verify push notifications are working');
  process.exit(0);
}
