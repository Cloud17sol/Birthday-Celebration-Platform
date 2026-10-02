import {
  parseRegistrationLinkState,
  registrationLinkView,
  requestOrigin,
} from "../lib/registration-link";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";

assert(token.length === 43, "fixture token length");

assert(
  requestOrigin({
    host: "localhost:3000",
    forwardedHost: null,
    forwardedProto: null,
  }) === "http://localhost:3000",
  "loopback origin uses the request host"
);

assert(
  requestOrigin({
    host: "internal.example",
    forwardedHost: "app.example.com, internal.example",
    forwardedProto: "https, http",
  }) === "https://app.example.com",
  "forwarded host and proto use the first value"
);

assert(
  requestOrigin({
    host: "app.example.com",
    forwardedHost: null,
    forwardedProto: null,
  }) === "https://app.example.com",
  "public host defaults to https"
);

assert(
  requestOrigin({
    host: "evil.example/join/nope",
    forwardedHost: null,
    forwardedProto: "https",
  }) === null,
  "host with a path is rejected"
);

assert(
  requestOrigin({
    host: "app.example.com",
    forwardedHost: null,
    forwardedProto: "javascript",
  }) === "https://app.example.com",
  "unexpected proto does not become the scheme"
);

const ready = registrationLinkView({
  role: "owner",
  origin: "https://app.example.com",
  link: { token, is_enabled: true },
  failed: false,
});

assert(ready.status === "ready", "owner receives a ready link");
assert(
  ready.status === "ready" &&
    ready.url === `https://app.example.com/join/${token}`,
  "share url is the origin plus /join and the full token"
);

assert(
  registrationLinkView({
    role: "admin",
    origin: "https://app.example.com/",
    link: { token, is_enabled: true },
    failed: false,
  }).status === "error",
  "origin must not include a trailing slash"
);

assert(
  registrationLinkView({
    role: "member",
    origin: "https://app.example.com",
    link: { token, is_enabled: true },
    failed: false,
  }).status === "hidden",
  "plain member view stays hidden"
);

const disabled = registrationLinkView({
  role: "admin",
  origin: "https://app.example.com",
  link: { token, is_enabled: false },
  failed: false,
});

assert(disabled.status === "disabled", "disabled link is not re-enabled");
assert(!("url" in disabled), "disabled view does not include a share url");

assert(
  registrationLinkView({
    role: "owner",
    origin: "https://app.example.com",
    link: null,
    failed: true,
  }).status === "error",
  "rpc failure is a safe error state"
);

assert(
  registrationLinkView({
    role: "owner",
    origin: null,
    link: { token, is_enabled: true },
    failed: false,
  }).status === "error",
  "missing origin does not fall back to a hardcoded host"
);

assert(
  registrationLinkView({
    role: "owner",
    origin: "https://app.example.com",
    link: { token: "short", is_enabled: true },
    failed: false,
  }).status === "error",
  "unexpected token shape is not displayed"
);

assert(
  parseRegistrationLinkState({ token, is_enabled: true })?.token === token,
  "object result parses"
);
assert(parseRegistrationLinkState([{ token, is_enabled: true }]) === null, "array result is rejected");
assert(parseRegistrationLinkState("token") === null, "string result is rejected");

console.log("registration link checks passed");
