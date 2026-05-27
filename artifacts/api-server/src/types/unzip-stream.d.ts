declare module "unzip-stream" {
  import { Transform, Writable } from "node:stream";

  interface ExtractOptions {
    path?: string;
  }

  export function Extract(opts?: ExtractOptions): Writable;
  export function Parse(): Transform;
}
