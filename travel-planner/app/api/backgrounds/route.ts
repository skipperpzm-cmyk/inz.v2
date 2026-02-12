import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public', 'backgrounds');

    const svgPaths: string[] = [];
    const videoPaths: string[] = [];

    function walk(dir: string, rel = '') {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        const relPath = rel ? `${rel}/${entry}` : entry;
        if (stat.isDirectory()) {
          walk(full, relPath);
        } else if (entry.toLowerCase().endsWith('.svg')) {
          svgPaths.push(`/backgrounds/${relPath.split(path.sep).join('/')}`);
        } else if (entry.toLowerCase().endsWith('.mp4')) {
          videoPaths.push(`/backgrounds/${relPath.split(path.sep).join('/')}`);
        }
      }
    }

    walk(publicDir);

    // combine found files
    const paths = [...svgPaths, ...videoPaths];
    // Prefer non-animated files first; append anything in the 'animated' subfolder at the end
    const animatedPaths = paths.filter((p: string) => p.includes('/animated/'));
    const nonAnimated = paths.filter((p: string) => !p.includes('/animated/'));
    const pathsOrdered = [...nonAnimated, ...animatedPaths];
    return NextResponse.json(pathsOrdered);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list backgrounds' }, { status: 500 });
  }
}
