import { FILTERS } from '../js/core.js';
export const data = [1, 2].flatMap(gradeLevel => FILTERS.flatMap(({ value: filter }, index) =>
  [1, 2, 3, 4].map(n => ({
    id: `test-${gradeLevel}-${index}-${n}`, title: `Test aktivity ${n}`, gradeLevel, filter,
    types: ['Testovací typ'], materials: 'Bez pomôcok',
    steps: ['Vytvorte kruh.', 'Vystriedajte sa v kruhu.', 'Spoločne ukončite aktivitu.'],
    reflection: ['Ako ste sa cítili?'], details: 'Rozšírený testovací návod.'
  }))));
