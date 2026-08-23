import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider, useTranslation } from './index';

afterEach(() => cleanup());

function Probe() {
  const { locale, setLocale, t } = useTranslation();
  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <p data-testid="greeting">{t('login.title')}</p>
      <p data-testid="missing">{t('this.key.does.not.exist')}</p>
      <button onClick={() => setLocale('es')}>switch</button>
    </div>
  );
}

describe('I18nProvider', () => {
  it('renders the English dictionary by default and switches to Spanish on demand', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('greeting').textContent).toBe('Log in');

    fireEvent.click(screen.getByRole('button', { name: 'switch' }));

    expect(screen.getByTestId('locale').textContent).toBe('es');
    expect(screen.getByTestId('greeting').textContent).toBe('Iniciar sesión');
  });

  it('falls back to the key itself for a missing translation', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    expect(screen.getByTestId('missing').textContent).toBe('this.key.does.not.exist');
  });
});
