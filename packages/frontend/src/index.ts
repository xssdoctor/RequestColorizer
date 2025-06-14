import { Caido } from "@caido/sdk-frontend";

// Define the HighlightColour type locally to avoid import issues
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

// Define the API and Events types locally
export type API = {
  addHighlightRule(requestId: string, colour: HighlightColour): Promise<void>;
};

type Events = {
  "request-matched": (
    id: string,
    colour: HighlightColour,
    findingId: string
  ) => void;
};

/**
 * Store for request colors to persist across DOM updates
 */
const requestColors = new Map<string, HighlightColour>();

/**
 * Use SDK's GraphQL updateRequestMetadata method
 */
async function setRequestColorViaSdkGraphQL(
  sdk: any,
  requestId: string,
  color: HighlightColour
): Promise<boolean> {
  try {
    // Map our color names to Caido's color values
    const colorMap: Record<string, string> = {
      Red: "RED",
      Orange: "ORANGE",
      Yellow: "YELLOW",
      Green: "GREEN",
      Blue: "BLUE",
      Purple: "PURPLE",
      Grey: "GREY",
    };

    const caidoColor = colorMap[String(color).trim()] || "YELLOW";

    // Check if SDK has GraphQL with updateRequestMetadata method
    if (
      sdk.graphql &&
      typeof sdk.graphql.updateRequestMetadata === "function"
    ) {
      try {
        const variables = {
          id: requestId,
          input: {
            color: caidoColor,
          },
        };

        const result = await sdk.graphql.updateRequestMetadata(variables);

        if (result && !result.errors) {
          return true;
        }
      } catch (error) {
        // Silent error handling
      }
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Apply color to a request using SDK's GraphQL updateRequestMetadata method
 */
async function applyColorToRequest(
  requestId: string,
  color: HighlightColour,
  sdk?: any
): Promise<boolean> {
  try {
    // Store the color for persistence
    requestColors.set(requestId, color);

    if (!sdk) {
      return false;
    }

    // Use the SDK's GraphQL updateRequestMetadata method directly
    return await setRequestColorViaSdkGraphQL(sdk, requestId, color);
  } catch (error) {
    return false;
  }
}

/**
 * Frontend entry point — Caido calls this when the plugin loads.
 */
export async function init(sdk: Caido<API, Events>): Promise<void> {
  try {
    sdk.commands.register("colorize.similar", {
      name: "Color similar requests…",
      async run(ctx: any) {
        try {
          const req = ctx.request ?? ctx.requests?.[0];
          if (!req?.id) {
            return;
          }

          const colour = await pickColour();
          if (!colour) return;

          // Store in backend for future matching
          await sdk.backend.addHighlightRule(req.id, colour);

          // Apply color immediately via GraphQL
          await applyColorToRequest(req.id, colour, sdk);
        } catch (error) {
          // Silent error handling
        }
      },
    });

    sdk.menu.registerItem({
      type: "Request" as const,
      commandId: "colorize.similar",
      leadingIcon: "fas fa-palette",
    });

    sdk.menu.registerItem({
      type: "RequestRow" as const,
      commandId: "colorize.similar",
      leadingIcon: "fas fa-palette",
    });

    sdk.backend.onEvent(
      "request-matched",
      async (requestId: string, colour: HighlightColour, findingId: string) => {
        try {
          await applyColorToRequest(requestId, colour, sdk);
        } catch (error) {
          // Silent error handling
        }
      }
    );
  } catch (error) {
    // Silent error handling
  }
}

/**
 * Simple colour picker dialog.
 */
async function pickColour(): Promise<HighlightColour | undefined> {
  return new Promise((resolve) => {
    try {
      const dlg = document.createElement("dialog");
      dlg.innerHTML = `
        <style>
          dialog { padding:1.5rem; border:none; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); }
          button { margin:.25rem; padding:.75rem 1rem; border:none; border-radius:6px; cursor:pointer; font-size:.9em; }
        </style>
        <h3>Choose a color</h3>
        ${COLOURS.map(
          (c) =>
            `<button data-c="${c}" style="background:${c.toLowerCase()};color:white">${c}</button>`
        ).join("")}
        <button data-c="">Cancel</button>
      `;
      dlg.addEventListener("click", (e: Event) => {
        const btn = (e.target as HTMLElement).closest("button");
        dlg.close();
        resolve((btn?.dataset.c as HighlightColour) || undefined);
      });
      document.body.append(dlg);
      dlg.showModal();
    } catch (error) {
      resolve(undefined);
    }
  });
}
