import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Mail, Lock, AlertCircle, Eye, EyeOff, Users } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

const demoAccounts = [
  { email: 'admin@canunited.com', role: 'Administrator', description: 'Full access to all features' },
  { email: 'analyst@canunited.com', role: 'Analyst', description: 'Analytics, reports, read-only access' },
  { email: 'tech@canunited.com', role: 'Technician', description: 'Field operations, maintenance tasks' },
  { email: 'viewer@canunited.com', role: 'Viewer', description: 'Read-only dashboard access' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('admin@canunited.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 bg-circuit-pattern p-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="glass rounded-2xl p-8 gradient-border">
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-emerald-500 rounded-2xl mb-4 glow-green"
            >
              <Zap className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-display font-bold text-white">CANUnited</h1>
            <p className="text-slate-400 mt-1">Asset Manager Platform</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input w-full pl-10"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input w-full pl-10 pr-10"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-primary-400" />
              <p className="text-xs text-slate-400 font-medium">Demo Accounts (password: password123)</p>
            </div>
            <div className="space-y-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => setEmail(account.email)}
                  className={`w-full text-left p-2 rounded-lg transition-colors ${
                    email === account.email
                      ? 'bg-primary-500/20 border border-primary-500/30'
                      : 'bg-slate-700/30 hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-300">{account.email}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      account.role === 'Administrator' ? 'bg-purple-500/20 text-purple-400' :
                      account.role === 'Analyst' ? 'bg-blue-500/20 text-blue-400' :
                      account.role === 'Technician' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {account.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{account.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Multi-vendor Electrical Asset Intelligence Platform
        </p>
      </motion.div>
    </div>
  );
}
