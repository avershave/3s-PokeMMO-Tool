function formatHeight(h){ return h==null? '--' : `${(h/10).toFixed(1)} m`; }
function formatWeight(w){ return w==null? '--' : `${(w/10).toFixed(1)} kg`; }
function formatGenderRatio(r){
  if (r == null) return "--";
  const female = Math.round((r/255)*100);
  const male = 100 - female;
  return `${male}% M / ${female}% F`;
}

export { formatHeight, formatWeight, formatGenderRatio };
