import { HistoryItem } from './calcEngine';

export const HISTORY_ROW_HEIGHT = 56;
export const HISTORY_HEADER_HEIGHT = 28;

export type DateGroupTitle = 'Pinned' | 'Today' | 'Yesterday' | 'Earlier';

export interface MergedHistoryEntry {
  key: string;
  primary: HistoryItem;
  sourceIds: string[];
  count: number;
  pinned: boolean;
}

export type VirtualHistoryRow =
  | {
      kind: 'header';
      key: string;
      title: DateGroupTitle;
      groupCount: number;
      top: number;
      height: number;
    }
  | {
      kind: 'item';
      key: string;
      entry: MergedHistoryEntry;
      top: number;
      height: number;
    };

export interface VirtualHistoryLayout {
  rows: VirtualHistoryRow[];
  totalHeight: number;
  headerIndices: number[];
  mergedCount: number;
}

/**
 * Determine sticky section header label ('Today', 'Yesterday', 'Earlier') for a timestamp.
 */
export function getDateGroupLabel(timestamp: number, nowMs = Date.now()): 'Today' | 'Yesterday' | 'Earlier' {
  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  if (timestamp >= startOfToday) return 'Today';
  if (timestamp >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

/**
 * Format timestamp concisely for long-press menu and Full screen.
 */
export function formatHistoryTimestamp(timestamp: number, nowMs = Date.now()): string {
  const group = getDateGroupLabel(timestamp, nowMs);
  const d = new Date(timestamp);
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (group === 'Today') return `Today · ${timeStr}`;
  if (group === 'Yesterday') return `Yesterday · ${timeStr}`;
  const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateStr} · ${timeStr}`;
}

/**
 * Merge consecutive identical entries (same expression & result) into a single row with a `×N` badge.
 * Pinned status matches if both are pinned or both are unpinned so pinned items stay distinct.
 */
export function mergeConsecutiveHistory(items: HistoryItem[]): MergedHistoryEntry[] {
  const merged: MergedHistoryEntry[] = [];
  for (const item of items) {
    const itemCount = item.count && item.count > 1 ? item.count : 1;
    const isPinned = Boolean(item.pinned);
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.pinned === isPinned &&
      prev.primary.expression === item.expression &&
      prev.primary.result === item.result
    ) {
      prev.count += itemCount;
      prev.sourceIds.push(item.id);
      if (item.timestamp > prev.primary.timestamp) {
        prev.primary = item;
      }
    } else {
      merged.push({
        key: item.id,
        primary: item,
        sourceIds: [item.id],
        count: itemCount,
        pinned: isPinned,
      });
    }
  }
  return merged;
}

/**
 * Filter merged entries by search query (case-insensitive match on expression or result).
 */
export function filterMergedHistory(entries: MergedHistoryEntry[], query: string): MergedHistoryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (entry) =>
      entry.primary.expression.toLowerCase().includes(q) ||
      entry.primary.result.toLowerCase().includes(q)
  );
}

/**
 * Build flattened virtualized rows + cumulative top offsets + sticky header lookup indices.
 * - 'expanded': chronological under 'Today' | 'Yesterday' | 'Earlier'
 * - 'full': 'Pinned' section first (if any), then 'Today' | 'Yesterday' | 'Earlier'
 */
export function buildVirtualHistoryLayout(
  history: HistoryItem[],
  mode: 'expanded' | 'full',
  searchQuery = '',
  nowMs = Date.now()
): VirtualHistoryLayout {
  const allMerged = mergeConsecutiveHistory(history);
  const filtered = filterMergedHistory(allMerged, searchQuery);

  const rows: VirtualHistoryRow[] = [];
  const headerIndices: number[] = [];
  let cursorTop = 0;

  const pushGroup = (title: DateGroupTitle, entries: MergedHistoryEntry[]) => {
    if (entries.length === 0) return;
    headerIndices.push(rows.length);
    rows.push({
      kind: 'header',
      key: `hdr_${title}`,
      title,
      groupCount: entries.length,
      top: cursorTop,
      height: HISTORY_HEADER_HEIGHT,
    });
    cursorTop += HISTORY_HEADER_HEIGHT;

    for (const entry of entries) {
      rows.push({
        kind: 'item',
        key: `row_${title}_${entry.key}`,
        entry,
        top: cursorTop,
        height: HISTORY_ROW_HEIGHT,
      });
      cursorTop += HISTORY_ROW_HEIGHT;
    }
  };

  if (mode === 'full') {
    const pinnedEntries = filtered.filter((e) => e.pinned);
    const unpinnedEntries = filtered.filter((e) => !e.pinned);
    pushGroup('Pinned', pinnedEntries);

    const today: MergedHistoryEntry[] = [];
    const yesterday: MergedHistoryEntry[] = [];
    const earlier: MergedHistoryEntry[] = [];
    for (const e of unpinnedEntries) {
      const grp = getDateGroupLabel(e.primary.timestamp, nowMs);
      if (grp === 'Today') today.push(e);
      else if (grp === 'Yesterday') yesterday.push(e);
      else earlier.push(e);
    }
    pushGroup('Today', today);
    pushGroup('Yesterday', yesterday);
    pushGroup('Earlier', earlier);
  } else {
    const today: MergedHistoryEntry[] = [];
    const yesterday: MergedHistoryEntry[] = [];
    const earlier: MergedHistoryEntry[] = [];
    for (const e of filtered) {
      const grp = getDateGroupLabel(e.primary.timestamp, nowMs);
      if (grp === 'Today') today.push(e);
      else if (grp === 'Yesterday') yesterday.push(e);
      else earlier.push(e);
    }
    pushGroup('Today', today);
    pushGroup('Yesterday', yesterday);
    pushGroup('Earlier', earlier);
  }

  return {
    rows,
    totalHeight: cursorTop,
    headerIndices,
    mergedCount: filtered.length,
  };
}

/**
 * Binary-search visible row slice and active sticky header position in O(log N).
 */
export function computeVirtualSlice(
  layout: VirtualHistoryLayout,
  scrollTop: number,
  viewportHeight: number,
  overscan = 4
): {
  startIdx: number;
  endIdx: number;
  activeHeader: { title: DateGroupTitle; count: number; pushY: number } | null;
} {
  const { rows, headerIndices } = layout;
  if (rows.length === 0) {
    return { startIdx: 0, endIdx: -1, activeHeader: null };
  }

  const minTop = Math.max(0, scrollTop);
  const maxBottom = minTop + Math.max(HISTORY_ROW_HEIGHT, viewportHeight);

  // Binary search first row whose bottom > minTop
  let lo = 0;
  let hi = rows.length - 1;
  let firstVisible = rows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = rows[mid];
    if (r.top + r.height > minTop) {
      firstVisible = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  // Binary search last row whose top < maxBottom
  lo = firstVisible;
  hi = rows.length - 1;
  let lastVisible = firstVisible;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].top < maxBottom) {
      lastVisible = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const startIdx = Math.max(0, firstVisible - overscan);
  const endIdx = Math.min(rows.length - 1, lastVisible + overscan);

  // Find active sticky header (last header with top <= scrollTop)
  let activeHeader: { title: DateGroupTitle; count: number; pushY: number } | null = null;
  if (headerIndices.length > 0 && scrollTop >= 0) {
    let activeHdrPos = -1;
    let hLo = 0;
    let hHi = headerIndices.length - 1;
    while (hLo <= hHi) {
      const hMid = (hLo + hHi) >> 1;
      const row = rows[headerIndices[hMid]];
      if (row.top <= minTop + 1) {
        activeHdrPos = hMid;
        hLo = hMid + 1;
      } else {
        hHi = hMid - 1;
      }
    }

    if (activeHdrPos >= 0) {
      const activeHdrRow = rows[headerIndices[activeHdrPos]];
      if (activeHdrRow.kind === 'header') {
        let pushY = 0;
        if (activeHdrPos + 1 < headerIndices.length) {
          const nextHdrRow = rows[headerIndices[activeHdrPos + 1]];
          const distToNext = nextHdrRow.top - minTop;
          if (distToNext < HISTORY_HEADER_HEIGHT) {
            pushY = distToNext - HISTORY_HEADER_HEIGHT;
          }
        }
        activeHeader = {
          title: activeHdrRow.title,
          count: activeHdrRow.groupCount,
          pushY,
        };
      }
    }
  }

  return { startIdx, endIdx, activeHeader };
}
