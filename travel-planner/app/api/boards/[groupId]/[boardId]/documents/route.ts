import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabaseClient';
import { getBoardAccessForUser } from '../../../_lib/moderation';

type Params = { params: Promise<{ groupId: string; boardId: string }> };

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const SAFE_NAME_RE = /[^a-zA-Z0-9._-]+/g;

async function ensureBucketExists(supabase: ReturnType<typeof getServiceSupabase>, bucket: string) {
  const existsResult = await supabase.storage.getBucket(bucket);
  if (!existsResult.error) return;

  const message = String(existsResult.error.message || '').toLowerCase();
  const code = String((existsResult.error as any)?.statusCode || (existsResult.error as any)?.status || '');
  const missing = message.includes('not found') || code === '404';
  if (!missing) {
    throw new Error(existsResult.error.message || 'Failed to check storage bucket');
  }

  const createResult = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
  });

  if (createResult.error) {
    throw new Error(createResult.error.message || `Failed to create storage bucket: ${bucket}`);
  }
}

function sanitizeFileName(name: string) {
  const trimmed = name.trim();
  const safe = trimmed.replace(SAFE_NAME_RE, '_');
  return safe.length > 0 ? safe.slice(0, 140) : `file-${Date.now()}`;
}

export async function POST(request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { boardId } = await context.params;
  if (!boardId) return NextResponse.json({ error: 'Missing board id' }, { status: 400 });

  try {
    const access = await getBoardAccessForUser(userId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!access.isMember || !access.canModerate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (access.isArchived) {
      return NextResponse.json({ error: 'Archived board is read-only' }, { status: 409 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 413 });
    }

    const contentType = file.type?.trim() || 'application/octet-stream';
    const safeName = sanitizeFileName(file.name || 'document');
    const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const filePath = `boards/${access.groupId}/${access.boardId}/${userId}/${uniquePrefix}-${safeName}`;

    const supabase = getServiceSupabase();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'travel-documents';

    await ensureBucketExists(supabase, bucket);

    const uploadResult = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        upsert: false,
        contentType,
        cacheControl: '3600',
      });

    if (uploadResult.error) {
      console.error('document upload error', uploadResult.error);
      return NextResponse.json({ error: 'Failed to upload file to cloud storage' }, { status: 500 });
    }

    const publicResult = supabase.storage.from(bucket).getPublicUrl(filePath);
    const fileUrl = publicResult?.data?.publicUrl || null;

    return NextResponse.json({
      fileName: file.name,
      filePath,
      fileUrl,
      mimeType: contentType,
      sizeBytes: file.size,
    });
  } catch (err) {
    console.error('board document upload error', err);
    const message = err instanceof Error ? err.message : 'Failed to upload board document';
    if (message.toLowerCase().includes('missing supabase service env')) {
      return NextResponse.json({ error: `${message}. Ustaw wymagane zmienne w .env.local i zrestartuj serwer.` }, { status: 500 });
    }
    if (message.toLowerCase().includes('bucket') && message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: `Bucket storage nie istnieje: ${process.env.SUPABASE_STORAGE_BUCKET || 'travel-documents'}. Utwórz bucket lub popraw SUPABASE_STORAGE_BUCKET.` }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to upload board document' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { boardId } = await context.params;
  if (!boardId) return NextResponse.json({ error: 'Missing board id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const filePath = typeof (body as { filePath?: unknown })?.filePath === 'string'
    ? (body as { filePath: string }).filePath.trim()
    : '';

  if (!filePath) {
    return NextResponse.json({ error: 'Missing filePath' }, { status: 400 });
  }

  try {
    const access = await getBoardAccessForUser(userId, boardId);
    if (!access) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!access.isMember || !access.canModerate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (access.isArchived) {
      return NextResponse.json({ error: 'Archived board is read-only' }, { status: 409 });
    }

    const expectedPrefix = `boards/${access.groupId}/${access.boardId}/`;
    if (!filePath.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Invalid file path for this board' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'travel-documents';
    const removeResult = await supabase.storage.from(bucket).remove([filePath]);

    if (removeResult.error) {
      console.error('document delete error', removeResult.error);
      return NextResponse.json({ error: 'Failed to delete cloud file' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('board document delete error', err);
    const message = err instanceof Error ? err.message : 'Failed to delete board document';
    if (message.toLowerCase().includes('missing supabase service env')) {
      return NextResponse.json({ error: `${message}. Ustaw wymagane zmienne w .env.local i zrestartuj serwer.` }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to delete board document' }, { status: 500 });
  }
}
