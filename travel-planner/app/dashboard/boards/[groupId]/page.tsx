import BoardDetailClient from '@/components/dashboard/BoardDetailClient';

export default async function BoardDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return <BoardDetailClient groupId={groupId} />;
}
