"use client";

/**
 * Skeleton loading components for stats, cards, and list rows.
 * Used across portal and admin pages to prevent "0 then real value" flicker.
 */

export function StatSkeleton({ count = 6, cols = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" }: { count?: number; cols?: string }) {
  return (
    <div className={`grid gap-2 ${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-white/5" />
            <div className="h-2 w-16 rounded bg-white/5" />
          </div>
          <div className="mt-2 h-6 w-12 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white/5" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 rounded bg-white/5" />
              <div className="h-2.5 w-48 rounded bg-white/[0.03]" />
            </div>
          </div>
          <div className="mt-3 flex gap-4">
            <div className="h-2 w-16 rounded bg-white/[0.03]" />
            <div className="h-2 w-12 rounded bg-white/[0.03]" />
            <div className="h-2 w-20 rounded bg-white/[0.03]" />
          </div>
          <div className="mt-2.5 flex gap-1">
            <div className="h-4 w-14 rounded-full bg-white/[0.03]" />
            <div className="h-4 w-12 rounded-full bg-white/[0.03]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="h-9 w-9 rounded-lg bg-white/5" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-28 rounded bg-white/5" />
            <div className="h-2.5 w-48 rounded bg-white/[0.03]" />
          </div>
          <div className="space-y-1 text-right">
            <div className="h-3.5 w-14 rounded bg-white/5" />
            <div className="h-2 w-16 rounded bg-white/[0.03]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CheckCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-white/5" />
              <div className="space-y-1">
                <div className="h-3 w-24 rounded bg-white/5" />
                <div className="h-2 w-32 rounded bg-white/[0.03]" />
              </div>
            </div>
            <div className="h-5 w-12 rounded-full bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-6 w-48 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-24 animate-pulse rounded bg-white/[0.03]" />
        </div>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-white/5" />
      </div>
      {/* Stats */}
      <StatSkeleton />
      {/* Section title */}
      <div className="mt-2 h-3 w-28 animate-pulse rounded bg-white/[0.03]" />
      {/* Project cards */}
      <CardSkeleton />
    </div>
  );
}
