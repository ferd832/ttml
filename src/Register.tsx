import { useState } from 'react';
import { supabase } from './supabaseClient';
import StarField from './StarField';

interface RegisterProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function Register({ onBack, onSuccess }: RegisterProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Проверка кода приглашения
    const { data: codeData, error: codeError } = await supabase
      .from('invite_codes')
      .select('code')
      .eq('code', inviteCode.toUpperCase())
      .is('used_by', null)
      .single();

    if (codeError || !codeData) {
      setError('Неверный или уже использованный код приглашения');
      setLoading(false);
      return;
    }

    // Регистрация пользователя
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Помечаем код как использованный
    if (authData.user) {
      await supabase
        .from('invite_codes')
        .update({ 
          used_by: authData.user.id, 
          used_at: new Date().toISOString() 
        })
        .eq('code', inviteCode.toUpperCase());
    }

    setLoading(false);
    onSuccess();
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <StarField />
      
      <div className="relative z-10 w-full max-w-md p-8 glass-strong rounded-2xl border border-purple-500/20 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto relative animate-spin-slow mb-4">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <ellipse cx="50" cy="50" rx="45" ry="12" fill="none" stroke="url(#ringGradient1)" strokeWidth="3" opacity="0.6"/>
              <ellipse cx="50" cy="50" rx="40" ry="10" fill="none" stroke="url(#ringGradient2)" strokeWidth="2" opacity="0.4"/>
              <defs>
                <radialGradient id="planetGradient" cx="40%" cy="40%">
                  <stop offset="0%" stopColor="#c084fc"/>
                  <stop offset="50%" stopColor="#a78bfa"/>
                  <stop offset="100%" stopColor="#7c3aed"/>
                </radialGradient>
                <linearGradient id="ringGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f0abfc"/>
                  <stop offset="50%" stopColor="#c084fc"/>
                  <stop offset="100%" stopColor="#a78bfa"/>
                </linearGradient>
                <linearGradient id="ringGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#e9d5ff"/>
                  <stop offset="100%" stopColor="#d8b4fe"/>
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="20" fill="url(#planetGradient)"/>
              <circle cx="42" cy="42" r="6" fill="white" opacity="0.3"/>
            </svg>
          </div>
          <h1 className="text-2xl font-black cosmic-text tracking-wider">PLANET MUSIC</h1>
          <p className="text-sm text-purple-300/60 mt-2">Регистрация в студии</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300 text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-purple-300/70 mb-1 ml-1">Код приглашения</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full cosmic-input rounded-xl px-4 py-3 text-sm text-white uppercase tracking-wider font-mono"
              placeholder="XXXX-XXXX"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs text-purple-300/70 mb-1 ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full cosmic-input rounded-xl px-4 py-3 text-sm text-white"
              placeholder="you@planet.music"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-purple-300/70 mb-1 ml-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full cosmic-input rounded-xl px-4 py-3 text-sm text-white"
              placeholder="Минимум 6 символов"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full cosmic-btn py-3 rounded-xl text-sm font-bold text-white mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться 🚀'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onBack}
            className="text-sm text-purple-300/60 hover:text-purple-200 transition-colors"
          >
            ← Уже есть аккаунт? Войти
          </button>
        </div>
      </div>
    </div>
  );
}
