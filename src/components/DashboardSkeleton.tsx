import React from 'react';

interface DashboardSkeletonProps {
  currentTab: string;
  isHe: boolean;
  darkMode?: boolean;
}

export default function DashboardSkeleton({ currentTab, isHe, darkMode }: DashboardSkeletonProps) {
  // Title & description skeleton matches the text structures of active tabs
  const renderHeaderSkeleton = () => {
    return (
      <div className="space-y-2 animate-pulse mb-6">
        <div className="h-6 w-48 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3.5 w-96 rounded bg-slate-100 dark:bg-slate-800/60" />
      </div>
    );
  };

  const renderDispatchSkeleton = () => {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Filters/Toolbar Skeleton */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/40 p-3 shadow-sm">
          <div className="h-9 w-full sm:w-64 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-9 w-32 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
          <div className="h-9 w-36 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
          <div className="h-9 w-32 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
          <div className="h-9 w-24 rounded-lg bg-slate-100 dark:bg-slate-800/60 sm:ml-auto" />
        </div>

        {/* Action Bar/Status Summary Skeleton */}
        <div className="flex items-center justify-between py-1">
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-8 w-44 rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>

        {/* Table Mock Skeleton */}
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          {/* Table Header */}
          <div className="grid grid-cols-7 gap-4 bg-slate-50 dark:bg-slate-950 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="h-4 rounded bg-slate-200 dark:bg-slate-800 col-span-1" />
            <div className="h-4 rounded bg-slate-200 dark:bg-slate-800 col-span-1" />
            <div className="h-4 rounded bg-slate-200 dark:bg-slate-800 col-span-1" />
            <div className="h-4 rounded bg-slate-200 dark:bg-slate-800 col-span-1" />
            <div className="h-4 rounded bg-slate-200 dark:bg-slate-800 col-span-1" />
            <div className="h-4 rounded bg-slate-200 dark:bg-slate-800 col-span-1" />
            <div className="h-4 rounded bg-slate-200 dark:bg-slate-800 col-span-1" />
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="grid grid-cols-7 gap-4 px-6 py-4 items-center">
                <div className="h-5 rounded bg-slate-150 dark:bg-slate-800/80 col-span-1" />
                <div className="space-y-1 col-span-1">
                  <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-850" />
                  <div className="h-3 w-1/2 rounded bg-slate-50 dark:bg-slate-850/40" />
                </div>
                <div className="h-4 w-2/3 rounded bg-slate-100 dark:bg-slate-850 col-span-1" />
                <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-800 col-span-1" />
                <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-850 col-span-1" />
                <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-slate-850 col-span-1" />
                <div className="flex items-center gap-2 col-span-1 justify-end">
                  <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800" />
                  <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination Skeleton */}
        <div className="flex items-center justify-between px-2 pt-2">
          <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="flex gap-1">
            <div className="h-8 w-16 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-8 w-8 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-8 w-16 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      </div>
    );
  };

  const renderAnalyticsSkeleton = () => {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Quick analytics stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-7 w-1/2 rounded bg-slate-300 dark:bg-slate-700" />
              <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800/60" />
            </div>
          ))}
        </div>

        {/* Large Chart Area Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart Card 1 */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-6 w-24 rounded bg-slate-100 dark:bg-slate-800/60" />
            </div>
            <div className="h-64 rounded-lg bg-slate-50 dark:bg-slate-950/60 flex items-end justify-between px-6 pb-4">
              {[60, 80, 45, 90, 30, 75, 55, 85, 40, 65].map((h, i) => (
                <div key={i} className="w-6 rounded-t bg-slate-200 dark:bg-slate-800/80" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>

          {/* Chart Card 2 */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-6 w-24 rounded bg-slate-100 dark:bg-slate-800/60" />
            </div>
            <div className="h-64 rounded-lg bg-slate-50 dark:bg-slate-950/60 flex items-center justify-center p-8">
              {/* Donut Chart Skeleton */}
              <div className="relative h-44 w-44 rounded-full border-[18px] border-slate-200 dark:border-slate-800 flex items-center justify-center">
                <div className="space-y-1 text-center">
                  <div className="h-4 w-16 mx-auto rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-10 mx-auto rounded bg-slate-100 dark:bg-slate-800/60" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMapSkeleton = () => {
    return (
      <div className="space-y-4 animate-pulse h-full flex flex-col min-h-[450px]">
        {/* Map toolbar */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/40 p-3">
          <div className="h-8 w-32 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-8 w-24 rounded bg-slate-100 dark:bg-slate-800/60" />
          <div className="h-8 w-28 rounded bg-slate-100 dark:bg-slate-800/60 ml-auto" />
        </div>

        {/* Map Canvas placeholder */}
        <div className="flex-1 min-h-[400px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
          {/* Subtle grid pattern simulation */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{
            backgroundImage: `radial-gradient(#000 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }} />
          <div className="h-12 w-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <div className="space-y-1 text-center">
            <div className="h-4 w-32 mx-auto rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-48 mx-auto rounded bg-slate-100 dark:bg-slate-800/60" />
          </div>
        </div>
      </div>
    );
  };

  const renderAiChatSkeleton = () => {
    return (
      <div className="space-y-4 animate-pulse h-[calc(100vh-16rem)] flex flex-col">
        {/* Chat message flow skeleton */}
        <div className="flex-1 space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          {/* Agent bubble left */}
          <div className="flex items-start gap-3 max-w-[70%]">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-8 rounded-2xl bg-slate-100 dark:bg-slate-850 rounded-tl-none px-4" />
              <div className="h-4 w-2/3 rounded-2xl bg-slate-100 dark:bg-slate-850" />
            </div>
          </div>

          {/* User bubble right */}
          <div className="flex items-start gap-3 max-w-[70%] ml-auto justify-end">
            <div className="space-y-2 text-right">
              <div className="h-8 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 rounded-tr-none px-4" />
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
          </div>

          {/* Agent bubble left */}
          <div className="flex items-start gap-3 max-w-[80%]">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-850 rounded-tl-none" />
            </div>
          </div>
        </div>

        {/* Input box placeholder */}
        <div className="h-14 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center px-4 gap-3">
          <div className="h-6 w-6 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 flex-1 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-8 w-20 rounded-lg bg-blue-500/40 dark:bg-blue-500/30" />
        </div>
      </div>
    );
  };

  const renderReportSkeleton = () => {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Report configuration panel */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="h-4 w-1/4 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        </div>

        {/* Document block skeleton */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="h-5 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-8 w-28 rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-850" />
            <div className="h-4 w-5/6 rounded bg-slate-100 dark:bg-slate-850" />
            <div className="h-4 w-4/5 rounded bg-slate-100 dark:bg-slate-850" />
            <div className="h-4 w-11/12 rounded bg-slate-100 dark:bg-slate-850" />
            <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-850" />
          </div>
        </div>
      </div>
    );
  };

  const renderHistorySkeleton = () => {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Search bar and clear */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/40 p-3">
          <div className="h-9 w-64 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-9 w-32 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
        </div>

        {/* Audit Log Timeline */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6 relative">
          {/* Vertical timeline line */}
          <div className="absolute top-8 bottom-8 left-[31px] md:left-[39px] w-0.5 border-r border-dashed border-slate-200 dark:border-slate-800" />

          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 relative items-start">
              {/* Timeline bullet */}
              <div className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-center shrink-0 z-10">
                <div className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>

              {/* Log body content */}
              <div className="flex-1 space-y-2 bg-slate-50/50 dark:bg-slate-950/20 p-3 rounded-lg border border-slate-100 dark:border-slate-850">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-16 rounded bg-slate-100 dark:bg-slate-800/60" />
                </div>
                <div className="h-3 w-5/6 rounded bg-slate-150 dark:bg-slate-850" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderActiveTabSkeleton = () => {
    switch (currentTab) {
      case 'dispatch':
        return renderDispatchSkeleton();
      case 'analytics':
        return renderAnalyticsSkeleton();
      case 'map':
        return renderMapSkeleton();
      case 'noa-ai':
        return renderAiChatSkeleton();
      case 'morning-report':
        return renderReportSkeleton();
      case 'order-history':
        return renderHistorySkeleton();
      default:
        return renderDispatchSkeleton();
    }
  };

  return (
    <div className="w-full">
      {renderHeaderSkeleton()}
      {renderActiveTabSkeleton()}
    </div>
  );
}
