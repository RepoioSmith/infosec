import { LAYERS } from '../data/protocols';

export default function FieldInspector({ field, layerId, value, onChange }) {
  if (!field) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
        <div className="text-4xl">🔍</div>
        <div className="text-sm text-center">
          Click any field in the packet<br />structure to inspect it
        </div>
      </div>
    );
  }

  const layer = LAYERS[layerId];

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      {/* Field header */}
      <div
        className="rounded p-2 flex items-center gap-3"
        style={{ backgroundColor: layer.color + '22', borderLeft: `3px solid ${layer.color}` }}
      >
        <div>
          <div className="font-bold text-sm" style={{ color: layer.color }}>
            {field.label}
          </div>
          <div className="text-slate-500" style={{ fontSize: '11px' }}>
            {layer.label} Layer · {field.bits} bits · <code className="bg-slate-800 px-1 rounded text-xs">{field.scapyKey}</code>
          </div>
        </div>
      </div>

      {/* Value editor */}
      <div className="rounded bg-slate-800 border border-slate-700 p-2">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Value</div>
        {field.type === 'select' ? (
          <select
            value={value ?? field.default}
            onChange={e => onChange(field.id, e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {field.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={field.type === 'number' ? 'number' : 'text'}
            value={value ?? field.default}
            min={field.min}
            max={field.max}
            onChange={e => onChange(field.id, e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
          />
        )}
        <div className="text-slate-600 mt-1" style={{ fontSize: '10px' }}>
          Default: <span className="text-slate-400 font-mono">{field.default}</span>
          {field.min !== undefined && <span> · Range: {field.min}–{field.max}</span>}
        </div>
      </div>

      {/* Description */}
      <div className="rounded bg-slate-800 border border-slate-700 p-2">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Purpose</div>
        <p className="text-slate-300 leading-relaxed" style={{ fontSize: '12px' }}>
          {field.description}
        </p>
      </div>

      {/* Security note */}
      <div className="rounded border p-2" style={{ backgroundColor: '#ef444411', borderColor: '#ef444466' }}>
        <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#ef4444' }}>
          Security Perspective
        </div>
        <p className="text-slate-300 leading-relaxed" style={{ fontSize: '12px' }}>
          {field.security}
        </p>
      </div>

      {/* Attack techniques */}
      <div className="rounded bg-slate-800 border border-slate-700 p-2">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Known Attacks</div>
        <div className="flex flex-wrap gap-1">
          {field.attacks.map((atk, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{ backgroundColor: '#f9731622', color: '#f97316', border: '1px solid #f9731644' }}
            >
              {atk}
            </span>
          ))}
        </div>
      </div>

      {/* CVE / Reference */}
      <div className="rounded bg-slate-800 border border-slate-700 p-2">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Reference</div>
        <p className="text-slate-500 leading-relaxed font-mono" style={{ fontSize: '11px' }}>
          {field.cve}
        </p>
      </div>
    </div>
  );
}
