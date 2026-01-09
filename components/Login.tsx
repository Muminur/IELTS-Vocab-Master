import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendSignInLinkToEmail 
} from 'firebase/auth';
import { auth } from '../firebase';

type AuthMode = 'login' | 'signup' | 'magic';

const Login: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const cleanEmail = email.trim();
    
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      }
    } catch (err: any) {
      console.error("Auth Error:", err.code, err.message);
      if (err.code === 'auth/email-already-in-use') {
         setError("This email is already registered.");
      } else if (err.code === 'auth/wrong-password') {
         setError("Incorrect password.");
      } else if (err.code === 'auth/user-not-found') {
         setError("No account found with this email. Please sign up.");
      } else if (err.code === 'auth/weak-password') {
         setError("Password should be at least 6 characters.");
      } else if (err.code === 'auth/invalid-email') {
         setError("Please enter a valid email address.");
      } else if (err.code === 'auth/invalid-credential') {
         // This error consolidates 'user-not-found' and 'wrong-password' for security
         setError("Invalid email or password. If you don't have an account, please Sign Up.");
      } else {
         setError(`Authentication failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const cleanEmail = email.trim();
    const continueUrl = `${window.location.origin}${window.location.pathname}`;

    const actionCodeSettings = {
      url: continueUrl, 
      handleCodeInApp: true,
    };

    try {
      await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', cleanEmail);
      setMessage('Check your email for the sign-in link!');
      setLoading(false);
    } catch (err: any) {
      console.error("Magic Link Error:", err.code, err.message);
      if (err.code === 'auth/invalid-continue-uri') {
        setError("Setup Error: Domain not authorized.");
      } else if (err.code === 'auth/missing-continue-uri') {
        setError("Setup Error: Missing continue URL.");
      } else if (err.code === 'auth/unauthorized-continue-uri') {
        setError("Setup Error: This domain (e.g. localhost or stackblitz) is not in the Firebase Authorized Domains list.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else {
        setError("Failed to send magic link. Please try Password login.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-fade-in">
       {/* Logo / Header */}
       <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl text-white font-bold text-3xl mb-4 shadow-xl transform -rotate-3">
                I
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2">IELTS Vocab Master</h1>
            <p className="text-slate-600 dark:text-slate-400">Your personal journey to vocabulary mastery.</p>
       </div>

       <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors">
            {/* Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-700">
                <button 
                    onClick={() => { setMode('login'); setError(null); setMessage(null); }}
                    className={`flex-1 py-4 text-sm font-semibold transition-colors ${mode !== 'magic' ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-slate-700/50' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                    Password
                </button>
                <button 
                    onClick={() => { setMode('magic'); setError(null); setMessage(null); }}
                    className={`flex-1 py-4 text-sm font-semibold transition-colors ${mode === 'magic' ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-slate-700/50' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                    Magic Link
                </button>
            </div>

            <div className="p-8">
                {error && (
                    <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-800 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                             <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>{error}</span>
                        </div>
                        {error.includes("already registered") && (
                            <button onClick={() => setMode('login')} className="text-left text-xs font-bold underline hover:text-red-800 dark:hover:text-red-200 ml-7">
                                Switch to Login
                            </button>
                        )}
                         {error.includes("authorized") && (
                            <p className="ml-7 text-xs opacity-80">
                                Please try the "Password" tab instead, as it does not require domain whitelisting in some configurations.
                            </p>
                        )}
                    </div>
                )}
                {message && (
                    <div className="mb-6 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm rounded-lg border border-green-100 dark:border-green-800 flex items-start gap-2">
                         <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {message}
                    </div>
                )}

                {mode === 'magic' ? (
                    <form onSubmit={handleMagicLink} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="you@example.com"
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Sending...' : 'Send Magic Link'}
                        </button>
                        <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-4">
                            We'll send a secure link to your email to sign in instantly.
                        </p>
                    </form>
                ) : (
                    <form onSubmit={handleEmailPasswordAuth} className="space-y-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="you@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                            <input 
                                type="password" 
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Processing...' : (mode === 'signup' ? 'Create Account' : 'Sign In')}
                        </button>

                        <div className="pt-4 text-center">
                            {mode === 'login' ? (
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Don't have an account?{' '}
                                    <button 
                                        type="button"
                                        onClick={() => setMode('signup')}
                                        className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                                    >
                                        Sign up
                                    </button>
                                </p>
                            ) : (
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Already have an account?{' '}
                                    <button 
                                        type="button"
                                        onClick={() => setMode('login')}
                                        className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                                    >
                                        Log in
                                    </button>
                                </p>
                            )}
                        </div>
                    </form>
                )}
            </div>
       </div>
    </div>
  );
};

export default Login;