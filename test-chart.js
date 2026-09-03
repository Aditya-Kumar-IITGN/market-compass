import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
async function test() {
  const period1 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const period2 = new Date();
  const res = await yahooFinance.chart('AAPL', { period1, period2, interval: '60m' });
  console.log(JSON.stringify(res.quotes.slice(0, 3), null, 2));
}
test();
