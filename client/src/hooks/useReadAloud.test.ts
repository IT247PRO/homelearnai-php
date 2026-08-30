import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useReadAloud } from './useReadAloud';

class MockUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

// Installed fresh at the start of each test that needs it rather than torn down in an afterEach:
// testing-library's own afterEach (setupTests.ts) unmounts the rendered hook after every test,
// which runs useReadAloud's cleanup effects (removeEventListener/cancel) — those must still find
// a defined window.speechSynthesis at that point, so nothing here deletes it mid-suite.
function installSpeechSynthesisMock() {
  const mock = {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, 'speechSynthesis', { value: mock, configurable: true, writable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: MockUtterance,
    configurable: true,
    writable: true,
  });
  return mock;
}

describe('useReadAloud', () => {
  it('reports unsupported and never touches speechSynthesis when the API is absent', () => {
    Reflect.deleteProperty(window, 'speechSynthesis');
    const { result } = renderHook(() => useReadAloud());
    expect(result.current.status).toBe('unsupported');

    act(() => result.current.speak('hello'));
    expect(result.current.status).toBe('unsupported');
  });

  it('speak() strips markdown/HTML via toSpeechText before constructing the utterance', () => {
    const mock = installSpeechSynthesisMock();
    const { result } = renderHook(() => useReadAloud());

    act(() => result.current.speak('<p>**Bold** _text_</p>'));

    expect(mock.speak).toHaveBeenCalledTimes(1);
    const utterance = mock.speak.mock.calls[0][0] as MockUtterance;
    expect(utterance.text).toBe('Bold text');
    expect(result.current.status).toBe('speaking');
  });

  it('pause()/resume() call the native methods and toggle status without restarting speech', () => {
    const mock = installSpeechSynthesisMock();
    const { result } = renderHook(() => useReadAloud());

    act(() => result.current.speak('some content'));
    act(() => result.current.pause());
    expect(mock.pause).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('paused');

    act(() => result.current.resume());
    expect(mock.resume).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('speaking');
    // Resuming must not call speak() again — that would restart from the beginning.
    expect(mock.speak).toHaveBeenCalledTimes(1);
  });

  it('stop() cancels speech and resets status to idle', () => {
    const mock = installSpeechSynthesisMock();
    const { result } = renderHook(() => useReadAloud());

    act(() => result.current.speak('some content'));
    act(() => result.current.stop());

    expect(mock.cancel).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('cancels speech synthesis on unmount so audio does not keep playing after navigation', () => {
    const mock = installSpeechSynthesisMock();
    const { result, unmount } = renderHook(() => useReadAloud());

    act(() => result.current.speak('some content'));
    mock.cancel.mockClear();
    unmount();

    expect(mock.cancel).toHaveBeenCalled();
  });
});
