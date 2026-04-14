import { useState } from 'react';
import { PROTOCOLS, ATTACK_PRESETS, LAYERS } from './data/protocols';
import PacketVisualizer from './components/PacketVisualizer';
import FieldInspector from './components/FieldInspector';
import ScapyGenerator from './components/ScapyGenerator';

const PROTOCOL_KEYS = Object.keys(PROTOCOLS);

export default function App() {
  const [protocol, setProtocol] = useState('TCP');
  const [selectedField, setSelectedField] = useState(null);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [fieldValues, setFieldValues] = useState({});

  const currentProto = PROTOCOLS[protocol];
  const layers = currentProto.layers;
  const presets = ATTACK_PRESETS[protocol] || [];

  function handleFieldClick(field, layerId) {
    setSelectedField(field);
    setSelectedLayerId(layerId);
  }

  function handleValueChange(fieldId, value) {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  }

  function applyPreset(preset) {
    setFieldValues(prev => ({ ...prev, ...preset.values }));
    const firstKey = Object.keys(preset.values)[0];
    for (const layerId of layers) {
      const layer = LAYERS[layerId];
      const field = layer.fields.find(f => f.id === firstKey);
      if (field) {
        setSelectedField(field);
        setSelectedLayerId(layerId);
        break;
      }
    }
  }

  function handleProtocolChange(proto) {
    setProtocol(proto);
    setSelectedField(null);
    setSelectedLayerId(null);
    setFieldValues({});
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-green-400">TCP/IP Wizard</span>
          <span className="text-slate-600 text-xs hidden sm:block">— Interactive Packet Inspector &amp; Scapy Generator</span>
        </div>

        {/* Protocol selector */}
        <div className="flex items-center gap-1">
          {PROTOCOL_KEYS.map(key => {
            const proto = PROTOCOLS[key];
            const isActive = protocol === key;
            return (
              <button
                key={key}
                onClick={() => handleProtocolChange(key)}
                className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all border"
                style={{
                  backgroundColor: isActive ? proto.color : proto.color + '15',
                  color: isActive ? '#000' : proto.color,
                  borderColor: isActive ? proto.color : proto.color + '44',
                }}
              >
                {proto.label}
              </button>
            );
          })}
        </div>

        {/* Attack presets */}
        {presets.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-slate-600 text-xs mr-1">Presets:</span>
            {presets.map(preset => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                title={preset.description}
                className="px-2 py-1 rounded text-xs border border-red-800 text-red-400 bg-red-950 hover:bg-red-900 transition-all font-mono"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main 3-panel layout */}
      <main className="flex flex-1 gap-0 overflow-hidden">
        {/* Panel 1: Packet Visualizer */}
        <div className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 p-3 overflow-y-auto">
          <PacketVisualizer
            layers={layers}
            selectedField={selectedField}
            onFieldClick={handleFieldClick}
          />
        </div>

        {/* Panel 2: Field Inspector */}
        <div className="flex-1 border-r border-slate-800 bg-slate-900 p-3 overflow-hidden">
          <FieldInspector
            field={selectedField}
            layerId={selectedLayerId}
            value={selectedField ? (fieldValues[selectedField.id] ?? selectedField.default) : null}
            onChange={handleValueChange}
          />
        </div>

        {/* Panel 3: Scapy Generator */}
        <div className="w-80 flex-shrink-0 bg-slate-900 p-3 overflow-hidden flex flex-col">
          <ScapyGenerator
            layers={layers}
            fieldValues={fieldValues}
            protocol={protocol}
          />
        </div>
      </main>

      {/* Footer status bar */}
      <footer className="flex items-center gap-4 px-4 py-1 border-t border-slate-800 bg-slate-950 text-slate-600 flex-shrink-0" style={{ fontSize: '11px' }}>
        <span>Protocol: <span className="text-slate-400">{protocol}</span></span>
        <span>Layers: <span className="text-slate-400">{layers.join(' / ').toUpperCase()}</span></span>
        {selectedField && (
          <>
            <span>Selected: <span className="text-green-400 font-bold">{selectedField.label}</span></span>
            <span>({selectedField.bits} bits)</span>
          </>
        )}
        <span className="ml-auto">TCP/IP Wizard v1.0 — Educational Use Only</span>
      </footer>
    </div>
  );
}
