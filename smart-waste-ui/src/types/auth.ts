export type UserRole = "admin" | "truck_driver";

export interface User {
    id: number;
    username: string;
    email: string;
    full_name: string;
    role: UserRole;
    is_active: boolean;
    created_at: string;
}

export interface AuthResponse {
    user: User;
    token: string;
    token_type: string;
}