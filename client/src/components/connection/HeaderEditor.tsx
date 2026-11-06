import { Plus, X } from 'lucide-react';
import type { HeaderEntry } from '../../types';
import { createId } from '../../utils/id';
import { Button, IconButton } from '../ui';

interface HeaderEditorProps {
  headers: HeaderEntry[];
  onChange: (headers: HeaderEntry[]) => void;
  disabled?: boolean;
}

/** Add/remove custom header rows, shared by the Provider and Gateway forms. */
export function HeaderEditor({ headers, onChange, disabled }: HeaderEditorProps) {
  const update = (id: string, patch: Partial<HeaderEntry>) => onChange(headers.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  return (
    <div className="q-headers">
      {headers.map((header) => (
        <div className={header.enabled ? 'q-headers__row' : 'q-headers__row q-headers__row--off'} key={header.id}>
          <input
            type="checkbox"
            aria-label={`Send ${header.name || 'this header'}`}
            title={header.enabled ? 'Sent with each request' : 'Not sent'}
            checked={header.enabled}
            disabled={disabled}
            onChange={(e) => update(header.id, { enabled: e.target.checked })}
          />
          <input
            type="text"
            aria-label="Header name"
            spellCheck={false}
            placeholder="x-customer-id"
            value={header.name}
            disabled={disabled}
            onChange={(e) => update(header.id, { name: e.target.value })}
          />
          <input
            type="text"
            aria-label="Header value"
            spellCheck={false}
            placeholder="value"
            value={header.value}
            disabled={disabled}
            onChange={(e) => update(header.id, { value: e.target.value })}
          />
          <IconButton label="Remove header" disabled={disabled} onClick={() => onChange(headers.filter((h) => h.id !== header.id))}>
            <X size={14} strokeWidth={1.75} />
          </IconButton>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        iconLeft={<Plus size={14} strokeWidth={2} />}
        onClick={() => onChange([...headers, { id: createId(), name: '', value: '', enabled: true }])}
      >
        Add header
      </Button>
    </div>
  );
}
