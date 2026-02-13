import React, { useState } from 'react';
import { useAuthStore } from '../store/auth.store';

interface LoginProps {
  onSwitch: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSwitch }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await window.ironcord.login({ email, password });
      if (response.success && response.user && response.token) {
        setAuth(response.user, response.token);
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during login';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center text-white">
      <div className="w-full max-w-md rounded-lg bg-gray-800 p-8 shadow-xl">
        <h2 className="mb-6 text-center text-3xl font-bold text-white">Welcome back!</h2>
        <p className="mb-8 text-center text-gray-400">We're so excited to see you again!</p>

        {error && (
          <div className="mb-4 rounded bg-red-500/10 p-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-xs font-bold uppercase text-gray-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded bg-gray-900 p-3 text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-xs font-bold uppercase text-gray-400">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded bg-gray-900 p-3 text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-indigo-600 py-3 font-bold transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-400">
          Need an account?{' '}
          <button onClick={onSwitch} className="text-indigo-400 hover:underline">
            Register
          </button>
        </p>
      </div>
    </div>
  );
};
