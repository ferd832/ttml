import { useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
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
  const [success, setSuccess] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSupabaseConfigured() || !supabase) {
      setError('Авторизация не настроена. Обратитесь к администратору.');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    setNeedsConfirmation(false);

    if (password.length < 6) {
      setError('Пароль должен быть минимум 6 символов');
      setLoading(false);
      return;
    }

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

    // Проверяем, требуется ли подтверждение email
    if (authData.user && !authData.user.email_confirmed_at) {
      setNeedsConfirmation(true);
      setSuccess('✅ Регистрация успешна!');
    } else {
      setSuccess('✅ Регистрация успешна! Перенаправление...');
      setTimeout(() => {
        onSuccess();
      }, 2000);
    }
    
    setLoading(false);
  };

  if (needsConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <StarField />
        
        <div className="relative z-10 w-full max-w-md mx-4">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 rounded-3xl blur-xl opacity-20 animate-pulse"></div>
            
            <div className="relative glass-strong rounded-3xl p-10 border border-green-500/20 shadow-2xl">
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-green-500/50">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-black cosmic-text tracking-wider mb-2">Подтвердите email</h1>
                <p className="text-purple-300/60 text-sm">PLANET MUSIC</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <p className="text-blue-300 text-center mb-2">
                    ✉️ На адрес <span className="font-semibold text-white">{email}</span> отправлено письмо с подтверждением
                  </p>
                  <p className="text-sm text-purple-200/70 text-center">
                    Перейдите по ссылке в письме, чтобы активировать аккаунт
                  </p>
                </div>

                <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl">
                  <p className="text-xs text-purple-300/60 text-center">
                    💡 Если письмо не пришло, проверьте папку "Спам" или попробуйте зарегистрироваться ещё раз
                  </p>
                </div>

                <button
                  onClick={onBack}
                  className="w-full cosmic-btn py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Перейти ко входу →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <StarField />
      
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 rounded-3xl blur-xl opacity-20 animate-pulse"></div>
          
          <div className="relative glass-strong rounded-3xl p-10 border border-purple-500/20 shadow-2xl">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-black cosmic-text tracking-wider mb-2">PLANET MUSIC</h1>
              <p className="text-sm text-purple-300/60">Регистрация в студии</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300 text-center backdrop-blur-sm">
                  ❌ {error}
                </div>
              )}
              
              {success && !needsConfirmation && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-300 text-center backdrop-blur-sm">
                  {success}
                </div>
              )}

              <div>
                <label className="block text-xs text-purple-300/70 mb-2 ml-1 font-medium tracking-wide uppercase">Код приглашения</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full cosmic-input rounded-xl px-5 py-3.5 text-sm text-white uppercase tracking-wider font-mono placeholder-purple-300/30 transition-all focus:scale-[1.02]"
                  placeholder="XXXX-XXXX"
                  required
                />
              </div>
              
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
                  placeholder="Минимум 6 символов"
                  required
                  minLength={6}
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
                    Регистрация...
                  </span>
                ) : 'Создать аккаунт ✨'}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button
                onClick={onBack}
                className="text-sm text-purple-300/60 hover:text-purple-200 transition-colors"
              >
                ← Уже есть аккаунт? Войти
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
