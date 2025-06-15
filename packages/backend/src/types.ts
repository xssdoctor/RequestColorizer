import { DefineEvents } from "caido:plugin";


export const COLOURS = [
    "RED",
    "ORANGE",
    "YELLOW",
    "GREEN",
    "BLUE",
    "PURPLE",
    "GREY",
  ] as const;
export type HighlightColour = (typeof COLOURS)[number];
export type Events = DefineEvents<{
  /** Notify frontend that a request matched and should be colored */
  "request-matched": (ids: string[], colour: HighlightColour) => void;
}>;
