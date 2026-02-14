"use client";
import React from 'react';
import { Dialog } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export default function Modal({ open, onClose, title, children, showCloseButton }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <Dialog as={motion.div} className="relative z-50" open={open} onClose={onClose} static>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Overlay
              as={motion.div}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glass backdrop-blur-2xl"
            >
              {title && (
                <Dialog.Title className="text-xl font-semibold text-white mb-4">
                  {title}
                </Dialog.Title>
              )}
              {/* X button for closing modal, if enabled */}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-6 right-6 z-20 inline-flex items-center justify-center w-9 h-9 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
                  aria-label="Zamknij"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {children}
            </motion.div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
