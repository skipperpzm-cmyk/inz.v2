import StatWidget from '../../components/StatWidget';
import Card from '../../components/Card';
import Button from '../../components/ui/button';
import { getCurrentUser } from '../../lib/auth';
import { getTripsByUser } from '../../src/db/repositories/trip.repository';
import { getBoardsByTripId } from '../../src/db/repositories/board.repository';
import { getItemsByBoardId } from '../../src/db/repositories/boardItem.repository';
import { redirect } from 'next/navigation';

const STATUS_LABELS: Record<string, string> = {
    todo: 'Do zrobienia',
    doing: 'W toku',
    done: 'Zakończone',
    review: 'Do przeglądu',
    blocked: 'Zablokowane',
};

function formatStatusLabel(status?: string | null) {
    if (!status) return '—';
    const normalized = status.toLowerCase();
    return STATUS_LABELS[normalized] ?? status;
}

const formatDateLabel = (value?: string | null) => value ?? 'Do ustalenia';

export default async function DashboardPage() {
    const user = await getCurrentUser();
    if (!user) {
        redirect('/login');
    }

    const trips = await getTripsByUser(user.id);
    const boardGroups = await Promise.all(trips.map((trip) => getBoardsByTripId(trip.id)));
    const boards = boardGroups.flat();
    const boardItemsGroups = await Promise.all(boards.map((board) => getItemsByBoardId(board.id)));
    const boardItems = boardItemsGroups.flat();

    return (
        <div className="space-y-4 lg:pl-6">
            <div className="flex flex-col gap-2">
                <p className="text-sm text-slate-300">Witaj ponownie, {user.username ?? user.email}</p>
                <h1 className="text-3xl font-semibold text-white">Twój panel</h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatWidget title="Podróże" value={trips.length} />
                <StatWidget title="Tablice" value={boards.length} />
                <StatWidget title="Elementy tablic" value={boardItems.length} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="dashboard-card justify-start">
                    <div className="flex flex-col h-full">
                        <div>
                            <h3 className="text-lg font-semibold text-white">Twoje podróże</h3>
                        </div>
                        <div className="mt-8 flex flex-col flex-1">
                            {trips.length === 0 ? (
                                <p className="text-sm text-slate-200/80">Brak podróży — utwórz pierwszy plan.</p>
                            ) : (
                                <ul className="space-y-2 text-sm text-slate-200/80 flex-1 overflow-auto">
                                    {trips.map((trip) => (
                                        <li key={trip.id} className="flex items-center justify-between">
                                            <span>{trip.title}</span>
                                            <span className="text-xs text-slate-400">
                                                {formatDateLabel(trip.startDate)} → {formatDateLabel(trip.endDate)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="mt-6">
                                <Button className="w-full">Utwórz podróż</Button>
                            </div>
                        </div>
                    </div>
                </Card>
                <Card className="dashboard-card justify-start">
                    <div className="flex flex-col h-full">
                        <div>
                            <h3 className="text-lg font-semibold text-white">Tablice</h3>
                        </div>
                        <div className="mt-8 flex flex-col flex-1">
                            {boards.length === 0 ? (
                                <p className="text-sm text-slate-200/80">Tablice pojawią się, gdy powiążesz je z podróżami.</p>
                            ) : (
                                <ul className="space-y-2 text-sm text-slate-200/80 flex-1 overflow-auto">
                                    {boards.slice(0, 4).map((board) => (
                                        <li key={board.id}>{board.title}</li>
                                    ))}
                                </ul>
                            )}
                            <div className="mt-6">
                                <Button variant="secondary" className="w-full">
                                    Zarządzaj tablicami
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
                <Card className="dashboard-card justify-start">
                    <div className="flex flex-col h-full">
                        <div>
                            <h3 className="text-lg font-semibold text-white">Elementy tablic</h3>
                        </div>
                        <div className="mt-8 flex flex-col flex-1">
                            {boardItems.length === 0 ? (
                                <p className="text-sm text-slate-200/80">Tworzone zadania pojawią się tutaj.</p>
                            ) : (
                                <ul className="space-y-2 text-sm text-slate-200/80 flex-1 overflow-auto">
                                    {boardItems.slice(0, 4).map((item) => (
                                        <li key={item.id} className="flex items-center justify-between">
                                            <span>{item.title}</span>
                                            <span className="text-xs uppercase tracking-wide text-slate-400">{formatStatusLabel(item.status)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}