
import { User } from '../types';

const USERS_KEY = 'solana_sniper_users';
const CURRENT_USER_KEY = 'solana_sniper_current_user';

// --- INITIAL SEED (Specific Credentials) ---
const seedUsers = () => {
    const existing = localStorage.getItem(USERS_KEY);
    if (!existing) {
        const defaults: User[] = [
            {
                id: 'u_admin',
                username: 'adminsuper',
                passwordHash: '192superstar192!!!',
                role: 'ADMIN',
                email: 'admin@solanasniper.com',
                createdAt: Date.now()
            },
            {
                id: 'u_anton',
                username: 'anton812',
                passwordHash: '!!!anakonda105',
                role: 'USER',
                email: 'anton812@mail.com',
                createdAt: Date.now()
            },
            {
                id: 'u_vitek',
                username: 'vitek192',
                passwordHash: '!!!gnusmas105',
                role: 'USER',
                email: 'vitek192@mail.com',
                createdAt: Date.now()
            }
        ];
        localStorage.setItem(USERS_KEY, JSON.stringify(defaults));
    }
};

// Run seed immediately
seedUsers();

// --- AUTH ACTIONS ---

export const getUsers = (): User[] => {
    try {
        return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    } catch { return []; }
};

const saveUsers = (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const login = (loginName: string, pass: string): { success: boolean; user?: User; error?: string } => {
    const users = getUsers();
    const user = users.find(u => (u.username === loginName || u.email === loginName) && u.passwordHash === pass);
    
    if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        return { success: true, user };
    }
    return { success: false, error: 'Неверный логин или пароль' };
};

export const logout = () => {
    localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
    try {
        const raw = localStorage.getItem(CURRENT_USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
};

// --- USER MANAGEMENT ---

export const updateUserProfile = (userId: string, updates: Partial<User>): boolean => {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return false;

    users[idx] = { ...users[idx], ...updates };
    saveUsers(users);
    
    // Update session if it's the current user
    const current = getCurrentUser();
    if (current && current.id === userId) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(users[idx]));
    }
    return true;
};

// --- ADMIN ACTIONS ---

export const adminCreateUser = (username: string, password: string, email: string): User => {
    const users = getUsers();
    if (users.some(u => u.username === username)) throw new Error("Пользователь с таким именем уже существует");
    
    const newUser: User = {
        id: 'u_' + Date.now(),
        username,
        passwordHash: password,
        email,
        role: 'USER',
        createdAt: Date.now()
    };
    
    users.push(newUser);
    saveUsers(users);
    return newUser;
};

export const adminDeleteUser = (userId: string) => {
    const users = getUsers().filter(u => u.id !== userId);
    saveUsers(users);
};

export const adminResetPassword = (userId: string, newPass: string) => {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
        users[idx].passwordHash = newPass;
        saveUsers(users);
    }
};
