import StatWidget from '../../../components/StatWidget';
import Card from '../../../components/Card';
import Button from '../../../components/ui/button';

const demoUserName = '"Twój pseudonim"';

const demoTrips = [
    {
        id: 'trip-sardinia',
        title: 'Sardynia: Błękitne zatoki',
        startDate: '2026-06-02',
        endDate: '2026-06-10',
        highlight: '8 dni słońca, jacht i trekkingi przy Cala Luna',
    },
    {
        id: 'trip-kyoto',
        title: 'Kyoto i Tokio',
        startDate: '2026-09-14',
        endDate: '2026-09-24',
        highlight: 'Ceremonia herbaty, nocne spacery i neonowe ulice Shinjuku',
    },
];

const demoBoard = {
    title: 'Tablica: Rome Vibes',
    items: [
        'Poranny spektakl w Colosseum',
        'Lunch na Time',
        'Sunset przy Fontannie di Trevi',
        'Notatka: zabukować bilety na tramwaj 28',
    ],
};

const demoTasks = [
    { id: 'task-1', label: 'Check-lista pakowania', detail: 'Minimalistyczny zestaw + akcesoria snorkelingowe', status: 'Zablokowane do potwierdzenia bagażu.' },
    { id: 'task-2', label: 'Spotkanie z partnerem podróży', detail: 'Wideo-call w piątek o 18:00 – potwierdzić plan dnia 3.', status: 'Zaplanowane' },
];

export default function DemoDashboardPage() {
    return (
        <div className="space-y-6 lg:pl-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glass">
                <div className="flex flex-col gap-3">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-300">Tryb demonstracyjny</p>
                    <h1 className="text-3xl font-semibold text-white">Hej {demoUserName}, tak wygląda Twój panel po zalogowaniu</h1>
                    <p className="text-slate-200/80 text-sm md:text-base max-w-3xl">
                        Zobacz skrót najważniejszych elementów — kontrola nad podróżą, stały dostęp do tablic i szybkie spojrzenie na kolejne dni. Wszystko czytelne i gotowe do działania.
                    </p>
                </div>
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatWidget title="Aktywne podróże" value={demoTrips.length} />
                <StatWidget title="Tablice inspiracji" value={1} />
                <StatWidget title="Zadania" value={demoTasks.length} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <Card className="dashboard-card justify-start lg:col-span-2">
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Przykładowe podróże</h3>
                                <p className="text-sm text-slate-300/80">Wersja demo prezentuje podgląd dwóch planów</p>
                            </div>
                            <Button disabled aria-disabled="true" className="pointer-events-none opacity-60">
                                Dodaj podróż
                            </Button>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {demoTrips.map((trip) => (
                                <div key={trip.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200/90">
                                    <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
                                        <span>{trip.startDate}</span>
                                        <span>→ {trip.endDate}</span>
                                    </div>
                                    <h4 className="mt-3 text-base font-semibold text-white">{trip.title}</h4>
                                    <p className="mt-2 text-slate-300/90 text-sm leading-relaxed">{trip.highlight}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                <Card className="dashboard-card justify-start">
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-white">{demoBoard.title}</h3>
                                <p className="text-sm text-slate-300/80">Chwyć klimat planu w kilku notatkach</p>
                            </div>
                            <Button variant="secondary" disabled aria-disabled="true" className="pointer-events-none opacity-60">
                                Podgląd
                            </Button>
                        </div>

                        <ul className="mt-6 space-y-3 text-sm text-slate-200/80">
                            {demoBoard.items.map((item) => (
                                <li key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card className="dashboard-card justify-start">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-semibold text-white">Zadania i checklisty</h3>
                            <p className="text-sm text-slate-300/80">Wszystko dopięte na ostatni guzik</p>
                        </div>
                        <Button variant="ghost" disabled aria-disabled="true" className="pointer-events-none opacity-60">
                            Dodaj zadanie
                        </Button>
                    </div>
                    <ul className="mt-5 space-y-3 text-sm text-slate-200/90">
                        {demoTasks.map((task) => (
                            <li key={task.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
                                    <span>{task.label}</span>
                                    <span>{task.status}</span>
                                </div>
                                <p className="mt-2 text-slate-200/90">{task.detail}</p>
                            </li>
                        ))}
                    </ul>
                </Card>

                <Card className="dashboard-card justify-start">
                    <div className="flex flex-col h-full">
                        <h3 className="text-lg font-semibold text-white">Mini podsumowanie dnia</h3>
                        <p className="mt-2 text-sm text-slate-300/80">Oto jak wyglądałby poranek w aplikacji</p>
                        <div className="mt-6 space-y-4 text-sm text-slate-200/90">
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-xs uppercase tracking-widest text-slate-400">09:00</p>
                                <p className="mt-1 text-white">Spacer po Rzymie i espresso w Cool Coffee</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-xs uppercase tracking-widest text-slate-400">12:30</p>
                                <p className="mt-1 text-white">Lunch na dachu z widokiem na Ocean — rezerwacja potwierdzona</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-xs uppercase tracking-widest text-slate-400">16:00</p>
                                <p className="mt-1 text-white">Szybka lista zakupów w 7eleven (moduł notatek)</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
