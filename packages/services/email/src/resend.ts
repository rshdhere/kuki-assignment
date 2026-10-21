import { Resend } from "resend";

let client: Resend | undefined;

// Created on first use so importing this module doesn't require RESEND_API_KEY.
export function getResend(): Resend {
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}
