import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '@supabase/supabase-js';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { LanguageProvider } from './components/i18n';
import { Provider } from './components/ui/provider';

const supabaseMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('./components/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: supabaseMock.getSession,
      onAuthStateChange: supabaseMock.onAuthStateChange,
      signOut: supabaseMock.signOut,
    },
  },
}));

const fakeSession = {
  user: {
    email: 'farmer@example.com',
    user_metadata: {
      name: 'Farmer',
    },
  },
} as unknown as Session;

const renderApp = (initialPath = '/') =>
  render(
    <Provider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <App />
        </MemoryRouter>
      </LanguageProvider>
    </Provider>,
  );

describe('app routing and detection guard', () => {
  beforeEach(() => {
    supabaseMock.getSession.mockResolvedValue({ data: { session: null } });
    supabaseMock.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
    supabaseMock.signOut.mockResolvedValue({ error: null });
  });

  it('routes the landing CTA to the protected detection page', async () => {
    renderApp('/');

    await userEvent.click(screen.getByRole('button', { name: 'Start detection' }));

    expect(await screen.findByRole('heading', { name: 'Login required' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Analyze Image' })).not.toBeInTheDocument();
  });

  it('blocks direct /detection access when there is no session', async () => {
    renderApp('/detection');

    expect(await screen.findByRole('heading', { name: 'Login required' })).toBeInTheDocument();
    expect(screen.getByText('Create an account or log in before using the maize detection workspace.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Log in' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Sign up' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Analyze Image' })).not.toBeInTheDocument();
  });

  it('renders the detector at /detection when a session exists', async () => {
    supabaseMock.getSession.mockResolvedValue({ data: { session: fakeSession } });

    renderApp('/detection');

    expect(await screen.findByText('Signed in as Farmer')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Analyze Image' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Login required' })).not.toBeInTheDocument();
  });
});
