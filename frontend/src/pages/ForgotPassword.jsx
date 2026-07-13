import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
    } catch (err) { setError(apiError(err)); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-800 p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="mb-4 text-lg font-bold text-gray-800">Reset your password</h1>
        {message && <div className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
        {error && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <input className="input" type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="btn-primary w-full justify-center">Send reset link</button>
        </form>
        <div className="mt-4 text-center text-sm"><Link to="/login" className="text-brand-600 hover:underline">Back to sign in</Link></div>
      </div>
    </div>
  );
}
