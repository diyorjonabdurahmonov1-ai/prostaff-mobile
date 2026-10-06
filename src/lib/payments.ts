/**
 * Paying for something, from the app's side.
 *
 * The person stays in the app: they type a card on one screen, confirm it on
 * the next, and the server tells us whether the money moved.
 *
 * # Why it works this way
 *
 * It used to open Atmos's hosted invoice page. That page lives on a host that
 * stopped answering — every payer saw a browser error instead of a card form —
 * and the API gateway behind it never missed a beat, so the app drives the same
 * steps the page would have. The server does the talking; card details go
 * straight through it to Atmos and are kept nowhere.
 *
 * # Two kinds of card, two ways to confirm
 *
 * The server decides from the number which of Atmos's gateways a card belongs
 * to, and says so in `next`:
 *
 *   - `otp`  — UzCard or Humo. A code is texted to the cardholder; the code
 *              screen spends it.
 *   - `3ds`  — Visa or Mastercard, which also needed a CVV on the way in. The
 *              payer goes to their own bank's page, comes back, and /confirm
 *              captures it.
 *
 * The app follows what it is told rather than guessing from the card number
 * itself: the number is only a hint here, and only the server's reading of it
 * decides where the money actually goes.
 *
 * # What has not changed
 *
 * Nothing here decides that anybody has been paid. `success` comes from the
 * server, which learned it from Atmos confirming the debit. The app's job is to
 * collect what is asked for and report what it is told.
 */

import * as WebBrowser from 'expo-web-browser';

import { api } from '@/lib/api';
import { beginPaySession, type PayBrand } from '@/lib/pay-session';
import type { Payment } from '@/lib/types';

export interface CheckoutResult {
  /**
   * `success` only ever comes from the server confirming settlement.
   * `canceled` is the payer leaving the card screen: nothing was charged and
   * nothing went wrong, so a screen showing it should say nothing at all.
   */
  status: 'success' | 'pending' | 'failed' | 'canceled';
  payment?: Payment;
}

interface OpenPaymentResponse {
  ok: boolean;
  payment: Payment;
  /** Set when the app is to collect a card and confirm it here. */
  card_required?: boolean;
  /** The old hosted page. Absent when the backend credited directly. */
  payment_url?: string;
}

/** What the server says to do once it has the card. */
export interface CardAccepted {
  next: 'otp' | '3ds' | 'done';
  brand: PayBrand;
  /** The bank's 3DS page — only on the `3ds` path. */
  redirect_url?: string;
  masked_pan?: string;
  /** Present when the card needed no confirmation at all and already settled. */
  payment?: Payment;
}

/**
 * How long to keep asking, on the paths that still have to wait.
 *
 * Neither card path does: the server credits the wallet in the same request
 * that confirms. This is only for the legacy browser path, where the bank
 * confirms to our backend rather than to this phone.
 */
const POLL_INTERVAL_MS = 1500;
const POLL_ATTEMPTS = 8;

/**
 * Opens the card screen for a payment and resolves once the person is done
 * with it.
 *
 * Set by `<CardPaymentRouter/>` at the root of the app, which is the only part
 * that may navigate. Kept as a module-level hook rather than a context so that
 * `checkout` stays an ordinary async function the screens can await — they
 * neither know nor care that part of it happens on screen.
 */
type CardPresenter = (payment: Payment) => Promise<CheckoutResult>;

let presentCard: CardPresenter | null = null;

export function setCardPresenter(fn: CardPresenter | null) {
  presentCard = fn;
}

/**
 * The default presenter: start the session and let the router notice.
 *
 * Exported so `<CardPaymentRouter/>` can wrap it rather than reimplement it —
 * all it adds is the navigation, which is the one thing that has to happen
 * inside a component.
 */
export function openPaySession(payment: Payment): Promise<CheckoutResult> {
  return beginPaySession(payment);
}

/**
 * Runs one payment end to end.
 *
 * `path` is the endpoint that opens it (`/wallet/topup`,
 * `/company/subscription/checkout`), `body` whatever that endpoint needs.
 */
export async function checkout(path: string, body: Record<string, unknown>): Promise<CheckoutResult> {
  const opened = await api.post<OpenPaymentResponse>(path, body);

  if (opened?.card_required && opened.payment) {
    if (!presentCard) {
      // A build that opened a payment it has no way to finish. Better to say so
      // than to leave a pending row and a silent screen.
      return { status: 'failed', payment: opened.payment };
    }
    return await presentCard(opened.payment);
  }

  // No URL and no card step means the backend has no gateway wired up and
  // credited the account itself — the development path. It is already done.
  if (!opened?.payment_url) {
    return { status: 'success', payment: opened?.payment };
  }

  await openInvoice(opened.payment_url);
  return await waitForSettlement(opened.payment.id);
}

/**
 * Hands the card to the server, which routes it to the right gateway.
 *
 * `cvv` is sent only when there is one to send. An empty field on a local card
 * is not a missing value the server should complain about — UzCard and Humo
 * have no CVV to type — so the key is left off entirely rather than sent blank.
 */
