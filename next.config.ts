import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM Postgres; keep it out of the bundler.
  serverExternalPackages: ["@electric-sql/pglite", "@napi-rs/canvas", "unpdf", "nodemailer"],
  // Fixture/test data the server reads at runtime.
  outputFileTracingIncludes: {
    "/api/**": ["./fixtures/**", "./public/demo/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
