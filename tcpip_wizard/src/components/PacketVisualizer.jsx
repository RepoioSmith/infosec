import { LAYERS } from '../data/protocols';

const LAYER_ORDER = ['ethernet', 'ip', 'tcp', 'udp', 'icmp', 'arp'];

export default function PacketVisualizer({ layers, selectedField, onFieldClick }) {
  const orderedLayers = LAYER_ORDER.filter(l => layers.includes(l));

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="text-xs text-slate-500 uppercase tracking-widest mb-1 font-bold">
        Packet Structure
      </div>
      {orderedLayers.map(layerId => {
        const layer = LAYERS[layerId];
        return (
          <div key={layerId} className="rounded border border-slate-700 overflow-hidden">
            {/* Layer header */}
            <div
              className="px-2 py-1 text-xs font-bold tracking-wider uppercase flex items-center gap-2"
              style={{ backgroundColor: layer.color + '33', borderBottom: `1px solid ${layer.color}55` }}
            >
              <span style={{ color: layer.color }}>{layer.label}</span>
              <span className="text-slate-500 font-normal normal-case">
                Layer {layerId === 'ethernet' ? '2' : layerId === 'ip' || layerId === 'arp' ? '3' : '4'}
              </span>
            </div>
            {/* Fields as bit blocks */}
            <div className="flex flex-wrap gap-0.5 p-1.5 bg-slate-900">
              {layer.fields.map(field => {
                const isSelected = selectedField?.id === field.id;
                const widthClass = getWidthClass(field.bits);
                return (
                  <div
                    key={field.id}
                    className={`field-block rounded text-center text-xs py-1 px-1 ${widthClass} ${isSelected ? 'selected' : ''}`}
                    style={{
                      backgroundColor: isSelected ? layer.color : layer.color + '44',
                      borderColor: layer.color + '88',
                      border: '1px solid',
                      color: isSelected ? '#000' : layer.color,
                      minWidth: '36px',
                    }}
                    onClick={() => onFieldClick(field, layerId)}
                    title={`${field.label} (${field.bits} bits)`}
                  >
                    <div className="font-bold truncate leading-tight" style={{ fontSize: '10px' }}>
                      {field.label}
                    </div>
                    <div style={{ fontSize: '9px', opacity: 0.75 }}>{field.bits}b</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="mt-1 text-slate-600 text-center" style={{ fontSize: '10px' }}>
        Click any field to inspect &amp; edit
      </div>
    </div>
  );
}

function getWidthClass(bits) {
  if (bits <= 4) return 'w-8';
  if (bits <= 8) return 'w-12';
  if (bits <= 16) return 'w-16';
  if (bits <= 32) return 'w-24';
  return 'w-32';
}
