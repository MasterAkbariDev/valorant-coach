export class HenrikError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "HenrikError";
  }
}

export function pathEncode(...parts: string[]) {
  return parts.map((part) => encodeURIComponent(part)).join("/");
}
