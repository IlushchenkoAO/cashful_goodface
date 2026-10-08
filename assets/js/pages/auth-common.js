/* Shared behaviour for auth pages.
   - <a data-logout href="auth.html"> logs out, then goes to the href.
   - ?type=peer|developer (the site CTA's account type) is kept through the whole flow: it is remembered by auth.html
     and added to every link that returns to the entry, so Forgot password → back to the entry still knows it. */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;

  ui.$$('[data-logout]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      api.logOut().then(function () { ui.go(link.getAttribute('href')); });
    });
  });

  var type = null;
  try { type = sessionStorage.getItem('cashful.authType'); } catch (e) { /* storage may be blocked */ }
  if (type) {
    ui.$$('a[href="auth.html"], a[href="login.html"]').forEach(function (a) {
      if (!a.hasAttribute('data-logout')) a.setAttribute('href', 'auth.html?type=' + type);
    });
  }
})();
