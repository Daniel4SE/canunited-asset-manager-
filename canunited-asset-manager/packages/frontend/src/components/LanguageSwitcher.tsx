import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check } from 'lucide-react';
import clsx from 'clsx';
import { supportedLanguages, type SupportedLanguage } from '../i18n';

interface LanguageSwitcherProps {
  collapsed?: boolean;
}

export default function LanguageSwitcher({ collapsed = false }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = supportedLanguages.find(
    (lang) => lang.code === i18n.language
  ) || supportedLanguages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (langCode: SupportedLanguage) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          'text-slate-400 hover:text-white hover:bg-slate-800/50',
          collapsed ? 'justify-center' : 'w-full'
        )}
        title={collapsed ? currentLanguage.name : undefined}
      >
        <Globe className="w-5 h-5 flex-shrink-0" />
        {!collapsed && (
          <span className="font-medium flex-1 text-left">
            {currentLanguage.flag} {currentLanguage.name}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: collapsed ? 0 : -10, x: collapsed ? 10 : 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: collapsed ? 0 : -10, x: collapsed ? 10 : 0 }}
            className={clsx(
              'absolute bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50',
              collapsed
                ? 'left-full ml-2 top-0'
                : 'bottom-full left-0 right-0 mb-2'
            )}
          >
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 transition-colors',
                  'hover:bg-slate-700/50',
                  i18n.language === lang.code
                    ? 'text-primary-400 bg-slate-700/30'
                    : 'text-slate-300'
                )}
              >
                <span>{lang.flag}</span>
                <span className="flex-1 text-left">{lang.name}</span>
                {i18n.language === lang.code && (
                  <Check className="w-4 h-4 text-primary-400" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
