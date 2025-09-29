# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

# Normitin Frontend

A React TypeScript frontend application built with Vite for the Normitin project.

## Getting Started

### Prerequisites
- Node.js (version 18 or higher)
- npm or yarn
- Backend server running on port 3000

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Project Structure

```
src/
├── components/     # Reusable React components
├── services/       # API services and utilities
├── types/          # TypeScript type definitions
├── assets/         # Static assets (images, fonts, etc.)
├── App.tsx         # Main application component
├── App.css         # Main application styles
├── main.tsx        # Application entry point
└── index.css       # Global styles
```

### API Integration

The frontend is configured to proxy API requests to the backend server:
- Frontend runs on port 5173
- API calls to `/api/*` are proxied to `http://localhost:3000`
- Axios is configured for API communication

### Development Notes

- The application uses TypeScript for type safety
- ESLint is configured for code quality
- Vite provides fast hot module replacement (HMR)
- The build process includes TypeScript compilation and bundling

### Backend Integration

Make sure your backend server is running on port 3000 before starting the frontend development server. The frontend will attempt to connect to the backend API endpoints through the configured proxy.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory and can be served by any static file server.

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
