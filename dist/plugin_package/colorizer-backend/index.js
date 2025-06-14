// packages/backend/src/index.ts
async function init(sdk) {
  try {
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
    sdk.events.onInterceptRequest(async (_sdk, request) => {
      try {
        const method = request.getMethod();
        const host = request.getHost();
        const path = request.getPath();
        const stmt = await db.prepare(
          "SELECT method, host, path, colour FROM highlights"
        );
        const rules = await stmt.all();
        for (const rule of rules) {
          const methodMatches = method.includes(rule.method);
          const hostMatches = host.includes(rule.host);
          const pathMatches = path.includes(rule.path);
          if (methodMatches && hostMatches && pathMatches) {
            sdk.api.send(
              "request-matched",
              request.getId(),
              rule.colour,
              "auto-color"
            );
            break;
          }
        }
      } catch (error) {
      }
    });
    sdk.api.register(
      "addHighlightRule",
      async (_sdk, requestId, colour) => {
        try {
          const reqResponse = await _sdk.requests.get(requestId);
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
          sdk.api.send("request-matched", requestId, colour, "rule-added");
          const httpqlFilter = `req.method.cont:"${method}" AND req.host.cont:"${host}" AND req.path.cont:"${path}"`;
          const requestsQuery = _sdk.requests.query().filter(httpqlFilter).first(1e5);
          const connection = await requestsQuery.execute();
          let retroactiveCount = 0;
          for (const item of connection.items) {
            const candidateRequest = item.request;
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
  }
}
export {
  init
};
