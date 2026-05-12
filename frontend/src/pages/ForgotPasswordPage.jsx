import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import { authAPI } from '../utils/api.js';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await authAPI.forgotPassword({ email });
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell gradient-light flex min-h-screen items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="shell-panel soft-ring w-full max-w-lg rounded-[32px] p-8"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#fff1e6] text-[#8a4224]">
            <KeyRound size={28} />
          </div>
          <h1 className="text-4xl font-black text-[#1f1a17]">Forgot password</h1>
          <p className="mt-3 text-sm leading-7 text-[#6a5d54]">
            Enter your email and we will generate a password reset link for your account.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl bg-[#fff1ee] px-4 py-3 text-sm font-medium text-[#a24431]">
            {error}
          </div>
        )}

        {result && (
          <div className="mb-5 rounded-2xl bg-[#eef8f3] px-4 py-4 text-sm text-[#2f7d6a]">
            <p className="font-semibold">{result.message}</p>
            {result.note && <p className="mt-2">{result.note}</p>}
            {result.resetUrl && (
              <div className="mt-3">
                <Link
                  to={result.resetUrl.replace('http://localhost:5173', '')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#2f7d6a] px-4 py-2 text-white transition hover:bg-[#256453]"
                >
                  <span>Open reset page</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Email address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-[#8d7a6a]" size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="input-field pl-11"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f1a17] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#362822] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{loading ? 'Generating link...' : 'Generate reset link'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm font-medium text-[#8a4224] hover:underline">
            Back to login
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
