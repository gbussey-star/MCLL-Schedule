/* MCLL schedule console - settings.
   Everything a commissioner might need to change lives in this one file. */
window.MCLL_CONFIG = {
  title: 'MCLL schedule console',
  season: 'Fall 2026',
  dataFile: 'data/schedule.csv',          // the latest TeamLinkt export, verbatim

  /* Tabs. A game lands in the first program whose test matches its TeamLinkt
     "Group" (Sport - Division - Region). */
  programs: [
    { id:'UC', name:'Upper County', test:g => g.sport==='Baseball' && /upper/i.test(g.region) },
    { id:'LC', name:'Lower County', test:g => g.sport==='Baseball' && /lower/i.test(g.region) },
    { id:'SB', name:'Softball',     test:g => g.sport==='Softball' },
    { id:'AC', name:'All County',   test:g => true }   // Intermediates, Juniors, anything unassigned
  ],

  /* Division colours, first match wins (tested against the division name). */
  colors: [
    [/senior/i,'#3F3566'], [/junior/i,'#5E4A86'], [/intermediate/i,'#7C4F78'],
    [/majors/i,'#1B4A5A'], [/aaa/i,'#2A6E82'], [/\baa\b/i,'#4E93A3'],
    [/hybrid|minors a\b/i,'#4A6B2E'], [/rookie/i,'#8FA84E'],
    [/coach pitch/i,'#6B8C3A'], [/tee/i,'#C2A63C']
  ],

  /* Fields with lights - the sunset rule skips them. Matched as "contains". */
  litFields: ['Lakelands Park', 'Walker Field', 'Ridge Road Regional Park', 'Olney Manor'],

  /* Teams run by the same coach. One list per coach, exact TeamLinkt team
     names. The console also guesses from matching surnames (as a warning). */
  coachLinks: [
    ['UC CP-RB - Gruver', 'Team 1 - UC TB - Gruver'],
    ['UC CP-RB - Lynd', 'UC Minors AA - Lynd'],
    ['UC CP-RB - Holt', 'Team 4  - UC CP-SR - McCloskey']
  ],

  sunsetGrace: 15,     // minutes after sunset a game may still finish
  minGap: 30,          // minutes a coach needs between games on one field
  travelGap: 45,       // ... when the coach changes fields
  lat: 39.10, lon: -77.15
};
