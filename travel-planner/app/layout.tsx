"use client";
import React from 'react';
import '../styles/globals.css';
// ThemeProvider removed — dashboard styling now enforced via globals.css
import ToastProvider from '../components/toast/ToastProvider';
import { FriendProvider } from '../components/FriendContext';
import { GroupProvider } from '../contexts/GroupContext';

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=crown" />
            </head>
            <body className="min-h-screen bg-slate-900 text-slate-100 antialiased">
                <ToastProvider>
                    <GroupProvider>
                        <FriendProvider>
                            <div className="min-h-screen flex flex-col">
                                <main className="flex-1">
                                    {children}
                                </main>
                            </div>
                        </FriendProvider>
                    </GroupProvider>
                </ToastProvider>
            </body>
        </html>
    );
}