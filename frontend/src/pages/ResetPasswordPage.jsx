import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { authAPI } from '../utils/api.js';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.resetPassword(token, { password });
      setSuccess(response.data.message);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#eef8f3] text-[#2f7d6a]">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-4xl font-black text-[#1f1a17]">Reset password</h1>
          <p className="mt-3 text-sm leading-7 text-[#6a5d54]">
            Create a new password for your SmartVolunteer account.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl bg-[#fff1ee] px-4 py-3 text-sm font-medium text-[#a24431]">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-2xl bg-[#eef8f3] px-4 py-3 text-sm font-medium text-[#2f7d6a]">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">New password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-[#8d7a6a]" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="input-field pl-11 pr-12"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-4 top-3.5 text-[#8d7a6a]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#4d3e34]">Confirm password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              className="input-field"
              placeholder="Re-enter new password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-2xl bg-[#1f1a17] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#362822] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Resetting password...' : 'Reset password'}
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

export default ResetPasswordPage;
