/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  url: string;
  selector?: string;
  searchText?: string;
}

export class DOMCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxAge: number;
  private maxEntries: number;

  constructor(maxAgeSeconds: number = 60, maxEntries: number = 100) {
    this.maxAge = maxAgeSeconds * 1000;
    this.maxEntries = maxEntries;
  }

  private generateKey(url: string, params: { selector?: string, searchText?: string, offset?: number, limit?: number }): string {
    return `${url}:${params.selector || ''}:${params.searchText || ''}:${params.offset || 0}:${params.limit || 20}`;
  }

  get(url: string, params: { selector?: string, searchText?: string, offset?: number, limit?: number }): any | null {
    const key = this.generateKey(url, params);
    const entry = this.cache.get(key);

    if (!entry)
      return null;


    const now = Date.now();
    if (now - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(url: string, params: { selector?: string, searchText?: string, offset?: number, limit?: number }, data: any): void {
    const key = this.generateKey(url, params);

    // Enforce max entries limit
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const oldestKey = this.findOldestEntry();
      if (oldestKey)
        this.cache.delete(oldestKey);

    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      url,
      selector: params.selector,
      searchText: params.searchText,
    });
  }

  private findOldestEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  invalidate(url?: string): void {
    if (url) {
      // Invalidate all entries for a specific URL
      const keysToDelete: string[] = [];
      for (const [key, entry] of this.cache.entries()) {
        if (entry.url === url)
          keysToDelete.push(key);

      }
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      // Clear entire cache
      this.cache.clear();
    }
  }

  invalidateOlderThan(ageSeconds: number): void {
    const now = Date.now();
    const maxAge = ageSeconds * 1000;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > maxAge)
        keysToDelete.push(key);

    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instance
export const domCache = new DOMCache();
