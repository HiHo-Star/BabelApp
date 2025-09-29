// User types
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  language: string;
  role: 'admin' | 'manager' | 'member';
  createdAt: Date;
  lastSeen: Date;
}

// Task types
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'NEW' | 'IN PROGRESS' | 'DELAYED' | 'COMPLETED';
  priority: 'low' | 'medium' | 'high';
  progress: number;
  startTime?: Date;
  dueDate?: Date;
  timeRemaining?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Chat types
export interface Chat {
  id: string;
  name?: string;
  type: 'group' | 'private';
  createdBy: string;
  createdAt: Date;
}

// Message types
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  contentType: 'text' | 'image' | 'file';
  originalLanguage?: string;
  createdAt: Date;
}

// Message translation types
export interface MessageTranslation {
  id: string;
  messageId: string;
  targetLanguage: string;
  translatedContent: string;
  createdAt: Date;
}

// Note types
export interface Note {
  id: string;
  title: string;
  content: string;
  reminder?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Request/Response types
export interface CreateUserRequest {
  email: string;
  password: string;
  username: string;
  displayName: string;
  language: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    language: string;
    createdAt: Date;
    lastSeen: Date;
  };
  token: string;
}

// Socket event types
export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  contentType: 'text' | 'image' | 'file';
  originalLanguage?: string;
  createdAt: Date;
  sender?: {
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface ChatEvent {
  type: 'message' | 'user_joined' | 'user_left' | 'typing' | 'stop_typing';
  data: any;
}

// Database types (PostgreSQL)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'createdAt' | 'lastSeen'>;
        Update: Partial<Omit<User, 'id' | 'createdAt'>>;
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<Task, 'id' | 'createdAt'>>;
      };
      chats: {
        Row: Chat;
        Insert: Omit<Chat, 'id' | 'createdAt'>;
        Update: Partial<Omit<Chat, 'id' | 'createdAt'>>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'createdAt'>;
        Update: Partial<Omit<Message, 'id' | 'createdAt'>>;
      };
      message_translations: {
        Row: MessageTranslation;
        Insert: Omit<MessageTranslation, 'id' | 'createdAt'>;
        Update: Partial<Omit<MessageTranslation, 'id' | 'createdAt'>>;
      };
    };
  };
} 