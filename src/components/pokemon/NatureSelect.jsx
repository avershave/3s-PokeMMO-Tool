import { labelNature } from '../../lib/natures.js';

function NatureSelect({ value, onChange, natureList }){
  return (
    <select
      className="input"
      value={value || ''}
      onChange={(e)=> onChange?.(e.target.value)}
      style={{ height: 20, padding: '0 32px 0 14px', minWidth: 140 }}
      title="Nature"
    >
      <option value="">Nature</option>
      {natureList.map((n) => (
        <option key={n.name} value={n.name}>{labelNature(n)}</option>
      ))}
    </select>
  );
}

export default NatureSelect;
