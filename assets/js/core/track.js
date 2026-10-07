/* Analytics: one entry point. The prototype only logs to the console; point this at the real tracker later. */
window.Cashful = window.Cashful || {};
Cashful.track = function (eventName, props) {
  console.log('[track]', eventName, props || {});
};
