import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../lib/auth';
import { updateBackgroundUrl } from '../../../../../src/db/repositories/user.repository';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

type Body = {
  dataUrl: string;
};

export async function POST(req: Request) {
  try {
    const body: Body = await req.json();
    const { dataUrl } = body;
    if (!dataUrl || typeof dataUrl !== 'string') return NextResponse.json({ error: 'Missing dataUrl' }, { status: 400 });

    const match = dataUrl.match(/^data:(video\/[^;]+);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: 'Invalid video data' }, { status: 400 });

    const mime = match[1];
    const b64 = match[2];
    if (!mime.startsWith('video/')) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });

    const buffer = Buffer.from(b64, 'base64');
    const maxBytes = 15 * 1024 * 1024; // 15 MB
    if (buffer.length > maxBytes) return NextResponse.json({ error: 'File too large' }, { status: 413 });

    const ext = mime.split('/')[1].split('+')[0];
    const filename = `video_background_${uuidv4()}.${ext}`;
    const videosDir = path.join(process.cwd(), 'public', 'backgrounds', 'videos');
    await fs.mkdir(videosDir, { recursive: true });
    const outPath = path.join(videosDir, filename);
    await fs.writeFile(outPath, buffer);

    // Update user in DB
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const videoUrl = `/backgrounds/videos/${filename}`;
    const updated = await updateBackgroundUrl(user.id, videoUrl);
    return NextResponse.json({ backgroundUrl: updated?.backgroundUrl ?? videoUrl });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
