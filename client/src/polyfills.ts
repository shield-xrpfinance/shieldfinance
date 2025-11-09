import { Buffer } from "buffer";

// Polyfill Buffer and process for Web3Auth browser compatibility
if (typeof window !== "undefined") {
  window.Buffer = Buffer;
  window.global = window;
  window.process = {
    env: { NODE_ENV: import.meta.env.MODE },
    version: '',
    browser: true,
  } as any;
}
