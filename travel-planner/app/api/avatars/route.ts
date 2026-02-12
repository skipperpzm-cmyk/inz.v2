import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

function isImageFile(name: string) {
  return /\.(png|jpe?g|svg|webp|gif)$/i.test(name);
}

export async function GET() {
  try {
    const avatarsRoot = path.join(process.cwd(), 'public', 'avatars');
    const folders = await fs.readdir(avatarsRoot, { withFileTypes: true }).catch(() => []);
    const result: Record<string, string[]> = {};

    for (const dirent of folders) {
      if (!dirent.isDirectory()) continue;
      const folderPath = path.join(avatarsRoot, dirent.name);
      const files = await fs.readdir(folderPath).catch(() => []);
      const images = files.filter((f) => isImageFile(f)).map((f) => `/avatars/${dirent.name}/${f}`);
      result[dirent.name] = images;
    }

    return NextResponse.json(result);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return NextResponse.json({ error: 'Unable to list avatars' }, { status: 500 });
  }
}
