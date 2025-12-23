import { useState, useRef, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const COLORS = [
  '262 80% 50%', // purple
  '220 70% 50%', // blue
  '142 70% 45%', // green
  '38 92% 50%',  // orange
  '0 84% 60%',   // red
  '280 65% 60%', // violet
  '190 80% 42%', // cyan
  '340 75% 55%', // pink
];

interface InlineSubtaskCreatorProps {
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
}

export function InlineSubtaskCreator({ onSave, onCancel }: InlineSubtaskCreatorProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), color);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 pl-12 bg-accent/20 border-b border-border">
      <div className="flex items-center gap-1 flex-shrink-0">
        <div className="w-4 h-4" />
        <div className="w-4 h-4" />
      </div>

      <div className="flex items-center gap-2 min-w-[120px] flex-1">
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="w-4 h-4 rounded-full flex-shrink-0 hover:ring-2 hover:ring-offset-1 hover:ring-primary/50 transition-all"
              style={{ backgroundColor: `hsl(${color})` }}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 bg-popover border border-border shadow-lg z-[100]" align="start">
            <div className="grid grid-cols-4 gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className="w-6 h-6 rounded-full hover:ring-2 hover:ring-offset-1 hover:ring-primary/50 transition-all"
                  style={{ backgroundColor: `hsl(${c})` }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nome da sub-tarefa..."
          className="h-7 text-sm flex-1 bg-background"
        />
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6"
          onClick={handleSave}
          disabled={!name.trim()}
        >
          <Check className="w-4 h-4 text-green-500" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6"
          onClick={onCancel}
        >
          <X className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
