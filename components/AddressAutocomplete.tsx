import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchPlaces } from '@/services/mapsService';
import { Colors } from '@/constants/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const TAB_BAR_HEIGHT = 60; // Altura aproximada del tab bar
const SUGGESTION_ITEM_HEIGHT = 60; // Altura aproximada de cada sugerencia
const MAX_VISIBLE_SUGGESTIONS = 4; // Máximo de sugerencias visibles sin scroll

export interface Place {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  type: string;
  fullAddress?: string; // Full address for internal precision
  source?: 'custom' | 'nominatim'; // Origin of the result (custom place or OSM/Nominatim)
}

export interface AddressAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectPlace: (place: Place) => void;
  placeholder: string;
  currentLocation?: { latitude: number; longitude: number };
  style?: ViewStyle;
  /** When true, renders without its own border/background — for embedding inside a styled container */
  bare?: boolean;
  /** Override styles for the suggestions dropdown (unused, kept for API compat) */
  suggestionsStyle?: ViewStyle;
}

export default function AddressAutocomplete({
  value,
  onChangeText,
  onSelectPlace,
  placeholder,
  currentLocation,
  style,
  bare = false,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownLayout, setDropdownLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [maxDropdownHeight, setMaxDropdownHeight] = useState<number>(300);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const containerRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Skip search if a place was just selected (value changed by selection, not typing)
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await searchPlaces(
          value,
          currentLocation?.latitude,
          currentLocation?.longitude
        );
        const found = results.slice(0, 5);
        setSuggestions(found);
        // Solo mostrar dropdown si hay resultados — si no hay, no interrumpir al usuario
        setShowSuggestions(found.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    }, 700);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [value, currentLocation]);

  const measureContainer = () => {
    if (containerRef.current) {
      containerRef.current.measureInWindow((x, y, width, height) => {
        // Calcular el espacio disponible debajo del input
        const spaceBelow = SCREEN_HEIGHT - (y + height) - TAB_BAR_HEIGHT - 20; // 20px de margen

        // Calcular altura máxima basada en el número de sugerencias
        const suggestionsCount = suggestions.length || MAX_VISIBLE_SUGGESTIONS;
        const idealHeight = Math.min(
          suggestionsCount * SUGGESTION_ITEM_HEIGHT,
          MAX_VISIBLE_SUGGESTIONS * SUGGESTION_ITEM_HEIGHT
        );

        // Usar el menor entre el espacio disponible y la altura ideal
        const calculatedMaxHeight = Math.min(spaceBelow, idealHeight, 300);

        setMaxDropdownHeight(Math.max(calculatedMaxHeight, 150)); // Mínimo 150px
        setDropdownLayout({ x, y, width, height });
      });
    }
  };

  const handleSelectPlace = (place: Place) => {
    justSelectedRef.current = true;
    onChangeText(place.name);
    onSelectPlace(place);
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleDismiss = () => {
    // Solo cerrar si el usuario toca fuera, no mantener el teclado
    setShowSuggestions(false);
  };

  const handleInputFocus = () => {
    setIsInputFocused(true);
    measureContainer();
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
    // Delay más largo para permitir que los toques en sugerencias se procesen
    setTimeout(() => {
      if (!isInputFocused) {
        setShowSuggestions(false);
      }
    }, 200);
  };

  // Función para cerrar sugerencias cuando se toca fuera (solo para modo modal)
  const handleModalBackdropPress = () => {
    if (bare) {
      setShowSuggestions(false);
      // Mantener el foco en el input si estaba enfocado
      if (isInputFocused && inputRef.current) {
        inputRef.current.blur();
      }
    }
  };

  const renderSuggestionItem = ({ item }: { item: Place }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSelectPlace(item)}
      activeOpacity={0.7}
      // Evitar que el toque cierre el teclado
      onPressIn={() => {
        // Prevenir que el input pierda el foco
        if (inputRef.current && isInputFocused) {
          inputRef.current.focus();
        }
      }}
    >
      <Ionicons
        name="location-outline"
        size={18}
        color={Colors.mediumGray}
        style={styles.suggestionIcon}
      />
      <View style={styles.suggestionTextContainer}>
        <Text style={styles.suggestionName} numberOfLines={1} ellipsizeMode="tail">
          {item.name}
        </Text>
        {item.description ? (
          <Text style={styles.suggestionDescription} numberOfLines={2} ellipsizeMode="tail">
            {item.description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const showDropdown = bare && showSuggestions && suggestions.length > 0;

  return (
    <View ref={containerRef} style={[styles.container, style]} onLayout={measureContainer}>
      {/* Input field */}
      <View style={bare ? styles.inputContainerBare : styles.inputContainer}>
        {!bare && (
          <Ionicons
            name="search-outline"
            size={20}
            color={Colors.mediumGray}
            style={styles.searchIcon}
          />
        )}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={text => {
            onChangeText(text);
            setTimeout(measureContainer, 50);
          }}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          autoCorrect={false}
          autoCapitalize="none"
          blurOnSubmit={false}
          returnKeyType="search"
        />
        {isLoading && (
          <ActivityIndicator size="small" color={Colors.primary} style={styles.loadingIndicator} />
        )}
      </View>

      {/* Inline suggestions (non-bare mode) */}
      {!bare && showSuggestions && suggestions.length > 0 && (
        <View style={[styles.suggestionsContainer, { maxHeight: maxDropdownHeight }]}>
          <FlatList
            data={suggestions}
            keyExtractor={item => item.id}
            renderItem={renderSuggestionItem}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            scrollEnabled={suggestions.length > MAX_VISIBLE_SUGGESTIONS}
            nestedScrollEnabled={true}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={suggestions.length > MAX_VISIBLE_SUGGESTIONS}
          />
        </View>
      )}

      {/* Modal dropdown (bare mode) — renders above everything */}
      {showDropdown && dropdownLayout && (
        <Modal
          visible={true}
          transparent
          animationType="none"
          onRequestClose={handleDismiss}
          supportedOrientations={['portrait']}
        >
          <TouchableWithoutFeedback onPress={handleModalBackdropPress}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View
                  style={[
                    styles.modalDropdown,
                    {
                      top: dropdownLayout.y + dropdownLayout.height + 4,
                      left: dropdownLayout.x,
                      width: dropdownLayout.width,
                      maxHeight: maxDropdownHeight,
                    },
                  ]}
                >
                  <FlatList
                    data={suggestions}
                    keyExtractor={item => item.id}
                    renderItem={renderSuggestionItem}
                    keyboardShouldPersistTaps="always"
                    keyboardDismissMode="none"
                    scrollEnabled={suggestions.length > MAX_VISIBLE_SUGGESTIONS}
                    nestedScrollEnabled={true}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    showsVerticalScrollIndicator={suggestions.length > MAX_VISIBLE_SUGGESTIONS}
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputContainerBare: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  suggestionsContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
  },
  modalDropdown: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 20,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 60,
  },
  suggestionIcon: {
    marginRight: 10,
    flexShrink: 0,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  suggestionDescription: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
});
