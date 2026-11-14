function PokeballIcon({ filled=false, size=20 }){
  const stroke = filled ? '#000' : '#bbb';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="15" fill={filled ? '#fff' : 'none'} stroke={stroke} strokeWidth="2" />
      {filled && <path d="M16 1a15 15 0 0 1 15 15H1A15 15 0 0 1 16 1z" fill="#e53e3e" />}
      <path d="M1 16h30" stroke={stroke} strokeWidth="2" />
      <circle cx="16" cy="16" r="5" fill={filled ? '#fff' : 'none'} stroke={stroke} strokeWidth="2" />
    </svg>
  );
}

export default PokeballIcon;
