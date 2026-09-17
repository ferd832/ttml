import { useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import StarField from './StarField';
import Register from './Register';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSupabaseConfigured() || !supabase) {
      setError('Авторизация не настроена. Обратитесь к администратору.');
      return;
    }
    
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('Неверный email или пароль');
    }
    setLoading(false);
  };

  if (showRegister) {
    return <Register onBack={() => setShowRegister(false)} onSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <StarField />
      
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Premium glass card */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 rounded-3xl blur-xl opacity-20 animate-pulse"></div>
          
          {/* Main card */}
          <div className="relative glass-strong rounded-3xl p-10 border border-purple-500/20 shadow-2xl">
            {/* Logo */}
            <div className="text-center mb-10">
              <h1 className="text-3xl font-black cosmic-text tracking-wider mb-2">PLANET MUSIC</h1>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300 text-center backdrop-blur-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-xs text-purple-300/70 mb-2 ml-1 font-medium tracking-wide uppercase">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full cosmic-input rounded-xl px-5 py-3.5 text-sm text-white placeholder-purple-300/30 transition-all focus:scale-[1.02]"
                  placeholder="you@planet.music"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-purple-300/70 mb-2 ml-1 font-medium tracking-wide uppercase">Пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full cosmic-input rounded-xl px-5 py-3.5 text-sm text-white placeholder-purple-300/30 transition-all focus:scale-[1.02]"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full cosmic-btn py-4 rounded-xl text-sm font-bold text-white mt-8 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/30"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Вход...
                  </span>
                ) : 'Войти'}
              </button>
            </form>

            {!isSupabaseConfigured() && (
              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 text-center">
                💡 Авторизация не настроена. Создайте .env файл с ключами Supabase.
              </div>
            )}

            {isSupabaseConfigured() && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowRegister(true)}
                  className="text-sm text-purple-300/60 hover:text-purple-200 transition-colors"
                >
                  Нет аккаунта? Зарегистрироваться
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
