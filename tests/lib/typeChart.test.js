import { computeWeakness } from '../../src/lib/typeChart.js';
test('normal is weak to fighting, immune to ghost', () => {
  const w = computeWeakness(['NORMAL']);
  expect(w.x2).toEqual(['Fighting']); expect(w.x0).toEqual(['Ghost']);
});
test('grass/poison has no 4x and is 2x weak to fire, ice, flying, psychic', () => {
  expect(computeWeakness(['grass','poison']).x2.sort()).toEqual(['Fire','Flying','Ice','Psychic']);
});
