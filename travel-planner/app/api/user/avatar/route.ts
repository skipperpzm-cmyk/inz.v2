import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { updateAvatarUrl } from 'src/db/repositories/user.repository';
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
    if (!dataUrl || typeof dataUrl !== 'string') {
      return NextResponse.json({ error: 'Missing dataUrl' }, { status: 400 });
    }

    const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });

    const mime = match[1];
    const b64 = match[2];
    if (!mime.startsWith('image/')) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });

    const buffer = Buffer.from(b64, 'base64');
    const maxBytes = 2 * 1024 * 1024; // 2 MB
    if (buffer.length > maxBytes) return NextResponse.json({ error: 'File too large' }, { status: 413 });

    const ext = mime.split('/')[1].split('+')[0];
    const filename = `${uuidv4()}.${ext}`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const outPath = path.join(uploadsDir, filename);
    await fs.writeFile(outPath, buffer);

    // Update user in DB
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const avatarUrl = `/uploads/${filename}`;
    const updated = await updateAvatarUrl(user.id, avatarUrl);
    return NextResponse.json({ avatarUrl: updated?.avatarUrl ?? avatarUrl });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
