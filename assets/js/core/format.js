/* Shared formatting: money ($1,234.56, kept in integer cents) and dates (Mar 4, 2026). */
window.Cashful = window.Cashful || {};
(function () {
  var USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  var DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  Cashful.fmt = {
    toCents: function (dollars) { return Math.round(dollars * 100); },
    money: function (cents) { return USD.format(cents / 100); },
    date: function (ts) { return DATE.format(new Date(ts)); }
  };
})();
