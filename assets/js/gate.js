/* Instructor page password gate.
 * Note: this is a client-side gate on a static site. It keeps students out of casual reach,
 * but it is not real security: anyone can read the site's source files.
 */
(function () {
  'use strict';
  var HASH = '60946ba3fd299656a1de097cbba72a079089b782d7744ded097ce0124bfb2597'; // SHA-256 of the password
  var KEY = 'mh-instructor-unlocked';
  var gate = document.getElementById('gate');
  var content = document.getElementById('instructorContent');

  function unlock() {
    gate.classList.add('hidden');
    content.classList.remove('hidden');
  }
  function sha256(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }

  try { if (sessionStorage.getItem(KEY) === HASH) { unlock(); return; } } catch (e) { /* storage unavailable */ }

  document.getElementById('gateForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var pw = document.getElementById('pw').value;
    sha256(pw).then(function (h) {
      if (h === HASH) {
        try { sessionStorage.setItem(KEY, HASH); } catch (e) { /* ignore */ }
        unlock();
      } else {
        document.getElementById('gateMsg').textContent = 'Incorrect password.';
        document.getElementById('pw').select();
      }
    }).catch(function () {
      document.getElementById('gateMsg').textContent = 'Your browser could not check the password. Open the page over https.';
    });
  });
})();
