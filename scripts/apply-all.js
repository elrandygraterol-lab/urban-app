const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'app', '(passenger)', 'index.tsx');
let content = fs.readFileSync(FILE, 'utf8');
const NL = content.includes('\r\n') ? '\r\n' : '\n';

const already = (s) => content.includes(s);

// ===== 1. FIX REANIMATED IMPORTS =====
if (!already('useAnimatedStyle')) {
  const old = "import Animated, { useSharedValue, withSpring, withTiming, Easing } from 'react-native-reanimated';";
  const nu = "import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';";
  if (content.includes(old)) { content = content.replace(old, nu); console.log('1. Imports ✅'); }
  else { console.log('1. Import not found'); }
} else { console.log('1. Imports already ✅'); }

// ===== 2. ANIMATION VALUES + TIMEOUT REF + SEARCH DURATION =====
const insertAfter = 'const modalTranslateY = useSharedValue(50);';
const toInsert = `

  // Timer ref for search timeout
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Elapsed search time (seconds)
  const [searchDuration, setSearchDuration] = useState(0);
  const searchDurationRef = useRef<NodeJS.Timeout | null>(null);

  // Animation values for searching driver indicator
  const pulseScale = useSharedValue(1);
  const pulseRingOpacity = useSharedValue(0.3);
  const pulseScaleInner = useSharedValue(1);
  const pulseRingOpacityInner = useSharedValue(0.5);
  const loadingProgress = useSharedValue(0);

  // Animated styles for pulse rings
  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseRingOpacity.value,
  }));
  const pulseRingInnerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScaleInner.value }],
    opacity: pulseRingOpacityInner.value,
  }));
  const loadingBarStyle = useAnimatedStyle(() => ({
    width: \`\${loadingProgress.value * 100}%\`,
  }));
`;

if (!already('searchTimeoutRef') && content.includes(insertAfter)) {
  const idx = content.indexOf(insertAfter) + insertAfter.length;
  content = content.slice(0, idx) + toInsert.replace(/\n/g, NL) + content.slice(idx);
  console.log('2. Animation values + timeout ref ✅');
} else {
  console.log('2. Already exists or marker not found');
}

// ===== 3. SEARCH TIMEOUT HANDLER =====
const timeoutHandler = `
  /** Handle search timeout - auto-cancel after 60 seconds */
  const handleSearchTimeout = useCallback(async () => {
    if (!activeRide || !activeRide.id) {
      setIsSearchingDriver(false);
      setSearchDuration(0);
      return;
    }
    try {
      await rideAPI.cancelRide(activeRide.id, { reason: 'search_timeout' });
      showToast(
        'No encontramos conductores disponibles en tu zona en este momento. Por favor intenta nuevamente.',
        'info'
      );
    } catch {
      showToast('No se pudo cancelar la búsqueda automáticamente.', 'error');
    } finally {
      setActiveRide(null);
      setIsSearchingDriver(false);
      setDriverLocation(null);
      setSearchDuration(0);
    }
  }, [activeRide, rideAPI, showToast]);
`;

// Insert after handleCancelSearching
const cancelSearchMarker = '  const handleCancelSearching = async () => {';
// Find the end of handleCancelSearching function
// The function ends with the closing } and then a blank line before the next function
// Let me find it by looking for the function body then finding its closing
const cancelSearchEnd = '      }\n    }\n  };';
const cancelSearchFullEnd = '      }\n    }\n  };\n\n  const handleCancelRidePress';

if (!already('handleSearchTimeout') && content.includes(cancelSearchFullEnd)) {
  content = content.replace(cancelSearchFullEnd, cancelSearchFullEnd.replace('const handleCancelRidePress', timeoutHandler + '\n\n  const handleCancelRidePress'));
  console.log('3. Timeout handler ✅');
} else {
  console.log('3. Timeout handler - trying alternative insertion');
  // Try to find the end of handleCancelSearching by looking for the pattern
  const idx = content.lastIndexOf("console.log('✅ Ride search cancelled');");
  if (idx >= 0) {
    const afterLogIdx = content.indexOf('\n', idx + 40);
    if (afterLogIdx >= 0) {
      const restAfter = content.substring(afterLogIdx);
      content = content.substring(0, afterLogIdx) + '\n' + timeoutHandler.replace(/\n/g, NL) + restAfter;
      console.log('3. Timeout handler inserted (fallback) ✅');
    }
  } else {
    console.log('3. Could not find insertion point for timeout handler');
  }
}

