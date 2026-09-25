const tabs = document.querySelectorAll('.tab');
function show(name) {
  for (const t of tabs) {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
    document.getElementById(`tab-${t.dataset.tab}`).hidden = !on;
  }
  if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
}
for (const t of tabs) t.addEventListener('click', () => show(t.dataset.tab));
if (location.hash === '#prestocks') show('prestocks');
