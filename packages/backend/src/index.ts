import type { DefineAPI, SDK } from "caido:plugin";
import { Events, HighlightColour } from "./types";
export * from "./types";

export type API = DefineAPI<{
  /**
   * Frontend passes a request ID and a colour label;
   * backend will look up the actual Request and store the pattern.
   */
  addHighlightRule(requestId: string, colour: HighlightColour): Promise<void>;
}>;

/**
 * Plugin entrypoint. Caido calls this on load.
 */
export async function init(sdk: SDK<API, Events>): Promise<void> {
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

  await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_highlights_method ON highlights(method);
      CREATE INDEX IF NOT EXISTS idx_highlights_host ON highlights(host);
      CREATE INDEX IF NOT EXISTS idx_highlights_path ON highlights(path);
    `);

  // — Real-time matching for every new proxied request
  sdk.events.onInterceptRequest(async (_, request) => {
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

    const method = request.getMethod();
    const host = request.getHost();
    const path = request.getPath();

    // Check each rule to see if this request matches
    for (const rule of rules) {
      const methodMatches = method.includes(rule.method);
      const hostMatches = host.includes(rule.host);
      const pathMatches = path.includes(rule.path);

      if (methodMatches && hostMatches && pathMatches) {
        sdk.api.send("request-matched", [request.getId()], rule.colour);

        break;
      }
    }
  });

  // — RPC handler: frontend calls this to add a new coloring rule
  sdk.api.register("addHighlightRule", async (_, requestId, colour) => {
    const reqResponse = await sdk.requests.get(requestId);
    if (!reqResponse || !reqResponse.request) {
      throw new Error(`Request ${requestId} not found`);
    }

    const req = reqResponse.request;
    const method = req.getMethod();
    const host = req.getHost();
    const path = req.getPath();

    const stmt = await db.prepare(
      "INSERT INTO highlights(method, host, path, colour) VALUES(?, ?, ?, ?)"
    );
    await stmt.run(method, host, path, colour);

    sdk.api.send("request-matched", [requestId], colour);

    const httpqlFilter = `req.method.cont:"${method}" AND req.host.cont:"${host}" AND req.path.cont:"${path}"`;
    sdk.console.log("httpqlFilter: " + httpqlFilter);

    let hasNextPage = true;
    let after: string | undefined = undefined;
    const pageSize = 1000;
    const batchSize = 100;

    let currentBatch: string[] = [];

    sdk.console.log("Starting retroactive matching");
    while (hasNextPage) {
      const query = after
        ? sdk.requests.query().filter(httpqlFilter).first(pageSize).after(after)
        : sdk.requests.query().filter(httpqlFilter).first(pageSize);

      const connection = await query.execute();
      for (const item of connection.items) {
        const candidateRequest = item.request;
        if (candidateRequest.getId() === requestId) {
          continue;
        }

        currentBatch.push(candidateRequest.getId());

        if (currentBatch.length >= batchSize) {
          sdk.console.log("Sending batch", currentBatch);
          sdk.api.send("request-matched", currentBatch, colour);
          currentBatch = [];
        }
      }

      hasNextPage = connection.pageInfo.hasNextPage;
      if (hasNextPage) {
        after = connection.pageInfo.endCursor;
      }
    }

    if (currentBatch.length > 0) {
      sdk.console.log("Sending final batch: " + currentBatch);
      sdk.api.send("request-matched", currentBatch, colour);
    }
  });
}
