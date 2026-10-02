# Maintainer setup

Replace `<domain>` with your app hostname and `<project-ref>` with your Supabase project reference.

1. **Create a Supabase project.** Record its project URL and public anonymous key from Project Settings → API.
2. **Run the migration.** Execute `supabase/migrations/0001_init.sql` in the Supabase SQL editor. Alternatively, authenticate the Supabase CLI and run `npx supabase link && npx supabase db push` from the repository.
3. **Create a Google OAuth client.** In Google Cloud Console, configure the OAuth consent screen and create an OAuth client of type **Web application**. Set authorized JavaScript origins to `https://<domain>` and `http://localhost:5173`. Set the authorized redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`.
4. **Enable Google in Supabase Auth.** Under Authentication → Providers → Google, enter the Google client ID and client secret, enable the provider, and save. Keep the client secret in the provider configuration, out of frontend environment variables.
5. **Configure Supabase Auth URLs.** Set Site URL to `https://<domain>`. Add `https://<domain>/auth/callback` and `http://localhost:5173/auth/callback` to Redirect URLs.
6. **Deploy with Vercel.** Import the repository, select the Vite preset, use `npm run build` with output directory `dist`, and select Node.js 24 or newer to match `package.json`. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GITHUB_URL`, and `VITE_SITE_URL` for the deployment environment. Set `VITE_SITE_URL` to `https://<domain>` and use only the public anonymous Supabase key. Add the custom domain and configure its DNS as directed by Vercel. Redeploy after changing build-time environment variables.
7. **Update Google OAuth for the domain.** Confirm the OAuth consent screen's app links and authorized domains use the production domain, and that the OAuth client's authorized origins include `https://<domain>`. Complete Google's publishing or verification requirements if applicable to your consent configuration.
8. **Verify the deployed app.** Check the social image at `https://<domain>/og.png`. Test Google and magic-link sign-in, an invite link, and direct navigation to a workspace route. Confirm two sessions receive real-time updates.
9. **Optionally verify RLS.** Run `supabase/tests/rls.sql` against a test Supabase project and inspect the results before enabling production use.

## Automation

Pull requests and pushes to `main` run installation, type checking, linting, formatting, tests, and a production build. CI uses Node.js 24 to match the package requirement of Node.js >=24.

Pushing a `v*` tag runs a production build, packages `dist` as `squash-dist.zip`, and creates a GitHub release with generated notes and the zip attached. Configure the repository Actions variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GITHUB_URL`, and `VITE_SITE_URL` before releasing: these public values are embedded in the release build. Release automation requires permission to write repository contents.
