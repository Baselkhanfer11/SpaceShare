import { useI18n } from '../i18n/LanguageContext';
import { useTheme } from '../lib/theme';
import { MoonIcon, SunIcon } from './icons';

/** Language switch + light/dark toggle, shown in the top bar and on the sign-in screens. */
export function Prefs() {
  const { lang, setLang, t } = useI18n();
  const { theme, toggle } = useTheme();

  return (
    <div className="prefs">
      <button className="btn btn-ghost btn-sm" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} lang={lang === 'en' ? 'ar' : 'en'}>
        {lang === 'en' ? 'العربية' : 'English'}
      </button>
      <button className="icon-btn" onClick={toggle} aria-label={t(theme === 'dark' ? 'prefs.light' : 'prefs.dark')} title={t(theme === 'dark' ? 'prefs.light' : 'prefs.dark')}>
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  );
}
