const registrationTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const originPattern = /^https?:\/\/[^/\s]+$/;
const hostnamePattern =
  /^(?:localhost|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*|\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:]+\])(?::\d{1,5})?$/i;

export type RegistrationLinkState = {
  token: string | null;
  is_enabled: boolean | null;
};

export type RegistrationLinkView =
  | { status: "hidden" }
  | { status: "error" }
  | { status: "disabled" }
  | { status: "ready"; url: string };

export type RequestOriginInput = {
  host: string | null;
  forwardedHost: string | null;
  forwardedProto: string | null;
};

export function isRegistrationManager(role: string) {
  return role === "owner" || role === "admin";
}

function firstHeaderValue(value: string | null) {
  if (!value) {
    return null;
  }

  const first = value.split(",")[0]?.trim() ?? "";

  return first.length > 0 ? first : null;
}

function hostnameOf(host: string) {
  if (host.startsWith("[")) {
    const closing = host.indexOf("]");

    return closing === -1 ? host : host.slice(0, closing + 1);
  }

  return host.replace(/:\d+$/, "");
}

function isLoopbackHost(host: string) {
  const hostname = hostnameOf(host);

  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isSafeHost(host: string) {
  if (!hostnamePattern.test(host)) {
    return false;
  }

  const portMatch = host.match(/:(\d+)$/);

  if (!portMatch) {
    return true;
  }

  const port = Number(portMatch[1]);

  return port >= 1 && port <= 65535;
}

function requestScheme(proto: string | null, host: string) {
  const value = firstHeaderValue(proto)?.toLowerCase() ?? null;

  if (value === "http" || value === "https") {
    return value;
  }

  if (isLoopbackHost(host)) {
    return "http";
  }

  return "https";
}

export function requestOrigin(input: RequestOriginInput) {
  const host =
    firstHeaderValue(input.forwardedHost) ?? firstHeaderValue(input.host);

  if (!host || !isSafeHost(host)) {
    return null;
  }

  return `${requestScheme(input.forwardedProto, host)}://${host}`;
}

export function parseRegistrationLinkState(data: unknown): RegistrationLinkState | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  if (!("token" in data) || !("is_enabled" in data)) {
    return null;
  }

  const token = data.token;
  const isEnabled = data.is_enabled;

  if (token !== null && typeof token !== "string") {
    return null;
  }

  if (isEnabled !== null && typeof isEnabled !== "boolean") {
    return null;
  }

  return {
    token,
    is_enabled: isEnabled,
  };
}

export function registrationLinkView(input: {
  role: string;
  origin: string | null;
  link: RegistrationLinkState | null;
  failed: boolean;
}): RegistrationLinkView {
  if (!isRegistrationManager(input.role)) {
    return { status: "hidden" };
  }

  if (input.failed || !input.link) {
    return { status: "error" };
  }

  if (input.link.is_enabled === false) {
    return { status: "disabled" };
  }

  if (
    input.link.is_enabled !== true ||
    !input.link.token ||
    !registrationTokenPattern.test(input.link.token) ||
    !input.origin ||
    !originPattern.test(input.origin)
  ) {
    return { status: "error" };
  }

  return {
    status: "ready",
    url: `${input.origin}/join/${input.link.token}`,
  };
}