// ===== 4. ANIMATION + TIMEOUT useEffect =====
const animEffectMarker = '  // Smart Tutorial state';
const animEffect = `

  // Start searching animations + timeout when isSearchingDriver changes
  useEffect(() => {
    if (isSearchingDriver) {
      // Reset duration counter
      setSearchDuration(0);

      // Pulse ring animations
      pulseScale.value = withRepeat(
        withSequence(withTiming(1.3, { duration: 1200 }), withTiming(1, { duration: 1200 })), -1, true
      );
      pulseRingOpacity.value = withRepeat(
        withSequence(withTiming(0.1, { duration: 1200 }), withTiming(0.3, { duration: 1200 })), -1, true
      );
      pulseScaleInner.value = withRepeat(
        withSequence(withTiming(1.15, { duration: 1200 }), withTiming(1, { duration: 1200 })), -1, true
      );
      pulseRingOpacityInner.value = withRepeat(
        withSequence(withTiming(0.2, { duration: 1200 }), withTiming(0.5, { duration: 1200 })), -1, true
      );
      loadingProgress.value = withRepeat(
        withSequence(withTiming(1, { duration: 2000 }), withTiming(0, { duration: 2000 })), -1, true
      );

      // 60-second search timeout
      searchTimeoutRef.current = setTimeout(() => {
        handleSearchTimeout();
      }, 60000);

      // Elapsed time counter (updates every second)
      let count = 0;
      searchDurationRef.current = setInterval(() => {
        count++;
        setSearchDuration(count);
      }, 1000);

      return () => {
        // Cleanup animations
        pulseScale.value = 1;
        pulseRingOpacity.value = 0.3;
        pulseScaleInner.value = 1;
        pulseRingOpacityInner.value = 0.5;
        loadingProgress.value = 0;
        // Cleanup timeout
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
          searchTimeoutRef.current = null;
        }
        // Cleanup duration counter
        if (searchDurationRef.current) {
          clearInterval(searchDurationRef.current);
          searchDurationRef.current = null;
        }
        setSearchDuration(0);
      };
    } else {
      // Reset all when not searching
      pulseScale.value = 1;
      pulseRingOpacity.value = 0.3;
      pulseScaleInner.value = 1;
      pulseRingOpacityInner.value = 0.5;
      loadingProgress.value = 0;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      if (searchDurationRef.current) {
        clearInterval(searchDurationRef.current);
        searchDurationRef.current = null;
      }
      setSearchDuration(0);
    }
  }, [isSearchingDriver]);
`;

if (!already('Start searching animations + timeout') && content.includes(animEffectMarker)) {
  content = content.replace(animEffectMarker, animEffect.replace(/\n/g, NL) + '\n' + animEffectMarker);
  console.log('4. Animation + timeout useEffect ✅');
} else {
  console.log('4. Effect already exists or marker not found');
}

// ===== 5. SEARCHING DRIVER JSX SECTION =====
const jsxMarker = `              {/* Request Ride Form - Only show when no active ride */}`;
const jsxSection = `
              {/* Searching for Driver - Professional Loading State */}
              {isSearchingDriver && (
                <View style={styles.searchingDriverContainer}>
                  {/* Animated pulsing ring + car icon */}
                  <View style={styles.searchingIconWrapper}>
                    <Animated.View style={[styles.searchingPulseRing, pulseRingStyle]} />
                    <Animated.View style={[styles.searchingPulseRingInner, pulseRingInnerStyle]} />
                    <View style={styles.searchingIconCircle}>
                      <Ionicons name="car-outline" size={40} color="#22c55e" />
                    </View>
                  </View>

                  {/* Animated loading bar */}
                  <View style={styles.searchingLoadingBar}>
                    <Animated.View style={[styles.searchingLoadingFill, loadingBarStyle]} />
                  </View>

                  <Text style={styles.searchingTitle}>Buscando conductores</Text>
                  <Text style={styles.searchingSubtitle}>
                    Localizando profesionales cercanos a tu ubicaci\u00f3n
                  </Text>

                  {/* Search timer */}
                  {searchDuration > 0 && (
                    <View style={styles.searchingTimerRow}>
                      <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                      <Text style={styles.searchingTimerText}>
                        {searchDuration < 60
                          ? \`Buscando... \${searchDuration}s\`
                          : \`Tiempo agotado\`}
                      </Text>
                    </View>
                  )}

                  {/* Trip details card */}
                  <View style={styles.searchingTripCard}>
                    <View style={styles.searchingTripRow}>
                      <View style={styles.searchingTripIconBg}>
                        <Ionicons name="location-outline" size={16} color="#22c55e" />
                      </View>
                      <View style={styles.searchingTripContent}>
                        <Text style={styles.searchingTripLabel}>Recogida</Text>
                        <Text style={styles.searchingTripText} numberOfLines={1}>
                          {pickupAddress || 'Ubicaci\u00f3n actual'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.searchingTripDivider} />
                    <View style={styles.searchingTripRow}>
                      <View style={[styles.searchingTripIconBg, { backgroundColor: '#FEF2F2' }]}>
                        <Ionicons name="flag-outline" size={16} color="#EF4444" />
                      </View>
                      <View style={styles.searchingTripContent}>
                        <Text style={styles.searchingTripLabel}>Destino</Text>
                        <Text style={styles.searchingTripText} numberOfLines={1}>
                          {destinationAddress || 'Destino'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.searchingTripDivider} />
                    <View style={styles.searchingTripRow}>
                      <View style={[styles.searchingTripIconBg, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="cash-outline" size={16} color="#3B82F6" />
                      </View>
                      <View style={styles.searchingTripContent}>
                        <Text style={styles.searchingTripLabel}>Tarifa estimada</Text>
                        <Text style={[styles.searchingTripText, { fontWeight: '600' }]}>
                          {estimatedFare != null
                            ? formatCurrency(estimatedFare, fareCurrency)
                            : 'Calculando...'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Cancel button */}
                  <TouchableOpacity
                    style={styles.searchingCancelButton}
                    onPress={handleCancelSearching}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-outline" size={18} color="#EF4444" />
                    <Text style={styles.searchingCancelText}>Cancelar b\u00fasqueda</Text>
                  </TouchableOpacity>
                </View>
              )}
`;

