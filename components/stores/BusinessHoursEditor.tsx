import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { BusinessHours } from '@/types/store';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/constants/theme';

interface BusinessHoursEditorProps {
  hours: BusinessHours;
  onChange: (hours: BusinessHours) => void;
}

type DayKey = keyof BusinessHours;

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

export const BusinessHoursEditor: React.FC<BusinessHoursEditorProps> = ({ hours, onChange }) => {
  const [showTimePicker, setShowTimePicker] = useState<{
    day: DayKey | null;
    type: 'open' | 'close' | null;
  }>({ day: null, type: null });

  // Toggle day open/closed
  const toggleDay = (day: DayKey) => {
    const updatedHours = {
      ...hours,
      [day]: {
        ...hours[day],
        closed: !hours[day].closed,
      },
    };
    onChange(updatedHours);
  };

  // Update time for a specific day
  const updateTime = (day: DayKey, type: 'open' | 'close', time: string) => {
    const updatedHours = {
      ...hours,
      [day]: {
        ...hours[day],
        [type]: time,
      },
    };

    // Validate that open time is before close time
    if (type === 'open' && hours[day].close && time >= hours[day].close!) {
      // Invalid: open time is after or equal to close time
      return;
    }
    if (type === 'close' && hours[day].open && time <= hours[day].open!) {
      // Invalid: close time is before or equal to open time
      return;
    }

    onChange(updatedHours);
  };

  // Copy hours to all days
  const copyToAllDays = (sourceDay: DayKey) => {
    const sourceDayHours = hours[sourceDay];
    const updatedHours = { ...hours };

    DAYS.forEach(({ key }) => {
      updatedHours[key] = { ...sourceDayHours };
    });

    onChange(updatedHours);
  };

  // Handle time picker change
  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker({ day: null, type: null });
    }

    if (event.type === 'set' && selectedDate && showTimePicker.day && showTimePicker.type) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      updateTime(showTimePicker.day, showTimePicker.type, timeString);

      if (Platform.OS === 'ios') {
        setShowTimePicker({ day: null, type: null });
      }
    } else if (event.type === 'dismissed') {
      setShowTimePicker({ day: null, type: null });
    }
  };

  // Convert time string to Date object for picker
  const timeStringToDate = (timeString: string | null): Date => {
    const now = new Date();
    if (!timeString) return now;

    const [hours, minutes] = timeString.split(':').map(Number);
    now.setHours(hours, minutes, 0, 0);
    return now;
  };

  // Render time picker button
  const renderTimeButton = (day: DayKey, type: 'open' | 'close', time: string | null) => {
    const isDisabled = hours[day].closed;

    return (
      <TouchableOpacity
        style={[styles.timeButton, isDisabled && styles.timeButtonDisabled]}
        onPress={() => !isDisabled && setShowTimePicker({ day, type })}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        <Ionicons
          name={type === 'open' ? 'time-outline' : 'time'}
          size={16}
          color={isDisabled ? Colors.lightGray : Colors.primary}
        />
        <Text style={[styles.timeText, isDisabled && styles.timeTextDisabled]}>
          {time || '--:--'}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render day row
  const renderDayRow = ({ key, label }: { key: DayKey; label: string }) => {
    const dayHours = hours[key];
    const isClosed = dayHours.closed;

    return (
      <View key={key} style={styles.dayRow}>
        {/* Day name and toggle */}
        <View style={styles.dayHeader}>
          <Text style={styles.dayLabel}>{label}</Text>
          <View style={styles.toggleContainer}>
            <Text style={[styles.toggleLabel, isClosed && styles.toggleLabelClosed]}>
              {isClosed ? 'Cerrado' : 'Abierto'}
            </Text>
            <Switch
              value={!isClosed}
              onValueChange={() => toggleDay(key)}
              trackColor={{ false: Colors.lightGray, true: Colors.primaryLight }}
              thumbColor={isClosed ? Colors.white : Colors.primary}
              ios_backgroundColor={Colors.lightGray}
            />
          </View>
        </View>

        {/* Time pickers */}
        {!isClosed && (
          <View style={styles.timeRow}>
            <View style={styles.timeGroup}>
              <Text style={styles.timeLabel}>Apertura</Text>
              {renderTimeButton(key, 'open', dayHours.open)}
            </View>

            <Ionicons name="arrow-forward" size={20} color={Colors.mediumGray} />

            <View style={styles.timeGroup}>
              <Text style={styles.timeLabel}>Cierre</Text>
              {renderTimeButton(key, 'close', dayHours.close)}
            </View>

            {/* Copy to all button */}
            <TouchableOpacity
              style={styles.copyButton}
              onPress={() => copyToAllDays(key)}
              activeOpacity={0.7}
            >
              <Ionicons name="copy-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Validation error */}
        {!isClosed && dayHours.open && dayHours.close && dayHours.open >= dayHours.close && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={14} color={Colors.error} />
            <Text style={styles.errorText}>
              La hora de apertura debe ser anterior a la de cierre
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Horario de Atención</Text>
        <Text style={styles.subtitle}>
          Configura los horarios de tu tienda para cada día de la semana
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {DAYS.map(renderDayRow)}
      </ScrollView>

      {/* Time Picker Modal */}
      {showTimePicker.day && showTimePicker.type && (
        <>
          {Platform.OS === 'ios' && (
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <TouchableOpacity onPress={() => setShowTimePicker({ day: null, type: null })}>
                    <Text style={styles.pickerButton}>Cancelar</Text>
                  </TouchableOpacity>
                  <Text style={styles.pickerTitle}>
                    {showTimePicker.type === 'open' ? 'Hora de Apertura' : 'Hora de Cierre'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowTimePicker({ day: null, type: null })}>
                    <Text style={[styles.pickerButton, styles.pickerButtonDone]}>Listo</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={timeStringToDate(hours[showTimePicker.day][showTimePicker.type])}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  onChange={handleTimeChange}
                  style={styles.picker}
                />
              </View>
            </View>
          )}

          {Platform.OS === 'android' && (
            <DateTimePicker
              value={timeStringToDate(hours[showTimePicker.day][showTimePicker.type])}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={handleTimeChange}
            />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.mediumGray,
  },
  scrollView: {
    flex: 1,
  },
  dayRow: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  dayLabel: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toggleLabel: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
  },
  toggleLabelClosed: {
    color: Colors.mediumGray,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  timeGroup: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    ...Typography.caption,
    color: Colors.mediumGray,
    marginBottom: Spacing.xs,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    minWidth: 100,
    justifyContent: 'center',
  },
  timeButtonDisabled: {
    backgroundColor: Colors.background,
    opacity: 0.5,
  },
  timeText: {
    ...Typography.body,
    color: Colors.darkGray,
    fontWeight: '600',
  },
  timeTextDisabled: {
    color: Colors.lightGray,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    flex: 1,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.md,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  pickerButton: {
    ...Typography.body,
    color: Colors.primary,
  },
  pickerButtonDone: {
    fontWeight: '600',
  },
  picker: {
    height: 200,
  },
});
