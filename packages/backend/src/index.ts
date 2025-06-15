// packages/backend/src/index.ts

import type { DefineAPI, DefineEvents, SDK } from "caido:plugin";

// 1) Define your set of allowed colours
const COLOURS = [
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Grey",
] as const;
export type HighlightColour = (typeof COLOURS)[number];

// 2) RPC methods that frontend can call
export type API = DefineAPI<{
  /**
   * Frontend passes request details and a colour label directly;
   * backend will store the pattern without needing to fetch the request.
   */
  addHighlightRule(
    requestId: string,
    method: string,
    host: string,
    path: string,
    colour: HighlightColour
  ): Promise<void>;
}>;

// 3) Events you emit to the frontend
type Events = DefineEvents<{
  /** Notify frontend that requests matched and should be colored (batched) */
  "requests-matched": (
    matches: Array<{
      id: string;
      colour: HighlightColour;
      findingId: string;
    }>
  ) => void;
}>;

/**
 * Plugin entrypoint. Caido calls this on load.
 */
export async function init(sdk: SDK<API, Events>): Promise<void> {
  try {
    // Open (or create) the plugin's SQLite table for request colors
    const db = await sdk.meta.db();

    await db.exec(`
      CREATE TABLE IF NOT EXISTS highlights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        host TEXT NOT NULL,
        path TEXT NOT NULL,
        colour TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for faster lookups
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_highlights_method ON highlights(method);
      CREATE INDEX IF NOT EXISTS idx_highlights_host ON highlights(host);
      CREATE INDEX IF NOT EXISTS idx_highlights_path ON highlights(path);
    `);

    // Cache for highlight rules - load once and update when needed
    let highlightRules: Array<{
      method: string;
      host: string;
      path: string;
      colour: HighlightColour;
    }> = [];

    // Function to reload rules from database
    const reloadHighlightRules = async () => {
      try {
        const stmt = await db.prepare(
          "SELECT method, host, path, colour FROM highlights"
        );
        highlightRules = (await stmt.all()) as Array<{
          method: string;
          host: string;
          path: string;
          colour: HighlightColour;
        }>;
      } catch (error) {
        // Silent error handling
        highlightRules = [];
      }
    };

    // Load rules initially
    await reloadHighlightRules();

    // — Real-time matching for every new proxied request
    sdk.events.onInterceptRequest(async (_sdk: any, request: any) => {
      try {
        const method = request.getMethod();
        const host = request.getHost();
        const path = request.getPath();

        // Use cached rules instead of querying database every time
        for (const rule of highlightRules) {
          const methodMatches = method.includes(rule.method);
          const hostMatches = host.includes(rule.host);
          const pathMatches = path.includes(rule.path);

          if (methodMatches && hostMatches && pathMatches) {
            // Send single match to frontend for coloring
            sdk.api.send("requests-matched", [
              {
                id: request.getId(),
                colour: rule.colour,
                findingId: "auto-color",
              },
            ]);

            // Break after first match to avoid duplicate coloring
            break;
          }
        }
      } catch (error) {
        // Silent error handling
      }
    });

    // — RPC handler: frontend calls this to add a new coloring rule
    sdk.api.register(
      "addHighlightRule",
      async (
        _sdk: any,
        requestId: string,
        method: string,
        host: string,
        path: string,
        colour: HighlightColour
      ) => {
        try {
          // 1) Store the coloring rule in database using provided details
          const stmt = await db.prepare(
            "INSERT INTO highlights(method, host, path, colour) VALUES(?, ?, ?, ?)"
          );
          await stmt.run(method, host, path, colour);

          // 2) Reload rules cache after adding new rule
          await reloadHighlightRules();

          // 3) Color the original request
          sdk.api.send("requests-matched", [
            {
              id: requestId,
              colour: colour,
              findingId: "rule-added",
            },
          ]);

          // 4) Find and color all existing matching requests using proper pagination
          const httpqlFilter = `req.method.cont:"${method}" AND req.host.cont:"${host}" AND req.path.cont:"${path}"`;

          await processMatchingRequestsInBatches(
            _sdk,
            httpqlFilter,
            colour,
            requestId,
            sdk
          );
        } catch (error) {
          throw error;
        }
      }
    );
  } catch (error) {
    // Silent error handling
  }
}

/**
 * Process matching requests in batches using proper pagination with cursors
 */
async function processMatchingRequestsInBatches(
  _sdk: any,
  httpqlFilter: string,
  colour: HighlightColour,
  originalRequestId: string,
  sdk: SDK<API, Events>
): Promise<void> {
  const BATCH_SIZE = 1000;
  const COLORIZE_BATCH_SIZE = 50; // Send colorization requests in smaller batches
  let cursor: string | undefined = undefined;
  let totalProcessed = 0;
  let colorizeQueue: Array<{
    id: string;
    colour: HighlightColour;
    findingId: string;
  }> = [];

  try {
    do {
      // Build query with cursor for pagination
      let query = _sdk.requests.query().filter(httpqlFilter).first(BATCH_SIZE);

      if (cursor) {
        query = query.after(cursor);
      }

      const connection = await query.execute();

      if (!connection.items || connection.items.length === 0) {
        break;
      }

      // Process this batch
      for (const item of connection.items) {
        const candidateRequest = item.request;

        // Skip the original request (already colored above)
        if (candidateRequest.getId() === originalRequestId) {
          continue;
        }

        // Add to colorize queue
        colorizeQueue.push({
          id: candidateRequest.getId(),
          colour: colour,
          findingId: "retroactive-match",
        });

        // Send colorization batch when queue is full
        if (colorizeQueue.length >= COLORIZE_BATCH_SIZE) {
          sdk.api.send("requests-matched", [...colorizeQueue]);
          colorizeQueue = [];
        }

        totalProcessed++;
      }

      // Update cursor for next iteration
      if (
        connection.pageInfo &&
        connection.pageInfo.hasNextPage &&
        connection.pageInfo.endCursor
      ) {
        cursor = connection.pageInfo.endCursor;
      } else {
        cursor = undefined; // No more pages
      }
    } while (cursor);

    // Send any remaining items in the colorize queue
    if (colorizeQueue.length > 0) {
      sdk.api.send("requests-matched", [...colorizeQueue]);
    }
  } catch (error) {
    // Silent error handling, but send any queued items
    if (colorizeQueue.length > 0) {
      sdk.api.send("requests-matched", [...colorizeQueue]);
    }
  }
}
