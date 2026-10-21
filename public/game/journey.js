(() => {
  'use strict';
  const screens = ['welcome', 'registration', 'your-id', 'enter-id', 'instructions', 'play', 'won', 'lost', 'final', 'thanks'];
  const RESULT_DURATION_MS = 3000;
  const FINAL_DURATION_MS = 3000;
  let currentScreen = 'welcome';
  let resultTimer;
  let screenVersion = 0;
  let player = null;
  const registration = document.querySelector('#registration-form');
  const idForm = document.querySelector('#id-form');
  function show(id, focusTarget) {
    clearTimeout(resultTimer);
    screenVersion++;
    currentScreen = id;
    for (const screen of screens) document.getElementById(screen).hidden = screen !== id;
    document.querySelector(focusTarget).focus({ preventScroll: true });
  }
  document.querySelector('#welcome-next').addEventListener('click', () => show('registration', '#player-name'));
  document.querySelector('#existing-id').addEventListener('click', () => show('enter-id', '#id-first'));
  document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => show('registration', '#player-name')));
  const name = document.querySelector('#player-name');
  const email = document.querySelector('#player-email');
  const phone = document.querySelector('#player-phone');
  const company = document.querySelector('#player-company');
  // El celular solo admite dígitos (10).
  phone.addEventListener('input', () => { phone.value = phone.value.replace(/\D+/g, '').slice(0, 10); phone.setCustomValidity(''); });
  company.addEventListener('input', () => company.setCustomValidity(''));
  name.addEventListener('input', () => name.setCustomValidity(''));
  // Deshabilita envíos duplicados y descarta respuestas de pantallas abandonadas.
  async function submit(form, request, next) {
    const version = screenVersion;
    const button = form.querySelector('[type="submit"]');
    const error = form.querySelector('.form-error');
    if (button.disabled) return;
    button.disabled = true;
    error.hidden = true;
    try {
      const result = await request();
      if (version !== screenVersion) return;
      if (!result || !/^\d{3}-\d{3}$/.test(result.id)) throw new Error('El servicio no devolvió un ID válido.');
      player = result;
      next(result);
    } catch (failure) {
      if (version !== screenVersion) return;
      error.textContent = failure.message || 'No se pudo continuar. Inténtalo de nuevo.';
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  }
  registration.addEventListener('submit', event => {
    event.preventDefault();
    name.value = name.value.trim();
    company.value = company.value.trim();
    name.setCustomValidity(name.value ? '' : 'Escribe tu nombre.');
    company.setCustomValidity(company.value ? '' : 'Escribe tu empresa.');
    phone.setCustomValidity(/^\d{10}$/.test(phone.value) ? '' : 'El celular debe tener 10 dígitos.');
    if (!registration.reportValidity()) return;
    submit(registration, () => window.PlayerService.register({ name: name.value, email: email.value.trim(), phone: phone.value, company: company.value }), result => {
      const [first, last] = result.id.split('-');
      document.querySelector('#assigned-id-first').textContent = first;
      document.querySelector('#assigned-id-last').textContent = last;
      show('your-id', '#id-next');
    });
  });
  idForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!idForm.reportValidity()) return;
    const id = document.querySelector('#id-first').value + '-' + document.querySelector('#id-last').value;
    submit(idForm, () => window.PlayerService.lookup(id), () => show('instructions', '#start-game'));
  });
  document.querySelector('#id-next').addEventListener('click', () => {
    if (player) show('instructions', '#start-game');
  });
  document.querySelector('#start-game').addEventListener('click', () => {
    if (currentScreen !== 'instructions') return;
    show('play', '#play');
    document.dispatchEvent(new CustomEvent('megacontrol:start', { detail: { player } }));
  });
  document.addEventListener('megacontrol:finish', event => {
    if (currentScreen !== 'play' || !['won', 'lost'].includes(event.detail)) return;
    show(event.detail, '#' + event.detail);
    resultTimer = setTimeout(() => {
      show('final', '#final');
      resultTimer = setTimeout(() => show('thanks', '#thanks'), FINAL_DURATION_MS);
    }, RESULT_DURATION_MS);
  });
  function returnToStart() {
    if (currentScreen !== 'thanks') return;
    player = null;
    registration.reset();
    idForm.reset();
    name.setCustomValidity('');
    phone.setCustomValidity('');
    company.setCustomValidity('');
    document.querySelectorAll('.form-error').forEach(error => { error.hidden = true; error.textContent = ''; });
    document.querySelector('#assigned-id-first').textContent = '321';
    document.querySelector('#assigned-id-last').textContent = '321';
    document.dispatchEvent(new Event('megacontrol:reset'));
    show('welcome', '#welcome-next');
  }
  window.addEventListener('keydown', event => {
    if (currentScreen !== 'thanks') return;
    // Evita que una tecla sostenida durante el juego omita el agradecimiento.
    event.preventDefault();
    if (!event.repeat) returnToStart();
  });
  document.querySelector('#thanks').addEventListener('pointerdown', event => { event.preventDefault(); returnToStart(); });
})();