export async function submitCard(
  paymentId: string,
  cardNumber: string,
  expiry: string,
  cvv?: string,
): Promise<CardAccepted> {
  const digits = (cvv ?? '').replace(/\D/g, '');
  const res = await api.post<Partial<CardAccepted> & { otp_required?: boolean }>(
    `/payments/${paymentId}/card`,
    {
      card_number: cardNumber.replace(/\D/g, ''),
      expiry,
      ...(digits ? { cvv: digits } : {}),
    },
  );
  return {
    // `next` is what a current server says. `otp_required` is what one shipped
    // before it said — read as a fallback so the app keeps working against a
    // backend that has not been deployed yet.
    next: res?.next ?? (res?.otp_required ? 'otp' : 'done'),
    brand: res?.brand ?? 'unknown',
    redirect_url: res?.redirect_url,
    masked_pan: res?.masked_pan,
    payment: res?.payment,
  };
}

/** Confirms the code. This is the call that moves the money for a local card. */
export async function submitOtp(paymentId: string, otp: string): Promise<CheckoutResult> {
  const res = await api.post<{ ok: boolean; payment: Payment }>(`/payments/${paymentId}/otp`, {
    otp: otp.replace(/\D/g, ''),
  });
  return { status: 'success', payment: res?.payment };
}

/**
 * Captures an international card once the payer has been through 3DS.
 *
 * Sends nothing: whether the bank authenticated anybody is Atmos's to report,
 * not this phone's to assert. The server asks.
 */
export async function confirmCard(paymentId: string): Promise<CheckoutResult> {
  const res = await api.post<{ ok: boolean; payment: Payment }>(
    `/payments/${paymentId}/confirm`,
    {},
  );
  return { status: 'success', payment: res?.payment };
}

/** Asks for the SMS code again. */
export async function resendOtp(paymentId: string): Promise<void> {
  await api.post(`/payments/${paymentId}/resend-otp`, {});
}

/**
 * Sends the payer to their bank's 3DS page and returns when they come back.
 *
 * The result is deliberately not read, for the same reason the invoice page's
 * was not: "the browser closed" is not evidence about authentication, and the
 * only opinion that counts is the one /confirm gets from Atmos. All this call
 * decides is *when* to ask.
 */
export async function open3DS(url: string): Promise<void> {
  try {
    await WebBrowser.openAuthSessionAsync(url, RETURN_URL);
  } catch {
    // A browser that will not open is not a failed payment — the transaction
    // is authorised and /confirm can still be tried.
  }
}

/**
 * Where Atmos sends the browser once a hosted page is finished with.
 *
 * A literal rather than `Linking.createURL()` because it has to be the same
 * string the server handed Atmos (`ATMOS_REDIRECT_URL`); change it here and in
 * the backend's .env together.
 */
const RETURN_URL = 'ishtopish://wallet';

/**
 * Opens the invoice page and returns once the payer is done with it.
 *
 * `openAuthSessionAsync` rather than `openBrowserAsync` because it is the one
 * that watches for RETURN_URL and closes the page on that redirect. Its result
 * is deliberately not read: `success` means Atmos redirected and `dismiss`
 * means the payer closed the page, and neither is evidence about the money.
 */
async function openInvoice(url: string): Promise<void> {
  try {
    await WebBrowser.openAuthSessionAsync(url, RETURN_URL);
  } catch {
    // A browser that refuses to open is not a failed payment: the payment row
    // exists and could still be paid elsewhere, so fall through to the poll
    // rather than throwing and telling somebody it broke.
  }
}

/**
 * Asks the server, repeatedly, whether a payment has settled.
 *
 * Returns `pending` rather than `failed` when it runs out of patience: a
 * payment we have not been told about is not a payment that failed, and telling
 * somebody their money is gone when it is merely late is the worse mistake.
 */
export async function waitForSettlement(paymentId: string): Promise<CheckoutResult> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    try {
      const payment = await api.get<Payment>(`/payments/${paymentId}`);
      if (payment?.status === 'success') return { status: 'success', payment };
      if (payment?.status === 'canceled') return { status: 'failed', payment };
    } catch {
      // A dropped request is not an answer — keep asking.
    }
    await delay(POLL_INTERVAL_MS);
  }
  return { status: 'pending' };
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Which processing a card number looks like it belongs to.
 *
 * A hint for the form only — it decides whether to show the CVV field and which
 * logo to put beside the number. The server detects the brand again from the
 * full number and its answer is the one that routes the money; this is here so
 * the CVV field appears while the payer is still typing rather than after a
 * round trip.
 *
 * The local prefixes are tested first because they sit *inside* the
 * international ranges — UzCard issues 5440 and Humo 5614, both of which look
 * like Mastercard's 51-55 to a naive check. Kept deliberately identical to
 * `DetectBrand` in the backend's internal/atmos/brand.go; change the two
 * together.
 */
const LOCAL_PREFIXES = ['8600', '5440', '6262', '6440', '9860', '5614'];

export function detectBrand(cardNumber: string): PayBrand {
  const pan = cardNumber.replace(/\D/g, '');
  if (pan.length < 6) return 'unknown';
  if (LOCAL_PREFIXES.some((p) => pan.startsWith(p))) return 'local';
  if (pan.startsWith('4')) return 'visa';
  const two = Number(pan.slice(0, 2));
  if (two >= 51 && two <= 55) return 'mastercard';
  const four = Number(pan.slice(0, 4));
  if (four >= 2221 && four <= 2720) return 'mastercard';
  return 'unknown';
}

/** Whether a card of this brand needs the three digits on the back. */
export function needsCvv(brand: PayBrand): boolean {
  return brand === 'visa' || brand === 'mastercard';
}
