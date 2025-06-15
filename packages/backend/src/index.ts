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
   * Frontend passes a request ID and a colour label;
   * backend will look up the actual Request and store the pattern.
   */
  addHighlightRule(requestId: string, colour: HighlightColour): Promise<void>;
}>;

// 3) Events you emit to the frontend
type Events = DefineEvents<{
  /** Notify frontend that a request matched and should be colored */
  "request-matched": (
    id: string,
    colour: HighlightColour,
    findingId: string
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

    // — Real-time matching for every new proxied request
    sdk.events.onInterceptRequest(async (_sdk: any, request: any) => {
      try {
        const method = request.getMethod();
        const host = request.getHost();
        const path = request.getPath();

        // Find all highlight rules and check if any match this request
        const stmt = await db.prepare(
          "SELECT method, host, path, colour FROM highlights"
        );
        const rules = (await stmt.all()) as Array<{
          method: string;
          host: string;
          path: string;
          colour: HighlightColour;
        }>;

        // Check each rule to see if this request matches
        for (const rule of rules) {
          const methodMatches = method.includes(rule.method);
          const hostMatches = host.includes(rule.host);
          const pathMatches = path.includes(rule.path);

          if (methodMatches && hostMatches && pathMatches) {
            // Send to frontend for coloring
            sdk.api.send(
              "request-matched",
              request.getId(),
              rule.colour,
              "auto-color"
            );

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
      async (_sdk: any, requestId: string, colour: HighlightColour) => {
        try {
          // 1) Get the request details
          const reqResponse = await _sdk.requests.get(requestId);
          if (!reqResponse || !reqResponse.request) {
            throw new Error(`Request ${requestId} not found`);
          }

          const req = reqResponse.request;
          const method = req.getMethod();
          const host = req.getHost();
          const path = req.getPath();

          // 2) Store the coloring rule in database
          const stmt = await db.prepare(
            "INSERT INTO highlights(method, host, path, colour) VALUES(?, ?, ?, ?)"
          );
          await stmt.run(method, host, path, colour);

          // 3) Color the original request
          sdk.api.send("request-matched", requestId, colour, "rule-added");

          // 4) Find and color all existing matching requests
          const httpqlFilter = `req.method.cont:"${method}" AND req.host.cont:"${host}" AND req.path.cont:"${path}"`;

          const requestsQuery = _sdk.requests
            .query()
            .filter(httpqlFilter)
            .first(100000);
          const connection = await requestsQuery.execute();

          let retroactiveCount = 0;
          for (const item of connection.items) {
            const candidateRequest = item.request;

            // Skip the original request (already colored above)
            if (candidateRequest.getId() === requestId) {
              continue;
            }

            retroactiveCount++;
            sdk.api.send(
              "request-matched",
              candidateRequest.getId(),
              colour,
              "retroactive-match"
            );
          }
        } catch (error) {
          throw error;
        }
      }
    );
  } catch (error) {
    // Silent error handling
  }
}
