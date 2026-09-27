// Amélioration UX (demande) : clic sur une ligne du tableau → détails dans le panneau
// (showDetails du design). Tableau + panneau sur la même ligne : aucun défilement.
document.querySelectorAll('tbody tr').forEach((tr) => {
  tr.style.cursor = 'pointer';
  tr.addEventListener('click', () => {
    const tds = tr.querySelectorAll('td');
    const txt = (i) => ((tds[i] && tds[i].innerText) || '').trim().replace(/\s+/g, ' ');
    // colonnes : Nom, ID, Zone, Statut, Succès (%), Actions
    const id = txt(1).replace(/^ID\s*:?\s*/i, '');
    document.querySelectorAll('tbody tr').forEach((r) => {
      r.style.background = '';
    });
    tr.style.background = 'rgba(249,115,22,0.08)';
    showDetails(id, txt(0).split('\n')[0], txt(2), txt(3), txt(4));
  });
});
