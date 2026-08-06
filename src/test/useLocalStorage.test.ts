import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useLocalStorage, encryptValue, decryptValue } from '../hooks/useLocalStorage';

describe('useLocalStorage Hook', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should return initial value when key is not in localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test_key', 'initial_value'));
    expect(result.current[0]).toBe('initial_value');
  });

  it('should update state and localStorage when setter is called', () => {
    const { result } = renderHook(() => useLocalStorage('test_key', 'initial_value'));

    act(() => {
      result.current[1]('updated_value');
    });

    expect(result.current[0]).toBe('updated_value');
    expect(window.localStorage.getItem('test_key')).toBe(JSON.stringify('updated_value'));
  });

  it('should retrieve existing value from localStorage', () => {
    window.localStorage.setItem('test_key', JSON.stringify({ name: 'TauriTerminal' }));

    const { result } = renderHook(() => useLocalStorage('test_key', { name: 'Default' }));
    expect(result.current[0]).toEqual({ name: 'TauriTerminal' });
  });

  it('should handle functional updates correctly', () => {
    const { result } = renderHook(() => useLocalStorage('counter_key', 10));

    act(() => {
      result.current[1]((prev: number) => prev + 5);
    });

    expect(result.current[0]).toBe(15);
    expect(window.localStorage.getItem('counter_key')).toBe(JSON.stringify(15));
  });

  describe('Security and Encryption / Obfuscation', () => {
    it('should correctly encrypt and decrypt strings using the XOR cipher', () => {
      const plaintext = JSON.stringify({ host: '192.168.1.1', user: 'admin' });
      const encrypted = encryptValue(plaintext);
      
      // The encrypted string should be obfuscated (not plain JSON)
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).not.toContain('192.168.1.1');
      
      const decrypted = decryptValue(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should obfuscate sensitive keys when stored in localStorage', () => {
      const sensitiveData = [{ host: 'secure.server.com', keyPath: '/root/.ssh/id_rsa' }];
      const { result } = renderHook(() => useLocalStorage('terminal_ssh_hosts', sensitiveData));

      act(() => {
        result.current[1](sensitiveData);
      });

      const rawStored = window.localStorage.getItem('terminal_ssh_hosts');
      expect(rawStored).toBeDefined();
      expect(rawStored).not.toBeNull();
      
      // Should not be stored in cleartext JSON
      expect(rawStored).not.toContain('secure.server.com');
      expect(rawStored).not.toContain('/root/.ssh/id_rsa');

      // But hook should still retrieve and decrypt it correctly
      const { result: retrieveHook } = renderHook(() => useLocalStorage('terminal_ssh_hosts', []));
      expect(retrieveHook.current[0]).toEqual(sensitiveData);
    });

    it('should fallback to cleartext JSON if stored data is not obfuscated (backward compatibility)', () => {
      const legacyData = [{ host: 'legacy.server.com' }];
      window.localStorage.setItem('terminal_ssh_hosts', JSON.stringify(legacyData));

      const { result } = renderHook(() => useLocalStorage('terminal_ssh_hosts', []));
      expect(result.current[0]).toEqual(legacyData);
    });
  });
});