if (!already('Searching for Driver - Professional') && content.includes(jsxMarker)) {
  const idx = content.indexOf(jsxMarker);
  content = content.substring(0, idx) + jsxSection.replace(/\n/g, NL) + NL + content.substring(idx);
  console.log('5. Searching JSX section ✅');
} else {
  console.log('5. JSX already exists or marker not found');
}

// ===== 6. STYLES =====
const styleMarker = `  cancelSearchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});`;

const newStyles = `
  searchingDriverContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  searchingIconWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchingPulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  searchingPulseRingInner: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#4ade80',
  },
  searchingIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  searchingLoadingBar: {
    width: 160,
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 20,
  },
  searchingLoadingFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 1.5,
  },
  searchingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  searchingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  searchingTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  searchingTimerText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  searchingTripCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 0,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 24,
  },
  searchingTripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  searchingTripIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchingTripContent: {
    flex: 1,
  },
  searchingTripLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  searchingTripText: {
    fontSize: 14,
    color: '#374151',
  },
  searchingTripDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 14,
  },
  searchingCancelButton: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    width: '100%',
    gap: 8,
  },
  searchingCancelText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
`;

if (!already('searchingPulseRing:')) {
  // Try exact marker match first
  const exactIdx = content.indexOf(styleMarker);
  if (exactIdx >= 0) {
    content = content.substring(0, exactIdx + styleMarker.length) + newStyles.replace(/\n/g, NL) + content.substring(exactIdx + styleMarker.length);
    console.log('6. Styles ✅');
  } else {
    // Try finding the last "});"
    const lastClose = content.lastIndexOf('});\n');
    if (lastClose >= 0) {
      content = content.substring(0, lastClose + 3) + newStyles.replace(/\n/g, NL) + content.substring(lastClose + 3);
      console.log('6. Styles inserted (fallback) ✅');
    } else {
      console.log('6. Could not find StyleSheet closing');
    }
  }
} else {
  console.log('6. Styles already exist');
}

// ===== 7. Add useRef to React imports (it's likely already there) =====
if (!content.includes('useRef,') && content.includes("from 'react'") && content.includes('import React')) {
  // Check if it has useRef
  const reactImportLine = content.match(/import React, \{([^}]+)\} from 'react'/);
  if (reactImportLine && !reactImportLine[1].includes('useRef')) {
    const newImport = reactImportLine[0].replace(/\{([^}]+)\}/, (m, inner) => `{${inner}, useRef}`);
    content = content.replace(reactImportLine[0], newImport);
    console.log('7. Added useRef import ✅');
  } else {
    console.log('7. useRef already imported or not needed');
  }
} else {
  console.log('7. useRef import check skipped');
}

// ===== Count useState declarations =====
const stateCount = (content.match(/const \[[a-zA-Z]/g) || []).length;
console.log(`\nTotal state declarations: ${stateCount}`);

fs.writeFileSync(FILE, content, 'utf8');
console.log('\n✅ All changes applied!');
