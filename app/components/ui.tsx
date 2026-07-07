"use client";

// Shared presentational bits for the tab components.

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function ExpiryBadge({ date }: { date: string | null }) {
  const d = daysUntil(date);
  if (d === null) return null;
  let cls = "bg-stone-100 text-stone-600";
  let text = `exp ${date}`;
  if (d < 0) {
    cls = "bg-terracotta-100 text-terracotta-700";
    text = "⚠ expired";
  } else if (d === 0) {
    cls = "bg-terracotta-100 text-terracotta-700";
    text = "⚠ today";
  } else if (d <= 7) {
    cls = "bg-amber-100 text-amber-800";
    text = `${d}d left`;
  }
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {text}
    </span>
  );
}

export function Chip({
  active,
  onClick,
  tone = "default",
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone?: "default" | "warn";
  children: React.ReactNode;
}) {
  const activeCls = tone === "warn" ? "bg-terracotta-600 text-white" : "bg-pine-600 text-white";
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
        active ? activeCls : "border border-stone-300 bg-white text-stone-600"
      }`}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  emoji,
  title,
  hint,
  children,
}: {
  emoji: string;
  title: string;
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-16 text-center text-stone-500">
      <p className="text-4xl">{emoji}</p>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm">{hint}</p>
      {children}
    </div>
  );
}

/**
 * Sticky app header: title row (name + per-tab subtitle + actions) with
 * optional per-tab controls below.
 */
export function HeaderShell({
  subtitle,
  actions,
  children,
}: {
  subtitle: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-cream/95 backdrop-blur">
      <div className="px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-xl font-bold tracking-tight text-pine-800">🥫 Pantry Keeper</h1>
          <div className="flex items-center gap-1">
            <span className="text-sm text-stone-500">{subtitle}</span>
            {actions}
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}

export function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

export function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function CartIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function BasketIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 11 4-7" />
      <path d="m19 11-4-7" />
      <path d="M2 11h20" />
      <path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.6-7.4" />
    </svg>
  );
}

export function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
