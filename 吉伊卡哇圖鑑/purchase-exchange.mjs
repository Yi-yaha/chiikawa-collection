import { normalizePurchaseRate, purchaseCurrency, validPurchaseDate } from './purchase-records.mjs?v=9cbe9f70c17a92a0';

// 每日參考匯率；僅傳送幣別，不傳送金額、收藏或帳號資料。
// 來源與備援：https://github.com/fawazahmed0/exchange-api
export async function fetchPurchaseExchangeRate(currency, { fetcher = globalThis.fetch, signal, now = Date.now(), timeoutMs = 5000 } = {}) {
  if (!purchaseCurrency(currency)) throw new Error('請先選擇外幣幣別。');
  const base = currency.toLowerCase();
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.min.json`,
    `https://latest.currency-api.pages.dev/v1/currencies/${base}.min.json`,
  ];
  const cancelled = () => new DOMException('已取消取得匯率。', 'AbortError');
  for (const url of urls) {
    if (signal?.aborted) throw cancelled();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once:true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await fetcher(url, { signal:controller.signal, cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer' });
      if (!response.ok) throw new Error('無法取得匯率');
      const data = await response.json();
      if (signal?.aborted) throw cancelled();
      if (controller.signal.aborted) throw new Error('取得匯率逾時');
      const date = data?.date, amount = data?.[base]?.twd;
      const age = now - Date.parse(date + 'T00:00:00Z');
      if (!date || !validPurchaseDate(date) || !Number.isFinite(age) || age < -86400000 || age > 3 * 86400000
        || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) throw new Error('匯率資料無效或過舊');
      // 先轉成十進位，再以第 5 位小數四捨五入，避免浮點數讓半數進位失準。
      const original = normalizePurchaseRate(amount.toFixed(12));
      if (original === '') throw new Error('匯率資料無效');
      const [whole, fraction = ''] = original.split('.');
      const decimals = fraction.padEnd(5, '0');
      const units = BigInt(whole) * 10000n + BigInt(decimals.slice(0,4)) + (decimals[4] >= '5' ? 1n : 0n);
      const rate = normalizePurchaseRate((units / 10000n).toString() + '.' + (units % 10000n).toString().padStart(4, '0'));
      if (rate === '' || Number(rate) <= 0) throw new Error('匯率資料無效');
      return { currency, rate, date };
    } catch (error) {
      if (signal?.aborted) throw cancelled();
      // 來源連線失敗、逾時或資料無效時，改向備援取得。
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  throw new Error('目前無法取得最新匯率，原本內容已保留，請稍後再試或自行填寫。');
}
