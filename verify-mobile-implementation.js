/**
 * Simple verification script to check Mobile App Store Management implementation
 */

const fs = require('fs');
const path = require('path');

const checks = {
  screens: [
    'app/(tabs)/stores/[id].tsx',
    'app/(tabs)/stores/form.tsx',
    'app/(tabs)/stores/my-stores.tsx',
    'app/(tabs)/stores/stats/[id].tsx'
  ],
  components: [
    'components/stores/StoreCard.tsx',
    'components/stores/CategoryPicker.tsx',
    'components/stores/BusinessHoursEditor.tsx',
    'components/stores/StoreImageGallery.tsx',
    'components/stores/RatingDialog.tsx',
    'components/stores/StoreFilterSheet.tsx',
    'components/stores/StoreMapView.tsx',
    'components/stores/LineChart.tsx'
  ],
  stores: [
    'store/storeStore.ts',
    'store/reviewStore.ts'
  ],
  services: [
    'services/storeApi.ts'
  ],
  types: [
    'types/store.ts'
  ]
};

console.log('\n🔍 Verifying Mobile App Store Management Implementation...\n');

let totalChecks = 0;
let passedChecks = 0;

function checkFile(filePath) {
  totalChecks++;
  const fullPath = path.join(__dirname, filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    passedChecks++;
    console.log(`✅ ${filePath}`);
  } else {
    console.log(`❌ ${filePath}`);
  }
  
  return exists;
}

console.log('📱 Store Screens:');
checks.screens.forEach(checkFile);

console.log('\n🧩 Store Components:');
checks.components.forEach(checkFile);

console.log('\n🗄️  Zustand Stores:');
checks.stores.forEach(checkFile);

console.log('\n🌐 API Services:');
checks.services.forEach(checkFile);

console.log('\n📝 TypeScript Types:');
checks.types.forEach(checkFile);

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Implementation Status: ${passedChecks}/${totalChecks} files found (${Math.round(passedChecks/totalChecks*100)}%)\n`);

if (passedChecks === totalChecks) {
  console.log('✅ All mobile app components are implemented!\n');
  process.exit(0);
} else {
  console.log(`⚠️  ${totalChecks - passedChecks} files are missing\n`);
  process.exit(1);
}
