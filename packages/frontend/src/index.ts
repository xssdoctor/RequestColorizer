import { Caido } from "@caido/sdk-frontend";
import { COLOURS, Events, HighlightColour } from "backend";

export type FrontendSDK = Caido<API, Events>;

// Define the API and Events types locally
export type API = {
  addHighlightRule(requestId: string, colour: HighlightColour): Promise<void>;
};

/**
 * Use SDK's GraphQL updateRequestMetadata method
 */
async function setRequestColorViaSdkGraphQL(
  sdk: FrontendSDK,
  requestId: string,
  color: HighlightColour
): Promise<boolean> {
  try {
    const variables = {
      id: requestId,
      input: {
        color: color,
      },
    };

    const result = await sdk.graphql.updateRequestMetadata(variables);
    if (result) {
      return true;
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
export async function init(sdk: FrontendSDK): Promise<void> {
  sdk.commands.register("colorize.similar", {
    name: "Color similar requests...",
    async run(ctx: any) {
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
    async (ids: string[], colour: HighlightColour) => {
      for (const id of ids) {
        await applyColorToRequest(id, colour, sdk);
      }
    }
  );
}

/**
 * Simple colour picker dialog.
 */
async function pickColour(): Promise<HighlightColour | undefined> {
  return new Promise((resolve) => {
    try {
      const dlg = document.createElement("dialog");
      dlg.className = "colorizer-plugin";
      dlg.innerHTML = `
        <style>
          .colorizer-plugin dialog {
            padding:1.5rem;
            border:none;
            border-radius:8px;
            box-shadow:0 4px 12px rgba(0,0,0,0.15);
            background: white;
            color: black;
          }
          .colorizer-plugin button {
            margin:.25rem;
            padding:.75rem 1rem;
            border:none;
            border-radius:6px;
            cursor:pointer;
            font-size:.9em;
          }
          .colorizer-plugin h3 {
            margin-top: 0;
            margin-bottom: 1rem;
            font-size: 1.1em;
            font-weight: 600;
          }
        </style>
        <h3>Choose a color</h3>
        ${COLOURS.map(
          (c) =>
            `<button data-c="${c}" style="background:${c.toLowerCase()};color:white">${c}</button>`
        ).join("")}
        <button style="background:#6b7280;color:white">Cancel</button>
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
