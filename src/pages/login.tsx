import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [, setLocation] = useLocation();
    const { login, register } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        
        try {
            if (isRegister) {
                await register(email, password, firstName, lastName);
            } else {
                await login(email, password);
            }
            setLocation('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка аутентификации');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
            <form onSubmit={handleSubmit} className="bg-gray-800/50 backdrop-blur-md p-8 rounded-xl w-96 border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-6 text-center">
                    {isRegister ? 'Создать аккаунт' : 'Добро пожаловать'}
                </h2>
                
                {error && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}
                
                {isRegister && (
                    <>
                        <input
                            type="text"
                            placeholder="Имя"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full p-3 mb-4 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
                        />
                        <input
                            type="text"
                            placeholder="Фамилия"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full p-3 mb-4 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
                        />
                    </>
                )}
                
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 mb-4 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
                    required
                    disabled={isLoading}
                />
                <input
                    type="password"
                    placeholder="Пароль (минимум 6 символов)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 mb-6 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
                    required
                    disabled={isLoading}
                />
                
                <button 
                    type="submit" 
                    className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    disabled={isLoading}
                >
                    {isLoading ? 'Загрузка...' : (isRegister ? 'Зарегистрироваться' : 'Войти')}
                </button>
                
                <p className="text-center text-gray-400 mt-4">
                    {isRegister ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}
                    <button
                        type="button"
                        onClick={() => {
                            setIsRegister(!isRegister);
                            setError('');
                        }}
                        className="ml-2 text-blue-400 hover:text-blue-300"
                    >
                        {isRegister ? 'Войти' : 'Зарегистрироваться'}
                    </button>
                </p>
            </form>
        </div>
    );
};

export default Login;