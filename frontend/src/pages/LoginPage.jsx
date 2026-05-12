import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import { authAPI } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login({ email, password });
      login(response.data.user, response.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('adminuser@example.com');
    setPassword('admin12345');
  };

  return (
    <div className="app-shell gradient-light relative flex min-h-screen items-center justify-center px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="shell-panel soft-ring rounded-[32px] p-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-8"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1d1736] text-white">
              <CheckCircle size={20} />
            </div>
            <h1 className="text-3xl font-black text-[#1d1736] mb-2">Welcome back</h1>
            <p className="text-[#5f5a7a] text-base font-medium">Sign in to your SmartVolunteer workspace</p>
          </motion.div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-2xl bg-[#fff1ee] px-4 py-3 text-sm font-medium text-[#7f2ea8]"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <label className="block text-sm font-bold text-[#403b63] mb-3">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-[#766e97]" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-field pl-12"
                  placeholder="you@example.com"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="block text-sm font-bold text-[#403b63] mb-3">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-[#766e97]" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-field pl-12 pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-[#766e97]"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-[#1d1736] text-white font-bold text-base shadow-lg transition-all transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-[#2b2457]"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  Login <ArrowRight size={20} />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-4 text-right">
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-[#5b3cc4] transition hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 rounded-2xl bg-[#f1ecff] px-4 py-4"
          >
            <div className="flex items-start gap-3">
              <CheckCircle className="text-[#0f9f75] flex-shrink-0 mt-1" size={20} />
              <div className="flex-1">
                <p className="text-sm font-bold text-[#1d1736] mb-2">Demo Admin Account:</p>
                <p className="text-xs text-[#5f5a7a] font-mono mb-1">adminuser@example.com</p>
                <p className="text-xs text-[#5f5a7a] font-mono mb-3">admin12345</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={fillDemoCredentials}
                  className="w-full px-3 py-2 bg-[#1d1736] text-white text-xs font-bold rounded-lg hover:bg-[#2b2457] transition-colors"
                >
                  Use Demo Credentials
                </motion.button>
              </div>
            </div>
          </motion.div>

          <div className="mt-8 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#ddd5fb]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#f8f5ff] text-[#5f5a7a] font-medium">
                New to SmartVolunteer?
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-center"
          >
            <p className="text-[#5f5a7a] mb-4">Create an account to get started</p>
            <Link
              to="/register"
              className="block px-6 py-3 rounded-2xl border border-[#ddd5fb] text-[#5b3cc4] font-bold text-base hover:bg-[#f1ecff] transition-all transform hover:scale-105"
            >
              Sign Up Now
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-6 text-center"
          >
            <Link to="/" className="text-sm text-[#5f5a7a] hover:text-[#5b3cc4] transition-colors font-medium">
              Back to Home
            </Link>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-[#5f5a7a] text-sm mt-6 font-medium"
        >
                    Secure | Fast | Reliable
        </motion.p>
      </motion.div>
    </div>
  );
};

export default LoginPage;

