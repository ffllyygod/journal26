'use client';

import { useEffect, useRef, useState } from 'react';
import type { Attachment } from '@/lib/types';
import { attachmentUrl, uploadImage } from '@/lib/storage';
import { Icon } from './ui';

function AttachmentImage({
  attachment,
  demo,
  onRemove,
  removingDisabled,
}: {
  attachment: Attachment;
  demo: boolean;
  onRemove: () => void;
  removingDisabled: boolean;
}) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    attachmentUrl(attachment, demo)
      .then(value => {
        if (alive) setUrl(value);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [attachment, demo]);
  return (
    <div className="attachment">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" title={`Open ${attachment.name}`}>
          {/* Private signed URLs and browser-local previews are intentionally rendered directly. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={attachment.name} loading="lazy" onError={() => setFailed(true)} />
        </a>
      ) : (
        <span className="attachment-loading">{failed ? 'Image unavailable' : 'Loading…'}</span>
      )}
      <span className="attachment-name">{attachment.name}</span>
      <button
        type="button"
        className="attachment-remove"
        onClick={onRemove}
        disabled={removingDisabled}
        aria-label={`Remove attachment ${attachment.name}`}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
export function AttachmentGallery({
  attachments,
  onChange,
  onAdd,
  onBusyChange,
  demo,
  userId,
}: {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  onAdd?: (attachment: Attachment) => void;
  onBusyChange?: (busy: boolean) => void;
  demo: boolean;
  userId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const current = useRef(attachments);
  useEffect(() => {
    current.current = attachments;
  }, [attachments]);
  async function add(files: FileList | null) {
    if (!files?.length) return;
    if (current.current.length + files.length > 6) {
      setError('Keep up to 6 images per entry. Remove one before adding another.');
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    // The batch belongs to the record that started it, even if its page changes.
    let batch = [...current.current];
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadImage(file, demo, userId);
        batch = [...batch, result];
        if (onAdd) onAdd(result);
        else onChange(batch);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      window.removeEventListener('beforeunload', beforeUnload);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <div className="attachments-area">
      {attachments.length > 0 && (
        <div className="attachments-grid">
          {attachments.map(item => (
            <AttachmentImage
              key={item.id}
              attachment={item}
              demo={demo}
              onRemove={() => onChange(current.current.filter(a => a.id !== item.id))}
              removingDisabled={busy}
            />
          ))}
        </div>
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        ref={input}
        onChange={e => void add(e.target.files)}
      />
      <button
        type="button"
        className="button button-quiet button-small"
        onClick={() => input.current?.click()}
        disabled={busy || attachments.length >= 6}
      >
        <Icon name="image" size={15} />
        {busy ? 'Uploading image…' : 'Attach images'}
      </button>
      <span className="attachment-hint">JPG, PNG or WebP, up to 10 MB each</span>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
