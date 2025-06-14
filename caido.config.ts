// caido.config.ts (at the root of your plugin repo)
import { defineConfig } from "@caido-community/dev";

export default defineConfig({
  id: "colorizer",
  name: "Request Colorizer",
  version: "0.0.2",
  description:
    "Color HTTP requests by pattern - automatically colors similar requests with the same path, query parameters, and body",
  author: {
    name: "xssdoctor",
    email: "xssdoctors@gmail.com",
  },
  plugins: [
    {
      kind: "frontend",
      id: "colorizer-frontend",
      root: "packages/frontend",
      backend: {
        id: "colorizer-backend",
      },
    },
    { kind: "backend", id: "colorizer-backend", root: "packages/backend" },
  ],
});
