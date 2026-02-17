import { redirect } from 'next/navigation';

export default async function BoardNestedRedirectPage({ params }: { params: Promise<{ groupId: string; boardId: string }> }) {
  const { groupId, boardId } = await params;
  redirect(`/dashboard/boards/${encodeURIComponent(groupId)}/${encodeURIComponent(boardId)}`);
}
