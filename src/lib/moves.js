const MOVE_METHODS = [
  { key:'start', label:'Start' },
  { key:'lv', label:'Level' },
  { key:'tutor', label:'Tutor' },
  { key:'tmhm', label:'TM/HM' },
  { key:'egg', label:'Egg' },
  { key:'special', label:'Special' }
];

function groupMoves(list = []){
  const out = { start: [], lv: [], tutor: [], tmhm: [], egg: [], special: [] };
  for (const mv of list){
    switch(mv.type){
      case 'level':
        if (mv.level <= 1) out.start.push(mv.name);
        else out.lv.push({ level: mv.level, move: mv.name });
        break;
      case 'move_tutor':
        out.tutor.push(mv.name);
        break;
      case 'move_learner_tools':
        out.tmhm.push(mv.name);
        break;
      case 'egg_moves':
        out.egg.push(mv.name);
        break;
      case 'special_moves':
      case 'special_egg':
        out.special.push(mv.name);
        break;
      default:
        break;
    }
  }
  out.lv.sort((a,b) => a.level - b.level);
  return out;
}

export { MOVE_METHODS, groupMoves };
