// structuredClone is part of every runtime the engine targets (browsers, Node ≥ 17,
// Cloudflare Workers) but is only typed via lib.dom or @types/node, neither of which the
// engine may depend on.
declare function structuredClone<T>(value: T): T;
