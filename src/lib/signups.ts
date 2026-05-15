import type { EmailSignup } from "../types";
import { readStorage, writeStorage } from "./storage";

const SIGNUPS_KEY = "diaper-stop-finder:email-signups";

export function getEmailSignups() {
  return readStorage<EmailSignup[]>(SIGNUPS_KEY, []);
}

export function saveEmailSignup(email: string, wantsToVerify: boolean) {
  const signup: EmailSignup = {
    id: `email-signup-${crypto.randomUUID()}`,
    email,
    wantsToVerify,
    createdAt: new Date().toISOString(),
  };

  writeStorage(SIGNUPS_KEY, [signup, ...getEmailSignups()]);
  return signup;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
