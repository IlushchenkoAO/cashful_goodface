/* Payouts — placeholder business values. The client edits this file only; the UI reads everything from here.
   Amounts are in USD.
   fee.type  'fixed'   → value is dollars  (value: 1  = $1.00)
             'percent' → value is percent  (value: 2  = 2% of the payout amount)
   eta       text shown as "Arrives in"
   crypto    currency → the networks it can be sent on */
window.Cashful = window.Cashful || {};
Cashful.payoutsConfig = {
  minPayout: 20,
  methods: {
    ach:    { fee: { type: 'fixed',   value: 0 }, eta: '3-5 business days' },
    wise:   { fee: { type: 'fixed',   value: 1 }, eta: '1-2 business days' },
    paypal: { fee: { type: 'percent', value: 2 }, eta: 'Up to 1 day' },
    crypto: { fee: { type: 'fixed',   value: 1 }, eta: 'Up to 24 hours' }
  },
  crypto: {
    USDT: ['TRC-20', 'ERC-20'],
    USDC: ['ERC-20', 'Polygon']
  }
};
