import { notFound } from 'next/navigation';

type Props = { params: { slug: string } };

export default function ProfilePage({ params }: Props) {
  // Legacy /u/<slug> endpoint removed. Do not redirect — return 404.
  notFound();
}
