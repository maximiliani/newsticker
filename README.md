<a href="https://demo-nextjs-with-supabase.vercel.app/">
  <img alt="Next.js and Supabase Starter Kit - the fastest way to build apps with Next.js and Supabase" src="https://demo-nextjs-with-supabase.vercel.app/opengraph-image.png">
  <h1 align="center">Next.js and Supabase Starter Kit</h1>
</a>

<p align="center">
 The fastest way to build apps with Next.js and Supabase
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#demo"><strong>Demo</strong></a> ·
  <a href="#deploy-to-vercel"><strong>Deploy to Vercel</strong></a> ·
  <a href="#clone-and-run-locally"><strong>Clone and run locally</strong></a> ·
  <a href="#feedback-and-issues"><strong>Feedback and issues</strong></a>
  <a href="#more-supabase-examples"><strong>More Examples</strong></a>
</p>
<br/>

## Features

- Works across the entire [Next.js](https://nextjs.org) stack
  - App Router
  - Pages Router
  - Middleware
  - Client
  - Server
  - It just works!
- supabase-ssr. A package to configure Supabase Auth to use cookies
- Styling with [Tailwind CSS](https://tailwindcss.com)
- Components with [shadcn/ui](https://ui.shadcn.com/)
- Optional deployment with [Supabase Vercel Integration and Vercel deploy](#deploy-your-own)
  - Environment variables automatically assigned to Vercel project

## Demo

You can view a fully working demo at [demo-nextjs-with-supabase.vercel.app](https://demo-nextjs-with-supabase.vercel.app/).

## Deploy to Vercel

Vercel deployment will guide you through creating a Supabase account and project.

After installation of the Supabase integration, all relevant environment variables will be assigned to the project so the deployment is fully functioning.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js%2Ftree%2Fcanary%2Fexamples%2Fwith-supabase&project-name=nextjs-with-supabase&repository-name=nextjs-with-supabase&demo-title=nextjs-with-supabase&demo-description=This+starter+configures+Supabase+Auth+to+use+cookies%2C+making+the+user%27s+session+available+throughout+the+entire+Next.js+app+-+Client+Components%2C+Server+Components%2C+Route+Handlers%2C+Server+Actions+and+Middleware.&demo-url=https%3A%2F%2Fdemo-nextjs-with-supabase.vercel.app%2F&external-id=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js%2Ftree%2Fcanary%2Fexamples%2Fwith-supabase&demo-image=https%3A%2F%2Fdemo-nextjs-with-supabase.vercel.app%2Fopengraph-image.png)

The above will also clone the Starter kit to your GitHub, you can clone that locally and develop locally.

If you wish to just develop locally and not deploy to Vercel, [follow the steps below](#clone-and-run-locally).

## Clone and run locally

1. You'll first need a Supabase project which can be made [via the Supabase dashboard](https://database.new)

2. Create a Next.js app using the Supabase Starter template npx command

   ```bash
   npx create-next-app --example with-supabase with-supabase-app
   ```

   ```bash
   yarn create next-app --example with-supabase with-supabase-app
   ```

   ```bash
   pnpm create next-app --example with-supabase with-supabase-app
   ```
# Next.js Modern Web Application

A modern web application built with Next.js, TypeScript, Tailwind CSS, and Supabase, organized using a feature-based architecture.

## Features

- 📝 Article Management System
- 📸 Instagram Integration
- 🔒 User Authentication
- 📱 Responsive Design
- 🌓 Dark/Light Mode
- 🛡️ Robust Error Handling

## Project Structure

The project follows a feature-based organization to improve maintainability and scalability:

```
project/
├── app/                      # Next.js app directory (routes)
│   ├── error.tsx            # Global error boundary
│   ├── loading.tsx          # Global loading state
│   ├── not-found.tsx        # 404 page
│   └── protected/           # Protected routes
├── components/               # Shared UI components
│   └── ui/                  # Design system components
├── features/                 # Feature-based organization
│   ├── articles/            # Article management feature
│   │   ├── components/      # Feature-specific components
│   │   └── services/        # Feature-specific data services
│   └── instagram/           # Instagram integration feature
├── lib/                      # Core utilities and configurations
│   ├── hooks/               # Custom React hooks
│   ├── supabase/            # Supabase client utilities
│   └── utils/               # Shared utility functions
└── types/                    # TypeScript type definitions
```

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create environment variables:
   ```bash
   cp .env.example .env.local
   ```
4. Fill in your Supabase and other environment variables in `.env.local`
5. Run the development server:
   ```bash
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Architecture

This project follows Next.js best practices, including:

### Server and Client Components
# Next.js Modern Web Application

A modern, feature-rich web application built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Features

- Article Management System
- Instagram Integration
- User Authentication
- Responsive Design

## Project Structure

The project follows a feature-based organization with a clear separation of server and client components:

```
project/
├── app/                      # Next.js app directory (server components)
│   ├── protected/            # Protected routes requiring authentication
│   ├── news/                 # News article routes
│   └── api/                  # API routes
├── components/               # Shared UI components
│   └── ui/                  # Shadcn/ui components
├── features/                 # Feature-based organization
│   ├── articles/            # Article management feature
│   │   ├── components/      # UI components
│   │   └── services/        # Data services
│   └── instagram/           # Instagram integration feature
├── lib/                      # Core utilities and hooks
│   ├── hooks/               # React hooks
│   ├── supabase/            # Supabase clients
│   └── utils/               # Utility functions
└── types/                    # TypeScript type definitions
```

## Server Components vs Client Components

This project follows Next.js best practices for component separation:

- **Server Components** (`app/` directory): Fetch data, handle authentication, and render initial HTML
- **Client Components** (marked with "use client"): Handle interactivity, state, and effects

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and fill in your environment variables
4. Run the development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_INSTAGRAM_CLIENT_ID=your-instagram-client-id
```

## Key Technologies

- **Next.js**: React framework for server-side rendering and static site generation
- **TypeScript**: Static type checking for JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Supabase**: Open-source Firebase alternative with built-in authentication and database
- **React Hook Form**: Form handling and validation
- **Zod**: TypeScript-first schema validation
- **Radix UI**: Headless UI components for building accessible interfaces

## Development Guidelines

1. **Server vs Client Components**:
   - Server components should handle data fetching and initial rendering
   - Client components should handle interactivity and state
   - Use "use client" directive only when necessary

2. **Feature Organization**:
   - Group related components, services, and utilities by feature
   - Keep component responsibilities clear and focused

3. **Error Handling**:
   - Use the error handling utilities for consistent error management
   - Log errors with context information

4. **Type Safety**:
   - Define and use TypeScript types for all data structures
   - Use Zod for runtime validation of user inputs

5. **Hooks**:
   - Create custom hooks for reusable logic
   - Keep hooks focused on specific functionality

## License

This project is licensed under the MIT License - see the LICENSE file for details.
- **Server Components**: Used for data fetching, initial render, and SEO
- **Client Components**: Used for interactivity and client-side state management

### Data Flow

1. Server components fetch initial data directly from Supabase
2. Data is passed to client components as props
3. Client components use custom hooks for state management and real-time updates
4. Service classes provide centralized data access methods

### Error Handling

Comprehensive error handling using:

- Global error boundary in `app/error.tsx`
- Custom `AppError` class for consistent error types
- Centralized error logging through `logError` function
- Graceful fallbacks and error states in components

## Key Technologies

- **Next.js 14**: React framework with App Router
- **TypeScript**: Static type checking and improved developer experience
- **Tailwind CSS**: Utility-first CSS framework
- **Supabase**: Open-source backend with auth, database, and storage
- **React Hook Form**: Form handling with validation
- **Radix UI**: Accessible component primitives
- **Zod**: TypeScript-first schema validation

## Development Guidelines

1. **Component Organization**:
   - Use server components for data fetching
   - Keep client components focused on interactivity
   - Use custom hooks for state management

2. **Error Handling**:
   - Always wrap async operations in try/catch
   - Use the `logError` utility for consistent error logging
   - Provide user-friendly error messages

3. **Performance**:
   - Implement data caching where appropriate
   - Use suspense boundaries for loading states
   - Keep client bundle size small

4. **Code Style**:
   - Add JSDoc comments for functions and components
   - Use descriptive variable and function names
   - Follow the established naming conventions

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Run tests: `npm test`
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
3. Use `cd` to change into the app's directory

   ```bash
   cd with-supabase-app
   ```

4. Rename `.env.example` to `.env.local` and update the following:

   ```
   NEXT_PUBLIC_SUPABASE_URL=[INSERT SUPABASE PROJECT URL]
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[INSERT SUPABASE PROJECT API ANON KEY]
   ```

   Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` can be found in [your Supabase project's API settings](https://app.supabase.com/project/_/settings/api)

5. You can now run the Next.js local development server:

   ```bash
   npm run dev
   ```

   The starter kit should now be running on [localhost:3000](http://localhost:3000/).

6. This template comes with the default shadcn/ui style initialized. If you instead want other ui.shadcn styles, delete `components.json` and [re-install shadcn/ui](https://ui.shadcn.com/docs/installation/next)

> Check out [the docs for Local Development](https://supabase.com/docs/guides/getting-started/local-development) to also run Supabase locally.

## Feedback and issues

Please file feedback and issues over on the [Supabase GitHub org](https://github.com/supabase/supabase/issues/new/choose).

## More Supabase examples

- [Next.js Subscription Payments Starter](https://github.com/vercel/nextjs-subscription-payments)
- [Cookie-based Auth and the Next.js 13 App Router (free course)](https://youtube.com/playlist?list=PL5S4mPUpp4OtMhpnp93EFSo42iQ40XjbF)
- [Supabase Auth and the Next.js App Router](https://github.com/supabase/supabase/tree/master/examples/auth/nextjs)



## Backend & API Docs

- API overview and route map: app/api/README.md
- Backend architecture report (design, auth, stored procedures): docs/backend-architecture-report.md

