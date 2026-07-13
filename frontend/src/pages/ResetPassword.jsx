import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api, { apiError } from '../api/client';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError('Passwords do not match');
    try {
      await api.post('/auth/reset-password', { email: params.get('email'), token: params.get('token'), password });
      navigate('/login');
    } catch (err) { setError(apiError(err)); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-800 p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="mb-4 text-lg font-bold text-gray-800">Choose a new password</h1>
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <input className="input" type="password" placeholder="New password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          <input className="input" type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          <button className="btn-primary w-full justify-center">Update password</button>
        </form>
        <div className="mt-4 text-center text-sm"><Link to="/login" className="text-brand-600 hover:underline">Back to sign in</Link></div>
      </div>
    </div>
  );
}
