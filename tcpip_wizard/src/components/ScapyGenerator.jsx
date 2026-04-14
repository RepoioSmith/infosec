import { useState } from 'react';
import { LAYERS } from '../data/protocols';

export default function ScapyGenerator({ layers, fieldValues, protocol }) {
  const [copied, setCopied] = useState(false);

  const code = generateScapyCode(layers, fieldValues, protocol);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Scapy Output</div>
        <button
          onClick={handleCopy}
          className={`copy-btn text-xs px-3 py-1 rounded font-mono border transition-all ${
            copied
              ? 'bg-green-400 text-slate-900 border-green-400'
              : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-green-400 hover:text-green-400'
          }`}
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>

      <div className="flex-1 rounded bg-slate-950 border border-slate-700 p-3 overflow-y-auto">
        <pre className="scapy-code text-green-400 whitespace-pre-wrap leading-relaxed">
          {code}
        </pre>
      </div>

      {/* Quick reference */}
      <div className="rounded bg-slate-800 border border-slate-700 p-2">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Quick Start — Scapy REPL</div>
        <div className="font-mono text-slate-400 leading-relaxed" style={{ fontSize: '11px' }}>
          <div><span className="text-slate-600">$</span> <span className="text-yellow-400">sudo scapy</span></div>
          <div><span className="text-slate-600">&gt;&gt;&gt;</span> <span className="text-blue-400">send</span>(pkt)         <span className="text-slate-600"># L3 send</span></div>
          <div><span className="text-slate-600">&gt;&gt;&gt;</span> <span className="text-blue-400">sendp</span>(pkt)        <span className="text-slate-600"># L2 send</span></div>
          <div><span className="text-slate-600">&gt;&gt;&gt;</span> <span className="text-blue-400">sr1</span>(pkt)          <span className="text-slate-600"># send + recv 1</span></div>
          <div><span className="text-slate-600">&gt;&gt;&gt;</span> <span className="text-blue-400">pkt.show</span>()       <span className="text-slate-600"># inspect layers</span></div>
          <div><span className="text-slate-600">&gt;&gt;&gt;</span> <span className="text-blue-400">hexdump</span>(pkt)     <span className="text-slate-600"># hex view</span></div>
          <div><span className="text-slate-600">&gt;&gt;&gt;</span> <span className="text-blue-400">wrpcap</span>(<span className="text-green-400">'x.pcap'</span>, pkt) <span className="text-slate-600"># save pcap</span></div>
        </div>
      </div>
    </div>
  );
}

function generateScapyCode(layers, fieldValues, protocol) {
  const lines = ['from scapy.all import *', ''];

  const layerParts = [];

  for (const layerId of layers) {
    const layer = LAYERS[layerId];
    const args = [];

    for (const field of layer.fields) {
      const val = fieldValues[field.id] ?? field.default;
      if (val !== field.default) {
        const formatted = formatValue(field, val);
        args.push(`${field.scapyKey}=${formatted}`);
      }
    }

    const argStr = args.length > 0 ? args.join(', ') : '';
    layerParts.push(`${layer.scapyClass}(${argStr})`);
  }

  if (layerParts.length === 1) {
    lines.push(`pkt = ${layerParts[0]}`);
  } else {
    lines.push(`pkt = (`);
    layerParts.forEach((part, i) => {
      const sep = i < layerParts.length - 1 ? ' /' : '';
      lines.push(`    ${part}${sep}`);
    });
    lines.push(`)`);
  }

  lines.push('');
  lines.push('# Inspect the packet');
  lines.push('pkt.show()');
  lines.push('');

  if (['TCP', 'UDP', 'ICMP'].includes(protocol)) {
    lines.push('# Send at Layer 3 (IP routing)');
    lines.push('send(pkt)');
    lines.push('');
    lines.push('# Send multiple packets');
    lines.push('send(pkt, count=10)');
  } else if (protocol === 'ARP') {
    lines.push('# Send ARP at Layer 2');
    lines.push('sendp(pkt, iface="eth0")');
  }

  lines.push('');
  lines.push('# Send and capture reply');
  lines.push('reply = sr1(pkt, timeout=2)');
  lines.push('if reply:');
  lines.push('    reply.show()');

  return lines.join('\n');
}

function formatValue(field, val) {
  if (field.type === 'text' || field.type === 'select') {
    // Check if it looks like a number
    if (!isNaN(val) && val !== '' && field.type !== 'select') {
      return val;
    }
    // Numeric select values
    if (field.type === 'select' && !isNaN(val)) {
      return val;
    }
    return `"${val}"`;
  }
  return val;
}
