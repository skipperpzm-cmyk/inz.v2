# Travel Planner Application

## Overview
The Travel Planner application is a web-based platform designed to help users plan their travel itineraries efficiently. Built using modern technologies such as Next.js, React, Tailwind CSS, Supabase, Drizzle ORM, and TypeScript, this application aims to provide a seamless user experience with a focus on performance and scalability.

## Technologies Used
- **Next.js**: A React framework for building server-rendered applications.
- **React**: A JavaScript library for building user interfaces.
- **Tailwind CSS**: A utility-first CSS framework for styling.
- **Supabase**: An open-source Firebase alternative for backend services.
- **Drizzle ORM**: An ORM for managing database interactions.
- **TypeScript**: A superset of JavaScript that adds static types.

## Project Structure
The project is organized into several key directories:

- **app/**: Contains the main application code, including pages and API routes.
- **components/**: Contains reusable UI components.
- **hooks/**: Contains custom hooks for managing state and side effects.
- **lib/**: Contains utility functions and configurations for authentication, database, and validation.
- **styles/**: Contains global CSS styles.
- **tests/**: Contains test files for ensuring application functionality.

## Getting Started
To get started with the Travel Planner application, follow these steps:

1. **Clone the repository**:
   ```
   git clone <repository-url>
   cd travel-planner
   ```

2. **Install dependencies**:
   ```
   npm install
   ```

3. **Set up environment variables**:
   - Copy `.env.example` to `.env.local` and provide your real `DATABASE_URL` there.
   - Never commit `.env.local`. Keep it on your machine or store the secrets in your hosting provider's secret manager (e.g., Vercel/Netlify environment settings).
   - Rotate credentials immediately if a secret is ever committed to the repository.

4. **Run the development server**:
   ```
   npm run dev
   ```

5. **Open your browser**:
   Navigate to `http://localhost:3000` to view the application.

## Contributing
Contributions are welcome! Please feel free to submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.

## Database Migrations

## Magic Link & SMTP Setup

### Testowanie magic linków bez SMTP

Jeśli nie skonfigurujesz SMTP, aplikacja automatycznie wypisze magic link w konsoli serwera (np. terminal, gdzie uruchamiasz aplikację).

1. Tester wpisuje swój email na stronie logowania i klika "Wyślij magic link".
2. Link pojawi się w konsoli serwera (z informacją dla kogo i na ile minut jest ważny).
3. Skopiuj link z konsoli i przekaż testerowi (np. przez e-mail, chat).
4. Tester klika link i loguje się do aplikacji.

Nie musisz konfigurować SMTP ani żadnych dodatkowych usług — wszystko działa lokalnie.

To enable magic link login, configure SMTP email delivery:

1. Add these variables to your `.env.local`:

```
SMTP_HOST=your.smtp.host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM=no-reply@yourdomain.com
SMTP_SECURE=true # optional, for SSL
MAGIC_LINK_BASE_URL=https://your-app-url
```

2. The app will send magic link emails using these credentials. If SMTP is not set, links will be logged to the server console.

3. You can test by using the "Wyślij magic link" button on the login page.

4. The migration for magic_links table is in `drizzle/0031_create_magic_links.sql`.

5. For production, store secrets in your hosting provider's environment manager (never commit `.env.local`).

- **Background migration**: adds the `background_url` column to the `users` table used for persisting user-selected dashboard backgrounds.
- Run locally or in deployment with:

```bash
npm run migrate:background
```

- The script loads `DATABASE_URL` from your environment or from `.env.local` (it attempts to load `.env.local` first). If `DATABASE_URL` is missing the script will print a helpful error and exit.
- The migration SQL is `drizzle/0001_add_user_background.sql` and the command uses `psql` under the hood; ensure the `psql` CLI is installed and available on your PATH.
- The SQL uses `IF NOT EXISTS`, so running the script multiple times is safe and will not error if the column already exists.

Examples:

- Local development (add a `.env.local` at project root with `DATABASE_URL`):

```bash
cp .env.example .env.local
# edit .env.local to set DATABASE_URL
npm run migrate:background
```

- Production (CI/CD or server): set `DATABASE_URL` in your environment and run the same command. For example on Linux:

```bash
DATABASE_URL="postgres://user:pass@host:5432/dbname" npm run migrate:background
```
