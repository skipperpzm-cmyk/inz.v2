import { redirect } from 'next/navigation';

export default function BoardsRedirectPage() {
  redirect('/dashboard/boards');
}
