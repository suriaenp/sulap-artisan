import { describe, it, expect } from 'vitest';
import { pathForState, parsePath } from './router';

describe('pathForState', () => {
  it('maps the public view to /', () => {
    expect(pathForState({ view: 'public' })).toBe('/');
  });

  it('maps vendor login/register/dashboard screens', () => {
    expect(pathForState({ view: 'vendor', vScreen: 'login' })).toBe('/vendor/login');
    expect(pathForState({ view: 'vendor', vScreen: 'register' })).toBe('/vendor/register');
    expect(pathForState({ view: 'vendor', vScreen: 'dashboard', vTab: 'payments' })).toBe('/vendor/payments');
  });

  it('falls back to the default vendor tab for an unknown/missing vTab', () => {
    expect(pathForState({ view: 'vendor', vScreen: 'dashboard', vTab: 'not-a-real-tab' })).toBe('/vendor/events');
    expect(pathForState({ view: 'vendor', vScreen: 'dashboard' })).toBe('/vendor/events');
  });

  it('maps admin login/reset/dashboard screens', () => {
    expect(pathForState({ view: 'admin', aScreen: 'login' })).toBe('/admin/login');
    expect(pathForState({ view: 'admin', aScreen: 'reset' })).toBe('/admin/login');
    expect(pathForState({ view: 'admin', aScreen: 'dashboard', aTab: 'vendors' })).toBe('/admin/vendors');
  });

  it('falls back to the default admin tab for an unknown/missing aTab', () => {
    expect(pathForState({ view: 'admin', aScreen: 'dashboard', aTab: 'not-a-real-tab' })).toBe('/admin/overview');
    expect(pathForState({ view: 'admin', aScreen: 'dashboard' })).toBe('/admin/overview');
  });

  it('never surfaces the hidden My Account tab as a URL', () => {
    expect(pathForState({ view: 'admin', aScreen: 'dashboard', aTab: 'account' })).toBe('/admin/overview');
    expect(pathForState({ view: 'vendor', vScreen: 'dashboard', vTab: 'account' })).toBe('/vendor/events');
  });
});

describe('parsePath', () => {
  it('parses the root path as public', () => {
    expect(parsePath('/')).toEqual({ view: 'public' });
    expect(parsePath('')).toEqual({ view: 'public' });
  });

  it('parses vendor login/register paths', () => {
    expect(parsePath('/vendor/login')).toEqual({ view: 'vendor', vScreen: 'login' });
    expect(parsePath('/vendor/register')).toEqual({ view: 'vendor', vScreen: 'register' });
  });

  it('parses a known vendor tab as a pending tab behind the login screen, never straight to dashboard', () => {
    expect(parsePath('/vendor/payments')).toEqual({ view: 'vendor', vScreen: 'login', pendingVendorTab: 'payments' });
  });

  it('falls back to vendor login for an unknown vendor tab segment', () => {
    expect(parsePath('/vendor/not-a-real-tab')).toEqual({ view: 'vendor', vScreen: 'login' });
  });

  it('parses a known admin tab as a pending tab behind the login screen, never straight to dashboard', () => {
    expect(parsePath('/admin/vendors')).toEqual({ view: 'admin', aScreen: 'login', pendingAdminTab: 'vendors' });
  });

  it('falls back to admin login for an unknown admin tab segment', () => {
    expect(parsePath('/admin/not-a-real-tab')).toEqual({ view: 'admin', aScreen: 'login' });
  });

  it('never returns dashboard directly for any vendor or admin path', () => {
    for (const path of ['/vendor/login', '/vendor/register', '/vendor/payments', '/vendor/anything']) {
      const result = parsePath(path);
      expect(result.vScreen).not.toBe('dashboard');
    }
    for (const path of ['/admin/login', '/admin/vendors', '/admin/anything']) {
      const result = parsePath(path);
      expect(result.aScreen).not.toBe('dashboard');
    }
  });

  it('falls back safely on path-traversal-shaped and malformed input', () => {
    expect(parsePath('/../../etc/passwd')).toEqual({ view: 'public' });
    expect(parsePath('/vendor/../admin/vendors')).toEqual({ view: 'vendor', vScreen: 'login' });
    expect(parsePath('///vendor///payments///')).toEqual({ view: 'vendor', vScreen: 'login', pendingVendorTab: 'payments' });
    expect(parsePath('/VENDOR/PAYMENTS')).toEqual({ view: 'public' });
  });

  it('round-trips pathForState output back through parsePath for every known tab', () => {
    const path = pathForState({ view: 'admin', aScreen: 'dashboard', aTab: 'roles' });
    expect(parsePath(path)).toEqual({ view: 'admin', aScreen: 'login', pendingAdminTab: 'roles' });
  });
});
