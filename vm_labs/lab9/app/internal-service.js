'use strict';

/**
 * NorthStar Bank — Internal Configuration Service
 * Binds exclusively to 127.0.0.1:8888
 * Not reachable from the public network interface.
 * SSRF target via POST /api/transfer/notify
 */

const express = require('express');
const app     = express();

app.use(express.json());

// Flag 9 target — reached via SSRF: http://localhost:8888/internal/config
app.get('/internal/config', (req, res) => {
  res.json({
    service: 'northstar-internal-v2',
    environment: 'production',
    database:     { host: '127.0.0.1', port: 5432, name: 'northstar_prod', pool_size: 10 },
    cache:        { host: '127.0.0.1', port: 6379, ttl: 3600 },
    integrations: {
      swift_gateway: 'http://10.0.0.50:9090/swift',
      fraud_engine:  'http://10.0.0.51:8080/score',
    },
    feature_flags: { maintenance_mode: false, beta_transfers: true },
    // Internal note — do not expose externally.
    _internal_flag: 'FLAG{ssrf_t4pp3d_th3_1nt3rn4l_n3tw0rk}',
  });
});

app.get('/internal/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), ts: Date.now() });
});

// Plausible Prometheus-style metrics endpoint — adds realism
app.get('/internal/metrics', (req, res) => {
  const r = () => Math.floor(Math.random() * 50000 + 5000);
  res.type('text/plain').send([
    '# HELP http_requests_total Total HTTP requests processed',
    '# TYPE http_requests_total counter',
    `http_requests_total{method="GET",status="200"} ${r()}`,
    `http_requests_total{method="POST",status="200"} ${r()}`,
    `http_requests_total{method="POST",status="401"} ${Math.floor(r()/10)}`,
    '',
    '# HELP db_query_duration_seconds Query latency histogram',
    '# TYPE db_query_duration_seconds histogram',
    'db_query_duration_seconds_bucket{le="0.005"} 8912',
    'db_query_duration_seconds_bucket{le="0.010"} 12403',
    'db_query_duration_seconds_sum 45.2',
    'db_query_duration_seconds_count 14000',
  ].join('\n'));
});

app.listen(8888, '127.0.0.1', () => {
  console.log('[NorthStar Internal Service] Listening on 127.0.0.1:8888');
});
