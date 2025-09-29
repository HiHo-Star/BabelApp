# BabelApp - Multi-Language Task Management Chat Application

A modern, real-time chat application with task management features, built with React, Node.js, and PostgreSQL. Supports multi-language communication with automatic translation.

## 🌟 Features

- **Real-time Chat**: Instant messaging with Socket.IO
- **Multi-language Support**: Automatic message translation
- **Task Management**: Create, assign, and track tasks
- **User Management**: Role-based access control
- **File Sharing**: Upload and share media files
- **URL-based User Detection**: Test multiple users easily
- **Responsive Design**: Works on desktop and mobile

## 🏗️ Architecture

```
BabelApp/
├── frontend/          # React TypeScript web application
│   ├── components/    # React components
│   ├── pages/         # Page components
│   ├── services/      # API and socket services
│   ├── store/         # State management (Zustand)
│   └── types/         # TypeScript types
├── backend/           # Node.js Express API + Socket.io
│   ├── controllers/   # Route controllers
│   ├── middleware/    # Authentication & validation
│   ├── services/      # Business logic
│   ├── config/        # Database configuration
│   ├── types/         # TypeScript types
│   └── utils/         # Utility functions
├── androidapp/        # Android mobile application
│   ├── app/src/main/java/com/babelapp/mobile/
│   ├── ui/screens/    # Composable screens
│   ├── ui/viewmodel/  # ViewModels for state management
│   ├── data/models/   # Data classes
│   └── services/      # Socket.io and API services
└── database/          # PostgreSQL schema
```

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Socket.IO Client** for real-time communication
- **Zustand** for state management
- **React Router** for navigation
- **React Hook Form** with Zod validation

### Backend
- **Node.js** with TypeScript
- **Express.js** for API server
- **Socket.IO** for real-time features
- **PostgreSQL** for database
- **JWT** for authentication
- **Google Translate API** for translations
- **Cloudinary** for file storage

### Android App
- **Kotlin** with Jetpack Compose
- **MVVM Architecture** with ViewModels
- **Socket.IO Client** for Android
- **Material 3** design system
- **Coroutines** for async operations
- **StateFlow** for reactive state management

### Infrastructure
- **Docker** for containerization
- **Nginx** for reverse proxy
- **PostgreSQL** for data persistence
- **SSL/TLS** for security

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- PostgreSQL database
- Google Translate API key (optional for development)
- Cloudinary account (optional for development)

### URL Parameter User Detection

The app supports multiple users through URL parameters. This allows different users to access their own interface without separate accounts.

**Usage:**
- `http://localhost:3000/?user=davidrom` - Opens the app for user "davidrom"
- `http://localhost:3000/?user=sarah` - Opens the app for user "sarah"
- `http://localhost:3000/` - Opens with default user

**Testing:**
- Visit `http://localhost:3000/test.html` for a test page with different user links
- Each user will have their own chat interface and context
- Perfect for testing multi-user scenarios on different devices

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd BabelApp
```

2. Install dependencies:
```bash
npm run install:all
```

3. Set up environment variables:
```bash
# Copy the example environment file
cp backend/env.example backend/.env

# Edit the .env file with your actual values
```

4. Start the development servers:
```bash
npm run dev
```

This will start both the frontend (http://localhost:3000) and backend (http://localhost:5000) servers.

## Development

### Frontend Development
```bash
cd frontend
npm start
```

### Backend Development
```bash
cd backend
npm run dev
```

### Building for Production
```bash
# Build frontend
npm run build

# Build backend
cd backend && npm run build
```

## Database Schema

The application uses PostgreSQL with the following main tables:

- `users`: User accounts and preferences
- `tasks`: Task management with status tracking
- `chats`: Chat rooms and conversations
- `messages`: Individual chat messages
- `message_translations`: Translated message content
- `notes`: User notes and reminders

## Deployment

### Quick Deployment
```bash
# Deploy to your server
./deploy.sh

# Or using PowerShell on Windows
.\deploy.ps1
```

### Manual Deployment
See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

## Environment Variables

### Backend (.env)
```env
PORT=5000
FRONTEND_URL=https://your-domain.com

# PostgreSQL Database
DATABASE_URL=postgresql://user:password@host:5432/database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=babelapp
DB_USER=babelapp_user
DB_PASSWORD=babelapp_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here

# Google Translate API
GOOGLE_TRANSLATE_API_KEY=your_google_translate_api_key

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

NODE_ENV=production
```

### Frontend (.env)
```env
VITE_API_URL=https://your-domain.com/api
VITE_SOCKET_URL=https://your-domain.com
VITE_APP_NAME=BabelApp
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Check the [deployment guide](DEPLOYMENT_GUIDE.md)
- Review the [quick start guide](QUICK_START.md)
- Open an issue on GitHub 