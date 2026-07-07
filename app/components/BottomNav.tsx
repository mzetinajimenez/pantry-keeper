"use client";

import { BasketIcon, BookIcon, CameraIcon, CartIcon } from "./ui";

export type Tab = "pantry" | "recipes" | "shopping";

type Props = {
  tab: Tab;
  onTab: (tab: Tab) => void;
  onScan: () => void;
  shoppingCount: number;
};

export default function BottomNav({ tab, onTab, onScan, shoppingCount }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/70 bg-cream/95 backdrop-blur">
      <div className="mx-auto grid max-w-2xl grid-cols-4 items-center px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1.5">
        <NavButton active={tab === "pantry"} onClick={() => onTab("pantry")} label="Pantry">
          <BasketIcon />
        </NavButton>
        <NavButton active={tab === "recipes"} onClick={() => onTab("recipes")} label="Recipes">
          <BookIcon />
        </NavButton>
        <div className="flex flex-col items-center">
          <button
            onClick={onScan}
            aria-label="Scan a barcode"
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-pine-600 text-white shadow-lg active:bg-pine-700"
          >
            <CameraIcon />
          </button>
          <span className="mt-0.5 text-[11px] font-medium text-pine-700">Scan</span>
        </div>
        <NavButton active={tab === "shopping"} onClick={() => onTab("shopping")} label="Shopping" badge={shoppingCount}>
          <CartIcon size={20} />
        </NavButton>
      </div>
    </nav>
  );
}

function NavButton({
  active,
  onClick,
  label,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex flex-col items-center gap-0.5 rounded-lg py-1.5 ${
        active ? "text-pine-700" : "text-stone-400"
      }`}
    >
      {children}
      <span className="text-[11px] font-medium">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-1/2 top-0 translate-x-4 rounded-full bg-terracotta-600 px-1.5 text-[10px] font-bold leading-4 text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
