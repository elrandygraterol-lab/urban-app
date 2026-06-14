/**
 * DualPaymentSelector
 *
 * Allows a passenger to choose between three payment modes:
 *   - efectivo (cash)
 *   - pago_movil (mobile payment)
 *   - dual (cash + mobile payment)
 *
 * In dual mode, two numeric inputs are shown for cashAmount and pagoMovilAmount.
 * Real-time validation ensures the sum equals the total fare.
 * The confirm button is blocked while the sum is invalid.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentMode = 'cash' | 'pago_movil' | 'dual';

export interface DualPaymentConfig {
  mode: PaymentMode;
  /** Only set when mode === 'dual' */
  cashAmount?: number;
  /** Only set when mode === 'dual' */
  pagoMovilAmount?: number;
}

interface DualPaymentSelectorProps {
  /** Total fare for the ride (used to validate dual-mode amounts) */
  totalFare: number;
  /** Current configuration value */
  value: DualPaymentConfig;
  /** Called whenever the configuration changes */
  onChange: (config: DualPaymentConfig) => void;
  /** Whether the selector is disabled (e.g. while submitting) */
  disabled?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round to 2 decimal places to avoid floating-point drift */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parse a string to a non-negative number with 2 decimal precision */
function parseAmount(raw: string): number {
  const n = parseFloat(raw);
  return isNaN(n) || n < 0 ? 0 : round2(n);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DualPaymentSelector({
  totalFare,
  value,
  onChange,
  disabled = false,
}: DualPaymentSelectorProps) {
  // Raw string state for the two inputs so the user can type freely
  const [cashRaw, setCashRaw] = useState<string>(
    value.cashAmount !== undefined ? String(value.cashAmount) : ''
  );
  const [pagoMovilRaw, setPagoMovilRaw] = useState<string>(
    value.pagoMovilAmount !== undefined ? String(value.pagoMovilAmount) : ''
  );

  // ── Mode selection ──────────────────────────────────────────────────────────

  const handleSelectMode = useCallback(
    (mode: PaymentMode) => {
      if (disabled) return;
      if (mode !== 'dual') {
        setCashRaw('');
        setPagoMovilRaw('');
        onChange({ mode });
      } else {
        // Pre-fill cash with full fare so the user can adjust
        const initialCash = round2(totalFare);
        setCashRaw(String(initialCash));
        setPagoMovilRaw('0');
        onChange({ mode: 'dual', cashAmount: initialCash, pagoMovilAmount: 0 });
      }
    },
    [disabled, onChange, totalFare]
  );

  // ── Dual-mode amount changes ────────────────────────────────────────────────

  const handleCashChange = useCallback(
    (raw: string) => {
      setCashRaw(raw);
      const cash = parseAmount(raw);
      const pagoMovil = round2(totalFare - cash);
      setPagoMovilRaw(pagoMovil >= 0 ? String(pagoMovil) : '');
      onChange({
        mode: 'dual',
        cashAmount: cash,
        pagoMovilAmount: pagoMovil >= 0 ? pagoMovil : 0,
      });
    },
    [onChange, totalFare]
  );

  const handlePagoMovilChange = useCallback(
    (raw: string) => {
      setPagoMovilRaw(raw);
      const pagoMovil = parseAmount(raw);
      const cash = round2(totalFare - pagoMovil);
      setCashRaw(cash >= 0 ? String(cash) : '');
      onChange({
        mode: 'dual',
        cashAmount: cash >= 0 ? cash : 0,
        pagoMovilAmount: pagoMovil,
      });
    },
    [onChange, totalFare]
  );

  // ── Validation ──────────────────────────────────────────────────────────────

  const isDualValid =
    value.mode !== 'dual' ||
    (value.cashAmount !== undefined &&
      value.pagoMovilAmount !== undefined &&
      value.cashAmount > 0 &&
      value.pagoMovilAmount > 0 &&
      round2(value.cashAmount + value.pagoMovilAmount) === round2(totalFare));

  const dualDifference =
    value.mode === 'dual' && value.cashAmount !== undefined && value.pagoMovilAmount !== undefined
      ? round2(value.cashAmount + value.pagoMovilAmount - totalFare)
      : null;

  const showDualError = value.mode === 'dual' && dualDifference !== null && dualDifference !== 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Método de Pago</Text>

      {/* Mode buttons */}
      <View style={styles.modeRow}>
        <ModeButton
          icon="cash-outline"
          label="Efectivo"
          selected={value.mode === 'cash'}
          onPress={() => handleSelectMode('cash')}
          disabled={disabled}
        />
        <ModeButton
          icon="phone-portrait-outline"
          label="Pago Móvil"
          selected={value.mode === 'pago_movil'}
          onPress={() => handleSelectMode('pago_movil')}
          disabled={disabled}
        />
        <ModeButton
          icon="wallet-outline"
          label="Efectivo + Pago Móvil"
          selected={value.mode === 'dual'}
          onPress={() => handleSelectMode('dual')}
          disabled={disabled}
          wide
        />
      </View>

      {/* Dual-mode amount inputs */}
      {value.mode === 'dual' && (
        <View style={styles.dualContainer}>
          <Text style={styles.dualTitle}>
            Distribuye el pago total de{' '}
            <Text style={styles.dualFare}>Bs. {round2(totalFare).toFixed(2)}</Text>
          </Text>

          <View style={styles.amountRow}>
            {/* Cash amount */}
            <View style={styles.amountField}>
              <Text style={styles.amountLabel}>Efectivo (Bs.)</Text>
              <View style={[styles.inputWrapper, showDualError && styles.inputWrapperError]}>
                <Ionicons name="cash-outline" size={18} color={Colors.mediumGray} />
                <TextInput
                  style={styles.amountInput}
                  value={cashRaw}
                  onChangeText={handleCashChange}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.lightGray}
                  editable={!disabled}
                  accessibilityLabel="Monto en efectivo"
                />
              </View>
            </View>

            <View style={styles.plusSign}>
              <Text style={styles.plusText}>+</Text>
            </View>

            {/* Pago móvil amount */}
            <View style={styles.amountField}>
              <Text style={styles.amountLabel}>Pago Móvil (Bs.)</Text>
              <View style={[styles.inputWrapper, showDualError && styles.inputWrapperError]}>
                <Ionicons name="phone-portrait-outline" size={18} color={Colors.mediumGray} />
                <TextInput
                  style={styles.amountInput}
                  value={pagoMovilRaw}
                  onChangeText={handlePagoMovilChange}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.lightGray}
                  editable={!disabled}
                  accessibilityLabel="Monto en pago móvil"
                />
              </View>
            </View>
          </View>

          {/* Validation feedback */}
          {showDualError && dualDifference !== null && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>
                {dualDifference > 0
                  ? `La suma excede la tarifa en Bs. ${dualDifference.toFixed(2)}`
                  : `Faltan Bs. ${Math.abs(dualDifference).toFixed(2)} para completar la tarifa`}
              </Text>
            </View>
          )}

          {isDualValid && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.successText}>
                Los montos suman exactamente Bs. {round2(totalFare).toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Sub-component: ModeButton ────────────────────────────────────────────────

interface ModeButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  wide?: boolean;
}

function ModeButton({ icon, label, selected, onPress, disabled, wide }: ModeButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.modeButton,
        wide && styles.modeButtonWide,
        selected && styles.modeButtonSelected,
        disabled && styles.modeButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={22} color={selected ? Colors.primary : Colors.mediumGray} />
      <Text
        style={[styles.modeButtonLabel, selected && styles.modeButtonLabelSelected]}
        numberOfLines={2}
      >
        {label}
      </Text>
      {selected && (
        <Ionicons
          name="checkmark-circle"
          size={14}
          color={Colors.primary}
          style={styles.checkIcon}
        />
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    minWidth: 90,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    gap: 6,
  },
  modeButtonWide: {
    flexBasis: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  modeButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#f0fdf4',
  },
  modeButtonDisabled: {
    opacity: 0.5,
  },
  modeButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  modeButtonLabelSelected: {
    color: Colors.primary,
  },
  checkIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  // Dual mode
  dualContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  dualTitle: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
    textAlign: 'center',
  },
  dualFare: {
    fontWeight: '700',
    color: Colors.primary,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  amountField: {
    flex: 1,
    gap: 6,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    gap: 8,
  },
  inputWrapperError: {
    borderColor: Colors.error,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  plusSign: {
    paddingBottom: 10,
  },
  plusText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.mediumGray,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: Colors.error,
    fontWeight: '500',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 10,
  },
  successText: {
    flex: 1,
    fontSize: 12,
    color: Colors.success,
    fontWeight: '500',
  },
});
