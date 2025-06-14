// packages/shared/signature.ts

/**
 * Simple hash function for environments without crypto.subtle
 */
function simpleHash(data: Uint8Array): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    if (char !== undefined) {
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
  }
  return Math.abs(hash).toString(16);
}

/**
 * Matching strategies for request signatures
 */
export type MatchingStrategy = "exact" | "structural" | "content-type";

/**
 * Get the Content-Type from request headers
 */
function getContentType(req: any): string {
  const headers = req.getHeaders();
  const contentType =
    headers["content-type"]?.[0] || headers["Content-Type"]?.[0] || "";
  // Extract just the media type, ignore charset and other parameters
  return contentType.split(";")[0].trim().toLowerCase();
}

/**
 * Create a structural hash that ignores common dynamic fields in JSON
 */
function createStructuralBodyHash(bodyBytes: Uint8Array): string {
  if (bodyBytes.length === 0) {
    return "empty";
  }

  try {
    // Try to parse as JSON and create a structural signature
    const bodyText = new TextDecoder().decode(bodyBytes);
    const jsonBody = JSON.parse(bodyText);

    // Create a simplified structure signature by removing common dynamic fields
    const normalized = normalizeJsonForSignature(jsonBody);
    const normalizedStr = JSON.stringify(normalized);
    return simpleHash(new TextEncoder().encode(normalizedStr));
  } catch {
    // If not JSON, fall back to content length and type detection
    const length = bodyBytes.length;
    const hasAlpha = Array.from(bodyBytes).some(
      (b) => (b >= 65 && b <= 90) || (b >= 97 && b <= 122)
    );
    const hasNumbers = Array.from(bodyBytes).some((b) => b >= 48 && b <= 57);
    return `len:${length}_alpha:${hasAlpha}_num:${hasNumbers}`;
  }
}

/**
 * Remove common dynamic fields from JSON for structural matching
 */
function normalizeJsonForSignature(obj: any): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeJsonForSignature(item));
  }

  const normalized: any = {};
  const dynamicFieldPatterns = [
    // Common timestamp fields
    /^.*time.*$/i,
    /^.*date.*$/i,
    /^timestamp$/i,
    /^ts$/i,
    // Session and ID fields
    /^.*session.*$/i,
    /^.*id$/i,
    /^.*uuid$/i,
    /^.*guid$/i,
    // Request tracking
    /^.*nonce$/i,
    /^.*token$/i,
    /^request.*id$/i,
  ];

  for (const [key, value] of Object.entries(obj)) {
    // Skip fields that match dynamic patterns
    const isDynamic = dynamicFieldPatterns.some((pattern) => pattern.test(key));
    if (!isDynamic) {
      normalized[key] = normalizeJsonForSignature(value);
    } else {
      // For dynamic fields, just note their type
      normalized[key] = typeof value;
    }
  }

  return normalized;
}

/**
 * Build a deterministic signature of a request based on the matching strategy
 */
export function canonSignature(
  req: any,
  strategy: MatchingStrategy = "exact"
): string {
  const method = req.getMethod().toUpperCase();
  const path = req.getPath(); // already URI‑decoded in Caido
  const queryString = req.getQuery();

  // Parse and sort query params so a=b&c=d == c=d&a=b
  let sorted = "";
  if (queryString) {
    // Simple query string parsing without URLSearchParams
    const params = new Map<string, string>();
    const pairs = queryString.split("&");
    for (const pair of pairs) {
      const [key, value] = pair.split("=");
      if (key && value) {
        params.set(decodeURIComponent(key), decodeURIComponent(value));
      }
    }
    sorted = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
  }

  const bodyBytes = req.getBody()?.toRaw() ?? new Uint8Array(0);

  let bodySignature: string;

  switch (strategy) {
    case "exact":
      // Original behavior - exact body hash
      bodySignature = `body:${simpleHash(bodyBytes)}`;
      break;

    case "structural":
      // Ignore body content entirely - match only on method + path + query
      bodySignature = "body:ignored";
      break;

    case "content-type":
      // Match based on content type and structural similarity
      const contentType = getContentType(req);
      const structuralHash = createStructuralBodyHash(bodyBytes);
      bodySignature = `body:${contentType}:${structuralHash}`;
      break;

    default:
      bodySignature = `body:${simpleHash(bodyBytes)}`;
  }

  return `${method} ${path}?${sorted} ${bodySignature}`;
}

/**
 * Legacy function for backward compatibility
 */
export function canonSignatureExact(req: any): string {
  return canonSignature(req, "exact");
}

/**
 * Structural matching - ignores body differences
 */
export function canonSignatureStructural(req: any): string {
  return canonSignature(req, "structural");
}

/**
 * Content-type based matching - matches similar content structure
 */
export function canonSignatureContentType(req: any): string {
  return canonSignature(req, "content-type");
}
