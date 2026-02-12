import React from 'react';

export default function ItineraryForm() {
    return (
        <form className="space-y-4">
            <div>
                <label htmlFor="destination" className="block text-sm font-medium text-gray-700">
                    Destination
                </label>
                <input
                    type="text"
                    id="destination"
                    name="destination"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
            </div>
            <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                    Date
                </label>
                <input
                    type="date"
                    id="date"
                    name="date"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
            </div>
            <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                    Notes
                </label>
                <textarea id="notes" name="notes" rows={4} className="mt-1 block w-full resize-none overflow-auto max-h-40 border border-gray-300 rounded-md shadow-sm p-2" />
            </div>
            <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded-md">
                Save Itinerary
            </button>
        </form>
    );
}