/* Billing information of the account in use (Personal, or the Developer account): who gets paid and where.
   It is needed once, before the first payout. Settings → Billing information edits it; a payout request opens the same
   dialog when it is still empty. Nothing is required: empty fields take sample values (like the rest of the prototype).
   Cashful.billing = { get(), has(), summaryHtml(), open({ title, lead, cta, onSaved }) } */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var api = Cashful.api;
  var esc = ui.esc;

  var SAMPLE = { street: '500 Market Street', city: 'San Francisco', region: 'California', postal: '94105', country: 'United States' };

  function get() { return api.billing.get(); }
  function has() { return !!get(); }

  /** What the form starts with: what was saved, else what the account already knows (name and address of the business). */
  function defaults() {
    var saved = get();
    if (saved) return saved;
    var u = api.currentUser() || {};
    if (Cashful.app.account === 'developer' && u.dev) {
      var b = u.dev.business || {}, d = u.dev.details || {};
      return { name: b.name || d.company || Cashful.app.accountName, country: b.country || d.country || SAMPLE.country, street: b.street || d.street || '', city: b.city || d.city || '',
        region: d.region || '', postal: b.postal || d.zip || '', taxId: '' };
    }
    return { name: u.name || '', country: SAMPLE.country, street: '', city: '', region: '', postal: '', taxId: '' };
  }

  function summaryHtml() {
    var b = get();
    if (!b) return '';
    var line2 = [b.city, b.region, b.postal].filter(Boolean).join(', ');
    return '<dl class="app-dl bill-summary"><div><dt>Name</dt><dd>' + esc(b.name) + '</dd></div>' +
      '<div><dt>Country</dt><dd>' + esc(b.country) + '</dd></div>' +
      '<div class="is-wide"><dt>Address</dt><dd>' + esc(b.street) + (line2 ? '<br>' + esc(line2) : '') + '</dd></div>' +
      (b.taxId ? '<div><dt>Tax ID</dt><dd>' + esc(b.taxId) + '</dd></div>' : '') + '</dl>';
  }

  function open(opts) {
    opts = opts || {};
    var v = defaults();
    var countries = Cashful.config.eligibility.supported.slice();
    if (v.country && countries.indexOf(v.country) < 0) countries.push(v.country);
    var m = ui.modal({
      title: opts.title || 'Billing information',
      width: 520,
      body: '<form class="set-form" id="billing-form" novalidate>' +
        (opts.lead ? '<p class="cf-modal__desc">' + esc(opts.lead) + '</p>' : '') +
        ui.fieldHtml({ id: 'bill-name', name: 'name', label: 'Full name or company', value: v.name, autocomplete: 'name', autofocus: true, sample: Cashful.app.accountName }) +
        ui.selectHtml({ id: 'bill-country', name: 'country', label: 'Country', options: countries, value: v.country || SAMPLE.country }) +
        ui.fieldHtml({ id: 'bill-street', name: 'street', label: 'Street address', value: v.street, autocomplete: 'street-address', sample: SAMPLE.street }) +
        '<div class="cf-field-row">' +
          ui.fieldHtml({ id: 'bill-city', name: 'city', label: 'City', value: v.city, autocomplete: 'address-level2', sample: SAMPLE.city }) +
          ui.fieldHtml({ id: 'bill-region', name: 'region', label: 'State or region', value: v.region, autocomplete: 'address-level1', helper: 'Optional outside the US', noSample: true }) +
        '</div>' +
        '<div class="cf-field-row">' +
          ui.fieldHtml({ id: 'bill-postal', name: 'postal', label: 'ZIP or postal code', value: v.postal, autocomplete: 'postal-code', sample: SAMPLE.postal }) +
          ui.fieldHtml({ id: 'bill-tax', name: 'taxId', label: 'Tax ID', value: v.taxId || '', helper: 'Optional. VAT, EIN or similar.', noSample: true }) +
        '</div></form>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button>' +
        '<button type="submit" form="billing-form" class="cf-btn cf-btn--primary" id="bill-save">' + esc(opts.cta || 'Save') + '</button>'
    });
    var form = ui.$('#billing-form', m.el);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      // Nothing is required: an empty field takes the sample
      var data = {
        name: f.name.value.trim() || Cashful.app.accountName,
        country: f.country.value,
        street: f.street.value.trim() || SAMPLE.street,
        city: f.city.value.trim() || SAMPLE.city,
        region: f.region.value.trim(),
        postal: f.postal.value.trim() || SAMPLE.postal,
        taxId: f.taxId.value.trim()
      };
      api.billing.save(data);
      m.close();
      if (opts.onSaved) opts.onSaved(data);
    });
  }

  Cashful.billing = { get: get, has: has, summaryHtml: summaryHtml, open: open };
})();
