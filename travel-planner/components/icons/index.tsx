import React from 'react';
import {
  HomeIcon,
  MapPinIcon,
  Squares2X2Icon,
  CalendarDaysIcon,
  DocumentTextIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  BookmarkIcon,
  ArchiveBoxIcon,
  InformationCircleIcon,
  RectangleGroupIcon,
} from '@heroicons/react/24/outline';

export function IconOverview(props: React.SVGProps<SVGSVGElement>) {
  return <HomeIcon {...props} />;
}

export function IconTrips(props: React.SVGProps<SVGSVGElement>) {
  return <MapPinIcon {...props} />;
}

export function IconBoards(props: React.SVGProps<SVGSVGElement>) {
  return <Squares2X2Icon {...props} />;
}

export function IconCalendar(props: React.SVGProps<SVGSVGElement>) {
  return <CalendarDaysIcon {...props} />;
}

export function IconNotes(props: React.SVGProps<SVGSVGElement>) {
  return <DocumentTextIcon {...props} />;
}

export function IconStats(props: React.SVGProps<SVGSVGElement>) {
  return <ChartBarIcon {...props} />;
}

export function IconSettings(props: React.SVGProps<SVGSVGElement>) {
  return <Cog6ToothIcon {...props} />;
}

export function IconDefault(props: React.SVGProps<SVGSVGElement>) {
  return <RectangleGroupIcon {...props} />;
}

export function IconSaved(props: React.SVGProps<SVGSVGElement>) {
  return <BookmarkIcon {...props} />;
}

export function IconArchive(props: React.SVGProps<SVGSVGElement>) {
  return <ArchiveBoxIcon {...props} />;
}

export function IconAbout(props: React.SVGProps<SVGSVGElement>) {
  return <InformationCircleIcon {...props} />;
}

export function getIconForHref(href: string) {
  if (!href) return IconDefault;
  if (href.startsWith('/dashboard/saved')) return IconSaved;
  if (href.startsWith('/dashboard/archive')) return IconArchive;
  if (href.startsWith('/dashboard/trips')) return IconTrips;
  if (href.startsWith('/dashboard/boards')) return IconBoards;
  if (href.startsWith('/dashboard/calendar')) return IconCalendar;
  if (href.startsWith('/dashboard/notes')) return IconNotes;
  if (href.startsWith('/dashboard/stats')) return IconStats;
  if (href.startsWith('/dashboard/settings')) return IconSettings;
  if (href === '/dashboard') return IconOverview;
  if (href === '/about') return IconAbout;
  return IconDefault;
}

export function getIconForKey(key: string) {
  if (!key) return IconDefault;
  const k = key.toLowerCase();
  if (k.includes('saved') || k.includes('bookmark') || k.includes('star')) return IconSaved;
  if (k.includes('archiv')) return IconArchive;
  if (k.includes('trip')) return IconTrips;
  if (k.includes('board')) return IconBoards;
  if (k.includes('calendar')) return IconCalendar;
  if (k.includes('note')) return IconNotes;
  if (k.includes('stat')) return IconStats;
  if (k.includes('setting')) return IconSettings;
  if (k.includes('overview') || k.includes('dashboard')) return IconOverview;
  if (k.includes('about') || k.includes('help') || k.includes('info')) return IconAbout;
  return IconDefault;
}

export default getIconForHref;
