import BoardDetailClient from '@/components/dashboard/BoardDetailClient';

export default async function BoardDetailPage({ params }: { params: Promise<{ groupId: string; boardId: string }> }) {
  const { groupId, boardId } = await params;
  return <BoardDetailClient groupId={groupId} boardId={boardId} />;
}
