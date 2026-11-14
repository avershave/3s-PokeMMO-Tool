// Display helpers for the Pokémon profile. Missing values show as an em dash.
const isNum = (n) => n != null && Number.isFinite(Number(n));
// Event entries store 0 for an unknown height or weight.
const isSize = (n) => isNum(n) && Number(n) > 0;

function formatHeight(h){ return isSize(h) ? `${(h/10).toFixed(1)} m` : '—'; }
function formatWeight(w){ return isSize(w) ? `${(w/10).toFixed(1)} kg` : '—'; }
function formatGenderRatio(r){
  if (!isNum(r)) return '—';
  if (Number(r) === 255) return 'Genderless';
  const female = Math.round((r/255)*100);
  const male = 100 - female;
  return `${male}% ♂ · ${female}% ♀`;
}

export { formatHeight, formatWeight, formatGenderRatio };
