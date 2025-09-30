// features/canvas/stores/modules/history/memoryManager.ts
// Memory management functions for history module
// Extracted from historyModule.ts lines 24-104

import type { HistoryEntry } from './types';

/**
 * Prune history entries intelligently based on entry count and memory usage limits
 * 
 * Strategy:
 * 1. Keep 70% of entries for undo (past) and 30% for redo (future)
 * 2. Remove oldest past entries first
 * 3. If still over memory limit, remove largest entries (except last 5)
 * 
 * @param entries - Current history entries
 * @param currentIndex - Current position in history
 * @param maxEntries - Maximum number of entries to keep
 * @param maxMemoryBytes - Maximum memory usage in bytes
 * @returns Pruned entries, new index, and count of pruned entries
 */
export function pruneHistoryEntries(
  entries: HistoryEntry[],
  currentIndex: number,
  maxEntries: number,
  maxMemoryBytes: number
): { entries: HistoryEntry[]; newIndex: number; pruned: number } {
  if (entries.length <= maxEntries) {
    // Check memory usage
    const totalMemory = entries.reduce((sum, entry) => sum + (entry.estimatedSize || 0), 0);
    if (totalMemory <= maxMemoryBytes) {
      return { entries, newIndex: currentIndex, pruned: 0 };
    }
  }

  // Split entries into undo (past) and redo (future)
  const pastEntries = entries.slice(0, currentIndex + 1);
  const futureEntries = entries.slice(currentIndex + 1);
  
  // Prioritize keeping recent entries and current position context
  const keepRecentCount = Math.min(maxEntries * 0.7, pastEntries.length); // Keep 70% for past
  const keepFutureCount = Math.min(maxEntries * 0.3, futureEntries.length); // Keep 30% for future
  
  let prunedPast = pastEntries;
  let prunedFuture = futureEntries;
  let pruned = 0;
  
  // Prune oldest past entries first
  if (pastEntries.length > keepRecentCount) {
    const removeCount = pastEntries.length - keepRecentCount;
    prunedPast = pastEntries.slice(removeCount);
    pruned += removeCount;
  }
  
  // Prune future entries if needed
  if (futureEntries.length > keepFutureCount) {
    const removeCount = futureEntries.length - keepFutureCount;
    prunedFuture = futureEntries.slice(0, keepFutureCount);
    pruned += removeCount;
  }
  
  // If still over memory limit, prune more aggressively by size
  const newEntries = [...prunedPast, ...prunedFuture];
  let totalMemory = newEntries.reduce((sum, entry) => sum + (entry.estimatedSize || 0), 0);
  
  if (totalMemory > maxMemoryBytes && newEntries.length > 10) {
    // Find largest entries and remove them (except very recent ones)
    const sortedBySize = newEntries
      .map((entry, index) => ({ entry, index, size: entry.estimatedSize || 0 }))
      .sort((a, b) => b.size - a.size);
    
    // Don't remove the last 5 entries to preserve recent context
    const removableEntries = sortedBySize.filter(item => 
      item.index < newEntries.length - 5
    );
    
    for (const item of removableEntries) {
      if (totalMemory <= maxMemoryBytes) break;
      
      const entryIndex = newEntries.indexOf(item.entry);
      if (entryIndex >= 0) {
        newEntries.splice(entryIndex, 1);
        totalMemory -= item.size;
        pruned++;
      }
    }
  }
  
  // Recalculate index after pruning
  const newIndex = Math.max(-1, Math.min(newEntries.length - 1, prunedPast.length - 1));
  
  return { entries: newEntries, newIndex, pruned };
}

/**
 * Calculate total memory usage of history entries
 * 
 * @param entries - History entries to calculate memory for
 * @returns Object with entry count and estimated memory in MB
 */
export function calculateMemoryUsage(entries: HistoryEntry[]): {
  entriesCount: number;
  estimatedMB: number;
} {
  const totalBytes = entries.reduce((sum: number, entry: HistoryEntry) => sum + (entry.estimatedSize || 0), 0);
  return {
    entriesCount: entries.length,
    estimatedMB: totalBytes / (1024 * 1024)
  };
}

/**
 * Check if history should be pruned based on thresholds
 * 
 * @param entriesCount - Current number of entries
 * @param currentMemoryBytes - Current memory usage in bytes
 * @param maxEntries - Maximum allowed entries
 * @param maxMemoryBytes - Maximum allowed memory in bytes
 * @param pruneThreshold - Threshold percentage (0-1) to trigger pruning
 * @returns True if pruning should be performed
 */
export function shouldPruneHistory(
  entriesCount: number,
  currentMemoryBytes: number,
  maxEntries: number,
  maxMemoryBytes: number,
  pruneThreshold: number
): boolean {
  return entriesCount > maxEntries * pruneThreshold || 
         currentMemoryBytes > maxMemoryBytes * pruneThreshold;
}
