/**
 * NorthStar Bank & Trust — Customer Portal
 * main.js — Shared utilities
 */

'use strict';

// Auth guard — redirect to login if no token
function requireLogin() {
  if (!localStorage.getItem('ns_token')) {
    window.location.href = '/login.html';
  }
}

// Format currency
function fmtCurrency(n) {
  return '$' + Math.abs(Number(n)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Authenticated fetch helper
function authFetch(url, options = {}) {
  const token = localStorage.getItem('ns_token');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? 'Bearer ' + token : '',
      ...(options.headers || {}),
    },
  });
}
