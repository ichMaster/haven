// Browser stub for the Anthropic SDK's Node-only agent-toolset.
// The SDK's environment worker dynamically imports tools/agent-toolset/node
// (which uses node:fs / node:path). That path is server-side only and never
// runs in this frontend-only prototype, so we alias it to this empty module
// (see vite.config.js) to keep the browser bundle building cleanly.
export {};
