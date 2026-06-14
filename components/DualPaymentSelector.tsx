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
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseAmount(raw: string): number {
  const n = parseFloat(raw);
  return isNaN(n) || n < 0 ? 0 : round2(n);
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
        styles.modeBtn,
        wide && styles.modeBtnWide,
        selected && styles.modeBtnSelected,
        disabled && styles.modeBtnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
    >
      <View style={[styles.modeBtnIconWrap, selected && styles.modeBtnIconWrapSelected]}>
        <Ionicons name={icon} size={18} color={selected ? Colors.primary : '#9ca3af'} />
      </View>
      <Text
        style={[styles.modeBtnLabel, selected && styles.modeBtnLabelSelected]}
        numberOfLines={2}
      >
        {label}
      </Text>
      {selected && (
        <Ionicons name="checkmark-circle" size={14} color={Colors.primary} style={styles.modeBtnCheck} />
      )}
    </TouchableOpacity>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DualPaymentSelector({
  totalFare,
  value,
  onChange,
  disabled = false,
}: DualPaymentSelectorProps) {
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
        <View style={styles.dualCard}>
          <Text style={styles.dualTitle}>
            Distribuye el pago total de{' '}
            <Text style={styles.dualFare}>Bs. {round2(totalFare).toFixed(2)}</Text>
          </Text>

          <View style={styles.amountRow}>
            {/* Cash */}
            <View style={styles.amountField}>
              <Text style={styles.amountLabel}>Efectivo (Bs.)</Text>
              <View style={[styles.inputWrap, showDualError && styles.inputWrapError]}>
                <Ionicons name="cash-outline" size={15} color="#9ca3af" />
                <TextInput
                  style={styles.amountInput}
                  value={cashRaw}
                  onChangeText={handleCashChange}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#c4c4c4"
                  editable={!disabled}
                  accessibilityLabel="Monto en efectivo"
                />
              </View>
            </View>

            <View style={styles.plusSign}>
              <Text style={styles.plusText}>+</Text>
            </View>

            {/* Pago Móvil */}
            <View style={styles.amountField}>
              <Text style={styles.amountLabel}>Pago Móvil (Bs.)</Text>
              <View style={[styles.inputWrap, showDualError && styles.inputWrapError]}>
                <Ionicons name="phone-portrait-outline" size={15} color="#9ca3af" />
                <TextInput
                  style={styles.amountInput}
                  value={pagoMovilRaw}
                  onChangeText={handlePagoMovilChange}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#c4c4c4"
                  editable={!disabled}
                  accessibilityLabel="Monto en pago móvil"
                />
              </View>
            </View>
          </View>

          {/* Validation feedback */}
          {showDualError && dualDifference !== null && (
            <View style={styles.feedbackBox}>
              <Ionicons name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.feedbackError}>
                {dualDifference > 0
                  ? `Excede en Bs. ${dualDifference.toFixed(2)}`
                  : `Faltan Bs. ${Math.abs(dualDifference).toFixed(2)}`}
              </Text>
            </View>
          )}

          {isDualValid && (
            <View style={[styles.feedbackBox, styles.feedbackBoxSuccess]}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <Text style={styles.feedbackSuccess}>
                Total exacto: Bs. {round2(totalFare).toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },

  // ── Mode buttons ──
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    minWidth: 90,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    gap: 6,
  },
  modeBtnWide: {
    flexBasis: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  modeBtnSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#f0fdf4',
  },
  modeBtnDisabled: {
    opacity: 0.5,
  },
  modeBtnIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
    }),
  },
  modeBtnIconWrapSelected: {
    backgroundColor: '#f0fdf4',
  },
  modeBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  modeBtnLabelSelected: {
    color: Colors.primary,
  },
  modeBtnCheck: {
    position: 'absolute',
    top: 5,
    right: 5,
  },

  // ── Dual mode card ──
  dualCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  dualTitle: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
  dualFare: {
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Amount inputs ──
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  amountField: {
    flex: 1,
    gap: 4,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    gap: 6,
  },
  inputWrapError: {
    borderColor: Colors.error,
    backgroundColor: '#fef2f2',
  },
  amountInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    padding: 0,
    height: 38,
  },
  plusSign: {
    paddingBottom: 8,
  },
  plusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9ca3af',
  },

  // ── Feedback ──
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  feedbackBoxSuccess: {
    backgroundColor: '#f0fdf4',
  },
  feedbackError: {
    flex: 1,
    fontSize: 11,
    color: Colors.error,
    fontWeight: '500',
  },
  feedbackSuccess: {
    flex: 1,
    fontSize: 11,
    color: Colors.success,
    fontWeight: '500',
  },
});
