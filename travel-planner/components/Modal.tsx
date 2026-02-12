"use client";
import React from 'react';
import { Dialog } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
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
              {/* Modal body inherits the frosted look: translucent fill, blur, subtle border, deep glow shadow. */}
              {title && (
                <Dialog.Title className="text-xl font-semibold text-white mb-4">
                  {title}
                </Dialog.Title>
              )}
              {children}
            </motion.div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
