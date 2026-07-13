import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiError } from '../api/client';
import { signInWithGoogle } from '../utils/firebase.js';

export default function Login() {
  const { login, loginWithFirebase } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(apiError(err));
    } finally { setBusy(false); }
  };

  const handleGoogleSignIn = async () => {
    setBusy(true); setError('');
    try {
      const result = await signInWithGoogle();
      await loginWithFirebase(result.token);
      navigate('/');
    } catch (err) {
      setError(apiError(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-800 p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-lg font-bold text-gray-800">Nationwide Paper Ltd</h1>
        <p className="mb-6 text-sm text-gray-500">IT Inventory Portal — Sign in</p>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <input className="input" type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn-primary w-full justify-center" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <button onClick={handleGoogleSignIn} className="btn-secondary mt-3 w-full justify-center" disabled={busy}>
          <svg width="16" height="16" viewBox="0 0 24 24" className="mr-2">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.49 3.77v3.13h4.03c2.36-2.17 3.71-5.37 3.71-8.75z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.89-3.02c-1.08.72-2.47 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.2A12.004 12.004 0 0 0 12 24z"/>
            <path fill="#FBBC05" d="M5.27 14.26a7.22 7.22 0 0 1 0-4.52V6.54H1.28a11.99 11.99 0 0 0 0 10.92l3.99-3.2z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.22 0 12 0 7.34 0 3.3 2.68 1.28 6.54l3.99 3.2c.95-2.85 3.6-4.99 6.73-4.99z"/>
          </svg>
          Sign in with Google
        </button>
        <a href="/api/auth/microsoft" className="btn-secondary mt-3 w-full justify-center">
          <svg width="16" height="16" viewBox="0 0 21 21" className="mr-2"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
          Sign in with Microsoft 365
        </a>
        <div className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className="text-brand-600 hover:underline">Forgot password?</Link>
        </div>
      </div>
    </div>
  );
}
