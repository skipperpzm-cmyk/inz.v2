"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import Button from '../../components/ui/button';
import Card from '../../components/Card';

const features = [
    { title: 'Panel i podgląd', description: 'Spersonalizowany panel pokazuje nadchodzące wyjazdy, pilne zadania i szybkie akcje.' },
    { title: 'Zarządzanie wyjazdami', description: 'Twórz kompletne plan podróży z datami, lokalizacjami, rezerwacjami i dziennym harmonogramem.' },
    { title: 'Wspólne tablice', description: 'Udostępniaj pomysły, przydzielaj zadania i zbieraj inspiracje na tablicach dla zespołów.' },
];

const testimonials = [
    { name: 'Agnieszka P.', role: 'Podróżniczka', quote: 'Ta aplikacja zamienia planowanie podróży w spokojne i eleganckie doświadczenie. Wszystko jest przemyślane, czytelne i świetnie uporządkowane.' },
    { name: 'Marek S.', role: 'Organizator wyjazdów', quote: 'W końcu mam wszystkie wyjazdy, rezerwacje i plany dni w jednym miejscu. Planowanie stało się szybsze i znacznie mniej chaotyczne.' },
    { name: 'Tomasz Z.', role: 'Samotny podróżnik', quote: 'Zamiast stresować się szczegółami, mogę skupić się na ekscytacji samą podróżą. To naprawdę zmieniło sposób, w jaki przygotowuję wyjazdy.' },
];

const HomePage = () => {
    const router = useRouter();

    return (
        <div className="relative bg-transparent flex-1 flex flex-col">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <section className="relative z-10 space-y-12">
                    <header className="rounded-4xl p-8 bg-transparent">
                        <div className="bg-gradient-to-br from-white/3 to-transparent rounded-3xl p-8 md:p-12 shadow-glass backdrop-blur-2xl">
                            <div className="text-center">
                                <p className="text-sm uppercase tracking-widest text-slate-300/70">Szybciej. Pewniej. Dalej.</p>
                                <h1 className="mt-4 text-4xl md:text-5xl font-semibold text-white">Planuj szybciej. Podróżuj swobodniej.</h1>
                                <p className="mt-4 text-base text-slate-200/80 max-w-3xl mx-auto">
                                    Zorganizuj każdy fragment podróży w jednym miejscu — plan dnia, rezerwacje i listy zadań. Działaj szybciej, zachowaj pełną kontrolę i poczuj wolność podróżowania bez chaosu.
                                </p>
                                {/* Buttons removed per request: Sign up / Log in removed to keep hero minimal */}
                            </div>
                        </div>
                    </header>

                    <section aria-labelledby="features-heading">
                        <h2 id="features-heading" className="sr-only">Funkcje</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {features.map((f) => (
                                <Card key={f.title} className="hover:shadow-2xl">
                                    <div className="flex flex-col h-full">
                                        <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                                        <p className="mt-2 text-sm text-slate-200/80 flex-1">{f.description}</p>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </section>

                    <section className="grid lg:grid-cols-2 gap-6 items-center">
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white">Jak to działa</h2>
                            <p className="text-slate-200/80">Zacznij od utworzenia wyjazdu, dodaj daty i miejsca, a następnie wypełnij dni aktywnościami.</p>
                            <ul className="mt-4 space-y-3">
                                <li className="flex items-start gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full bg-primary mt-2" />
                                    <div>
                                        <p className="font-medium text-white">Zaplanuj raz, korzystaj wszędzie</p>
                                        <p className="text-sm text-slate-200/80">Korzystaj z planów na telefonie i komputerze w tym samym interfejsie.</p>
                                    </div>
                                </li>
                            </ul>
                            <div className="mt-6">
                                <Button className="bg-gray-800/50 hover:bg-gray-800/70 focus-visible:ring-white/60" onClick={() => router.push('/register')}>Zacznij planowanie</Button>
                            </div>
                        </div>

                        <div>
                            <div className="bg-white/5 backdrop-blur-2xl border border-white/8 rounded-3xl p-6 shadow-glass">
                                <h3 className="text-lg font-semibold text-white">Podgląd na żywo</h3>
                                <p className="mt-2 text-sm text-slate-200/80">Zanurz się w przykładowym dniu podróży i poczuj inspirację do nowych odkryć.</p>
                            </div>
                        </div>
                    </section>

                    <section aria-labelledby="testimonials-heading" className="space-y-6">
                        <h2 id="testimonials-heading" className="text-2xl font-semibold text-white">Co mówią nasi użytkownicy</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {testimonials.map((t) => (
                                <blockquote key={t.name} className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl p-5 shadow-glass">
                                    <p className="text-slate-200/80">“{t.quote}”</p>
                                    <div className="mt-3 text-sm text-slate-300">— {t.name}, <span className="text-slate-400">{t.role}</span></div>
                                </blockquote>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-4xl p-8 text-center">
                        <div className="bg-gradient-to-br from-white/3 to-transparent rounded-3xl p-8 shadow-glass backdrop-blur-2xl">
                            <h2 className="text-2xl font-semibold text-white">Gotowy na zaplanowanie kolejnej podróży?</h2>
                            <p className="mt-2 text-slate-200/80">Dołącz do społeczności podróżników, którzy projektują lepsze wyprawy z mniejszym stresem.</p>
                                <div className="mt-6 flex items-center justify-center gap-4">
                                <Button className="bg-gray-800/50 hover:bg-gray-800/70 focus-visible:ring-white/60" onClick={() => router.push('/register')}>Zacznij — to nic nie kosztuje</Button>
                                <Button variant="secondary" className="bg-gray-800/40 hover:bg-gray-800/60 focus-visible:ring-white/60" onClick={() => router.push('/demo/dashboard')}>Zobacz demo</Button>
                            </div>
                        </div>
                    </section>
                </section>
            </div>
            <LandingFooter />
        </div>
    );
};

export default HomePage;

// Footer: only present on the Landing page
function LandingFooter() {
    return (
        <footer className="w-full py-6 relative z-20">
            <div className="mx-auto max-w-7xl px-6">
                <div className="mx-auto max-w-7xl rounded-3xl p-4 text-center text-slate-300 text-sm space-y-4 backdrop-blur-2xl">
                    <p>&copy; {new Date().getFullYear()} Travel Planner — wszystkie prawa zastrzeżone</p>
                </div>
            </div>
        </footer>
    );
}

// Landing footer is rendered within this file; no named exports required.
