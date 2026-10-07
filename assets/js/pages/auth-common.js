/* Shared behaviour for auth pages: social sign-in buttons and log-out links.
   <button data-social="google|github" data-intent="login|personal|developer">
   <a data-logout href="login.html"> */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;

  ui.$$('[data-social]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ui.withLoading(btn, function () {
        return api.social(btn.dataset.social, btn.dataset.intent).then(function (res) { ui.go(res.redirect); });
      });
    });
  });

  ui.$$('[data-logout]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      api.logOut().then(function () { ui.go(link.getAttribute('href')); });
    });
  });
})();
