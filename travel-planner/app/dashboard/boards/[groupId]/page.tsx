import GroupBoardsClient from '@/components/dashboard/GroupBoardsClient';

export default async function GroupBoardsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return <GroupBoardsClient groupId={groupId} />;
}
