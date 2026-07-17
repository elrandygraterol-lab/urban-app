import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  Dimensions,
  Keyboard,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchPlaces } from '@/services/mapsService';
import { Colors } from '@/constants/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const TAB_BAR_HEIGHT = 60; // Altura aproximada del tab bar
const SUGGESTION_ITEM_HEIGHT = 44; // Altura aproximada de cada sugerencia
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
  suggestionsStyle,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [maxDropdownHeight, setMaxDropdownHeight] = useState<number>(300);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const containerRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedRef = useRef(false);
  const isInputFocusedRef = useRef(false);
  const lastSearchValue = useRef<string>('');

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Skip search if value was just set by selection (avoid flicker)
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    // Avoid redundant search for unchanged value
    if (value === lastSearchValue.current) return;
    lastSearchValue.current = value;

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

  // Re-measure container when keyboard appears/disappears
  // (KeyboardAwareScrollView scrolls the panel, changing input position)
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(measureContainer, 100);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setTimeout(measureContainer, 100);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

  const handleInputFocus = () => {
    setIsInputFocused(true);
    isInputFocusedRef.current = true;
    measureContainer();
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
    isInputFocusedRef.current = false;
    // Cerrar sugerencias con un pequeño delay para permitir que
    // los toques en sugerencias se procesen antes de cerrar
    setTimeout(() => {
      if (!isInputFocusedRef.current) {
        setShowSuggestions(false);
      }
    }, 250);
  };

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

      {/* Inline suggestions — same for bare and non-bare modes */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={[styles.suggestionsContainer, { maxHeight: maxDropdownHeight }]}>
          <ScrollView
            keyboardShouldPersistTaps="always"
            scrollEnabled={suggestions.length > 0}
            showsVerticalScrollIndicator={suggestions.length > 0}
          >
            {suggestions.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => handleSelectPlace(item)}
                  activeOpacity={0.7}
                  onPressIn={() => {
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
              </React.Fragment>
            ))}
          </ScrollView>
        </View>
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

  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  suggestionIcon: {
    marginRight: 10,
    flexShrink: 0,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  suggestionDescription: {
    fontSize: 11,
    color: Colors.mediumGray,
    marginTop: 1,
    lineHeight: 15,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
});
