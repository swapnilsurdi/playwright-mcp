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

import { z } from 'zod';
import { defineTabTool } from './tool.js';
import { domCache } from '../utils/domCache.js';

const queryDom = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_query_dom',
    title: 'Query DOM',
    description: 'Query DOM elements by selector or semantic search with pagination support',
    inputSchema: z.object({
      selector: z.string().optional().describe('CSS selector to query elements'),
      searchText: z.string().optional().describe('Text to search for semantically in the DOM'),
      limit: z.number().optional().default(20).describe('Maximum number of elements to return (default: 20, max: 100)'),
      offset: z.number().optional().default(0).describe('Number of elements to skip for pagination'),
      includeAttributes: z.boolean().optional().default(true).describe('Include element attributes in response'),
      maxTextLength: z.number().optional().default(500).describe('Maximum text content length per element (default: 500)'),
      useCache: z.boolean().optional().default(true).describe('Use cached results if available (default: true)'),
      forceRefresh: z.boolean().optional().default(false).describe('Force refresh cache even if data exists (default: false)'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const limit = Math.min(params.limit || 20, 100);
    const offset = params.offset || 0;
    const maxTextLength = params.maxTextLength || 500;
    const currentUrl = tab.page.url();

    // Check cache first if enabled
    if (params.useCache && !params.forceRefresh) {
      const cached = domCache.get(currentUrl, {
        selector: params.selector,
        searchText: params.searchText,
        offset,
        limit
      });

      if (cached) {
        response.addResult(JSON.stringify(Object.assign({}, cached, {
          fromCache: true,
          cacheTimestamp: Date.now()
        }), null, 2));
        return;
      }
    }

    let javascript: string;

    if (params.selector) {
      javascript = `
        (() => {
          const elements = document.querySelectorAll('${params.selector}');
          const results = [];
          const totalCount = elements.length;
          
          for (let i = ${offset}; i < Math.min(elements.length, ${offset + limit}); i++) {
            const el = elements[i];
            const rect = el.getBoundingClientRect();
            
            const elementInfo = {
              index: i,
              tagName: el.tagName.toLowerCase(),
              textContent: (el.textContent || '').trim().slice(0, ${maxTextLength}),
              isVisible: rect.width > 0 && rect.height > 0 && 
                        rect.top < window.innerHeight && rect.bottom > 0 &&
                        rect.left < window.innerWidth && rect.right > 0,
              position: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
              }
            };
            
            if (${params.includeAttributes}) {
              elementInfo.attributes = {};
              for (const attr of el.attributes) {
                elementInfo.attributes[attr.name] = attr.value;
              }
            }
            
            // Generate a ref for this element for use with other tools
            if (!el.hasAttribute('data-mcp-ref')) {
              el.setAttribute('data-mcp-ref', 'query-' + i + '-' + Date.now());
            }
            elementInfo.ref = el.getAttribute('data-mcp-ref');
            
            results.push(elementInfo);
          }
          
          return {
            totalCount,
            offset: ${offset},
            limit: ${limit},
            returnedCount: results.length,
            hasMore: ${offset + limit} < totalCount,
            elements: results
          };
        })()
      `;
    } else if (params.searchText) {
      javascript = `
        (() => {
          const searchText = '${params.searchText.toLowerCase()}';
          const allElements = document.querySelectorAll('*');
          const matches = [];
          
          // Find all elements containing the search text
          for (const el of allElements) {
            const text = (el.textContent || '').toLowerCase();
            const tagName = el.tagName.toLowerCase();
            
            // Skip script and style elements
            if (tagName === 'script' || tagName === 'style') continue;
            
            // Check if element directly contains the text (not just in children)
            let directText = '';
            for (const node of el.childNodes) {
              if (node.nodeType === Node.TEXT_NODE) {
                directText += node.textContent;
              }
            }
            
            if (directText.toLowerCase().includes(searchText) || 
                (el.getAttribute && Array.from(el.attributes).some(attr => 
                  attr.value.toLowerCase().includes(searchText)))) {
              
              const rect = el.getBoundingClientRect();
              
              // Calculate relevance score
              let score = 0;
              const lowerText = directText.toLowerCase();
              
              // Exact match gets highest score
              if (lowerText === searchText) score += 100;
              // Starting with search text
              else if (lowerText.startsWith(searchText)) score += 50;
              // Word boundary match
              else if (new RegExp('\\\\b' + searchText + '\\\\b', 'i').test(directText)) score += 30;
              // Contains the text
              else if (lowerText.includes(searchText)) score += 10;
              
              // Bonus for visible elements
              if (rect.width > 0 && rect.height > 0) score += 5;
              
              // Bonus for semantic elements
              if (['h1','h2','h3','h4','h5','h6','button','a','label'].includes(tagName)) score += 10;
              
              matches.push({
                element: el,
                score: score,
                text: directText
              });
            }
          }
          
          // Sort by relevance score
          matches.sort((a, b) => b.score - a.score);
          
          // Paginate results
          const totalCount = matches.length;
          const paginatedMatches = matches.slice(${offset}, ${offset + limit});
          
          const results = paginatedMatches.map((match, idx) => {
            const el = match.element;
            const rect = el.getBoundingClientRect();
            
            const elementInfo = {
              index: ${offset} + idx,
              tagName: el.tagName.toLowerCase(),
              textContent: match.text.trim().slice(0, ${maxTextLength}),
              relevanceScore: match.score,
              isVisible: rect.width > 0 && rect.height > 0 && 
                        rect.top < window.innerHeight && rect.bottom > 0 &&
                        rect.left < window.innerWidth && rect.right > 0,
              position: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
              }
            };
            
            if (${params.includeAttributes}) {
              elementInfo.attributes = {};
              for (const attr of el.attributes) {
                elementInfo.attributes[attr.name] = attr.value;
              }
            }
            
            // Generate a ref for this element
            if (!el.hasAttribute('data-mcp-ref')) {
              el.setAttribute('data-mcp-ref', 'search-' + (${offset} + idx) + '-' + Date.now());
            }
            elementInfo.ref = el.getAttribute('data-mcp-ref');
            
            return elementInfo;
          });
          
          return {
            searchText: '${params.searchText}',
            totalCount,
            offset: ${offset},
            limit: ${limit},
            returnedCount: results.length,
            hasMore: ${offset + limit} < totalCount,
            elements: results
          };
        })()
      `;
    } else {
      throw new Error('Either selector or searchText must be provided');
    }

    await tab.waitForCompletion(async () => {
      const result = await tab.page.evaluate(javascript);

      // Cache the result
      if (params.useCache) {
        domCache.set(currentUrl, {
          selector: params.selector,
          searchText: params.searchText,
          offset,
          limit
        }, result);
      }

      response.addResult(JSON.stringify(Object.assign({}, result, {
        fromCache: false
      }), null, 2));
    });
  },
});

export default [
  queryDom,
];
