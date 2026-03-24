import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * Custom hook for translations
 * Wraps react-i18next's useTranslation hook
 */
export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();

  const changeLanguage = (lang: 'es' | 'en') => {
    i18n.changeLanguage(lang);
  };

  const currentLanguage = i18n.language as 'es' | 'en';

  return {
    t,
    changeLanguage,
    currentLanguage,
    i18n,
  };
};
