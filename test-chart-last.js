import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
async function test() {
  const period1 = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const period2 = new Date();
  const res = await yahooFinance.chart('AAPL', { period1, period2, interval: '60m' });
  const q = res.quotes;
  console.log(JSON.stringify(q.slice(-2), null, 2));
}
test();
