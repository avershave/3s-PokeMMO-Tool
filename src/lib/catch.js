function calcCatchChance(rate, hpRatio = 1, statusMult = 1, ballMult = 1) {
  if (!rate || rate <= 0) return 0;
  const a = Math.floor((3 - 2 * hpRatio) * rate * ballMult / 3);
  const aStatus = Math.floor(a * statusMult);
  const capped = Math.max(1, Math.min(255, aStatus));
  if (capped >= 255) return 1;
  const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / capped));
  return Math.pow(b / 65535, 4);
}

const STATUS_EFFECT_BUTTONS = [
  { key: 'slp', label: 'SLP' },
  { key: 'frz', label: 'FRZ' },
  { key: 'par', label: 'PAR' },
  { key: 'brn', label: 'BRN' },
  { key: 'psn', label: 'PSN' },
];

const STATUS_MULTIPLIERS = {
  slp: 2,
  frz: 2,
  par: 1.5,
  brn: 1.5,
  psn: 1.5,
};

const createBallIcon = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const BALL_OPTIONS = [
  {
    key: 'pokeball',
    label: 'Poké Ball',
    multiplier: 1,
    icon: createBallIcon(`
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
        <circle cx='16' cy='16' r='15' fill='#ffffff'/>
        <path d='M16 1a15 15 0 0 1 15 15H1A15 15 0 0 1 16 1z' fill='#e33b3b'/>
        <path d='M1 16h30' stroke='#1f1f1f' stroke-width='4' stroke-linecap='round'/>
        <circle cx='16' cy='16' r='5' fill='#ffffff' stroke='#1f1f1f' stroke-width='2'/>
        <circle cx='16' cy='16' r='2.5' fill='#d9d9d9'/>
      </svg>
    `)
  },
  {
    key: 'great-ball',
    label: 'Great Ball',
    multiplier: 1.5,
    icon: createBallIcon(`
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
        <circle cx='16' cy='16' r='15' fill='#ffffff'/>
        <path d='M16 1a15 15 0 0 1 15 15H1A15 15 0 0 1 16 1z' fill='#2f6edb'/>
        <path d='M6 10c2.4-3.5 5.6-5.3 10-5.3S23.6 6.5 26 10l-5 4H11z' fill='#d03636'/>
        <path d='M1 16h30' stroke='#1f1f1f' stroke-width='4' stroke-linecap='round'/>
        <circle cx='16' cy='16' r='5' fill='#ffffff' stroke='#1f1f1f' stroke-width='2'/>
        <circle cx='16' cy='16' r='2.5' fill='#d9d9d9'/>
      </svg>
    `)
  },
  {
    key: 'ultra-ball',
    label: 'Ultra Ball',
    multiplier: 2,
    icon: createBallIcon(`
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
        <circle cx='16' cy='16' r='15' fill='#ffffff'/>
        <path d='M16 1a15 15 0 0 1 15 15H1A15 15 0 0 1 16 1z' fill='#1f1f1f'/>
        <path d='M8 6c2.5-1.8 5.1-3 8-3s5.5 1.2 8 3l-2.5 6h-11z' fill='#ffca28'/>
        <path d='M1 16h30' stroke='#1f1f1f' stroke-width='4' stroke-linecap='round'/>
        <circle cx='16' cy='16' r='5' fill='#ffffff' stroke='#1f1f1f' stroke-width='2'/>
        <circle cx='16' cy='16' r='2.5' fill='#d9d9d9'/>
      </svg>
    `)
  },
  {
    key: 'quick-ball',
    label: 'Quick Ball',
    multiplier: 5,
    icon: createBallIcon(`
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
        <circle cx='16' cy='16' r='15' fill='#ffffff'/>
        <path d='M16 1a15 15 0 0 1 15 15H1A15 15 0 0 1 16 1z' fill='#1f64b6'/>
        <path d='M6 9c2.3-3 5.6-4.6 10-4.6S23.7 6 26 9l-4 4 4 4c-2.3 3-5.6 4.6-10 4.6S8.3 20 6 17l4-4z' fill='#ffe14d'/>
        <path d='M1 16h30' stroke='#1f1f1f' stroke-width='4' stroke-linecap='round'/>
        <circle cx='16' cy='16' r='5' fill='#ffffff' stroke='#1f1f1f' stroke-width='2'/>
        <circle cx='16' cy='16' r='2.5' fill='#d9d9d9'/>
      </svg>
    `)
  },
  {
    key: 'dusk-ball',
    label: 'Dusk Ball',
    multiplier: 2.5,
    icon: createBallIcon(`
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
        <circle cx='16' cy='16' r='15' fill='#ffffff'/>
        <path d='M16 1a15 15 0 0 1 15 15H1A15 15 0 0 1 16 1z' fill='#0e4b3b'/>
        <path d='M6 9c2.4-3.5 5.6-5.3 10-5.3S23.6 5.5 26 9l-3 6H9z' fill='#1f7a5c'/>
        <path d='M1 16h30' stroke='#12332b' stroke-width='4' stroke-linecap='round'/>
        <circle cx='16' cy='16' r='5' fill='#ffffff' stroke='#12332b' stroke-width='2'/>
        <circle cx='16' cy='16' r='2.5' fill='#d9d9d9'/>
      </svg>
    `)
  },
  {
    key: 'repeat-ball',
    label: 'Repeat Ball',
    multiplier: 2.5,
    icon: createBallIcon(`
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
        <circle cx='16' cy='16' r='15' fill='#ffffff'/>
        <path d='M16 1a15 15 0 0 1 15 15H1A15 15 0 0 1 16 1z' fill='#f48c2a'/>
        <path d='M6 9c2.5-3.2 5.7-4.8 10-4.8S23.5 5.8 26 9l-5 4 5 4c-2.5 3.2-5.7 4.8-10 4.8S8.5 20.2 6 17l5-4z' fill='#1f1f1f' opacity='0.6'/>
        <path d='M1 16h30' stroke='#1f1f1f' stroke-width='4' stroke-linecap='round'/>
        <circle cx='16' cy='16' r='5' fill='#ffffff' stroke='#1f1f1f' stroke-width='2'/>
        <circle cx='16' cy='16' r='2.5' fill='#d9d9d9'/>
      </svg>
    `)
  },
  {
    key: 'safari-ball',
    label: 'Safari Ball',
    multiplier: 1.5,
    icon: createBallIcon(`
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
        <circle cx='16' cy='16' r='15' fill='#ffffff'/>
        <path d='M16 1a15 15 0 0 1 15 15H1A15 15 0 0 1 16 1z' fill='#1d4d3b'/>
        <path d='M6 9c2.4-3.5 5.6-5.3 10-5.3S23.6 5.5 26 9l-3 6H9z' fill='#9ec85b'/>
        <path d='M1 16h30' stroke='#1c332a' stroke-width='4' stroke-linecap='round'/>
        <circle cx='16' cy='16' r='5' fill='#ffffff' stroke='#1c332a' stroke-width='2'/>
        <circle cx='16' cy='16' r='2.5' fill='#d9d9d9'/>
      </svg>
    `)
  }
];

export { calcCatchChance, STATUS_EFFECT_BUTTONS, STATUS_MULTIPLIERS, BALL_OPTIONS };
