'use client';

import { useEffect, useRef, useState } from 'react';
import type { Attachment } from '@/lib/types';
import { attachmentUrl, uploadImage } from '@/lib/storage';
import { Icon } from './ui';

function AttachmentImage({ attachment, demo, onRemove }: { attachment: Attachment; demo: boolean; onRemove: () => void }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    attachmentUrl(attachment, demo).then(value => { if (alive) setUrl(value); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [attachment, demo]);
  return <div className="attachment">
    {url ? <a href={url} target="_blank" rel="noreferrer" title={`Open ${attachment.name}`}>
      {/* Private signed URLs and browser-local previews are intentionally rendered directly. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={attachment.name} loading="lazy" onError={() => setFailed(true)}/>
    </a> : <span className="attachment-loading">{failed ? 'Image unavailable' : 'Loading…'}</span>}
    <span className="attachment-name">{attachment.name}</span>
    <button type="button" className="attachment-remove" onClick={onRemove} aria-label={`Remove attachment ${attachment.name}`}><Icon name="close" size={14}/></button>
  </div>;
}
export function AttachmentGallery({ attachments, onChange, demo, userId }: { attachments: Attachment[]; onChange: (attachments: Attachment[]) => void; demo: boolean; userId?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const current = useRef(attachments);
  current.current = attachments;
  async function add(files: FileList | null) {
    if (!files?.length) return;
    if (current.current.length + files.length > 6) { setError('Keep up to 6 images per entry. Remove one before adding another.'); return; }
    setBusy(true); setError('');
    try {
      for (const file of Array.from(files)) {
        const result = await uploadImage(file, demo, userId);
        const next = [...current.current, result];
        current.current = next;
        onChange(next);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed. Please try again.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  return <div className="attachments-area">
    {attachments.length > 0 && <div className="attachments-grid">{attachments.map(item => <AttachmentImage key={item.id} attachment={item} demo={demo} onRemove={() => onChange(current.current.filter(a => a.id !== item.id))}/>)}</div>}
    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden ref={input} onChange={e => void add(e.target.files)}/>
    <button type="button" className="button button-quiet button-small" onClick={() => input.current?.click()} disabled={busy || attachments.length >= 6}><Icon name="image" size={17}/>{busy ? 'Uploading image…' : 'Attach images'}</button>
    <span className="attachment-hint">JPG, PNG, WebP · up to 10 MB each</span>
    {error && <p className="error-message" role="alert">{error}</p>}
  </div>;
}
