import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../types';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export default function ShortcutsModal({ isOpen, onClose, lang }: ShortcutsModalProps) {
  const isHe = lang === 'he';

  const shortcuts = [
    { key: 'D', descEn: 'Main Dispatch Control', descHe: 'לוח סידור הפצה ראשי' },
    { key: 'A', descEn: 'Product Analytics Dashboard', descHe: 'דוחות וניתוח מוצרים' },
    { key: 'M', descEn: 'Interactive Order Map', descHe: 'מפת משלוחים אינטראקטיבית' },
    { key: 'N', descEn: 'Noa AI Logistics Assistant', descHe: 'עוזרת לוגיסטיקה חכמה Noa AI' },
    { key: 'R', descEn: 'Morning Dispatch Report', descHe: 'דוח סידור בוקר לווטסאפ' },
    { key: 'H', descEn: 'Status Transition History', descHe: 'היסטוריית סטטוסים' },
    { key: '?', descEn: 'Toggle Keyboard Shortcuts Info', descHe: 'הצגת קיצורי מקלדת' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            id="shortcuts-modal-backdrop"
          />

          {/* Modal Content Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl transition-all z-10 text-slate-800 dark:text-slate-100"
            id="shortcuts-modal-content"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-4">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Keyboard className="h-5 w-5" />
                <h3 className="text-base font-black tracking-tight">
                  {isHe ? 'קיצורי מקלדת לניווט מהיר' : 'Keyboard Navigation Shortcuts'}
                </h3>
              </div>
              <button
                id="close-shortcuts-modal"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Subtext info */}
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              {isHe
                ? 'תוכל להשתמש במקשים הבאים בכל שלב כדי לנווט באופן מיידי בין הטאבים והעמודים במערכת:'
                : 'Press any of the keys below at any time to instantly switch tabs and browse pages:'}
            </p>

            {/* Shortcuts list */}
            <div className="space-y-3">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.key}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800/40"
                >
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {isHe ? shortcut.descHe : shortcut.descEn}
                  </span>
                  <div className="flex items-center">
                    <kbd className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 shadow-[0_2px_0_rgba(0,0,0,0.1)] dark:shadow-[0_2px_0_rgba(255,255,255,0.05)] select-none">
                      {shortcut.key}
                    </kbd>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer tips */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center">
              <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                {isHe ? 'לחץ ? או K בכל שלב לפתיחת חלונית זו' : 'Press ? or K anywhere to toggle'}
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
