/**
 * currencyService.js — Live exchange rates via Open Exchange Rates (free tier)
 * Fallback ke hardcoded rates kalau fetch gagal.
 * Cache 60 menit di localStorage (browser) atau in-memory (server).
 *
 * Base currency: INR (karena semua model output dalam INR)
 */

const CACHE_KEY   = 'currency_rates_v2';
const CACHE_TTL   = 60 * 60 * 1000; // 1 jam

// Fallback rates — diupdate berkala, bukan live
const FALLBACK_RATES_FROM_INR = {
  IDR: 191.5,
  INR: 1,
  USD: 0.01198,
  EUR: 0.01103,
  GBP: 0.00942,
};

export const CURRENCY_META = [
  { code: 'IDR', symbol: 'Rp',  label: 'Rupiah',       locale: 'id-ID' },
  { code: 'INR', symbol: '₹',   label: 'Rupee India',  locale: 'en-IN' },
  { code: 'USD', symbol: 'US$', label: 'Dollar AS',    locale: 'en-US' },
  { code: 'EUR', symbol: '€',   label: 'Euro',         locale: 'de-DE' },
  { code: 'GBP', symbol: '£',   label: 'Pound Inggris',locale: 'en-GB' },
];

let _memCache = null;
let _memCacheAt = 0;

/**
 * Ambil rates dari cache atau API.
 * Returns object: { IDR, INR, USD, EUR, GBP, _source, _fetchedAt }
 */
export async function getRatesFromINR() {
  // 1. Cek in-memory cache
  if (_memCache && Date.now() - _memCacheAt < CACHE_TTL) {
    return _memCache;
  }

  // 2. Cek localStorage cache
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed._fetchedAt && Date.now() - parsed._fetchedAt < CACHE_TTL) {
        _memCache = parsed;
        _memCacheAt = Date.now();
        return parsed;
      }
    }
  } catch { /* ignore */ }

  // 3. Fetch dari frankfurter.app (free, no key, CORS-friendly)
  // Base: INR, targets: IDR, USD, EUR, GBP
  try {
    const res = await fetch(
      'https://api.frankfurter.app/latest?from=INR&to=IDR,USD,EUR,GBP',
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = await res.json();
      const rates = {
        IDR: data.rates.IDR,
        INR: 1,
        USD: data.rates.USD,
        EUR: data.rates.EUR,
        GBP: data.rates.GBP,
        _source: 'live',
        _fetchedAt: Date.now(),
      };
      // Simpan ke cache
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(rates)); } catch { /* ignore */ }
      _memCache = rates;
      _memCacheAt = Date.now();
      return rates;
    }
  } catch { /* fallback */ }

  // 4. Fallback
  const rates = { ...FALLBACK_RATES_FROM_INR, _source: 'fallback', _fetchedAt: Date.now() };
  _memCache = rates;
  _memCacheAt = Date.now();
  return rates;
}

/**
 * Konversi harga dari INR ke currency tertentu.
 */
export function convertFromINR(priceINR, targetCode, rates) {
  const r = rates?.[targetCode] ?? FALLBACK_RATES_FROM_INR[targetCode] ?? 1;
  return priceINR * r;
}

/**
 * Format harga ke string dengan simbol.
 */
export function formatPrice(value, currencyCode, rates) {
  const meta = CURRENCY_META.find(c => c.code === currencyCode) || CURRENCY_META[0];
  const converted = convertFromINR(value, currencyCode, rates);
  const rounded = Math.round(converted);
  return `${meta.symbol} ${rounded.toLocaleString(meta.locale)}`;
}
