

import { User, SecurityConfig, BlockedEntity, SecurityLog } from '../types';

const USERS_KEY = 'solana_sniper_users';
const CURRENT_USER_KEY = 'solana_sniper_current_user';
const SECURITY_CONFIG_KEY = 'solana_sniper_sec_config';
const BLOCKED_LIST_KEY = 'solana_sniper_blocked_list';
const SECURITY_LOGS_KEY = 'solana_sniper_sec_logs';
const ATTEMPTS_KEY = 'solana_sniper_login_attempts';

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
    
    if (!localStorage.getItem(SECURITY_CONFIG_KEY)) {
        localStorage.setItem(SECURITY_CONFIG_KEY, JSON.stringify({
            maxLoginAttempts: 5,
            lockoutDurationMinutes: 15
        }));
    }
};

// Run seed immediately
seedUsers();

// --- HELPERS ---
// Simulate IP based on session or random for demo
const getClientIP = () => {
    return '192.168.1.' + Math.floor(Math.random() * 255); 
};

// --- DATA ACCESS ---

export const getUsers = (): User[] => {
    try {
        return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    } catch { return []; }
};

const saveUsers = (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const getSecurityConfig = (): SecurityConfig => {
    return JSON.parse(localStorage.getItem(SECURITY_CONFIG_KEY) || '{"maxLoginAttempts": 5, "lockoutDurationMinutes": 15}');
};

export const saveSecurityConfig = (cfg: SecurityConfig) => {
    localStorage.setItem(SECURITY_CONFIG_KEY, JSON.stringify(cfg));
};

export const getBlockedList = (): BlockedEntity[] => {
    return JSON.parse(localStorage.getItem(BLOCKED_LIST_KEY) || '[]');
};

export const saveBlockedList = (list: BlockedEntity[]) => {
    localStorage.setItem(BLOCKED_LIST_KEY, JSON.stringify(list));
};

export const getSecurityLogs = (): SecurityLog[] => {
    return JSON.parse(localStorage.getItem(SECURITY_LOGS_KEY) || '[]');
};

const addSecurityLog = (event: SecurityLog['event'], username: string | undefined, details: string, severity: SecurityLog['severity']) => {
    const logs = getSecurityLogs();
    const newLog: SecurityLog = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        event,
        username,
        ip: getClientIP(),
        details,
        severity
    };
    // Keep last 500 logs
    const updated = [newLog, ...logs].slice(0, 500);
    localStorage.setItem(SECURITY_LOGS_KEY, JSON.stringify(updated));
};

// --- AUTH LOGIC WITH SECURITY ---

interface AttemptRecord {
    count: number;
    lastAttempt: number;
}

const getAttempts = (): Record<string, AttemptRecord> => {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}');
};

const saveAttempts = (attempts: Record<string, AttemptRecord>) => {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
};

export const login = (loginName: string, pass: string): { success: boolean; user?: User; error?: string } => {
    const config = getSecurityConfig();
    const blockedList = getBlockedList();
    const ip = getClientIP(); // In real app, get real IP
    
    // 1. Check if Blocked (IP or Username)
    const isBlocked = blockedList.find(b => b.target === loginName || b.target === ip);
    if (isBlocked) {
        addSecurityLog('LOGIN_FAILED', loginName, `Blocked entity attempted login. Reason: ${isBlocked.reason}`, 'WARNING');
        return { success: false, error: `Доступ заблокирован: ${isBlocked.reason}` };
    }

    // 2. Check Rate Limiting
    const attempts = getAttempts();
    const userAttempts = attempts[loginName] || { count: 0, lastAttempt: 0 };
    
    if (userAttempts.count >= config.maxLoginAttempts) {
        const lockoutTimeMs = config.lockoutDurationMinutes * 60 * 1000;
        const timePassed = Date.now() - userAttempts.lastAttempt;
        
        if (timePassed < lockoutTimeMs) {
            const timeLeftMin = Math.ceil((lockoutTimeMs - timePassed) / 60000);
            addSecurityLog('LOGIN_FAILED', loginName, 'Rate limit exceeded (Lockout active)', 'WARNING');
            return { success: false, error: `Слишком много попыток. Блокировка на ${timeLeftMin} мин.` };
        } else {
            // Reset after lockout expires
            userAttempts.count = 0;
        }
    }

    const users = getUsers();
    const user = users.find(u => (u.username === loginName || u.email === loginName) && u.passwordHash === pass);
    
    if (user) {
        // Success
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        
        // Reset attempts
        delete attempts[loginName];
        saveAttempts(attempts);
        
        addSecurityLog('LOGIN_SUCCESS', user.username, 'User logged in successfully', 'INFO');
        return { success: true, user };
    } else {
        // Failure
        userAttempts.count += 1;
        userAttempts.lastAttempt = Date.now();
        attempts[loginName] = userAttempts;
        saveAttempts(attempts);

        addSecurityLog('LOGIN_FAILED', loginName, `Incorrect password (Attempt ${userAttempts.count}/${config.maxLoginAttempts})`, 'WARNING');

        // Check if we need to ban
        if (userAttempts.count >= config.maxLoginAttempts) {
            addSecurityLog('LOCKOUT', loginName, `Account temporarily locked due to brute force`, 'CRITICAL');
            return { success: false, error: `Превышен лимит попыток. Аккаунт заблокирован на ${config.lockoutDurationMinutes} мин.` };
        }

        return { success: false, error: `Неверный логин или пароль (Попытка ${userAttempts.count} из ${config.maxLoginAttempts})` };
    }
};

export const logout = () => {
    const user = getCurrentUser();
    if (user) {
        addSecurityLog('LOGOUT', user.username, 'User logged out', 'INFO');
    }
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
    addSecurityLog('ADMIN_ACTION', 'admin', `Created user ${username}`, 'INFO');
    return newUser;
};

export const adminDeleteUser = (userId: string) => {
    const users = getUsers().filter(u => u.id !== userId);
    saveUsers(users);
    addSecurityLog('ADMIN_ACTION', 'admin', `Deleted user ${userId}`, 'WARNING');
};

export const adminResetPassword = (userId: string, newPass: string) => {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
        users[idx].passwordHash = newPass;
        saveUsers(users);
        addSecurityLog('ADMIN_ACTION', 'admin', `Reset password for ${users[idx].username}`, 'WARNING');
    }
};

export const unblockEntity = (id: string) => {
    const list = getBlockedList().filter(b => b.id !== id);
    saveBlockedList(list);
    addSecurityLog('ADMIN_ACTION', 'admin', `Unblocked entity ${id}`, 'INFO');
};
