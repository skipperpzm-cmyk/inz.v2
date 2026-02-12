import React from 'react';

export default function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col">
            <header className="bg-gray-800 text-white p-4">
                <h1 className="text-xl">Travel Planner</h1>
            </header>
            <main className="flex-grow p-4">{children}</main>
        </div>
    );
}