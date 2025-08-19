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
import { defineTool } from './tool.js';
import { domCache } from '../utils/domCache.js';

const clearCache = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_clear_cache',
    title: 'Clear DOM cache',
    description: 'Clear the DOM query cache',
    inputSchema: z.object({
      url: z.string().optional().describe('Clear cache for specific URL only'),
      olderThanSeconds: z.number().optional().describe('Clear entries older than specified seconds'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    if (params.olderThanSeconds) {
      domCache.invalidateOlderThan(params.olderThanSeconds);
      response.addResult(`Cleared cache entries older than ${params.olderThanSeconds} seconds`);
    } else if (params.url) {
      domCache.invalidate(params.url);
      response.addResult(`Cleared cache for URL: ${params.url}`);
    } else {
      domCache.invalidate();
      response.addResult('Cleared entire DOM cache');
    }

    response.addResult(`Current cache size: ${domCache.size()} entries`);
  },
});

const cacheStatus = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_cache_status',
    title: 'Get cache status',
    description: 'Get the current status of the DOM query cache',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    response.addResult(`DOM cache size: ${domCache.size()} entries`);
  },
});

export default [
  clearCache,
  cacheStatus,
];
