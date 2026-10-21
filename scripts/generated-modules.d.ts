// Builds create these modules. Ambient declarations let a fresh source tree be
// typechecked before its first build; the real modules remain build outputs.
declare module '*generated-assets' {
  export const assets: Record<string, {base64: string; mime: string}>;
}
declare module '*generated-guide' {
  export const guide: string;
}
