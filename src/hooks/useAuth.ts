// import { useState, useEffect } from 'react';

// export interface User {
//     id: string;
//     email: string;
//     name?: string;
// }

// export function useAuth() {
//     const [user, setUser] = useState<User | null>(null);
//     const [isAuthenticated, setIsAuthenticated] = useState(false);
//     const [isLoading, setIsLoading] = useState(true);

//     useEffect(() => {
//         // Проверяем localStorage при загрузке
//         const storedUser = localStorage.getItem('user');
//         if (storedUser) {
//             try {
//                 const userData = JSON.parse(storedUser);
//                 setUser(userData);
//                 setIsAuthenticated(true);
//             } catch (e) {
//                 console.error('Failed to parse user:', e);
//             }
//         }
//         setIsLoading(false);
//     }, []);

//     const login = () => {
//         // Перенаправляем на страницу логина
//         window.location.href = '/login';
//     };

//     const logout = () => {
//         localStorage.removeItem('user');
//         localStorage.removeItem('token');
//         setUser(null);
//         setIsAuthenticated(false);
//         window.location.href = '/login';
//     };

//     return { user, isAuthenticated, isLoading, login, logout };
// }

import { useAuth as useAuthContext } from '../contexts/AuthContext';

export const useAuth = () => {
  return useAuthContext();
};