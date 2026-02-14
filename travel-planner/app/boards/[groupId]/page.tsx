import { redirect } from 'next/navigation';

export default async function BoardDetailRedirectPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  redirect(`/dashboard/boards/${encodeURIComponent(groupId)}`);
}
