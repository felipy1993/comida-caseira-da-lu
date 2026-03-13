import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithEmailAndPassword, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence 
} from 'firebase/auth';
import { auth } from '../lib/firebase';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await setPersistence(
        auth, 
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      
      await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      let message = 'Falha ao entrar. Verifique suas credenciais.';
      
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'E-mail ou senha incorretos.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Muitas tentativas. Tente novamente mais tarde.';
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] p-4 font-sans selection:bg-orange-500 selection:text-white overflow-hidden relative">
      {/* Immersive Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.3, 0.2],
            x: [0, 50, 0],
            y: [0, 30, 0]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-orange-600/20 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.1, 0.2, 0.1],
            x: [0, -50, 0],
            y: [0, -30, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-amber-600/10 rounded-full blur-[120px]" 
        />
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[460px] z-10 relative"
      >
        {/* Floating Logo Section - Absolute Positioned to overlap */}
        <div className="flex justify-center mb-[-60px] relative z-20">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
                type: "spring", 
                stiffness: 100, 
                damping: 15,
                delay: 0.3 
            }}
            className="relative group"
          >
            {/* Glow behind logo */}
            <div className="absolute inset-0 bg-orange-500/30 rounded-full blur-3xl group-hover:bg-orange-500/50 transition-all duration-700" />
            
            <img 
              src="https://i.postimg.cc/HWtzDHC3/comidacaseiradalu.png" 
              alt="Comida Caseira da Lu Logo" 
              className="w-56 h-56 object-contain relative z-10 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] transform group-hover:scale-105 transition-transform duration-500 cursor-default"
            />
          </motion.div>
        </div>

        {/* Card Component */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 pt-20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden relative">
          {/* Subtle light effect on top of card */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">
              Seja bem-vinda!
            </h1>
            <p className="text-slate-400 font-medium">
              Acesse o sistema de gestão da <span className="text-orange-500">Lu</span>
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm font-semibold"
                >
                  <AlertCircle size={18} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              {/* Email Input */}
              <div className="group">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-orange-500 transition-colors">
                    <Mail size={18} />
                  </div>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all text-white font-medium placeholder:text-slate-600"
                    placeholder="Seu e-mail"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="group">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-orange-500 transition-colors">
                    <Lock size={18} />
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all text-white font-medium placeholder:text-slate-600"
                    placeholder="Sua senha secreta"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 border-2 border-white/10 rounded-md bg-white/5 peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all" />
                  <div className="absolute inset-0 flex items-center justify-center text-white opacity-0 peer-checked:opacity-100 transition-opacity">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">Lembrar acesso</span>
              </label>
            </div>

            {/* Login Button */}
            <motion.button 
              whileHover={{ scale: 1.01, y: -2 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white rounded-2xl font-black text-lg uppercase tracking-wider flex items-center justify-center gap-3 shadow-[0_10px_20px_-5px_rgba(249,115,22,0.4)] hover:shadow-[0_15px_30px_-5px_rgba(249,115,22,0.5)] disabled:opacity-70 disabled:cursor-not-allowed transition-all relative overflow-hidden group/btn"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 pointer-events-none" />
              {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Entrar Agora</span>
                  <LogIn size={20} className="group-hover/btn:translate-x-1 transition-transform" />
                </>
              )}
            </motion.button>
          </form>
        </div>

        {/* Developer Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-12 flex flex-col items-center gap-3"
        >
          <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Desenvolvido por</span>
            <img 
              src="https://i.postimg.cc/5N7ptFSk/logo-dev.png" 
              alt="Developer Logo" 
              className="h-6 object-contain"
            />
          </div>
          <div className="w-8 h-1 bg-orange-500/20 rounded-full" />
        </motion.div>
      </motion.div>
    </div>
  );
}
