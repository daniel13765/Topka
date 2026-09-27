// Amélioration UX (demande) : clic sur une ligne du tableau → remplir l'édition.
// Tableau + panneau restent sur la même ligne (layout flex) : aucun défilement.
document.querySelectorAll('tbody tr').forEach((tr) => {
  tr.style.cursor = 'pointer';
  tr.addEventListener('click', () => {
    document.querySelectorAll('tbody tr').forEach((r) => {
      r.classList.remove('bg-primary-tint');
    });
    tr.classList.add('bg-primary-tint');
    const tds = tr.querySelectorAll('td');
    const name = ((tds[0] && tds[0].innerText) || '').trim().split('\n')[0];
    const desc = ((tds[1] && tds[1].innerText) || '').trim();
    const panel = document.querySelector('aside form') && document.querySelector('aside form').closest('aside');
    if (!panel) return;
    const input = panel.querySelector('form input[type="text"]');
    const textarea = panel.querySelector('form textarea');
    if (input) input.value = name;
    if (textarea) textarea.value = desc;
  });
});
