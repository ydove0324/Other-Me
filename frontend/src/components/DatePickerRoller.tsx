import { useEffect, useRef, useState } from 'react';

interface DatePickerRollerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - 60 + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function parseDate(v: string): { year: number; month: number; day: number } {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return { year: CURRENT_YEAR, month: 6, day: 15 };
  }
  const [y, m, d] = v.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function formatDate(year: number, month: number, day: number): string {
  const d = Math.min(day, new Date(year, month, 0).getDate());
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function RollerColumn<T extends number | string>({
  items,
  value,
  onChange,
  label,
  format,
}: {
  items: T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  format: (v: T) => string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 40;
  const visibleCount = 5;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = items.indexOf(value);
    if (idx >= 0) {
      el.scrollTop = idx * itemHeight - (visibleCount / 2 - 0.5) * itemHeight;
    }
  }, [items, value]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / itemHeight + (visibleCount / 2 - 0.5));
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    const newVal = items[clamped];
    if (newVal !== value) onChange(newVal);
  };

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="text-center text-xs text-monet-haze mb-1 font-serif">{label}</div>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="overflow-y-auto overscroll-contain scrollbar-hide h-[200px] snap-y snap-mandatory flex flex-col"
        style={{
          scrollSnapType: 'y mandatory',
          scrollPadding: `${(visibleCount / 2 - 0.5) * itemHeight}px 0`,
        }}
      >
        {Array.from({ length: Math.floor(visibleCount / 2) }).map((_, i) => (
          <div key={`pad-top-${i}`} style={{ height: itemHeight, scrollSnapAlign: 'start' }} />
        ))}
        {items.map((item) => (
          <button
            key={String(item)}
            type="button"
            onClick={() => onChange(item)}
            className={`shrink-0 flex items-center justify-center font-serif transition-colors ${value === item ? 'text-monet-leaf font-semibold' : 'text-monet-haze/70'}`}
            style={{ height: itemHeight, scrollSnapAlign: 'start' }}
          >
            {format(item)}
          </button>
        ))}
        {Array.from({ length: Math.floor(visibleCount / 2) }).map((_, i) => (
          <div key={`pad-bot-${i}`} style={{ height: itemHeight, scrollSnapAlign: 'start' }} />
        ))}
      </div>
    </div>
  );
}

export default function DatePickerRoller({ value, onChange, className = '' }: DatePickerRollerProps) {
  const parsed = parseDate(value);
  const [year, setYear] = useState(parsed.year);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay] = useState(parsed.day);
  useEffect(() => {
    const p = parseDate(value);
    setYear(p.year);
    setMonth(p.month);
    setDay(p.day);
  }, [value]);

  const commit = (y: number, m: number, d: number) => {
    const maxDay = new Date(y, m, 0).getDate();
    const clampedDay = Math.min(d, maxDay);
    onChange(formatDate(y, m, clampedDay));
  };

  const handleYear = (y: number) => {
    setYear(y);
    const maxDay = new Date(y, month, 0).getDate();
    const d = Math.min(day, maxDay);
    setDay(d);
    commit(y, month, d);
  };

  const handleMonth = (m: number) => {
    setMonth(m);
    const maxDay = new Date(year, m, 0).getDate();
    const d = Math.min(day, maxDay);
    setDay(d);
    commit(year, m, d);
  };

  const handleDay = (d: number) => {
    setDay(d);
    commit(year, month, d);
  };

  return (
    <div
      className={`grid grid-cols-3 gap-2 p-3 border border-monet-haze/40 rounded-2xl bg-white/60 ${className}`}
    >
      <RollerColumn
        items={YEARS}
        value={year}
        onChange={handleYear}
        label="年"
        format={(v) => `${v}`}
      />
      <RollerColumn
        items={MONTHS}
        value={month}
        onChange={handleMonth}
        label="月"
        format={(v) => `${v} 月`}
      />
      <RollerColumn
        items={Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1)}
        value={day}
        onChange={handleDay}
        label="日"
        format={(v) => `${v} 日`}
      />
    </div>
  );
}
