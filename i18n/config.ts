import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import es from './es.json';
import en from './en.json';

// Get device language
const deviceLanguage = Localization.locale.split('-')[0];

// Define resources
const resources = {
  es: { translation: es },
  en: { translation: en },
};

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: deviceLanguage === 'es' ? 'es' : 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for better compatibility
    },
  });

export default i18n;
