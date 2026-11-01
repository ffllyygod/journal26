'use client';

import { createClient } from './supabase/client';
import type { Attachment } from './types';

const INPUT_LIMIT = 10 * 1024 * 1024;
const OUTPUT_LIMIT = 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      blob =>
        blob ? resolve(blob) : reject(new Error('Could not prepare this image. Try a different file.')),
      'image/webp',
      quality,
    ),
  );
}

async function compressImage(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 50_000_000)
      throw new Error('Choose an image smaller than 50 megapixels.');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser cannot prepare this image. Try a different browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob = await toBlob(canvas, 0.82);
    if (blob.size > OUTPUT_LIMIT) blob = await toBlob(canvas, 0.6);
    if (blob.size > OUTPUT_LIMIT) blob = await toBlob(canvas, 0.4);
    if (blob.size > OUTPUT_LIMIT)
      throw new Error('This image is still too large after compression. Try a smaller screenshot.');
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadImage(file: File, demo: boolean, userId?: string): Promise<Attachment> {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Choose a JPEG, PNG, WebP, or GIF image.');
  if (file.size > INPUT_LIMIT) throw new Error('Choose an image under 10 MB.');
  if (!file.size) throw new Error('This file is empty. Choose another image.');
  if (!demo && !userId) throw new Error('Sign in before uploading an image.');
  const blob = await compressImage(file);
  const id = crypto.randomUUID();
  let path: string;
  if (demo) {
    path = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read this image.'));
      reader.readAsDataURL(blob);
    });
  } else {
    path = `${userId}/${id}.${blob.type === 'image/webp' ? 'webp' : 'png'}`;
    const { error } = await createClient()
      .storage.from('journal-images')
      .upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '3600' });
    if (error) throw new Error(`Upload failed: ${error.message}`);
  }
  return { id, name: file.name, path, mime: blob.type, size: blob.size };
}

export async function attachmentUrl(attachment: Attachment, demo: boolean): Promise<string> {
  if (demo) {
    if (!/^data:image\/(webp|png|jpeg);base64,/.test(attachment.path))
      throw new Error('Invalid local image.');
    return attachment.path;
  }
  const { data, error } = await createClient()
    .storage.from('journal-images')
    .createSignedUrl(attachment.path, 3600);
  if (error || !data?.signedUrl) throw new Error('Could not load this private image. Sign in and try again.');
  return data.signedUrl;
}
