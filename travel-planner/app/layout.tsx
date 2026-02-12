"use client";
import React from 'react';
import '../styles/globals.css';
// ThemeProvider removed — dashboard styling now enforced via globals.css
import ToastProvider from '../components/toast/ToastProvider';
import { FriendProvider } from '../components/FriendContext';

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className="min-h-screen bg-slate-900 text-slate-100 antialiased">
                <ToastProvider>
                  <FriendProvider>
                    <div className="min-h-screen flex flex-col">
                        <main className="flex-1">
                            {children}
                        </main>
                    </div>
                  </FriendProvider>
                </ToastProvider>
            </body>
        </html>
    );
}