import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js", "pdfjs-dist", "@huggingface/transformers"],
};

export default nextConfig;
