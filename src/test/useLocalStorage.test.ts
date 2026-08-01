import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useLocalStorage } from '../hooks/useLocalStorage';

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
});
