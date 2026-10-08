import { Link } from 'react-router-dom'
import { LegalLayout } from '../components/marketing/LegalLayout'
import { githubUrl } from '../components/marketing/links'
import { usePageTitle } from '../components/marketing/usePageTitle'

const PRIVACY_UPDATED = '2026-10-07'

export default function Privacy() {
  usePageTitle('Privacy')
  const repo = githubUrl()
  return (
    <LegalLayout
      title="Privacy"
      updated={PRIVACY_UPDATED}
      lead={
        <p>
          What Squash stores, where, and who can see it. Squash is an open-source project; this
          notice covers the hosted instance run by the maintainer of this open-source project. If
          someone else runs the copy you are using, they operate it and decide what happens to its
          data.
        </p>
      }
      sections={[
        {
          id: 'what-is-stored',
          title: 'What is stored',
          body: (
            <>
              <p>
                Everything below lives in the instance’s Supabase project (Postgres and Storage).
              </p>
              <ul>
                <li>
                  <strong>Your account.</strong> Your email address and sign-in records, kept by
                  Supabase Auth. You sign in with a magic link sent to your email, or with Google.
                </li>
                <li>
                  <strong>Your profile.</strong> A display name, an avatar colour, and, if you sign
                  in with Google, the name and picture link Google provides. Without Google, the
                  name starts as the part of your email address before the @.
                </li>
                <li>
                  <strong>Workspaces.</strong> The name, its invite code, its members and their
                  roles, and when each joined.
                </li>
                <li>
                  <strong>Bugs and feature requests.</strong> Title, description, voice transcript
                  (if you dictated), severity, status, assignee, resolution notes, who filed and
                  resolved it and when, and where it was filed: your browser, operating system,
                  window size and the page link in the description.
                </li>
                <li>
                  <strong>Screenshots.</strong> The images you attach, compressed to WebP in your
                  browser, and any markup you draw on them, in a private storage bucket.
                </li>
                <li>
                  <strong>Comments and history.</strong> Comments, an activity log of filed, edited,
                  assigned, resolved, reopened and commented events, and a record of deleted bugs
                  (number, title, who deleted it and when).
                </li>
                <li>
                  <strong>Claude Code runs.</strong> If you send a bug to Claude Code, the run’s
                  status and summary, and the branch, commit, pull request link and file counts if
                  it reports them. Your code itself never leaves your computer through Squash.
                </li>
                <li>
                  <strong>Rate limiting.</strong> The time of each bug you file, kept briefly to
                  enforce the limit of 30 a minute.
                </li>
              </ul>
              <p>
                Presence (who is online and which bug they have open) is passed between browsers
                live and is not stored.
              </p>
            </>
          ),
        },
        {
          id: 'who-can-see-it',
          title: 'Who can see it',
          body: (
            <p>
              Members of a workspace see everything in it; nobody else does. This is enforced by Row
              Level Security in the database, not by the app, and screenshots are only served
              through signed links that expire after an hour. As operator of the hosted instance,
              the maintainer has administrative access to its Supabase project, as any operator of a
              database does.
            </p>
          ),
        },
        {
          id: 'in-your-browser',
          title: 'In your browser',
          body: (
            <>
              <p>
                Squash has no analytics, advertising or tracking scripts, and sets no tracking
                cookies. Its fonts are served from the app itself, not from a font service.
              </p>
              <p>
                Your browser’s storage keeps your sign-in session and a few preferences: theme,
                colour scheme, list width, the last workspace you opened, whether notifications are
                on, and whether you dismissed the getting-started checklist.
              </p>
              <p>
                Dictation uses your browser’s own speech recognition. Your browser decides where the
                audio is processed; in Chrome that is Google’s speech service. Teammates’ Google
                profile pictures load from Google.
              </p>
            </>
          ),
        },
        {
          id: 'service-providers',
          title: 'Service providers',
          body: (
            <p>
              The hosted instance runs on <strong>Vercel</strong> (which serves the app and, like
              any web host, sees request metadata such as IP addresses) and{' '}
              <strong>Supabase</strong> (database, sign-in, file storage and live updates). Sign-in
              emails are sent through Supabase Auth; Google sign-in goes through Google.
            </p>
          ),
        },
        {
          id: 'keeping-and-deleting',
          title: 'Keeping and deleting',
          body: (
            <>
              <p>
                Data stays until it is deleted. Deleting a bug removes it with its comments and
                history, and the app removes its screenshot files; only the deletion record stays.
                Deleting a workspace removes everything in it.
              </p>
              <p>
                You can delete your account from Settings. That removes your sign-in, your profile
                and the workspaces you own alone; if you own a shared workspace, transfer it first.
                Bugs and comments you wrote in other people’s workspaces stay, shown as written by
                “Deleted user”. You can export a workspace’s bugs as CSV or Markdown at any time.
              </p>
            </>
          ),
        },
        {
          id: 'questions',
          title: 'Questions and changes',
          body: (
            <p>
              Squash is offered as is by the maintainer of this open-source project. Ask questions
              by opening an issue on <a href={`${repo}/issues`}>GitHub</a>, or report a security
              problem privately as described in the <Link to="/docs/security">security model</Link>.
              Changes to this notice are made in the open repository, and the date above changes
              with them.
            </p>
          ),
        },
      ]}
    />
  )
}
