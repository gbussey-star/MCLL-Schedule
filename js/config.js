/* MCLL schedule console - settings.
   Everything a commissioner might need to change lives in this one file. */
window.MCLL_CONFIG = {
  title: 'MCLL Schedule',
  season: 'Fall 2026',
  dataFile: 'data/schedule.csv',          // the latest TeamLinkt export, verbatim
  permitsFile: 'data/permits.csv',        // when MCLL holds each field (source of truth for open time)
  practicesFile: 'data/practices.csv',    // practice assignments, after the practice draft

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
  litFields: ['Lakelands Park', 'Walker Field', 'Ridge Road Regional Park', 'Olney Manor',
              'Laytonia', 'Wheaton Regional Park - Field 3', 'Kelley Park'],

  /* Teams run by the same coach. One list per coach, exact TeamLinkt team
     names. The console also guesses from matching surnames (as a warning). */
  coachLinks: [
    ['UC CP-RB - Gruver', 'Team 1 - UC TB - Gruver'],
    ['UC CP-RB - Lynd', 'UC Minors AA - Lynd'],
    ['UC CP-RB - Holt', 'Team 4  - UC CP-SR - McCloskey']
  ],

  /* Fields and permits.
     Games on a field held only on a practice permit: true = allowed (the county
     usually lets it go), false = flagged by the rule check. */
  gamesOnPracticePermits: true,
  minOpen: 60,         // minutes - shorter gaps are not drawn as open ground

  /* Other spellings of a field -> the name TeamLinkt uses. The permit
     receipts, the practice sheet and the Daily Listing all write fields their
     own way; anything not listed is matched by name where it is unambiguous,
     and the import screen lists whatever it could not place. */
  fieldAliases: {
    "Calverton Galway": "Calverton Galway Local Park - Field 1",
    "Centerway": "Centerway Local Park - Field 1",
    "Cedar Creek LP": "Cedar Creek Local Park - Field 1",
    "Cedar Creek": "Cedar Creek Local Park - Field 1",
    "Darnestown LP": "Darnestown Local Park - Field 1",
    "Darnestown": "Darnestown Local Park - Field 1",
    "Marshall Thurgood": "Thurgood Marshall ES - Field 1",
    "SGMS 1": "Shady Grove MS - Field 1",
    "SGMS 2": "Shady Grove MS - Field 2",
    "Stone Mill ES": "Stone Mill ES - Field 1",
    "Travilah ES": "Travilah Elementary School - Field 1",
    "Beverly Farms": "Beverly Farms Local Park - Field 1",
    "Forest Oak MS": "Forest Oak MS - Field 1",
    "Fountain Hill LP": "Fountain Hills Local Park - Field 1",
    "Fountain Hills": "Fountain Hills Local Park - Field 1",
    "Gaithersburg MS 2": "Gaithersburg MS - Field 2",
    "Hoover MS": "Herbert Hoover MS",
    "Johnsons LP": "Johnsons Local Park - Field 1",
    "Johnsons": "Johnsons Local Park - Field 1",
    "Jones Lane": "Jones Lane ES - Field 1",
    "Rosemont 1": "Rosemont ES - Field 1",
    "Rosemont 2": "Rosemont ES - Field 2",
    "SGRP C": "South Germantown Recreational Park - Field C",
    "SGRP D": "South Germantown Recreational Park - Field D",
    "SGRP E": "South Germantown Recreational Park - Field E",
    "SGRP F": "South Germantown Recreational Park - Field F",
    "RVMS 1": "Ridgeview Middle School - Field 1",
    "RVMS4": "Ridgeview Middle School - Field 4",
    "RVMS 4": "Ridgeview Middle School - Field 4",
    "Twinbrook": "Twinbrook ES - Field 1",
    "Cabin John MS 2": "Cabin John MS - Field 2",
    "Cabin John MS 4": "Cabin John MS - Field 4",
    "Laytonia RP #1": "Laytonia Regional Park (60/90)",
    "Laytonia": "Laytonia Regional Park (60/90)",
    "QO Knolls": "Quince Orchard Knolls Local Park - Field 1",
    "RR2": "Ridge Road Regional Park - Field 2",
    "RR3": "Ridge Road Regional Park - Field 3",
    "Ridge Road #2": "Ridge Road Regional Park - Field 2",
    "Ridge Road #3": "Ridge Road Regional Park - Field 3",
    "Hoyles Mill": "Hoyles Mill Village Local Park - Field 1",
    "Hoyles Mill Village": "Hoyles Mill Village Local Park - Field 1",
    "LL A": "Lakelands Park - Field A",
    "LL B": "Lakelands Park - Field B",
    "Lakelands A": "Lakelands Park - Field A",
    "Lakelands B": "Lakelands Park - Field B",
    "Walker Field": "Morris Park - Walker Field",
    "Wheaton Regional 3": "Wheaton Regional Park - Field 3",
    "Wheaton Regional 6": "Wheaton Regional Park - Field 6",
    "Olney Manor 4": "Olney Manor Rec Park - Field 4",
    "Carderock Spr ES": "Carderock ES - Field 2",
    "Carderock Springs 2": "Carderock ES - Field 2",
    "Kingsview 1": "Kingsview MS - Field 1",
    "Kingsview MS 4": "Kingsview MS - Field 4",
    "Kingsview MS 5": "Kingsview MS - Field 5",
    "Falls Road LP 1": "Falls Road LP",
    "Glenora Park": "Glenora Park - Field 1",
    "KingFarm": "King Farm Park - Field 1",
    "Potomac Woods Upper": "Potomac Woods Park - Upper Field",
    "Layhill LP": "Layhill Local Park - Field 1",
    "Glen Hill 1": "Glen Hills Local Park - Field 1",
    "Glen Hill 2": "Glen Hills Local Park - Field 2",
    "Fallsmead": "Fallsmead Park - Field 1",
    "Stone Mill": "Stone Mill ES - Field 1",
    "Travilah": "Travilah Elementary School - Field 1"
  },

  sunsetGrace: 15,     // minutes after sunset a game may still finish
  minGap: 30,          // minutes a coach needs between games on one field
  travelGap: 45,       // ... when the coach changes fields
  lat: 39.10, lon: -77.15
};
