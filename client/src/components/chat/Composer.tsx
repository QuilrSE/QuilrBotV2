import { useEffect, useRef } from 'react';
import { ArrowUp, Square, Trash2 } from 'lucide-react';
import { Button, IconButton } from '../ui';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (draft: string) => void;
  onClear: () => void;
  onCancel: () => void;
  isBusy: boolean;
  canClear: boolean;
}

export function Composer({ value, onChange, onSend, onClear, onCancel, isBusy, canClear }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Grow with content up to a cap, so long red-team prompts stay readable.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  function send() {
    if (!value.trim() || isBusy) return;
    onSend(value);
    onChange('');
  }

  return (
    <div className="q-composer">
      <div className="q-composer__box">
        <textarea
          ref={ref}
          rows={2}
          value={value}
          aria-label="Message"
          placeholder="Ask anything, or paste a prompt to test"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="q-composer__row">
          <span className="q-composer__hint">Ctrl/Cmd + Enter to send</span>
          <IconButton label="Clear this conversation" tone="danger" onClick={onClear} disabled={isBusy || !canClear}>
            <Trash2 size={15} strokeWidth={1.75} />
          </IconButton>
          {isBusy ? (
            <Button variant="danger" onClick={onCancel} iconLeft={<Square size={13} strokeWidth={2.25} />}>
              Stop
            </Button>
          ) : (
            <Button onClick={send} disabled={!value.trim()} iconRight={<ArrowUp size={15} strokeWidth={2.25} />}>
              Send
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
