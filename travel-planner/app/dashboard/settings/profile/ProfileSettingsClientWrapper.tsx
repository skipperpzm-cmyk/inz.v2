"use client";
import dynamic from 'next/dynamic';

const ProfileSettingsClient = dynamic(() => import('../../../../components/settings/ProfileSettingsClient.tsx').then((mod) => mod.default), { ssr: false });

export default function ProfileSettingsClientWrapper() {
  return <ProfileSettingsClient />;
}